// 这个文件是“商家端推送设备控制器”。
// 商家端把当前设备的 push client_id 绑定到店铺和账号上，主要走这里。
const { Merchant, MerchantPushDevice } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');

// 文本统一先做去空格处理。
function safeTrim(value) {
  return String(value || '').trim();
}

// 应用 app_id 统一先做去空格处理。
// 这次专门把它单独拎出来，是因为后端后面要靠 app_id 把“商家端设备”和“其他端设备”隔离开。
function normalizeAppId(value) {
  return safeTrim(value);
}

// 平台只接受 android / ios，传错时默认按 android 兜底。
function normalizePlatform(value) {
  const normalized = safeTrim(value).toLowerCase();
  if (['android', 'ios'].includes(normalized)) {
    return normalized;
  }
  return 'android';
}

// App 前后台状态统一收口，便于后面做推送策略判断。
function normalizeAppState(value) {
  const normalized = safeTrim(value).toLowerCase();
  if (['foreground', 'background'].includes(normalized)) {
    return normalized;
  }
  return 'unknown';
}

// 前端传来的开关值可能是布尔、数字或字符串，这里统一转成 true / false。
function toBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = safeTrim(value).toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return fallback;
}

// 按当前登录商家账号，找到“他自己的店铺”。
async function findOwnedMerchant(userId) {
  return Merchant.findOne({
    where: { user_id: userId },
    attributes: ['id', 'user_id', 'name']
  });
}

/**
 * 注册 / 更新推送设备
 * 新版开始不再只按 client_id 识别，而是按 client_id + app_id 收口。
 * 这样做是为了把不同应用端的设备彻底隔离开，避免历史错误绑定把商家推送串到别的端。
 */
exports.registerDevice = async (req, res, next) => {
  try {
    const userId = Number(req.user && req.user.id);
    const merchant = await findOwnedMerchant(userId);
    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const clientId = safeTrim(req.body.client_id || req.body.clientId || req.body.cid);
    if (!clientId) {
      return res.status(400).json(errorResponse('缺少 push client_id'));
    }

    const payload = {
      merchant_id: merchant.id,
      user_id: merchant.user_id,
      client_id: clientId,
      app_id: normalizeAppId(req.body.app_id || req.body.appId || req.body.plus_appid),
      // 绑定版本到 2，表示这条记录是“修复串推送问题之后”重新注册过的有效商家设备。
      // 后端后面只给 v2 设备发商家推送，历史旧记录哪怕还留在表里，也不会再被当成有效目标。
      binding_version: 2,
      platform: normalizePlatform(req.body.platform),
      os_name: safeTrim(req.body.os_name || req.body.osName || req.body.os),
      device_brand: safeTrim(req.body.device_brand || req.body.deviceBrand || req.body.brand),
      device_model: safeTrim(req.body.device_model || req.body.deviceModel || req.body.model),
      app_version: safeTrim(req.body.app_version || req.body.appVersion || req.body.version),
      app_state: normalizeAppState(req.body.app_state || req.body.appState),
      notification_enabled: toBoolean(req.body.notification_enabled || req.body.notificationEnabled, true),
      push_enabled: toBoolean(req.body.push_enabled || req.body.pushEnabled, true),
      last_seen_at: new Date()
    };

    const existingWhere = { client_id: clientId };
    if (payload.app_id) {
      existingWhere.app_id = payload.app_id;
    }

    const existingDevice = await MerchantPushDevice.findOne({ where: existingWhere });

    let device = existingDevice;
    if (device) {
      await device.update(payload);
    } else {
      device = await MerchantPushDevice.create(payload);
    }

    res.json(successResponse({
      id: device.id,
      merchant_id: device.merchant_id,
      client_id: device.client_id,
      app_id: device.app_id,
      binding_version: device.binding_version,
      push_enabled: !!device.push_enabled,
      notification_enabled: !!device.notification_enabled,
      app_state: device.app_state,
      last_seen_at: device.last_seen_at
    }, '设备注册成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 注销 / 停用当前推送设备
 * 这里不是删记录，而是把当前设备标成不可推送。
 * 这样后面要排查历史问题时，表里还能看到这台设备以前是谁、什么时候绑定过。
 */
exports.unregisterDevice = async (req, res, next) => {
  try {
    const userId = Number(req.user && req.user.id);
    const merchant = await findOwnedMerchant(userId);
    if (!merchant) {
      return res.status(404).json(errorResponse('您还没有店铺'));
    }

    const clientId = safeTrim(req.body.client_id || req.body.clientId || req.body.cid);
    const appId = normalizeAppId(req.body.app_id || req.body.appId || req.body.plus_appid);
    if (!clientId) {
      return res.status(400).json(errorResponse('缺少 push client_id'));
    }

    const where = {
      user_id: merchant.user_id,
      client_id: clientId
    };
    if (appId) {
      where.app_id = appId;
    }

    const [affectedRows] = await MerchantPushDevice.update({
      push_enabled: false,
      notification_enabled: false,
      app_state: 'background',
      last_seen_at: new Date()
    }, { where });

    res.json(successResponse({
      affected_rows: Number(affectedRows || 0),
      client_id: clientId,
      app_id: appId,
      push_enabled: false,
      notification_enabled: false
    }, '设备解绑成功'));
  } catch (error) {
    next(error);
  }
};
