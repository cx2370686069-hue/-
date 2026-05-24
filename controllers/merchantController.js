// 这个文件可以当成“商家模块总入口”来看。
// 只要和商家有关的事情，比如店铺资料、商品、分类、公开列表、搜索、订单、统计，基本都从这里进来。
// 先引入后面会用到的模型、工具函数和配置。
const { Merchant, Product, ProductCategory, ProductSpec, ProductDigitalProfile, Order, Review, ServiceArea, sequelize } = require('../models');
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
const {
  buildImageAssetUrls,
  buildImageAssetList,
  parseStoredImageList,
  serializeImageList
} = require('../utils/imageAssets');
const { generateUniqueMerchantBindingCode } = require('../utils/merchantBinding');

// ==================== 基础常量区 ====================
// 这里放商家模块里会反复用到的固定值。
// 以后如果你想改类目名、业务线标识、预览数量，优先先看这里。
const SUPERMARKET_CATEGORY = '超市';
const DIGITAL_MERCHANT_CATEGORY = '手机数码';
const NORMAL_SUPERMARKET_CHANNEL_LABEL = '普通超市';
const COUNTY_FOOD_SCOPE = 'county_food';
const COUNTY_SEARCH_PREVIEW_LIMIT = 4;
const MERCHANT_LIST_PREVIEW_LIMIT = 4;
// 数码商品扩展表对外只暴露下面这些字段。
// 这样做的目的，是把返回结构收窄，避免把没用字段一股脑发给前端。
const DIGITAL_PROFILE_ATTRIBUTES = [
  'product_id',
  'brand',
  'model',
  'storage',
  'color',
  'condition_grade',
  'battery_health',
  'network_status',
  'repair_status',
  'warranty_status',
  'selling_points',
  'attrs_json'
];
// 查商品列表时，商家侧只顺手带出这些必要字段。
const PRODUCT_LIST_MERCHANT_ATTRIBUTES = [
  'id',
  'name',
  'logo',
  'address',
  'phone',
  'category',
  'status',
  'audit_status',
  'delivery_radius',
  'delivery_fee'
];

// 按当前登录用户的 user_id 查“他自己的店铺”。
// 后面很多后台接口都要先确认“这家店是不是当前登录人自己的”，所以这里单独提成复用函数。
const findOwnedMerchant = async (userId) => {
  return Merchant.findOne({ where: { user_id: userId } });
};

// 生成商家绑定码。
// 不是随机生成完就直接用，而是会再查一次数据库，确保没有撞码。
const createMerchantBindingCode = async () => {
  return generateUniqueMerchantBindingCode(async (candidate) => {
    const existing = await Merchant.findOne({
      where: { binding_code: candidate },
      attributes: ['id']
    });
    return Boolean(existing);
  });
};

// 这些字段不允许商家自己通过“修改店铺资料”接口直接改。
// 因为它们属于审核、归属、资金这类敏感信息，必须由后台或专门流程控制。
const FORBIDDEN_MERCHANT_UPDATE_FIELDS = [
  'id',
  'user_id',
  'binding_code',
  'business_scope',
  'town_code',
  'town_name',
  'audit_status',
  'status',
  'balance',
  'withdrawn_amount',
  'total_income',
  'created_at',
  'updated_at'
];

// 检查前端这次提交里，有没有偷偷夹带这些敏感字段。
const getForbiddenMerchantUpdateFields = (payload = {}) => {
  return FORBIDDEN_MERCHANT_UPDATE_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(payload, field));
};

// 查某个分类是不是“当前商家自己的分类”。
// 这个校验很重要，能防止前端乱传别人的分类 id，造成越权修改。
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

// 这里只判断“前端有没有显式传这个字段”，不判断值本身真假。
// 因为 0、false、空字符串在某些场景下本来就是合法值。
const hasOwnField = (payload, field) => Object.prototype.hasOwnProperty.call(payload || {}, field);

// 把前端传来的经纬度统一转成数字。
// 如果转不了，统一记成 null，表示这个坐标后面不能参与业务计算。
const normalizeCoordinate = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

// 判断一对经纬度是不是“像样的真实坐标”。
// 这里主要拦两类脏数据：超出地球范围的值、接近 0/0 的假坐标。
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

// 把值转成“必须大于 0”的数字。
// 适合半径、距离这类字段；不是正数就直接当成无效值。
const toPositiveNumberOrNull = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

// 把距离数值转成前端能直接显示的文本，比如 1.2km。
const formatDistanceText = (distanceKm) => {
  if (!Number.isFinite(distanceKm)) {
    return null;
  }
  return `${distanceKm.toFixed(1)}km`;
};

// 搜索词做最基础的清洗：去空格、限长度。
const normalizeSearchKeyword = (value) => String(value || '').trim().slice(0, 50);

// 分类名称做基础清洗，避免前后空格和超长内容。
const normalizeCategoryName = (value) => String(value || '').trim().slice(0, 50);

// 分类排序只接受非负整数。
// 没传就走默认值；传了但不合法，就返回 null，让外层统一拦截。
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

// 商品搜索词也是一样，先做基础清洗。
const normalizeProductKeyword = (value) => String(value || '').trim().slice(0, 50);

