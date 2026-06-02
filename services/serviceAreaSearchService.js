// 这个文件是“服务区域搜索与定位服务”。
// 它主要解决 4 类问题：
// 1. 按关键词搜索乡镇 / 县城
// 2. 根据坐标反查所属区域
// 3. 结合腾讯地图补齐区域中心点
// 4. 给地图搜索 / 地址选择页返回可直接展示的位置候选项
const axios = require('axios');
const { ServiceArea } = require('../models');
const { calculateDistance } = require('../utils/helpers');
const TENCENT_MAP_CONFIG = require('../config/tencentMap');
const { wgs84ToGcj02, gcj02ToWgs84 } = require('../utils/coordTransform');

// ==================== 基础清洗与文本归一化区 ====================
const DEFAULT_LIMIT = 5;

const toFiniteNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const isUsableCoordinate = (lng, lat) => {
  const targetLng = toFiniteNumber(lng);
  const targetLat = toFiniteNumber(lat);
  if (targetLng === null || targetLat === null) {
    return false;
  }
  if (targetLng === 0 && targetLat === 0) {
    return false;
  }
  if (targetLat < 3 || targetLat > 55 || targetLng < 73 || targetLng > 136) {
    return false;
  }
  return true;
};

const stripAreaSuffix = (value) => {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  if (text.endsWith('县城')) {
    return `${text.slice(0, -2)}县`;
  }
  return text.replace(/(街道办事处|办事处|街道|镇|乡)$/u, '').trim();
};

const normalizeAreaText = (value) =>
  stripAreaSuffix(String(value || '').trim())
    .replace(/[省市县区乡镇街道办事处\s·,，、\-()（）]/gu, '')
    .toLowerCase();

const splitAliases = (value) =>
  String(value || '')
    .split(/[,，|]/)
    .map((item) => String(item || '').trim())
    .filter(Boolean);

// ==================== 关键词匹配与区域评分区 ====================
const buildAreaTokens = (area) => {
  const tokens = new Set();
  const areaName = String(area?.area_name || '').trim();
  const baseName = stripAreaSuffix(areaName);

  if (areaName) {
    tokens.add(areaName);
  }
  if (baseName) {
    tokens.add(baseName);
  }
  splitAliases(area?.aliases).forEach((token) => tokens.add(token));
  return Array.from(tokens);
};

const buildKeywordVariants = (keyword, countyTokens = []) => {
  const raw = String(keyword || '').trim();
  const variants = new Set();
  if (!raw) {
    return [];
  }

  variants.add(raw);
  variants.add(stripAreaSuffix(raw));

  for (const countyToken of countyTokens) {
    const countyText = String(countyToken || '').trim();
    if (!countyText) {
      continue;
    }
    if (raw.startsWith(countyText)) {
      variants.add(raw.slice(countyText.length).trim());
    }
    const countyBase = stripAreaSuffix(countyText);
    if (countyBase && raw.startsWith(countyBase)) {
      variants.add(raw.slice(countyBase.length).trim());
    }
  }

  return Array.from(variants)
    .map((item) => String(item || '').trim())
    .filter(Boolean);
};

const scoreAreaMatch = (keywordVariants, area) => {
  const rawAreaName = String(area?.area_name || '').trim();
  const normalizedAreaName = normalizeAreaText(rawAreaName);
  const tokens = buildAreaTokens(area);
  const normalizedTokens = tokens.map((token) => normalizeAreaText(token)).filter(Boolean);
  let bestScore = 0;
  let matchText = '';

  for (const variant of keywordVariants) {
    const variantText = String(variant || '').trim();
    const normalizedVariant = normalizeAreaText(variantText);
    if (!normalizedVariant) {
      continue;
    }

    if (variantText === rawAreaName) {
      return { score: 120, matchText: rawAreaName };
    }
    if (normalizedVariant === normalizedAreaName) {
      bestScore = Math.max(bestScore, 110);
      matchText = rawAreaName;
    }

    for (let index = 0; index < normalizedTokens.length; index += 1) {
      const normalizedToken = normalizedTokens[index];
      if (!normalizedToken) {
        continue;
      }
      const tokenText = tokens[index];

      if (variantText === tokenText) {
        return { score: 105, matchText: tokenText };
      }
      if (normalizedVariant === normalizedToken) {
        bestScore = Math.max(bestScore, 100);
        matchText = tokenText;
        continue;
      }
      if (normalizedToken.startsWith(normalizedVariant)) {
        bestScore = Math.max(bestScore, 90);
        matchText = tokenText;
        continue;
      }
      if (normalizedToken.includes(normalizedVariant) || normalizedVariant.includes(normalizedToken)) {
        bestScore = Math.max(bestScore, 80);
        matchText = tokenText;
      }
    }
  }

  return { score: bestScore, matchText };
};

