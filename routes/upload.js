const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { successResponse, errorResponse } = require('../utils/helpers');

// 确保 uploads 目录存在
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置 multer
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
    // 只允许图片
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件！'));
    }
  }
});

// 上传单个图片接口
router.post('/image', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json(errorResponse('请选择要上传的图片'));
    }

    // 拼接图片的访问 URL
    // 注意：这里假设前端通过 /uploads 路径访问图片
    const fileUrl = `/uploads/${req.file.filename}`;

    res.json(successResponse({
      url: fileUrl,
      filename: req.file.filename
    }, '上传成功'));
  } catch (error) {
    res.status(500).json(errorResponse(error.message || '上传失败'));
  }
});

module.exports = router;