// 短文本统一走这里清洗，比如名称、型号、颜色这类字段。
// 清洗后如果是空字符串，就统一压成 null，方便后面判断“到底有没有值”。
const normalizeShortText = (value, maxLength = 100) => {
  if (value === undefined || value === null) {
    return null;
  }
  const text = String(value).trim();
  return text ? text.slice(0, maxLength) : null;
};
// 长文本统一走这里。
// 如果前端传的是数组，也会先帮它拼成一段字符串，方便直接入库。
const normalizeLongText = (value, maxLength = 5000) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    const tokens = value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    return tokens.length ? tokens.join('；').slice(0, maxLength) : null;
  }
  const text = String(value).trim();
  return text ? text.slice(0, maxLength) : null;
};
// 把前端传来的乡镇信息，解析成数据库里的服务区域记录。
// 优先按 town_code 找；没传 code 或找不到时，再按 town_name 找。
const resolveTownArea = async (payload = {}) => {
  const townCode = normalizeShortText(payload.town_code ?? payload.townCode, 32);
  const townName = normalizeShortText(payload.town_name ?? payload.townName ?? payload.town, 50);

  if (townCode) {
    return ServiceArea.findOne({
      where: {
        area_code: townCode,
        area_type: 'town',
        is_enabled: true
      }
    });
  }

  if (townName) {
    return ServiceArea.findOne({
      where: {
        area_name: townName,
        area_type: 'town',
        is_enabled: true
      }
    });
  }

  return null;
};
// 某些扩展字段前端可能传对象，也可能直接传字符串。
// 这里统一整理成数据库能安全存下来的 JSON 文本。
const normalizeJsonText = (value, maxLength = 10000) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? text.slice(0, maxLength) : null;
  }
  try {
    return JSON.stringify(value).slice(0, maxLength);
  } catch (error) {
    return null;
  }
};
// 这个和“必须大于 0”的数字不同，它允许 0。
// 所以最低价、最高价这种筛选值更适合走这里。
const normalizeNonNegativeNumber = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : null;
};
// 频道标签前端可能会用很多种格式传过来。
// 这里统一拆分、去重，并过滤掉“普通超市”这种占位标签，最后收成标准字符串。
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

// 有些字段历史上改过名字，所以这里会从多个别名里挑第一个真正有值的。
const pickFirstDefinedValue = (payload = {}, fields = []) => {
  for (const field of fields) {
    if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
      return payload[field];
    }
  }
  return null;
};

// 这些都是频道标签在历史版本里出现过的字段名。
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

// 不管前端传的是哪个旧字段，最后都统一收口到 channel_tags 这个标准字段。
const resolveMerchantChannelTags = (payload = {}) => {
  return normalizeMerchantChannelTags(pickFirstDefinedValue(payload, MERCHANT_CHANNEL_TAG_FIELDS));
};

// 数码资料这块也存在新旧字段名混用，所以这里先准备一张“别名映射表”。
const DIGITAL_PROFILE_FIELD_ALIASES = {
  brand: ['brand'],
  model: ['model'],
  storage: ['storage', 'capacity'],
  color: ['color'],
  condition_grade: ['condition_grade', 'conditionGrade'],
  battery_health: ['battery_health', 'batteryHealth'],
  network_status: ['network_status', 'networkStatus'],
  repair_status: ['repair_status', 'repairStatus'],
  warranty_status: ['warranty_status', 'warrantyStatus'],
  selling_points: ['selling_points', 'sellingPoints'],
  attrs_json: ['attrs_json', 'attrsJson', 'attrs']
};

// 看这次请求有没有动到“数码扩展资料”这块。
const hasDigitalProfileField = (payload = {}) =>
  Object.values(DIGITAL_PROFILE_FIELD_ALIASES)
    .flat()
    .some((field) => hasOwnField(payload, field));

// 读取某个数码字段时，顺手兼容旧字段名。
const pickDigitalProfileValue = (payload = {}, fieldName) =>
  pickFirstDefinedValue(payload, DIGITAL_PROFILE_FIELD_ALIASES[fieldName] || []);

// 把数码扩展资料整理成统一格式。
// touched 表示“这次请求有没有碰这一块”；
// data 才是最后真正准备写进 product_digital_profiles 表的数据。
const normalizeDigitalProfileInput = (payload = {}) => {
  if (!hasDigitalProfileField(payload)) {
    return { touched: false, data: null };
  }

  const data = {
    brand: normalizeShortText(pickDigitalProfileValue(payload, 'brand'), 50),
    model: normalizeShortText(pickDigitalProfileValue(payload, 'model'), 100),
    storage: normalizeShortText(pickDigitalProfileValue(payload, 'storage'), 50),
    color: normalizeShortText(pickDigitalProfileValue(payload, 'color'), 50),
    condition_grade: normalizeShortText(pickDigitalProfileValue(payload, 'condition_grade'), 20),
    battery_health: normalizeShortText(pickDigitalProfileValue(payload, 'battery_health'), 20),
    network_status: normalizeShortText(pickDigitalProfileValue(payload, 'network_status'), 100),
    repair_status: normalizeShortText(pickDigitalProfileValue(payload, 'repair_status'), 100),
    warranty_status: normalizeShortText(pickDigitalProfileValue(payload, 'warranty_status'), 100),
    selling_points: normalizeLongText(pickDigitalProfileValue(payload, 'selling_points'), 5000),
    attrs_json: normalizeJsonText(pickDigitalProfileValue(payload, 'attrs_json'), 10000)
  };

  const hasActualValue = Object.values(data).some((value) => value !== null && value !== '');
  return {
    touched: true,
    data: hasActualValue ? data : null
  };
};