const buildCountySearchContext = async () => {
  const countyArea = await ServiceArea.findOne({
    where: {
      area_type: 'county',
      is_enabled: true
    },
    order: [
      ['sort_order', 'ASC'],
      ['id', 'ASC']
    ]
  });

  const countyName = String(countyArea?.area_name || '').trim();
  const countyBase = stripAreaSuffix(countyName);
  const countyLabel = countyName.endsWith('县城') ? `${countyName.slice(0, -2)}县` : countyName;
  const countyTokens = [countyName, countyBase, countyLabel].filter(Boolean);

  return {
    countyArea,
    countyLabel: countyLabel || countyBase || countyName,
    countyTokens
  };
};

// ==================== 区域中心点解析区 ====================
// 先尽量用数据库已有中心点，不够再向腾讯地图动态解析，并把结果回写缓存。
const extractPointFromGeocoder = (payload) => {
  const location = payload?.result?.location || payload?.location || null;
  const gcjLat = toFiniteNumber(location?.lat);
  const gcjLng = toFiniteNumber(location?.lng);
  if (gcjLng === null || gcjLat === null) {
    return null;
  }
  return gcj02ToWgs84(gcjLng, gcjLat);
};

const requestAreaCenter = async (keyword) => {
  if (!TENCENT_MAP_CONFIG.key) {
    return null;
  }

  const response = await axios.get(TENCENT_MAP_CONFIG.geocoderUrl, {
    params: {
      key: TENCENT_MAP_CONFIG.key,
      address: keyword,
      output: 'json'
    },
    timeout: TENCENT_MAP_CONFIG.timeoutMs
  });

  if (Number(response?.data?.status) !== 0) {
    throw new Error(response?.data?.message || '腾讯地图地址解析失败');
  }

  return response.data;
};

const requestReverseGeocode = async ({ lng, lat }) => {
  if (!TENCENT_MAP_CONFIG.key) {
    return null;
  }

  const gcjCoord = wgs84ToGcj02(lng, lat);
  if (gcjCoord.lng === null || gcjCoord.lat === null) {
    return null;
  }

  const response = await axios.get(TENCENT_MAP_CONFIG.geocoderUrl, {
    params: {
      key: TENCENT_MAP_CONFIG.key,
      location: `${gcjCoord.lat},${gcjCoord.lng}`,
      get_poi: 1,
      // 地图选址页依赖这里的 POI 做“附近位置”列表。
      // 默认逆地理有时只回地址不回足够 POI，所以这里按外卖收货地址场景扩大半径和数量。
      poi_options: 'address_format=short;radius=1000;page_size=20;page_index=1;policy=2',
      output: 'json'
    },
    timeout: TENCENT_MAP_CONFIG.timeoutMs
  });

  if (Number(response?.data?.status) !== 0) {
    throw new Error(response?.data?.message || '腾讯地图逆地理解析失败');
  }

  return response.data;
};

const resolveAreaCenter = async (area, countyLabel) => {
  const existingLng = toFiniteNumber(area?.center_lng);
  const existingLat = toFiniteNumber(area?.center_lat);
  if (isUsableCoordinate(existingLng, existingLat)) {
    return { lng: existingLng, lat: existingLat, source: 'db_cache' };
  }

  if (!TENCENT_MAP_CONFIG.key) {
    return { lng: null, lat: null, source: 'missing_key' };
  }

  const keywords = Array.from(
    new Set(
      [
        countyLabel ? `${countyLabel}${area.area_name}` : '',
        area.area_name,
        countyLabel ? `${countyLabel}${stripAreaSuffix(area.area_name)}` : ''
      ].filter(Boolean)
    )
  );

  for (const keyword of keywords) {
    try {
      const payload = await requestAreaCenter(keyword);
      const point = extractPointFromGeocoder(payload);
      if (!point) {
        continue;
      }
      if (!isUsableCoordinate(point.lng, point.lat)) {
        continue;
      }

      await area.update({
        center_lng: point.lng,
        center_lat: point.lat
      });

      return {
        lng: point.lng,
        lat: point.lat,
        source: 'tencent_geocoder'
      };
    } catch (error) {
      console.warn('[AreaSearch] 动态解析中心点失败', {
        area_name: area.area_name,
        keyword,
        message: error.message
      });
    }
  }

  return { lng: null, lat: null, source: 'unresolved' };
};

