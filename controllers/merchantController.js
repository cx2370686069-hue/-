const { Merchant, Product, ProductCategory, ProductSpec, Order, Review, sequelize } = require('../models');
const { successResponse, errorResponse, calculateDistance } = require('../utils/helpers');
const { Op } = require('sequelize');
const {
  normalizeMerchantCategory,
  isValidMerchantCategory,
  getMerchantCategoryErrorMessage
} = require('../config/merchantCategories');
const {
  SUPERMARKET_DELIVERY_PERMISSIONS,
  normalizeSupermarketDeliveryPermission
} = require('../config/supermarketDelivery');

const SUPERMARKET_CATEGORY = '超市';
const NORMAL_SUPERMARKET_CHANNEL_LABEL = '普通超市';
const COUNTY_FOOD_SCOPE = 'county_food';
const COUNTY_SEARCH_PREVIEW_LIMIT = 4;
const MERCHANT_LIST_PREVIEW_LIMIT = 4;

const findOwnedMerchant = async (userId) => {
  return Merchant.findOne({ where: { user_id: userId } });
};

const FORBIDDEN_MERCHANT_UPDATE_FIELDS = [
  'id',
  'user_id',
  'business_scope',
  'town_code',
  'town_name',
  'audit_status',
  'status',
  'supermarket_delivery_permission',
  'balance',
  'withdrawn_amount',
  'total_income',
  'created_at',
  'updated_at'
];

const getForbiddenMerchantUpdateFields = (payload = {}) => {
  return FORBIDDEN_MERCHANT_UPDATE_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(payload, field));
};

const findOwnedCategory = async (merchantId, categoryId) => {
  if (!categoryId) {
    return null;
  }

  return ProductCategory.findOne({
    where: {
      id: categoryId,
      merchant_id: merchantId
    }
  });
};

const hasOwnField = (payload, field) => Object.prototype.hasOwnProperty.call(payload || {}, field);

const normalizeCoordinate = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const hasValidLocationPair = (latitude, longitude) => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }
  if (Math.abs(latitude) < 0.000001 && Math.abs(longitude) < 0.000001) {
    return false;
  }
  if (latitude < -90 || latitude > 90) {
    return false;
  }
  if (longitude < -180 || longitude > 180) {
    return false;
  }
  return true;
};

const toPositiveNumberOrNull = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

const formatDistanceText = (distanceKm) => {
  if (!Number.isFinite(distanceKm)) {
    return null;
  }
  return `${distanceKm.toFixed(1)}km`;
};

const normalizeSearchKeyword = (value) => String(value || '').trim().slice(0, 50);

const normalizeCategoryName = (value) => String(value || '').trim().slice(0, 50);

const normalizeCategorySort = (value, defaultValue = 0) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const num = Number(value);
  if (!Number.isInteger(num) || num < 0) {
    return null;
  }
  return num;
};

const normalizeProductKeyword = (value) => String(value || '').trim().slice(0, 50);
const normalizeMerchantChannelTags = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const source = Array.isArray(value) ? value.join(',') : String(value);
  const tags = source
    .split(/[,，|]/)
    .map((item) => String(item || '').trim())
    .filter((item) => item && item !== NORMAL_SUPERMARKET_CHANNEL_LABEL);
  if (!tags.length) {
    return null;
  }
  return Array.from(new Set(tags)).join(',').slice(0, 255);
};

const pickFirstDefinedValue = (payload = {}, fields = []) => {
  for (const field of fields) {
    if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
      return payload[field];
    }
  }
  return null;
};

const MERCHANT_CHANNEL_TAG_FIELDS = [
  'channel_tags',
  'channelTags',
  'business_direction',
  'businessDirection',
  'supermarket_sub_channel',
  'supermarketSubChannel',
  'supermarket_subtype',
  'supermarketSubtype',
  'sub_channel',
  'subChannel',
  'store_direction',
  'storeDirection'
];

const resolveMerchantChannelTags = (payload = {}) => {
  return normalizeMerchantChannelTags(pickFirstDefinedValue(payload, MERCHANT_CHANNEL_TAG_FIELDS));
};

const buildBlankChannelTagsCondition = () => ({
  [Op.or]: [
    { [Op.is]: null },
    { [Op.eq]: '' }
  ]
});

const normalizePositiveInteger = (value, { min = 1, max = 100, defaultValue = null } = {}) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const num = Number(value);
  if (!Number.isInteger(num)) {
    return null;
  }
  if (num < min || num > max) {
    return null;
  }
  return num;
};

const parseBooleanQuery = (value) => {
  if (value === undefined || value === null || value === '') {
    return false;
  }
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y'].includes(normalized);
};

const PRODUCT_SORT_ORDERS = {
  sort_desc: [['sort', 'DESC'], ['id', 'DESC']],
  sort_asc: [['sort', 'ASC'], ['id', 'ASC']],
  sales_desc: [['sales', 'DESC'], ['id', 'DESC']],
  price_asc: [['price', 'ASC'], ['id', 'ASC']],
  price_desc: [['price', 'DESC'], ['id', 'DESC']],
  newest: [['id', 'DESC']]
};

const buildPublicProductListItem = (product) => {
  const productJson = typeof product?.toJSON === 'function' ? product.toJSON() : { ...product };
  return {
    id: Number(productJson.id),
    merchant_id: Number(productJson.merchant_id),
    category_id: productJson.category_id ? Number(productJson.category_id) : null,
    name: productJson.name || '',
    images: productJson.images || '',
    price: Number(productJson.price || 0),
    original_price: productJson.original_price === null || productJson.original_price === undefined
      ? null
      : Number(productJson.original_price),
    sales: Number(productJson.sales || 0),
    status: Number(productJson.status || 0),
    sort: Number(productJson.sort || 0),
    spec_group_name: productJson.spec_group_name || '',
    spec_options: Array.isArray(productJson.spec_options) ? productJson.spec_options : []
  };
};