// 生成“频道标签为空”的查询条件。
const buildBlankChannelTagsCondition = () => ({
  [Op.or]: [
    { [Op.is]: null },
    { [Op.eq]: '' }
  ]
});

// 把分页参数统一整理成合法整数。
// 比如 page、limit 这类值，都要求是指定范围内的正整数。
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

// 前端 query 里的布尔值经常传得很乱，可能是 1、true、yes。
// 这里统一转成真正的 true / false。
const parseBooleanQuery = (value) => {
  if (value === undefined || value === null || value === '') {
    return false;
  }
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y'].includes(normalized);
};

// 商品列表支持的排序方式都收在这里，避免把排序规则写散。
const PRODUCT_SORT_ORDERS = {
  sort_desc: [['sort', 'DESC'], ['id', 'DESC']],
  sort_asc: [['sort', 'ASC'], ['id', 'ASC']],
  sales_desc: [['sales', 'DESC'], ['id', 'DESC']],
  price_asc: [['price', 'ASC'], ['id', 'ASC']],
  price_desc: [['price', 'DESC'], ['id', 'DESC']],
  newest: [['id', 'DESC']]
};

// 把商品对象整理成“公开商品列表”要的返回结构。
// 主要目的是把图片、商家摘要、数码信息摊平，前端拿到后能直接渲染。
const buildPublicProductListItem = (product) => {
  const productJson = decorateProductDigitalFields(decorateProductImageFields(product));
  return {
    id: Number(productJson.id),
    merchant_id: Number(productJson.merchant_id),
    category_id: productJson.category_id ? Number(productJson.category_id) : null,
    name: productJson.name || '',
    images: productJson.images || '',
    image: productJson.image || '',
    image_thumb: productJson.image_thumb || '',
    image_list: productJson.image_list || '',
    image_detail: productJson.image_detail || '',
    images_thumb: Array.isArray(productJson.images_thumb) ? productJson.images_thumb : [],
    images_list: Array.isArray(productJson.images_list) ? productJson.images_list : [],
    images_detail: Array.isArray(productJson.images_detail) ? productJson.images_detail : [],
    images_assets: Array.isArray(productJson.images_assets) ? productJson.images_assets : [],
    price: Number(productJson.price || 0),
    original_price: productJson.original_price === null || productJson.original_price === undefined
      ? null
      : Number(productJson.original_price),
    sales: Number(productJson.sales || 0),
    status: Number(productJson.status || 0),
    sort: Number(productJson.sort || 0),
    merchant_name: productJson.merchant_name || '',
    merchant_logo: productJson.merchant_logo || '',
    merchant_logo_thumb: productJson.merchant_logo_thumb || '',
    supports_local_delivery: productJson.supports_local_delivery,
    brand: productJson.brand || '',
    model: productJson.model || '',
    storage: productJson.storage || '',
    color: productJson.color || '',
    condition_grade: productJson.condition_grade || '',
    battery_health: productJson.battery_health || '',
    network_status: productJson.network_status || '',
    repair_status: productJson.repair_status || '',
    warranty_status: productJson.warranty_status || '',
    selling_points: productJson.selling_points || '',
    digital_profile: productJson.digital_profile || null,
    spec_group_name: productJson.spec_group_name || '',
    spec_options: Array.isArray(productJson.spec_options) ? productJson.spec_options : []
  };
};

// 商品预览图默认只拿第一张。
const pickProductPreviewImage = (value) => {
  const firstAsset = buildImageAssetList(value)[0];
  return firstAsset?.list || firstAsset?.detail || firstAsset?.url || '';
};

// logo、封面、营业执照这种字段本来就只应该存 1 张图。
// 如果前端误传了多张，这里只保留第一张。
const normalizeSingleImageValue = (value) => {
  return parseStoredImageList(value)[0] || '';
};

// 给商家图片补齐不同场景下要用的地址。
// 这样前端就不用自己拼缩略图、列表图、详情图。
const decorateMerchantImageFields = (merchant) => {
  const merchantJson = typeof merchant?.toJSON === 'function' ? merchant.toJSON() : { ...merchant };
  const logoAssets = buildImageAssetUrls(merchantJson.logo);
  const coverAssets = buildImageAssetUrls(merchantJson.cover);

  return {
    ...merchantJson,
    logo_thumb: logoAssets.thumb,
    logo_list: logoAssets.list,
    logo_detail: logoAssets.detail,
    logo_original: logoAssets.original,
    logo_assets: logoAssets,
    cover_thumb: coverAssets.thumb,
    cover_list: coverAssets.list,
    cover_detail: coverAssets.detail,
    cover_original: coverAssets.original,
    cover_assets: coverAssets
  };
};

// 商品图片也在这里做同样的补充。
// 除了整组图片，还会顺手补一张主图，方便商品列表直接用。
const decorateProductImageFields = (product) => {
  const productJson = typeof product?.toJSON === 'function' ? product.toJSON() : { ...product };
  const imageAssetsList = buildImageAssetList(productJson.images);
  const primary = imageAssetsList[0] || {
    url: '',
    raw: '',
    thumb: '',
    list: '',
    detail: '',
    original: '',
    best: ''
  };

  return {
    ...productJson,
    merchant: productJson.merchant ? decorateMerchantImageFields(productJson.merchant) : productJson.merchant,
    image: primary.list || primary.detail || primary.url || '',
    image_thumb: primary.thumb || primary.url || '',
    image_list: primary.list || primary.detail || primary.url || '',
    image_detail: primary.detail || primary.url || '',
    image_original: primary.original || primary.url || '',
    image_assets: primary,
    images_assets: imageAssetsList,
    images_thumb: imageAssetsList.map((item) => item.thumb || item.url).filter(Boolean),
    images_list: imageAssetsList.map((item) => item.list || item.detail || item.url).filter(Boolean),
    images_detail: imageAssetsList.map((item) => item.detail || item.url).filter(Boolean),
    images_original: imageAssetsList.map((item) => item.original || item.url).filter(Boolean)
  };
};

