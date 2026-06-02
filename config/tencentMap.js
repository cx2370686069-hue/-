// 这个文件是“腾讯地图接口配置”。
// 路线规划、逆地理解析、地点联想这些能力，最终都会从这里拿 key 和接口地址。
const toPositiveNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

// 地址和超时时间都支持环境变量覆盖，方便以后切正式 key、代理地址或超时策略。
module.exports = {
  key: String(process.env.TENCENT_MAP_KEY || process.env.QQ_MAP_KEY || '').trim(),
  directionDrivingUrl: String(
    process.env.TENCENT_DIRECTION_DRIVING_URL || 'https://apis.map.qq.com/ws/direction/v1/driving/'
  ).trim(),
  // 骑手真实导航现在走的是腾讯原生“骑行”模式。
  // 总览图蓝线如果还拿驾车接口去画，就会和原生导航路线对不上。
  directionBicyclingUrl: String(
    process.env.TENCENT_DIRECTION_BICYCLING_URL || 'https://apis.map.qq.com/ws/direction/v1/bicycling/'
  ).trim(),
  geocoderUrl: String(
    process.env.TENCENT_GEOCODER_URL || 'https://apis.map.qq.com/ws/geocoder/v1/'
  ).trim(),
  placeSuggestionUrl: String(
    process.env.TENCENT_PLACE_SUGGESTION_URL || 'https://apis.map.qq.com/ws/place/v1/suggestion/'
  ).trim(),
  placeSearchUrl: String(
    process.env.TENCENT_PLACE_SEARCH_URL || 'https://apis.map.qq.com/ws/place/v1/search/'
  ).trim(),
  timeoutMs: toPositiveNumber(process.env.TENCENT_MAP_TIMEOUT_MS, 8000)
};