const pickProductPreviewImage = (value) => {
  if (!value) {
    return '';
  }

  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }

  const text = String(value).trim();
  if (!text) {
    return '';
  }

  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return String(parsed[0] || '').trim();
      }
    } catch (error) {
      // Ignore parse failure and fall back to raw text.
    }
  }

  if (text.includes(',')) {
    return String(text.split(',')[0] || '').trim();
  }

  return text;
};

const decorateMerchantWithDistance = (merchant, userLat, userLng) => {
  if (userLat === null || userLng === null) {
    return merchant;
  }

  const merchantLat = normalizeCoordinate(merchant.latitude);
  const merchantLng = normalizeCoordinate(merchant.longitude);
  const distanceKm =
    merchantLat === null || merchantLng === null
      ? null
      : calculateDistance(userLat, userLng, merchantLat, merchantLng);

  return {
    ...merchant,
    distance_km: distanceKm,
    distance_text: formatDistanceText(distanceKm)
  };
};

const buildCountySearchMerchantEntry = (merchant, userLat, userLng) => {
  const merchantJson = typeof merchant.toJSON === 'function' ? merchant.toJSON() : { ...merchant };
  return decorateMerchantWithDistance({
    merchant_id: Number(merchantJson.id),
    merchant_name: merchantJson.name || '',
    logo: merchantJson.logo || '',
    cover: merchantJson.cover || '',
    address: merchantJson.address || '',
    phone: merchantJson.phone || '',
    category: merchantJson.category || '',
    business_scope: merchantJson.business_scope || '',
    min_price: Number(merchantJson.min_price || 0),
    delivery_fee: Number(merchantJson.delivery_fee || 0),
    status: Number(merchantJson.status || 0),
    audit_status: Number(merchantJson.audit_status || 0),
    matched_by: 'merchant',
    matched_products: []
  }, userLat, userLng);
};

const pushMatchedProductPreview = (entry, product) => {
  if (!entry || !product) {
    return;
  }

  const productId = Number(product.id);
  if (!productId) {
    return;
  }

  const exists = (entry.matched_products || []).some((item) => Number(item.product_id) === productId);
  if (exists || entry.matched_products.length >= COUNTY_SEARCH_PREVIEW_LIMIT) {
    return;
  }

  entry.matched_products.push({
    product_id: productId,
    name: product.name || '',
    price: Number(product.price || 0),
    image: pickProductPreviewImage(product.images),
    sales: Number(product.sales || 0)
  });
};