// 批量给商品补图片字段。
const decorateProductsWithImageAssets = (products) => {
  if (Array.isArray(products)) {
    return products.map((product) => decorateProductImageFields(product));
  }
  return products ? decorateProductImageFields(products) : products;
};

// 如果传了用户坐标，就顺手把商家距离也算出来。
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

// 县城搜索里，每家店最后都会被整理成这种统一结构。
const buildCountySearchMerchantEntry = (merchant, userLat, userLng) => {
  const merchantJson = decorateMerchantImageFields(merchant);
  return decorateMerchantWithDistance({
    merchant_id: Number(merchantJson.id),
    merchant_name: merchantJson.name || '',
    logo: merchantJson.logo || '',
    logo_thumb: merchantJson.logo_thumb || '',
    logo_list: merchantJson.logo_list || '',
    logo_detail: merchantJson.logo_detail || '',
    cover: merchantJson.cover || '',
    cover_thumb: merchantJson.cover_thumb || '',
    cover_list: merchantJson.cover_list || '',
    cover_detail: merchantJson.cover_detail || '',
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

// 如果这家店是通过“商品名命中”搜出来的，就把命中的商品顺手塞进预览区。
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

// 给商家列表补“店里卖什么”的预览商品。
// 首页、列表页那种一行展示几件商品，基本就是这里做的。
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

// 评分统一保留 1 位小数，前端展示更稳定。
const formatMerchantRating = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  return Number(num.toFixed(1));
};

// 有些环境 reviews 表可能还没建好。
// 这里单独拦一下，避免因为少一张表把整个商家列表接口打挂。
const isReviewTableMissingError = (error) => {
  if (!error) {
    return false;
  }

  const code = error.original?.code || error.parent?.code || error.code || '';
  const message = String(error.original?.sqlMessage || error.parent?.sqlMessage || error.message || '');

  return code === 'ER_NO_SUCH_TABLE' || /Table '.+\.reviews' doesn't exist/i.test(message);
};

// 给商家列表补评分和评价数量。
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

// 给商家列表补近 30 天销量。
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

// 判断这家店是不是超市。
const isSupermarketMerchant = (merchant) =>
  normalizeMerchantCategory(merchant?.category) === SUPERMARKET_CATEGORY;

// 判断这家店是不是手机数码店。
const isDigitalMerchant = (merchant) =>
  normalizeMerchantCategory(merchant?.category) === DIGITAL_MERCHANT_CATEGORY;

// 目前只有超市和手机数码店允许配置轻规格。
const canConfigureLightSpecs = (merchant) => isSupermarketMerchant(merchant) || isDigitalMerchant(merchant);

// 这里不是直接看商品，而是看商家有没有配送半径。
// 有配送半径，通常就可以认为这家店支持本地配送。
const buildProductSupportsLocalDelivery = (merchant) => {
  if (!merchant) {
    return null;
  }
  const radius = Number(merchant.delivery_radius || 0);
  return Number.isFinite(radius) ? radius > 0 : null;
};

// 数码扩展资料最后统一整理成这个返回格式。
const buildDigitalProfileResponse = (digitalProfile) => {
  if (!digitalProfile) {
    return null;
  }
  const profileJson = typeof digitalProfile?.toJSON === 'function' ? digitalProfile.toJSON() : { ...digitalProfile };
  return {
    brand: profileJson.brand || '',
    model: profileJson.model || '',
    storage: profileJson.storage || '',
    color: profileJson.color || '',
    condition_grade: profileJson.condition_grade || '',
    battery_health: profileJson.battery_health || '',
    network_status: profileJson.network_status || '',
    repair_status: profileJson.repair_status || '',
    warranty_status: profileJson.warranty_status || '',
    selling_points: profileJson.selling_points || '',
    attrs_json: profileJson.attrs_json || ''
  };
};

// 在商品对象上继续补数码资料和商家摘要。
// 这样前端拿到商品后，不用再自己一层层去拆 merchant 和 digital_profile。
const decorateProductDigitalFields = (product) => {
  const productJson = typeof product?.toJSON === 'function' ? product.toJSON() : { ...product };
  const merchant = productJson.merchant ? decorateMerchantImageFields(productJson.merchant) : null;
  const digitalProfile = buildDigitalProfileResponse(productJson.digital_profile);

  return {
    ...productJson,
    merchant,
    merchant_name: merchant?.name || '',
    merchant_logo: merchant?.logo || '',
    merchant_logo_thumb: merchant?.logo_thumb || '',
    supports_local_delivery: buildProductSupportsLocalDelivery(merchant),
    digital_profile: digitalProfile,
    brand: digitalProfile?.brand || '',
    model: digitalProfile?.model || '',
    storage: digitalProfile?.storage || '',
    color: digitalProfile?.color || '',
    condition_grade: digitalProfile?.condition_grade || '',
    battery_health: digitalProfile?.battery_health || '',
    network_status: digitalProfile?.network_status || '',
    repair_status: digitalProfile?.repair_status || '',
    warranty_status: digitalProfile?.warranty_status || '',
    selling_points: digitalProfile?.selling_points || '',
    attrs_json: digitalProfile?.attrs_json || ''
  };
};

// 批量给商品补数码扩展字段。
const decorateProductsWithDigitalFields = (products) => {
  if (Array.isArray(products)) {
    return products.map((product) => decorateProductDigitalFields(product));
  }
  return products ? decorateProductDigitalFields(products) : products;
};

// 商品联表查询的 include 配置统一收在这里。
const buildProductQueryIncludes = ({
  merchantRequired = false,
  merchantWhere = null,
  digitalRequired = false,
  digitalWhere = null
} = {}) => ([
  {
    model: Merchant,
    as: 'merchant',
    attributes: PRODUCT_LIST_MERCHANT_ATTRIBUTES,
    required: merchantRequired,
    ...(merchantWhere ? { where: merchantWhere } : {})
  },
  {
    model: ProductDigitalProfile,
    as: 'digital_profile',
    attributes: DIGITAL_PROFILE_ATTRIBUTES,
    required: digitalRequired,
    ...(digitalWhere ? { where: digitalWhere } : {})
  }
]);

// 这里专门负责把“商品详情”查完整。
// 规格、图片、数码资料都会在这里一次性补齐，别的接口直接复用就行。
const loadProductDetailForResponse = async (productId, where = {}) => {
  const product = await Product.findOne({
    where: {
      id: productId,
      ...where
    },
    include: buildProductQueryIncludes()
  });
  if (!product) {
    return null;
  }
  return decorateProductsWithDigitalFields(
    decorateProductsWithImageAssets(await decorateProductsWithLightSpecs(product))
  );
};

// 同步商品的数码扩展资料。
// 有内容就更新或新建；没内容就删掉，避免主表和扩展表对不上。
const syncProductDigitalProfile = async ({ productId, profileData, transaction }) => {
  if (!profileData) {
    await ProductDigitalProfile.destroy({
      where: { product_id: productId },
      transaction
    });
    return;
  }

  const existing = await ProductDigitalProfile.findOne({
    where: { product_id: productId },
    transaction
  });

  if (existing) {
    await existing.update(profileData, { transaction });
    return;
  }

  await ProductDigitalProfile.create({
    product_id: productId,
    ...profileData
  }, { transaction });
};

// 检查超市配送方式是不是合法值。
const validateSupermarketDeliveryPermission = (_merchantCategory, rawPermission) => {
  const normalized = normalizeSupermarketDeliveryPermission(rawPermission);
  if (!normalized) {
    return { error: '店铺必须选择配送方式：自己配送、骑手配送或两个都支持' };
  }

  if (!Object.values(SUPERMARKET_DELIVERY_PERMISSIONS).includes(normalized)) {
    return { error: '店铺配送方式参数不正确' };
  }

  return { value: normalized };
};

// 看这次提交有没有碰“轻规格”这块。
const hasLightSpecField = (payload = {}) =>
  hasOwnField(payload, 'spec_group_name') || hasOwnField(payload, 'spec_options');

// 规格组名称先做简单整理，比如“大小”“颜色”“容量”这种。
const normalizeSpecGroupName = (value) => {
  const text = String(value || '').trim();
  return text ? text.slice(0, 50) : '';
};

// 规格项这里做了较多兼容。
// 数组、JSON 字符串、逗号文本、换行文本，最后都会被收成统一数组。
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

// 轻规格最终都会被整理成统一格式。
// 这里还会顺手做成对校验：有组名没选项不行，有选项没组名也不行。
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

// 判断这次轻规格提交到底是不是“空操作”。
const hasActualLightSpecConfig = (lightSpecInput = {}) =>
  Boolean(lightSpecInput.specGroupName || (lightSpecInput.specOptions || []).length > 0);

// 这里准备的是写入 Product 主表的数据。
// 规格和数码扩展资料不能直接塞进主表，所以会先剥出去。
const buildProductPayloadWithoutSpecs = (payload = {}) => {
  const sanitizedPayload = { ...payload };
  delete sanitizedPayload.spec_group_name;
  delete sanitizedPayload.spec_options;
  Object.values(DIGITAL_PROFILE_FIELD_ALIASES)
    .flat()
    .forEach((field) => delete sanitizedPayload[field]);
  if (Object.prototype.hasOwnProperty.call(sanitizedPayload, 'images')) {
    sanitizedPayload.images = serializeImageList(sanitizedPayload.images);
  }
  return sanitizedPayload;
};

// 轻规格这里采用“先删后建”。
// 这么做虽然笨一点，但最稳，能保证数据库里的规格和前端这次提交完全一致。
const syncProductLightSpecs = async ({ productId, specGroupName, specOptions, transaction }) => {
  await ProductSpec.destroy({
    where: { product_id: productId },
    transaction
  });

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
    })),
    { transaction }
  );
};

