const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const {
  VARIANT_SUFFIXES,
  extractLocalUploadInfo,
  buildVariantUrl
} = require('./imageAssets');

// 这个文件是“图片处理工具”。
// 上传图片后，缩略图 / 列表图 / 详情图这些变体会在这里统一生成。
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');
const WEBP_MIME_TYPE = 'image/webp';
const VARIANT_CONFIGS = {
  [VARIANT_SUFFIXES.thumb]: { width: 200, quality: 72 },
  [VARIANT_SUFFIXES.list]: { width: 480, quality: 78 },
  [VARIANT_SUFFIXES.detail]: { width: 1280, quality: 84 }
};

const ensureUploadsDir = async () => {
  await fsp.mkdir(UPLOADS_DIR, { recursive: true });
};

const toAbsoluteUploadPath = (fileName) => path.join(UPLOADS_DIR, String(fileName || ''));

const fileExists = async (filePath) => {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
};

const normalizeAssetId = (value) => String(value || '').trim().replace(/[^A-Za-z0-9_-]/g, '');

const buildVariantFileName = (assetId, variant) => `${assetId}-${variant}.webp`;

const generateVariantsFromSource = async (sourcePath, assetId) => {
  await ensureUploadsDir();
  const source = sharp(sourcePath, { failOn: 'none' }).rotate();

  for (const [variant, config] of Object.entries(VARIANT_CONFIGS)) {
    const outputPath = toAbsoluteUploadPath(buildVariantFileName(assetId, variant));
    await source
      .clone()
      .resize({
        width: config.width,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({
        quality: config.quality,
        effort: 4
      })
      .toFile(outputPath);
  }
};

const buildProcessedImagePayload = ({ assetId, originalUrl }) => ({
  asset_id: assetId,
  mime_type: WEBP_MIME_TYPE,
  url: buildVariantUrl(assetId, VARIANT_SUFFIXES.detail),
  filename: buildVariantFileName(assetId, VARIANT_SUFFIXES.detail),
  thumb_url: buildVariantUrl(assetId, VARIANT_SUFFIXES.thumb),
  list_url: buildVariantUrl(assetId, VARIANT_SUFFIXES.list),
  detail_url: buildVariantUrl(assetId, VARIANT_SUFFIXES.detail),
  original_url: originalUrl || buildVariantUrl(assetId, VARIANT_SUFFIXES.detail),
  variants: {
    thumb: buildVariantUrl(assetId, VARIANT_SUFFIXES.thumb),
    list: buildVariantUrl(assetId, VARIANT_SUFFIXES.list),
    detail: buildVariantUrl(assetId, VARIANT_SUFFIXES.detail),
    original: originalUrl || buildVariantUrl(assetId, VARIANT_SUFFIXES.detail)
  }
});

const processUploadedImage = async (uploadedFile) => {
  if (!uploadedFile?.path) {
    throw new Error('缺少待处理图片文件');
  }

  await ensureUploadsDir();

  const parsed = path.parse(uploadedFile.filename || uploadedFile.path);
  const assetId = normalizeAssetId(parsed.name);
  if (!assetId) {
    throw new Error('图片文件名无效');
  }

  const originalExt = (parsed.ext || '.jpg').toLowerCase();
  const originalFileName = `${assetId}-${VARIANT_SUFFIXES.original}${originalExt}`;
  const originalPath = toAbsoluteUploadPath(originalFileName);

  if (path.resolve(uploadedFile.path) !== path.resolve(originalPath)) {
    await fsp.rename(uploadedFile.path, originalPath);
  }

  await generateVariantsFromSource(originalPath, assetId);

  return buildProcessedImagePayload({
    assetId,
    originalUrl: `/uploads/${originalFileName}`
  });
};

const ensureVariantsForLocalUploadUrl = async (url) => {
  const info = extractLocalUploadInfo(url);
  if (!info.isLocalUpload || !info.fileName) {
    return null;
  }

  const sourcePath = toAbsoluteUploadPath(info.fileName);
  if (!(await fileExists(sourcePath))) {
    return null;
  }

  const assetId = normalizeAssetId(info.assetId || path.parse(info.fileName).name);
  if (!assetId) {
    return null;
  }

  const requiredVariants = Object.keys(VARIANT_CONFIGS).map((variant) =>
    toAbsoluteUploadPath(buildVariantFileName(assetId, variant))
  );
  const variantExistence = await Promise.all(requiredVariants.map((filePath) => fileExists(filePath)));
  const shouldGenerate = variantExistence.some((exists) => !exists);

  if (shouldGenerate) {
    await generateVariantsFromSource(sourcePath, assetId);
  }

  return buildProcessedImagePayload({
    assetId,
    originalUrl: info.rawUrl
  });
};

module.exports = {
  UPLOADS_DIR,
  processUploadedImage,
  ensureVariantsForLocalUploadUrl,
  buildVariantFileName
};
