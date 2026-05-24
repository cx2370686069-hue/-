// 这个文件是“商家主营类目配置表”。
// 商家入驻、资料修改、类目校验，都会从这里拿允许值和别名转换规则。
const MERCHANT_PRIMARY_CATEGORIES = [
  '美食',
  '超市',
  '手机数码',
  '甜点饮品',
  '龙虾烧烤',
  '鲜花蛋糕',
  '汉堡炸鸡',
  '跑腿代购'
];

const MERCHANT_CATEGORY_ALIASES = {
  炸鸡汉堡: '汉堡炸鸡'
};

// 有些前端或旧数据会传别名，这里先统一折算成系统内部认的标准类目。
const normalizeMerchantCategory = (value) => {
  const normalizedValue = String(value || '').trim();
  return MERCHANT_CATEGORY_ALIASES[normalizedValue] || normalizedValue;
};

// 对外只认标准类目，别名会先走上面的归一化。
const isValidMerchantCategory = (value) => {
  const normalizedValue = normalizeMerchantCategory(value);
  return MERCHANT_PRIMARY_CATEGORIES.includes(normalizedValue);
};

// 错误提示也集中放这里，避免控制器里每次手写一遍类目列表。
const getMerchantCategoryErrorMessage = () =>
  `店铺主营类目不正确，当前仅支持：${MERCHANT_PRIMARY_CATEGORIES.join('、')}`;

module.exports = {
  MERCHANT_PRIMARY_CATEGORIES,
  MERCHANT_CATEGORY_ALIASES,
  normalizeMerchantCategory,
  isValidMerchantCategory,
  getMerchantCategoryErrorMessage
};