// 查出商品规格后，再挂回商品对象里，方便前端直接使用。
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

// 商家查订单时，不是所有订单都能看。
// 这里会先根据业务线和乡镇归属，把查询范围收紧，避免越权看到别人的单。
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
 * 公开商家列表接口
 * 这是用户端最常用的商家列表入口：首页、频道页、店铺列表基本都走这里。
 * 它不只是“查店铺”，还会顺手补评分、销量、预览商品、距离这些展示字段。
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
      // 普通超市频道默认只显示“没有子频道标签”的超市，
      // 这样可以避免把冷饮雪糕批发这类子频道商家混进来。
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
    list = list.map((merchant) => decorateMerchantImageFields(merchant));

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
 * 公开商家详情接口
 * 作用很直接：按商家 id 查某一家店，再补评分、销量、图片字段后返回。
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

    res.json(successResponse(decorateMerchantImageFields(merchantWithSales)));
  } catch (error) {
    next(error);
  }
};

/**
 * 商家后台分类列表接口
 * 这里只查当前登录商家自己的分类，不会去看别人的分类。
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
 * 公开分类列表接口
 * 根据商家 id 查这家店铺下面的分类，给用户端点店铺详情时使用。
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
 * 商品列表接口
 * 这个接口同时兼容公开侧和商家后台，所以筛选条件比较多。
 * 返回前会把规格、图片、商家摘要、数码资料一次性补齐。
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
      lite,
      brand,
      condition_grade,
      min_price,
      max_price,
      merchant_category,
      merchantCategory,
      conditionGrade,
      minPrice,
      maxPrice
    } = req.query;
    
    // 如果前端没传 merchant_id，但当前又是商家登录，
    // 那就默认查“我自己的店”的商品，避免前端还要重复传一次店铺 id。
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
    const normalizedBrand = normalizeShortText(brand, 50);
    const normalizedConditionGrade = normalizeShortText(condition_grade ?? conditionGrade, 20);
    const normalizedMinPrice = normalizeNonNegativeNumber(min_price ?? minPrice);
    const normalizedMaxPrice = normalizeNonNegativeNumber(max_price ?? maxPrice);
    const normalizedMerchantCategory = normalizeMerchantCategory(merchant_category ?? merchantCategory);
    const sortMode = String(sort || '').trim();
    if (sortMode && !PRODUCT_SORT_ORDERS[sortMode]) {
      return res.status(400).json(errorResponse('商品排序参数不正确'));
    }
    if (
      ((min_price !== undefined || minPrice !== undefined) && normalizedMinPrice === null) ||
      ((max_price !== undefined || maxPrice !== undefined) && normalizedMaxPrice === null)
    ) {
      return res.status(400).json(errorResponse('价格筛选参数不正确'));
    }
    if (
      (merchant_category !== undefined || merchantCategory !== undefined) &&
      (!normalizedMerchantCategory || !isValidMerchantCategory(normalizedMerchantCategory))
    ) {
      return res.status(400).json(errorResponse(getMerchantCategoryErrorMessage()));
    }
    if (
      normalizedMinPrice !== null &&
      normalizedMaxPrice !== null &&
      normalizedMinPrice > normalizedMaxPrice
    ) {
      return res.status(400).json(errorResponse('最低价格不能大于最高价格'));
    }

    const useLitePayload = parseBooleanQuery(lite);
    const shouldPaginate = parsedPage !== null || parsedLimit !== null;
    const finalPage = parsedPage || 1;
    const finalLimit = parsedLimit || 20;

    const where = { status };
    if (targetMerchantId) where.merchant_id = targetMerchantId;
    if (category_id) where.category_id = category_id;
    if (normalizedKeyword) {
      const keywordLike = `%${normalizedKeyword}%`;
      where[Op.or] = [
        { name: { [Op.like]: keywordLike } },
        { '$digital_profile.brand$': { [Op.like]: keywordLike } },
        { '$digital_profile.model$': { [Op.like]: keywordLike } }
      ];
    }
    if (normalizedMinPrice !== null || normalizedMaxPrice !== null) {
      where.price = {};
      if (normalizedMinPrice !== null) {
        where.price[Op.gte] = normalizedMinPrice;
      }
      if (normalizedMaxPrice !== null) {
        where.price[Op.lte] = normalizedMaxPrice;
      }
    }

    const digitalWhere = {};
    if (normalizedBrand) {
      digitalWhere.brand = { [Op.like]: `%${normalizedBrand}%` };
    }
    if (normalizedConditionGrade) {
      digitalWhere.condition_grade = normalizedConditionGrade;
    }
    const hasDigitalFilters = Object.keys(digitalWhere).length > 0;
    const merchantWhere = normalizedMerchantCategory
      ? {
        category: normalizedMerchantCategory,
        status: 1,
        audit_status: 1
      }
      : null;

    const queryOptions = {
      where,
      order: PRODUCT_SORT_ORDERS[sortMode] || PRODUCT_SORT_ORDERS.sort_desc,
      include: buildProductQueryIncludes({
        merchantRequired: Boolean(merchantWhere),
        merchantWhere,
        digitalRequired: hasDigitalFilters || Boolean(normalizedKeyword),
        digitalWhere: hasDigitalFilters ? digitalWhere : null
      }),
      distinct: true,
      subQuery: false
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

    const decoratedProducts = decorateProductsWithDigitalFields(
      decorateProductsWithImageAssets(await decorateProductsWithLightSpecs(rawProducts))
    );

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
 * 县城搜索接口
 * 搜索顺序是：先按店名搜，再按商品名搜，最后把结果统一合成商家列表。
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
 * 创建店铺接口
 * 用户申请开店时走这里。
 * 这个接口会先校验类目、坐标、业务线、乡镇归属，再真正创建店铺。
 */
