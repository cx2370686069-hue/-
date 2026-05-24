// 这个文件是“坐标系转换工具”。
// 主要负责 WGS84 和 GCJ02 之间的转换，地图搜索、路线规划、区域反查都会复用这里。
const PI = Math.PI;
const A = 6378245.0;
const EE = 0.00669342162296594323;

const isFiniteCoordinate = (value) => Number.isFinite(Number(value));

const isOutOfChina = (lng, lat) => {
  if (!isFiniteCoordinate(lng) || !isFiniteCoordinate(lat)) {
    return true;
  }
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
};

const transformLat = (x, y) => {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320.0 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0;
  return ret;
};

const transformLng = (x, y) => {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0;
  return ret;
};

const wgs84ToGcj02 = (lng, lat) => {
  const rawLng = Number(lng);
  const rawLat = Number(lat);
  if (!Number.isFinite(rawLng) || !Number.isFinite(rawLat)) {
    return { lng: null, lat: null };
  }
  if (isOutOfChina(rawLng, rawLat)) {
    return { lng: rawLng, lat: rawLat };
  }
  let dLat = transformLat(rawLng - 105.0, rawLat - 35.0);
  let dLng = transformLng(rawLng - 105.0, rawLat - 35.0);
  const radLat = (rawLat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return {
    lng: rawLng + dLng,
    lat: rawLat + dLat
  };
};

const gcj02ToWgs84 = (lng, lat) => {
  const rawLng = Number(lng);
  const rawLat = Number(lat);
  if (!Number.isFinite(rawLng) || !Number.isFinite(rawLat)) {
    return { lng: null, lat: null };
  }
  if (isOutOfChina(rawLng, rawLat)) {
    return { lng: rawLng, lat: rawLat };
  }
  const converted = wgs84ToGcj02(rawLng, rawLat);
  return {
    lng: rawLng * 2 - converted.lng,
    lat: rawLat * 2 - converted.lat
  };
};

module.exports = {
  isOutOfChina,
  wgs84ToGcj02,
  gcj02ToWgs84
};
