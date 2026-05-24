// 这个文件是“骑手分配服务”。
// 当前主要解决“给某个商家优先挑一个合适骑手”这件事，供订单派单链路复用。
const { User } = require('../models');
const { calculateDistance } = require('../utils/helpers');
const { Op } = require('sequelize');

// 按商家位置挑选一个最近、且最近定位仍然有效的骑手。
const selectRiderForMerchant = async (merchant) => {
  const since = new Date(Date.now() - 10 * 60 * 1000);

  const riders = await User.findAll({
    where: {
      role: 'rider',
      status: 1,
      rider_status: 1
    },
    attributes: [
      'id',
      'nickname',
      'phone',
      'rider_latitude',
      'rider_longitude',
      'rider_location_updated_at'
    ]
  });

  if (!riders.length) return null;

  const merchantLat = Number(merchant?.latitude);
  const merchantLng = Number(merchant?.longitude);
  const hasMerchantPoint = Number.isFinite(merchantLat) && Number.isFinite(merchantLng);

  if (!hasMerchantPoint) return riders[0];

  let best = null;
  for (const r of riders) {
    const lat = Number(r.rider_latitude);
    const lng = Number(r.rider_longitude);
    const updatedAt = r.rider_location_updated_at ? new Date(r.rider_location_updated_at) : null;
    const fresh = updatedAt && updatedAt >= since;
    if (!fresh || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const d = calculateDistance(lat, lng, merchantLat, merchantLng);
    if (d === null) continue;
    if (!best || d < best.distance) best = { rider: r, distance: d };
  }

  if (best) return best.rider;

  const fallback = await User.findOne({
    where: {
      role: 'rider',
      status: 1,
      rider_status: 1,
      rider_location_updated_at: { [Op.gte]: since }
    },
    order: [['rider_location_updated_at', 'DESC']]
  });

  return fallback || riders[0];
};

module.exports = {
  selectRiderForMerchant
};