// ==================== 关键词搜索区域区 ====================
const searchAreas = async ({ keyword, areaType = 'town', limit = DEFAULT_LIMIT }) => {
  const keywordText = String(keyword || '').trim();
  if (!keywordText) {
    return [];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 10);
  const { countyLabel, countyTokens } = await buildCountySearchContext();
  const keywordVariants = buildKeywordVariants(keywordText, countyTokens);

  const areas = await ServiceArea.findAll({
    where: {
      area_type: areaType,
      is_enabled: true
    },
    order: [
      ['sort_order', 'ASC'],
      ['id', 'ASC']
    ]
  });

  const matchedAreas = areas
    .map((area) => {
      const { score, matchText } = scoreAreaMatch(keywordVariants, area);
      return { area, score, matchText };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.area.sort_order - b.area.sort_order)
    .slice(0, safeLimit);

  const resolvedAreas = [];
  for (const item of matchedAreas) {
    const center = await resolveAreaCenter(item.area, countyLabel);
    resolvedAreas.push({
      area_code: item.area.area_code,
      area_name: item.area.area_name,
      area_type: item.area.area_type,
      parent_code: item.area.parent_code,
      aliases: splitAliases(item.area.aliases),
      center_lng: center.lng,
      center_lat: center.lat,
      center_source: center.source,
      match_score: item.score,
      match_text: item.matchText
    });
  }

  return resolvedAreas;
};

// ==================== 根据坐标反查区域区 ====================
const resolveAreaByCoordinate = async ({
  lng,
  lat,
  areaType = 'town',
  maxDistanceKm = 35
}) => {
  const targetLng = toFiniteNumber(lng);
  const targetLat = toFiniteNumber(lat);

  if (targetLng === null || targetLat === null) {
    return null;
  }

  if (!['county', 'town'].includes(areaType)) {
    return null;
  }

  const { countyLabel } = await buildCountySearchContext();
  const areas = await ServiceArea.findAll({
    where: {
      area_type: areaType,
      is_enabled: true
    },
    order: [
      ['sort_order', 'ASC'],
      ['id', 'ASC']
    ]
  });

  let bestMatch = null;
  for (const area of areas) {
    const center = await resolveAreaCenter(area, countyLabel);
    if (center.lng === null || center.lat === null) {
      continue;
    }

    const distanceKm = calculateDistance(targetLat, targetLng, center.lat, center.lng);
    if (!Number.isFinite(distanceKm)) {
      continue;
    }

    if (!bestMatch || distanceKm < bestMatch.distance_km) {
      bestMatch = {
        area_code: area.area_code,
        area_name: area.area_name,
        area_type: area.area_type,
        parent_code: area.parent_code,
        aliases: splitAliases(area.aliases),
        center_lng: center.lng,
        center_lat: center.lat,
        center_source: center.source,
        distance_km: distanceKm
      };
    }
  }

  if (!bestMatch) {
    return null;
  }

  if (Number.isFinite(maxDistanceKm) && bestMatch.distance_km > maxDistanceKm) {
    return null;
  }

  const confidence =
    bestMatch.distance_km <= 3 ? 'high'
      : bestMatch.distance_km <= 8 ? 'medium'
        : 'low';

  return {
    ...bestMatch,
    matched_by: 'nearest_center',
    confidence
  };
};

// ==================== 逆地理结果清洗区 ====================
const reverseGeocodeText = (payload, ...paths) => {
  for (const path of paths) {
    let value = payload;
    for (const key of path) {
      value = value?.[key];
    }
    const text = String(value || '').trim();
    if (text) {
      return text;
    }
  }
  return '';
};

const extractReversePois = (payload) => {
  const arrays = [
    payload?.result?.pois,
    payload?.pois,
    payload?.regeocode?.pois,
    payload?.data?.pois
  ];

  for (const items of arrays) {
    if (Array.isArray(items) && items.length) {
      return items;
    }
  }

  return [];
};

const cleanupLocationSummary = (value) => {
  let text = String(value || '').trim();
  if (!text) {
    return '';
  }

  text = text
    .replace(/^(中国)?(河南省)?(信阳市)?(固始县(城)?)?/u, '')
    .replace(/[，,]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

  if (!text) {
    return '';
  }

  const townMatch = text.match(/([\u4e00-\u9fa5]{2,20}(镇|乡))/u);
  if (townMatch) {
    return townMatch[1];
  }

  const roadMatch = text.match(/([\u4e00-\u9fa5A-Za-z0-9]{2,30}(大道|路|街道|街|巷))/u);
  if (roadMatch) {
    return roadMatch[1];
  }

  text = text
    .replace(/\d+号.*$/u, '')
    .replace(/\d+栋.*$/u, '')
    .replace(/\d+单元.*$/u, '')
    .replace(/\d+室.*$/u, '')
    .replace(/\d+层.*$/u, '')
    .trim();

  if (/(村|乡道|国道|省道)/u.test(text)) {
    return '';
  }

  return text;
};

const extractTownNameFromText = (value) => {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  const matched = text.match(/([\u4e00-\u9fa5]{2,20}(镇|乡))/u);
  return matched ? matched[1] : '';
};

const buildReverseLocationContext = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const component =
    payload?.results?.[0] ||
    payload?.result?.address_component ||
    payload?.result?.addressComponent ||
    payload?.addressComponent ||
    payload?.regeocode?.addressComponent ||
    payload?.data?.result?.addressComponent ||
    {};

  const pois = extractReversePois(payload);
  const poiName = cleanupLocationSummary(String(
    pois[0]?.title ||
    pois[0]?.name ||
    pois[0]?.poiName ||
    pois[0]?.addressComponent?.poi ||
    ''
  ).trim());

  const roadName = cleanupLocationSummary(reverseGeocodeText(
    payload,
    ['results', 0, 'address'],
    ['results', 0, 'address_all'],
    ['result', 'road'],
    ['result', 'address_reference', 'street', 'title'],
    ['result', 'address_reference', 'landmark_l1', 'title'],
    ['result', 'address_reference', 'landmark_l2', 'title'],
    ['road'],
    ['regeocode', 'road'],
    ['result', 'nearestRoad']
  ));

  const streetName = cleanupLocationSummary(String(
    component.street ||
    component.streetName ||
    component.road ||
    component.street_number?.street ||
    ''
  ).trim());

  const formattedAddress = reverseGeocodeText(
    payload,
    ['results', 0, 'address_all'],
    ['results', 0, 'address'],
    ['result', 'formatted_addresses', 'recommend'],
    ['result', 'formatted_addresses', 'rough'],
    ['result', 'formatted_address'],
    ['result', 'address'],
    ['formatted_address'],
    ['address'],
    ['regeocode', 'formatted_address'],
    ['data', 'result', 'formatted_address']
  );

  const townName = cleanupLocationSummary(String(
    component.town ||
    component.township ||
    component.townName ||
    payload?.result?.address_reference?.town?.title ||
    component['乡镇'] ||
    ''
  ).trim());

  const countyName = cleanupLocationSummary(String(
    component.county ||
    component.district ||
    component.city ||
    component.area ||
    ''
  ).trim());

  const summaryCandidates = [
    townName,
    streetName,
    roadName,
    poiName ? `${poiName}附近` : '',
    cleanupLocationSummary(formattedAddress),
    countyName
  ].filter(Boolean);

  const locationSummary = summaryCandidates[0] || '';
  const explicitTownName =
    extractTownNameFromText(townName) ||
    extractTownNameFromText(formattedAddress) ||
    extractTownNameFromText(locationSummary);

  return {
    town_name: explicitTownName || '',
    county_name: countyName,
    street_name: streetName,
    road_name: roadName,
    poi_name: poiName,
    formatted_address: formattedAddress,
    location_summary: locationSummary
  };
};

// ==================== 位置上下文推导区 ====================
// 这一段会把“最近区域 + 逆地理结果 + 县城兜底”整合成前端真正要的地址上下文。
const findAreaByKeyword = async ({ keyword, areaType }) => {
  const [matched] = await searchAreas({
    keyword,
    areaType,
    limit: 1
  });

  if (!matched || Number(matched.match_score || 0) < 80) {
    return null;
  }

  return matched;
};

const buildResolvedLocationContext = ({
  resolvedArea,
  reverseContext,
  countyArea
}) => {
  if (!resolvedArea && !reverseContext && !countyArea) {
    return null;
  }

  const finalArea = resolvedArea || countyArea || {};
  const finalAreaType = String(finalArea.area_type || countyArea?.area_type || 'county').trim() || 'county';
  const finalAreaName = String(finalArea.area_name || countyArea?.area_name || '').trim();
  const finalCountyCode =
    finalAreaType === 'county'
      ? String(finalArea.area_code || countyArea?.area_code || '').trim()
      : String(finalArea.parent_code || countyArea?.area_code || '').trim();
  const finalCountyName =
    finalAreaType === 'county'
      ? finalAreaName
      : String(countyArea?.area_name || '').trim();
  const finalTownCode = finalAreaType === 'town' ? String(finalArea.area_code || '').trim() : '';
  const finalTownName = finalAreaType === 'town' ? finalAreaName : '';
  const locationSummary =
    finalTownName ||
    reverseContext?.location_summary ||
    cleanupLocationSummary(finalAreaName) ||
    cleanupLocationSummary(finalCountyName);

  return {
    area_code: String(finalArea.area_code || countyArea?.area_code || '').trim() || null,
    area_name: finalAreaName || null,
    area_type: finalAreaType,
    parent_code: String(finalArea.parent_code || '').trim() || null,
    aliases: Array.isArray(finalArea.aliases) ? finalArea.aliases : splitAliases(finalArea.aliases),
    center_lng: finalArea.center_lng ?? null,
    center_lat: finalArea.center_lat ?? null,
    center_source: finalArea.center_source || null,
    distance_km: finalArea.distance_km ?? null,
    matched_by: finalArea.matched_by || (finalTownName ? 'reverse_geocode' : 'county_fallback'),
    confidence: finalArea.confidence || (finalTownName ? 'high' : 'medium'),
    county_code: finalCountyCode || null,
    county_name: finalCountyName || null,
    town_code: finalTownCode || null,
    town_name: finalTownName || null,
    location_summary: locationSummary || null,
    summary: locationSummary || null,
    display_name: locationSummary || finalAreaName || finalCountyName || null,
    street_name: reverseContext?.street_name || null,
    street: reverseContext?.street_name || null,
    road_name: reverseContext?.road_name || null,
    road: reverseContext?.road_name || null,
    poi_name: reverseContext?.poi_name || null,
    poi: reverseContext?.poi_name || null,
    formatted_address: reverseContext?.formatted_address || null,
    address: reverseContext?.formatted_address || null
  };
};

const resolveLocationContextByCoordinate = async ({
  lng,
  lat,
  areaType = 'auto'
}) => {
  const targetLng = toFiniteNumber(lng);
  const targetLat = toFiniteNumber(lat);

  if (targetLng === null || targetLat === null) {
    return null;
  }

  if (!['auto', 'county', 'town'].includes(areaType)) {
    return null;
  }

  const { countyArea } = await buildCountySearchContext();
  let reverseContext = null;

  if (TENCENT_MAP_CONFIG.key) {
    try {
      const payload = await requestReverseGeocode({ lng: targetLng, lat: targetLat });
      reverseContext = buildReverseLocationContext(payload);
    } catch (error) {
      console.warn('[AreaSearch] 逆地理解析失败', {
        lng: targetLng,
        lat: targetLat,
        message: error.message
      });
    }
  }

  if (areaType === 'county') {
    const countyResolved = await resolveAreaByCoordinate({
      lng: targetLng,
      lat: targetLat,
      areaType: 'county',
      maxDistanceKm: Number.POSITIVE_INFINITY
    });
    return buildResolvedLocationContext({
      resolvedArea: countyResolved || countyArea,
      reverseContext,
      countyArea
    });
  }

  if (areaType === 'town') {
    const townResolved = await resolveAreaByCoordinate({
      lng: targetLng,
      lat: targetLat,
      areaType: 'town'
    });
    if (!townResolved) {
      return null;
    }
    return buildResolvedLocationContext({
      resolvedArea: townResolved,
      reverseContext,
      countyArea
    });
  }

  const explicitTownName = reverseContext?.town_name || '';
  let resolvedTown = null;

  if (explicitTownName) {
    resolvedTown = await findAreaByKeyword({
      keyword: explicitTownName,
      areaType: 'town'
    });
  }

  if (!resolvedTown) {
    resolvedTown = await resolveAreaByCoordinate({
      lng: targetLng,
      lat: targetLat,
      areaType: 'town',
      maxDistanceKm: 12
    });
  }

  if (resolvedTown) {
    return buildResolvedLocationContext({
      resolvedArea: resolvedTown,
      reverseContext,
      countyArea
    });
  }

  const countyResolved = await resolveAreaByCoordinate({
    lng: targetLng,
    lat: targetLat,
    areaType: 'county',
    maxDistanceKm: Number.POSITIVE_INFINITY
  });

  return buildResolvedLocationContext({
    resolvedArea: countyResolved || countyArea,
    reverseContext,
    countyArea
  });
};

const reverseGeocodeByCoordinate = async ({ lng, lat }) => {
  const targetLng = toFiniteNumber(lng);
  const targetLat = toFiniteNumber(lat);

  if (targetLng === null || targetLat === null) {
    return null;
  }

  return requestReverseGeocode({
    lng: targetLng,
    lat: targetLat
  });
};

// ==================== 腾讯地图地点联想 / 搜索区 ====================
const clampLimit = (value, fallback = 8, max = 12) => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.min(Math.max(Math.floor(num), 1), max);
};

