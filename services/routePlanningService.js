// 这个文件是“路线规划服务”。
// 目前主要封装腾讯地图路线能力，给配送费估算、骑手总览路线等链路复用。
const axios = require('axios');
const TENCENT_MAP_CONFIG = require('../config/tencentMap');
const { wgs84ToGcj02 } = require('../utils/coordTransform');

// ==================== 基础数值工具 ====================
// 保留 3 位小数，统一公里值的输出精度。
const round3 = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num * 1000) / 1000 : null;
};

// 折线点给前端地图显示时，不需要太长的小数位。
// 这里统一保留 6 位，精度够用，也能少传一点数据。
const round6 = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num * 1000000) / 1000000 : null;
};

const toFiniteNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const buildCoordText = (lng, lat) => `${lat},${lng}`;

// 把前端传进来的坐标整理成腾讯接口需要的格式。
// 默认按项目当前主口径：库里存的是 WGS84，这里请求腾讯前先转 GCJ02。
// 但骑手总览页之前就是“前端直接请求腾讯”，为了避免新接口把线画偏，
// 那条链路可以显式关闭转换，保持和旧前端请求同一套坐标口径。
const normalizeProviderPoint = ({ lng, lat, convertToGcj = true }) => {
  const rawLng = toFiniteNumber(lng);
  const rawLat = toFiniteNumber(lat);
  if (rawLng === null || rawLat === null) {
    return { lng: null, lat: null };
  }
  if (!convertToGcj) {
    return { lng: rawLng, lat: rawLat };
  }
  return wgs84ToGcj02(rawLng, rawLat);
};

// 把腾讯地图返回的原始距离统一换算成公里。
const normalizeDistanceKm = (rawDistance) => {
  const distance = toFiniteNumber(rawDistance);
  if (distance === null || distance < 0) {
    return null;
  }

  // 腾讯路线规划返回值通常是米；若返回小数公里则直接保留。
  const distanceKm = Number.isInteger(distance) || distance >= 100 ? distance / 1000 : distance;
  return round3(distanceKm);
};

// 不同接口字段名可能不一样，这里统一从响应里尽量取出距离。
const pickDistanceKm = (payload) => {
  const candidates = [
    payload?.result?.routes?.[0]?.distance,
    payload?.result?.routes?.[0]?.dist,
    payload?.result?.elements?.[0]?.distance,
    payload?.result?.distance,
    payload?.routes?.[0]?.distance,
    payload?.routes?.[0]?.dist,
    payload?.route?.distance,
    payload?.route?.dist,
    payload?.distance
  ];

  for (const candidate of candidates) {
    const km = normalizeDistanceKm(candidate);
    if (km !== null) {
      return km;
    }
  }

  return null;
};

// 腾讯路线接口返回的 polyline 不是直接的点数组，
// 后半段是经过压缩编码的，要先按腾讯规则解码。
const decodeRoutePolyline = (rawPolyline) => {
  const source = Array.isArray(rawPolyline) ? rawPolyline.slice() : [];
  if (source.length < 2) {
    return [];
  }

  for (let i = 2; i < source.length; i += 1) {
    source[i] = Number(source[i - 2]) + Number(source[i]) / 1000000;
  }

  const points = [];
  for (let i = 0; i < source.length; i += 2) {
    const lat = round6(source[i]);
    const lng = round6(source[i + 1]);
    if (lng === null || lat === null) {
      continue;
    }
    points.push({ lng, lat });
  }

  return points;
};

// 有些腾讯接口字段名会有差异，这里统一尽量兜出来，
// 后面不管是拿距离还是拿折线，都只认这一层整理结果。
const pickRoutePolyline = (payload) => {
  const candidates = [
    payload?.result?.routes?.[0]?.polyline,
    payload?.result?.route?.polyline,
    payload?.routes?.[0]?.polyline,
    payload?.route?.polyline,
    payload?.polyline
  ];

  for (const candidate of candidates) {
    const decoded = decodeRoutePolyline(candidate);
    if (decoded.length) {
      return decoded;
    }
  }

  return [];
};

// 构造带状态码的路线规划错误。
const buildRouteError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const buildRawPreview = (payload) => {
  if (typeof payload === 'string') {
    return payload.slice(0, 500);
  }
  try {
    return JSON.stringify(payload).slice(0, 500);
  } catch (error) {
    return '[unserializable payload]';
  }
};

// 请求失败时，统一打印一份便于排查的上下文日志。
const logRouteFailure = ({
  stage,
  reason,
  context,
  originLng,
  originLat,
  destLng,
  destLat,
  raw,
  extra
}) => {
  console.error('[TencentRouteError]', {
    stage,
    reason,
    context: context || null,
    start: { lng: originLng, lat: originLat },
    end: { lng: destLng, lat: destLat },
    raw_preview: raw === undefined ? undefined : buildRawPreview(raw),
    extra: extra || null
  });
};

// 根据路线模式挑对应的腾讯接口地址。
// 目前项目里两种场景已经分开：
// 1. 配送费等老链路继续走驾车
// 2. 骑手送货总览要和原生导航保持一致，走骑行
const resolveRouteUrl = (travelMode = 'driving') => {
  return travelMode === 'bicycling'
    ? TENCENT_MAP_CONFIG.directionBicyclingUrl
    : TENCENT_MAP_CONFIG.directionDrivingUrl;
};