exports.createMerchant = async (req, res, next) => {
  try {
    const user = req.user;
    const businessScope = normalizeShortText(req.body.business_scope, 20) || COUNTY_FOOD_SCOPE;
    const merchantCategory = normalizeMerchantCategory(req.body.category);
    const supermarketDeliveryPermissionCheck = validateSupermarketDeliveryPermission(
      merchantCategory,
      req.body.supermarket_delivery_permission ?? req.body.delivery_permission
    );
    const latitude = normalizeCoordinate(req.body.latitude ?? req.body.lat);
    const longitude = normalizeCoordinate(req.body.longitude ?? req.body.lng);
    
    // 一个用户只能拥有一个店铺，所以这里先拦重复开店。
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

    if (![COUNTY_FOOD_SCOPE, 'town_food'].includes(businessScope)) {
      return res.status(400).json(errorResponse('商家业务线参数不正确'));
    }

    const rawTownCode = normalizeShortText(req.body.town_code ?? req.body.townCode, 32);
    const rawTownName = normalizeShortText(req.body.town_name ?? req.body.townName ?? req.body.town, 50);
    if (businessScope === COUNTY_FOOD_SCOPE && (rawTownCode || rawTownName)) {
      return res.status(400).json(errorResponse('县城商家不能绑定乡镇'));
    }

    let townArea = null;
    if (businessScope === 'town_food') {
      townArea = await resolveTownArea(req.body);
      if (!townArea) {
        return res.status(400).json(errorResponse('乡镇商家必须绑定有效乡镇'));
      }
    }

    const merchantPayload = {
      ...req.body,
      logo: normalizeSingleImageValue(req.body.logo),
      cover: normalizeSingleImageValue(req.body.cover),
      business_license: normalizeSingleImageValue(req.body.business_license),
      latitude,
      longitude,
      category: merchantCategory,
      business_scope: businessScope,
      town_code: townArea ? townArea.area_code : null,
      town_name: townArea ? townArea.area_name : null,
      channel_tags: resolveMerchantChannelTags(req.body),
      supermarket_delivery_permission: supermarketDeliveryPermissionCheck.value,
      audit_status: 0
    };

    const merchant = await Merchant.create({
      user_id: user.id,
      binding_code: await createMerchantBindingCode(),
      ...merchantPayload
    });

    res.status(201).json(successResponse(decorateMerchantImageFields(merchant), '店铺创建成功，请等待审核'));
  } catch (error) {
    next(error);
  }
};

