const { User } = require('../models');

// 生成订单号
const generateOrderNo = () => {
  const date = new Date();
  const timestamp = date.getTime().toString();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return timestamp + random;
};

// 计算距离（单位：公里）
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  
  const EARTH_RADIUS = 6378.137; // 地球半径（公里）
  
  const radLat1 = lat1 * Math.PI / 180;
  const radLat2 = lat2 * Math.PI / 180;
  const a = radLat1 - radLat2;
  const b = lng1 * Math.PI / 180 - lng2 * Math.PI / 180;
  
  const distance = 2 * Math.asin(
    Math.sqrt(
      Math.pow(Math.sin(a / 2), 2) +
      Math.cos(radLat1) * Math.cos(radLat2) *
      Math.pow(Math.sin(b / 2), 2)
    )
  ) * EARTH_RADIUS;
  
  return parseFloat(distance.toFixed(2));
};

// 生成 JWT Token
const generateToken = (userId) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

// 格式化响应
const successResponse = (data, message = 'success') => {
  return {
    code: 200,
    message,
    data
  };
};

const errorResponse = (message, code = 400) => {
  return {
    code,
    message
  };
};

module.exports = {
  generateOrderNo,
  calculateDistance,
  generateToken,
  successResponse,
  errorResponse
};