const buildItemAddress = (...parts) =>
  Array.from(new Set(parts.map((item) => String(item || '').trim()).filter(Boolean))).join('');

const normalizeTencentLocationItem = (item, source) => {
  const gcjLng = toFiniteNumber(item?.location?.lng);
  const gcjLat = toFiniteNumber(item?.location?.lat);
  const wgsPoint =
    gcjLng !== null && gcjLat !== null ? gcj02ToWgs84(gcjLng, gcjLat) : { lng: null, lat: null };
  const title = String(item?.title || item?.name || '').trim();
  const address = String(item?.address || item?.addr || '').trim();
  const district = String(item?.district || item?.ad_info?.district || '').trim();
  const city = String(item?.city || item?.ad_info?.city || '').trim();
  const province = String(item?.province || item?.ad_info?.province || '').trim();
  const town =
    extractTownNameFromText(title) ||
    extractTownNameFromText(address) ||
    extractTownNameFromText(district);

  return {
    id: String(item?.id || item?.uid || '').trim(),
    title,
    address: address || buildItemAddress(province, city, district, town),
    province,
    city,
    district,
    town,
    type: String(item?.category || item?.type || '').trim(),
    adcode: String(item?.adcode || item?.ad_info?.adcode || '').trim(),
    longitude: toFiniteNumber(wgsPoint.lng),
    latitude: toFiniteNumber(wgsPoint.lat),
    gcj_longitude: gcjLng,
    gcj_latitude: gcjLat,
    source
  };
};