/**
 * 查询我的店铺接口
 * 商家后台打开“店铺资料页”时，一般就是走这里。
 */
exports.getMyMerchant = async (req, res, next) => {
  try {
    const user = req.user;
    
    const merchant = await findOwnedMerchant(user.id);

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    res.json(successResponse(decorateMerchantImageFields(merchant)));
  } catch (error) {
    next(error);
  }
};

/**
 * 修改店铺资料接口
 * 商家只能改展示类信息。
 * 审核状态、资金、业务归属这类敏感字段，会在这里直接拦掉。
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
      updatePayload.category = merchantCategory;
    }

    if (
      hasOwnField(updatePayload, 'supermarket_delivery_permission') ||
      hasOwnField(updatePayload, 'delivery_permission')
    ) {
      const nextCategory = updatePayload.category || merchant.category;
      const permissionCheck = validateSupermarketDeliveryPermission(
        nextCategory,
        updatePayload.supermarket_delivery_permission ?? updatePayload.delivery_permission
      );
      if (permissionCheck.error) {
        return res.status(400).json(errorResponse(permissionCheck.error));
      }
      updatePayload.supermarket_delivery_permission = permissionCheck.value;
      delete updatePayload.delivery_permission;
    }

    if (hasOwnField(updatePayload, 'logo')) {
      updatePayload.logo = normalizeSingleImageValue(updatePayload.logo);
    }
    if (hasOwnField(updatePayload, 'cover')) {
      updatePayload.cover = normalizeSingleImageValue(updatePayload.cover);
    }
    if (hasOwnField(updatePayload, 'business_license')) {
      updatePayload.business_license = normalizeSingleImageValue(updatePayload.business_license);
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

    res.json(successResponse(decorateMerchantImageFields(merchant), '更新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 新建分类接口
 * 这里只允许当前登录商家给自己的店新增分类，不接受前端乱传 merchant_id。
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
 * 修改分类接口
 * 这里只能修改当前商家自己的分类，主要改名称和排序。
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
 * 删除分类接口
 * 如果分类下面还有商品，这里会直接拦住，不允许删除。
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
 * 新建商品接口
 * 这里不只是写 products 主表。
 * 轻规格和数码扩展资料也会在同一个事务里一起处理。
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
    const digitalProfileInput = normalizeDigitalProfileInput(req.body);
    if (lightSpecInput.error) {
      return res.status(400).json(errorResponse(lightSpecInput.error));
    }

    if (hasActualLightSpecConfig(lightSpecInput) && !canConfigureLightSpecs(merchant)) {
      return res.status(400).json(errorResponse('只有超市或手机数码商家才能配置商品规格'));
    }

    const productPayload = buildProductPayloadWithoutSpecs(req.body);
    const product = await sequelize.transaction(async (transaction) => {
      const createdProduct = await Product.create({
        merchant_id: merchant.id,
        ...productPayload
      }, { transaction });

      if (lightSpecInput.touched && canConfigureLightSpecs(merchant)) {
        await syncProductLightSpecs({
          productId: createdProduct.id,
          specGroupName: lightSpecInput.specGroupName,
          specOptions: lightSpecInput.specOptions,
          transaction
        });
      }

      if (digitalProfileInput.touched) {
        await syncProductDigitalProfile({
          productId: createdProduct.id,
          profileData: digitalProfileInput.data,
          transaction
        });
      }

      return createdProduct;
    });

    const decoratedProduct = await loadProductDetailForResponse(product.id);

    res.status(201).json(successResponse(decoratedProduct, '商品创建成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 修改商品接口
 * 这里只允许修改当前商家自己店里的商品。
 * 商品主表、轻规格、数码扩展资料会一起同步。
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
    const digitalProfileInput = normalizeDigitalProfileInput(req.body);
    if (lightSpecInput.error) {
      return res.status(400).json(errorResponse(lightSpecInput.error));
    }

    if (hasActualLightSpecConfig(lightSpecInput) && !canConfigureLightSpecs(merchant)) {
      return res.status(400).json(errorResponse('只有超市或手机数码商家才能配置商品规格'));
    }

    const updatePayload = buildProductPayloadWithoutSpecs(req.body);
    await sequelize.transaction(async (transaction) => {
      await product.update(updatePayload, { transaction });

      if (lightSpecInput.touched && canConfigureLightSpecs(merchant)) {
        await syncProductLightSpecs({
          productId: product.id,
          specGroupName: lightSpecInput.specGroupName,
          specOptions: lightSpecInput.specOptions,
          transaction
        });
      }

      if (digitalProfileInput.touched) {
        await syncProductDigitalProfile({
          productId: product.id,
          profileData: digitalProfileInput.data,
          transaction
        });
      }
    });

    const decoratedProduct = await loadProductDetailForResponse(product.id);

    res.json(successResponse(decoratedProduct, '更新成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 商家后台订单列表接口
 * 查询订单前，会先按县城/乡镇范围收口，避免看到不属于自己的订单。
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
 * 删除商品接口
 * 删除前会先把关联的规格和数码扩展资料一起清掉。
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

    await sequelize.transaction(async (transaction) => {
      await ProductSpec.destroy({
        where: { product_id: product.id },
        transaction
      });
      await ProductDigitalProfile.destroy({
        where: { product_id: product.id },
        transaction
      });
      await product.destroy({ transaction });
    });

    res.json(successResponse(null, '商品已删除'));
  } catch (error) {
    next(error);
  }
};

/**
 * 商品上下架接口
 * 这里只负责切换商品状态，逻辑比较简单。
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

    const decoratedProduct = await loadProductDetailForResponse(product.id);
    res.json(successResponse(decoratedProduct, status ? '已上架' : '已下架'));
  } catch (error) {
    next(error);
  }
};

/**
 * 公开商品详情接口
 * 这里只允许外部查询“已上架”的商品详情。
 */
