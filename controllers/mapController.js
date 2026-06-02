// 这个文件是“地图能力控制器”。
// 主要把逆地理解析、地点联想、地点搜索这些地图能力对前端做一层安全封装。
const { successResponse, errorResponse } = require('../utils/helpers');
const {
  reverseGeocodeByCoordinate,
  suggestLocations,
  searchLocations,
  searchNearbyLocations
} = require('../services/serviceAreaSearchService');
const { getRidingRouteDetail } = require('../services/routePlanningService');

// ==================== 骑手送货总览路线工具 ====================
const safeText = (value) => (value == null ? '' : String(value).trim());

const toFiniteNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const hasValidCoords = (lng, lat) => (
  Number.isFinite(lng) &&
  Number.isFinite(lat) &&
  !(lng === 0 && lat === 0)
);

const getDistanceSquare = (fromPoint, toPoint) => {
  const latDiff = Number(fromPoint.lat) - Number(toPoint.lat);
  const lngDiff = Number(fromPoint.lng) - Number(toPoint.lng);
  return latDiff * latDiff + lngDiff * lngDiff;
};

// 总览页只关心“当前骑手现在要送到哪些用户”。
// 所以这里把无效坐标先剔掉，再把前端真正需要的订单字段收干净。
const normalizeDeliveryOrders = (orders) => {
  return (Array.isArray(orders) ? orders : []).map((item, index) => {
    // 这里兼容两套字段名：
    // 1. customerLng/customerLat 是当前后端正式口径
    // 2. lng/lat 是之前前端总览页内部排序时用的旧口径
    // 这样即使某一端没及时更新，也不会再把整批订单清洗成空数组。
    const customerLng = toFiniteNumber(item?.customerLng ?? item?.lng);
    const customerLat = toFiniteNumber(item?.customerLat ?? item?.lat);
    if (!hasValidCoords(customerLng, customerLat)) {
      return null;
    }

    return {
      id: safeText(item?.id || item?.orderId || index),
      orderNo: safeText(item?.orderNo),
      label: safeText(item?.label),
      customerLng,
      customerLat
    };
  }).filter(Boolean);
};

// 用户要的是“一条蓝色串联线”，而不是每单各画一条。
// 这里先按离当前点最近的订单不断往后排，后面的真实路线就按这个顺序逐段去拉。
const buildOrderedDeliveryOrders = ({ riderLng, riderLat, orders }) => {
  const remaining = normalizeDeliveryOrders(orders);
  const ordered = [];
  let currentPoint = { lng: riderLng, lat: riderLat };

  while (remaining.length) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < remaining.length; i += 1) {
      const distance = getDistanceSquare(currentPoint, remaining[i]);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    const nextOrder = remaining.splice(nearestIndex, 1)[0];
    ordered.push(nextOrder);
    currentPoint = {
      lng: nextOrder.customerLng,
      lat: nextOrder.customerLat
    };
  }

  return ordered;
};

/**
 * 逆地理解析
 * 把经纬度坐标反查成地址信息，常用于地图选点回填地址。
 */
exports.reverseGeocode = async (req, res, next) => {
  try {
    const lng = Number(req.query.lng ?? req.query.longitude);
    const lat = Number(req.query.lat ?? req.query.latitude);

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return res.status(400).json(errorResponse('lng/lat 参数不正确'));
    }

    const payload = await reverseGeocodeByCoordinate({ lng, lat });

    if (!payload) {
      return res.status(503).json(errorResponse('腾讯地图逆地理解析暂不可用', 503));
    }

    res.json(successResponse(payload));
  } catch (error) {
    next(error);
  }
};

/**
 * 地点联想
 * 根据关键词做轻量级联想搜索，适合输入框边输边提示。
 */
exports.suggest = async (req, res, next) => {
  try {
    const keyword = String(req.query.keyword || req.query.q || '').trim();
    if (!keyword) {
      return res.status(400).json(errorResponse('keyword 参数不能为空'));
    }

    const payload = await suggestLocations({
      keyword,
      region: req.query.region,
      lng: req.query.lng ?? req.query.longitude,
      lat: req.query.lat ?? req.query.latitude,
      limit: req.query.limit
    });

    res.json(successResponse(payload));
  } catch (error) {
    next(error);
  }
};

