// 这个文件是“通用查询控制器”。
// 主要提供服务区域、商家主营类目、区域搜索、坐标反查区域这些公共能力。
const { ServiceArea } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');
const { MERCHANT_PRIMARY_CATEGORIES } = require('../config/merchantCategories');
const {
  searchAreas,
  resolveLocationContextByCoordinate
} = require('../services/serviceAreaSearchService');

// enabled 参数在前端可能会传成 true / false / 1 / 0。
// 这里统一收口成真正的布尔值，传错时返回 null 交给外层拦截。
const parseEnabled = (value) => {
  if (value === undefined || value === null || value === '') {
    return true;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1'].includes(normalized)) {
    return true;
  }
  if (['false', '0'].includes(normalized)) {
    return false;
  }

  return null;
};

/**
 * 获取服务区域列表
 * 支持按区域类型、父级编码、启用状态筛选。
 */
exports.getServiceAreas = async (req, res, next) => {
  try {
    const areaType = String(req.query.area_type || '').trim();
    const parentCode = String(req.query.parent_code || '').trim();
    const enabled = parseEnabled(req.query.enabled);

    if (areaType && !['county', 'town'].includes(areaType)) {
      return res.status(400).json(errorResponse('area_type 参数不正确'));
    }

    if (enabled === null) {
      return res.status(400).json(errorResponse('enabled 参数不正确'));
    }

    const where = {};

    if (areaType) {
      where.area_type = areaType;
    }

    if (parentCode) {
      where.parent_code = parentCode;
    }

    where.is_enabled = enabled;

    const areas = await ServiceArea.findAll({
      where,
      attributes: ['area_code', 'area_name', 'area_type', 'parent_code', 'sort_order'],
      order: [
        ['sort_order', 'ASC'],
        ['id', 'ASC']
      ]
    });

    res.json(successResponse(areas));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取商家主营类目
 * 这是一个偏静态的配置查询接口，主要给商家注册和编辑资料页使用。
 */
exports.getMerchantPrimaryCategories = async (req, res, next) => {
  try {
    res.json(successResponse(MERCHANT_PRIMARY_CATEGORIES));
  } catch (error) {
    next(error);
  }
};

/**
 * 搜索服务区域
 * 按关键词搜索县城或乡镇，常用于前端搜索乡镇名、区域名。
 */
exports.searchServiceAreas = async (req, res, next) => {
  try {
    const keyword = String(req.query.keyword || '').trim();
    const areaType = String(req.query.area_type || 'town').trim() || 'town';
    const limit = Number(req.query.limit) || 5;

    if (!keyword) {
      return res.status(400).json(errorResponse('keyword 不能为空'));
    }

    if (!['county', 'town'].includes(areaType)) {
      return res.status(400).json(errorResponse('area_type 参数不正确'));
    }

    const results = await searchAreas({
      keyword,
      areaType,
      limit
    });

    res.json(successResponse(results));
  } catch (error) {
    next(error);
  }
};

/**
 * 根据坐标反查服务区域
 * 前端拿到地图坐标后，如果想自动识别所属县城/乡镇，就会调这个接口。
 */
exports.resolveServiceAreaByLocation = async (req, res, next) => {
  try {
    const lng = Number(req.query.lng ?? req.query.longitude);
    const lat = Number(req.query.lat ?? req.query.latitude);
    const areaType = String(req.query.area_type || 'auto').trim() || 'auto';

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return res.status(400).json(errorResponse('lng/lat 参数不正确'));
    }

    if (!['auto', 'county', 'town'].includes(areaType)) {
      return res.status(400).json(errorResponse('area_type 参数不正确'));
    }

    const resolvedArea = await resolveLocationContextByCoordinate({
      lng,
      lat,
      areaType
    });

    if (!resolvedArea) {
      return res.status(404).json(errorResponse('未识别到当前位置'));
    }

    res.json(successResponse(resolvedArea));
  } catch (error) {
    next(error);
  }
};
