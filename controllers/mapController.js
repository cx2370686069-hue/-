// 这个文件是“地图能力控制器”。
// 主要把逆地理解析、地点联想、地点搜索这些地图能力对前端做一层安全封装。
const { successResponse, errorResponse } = require('../utils/helpers');
const {
  reverseGeocodeByCoordinate,
  suggestLocations,
  searchLocations
} = require('../services/serviceAreaSearchService');

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
