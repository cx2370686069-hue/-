const axios = require('axios');

const buildDispatchOrderPayload = ({ order, merchant }) => {
  return {
    id: String(order.id),
    restaurant: merchant?.name || '',
    restaurant_lat: merchant?.latitude ?? null,
    restaurant_lon: merchant?.longitude ?? null,
    customer_town: order.customer_town || '',
    // 兼容前端可能传入的 customer_lat 和 delivery_latitude
    customer_lat: order.customer_lat ?? order.delivery_latitude ?? null,
    customer_lon: order.customer_lng ?? order.delivery_longitude ?? null,
    order_type: order.order_type || 'county',
    products_info: order.products_info || '[]' // 确保商品信息推给调度中心
  };
};

const pushOrderToDispatchCenter = async ({ order, merchant }) => {
  const baseUrl = process.env.DISPATCH_CENTER_BASE_URL;
  if (!baseUrl) {
    const err = new Error('未配置调度中心地址');
    err.statusCode = 500;
    throw err;
  }

  const payload = buildDispatchOrderPayload({ order, merchant });
  if (!payload.restaurant || !payload.customer_town) {
    const err = new Error('推送调度中心缺少必要字段');
    err.statusCode = 400;
    throw err;
  }

  const url = `${baseUrl.replace(/\/$/, '')}/api/orders`;
  const timeoutMs = Number(process.env.DISPATCH_CENTER_TIMEOUT_MS || 5000);

  const res = await axios.post(url, payload, {
    timeout: timeoutMs
  });

  return res.data;
};

module.exports = {
  pushOrderToDispatchCenter
};