// ==================== 腾讯路线请求主流程 ====================
// 这是底层通用入口。
// 不管是驾车还是骑行，最终都从这里统一请求腾讯接口，避免每条业务链各写一套。
const requestRoute = async ({
  startLng,
  startLat,
  endLng,
  endLat,
  context,
  travelMode = 'driving',
  convertToGcj = true,
  requireDistance = false,
  requirePolyline = false
}) => {
  if (!TENCENT_MAP_CONFIG.key) {
    logRouteFailure({
      stage: 'config',
      reason: 'missing_key',
      context
    });
    throw buildRouteError('未配置腾讯地图 Key，无法按驾车路线计算配送费', 503);
  }

  const originLng = toFiniteNumber(startLng);
  const originLat = toFiniteNumber(startLat);
  const destLng = toFiniteNumber(endLng);
  const destLat = toFiniteNumber(endLat);
  if (
    originLng === null ||
    originLat === null ||
    destLng === null ||
    destLat === null
  ) {
    logRouteFailure({
      stage: 'validate_coords',
      reason: 'incomplete_coords',
      context,
      originLng,
      originLat,
      destLng,
      destLat
    });
    throw buildRouteError('路线规划坐标不完整', 400);
  }

  const gcjOrigin = normalizeProviderPoint({
    lng: originLng,
    lat: originLat,
    convertToGcj
  });
  const gcjDest = normalizeProviderPoint({
    lng: destLng,
    lat: destLat,
    convertToGcj
  });
  if (
    gcjOrigin.lng === null ||
    gcjOrigin.lat === null ||
    gcjDest.lng === null ||
    gcjDest.lat === null
  ) {
    throw buildRouteError('路线规划坐标转换失败', 400);
  }

  let response;
  try {
    response = await axios.get(resolveRouteUrl(travelMode), {
      params: {
        from: buildCoordText(gcjOrigin.lng, gcjOrigin.lat),
        to: buildCoordText(gcjDest.lng, gcjDest.lat),
        key: TENCENT_MAP_CONFIG.key,
        output: 'json'
      },
      timeout: TENCENT_MAP_CONFIG.timeoutMs
    });
  } catch (error) {
    logRouteFailure({
      stage: 'request',
      reason: 'axios_request_failed',
      context,
      originLng,
      originLat,
      destLng,
      destLat,
      extra: {
        message: error.message,
        code: error.code,
        status: error.response?.status
      },
      raw: error.response?.data
    });
    throw buildRouteError(`腾讯地图${travelMode === 'bicycling' ? '骑行' : '驾车'}路线请求失败：${error.message}`, 502);
  }

  if (Number(response?.data?.status) !== 0) {
    logRouteFailure({
      stage: 'api_status',
      reason: 'provider_error',
      context,
      originLng,
      originLat,
      destLng,
      destLat,
      raw: response?.data,
      extra: {
        provider_status: response?.data?.status,
        provider_message: response?.data?.message
      }
    });
    throw buildRouteError(`腾讯地图${travelMode === 'bicycling' ? '骑行' : '驾车'}路线请求失败：${response?.data?.message || '服务返回异常'}`, 502);
  }

  const distanceKm = pickDistanceKm(response?.data);
  if (requireDistance && distanceKm === null) {
    logRouteFailure({
      stage: 'parse_distance',
      reason: 'distance_not_found',
      context,
      originLng,
      originLat,
      destLng,
      destLat,
      raw: response?.data,
      extra: {
        http_status: response?.status
      }
    });
    throw buildRouteError('腾讯地图未返回可用的驾车路线距离', 502);
  }

  const polylinePoints = pickRoutePolyline(response?.data);
  if (requirePolyline && !polylinePoints.length) {
    logRouteFailure({
      stage: 'parse_polyline',
      reason: 'polyline_not_found',
      context,
      originLng,
      originLat,
      destLng,
      destLat,
      raw: response?.data,
      extra: {
        http_status: response?.status
      }
    });
    throw buildRouteError('腾讯地图未返回可用的真实路线折线', 502);
  }

  return {
    distanceKm,
    polylinePoints,
    raw: response.data
  };
};

// ==================== 对外导出的业务能力 ====================
// 这是原来配送费等业务在用的老能力，保持原返回结构不变，避免影响旧逻辑。
const getDrivingDistanceKm = async ({ startLng, startLat, endLng, endLat, context }) => {
  const routeSummary = await requestRoute({
    startLng,
    startLat,
    endLng,
    endLat,
    context,
    convertToGcj: true,
    requireDistance: true
  });

  return {
    distanceKm: routeSummary.distanceKm,
    raw: routeSummary.raw
  };
};

// 这是给骑手送货总览页用的新能力。
// 它除了给出距离，还会把腾讯真实道路折线解出来，前端直接画就行。
const getDrivingRouteDetail = async ({
  startLng,
  startLat,
  endLng,
  endLat,
  context,
  convertToGcj = true
}) => {
  return requestRoute({
    startLng,
    startLat,
    endLng,
    endLat,
    context,
    convertToGcj,
    requirePolyline: true
  });
};

// 这是给骑手送货总览页用的新能力。
// 原生腾讯导航插件里写死的是“骑行”模式，所以总览页蓝线也必须走骑行，
// 不然地图上看到的路线和真正进导航后的路线一定对不上。
const getRidingRouteDetail = async ({
  startLng,
  startLat,
  endLng,
  endLat,
  context,
  convertToGcj = true
}) => {
  return requestRoute({
    startLng,
    startLat,
    endLng,
    endLat,
    context,
    travelMode: 'bicycling',
    convertToGcj,
    requirePolyline: true
  });
};

module.exports = {
  getDrivingDistanceKm,
  getDrivingRouteDetail,
  getRidingRouteDetail
};
