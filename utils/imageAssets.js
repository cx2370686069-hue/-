const path = require('path');

// 这个文件是“图片资源地址工具”。
// 本地上传图片经过处理后，会生成 thumb/list/detail/original 这些变体，
// 这里负责把原始存储值整理成前端真正能用的资源地址集合。
const VARIANT_SUFFIXES = {
  thumb: 'thumb',
  list: 'list',
  detail: 'detail',
  original: 'original'
};

const VARIANT_SUFFIX_SET = new Set(Object.values(VARIANT_SUFFIXES));

const normalizeUrlText = (value) => String(value || '').trim();

const toPublicUploadUrl = (fileName) => {
  const normalized = String(fileName || '').replace(/\\/g, '/').replace(/^\/+/, '');
  return normalized ? `/uploads/${normalized}` : '';
};

const extractPathname = (value) => {
  const text = normalizeUrlText(value);
  if (!text) {
    return '';
  }
  if (text.startsWith('/')) {
    return text;
  }
  try {
    const parsed = new URL(text);
    return parsed.pathname || '';
  } catch (error) {
    return text;
  }
};

const extractLocalUploadInfo = (value) => {
  const rawUrl = normalizeUrlText(value);
  if (!rawUrl) {
    return {
      rawUrl: '',
      isLocalUpload: false,
      pathname: '',
      fileName: '',
      assetId: '',
      variant: '',
      extension: ''
    };
  }

  const pathname = extractPathname(rawUrl);
  const normalizedPath = pathname.replace(/\\/g, '/');
  const marker = '/uploads/';
  const markerIndex = normalizedPath.indexOf(marker);
  if (markerIndex === -1) {
    return {
      rawUrl,
      isLocalUpload: false,
      pathname,
      fileName: '',
      assetId: '',
      variant: '',
      extension: path.extname(normalizedPath || '')
    };
  }

  const fileName = normalizedPath.slice(markerIndex + marker.length);
  const parsed = path.posix.parse(fileName);
  const stemParts = String(parsed.name || '').split('-');
  const lastPart = stemParts[stemParts.length - 1];
  const variant = VARIANT_SUFFIX_SET.has(lastPart) ? lastPart : '';
  const assetId = variant ? stemParts.slice(0, -1).join('-') : parsed.name;

  return {
    rawUrl,
    isLocalUpload: true,
    pathname,
    fileName,
    assetId,
    variant,
    extension: parsed.ext || ''
  };
};

const buildVariantUrl = (assetId, variant) => {
  if (!assetId || !variant) {
    return '';
  }
  return toPublicUploadUrl(`${assetId}-${variant}.webp`);
};

const buildImageAssetUrls = (value) => {
  const info = extractLocalUploadInfo(value);
  if (!info.rawUrl) {
    return {
      raw: '',
      thumb: '',
      list: '',
      detail: '',
      original: '',
      best: ''
    };
  }

  if (!info.isLocalUpload || !info.assetId || !info.variant) {
    return {
      raw: info.rawUrl,
      thumb: info.rawUrl,
      list: info.rawUrl,
      detail: info.rawUrl,
      original: info.rawUrl,
      best: info.rawUrl
    };
  }

  const thumb = buildVariantUrl(info.assetId, VARIANT_SUFFIXES.thumb);
  const list = buildVariantUrl(info.assetId, VARIANT_SUFFIXES.list);
  const detail = buildVariantUrl(info.assetId, VARIANT_SUFFIXES.detail);
  const original =
    info.variant === VARIANT_SUFFIXES.original
      ? info.rawUrl
      : info.rawUrl;

  return {
    raw: info.rawUrl,
    thumb,
    list,
    detail,
    original,
    best: detail || list || thumb || info.rawUrl
  };
};

const normalizeImageItem = (item) => {
  if (typeof item === 'string') {
    return normalizeUrlText(item);
  }
  if (item && typeof item === 'object') {
    return normalizeUrlText(item.url || item.detail || item.src || item.path || '');
  }
  return '';
};

const parseStoredImageList = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeImageItem).filter(Boolean);
  }

  if (value && typeof value === 'object') {
    const single = normalizeImageItem(value);
    return single ? [single] : [];
  }

  const text = normalizeUrlText(value);
  if (!text) {
    return [];
  }

  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeImageItem).filter(Boolean);
      }
    } catch (error) {
      // Fall through to other string parsing logic.
    }
  }

  if (text.includes(',')) {
    return text
      .split(',')
      .map((item) => normalizeUrlText(item))
      .filter(Boolean);
  }

  return [text];
};

const buildImageAssetList = (value) =>
  parseStoredImageList(value).map((url) => ({
    url,
    ...buildImageAssetUrls(url)
  }));

const serializeImageList = (value) => JSON.stringify(parseStoredImageList(value));

module.exports = {
  VARIANT_SUFFIXES,
  toPublicUploadUrl,
  extractLocalUploadInfo,
  buildVariantUrl,
  buildImageAssetUrls,
  parseStoredImageList,
  buildImageAssetList,
  serializeImageList
};