exports.getProductDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await loadProductDetailForResponse(id, { status: 1 });

    if (!product) {
      return res.status(404).json(errorResponse('商品不存在'));
    }

    res.json(successResponse(product));
  } catch (error) {
    next(error);
  }
};

/**
 * 商家后台商品列表接口
 * 返回前会把分类、图片、规格、数码资料这些都补齐。
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

    // 这里用 left outer join 做兼容处理。
    // 也就是说：就算商品暂时没有分类，也不会因为联表失败把整条商品记录丢掉。
    const products = await Product.findAll({
      where,
      include: [
        {
          model: ProductCategory,
          as: 'category',
          attributes: ['id', 'name'],
          required: false
        },
        {
          model: ProductDigitalProfile,
          as: 'digital_profile',
          attributes: DIGITAL_PROFILE_ATTRIBUTES,
          required: false
        }
      ],
      order: [['id', 'DESC']]
    });

    const decoratedProducts = decorateProductsWithDigitalFields(
      decorateProductsWithImageAssets(await decorateProductsWithLightSpecs(products))
    );

    res.json(successResponse(decoratedProducts));
  } catch (error) {
    console.error('获取商家商品列表失败:', error);
    next(error);
  }
};

/**
 * 店铺营业状态切换接口
 * 商家手动切换“营业 / 休息”就是走这里。
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
 * 店铺统计接口
 * 商家后台首页那几个经营数字，基本都是这里算出来的。
 */
exports.getMerchantStats = async (req, res, next) => {
  try {
    const user = req.user;
    const merchant = await Merchant.findOne({ where: { user_id: user.id } });

    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    // 统计今天新创建的订单数量。
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayOrders = await Order.count({
      where: {
        merchant_id: merchant.id,
        created_at: { [Op.gte]: today }
      }
    });

    // 今日销售额只按“已完成订单”统计。
    // 这里的业务规则是：配送中不算营收，只有 status=6 的订单才记入营收。
    const todaySales = await Order.sum('pay_amount', {
      where: {
        merchant_id: merchant.id,
        status: 6,
        delivered_at: {
          [Op.gte]: today,
          [Op.lt]: tomorrow
        }
      }
    }) || 0;

    // 统计这家店的总订单数。
    const totalOrders = await Order.count({
      where: { merchant_id: merchant.id }
    });

    // 总销售额也统一按“已完成订单”累计。
    const totalSales = await Order.sum('pay_amount', {
      where: {
        merchant_id: merchant.id,
        status: 6
      }
    }) || 0;

    // 统计当前店铺一共有多少商品。
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