const attachMerchantPreviewProducts = async (merchantList = []) => {
  if (!Array.isArray(merchantList) || merchantList.length === 0) {
    return merchantList;
  }

  const merchantIds = merchantList
    .map((merchant) => Number(merchant?.id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (merchantIds.length === 0) {
    return merchantList.map((merchant) => ({
      ...(typeof merchant?.toJSON === 'function' ? merchant.toJSON() : merchant),
      preview_products: []
    }));
  }

  const previewProducts = await Product.findAll({
    where: {
      merchant_id: { [Op.in]: merchantIds },
      status: 1
    },
    attributes: ['id', 'merchant_id', 'name', 'price', 'images', 'sort'],
    order: [['sort', 'DESC'], ['id', 'DESC']]
  });

  const previewMap = new Map();
  previewProducts.forEach((product) => {
    const merchantId = Number(product.merchant_id);
    if (!merchantId) {
      return;
    }

    const image = pickProductPreviewImage(product.images);
    if (!image) {
      return;
    }

    const bucket = previewMap.get(merchantId) || [];
    if (bucket.length >= MERCHANT_LIST_PREVIEW_LIMIT) {
      return;
    }

    bucket.push({
      product_id: Number(product.id),
      name: product.name || '',
      price: Number(product.price || 0),
      image
    });
    previewMap.set(merchantId, bucket);
  });

  return merchantList.map((merchant) => {
    const merchantJson = typeof merchant?.toJSON === 'function' ? merchant.toJSON() : { ...merchant };
    const merchantId = Number(merchantJson.id);
    return {
      ...merchantJson,
      preview_products: previewMap.get(merchantId) || []
    };
  });
};

const formatMerchantRating = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  return Number(num.toFixed(1));
};

const isReviewTableMissingError = (error) => {
  if (!error) {
    return false;
  }

  const code = error.original?.code || error.parent?.code || error.code || '';
  const message = String(error.original?.sqlMessage || error.parent?.sqlMessage || error.message || '');

  return code === 'ER_NO_SUCH_TABLE' || /Table '.+\.reviews' doesn't exist/i.test(message);
};

const attachMerchantRatingSummaries = async (merchantList = []) => {
  if (!Array.isArray(merchantList) || merchantList.length === 0) {
    return merchantList;
  }

  const merchantIds = merchantList
    .map((merchant) => Number(merchant?.id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (merchantIds.length === 0) {
    return merchantList.map((merchant) => ({
      ...(typeof merchant?.toJSON === 'function' ? merchant.toJSON() : merchant),
      rating: null,
      rating_count: 0
    }));
  }

  let ratingRows = [];
  try {
    ratingRows = await Review.findAll({
      where: {
        merchant_id: { [Op.in]: merchantIds },
        status: 1
      },
      attributes: [
        'merchant_id',
        [sequelize.fn('AVG', sequelize.col('merchant_score')), 'rating'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'rating_count']
      ],
      group: ['merchant_id'],
      raw: true
    });
  } catch (error) {
    if (isReviewTableMissingError(error)) {
      console.warn('[merchantController] reviews 表不存在，跳过评分聚合');
      return merchantList.map((merchant) => ({
        ...(typeof merchant?.toJSON === 'function' ? merchant.toJSON() : merchant),
        rating: null,
        rating_count: 0
      }));
    }
    throw error;
  }

  const ratingMap = new Map();
  ratingRows.forEach((row) => {
    const merchantId = Number(row.merchant_id);
    if (!merchantId) {
      return;
    }
    ratingMap.set(merchantId, {
      rating: formatMerchantRating(row.rating),
      rating_count: Number(row.rating_count || 0)
    });
  });

  return merchantList.map((merchant) => {
    const merchantJson = typeof merchant?.toJSON === 'function' ? merchant.toJSON() : { ...merchant };
    const merchantId = Number(merchantJson.id);
    const ratingSummary = ratingMap.get(merchantId) || { rating: null, rating_count: 0 };
    return {
      ...merchantJson,
      rating: ratingSummary.rating,
      rating_count: ratingSummary.rating_count
    };
  });
};

const attachMerchantMonthSales = async (merchantList = []) => {
  if (!Array.isArray(merchantList) || merchantList.length === 0) {
    return merchantList;
  }

  const merchantIds = merchantList
    .map((merchant) => Number(merchant?.id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (merchantIds.length === 0) {
    return merchantList.map((merchant) => ({
      ...(typeof merchant?.toJSON === 'function' ? merchant.toJSON() : merchant),
      month_sale: 0
    }));
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const salesMap = new Map();
  const salesRows = await Order.findAll({
    where: {
      merchant_id: { [Op.in]: merchantIds },
      type: 'takeout',
      status: 6,
      created_at: { [Op.gte]: thirtyDaysAgo }
    },
    attributes: [
      'merchant_id',
      [sequelize.fn('COUNT', sequelize.col('id')), 'month_sale']
    ],
    group: ['merchant_id'],
    raw: true
  });

  salesRows.forEach((row) => {
    const merchantId = Number(row.merchant_id);
    if (!merchantId) {
      return;
    }
    salesMap.set(merchantId, Number(row.month_sale || 0));
  });

  return merchantList.map((merchant) => {
    const merchantJson = typeof merchant?.toJSON === 'function' ? merchant.toJSON() : { ...merchant };
    const merchantId = Number(merchantJson.id);
    return {
      ...merchantJson,
      month_sale: salesMap.get(merchantId) || 0
    };
  });
};

const isSupermarketMerchant = (merchant) =>
  normalizeMerchantCategory(merchant?.category) === SUPERMARKET_CATEGORY;

const validateSupermarketDeliveryPermission = (merchantCategory, rawPermission) => {
  if (merchantCategory !== SUPERMARKET_CATEGORY) {
    return { value: null };
  }

  const normalized = normalizeSupermarketDeliveryPermission(rawPermission);
  if (!normalized) {
    return { error: '超市商家必须选择配送方式：自己配送、骑手配送或两个都支持' };
  }

  if (!Object.values(SUPERMARKET_DELIVERY_PERMISSIONS).includes(normalized)) {
    return { error: '超市配送方式参数不正确' };
  }

  return { value: normalized };
};

const hasLightSpecField = (payload = {}) =>
  hasOwnField(payload, 'spec_group_name') || hasOwnField(payload, 'spec_options');

const normalizeSpecGroupName = (value) => {
  const text = String(value || '').trim();
  return text ? text.slice(0, 50) : '';
};

const normalizeSpecOptions = (value) => {
  let rawValues = [];

  if (Array.isArray(value)) {
    rawValues = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      rawValues = [];
    } else if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        rawValues = Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        rawValues = trimmed.split(/[\n,，]/);
      }
    } else {
      rawValues = trimmed.split(/[\n,，]/);
    }
  }

  const options = [];
  const seen = new Set();
  rawValues.forEach((item) => {
    const text = String(item || '').trim();
    if (!text || seen.has(text)) {
      return;
    }
    seen.add(text);
    options.push(text.slice(0, 50));
  });

  return options;
};

const normalizeLightSpecInput = (payload = {}) => {
  if (!hasLightSpecField(payload)) {
    return { touched: false, specGroupName: '', specOptions: [] };
  }

  const specGroupName = normalizeSpecGroupName(payload.spec_group_name);
  const specOptions = normalizeSpecOptions(payload.spec_options);

  if (specOptions.length > 0 && !specGroupName) {
    return { touched: true, error: '已配置规格项时，必须填写规格组名' };
  }

  if (specGroupName && specOptions.length === 0) {
    return { touched: true, error: '已填写规格组名时，至少保留一个规格项' };
  }

  return { touched: true, specGroupName, specOptions };
};

const hasActualLightSpecConfig = (lightSpecInput = {}) =>
  Boolean(lightSpecInput.specGroupName || (lightSpecInput.specOptions || []).length > 0);

const buildProductPayloadWithoutSpecs = (payload = {}) => {
  const sanitizedPayload = { ...payload };
  delete sanitizedPayload.spec_group_name;
  delete sanitizedPayload.spec_options;
  return sanitizedPayload;
};

const syncProductLightSpecs = async ({ productId, specGroupName, specOptions }) => {
  await ProductSpec.destroy({ where: { product_id: productId } });

  if (!specGroupName || specOptions.length === 0) {
    return;
  }

  await ProductSpec.bulkCreate(
    specOptions.map((name, index) => ({
      product_id: productId,
      group_name: specGroupName,
      name,
      price_extra: 0,
      is_required: true,
      is_multiple: false,
      status: 1,
      sort: index
    }))
  );
};

const decorateProductsWithLightSpecs = async (products) => {
  const productList = Array.isArray(products) ? products : [products].filter(Boolean);
  if (productList.length === 0) {
    return Array.isArray(products) ? [] : null;
  }

  const productIds = productList.map((product) => product.id);
  const specs = await ProductSpec.findAll({
    where: {
      product_id: { [Op.in]: productIds },
      status: 1
    },
    order: [['sort', 'ASC'], ['id', 'ASC']]
  });

  const specMap = new Map();
  specs.forEach((spec) => {
    const bucket = specMap.get(spec.product_id) || {
      spec_group_name: '',
      spec_options: []
    };
    if (!bucket.spec_group_name) {
      bucket.spec_group_name = spec.group_name || '';
    }
    bucket.spec_options.push(spec.name);
    specMap.set(spec.product_id, bucket);
  });

  const decorated = productList.map((product) => {
    const productJson = typeof product.toJSON === 'function' ? product.toJSON() : { ...product };
    const lightSpec = specMap.get(productJson.id) || {
      spec_group_name: '',
      spec_options: []
    };

    return {
      ...productJson,
      spec_group_name: lightSpec.spec_group_name,
      spec_options: lightSpec.spec_options
    };
  });

  return Array.isArray(products) ? decorated : decorated[0];
};

const buildMerchantOrderScopeWhere = (merchant) => {
  const where = { merchant_id: merchant.id };

  if (merchant.business_scope === 'county_food') {
    where.order_type = 'county';
    return where;
  }

  if (merchant.business_scope === 'town_food') {
    where.order_type = 'town';
    if (merchant.town_name) {
      where.customer_town = merchant.town_name;
    }
  }

  return where;
};

/**
 * 获取商家列表
 */
exports.getMerchantList = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = 1,
      category,
      business_scope,
      town_code,
      town_name,
      user_lat,
      user_lng,
      merchant_category_keyword,
      radius_km,
      sort
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, parseInt(limit, 10) || 10);
    const normalizedCategory = normalizeMerchantCategory(category);
    const normalizedMerchantCategoryKeyword = normalizeSearchKeyword(merchant_category_keyword);
    const userLat = normalizeCoordinate(user_lat);
    const userLng = normalizeCoordinate(user_lng);
    const radiusKm = toPositiveNumberOrNull(radius_km);
    const sortMode = String(sort || '').trim();

    if ((user_lat !== undefined && userLat === null) || (user_lng !== undefined && userLng === null)) {
      return res.status(400).json(errorResponse('用户坐标参数不正确'));
    }

    if ((userLat === null) !== (userLng === null)) {
      return res.status(400).json(errorResponse('请同时传入 user_lat 和 user_lng'));
    }

    if (radius_km !== undefined && radiusKm === null) {
      return res.status(400).json(errorResponse('radius_km 参数不正确'));
    }

    if (sortMode && !['distance_asc'].includes(sortMode)) {
      return res.status(400).json(errorResponse('sort 参数不正确'));
    }

    if (sortMode === 'distance_asc' && (userLat === null || userLng === null)) {
      return res.status(400).json(errorResponse('按距离排序时必须传入用户坐标'));
    }

    const shouldFilterByDistance = userLat !== null && userLng !== null && radiusKm !== null;
    const shouldSortByDistance = sortMode === 'distance_asc';
    const shouldDecorateDistance = userLat !== null && userLng !== null;

    const whereClause = {
      status: Number(status),
      audit_status: 1
    };
    if (normalizedCategory) {
      whereClause.category = normalizedCategory;
    }
    if (normalizedMerchantCategoryKeyword) {
      whereClause.channel_tags = {
        [Op.like]: `%${normalizedMerchantCategoryKeyword}%`
      };
    } else if (normalizedCategory === SUPERMARKET_CATEGORY) {
      // 普通超市频道默认只显示未打子频道标签的超市，避免混入冷饮雪糕批发等子频道商家。
      whereClause.channel_tags = buildBlankChannelTagsCondition();
    }
    if (business_scope === 'county_food' || business_scope === 'town_food') {
      whereClause.business_scope = business_scope;
    } else if (town_code || town_name) {
      whereClause.business_scope = 'town_food';
    }
    if (town_code) {
      whereClause.town_code = String(town_code).trim();
    }
    if (town_name) {
      whereClause.town_name = String(town_name).trim();
    }

    const merchantQuery = {
      where: whereClause,
      include: [{
        model: require('../models').User,
        as: 'user',
        attributes: ['nickname', 'phone', 'avatar']
      }],
      order: shouldSortByDistance ? [['id', 'DESC']] : [['id', 'DESC']]
    };

    if (!shouldFilterByDistance && !shouldSortByDistance) {
      merchantQuery.limit = parsedLimit;
      merchantQuery.offset = (parsedPage - 1) * parsedLimit;
    }

    const merchants = await Merchant.findAll(merchantQuery);
    let list = merchants;
    let total = await Merchant.count({ where: whereClause });

    if (shouldFilterByDistance || shouldSortByDistance) {
      const decoratedMerchants = merchants
        .map((merchant) => {
          const merchantJson = merchant.toJSON();
          const merchantLat = normalizeCoordinate(merchantJson.latitude);
          const merchantLng = normalizeCoordinate(merchantJson.longitude);
          const distanceKm =
            merchantLat === null || merchantLng === null
              ? null
              : calculateDistance(userLat, userLng, merchantLat, merchantLng);

          return {
            ...merchantJson,
            distance_km: distanceKm,
            distance_text: formatDistanceText(distanceKm)
          };
        })
        .filter((merchant) => {
          if (!shouldFilterByDistance) {
            return true;
          }
          return merchant.distance_km !== null && merchant.distance_km <= radiusKm;
        });

      if (shouldSortByDistance) {
        decoratedMerchants.sort((a, b) => {
          if (a.distance_km === null && b.distance_km === null) {
            return Number(b.id) - Number(a.id);
          }
          if (a.distance_km === null) {
            return 1;
          }
          if (b.distance_km === null) {
            return -1;
          }
          if (a.distance_km === b.distance_km) {
            return Number(b.id) - Number(a.id);
          }
          return a.distance_km - b.distance_km;
        });
      }

      total = decoratedMerchants.length;
      const offset = (parsedPage - 1) * parsedLimit;
      list = decoratedMerchants.slice(offset, offset + parsedLimit);
    } else if (shouldDecorateDistance) {
      list = merchants.map((merchant) => {
        const merchantJson = merchant.toJSON();
        const merchantLat = normalizeCoordinate(merchantJson.latitude);
        const merchantLng = normalizeCoordinate(merchantJson.longitude);
        const distanceKm =
          merchantLat === null || merchantLng === null
            ? null
            : calculateDistance(userLat, userLng, merchantLat, merchantLng);

        return {
          ...merchantJson,
          distance_km: distanceKm,
          distance_text: formatDistanceText(distanceKm)
        };
      });
    }

    list = await attachMerchantPreviewProducts(list);
    list = await attachMerchantRatingSummaries(list);
    list = await attachMerchantMonthSales(list);

    res.json(successResponse({
      list,
      total,
      page: parsedPage,
      limit: parsedLimit
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取商家详情
 */
exports.getMerchantDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const merchant = await Merchant.findOne({
      where: { id },
      include: [{
        model: require('../models').User,
        as: 'user',
        attributes: ['nickname', 'phone', 'avatar']
      }]
    });

    if (!merchant) {
      return res.status(404).json(errorResponse('商家不存在'));
    }

    const [merchantWithRating] = await attachMerchantRatingSummaries([merchant]);
    const [merchantWithSales] = await attachMerchantMonthSales([merchantWithRating]);

    res.json(successResponse(merchantWithSales));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取我的商品分类（商家端）
 */
exports.getMyCategories = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await Merchant.findOne({ where: { user_id: user.id } });

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const categories = await ProductCategory.findAll({
      where: { merchant_id: merchant.id },
      order: [['sort', 'ASC'], ['id', 'DESC']]
    });

    res.json(successResponse(categories));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取商家商品分类（公开）
 */
exports.getCategories = async (req, res, next) => {
  try {
    const { merchant_id } = req.query;
    
    if (!merchant_id) {
      return res.status(400).json(errorResponse('缺少商家ID参数'));
    }

    const categories = await ProductCategory.findAll({
      where: { merchant_id },
      order: [['sort', 'ASC'], ['id', 'DESC']]
    });

    res.json(successResponse(categories));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取商家商品列表
 */
exports.getProducts = async (req, res, next) => {
  try {
    const {
      merchant_id,
      category_id,
      status = 1,
      page,
      limit,
      keyword,
      sort,
      lite
    } = req.query;
    
    // 修复：如果前端没有传 merchant_id，且当前是商家登录，则默认使用当前商家的 id
    let targetMerchantId = merchant_id;
    if (!targetMerchantId && req.user) {
      const merchant = await Merchant.findOne({ where: { user_id: req.user.id } });
      if (merchant) {
        targetMerchantId = merchant.id;
      }
    }

    const parsedPage = normalizePositiveInteger(page, { min: 1, max: 100000, defaultValue: null });
    const parsedLimit = normalizePositiveInteger(limit, { min: 1, max: 100, defaultValue: null });
    if ((page !== undefined && parsedPage === null) || (limit !== undefined && parsedLimit === null)) {
      return res.status(400).json(errorResponse('分页参数不正确'));
    }

    const normalizedKeyword = normalizeProductKeyword(keyword);
    const sortMode = String(sort || '').trim();
    if (sortMode && !PRODUCT_SORT_ORDERS[sortMode]) {
      return res.status(400).json(errorResponse('商品排序参数不正确'));
    }

    const useLitePayload = parseBooleanQuery(lite);
    const shouldPaginate = parsedPage !== null || parsedLimit !== null;
    const finalPage = parsedPage || 1;
    const finalLimit = parsedLimit || 20;

    const where = { status };
    if (targetMerchantId) where.merchant_id = targetMerchantId;
    if (category_id) where.category_id = category_id;
    if (normalizedKeyword) {
      where.name = { [Op.like]: `%${normalizedKeyword}%` };
    }

    const queryOptions = {
      where,
      order: PRODUCT_SORT_ORDERS[sortMode] || PRODUCT_SORT_ORDERS.sort_desc
    };
    if (useLitePayload) {
      queryOptions.attributes = [
        'id',
        'merchant_id',
        'category_id',
        'name',
        'images',
        'price',
        'original_price',
        'sales',
        'status',
        'sort'
      ];
    }

    let rawProducts = [];
    let total = 0;
    if (shouldPaginate) {
      const result = await Product.findAndCountAll({
        ...queryOptions,
        limit: finalLimit,
        offset: (finalPage - 1) * finalLimit
      });
      rawProducts = result.rows;
      total = result.count;
    } else {
      rawProducts = await Product.findAll(queryOptions);
      total = rawProducts.length;
    }

    const decoratedProducts = await decorateProductsWithLightSpecs(rawProducts);

    if (shouldPaginate) {
      const list = useLitePayload
        ? decoratedProducts.map(buildPublicProductListItem)
        : decoratedProducts;
      return res.json(successResponse({
        list,
        total,
        page: finalPage,
        limit: finalLimit,
        has_more: finalPage * finalLimit < total
      }));
    }

    if (useLitePayload) {
      return res.json(successResponse(decoratedProducts.map(buildPublicProductListItem)));
    }

    res.json(successResponse(decoratedProducts));
  } catch (error) {
    next(error);
  }
};

/**
 * 县城外卖聚合搜索：按店名或商品名反查商家
 */
exports.searchCountyMerchants = async (req, res, next) => {
  try {
    const { keyword, page = 1, limit = 10, user_lat, user_lng } = req.query;
    const normalizedKeyword = normalizeSearchKeyword(keyword);
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, Math.min(50, parseInt(limit, 10) || 10));
    const userLat = normalizeCoordinate(user_lat);
    const userLng = normalizeCoordinate(user_lng);

    if (!normalizedKeyword) {
      return res.status(400).json(errorResponse('keyword 不能为空'));
    }

    if ((user_lat !== undefined && userLat === null) || (user_lng !== undefined && userLng === null)) {
      return res.status(400).json(errorResponse('用户坐标参数不正确'));
    }

    if ((userLat === null) !== (userLng === null)) {
      return res.status(400).json(errorResponse('请同时传入 user_lat 和 user_lng'));
    }

    const merchantWhere = {
      status: 1,
      audit_status: 1,
      business_scope: COUNTY_FOOD_SCOPE
    };
    const keywordLike = `%${normalizedKeyword}%`;

    const [merchantNameMatches, productNameMatches] = await Promise.all([
      Merchant.findAll({
        where: {
          ...merchantWhere,
          name: { [Op.like]: keywordLike }
        },
        order: [['id', 'DESC']]
      }),
      Product.findAll({
        where: {
          status: 1,
          name: { [Op.like]: keywordLike }
        },
        include: [{
          model: Merchant,
          as: 'merchant',
          required: true,
          where: merchantWhere
        }],
        order: [['sales', 'DESC'], ['id', 'DESC']]
      })
    ]);

    const merchantMap = new Map();

    merchantNameMatches.forEach((merchant) => {
      const entry = buildCountySearchMerchantEntry(merchant, userLat, userLng);
      merchantMap.set(entry.merchant_id, {
        ...entry,
        _score: 2
      });
    });

    productNameMatches.forEach((product) => {
      const merchant = product.merchant;
      if (!merchant) {
        return;
      }

      const merchantId = Number(merchant.id);
      const existing = merchantMap.get(merchantId);
      if (!existing) {
        const entry = buildCountySearchMerchantEntry(merchant, userLat, userLng);
        entry.matched_by = 'product';
        entry._score = 1;
        pushMatchedProductPreview(entry, product);
        merchantMap.set(merchantId, entry);
        return;
      }

      if (existing.matched_by === 'merchant') {
        existing.matched_by = 'merchant_and_product';
      }
      existing._score += 1;
      pushMatchedProductPreview(existing, product);
    });

    const mergedList = Array.from(merchantMap.values())
      .sort((a, b) => {
        if (b._score !== a._score) {
          return b._score - a._score;
        }
        if (Number.isFinite(a.distance_km) && Number.isFinite(b.distance_km) && a.distance_km !== b.distance_km) {
          return a.distance_km - b.distance_km;
        }
        if (a.distance_km === null && b.distance_km !== null) {
          return 1;
        }
        if (a.distance_km !== null && b.distance_km === null) {
          return -1;
        }
        return Number(b.merchant_id) - Number(a.merchant_id);
      })
      .map(({ _score, ...item }) => item);

    const total = mergedList.length;
    const offset = (parsedPage - 1) * parsedLimit;
    const list = mergedList.slice(offset, offset + parsedLimit);

    res.json(successResponse({
      keyword: normalizedKeyword,
      list,
      total,
      page: parsedPage,
      limit: parsedLimit
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * 创建商家（商家端）
 */
exports.createMerchant = async (req, res, next) => {
  try {
    const user = req.user;
    const merchantCategory = normalizeMerchantCategory(req.body.category);
    const supermarketDeliveryPermissionCheck = validateSupermarketDeliveryPermission(
      merchantCategory,
      req.body.supermarket_delivery_permission ?? req.body.delivery_permission
    );
    const latitude = normalizeCoordinate(req.body.latitude ?? req.body.lat);
    const longitude = normalizeCoordinate(req.body.longitude ?? req.body.lng);
    
    // 检查是否已经是商家
    const existingMerchant = await Merchant.findOne({ where: { user_id: user.id } });
    if (existingMerchant) {
      return res.status(400).json(errorResponse('您已经拥有店铺'));
    }

    if (!merchantCategory) {
      return res.status(400).json(errorResponse('主营类目不能为空'));
    }

    if (!isValidMerchantCategory(merchantCategory)) {
      return res.status(400).json(errorResponse(getMerchantCategoryErrorMessage()));
    }

    if (supermarketDeliveryPermissionCheck.error) {
      return res.status(400).json(errorResponse(supermarketDeliveryPermissionCheck.error));
    }

    if (latitude === null || longitude === null) {
      return res.status(400).json(errorResponse('店铺位置不能为空，请先完成地图选点'));
    }

    if (!hasValidLocationPair(latitude, longitude)) {
      return res.status(400).json(errorResponse('店铺地图坐标无效，请重新地图选点后再提交'));
    }

    const merchant = await Merchant.create({
      user_id: user.id,
      ...req.body,
      latitude,
      longitude,
      category: merchantCategory,
      channel_tags: resolveMerchantChannelTags(req.body),
      supermarket_delivery_permission: supermarketDeliveryPermissionCheck.value,
      audit_status: 0
    });

    res.status(201).json(successResponse(merchant, '店铺创建成功，请等待审核'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取我的店铺（商家端）
 */
exports.getMyMerchant = async (req, res, next) => {
  try {
    const user = req.user;
    
    const merchant = await findOwnedMerchant(user.id);

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    res.json(successResponse(merchant));
  } catch (error) {
    next(error);
  }
};

/**
 * 更新店铺信息（商家端）
 */
exports.updateMerchant = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await findOwnedMerchant(user.id);

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const forbiddenFields = getForbiddenMerchantUpdateFields(req.body);
    if (forbiddenFields.length > 0) {
      return res.status(400).json(errorResponse(`以下字段不允许通过店铺资料接口修改：${forbiddenFields.join('、')}`));
    }

    const updatePayload = { ...req.body };

    const hasLatitudeField = hasOwnField(updatePayload, 'latitude') || hasOwnField(updatePayload, 'lat');
    const hasLongitudeField = hasOwnField(updatePayload, 'longitude') || hasOwnField(updatePayload, 'lng');
    if (hasLatitudeField || hasLongitudeField) {
      const latitude = normalizeCoordinate(updatePayload.latitude ?? updatePayload.lat);
      const longitude = normalizeCoordinate(updatePayload.longitude ?? updatePayload.lng);

      if (latitude === null || longitude === null) {
        return res.status(400).json(errorResponse('店铺坐标格式不正确，请重新地图选点'));
      }

      if (!hasValidLocationPair(latitude, longitude)) {
        return res.status(400).json(errorResponse('店铺地图坐标无效，请重新地图选点后再保存'));
      }

      updatePayload.latitude = latitude;
      updatePayload.longitude = longitude;
      delete updatePayload.lat;
      delete updatePayload.lng;
    }

    if (hasOwnField(updatePayload, 'category')) {
      const merchantCategory = normalizeMerchantCategory(updatePayload.category);
      if (!merchantCategory) {
        return res.status(400).json(errorResponse('主营类目不能为空'));
      }
      if (!isValidMerchantCategory(merchantCategory)) {
        return res.status(400).json(errorResponse(getMerchantCategoryErrorMessage()));
      }
      if (
        merchantCategory === SUPERMARKET_CATEGORY &&
        !merchant.supermarket_delivery_permission
      ) {
        return res.status(400).json(errorResponse('当前店铺未配置超市配送权限，请联系平台处理'));
      }
      updatePayload.category = merchantCategory;
    }

    if (hasOwnField(updatePayload, 'channel_tags') || hasOwnField(updatePayload, 'channelTags')) {
      updatePayload.channel_tags = resolveMerchantChannelTags(updatePayload);
    } else if (MERCHANT_CHANNEL_TAG_FIELDS.some((field) => hasOwnField(updatePayload, field))) {
      updatePayload.channel_tags = resolveMerchantChannelTags(updatePayload);
    }

    MERCHANT_CHANNEL_TAG_FIELDS
      .filter((field) => field !== 'channel_tags')
      .forEach((field) => delete updatePayload[field]);

    await merchant.update(updatePayload);

    res.json(successResponse(merchant, '更新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 创建商品分类（商家端）
 */
exports.createCategory = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await findOwnedMerchant(user.id);

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    if (hasOwnField(req.body, 'merchant_id')) {
      return res.status(400).json(errorResponse('merchant_id 不允许由前端指定'));
    }

    const categoryName = normalizeCategoryName(req.body.name);
    const categorySort = normalizeCategorySort(req.body.sort, 0);
    if (!categoryName) {
      return res.status(400).json(errorResponse('分类名称不能为空'));
    }
    if (categorySort === null) {
      return res.status(400).json(errorResponse('分类排序不正确'));
    }

    const category = await ProductCategory.create({
      merchant_id: merchant.id,
      ...req.body,
      name: categoryName,
      sort: categorySort
    });

    res.status(201).json(successResponse(category, '分类创建成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 更新商品分类（商家端）
 */
exports.updateCategory = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await findOwnedMerchant(user.id);

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const category = await findOwnedCategory(merchant.id, req.params.id);
    if (!category) {
      return res.status(404).json(errorResponse('分类不存在'));
    }

    if (hasOwnField(req.body, 'merchant_id')) {
      return res.status(400).json(errorResponse('merchant_id 不允许由前端指定'));
    }

    const updatePayload = {};
    if (hasOwnField(req.body, 'name')) {
      const categoryName = normalizeCategoryName(req.body.name);
      if (!categoryName) {
        return res.status(400).json(errorResponse('分类名称不能为空'));
      }
      updatePayload.name = categoryName;
    }

    if (hasOwnField(req.body, 'sort')) {
      const categorySort = normalizeCategorySort(req.body.sort);
      if (categorySort === null) {
        return res.status(400).json(errorResponse('分类排序不正确'));
      }
      updatePayload.sort = categorySort;
    }

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json(errorResponse('缺少可更新字段'));
    }

    await category.update(updatePayload);
    res.json(successResponse(category, '分类更新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 删除商品分类（商家端）
 */
exports.deleteCategory = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await findOwnedMerchant(user.id);

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const category = await findOwnedCategory(merchant.id, req.params.id);
    if (!category) {
      return res.status(404).json(errorResponse('分类不存在'));
    }

    const relatedProductCount = await Product.count({
      where: {
        merchant_id: merchant.id,
        category_id: category.id
      }
    });
    if (relatedProductCount > 0) {
      return res.status(400).json(errorResponse('该分类下还有商品，无法删除'));
    }

    await category.destroy();
    res.json(successResponse(null, '分类已删除'));
  } catch (error) {
    next(error);
  }
};

/**
 * 创建商品（商家端）
 */
exports.createProduct = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await findOwnedMerchant(user.id);

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    if (hasOwnField(req.body, 'merchant_id')) {
      return res.status(400).json(errorResponse('merchant_id 不允许由前端指定'));
    }

    if (req.body.category_id) {
      const category = await findOwnedCategory(merchant.id, req.body.category_id);
      if (!category) {
        return res.status(400).json(errorResponse('所选分类不属于当前店铺'));
      }
    }

    const lightSpecInput = normalizeLightSpecInput(req.body);
    if (lightSpecInput.error) {
      return res.status(400).json(errorResponse(lightSpecInput.error));
    }

    if (hasActualLightSpecConfig(lightSpecInput) && !isSupermarketMerchant(merchant)) {
      return res.status(400).json(errorResponse('只有超市商家才能配置商品规格'));
    }

    const productPayload = buildProductPayloadWithoutSpecs(req.body);

    const product = await Product.create({
      merchant_id: merchant.id,
      ...productPayload
    });

    if (lightSpecInput.touched && isSupermarketMerchant(merchant)) {
      await syncProductLightSpecs({
        productId: product.id,
        specGroupName: lightSpecInput.specGroupName,
        specOptions: lightSpecInput.specOptions
      });
    }

    const decoratedProduct = await decorateProductsWithLightSpecs(product);

    res.status(201).json(successResponse(decoratedProduct, '商品创建成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 更新商品（商家端）
 */
exports.updateProduct = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await findOwnedMerchant(user.id);

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    if (hasOwnField(req.body, 'merchant_id')) {
      return res.status(400).json(errorResponse('merchant_id 不允许通过商品接口修改'));
    }

    if (hasOwnField(req.body, 'category_id') && req.body.category_id) {
      const category = await findOwnedCategory(merchant.id, req.body.category_id);
      if (!category) {
        return res.status(400).json(errorResponse('所选分类不属于当前店铺'));
      }
    }

    const product = await Product.findOne({
      where: { id: req.params.id, merchant_id: merchant.id }
    });

    if (!product) {
      return res.status(404).json(errorResponse('商品不存在'));
    }

    const lightSpecInput = normalizeLightSpecInput(req.body);
    if (lightSpecInput.error) {
      return res.status(400).json(errorResponse(lightSpecInput.error));
    }

    if (hasActualLightSpecConfig(lightSpecInput) && !isSupermarketMerchant(merchant)) {
      return res.status(400).json(errorResponse('只有超市商家才能配置商品规格'));
    }

    const updatePayload = buildProductPayloadWithoutSpecs(req.body);

    await product.update(updatePayload);

    if (lightSpecInput.touched && isSupermarketMerchant(merchant)) {
      await syncProductLightSpecs({
        productId: product.id,
        specGroupName: lightSpecInput.specGroupName,
        specOptions: lightSpecInput.specOptions
      });
    }

    const decoratedProduct = await decorateProductsWithLightSpecs(product);

    res.json(successResponse(decoratedProduct, '更新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取店铺订单（商家端）
 */
exports.getMerchantOrders = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await findOwnedMerchant(user.id);

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const { status } = req.query;
    const where = buildMerchantOrderScopeWhere(merchant);
    if (status) where.status = status;

    const orders = await Order.findAll({
      where,
      include: [{
        model: require('../models').User,
        as: 'user',
        attributes: ['nickname', 'phone']
      }, {
        model: require('../models').User,
        as: 'rider',
        attributes: ['nickname', 'phone']
      }],
      order: [['id', 'DESC']]
    });

    res.json(successResponse(orders));
  } catch (error) {
    next(error);
  }
};

/**
 * 删除商品（商家端）
 */
exports.deleteProduct = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await findOwnedMerchant(user.id);

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const product = await Product.findOne({
      where: { id: req.params.id, merchant_id: merchant.id }
    });

    if (!product) {
      return res.status(404).json(errorResponse('商品不存在'));
    }

    await ProductSpec.destroy({ where: { product_id: product.id } });
    await product.destroy();

    res.json(successResponse(null, '商品已删除'));
  } catch (error) {
    next(error);
  }
};

/**
 * 更新商品状态（上下架）
 */
exports.updateProductStatus = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await findOwnedMerchant(user.id);

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const product = await Product.findOne({
      where: { id: req.params.id, merchant_id: merchant.id }
    });

    if (!product) {
      return res.status(404).json(errorResponse('商品不存在'));
    }

    const { status } = req.body;
    await product.update({ status: status ? 1 : 0 });

    res.json(successResponse(product, status ? '已上架' : '已下架'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取商品详情（公开）
 */
exports.getProductDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findOne({
      where: { id },
      include: [{
        model: Merchant,
        as: 'merchant',
        attributes: ['id', 'name', 'logo', 'phone', 'address']
      }]
    });

    if (!product) {
      return res.status(404).json(errorResponse('商品不存在'));
    }

    const decoratedProduct = await decorateProductsWithLightSpecs(product);

    res.json(successResponse(decoratedProduct));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取我的商品列表（商家端）
 */
exports.getMyProducts = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await findOwnedMerchant(user.id);

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const { status, category_id } = req.query;
    const where = { merchant_id: merchant.id };
    if (status !== undefined) where.status = status;
    if (category_id) where.category_id = category_id;

    // 为了兼容，我们这里使用 left outer join，不强制要求商品必须有分类
    const products = await Product.findAll({
      where,
      include: [{
        model: ProductCategory,
        as: 'category',
        attributes: ['id', 'name'],
        required: false // 允许商品没有分类
      }],
      order: [['id', 'DESC']]
    });

    const decoratedProducts = await decorateProductsWithLightSpecs(products);

    res.json(successResponse(decoratedProducts));
  } catch (error) {
    console.error('获取商家商品列表失败:', error);
    next(error);
  }
};

/**
 * 更新店铺营业状态
 */
exports.updateMerchantStatus = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await findOwnedMerchant(user.id);

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const { status } = req.body;
    await merchant.update({ status: status ? 1 : 0 });

    res.json(successResponse(merchant, status ? '已营业' : '已休息'));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取店铺统计数据
 */
exports.getMerchantStats = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await Merchant.findOne({ where: { user_id: user.id } });

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    // 今日订单
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrders = await Order.count({
      where: {
        merchant_id: merchant.id,
        created_at: { [Op.gte]: today }
      }
    });

    // 今日销售额
    const todaySales = await Order.sum('pay_amount', {
      where: {
        merchant_id: merchant.id,
        status: { [Op.ne]: 7 }, // 排除已取消
        created_at: { [Op.gte]: today }
      }
    }) || 0;

    // 总订单数
    const totalOrders = await Order.count({
      where: { merchant_id: merchant.id }
    });

    // 总销售额
    const totalSales = await Order.sum('pay_amount', {
      where: {
        merchant_id: merchant.id,
        status: { [Op.ne]: 7 }
      }
    }) || 0;

    // 商品数量
    const productCount = await Product.count({
      where: { merchant_id: merchant.id }
    });

    res.json(successResponse({
      todayOrders,
      todaySales: parseFloat(todaySales).toFixed(2),
      totalOrders,
      totalSales: parseFloat(totalSales).toFixed(2),
      productCount
    }));
  } catch (error) {
    next(error);
  }
};
