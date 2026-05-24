// 这个文件是“路线规划服务”。
// 目前主要封装腾讯地图驾车路线距离，用来给配送费估算、路线距离计算等链路复用。
const axios = require('axios');
const TENCENT_MAP_CONFIG = require('../config/tencentMap');
const { wgs84ToGcj02 } = require('../utils/coordTransform');

// 保留 3 位小数，统一公里值的输出精度。
const round3 = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num * 1000) / 1000 : null;
};

const toFiniteNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const buildCoordText = (lng, lat) => `${lat},${lng}`;

// 把腾讯地图返回的原始距离统一换算成公里。
const normalizeDistanceKm = (rawDistance) => {
  const distance = toFiniteNumber(rawDistance);
  if (distance === null || distance < 0) {
    return null;
  }

  // 腾讯路线规划返回值通常是米；若返回小数公里则直接保留。
  const distanceKm = Number.isInteger(distance) || distance >= 100 ? distance / 1000 : distance;
  return round3(distanceKm);
};

// 不同接口字段名可能不一样，这里统一从响应里尽量取出距离。
const pickDistanceKm = (payload) => {
  const candidates = [
    payload?.result?.routes?.[0]?.distance,
    payload?.result?.routes?.[0]?.dist,
    payload?.result?.elements?.[0]?.distance,
    payload?.result?.distance,
    payload?.routes?.[0]?.distance,
    payload?.routes?.[0]?.dist,
    payload?.route?.distance,
    payload?.route?.dist,
    payload?.distance
  ];

  for (const candidate of candidates) {
    const km = normalizeDistanceKm(candidate);
    if (km !== null) {
      return km;
    }
  }

  return null;
};

// 构造带状态码的路线规划错误。
const buildRouteError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const buildRawPreview = (payload) => {
  if (typeof payload === 'string') {
    return payload.slice(0, 500);
  }
  try {
    return JSON.stringify(payload).slice(0, 500);
  } catch (error) {
    return '[unserializable payload]';
  }
};

// 请求失败时，统一打印一份便于排查的上下文日志。
const logRouteFailure = ({
  stage,
  reason,
  context,
  originLng,
  originLat,
  destLng,
  destLat,
  raw,
  extra
}) => {
  console.error('[TencentRouteError]', {
    stage,
    reason,
    context: context || null,
    start: { lng: originLng, lat: originLat },
    end: { lng: destLng, lat: destLat },
    raw_preview: raw === undefined ? undefined : buildRawPreview(raw),
    extra: extra || null
  });
};

// 这是路线规划主入口。
// 输入起点终点 WGS84 坐标，内部会先转腾讯地图需要的 GCJ02，再请求驾车路线距离。
const getDrivingDistanceKm = async ({ startLng, startLat, endLng, endLat, context }) => {
  if (!TENCENT_MAP_CONFIG.key) {
    logRouteFailure({
      stage: 'config',
      reason: 'missing_key',
      context
    });
    throw buildRouteError('未配置腾讯地图 Key，无法按驾车路线计算配送费', 503);
  }

  const originLng = toFiniteNumber(startLng);
  const originLat = toFiniteNumber(startLat);
  const destLng = toFiniteNumber(endLng);
  const destLat = toFiniteNumber(endLat);
  if (
    originLng === null ||
    originLat === null ||
    destLng === null ||
    destLat === null
  ) {
    logRouteFailure({
      stage: 'validate_coords',
      reason: 'incomplete_coords',
      context,
      originLng,
      originLat,
      destLng,
      destLat
    });
    throw buildRouteError('路线规划坐标不完整', 400);
  }

  const gcjOrigin = wgs84ToGcj02(originLng, originLat);
  const gcjDest = wgs84ToGcj02(destLng, destLat);
  if (
    gcjOrigin.lng === null ||
    gcjOrigin.lat === null ||
    gcjDest.lng === null ||
    gcjDest.lat === null
  ) {
    throw buildRouteError('路线规划坐标转换失败', 400);
  }

  let response;
  try {
    response = await axios.get(TENCENT_MAP_CONFIG.directionDrivingUrl, {
      params: {
        from: buildCoordText(gcjOrigin.lng, gcjOrigin.lat),
        to: buildCoordText(gcjDest.lng, gcjDest.lat),
        key: TENCENT_MAP_CONFIG.key,
        output: 'json'
      },
      timeout: TENCENT_MAP_CONFIG.timeoutMs
    });
  } catch (error) {
    logRouteFailure({
      stage: 'request',
      reason: 'axios_request_failed',
      context,
      originLng,
      originLat,
      destLng,
      destLat,
      extra: {
        message: error.message,
        code: error.code,
        status: error.response?.status
      },
      raw: error.response?.data
    });
    throw buildRouteError(`腾讯地图驾车路线请求失败：${error.message}`, 502);
  }

  if (Number(response?.data?.status) !== 0) {
    logRouteFailure({
      stage: 'api_status',
      reason: 'provider_error',
      context,
      originLng,
      originLat,
      destLng,
      destLat,
      raw: response?.data,
      extra: {
        provider_status: response?.data?.status,
        provider_message: response?.data?.message
      }
    });
    throw buildRouteError(`腾讯地图驾车路线请求失败：${response?.data?.message || '服务返回异常'}`, 502);
  }

  const distanceKm = pickDistanceKm(response?.data);
  if (distanceKm === null) {
    logRouteFailure({
      stage: 'parse_distance',
      reason: 'distance_not_found',
      context,
      originLng,
      originLat,
      destLng,
      destLat,
      raw: response?.data,
      extra: {
        http_status: response?.status
      }
    });
    throw buildRouteError('腾讯地图未返回可用的驾车路线距离', 502);
  }

  return {
    distanceKm,
    raw: response.data
  };
};

module.exports = {
  getDrivingDistanceKm
};
