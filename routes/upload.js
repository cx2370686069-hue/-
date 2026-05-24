// 这个文件是“上传路由入口”。
// 当前主要提供图片上传能力，并在上传成功后统一返回图片资源地址和不同尺寸变体。
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { successResponse, errorResponse } = require('../utils/helpers');
const { processUploadedImage } = require('../utils/imageProcessor');

// 启动时先确保 uploads(上传目录) 存在，避免第一次上传时因为目录缺失直接报错。
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 这里配置 multer(上传中间件) 的落盘目录和文件命名规则。
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 限制 5MB
  },
  fileFilter: (req, file, cb) => {
    // 当前上传入口只允许图片文件通过。
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件！'));
    }
  }
});

// 上传单张图片。
// 上传成功后会顺手做图片处理，并返回原图、缩略图、列表图、详情图等资源地址。
router.post('/image', upload.single('file'), (req, res) => {
  Promise.resolve().then(async () => {
    if (!req.file) {
      return res.status(400).json(errorResponse('请选择要上传的图片'));
    }
    const processed = await processUploadedImage(req.file);
    res.json(successResponse({
      url: processed.url,
      filename: processed.filename,
      asset_id: processed.asset_id,
      mime_type: processed.mime_type,
      thumb_url: processed.thumb_url,
      list_url: processed.list_url,
      detail_url: processed.detail_url,
      original_url: processed.original_url,
      variants: processed.variants
    }, '上传成功'));
  }).catch((error) => {
    res.status(500).json(errorResponse(error.message || '上传失败'));
  });
});

module.exports = router;
