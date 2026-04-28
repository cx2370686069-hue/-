const toPositiveNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

module.exports = {
  tk: String(process.env.TIANDITU_TK || process.env.TIANDITU_KEY || '').trim(),
  driveUrl: String(process.env.TIANDITU_DRIVE_URL || 'https://api.tianditu.gov.cn/drive').trim(),
  timeoutMs: toPositiveNumber(process.env.TIANDITU_TIMEOUT_MS, 8000),
  driveStyle: String(process.env.TIANDITU_DRIVE_STYLE || '0').trim() || '0'
};
