// 这个文件是“商家绑定码工具”。
// 商家自配送员注册时输入的 6 位商家绑定码，生成与校验逻辑都放在这里。
const normalizeMerchantBindingCode = (value) => String(value || '').trim().replace(/\s+/g, '');

const isValidMerchantBindingCode = (value) => /^\d{6}$/.test(normalizeMerchantBindingCode(value));

const generateRandomMerchantBindingCode = () => String(Math.floor(100000 + Math.random() * 900000));

const generateUniqueMerchantBindingCode = async (existsFn, maxAttempts = 30) => {
  for (let index = 0; index < maxAttempts; index += 1) {
    const candidate = generateRandomMerchantBindingCode();
    // existsFn 返回 true 表示该绑定码已被占用，需要继续尝试。
    const exists = await existsFn(candidate);
    if (!exists) {
      return candidate;
    }
  }
  throw new Error('店铺绑定ID生成失败，请稍后重试');
};

module.exports = {
  normalizeMerchantBindingCode,
  isValidMerchantBindingCode,
  generateUniqueMerchantBindingCode
};
