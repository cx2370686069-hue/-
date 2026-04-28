const { ServiceArea } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');
const { MERCHANT_PRIMARY_CATEGORIES } = require('../config/merchantCategories');

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

exports.getMerchantPrimaryCategories = async (req, res, next) => {
  try {
    res.json(successResponse(MERCHANT_PRIMARY_CATEGORIES));
  } catch (error) {
    next(error);
  }
};
