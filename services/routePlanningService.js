const axios = require('axios');
const TIANDITU_CONFIG = require('../config/tianditu');

const round3 = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num * 1000) / 1000 : null;
};

const toFiniteNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const buildCoordText = (lng, lat) => `${lng},${lat}`;

const buildDrivePostStr = ({ startLng, startLat, endLng, endLat, style }) =>
  JSON.stringify({
    orig: buildCoordText(startLng, startLat),
    dest: buildCoordText(endLng, endLat),
    style: String(style || TIANDITU_CONFIG.driveStyle || '0')
  });

const normalizeDistanceKm = (rawDistance) => {
  const distance = toFiniteNumber(rawDistance);
  if (distance === null || distance < 0) {
    return null;
  }

  // 天地图驾车路线接口通常返回米；若返回小数公里则直接保留。
  const distanceKm = Number.isInteger(distance) || distance >= 100 ? distance / 1000 : distance;
  return round3(distanceKm);
};

const pickDistanceKmFromXml = (xmlText) => {
  if (typeof xmlText !== 'string' || !xmlText.trim()) {
    return null;
  }

  const match = xmlText.match(/<distance>\s*([0-9.]+)\s*<\/distance>/i);
  if (!match || !match[1]) {
    return null;
  }

  return normalizeDistanceKm(match[1]);
};

const pickDistanceKm = (payload) => {
  const xmlDistanceKm = pickDistanceKmFromXml(payload);
  if (xmlDistanceKm !== null) {
    return xmlDistanceKm;
  }

  const candidates = [
    payload?.results?.[0]?.distance,
    payload?.results?.distance,
    payload?.routes?.[0]?.distance,
    payload?.route?.distance,
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
  console.error('[TiandituRouteError]', {
    stage,
    reason,
    context: context || null,
    start: { lng: originLng, lat: originLat },
    end: { lng: destLng, lat: destLat },
    raw_preview: raw === undefined ? undefined : buildRawPreview(raw),
    extra: extra || null
  });
};

const getDrivingDistanceKm = async ({ startLng, startLat, endLng, endLat, context }) => {
  if (!TIANDITU_CONFIG.tk) {
    logRouteFailure({
      stage: 'config',
      reason: 'missing_tk',
      context
    });
    throw buildRouteError('未配置天地图 TK，无法按驾车路线计算配送费', 503);
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

  let response;
  try {
    response = await axios.get(TIANDITU_CONFIG.driveUrl, {
      params: {
        postStr: buildDrivePostStr({
          startLng: originLng,
          startLat: originLat,
          endLng: destLng,
          endLat: destLat
        }),
        type: 'search',
        tk: TIANDITU_CONFIG.tk
      },
      timeout: TIANDITU_CONFIG.timeoutMs
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
    throw buildRouteError(`天地图驾车路线请求失败：${error.message}`, 502);
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
    throw buildRouteError('天地图未返回可用的驾车路线距离', 502);
  }

  return {
    distanceKm,
    raw: response.data
  };
};

module.exports = {
  getDrivingDistanceKm
};