/**
 * 地点搜索
 * 和 suggest(联想) 相比，这里更偏正式搜索，通常返回更完整的地点结果。
 */
exports.search = async (req, res, next) => {
  try {
    const keyword = String(req.query.keyword || req.query.q || '').trim();
    if (!keyword) {
      return res.status(400).json(errorResponse('keyword 参数不能为空'));
    }

    const payload = await searchLocations({
      keyword,
      region: req.query.region,
      lng: req.query.lng ?? req.query.longitude,
      lat: req.query.lat ?? req.query.latitude,
      limit: req.query.limit
    });

    res.json(successResponse(payload));
  } catch (error) {
    next(error);
  }
};

/**
 * 附近位置
 * 地图选点页拖到一个坐标后，如果逆地理返回的 POI 不够，这里按坐标再补一批周边地点。
 */
exports.nearby = async (req, res, next) => {
  try {
    const payload = await searchNearbyLocations({
      lng: req.query.lng ?? req.query.longitude,
      lat: req.query.lat ?? req.query.latitude,
      keywords: req.query.keywords,
      limit: req.query.limit,
      radius: req.query.radius
    });

    res.json(successResponse(payload));
  } catch (error) {
    next(error);
  }
};

/**
 * 骑手送货总览真实路线
 * 这条接口专门给 H5 总览页用：
 * 1. 从骑手当前位置出发
 * 2. 把所有配送中订单按最近距离排序
 * 3. 逐段请求腾讯真实骑行路线
 * 4. 最后拼成一条蓝色总路线给前端直接画出来
 *
 * 这里必须和原生腾讯导航保持同一种模式。
 * 原生插件当前走的是“骑行”，所以总览图如果还画“驾车”路线，
 * 用户在总览图里看到的蓝线就会和真正开始导航后的路线对不上。
 */
exports.riderDeliveryRoute = async (req, res, next) => {
  try {
    const payload = req.body?.payload && typeof req.body.payload === 'object'
      ? req.body.payload
      : (req.body || {});

    const riderLng = toFiniteNumber(payload.riderLng);
    const riderLat = toFiniteNumber(payload.riderLat);
    if (!hasValidCoords(riderLng, riderLat)) {
      return res.status(400).json(errorResponse('riderLng/riderLat 参数不正确'));
    }

    const orderedOrders = buildOrderedDeliveryOrders({
      riderLng,
      riderLat,
      orders: payload.orders
    });
    if (!orderedOrders.length) {
      return res.status(400).json(errorResponse('没有可规划路线的配送中订单'));
    }

    const routePath = [];
    const segments = [];
    let totalDistanceKm = 0;
    let fromPoint = { lng: riderLng, lat: riderLat };

    for (let i = 0; i < orderedOrders.length; i += 1) {
      const order = orderedOrders[i];
      const routeDetail = await getRidingRouteDetail({
        startLng: fromPoint.lng,
        startLat: fromPoint.lat,
        endLng: order.customerLng,
        endLat: order.customerLat,
        // 这里先保持和“原 H5 直连腾讯路线接口”同一套坐标口径，
        // 避免送货总览刚切到后端后，反而因为多做一次坐标转换把线画偏。
        convertToGcj: false,
        context: {
          scene: 'rider_delivery_overview',
          segmentIndex: i,
          orderId: order.id,
          orderNo: order.orderNo
        }
      });

      const segmentPath = Array.isArray(routeDetail.polylinePoints) ? routeDetail.polylinePoints : [];
      if (segmentPath.length) {
        routePath.push(...(routePath.length ? segmentPath.slice(1) : segmentPath));
      }

      if (Number.isFinite(routeDetail.distanceKm)) {
        totalDistanceKm += routeDetail.distanceKm;
      }

      segments.push({
        orderId: order.id,
        orderNo: order.orderNo,
        distanceKm: routeDetail.distanceKm,
        pointCount: segmentPath.length
      });

      fromPoint = {
        lng: order.customerLng,
        lat: order.customerLat
      };
    }

    res.json(successResponse({
      orderedOrderIds: orderedOrders.map((item) => item.id),
      orderedOrders,
      segmentCount: segments.length,
      totalDistanceKm: Math.round(totalDistanceKm * 1000) / 1000,
      segments,
      path: routePath
    }));
  } catch (error) {
    next(error);
  }
};