const buildAreaSuggestionItems = async ({ keyword, limit, region }) => {
  const safeLimit = clampLimit(limit, 5, 10);
  const areaItems = await searchAreas({
    keyword,
    areaType: 'town',
    limit: safeLimit
  });

  return areaItems
    .filter((item) => isUsableCoordinate(item.center_lng, item.center_lat))
    .map((item) => {
      const gcjPoint = wgs84ToGcj02(item.center_lng, item.center_lat);
      return {
        id: String(item.area_code || '').trim(),
        title: String(item.area_name || '').trim(),
        address: buildItemAddress(region, item.area_name),
        province: '河南省',
        city: '信阳市',
        district: String(region || '').trim(),
        town: String(item.area_name || '').trim(),
        type: '行政区',
        adcode: String(item.area_code || '').trim(),
        longitude: toFiniteNumber(item.center_lng),
        latitude: toFiniteNumber(item.center_lat),
        gcj_longitude: toFiniteNumber(gcjPoint.lng),
        gcj_latitude: toFiniteNumber(gcjPoint.lat),
        source: 'service_area'
      };
    });
};

const dedupeLocationItems = (items, limit) => {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const title = String(item?.title || '').trim();
    const address = String(item?.address || '').trim();
    const lng = toFiniteNumber(item?.gcj_longitude ?? item?.longitude);
    const lat = toFiniteNumber(item?.gcj_latitude ?? item?.latitude);
    if (!title || !isUsableCoordinate(lng, lat)) {
      continue;
    }
    const key = `${title}|${address}|${lng.toFixed(5)}|${lat.toFixed(5)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
    if (result.length >= limit) {
      break;
    }
  }

  return result;
};

const resolveSearchRegion = async (region) => {
  const regionText = String(region || '').trim();
  if (regionText) {
    return regionText;
  }
  const { countyLabel } = await buildCountySearchContext();
  return countyLabel || '固始县';
};

const requestTencentSuggestionItems = async ({ keyword, region, lng, lat }) => {
  if (!TENCENT_MAP_CONFIG.key) {
    return [];
  }

  const params = {
    key: TENCENT_MAP_CONFIG.key,
    keyword: String(keyword || '').trim(),
    region: String(region || '').trim(),
    region_fix: 1,
    output: 'json'
  };

  const gcjPoint = wgs84ToGcj02(lng, lat);
  if (gcjPoint.lng !== null && gcjPoint.lat !== null) {
    params.location = `${gcjPoint.lat},${gcjPoint.lng}`;
  }

  const response = await axios.get(TENCENT_MAP_CONFIG.placeSuggestionUrl, {
    params,
    timeout: TENCENT_MAP_CONFIG.timeoutMs
  });

  if (Number(response?.data?.status) !== 0) {
    throw new Error(response?.data?.message || '腾讯地图联想搜索失败');
  }

  return Array.isArray(response?.data?.data) ? response.data.data : [];
};

const requestTencentSearchItems = async ({ keyword, region, lng, lat, pageSize }) => {
  if (!TENCENT_MAP_CONFIG.key) {
    return [];
  }

  const safePageSize = clampLimit(pageSize, 10, 20);
  const params = {
    key: TENCENT_MAP_CONFIG.key,
    keyword: String(keyword || '').trim(),
    page_size: safePageSize,
    output: 'json'
  };

  const gcjPoint = wgs84ToGcj02(lng, lat);
  if (gcjPoint.lng !== null && gcjPoint.lat !== null) {
    params.boundary = `nearby(${gcjPoint.lat},${gcjPoint.lng},50000,1)`;
  } else {
    params.boundary = `region(${String(region || '').trim()},0)`;
  }

  const response = await axios.get(TENCENT_MAP_CONFIG.placeSearchUrl, {
    params,
    timeout: TENCENT_MAP_CONFIG.timeoutMs
  });

  if (Number(response?.data?.status) !== 0) {
    throw new Error(response?.data?.message || '腾讯地图地点搜索失败');
  }

  return Array.isArray(response?.data?.data) ? response.data.data : [];
};

const DEFAULT_NEARBY_KEYWORDS = ['小区', '学校', '超市', '村'];

const normalizeNearbyKeywords = (keywords) => {
  const rawList = Array.isArray(keywords)
    ? keywords
    : String(keywords || '').split(/[,\s，、|]+/);
  const list = rawList
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 4);
  return list.length ? Array.from(new Set(list)) : DEFAULT_NEARBY_KEYWORDS;
};

const clampNearbyRadius = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 1500;
  }
  return Math.min(Math.max(Math.floor(num), 200), 5000);
};

const requestTencentNearbyItems = async ({ keyword, lng, lat, pageSize, radius }) => {
  if (!TENCENT_MAP_CONFIG.key) {
    return [];
  }

  const gcjPoint = wgs84ToGcj02(lng, lat);
  if (gcjPoint.lng === null || gcjPoint.lat === null) {
    return [];
  }

  const response = await axios.get(TENCENT_MAP_CONFIG.placeSearchUrl, {
    params: {
      key: TENCENT_MAP_CONFIG.key,
      keyword: String(keyword || '').trim(),
      boundary: `nearby(${gcjPoint.lat},${gcjPoint.lng},${clampNearbyRadius(radius)},1)`,
      page_size: clampLimit(pageSize, 5, 10),
      output: 'json'
    },
    timeout: TENCENT_MAP_CONFIG.timeoutMs
  });

  if (Number(response?.data?.status) !== 0) {
    throw new Error(response?.data?.message || '腾讯地图附近位置搜索失败');
  }

  return Array.isArray(response?.data?.data) ? response.data.data : [];
};

const suggestLocations = async ({ keyword, region, lng, lat, limit = 8 }) => {
  const keywordText = String(keyword || '').trim();
  if (!keywordText) {
    return [];
  }

  const safeLimit = clampLimit(limit, 8, 12);
  const regionText = await resolveSearchRegion(region);
  const areaItems = await buildAreaSuggestionItems({
    keyword: keywordText,
    limit: Math.min(safeLimit, 5),
    region: regionText
  });

  let tencentItems = [];
  try {
    tencentItems = (await requestTencentSuggestionItems({
      keyword: keywordText,
      region: regionText,
      lng,
      lat
    })).map((item) => normalizeTencentLocationItem(item, 'tencent_suggestion'));
  } catch (error) {
    console.warn('[AreaSearch] 联想搜索失败', {
      keyword: keywordText,
      region: regionText,
      message: error.message
    });
  }

  return dedupeLocationItems([...areaItems, ...tencentItems], safeLimit);
};

const searchLocations = async ({ keyword, region, lng, lat, limit = 10 }) => {
  const keywordText = String(keyword || '').trim();
  if (!keywordText) {
    return [];
  }

  const safeLimit = clampLimit(limit, 10, 20);
  const regionText = await resolveSearchRegion(region);
  const areaItems = await buildAreaSuggestionItems({
    keyword: keywordText,
    limit: Math.min(safeLimit, 5),
    region: regionText
  });

  let tencentItems = [];
  try {
    tencentItems = (await requestTencentSearchItems({
      keyword: keywordText,
      region: regionText,
      lng,
      lat,
      pageSize: safeLimit
    })).map((item) => normalizeTencentLocationItem(item, 'tencent_search'));
  } catch (error) {
    console.warn('[AreaSearch] 地点搜索失败', {
      keyword: keywordText,
      region: regionText,
      message: error.message
    });
  }

  return dedupeLocationItems([...areaItems, ...tencentItems], safeLimit);
};

const searchNearbyLocations = async ({ lng, lat, keywords, limit = 10, radius = 1500 }) => {
  const targetLng = toFiniteNumber(lng);
  const targetLat = toFiniteNumber(lat);
  if (!isUsableCoordinate(targetLng, targetLat)) {
    return [];
  }

  const safeLimit = clampLimit(limit, 10, 20);
  const keywordList = normalizeNearbyKeywords(keywords);
  const perKeywordLimit = Math.max(3, Math.ceil(safeLimit / Math.min(keywordList.length, 4)));

  // 这个接口只给地图选点页做兜底：逆地理 POI 为空时，按常见收货场景补一批附近地点。
  // 不在每次拖动都强制打多次腾讯接口，避免用户同时在线时把地图服务打得太重。
  const batches = await Promise.all(keywordList.map(async (keyword) => {
    try {
      return (await requestTencentNearbyItems({
        keyword,
        lng: targetLng,
        lat: targetLat,
        pageSize: perKeywordLimit,
        radius
      })).map((item) => normalizeTencentLocationItem(item, 'tencent_nearby'));
    } catch (error) {
      console.warn('[AreaSearch] 附近位置搜索失败', {
        keyword,
        lng: targetLng,
        lat: targetLat,
        message: error.message
      });
      return [];
    }
  }));

  return dedupeLocationItems(batches.flat(), safeLimit);
};

module.exports = {
  searchAreas,
  resolveAreaByCoordinate,
  resolveLocationContextByCoordinate,
  reverseGeocodeByCoordinate,
  suggestLocations,
  searchLocations,
  searchNearbyLocations
};
