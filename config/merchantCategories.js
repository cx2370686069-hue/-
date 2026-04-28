const MERCHANT_PRIMARY_CATEGORIES = [
  '美食',
  '超市',
  '甜点饮品',
  '龙虾烧烤',
  '鲜花蛋糕',
  '汉堡炸鸡',
  '跑腿代购'
];

const MERCHANT_CATEGORY_ALIASES = {
  炸鸡汉堡: '汉堡炸鸡'
};

const normalizeMerchantCategory = (value) => {
  const normalizedValue = String(value || '').trim();
  return MERCHANT_CATEGORY_ALIASES[normalizedValue] || normalizedValue;
};

const isValidMerchantCategory = (value) => {
  const normalizedValue = normalizeMerchantCategory(value);
  return MERCHANT_PRIMARY_CATEGORIES.includes(normalizedValue);
};

const getMerchantCategoryErrorMessage = () =>
  `店铺主营类目不正确，当前仅支持：${MERCHANT_PRIMARY_CATEGORIES.join('、')}`;

module.exports = {
  MERCHANT_PRIMARY_CATEGORIES,
  MERCHANT_CATEGORY_ALIASES,
  normalizeMerchantCategory,
  isValidMerchantCategory,
  getMerchantCategoryErrorMessage
};
