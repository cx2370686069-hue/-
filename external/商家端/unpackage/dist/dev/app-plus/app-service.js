if (typeof Promise !== "undefined" && !Promise.prototype.finally) {
  Promise.prototype.finally = function(callback) {
    const promise = this.constructor;
    return this.then(
      (value) => promise.resolve(callback()).then(() => value),
      (reason) => promise.resolve(callback()).then(() => {
        throw reason;
      })
    );
  };
}
;
if (typeof uni !== "undefined" && uni && uni.requireGlobal) {
  const global2 = uni.requireGlobal();
  ArrayBuffer = global2.ArrayBuffer;
  Int8Array = global2.Int8Array;
  Uint8Array = global2.Uint8Array;
  Uint8ClampedArray = global2.Uint8ClampedArray;
  Int16Array = global2.Int16Array;
  Uint16Array = global2.Uint16Array;
  Int32Array = global2.Int32Array;
  Uint32Array = global2.Uint32Array;
  Float32Array = global2.Float32Array;
  Float64Array = global2.Float64Array;
  BigInt64Array = global2.BigInt64Array;
  BigUint64Array = global2.BigUint64Array;
}
;
if (uni.restoreGlobal) {
  uni.restoreGlobal(Vue, weex, plus, setTimeout, clearTimeout, setInterval, clearInterval);
}
(function(vue) {
  "use strict";
  function formatAppLog(type, filename, ...args) {
    if (uni.__log__) {
      uni.__log__(type, filename, ...args);
    } else {
      console[type].apply(console, [...args, filename]);
    }
  }
  const BASE_URL = "http://121.43.190.218:3000";
  const SOCKET_URL = "http://121.43.190.218:3000";
  const TIANDITU_TK = "63a693ed968db6b7256470395e40fe5b";
  const ORDER_STATUS_CLASS = {
    "待付款": "status-unpaid",
    "待接单": "status-waiting",
    "备餐中": "status-cooking",
    "配送中": "status-delivering",
    "已完成": "status-done",
    "已取消": "status-cancelled"
  };
  const API_BASE_URL$2 = BASE_URL + "/api";
  function request(options) {
    return new Promise((resolve, reject) => {
      const token = uni.getStorageSync("token") || "";
      const header = {
        "Content-Type": "application/json",
        ...options.header
      };
      if (token) {
        header["Authorization"] = "Bearer " + token;
      }
      let requestUrl = options.url || "";
      if (requestUrl === "/order/list" || requestUrl === "/order/merchant/list") {
        requestUrl = "/order/my";
      }
      uni.request({
        url: API_BASE_URL$2 + requestUrl,
        method: options.method || "GET",
        data: options.data || {},
        header,
        success: (res) => {
          if (res.statusCode === 401 || res.statusCode === 403) {
            uni.showToast({ title: "接口无权限或未实现", icon: "none" });
            reject(res.data);
            return;
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else if (options.allow404 && res.statusCode === 404) {
            resolve(null);
          } else {
            let msg = res.data.detail || res.data.message || res.data.msg || "请求失败";
            if (res.statusCode >= 500 || typeof msg === "string" && /Field|SQL|doesn't have a default value|Duplicate entry/i.test(msg)) {
              msg = "系统繁忙，请稍后再试";
            }
            if (msg !== "您还没有店铺") {
              uni.showToast({ title: msg, icon: "none" });
            }
            reject(res.data);
          }
        },
        fail: () => {
          uni.showToast({ title: "网络错误，请检查后端是否启动", icon: "none" });
          reject({ message: "网络错误" });
        }
      });
    });
  }
  function normalizeCoordinateValue$5(value2) {
    if (value2 == null)
      return null;
    const raw = typeof value2 === "string" ? value2.trim() : value2;
    if (raw === "")
      return null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  }
  function getValidCoordinatePair$6(latitude, longitude) {
    const lat = normalizeCoordinateValue$5(latitude);
    const lng = normalizeCoordinateValue$5(longitude);
    if (lat == null || lng == null)
      return null;
    if (lat === 0 && lng === 0)
      return null;
    return {
      latitude: lat,
      longitude: lng
    };
  }
  function buildShopPayload(data) {
    const body = { ...data };
    const coordinatePair = getValidCoordinatePair$6(body.latitude, body.longitude);
    if (!coordinatePair) {
      throw new Error("地图坐标无效，请重新选点后再提交");
    }
    body.latitude = coordinatePair.latitude;
    body.longitude = coordinatePair.longitude;
    return body;
  }
  function getShopInfo() {
    return request({ url: "/merchant/my", method: "GET" });
  }
  function fetchMerchantMy() {
    return request({ url: "/merchant/my", method: "GET", allow404: true });
  }
  function createShop(data) {
    return request({ url: "/merchant/create", method: "POST", data: buildShopPayload(data) });
  }
  function updateShopInfo(data) {
    return request({ url: "/merchant/update", method: "PUT", data: buildShopPayload(data) });
  }
  function uploadShopImage(filePath) {
    return new Promise((resolve, reject) => {
      const token = uni.getStorageSync("token") || "";
      const header = token ? { Authorization: "Bearer " + token } : {};
      uni.uploadFile({
        url: BASE_URL + "/api/upload/image",
        filePath,
        name: "file",
        header,
        success: (res) => {
          let data = null;
          try {
            data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
          } catch (e2) {
            reject(new Error("上传响应解析失败"));
            return;
          }
          if (res.statusCode >= 200 && res.statusCode < 300 && data && (data.code === 200 || data.success) && data.data && data.data.url) {
            resolve(data);
            return;
          }
          const message = data && (data.detail || data.message || data.msg) ? data.detail || data.message || data.msg : "上传失败";
          reject(new Error(message));
        },
        fail: () => {
          reject(new Error("上传失败，请检查网络"));
        }
      });
    });
  }
  function getDashboard$1() {
    return request({ url: "/shop/dashboard", method: "GET" });
  }
  function getMerchantCategoryList() {
    return request({ url: "/merchant/my-categories", method: "GET" });
  }
  function createCategory(data) {
    return request({ url: "/merchant/category", method: "POST", data });
  }
  function updateCategory(id, data) {
    return request({ url: "/merchant/category/" + id, method: "PUT", data });
  }
  function deleteCategory(id) {
    return request({ url: "/merchant/category/" + id, method: "DELETE" });
  }
  function getMyProducts(params = {}) {
    return request({ url: "/merchant/my-products", method: "GET", data: params });
  }
  function createMerchantProduct(data) {
    return request({ url: "/merchant/product", method: "POST", data });
  }
  function updateProduct(id, data) {
    return request({ url: "/merchant/product/" + id, method: "PUT", data });
  }
  function deleteProduct(id) {
    return request({ url: "/merchant/product/" + id, method: "DELETE" });
  }
  const TOKEN_KEY = "token";
  const USER_KEY = "userInfo";
  const MERCHANT_KEYS = ["merchantInfo", "merchant_info", "shopInfo", "shop_info"];
  function getToken() {
    return uni.getStorageSync(TOKEN_KEY) || "";
  }
  function setToken(token) {
    uni.setStorageSync(TOKEN_KEY, token);
  }
  function getUser() {
    return uni.getStorageSync(USER_KEY) || null;
  }
  function setUser(info) {
    uni.setStorageSync(USER_KEY, info);
  }
  function normalizeUserRole(userInfo) {
    if (!userInfo || typeof userInfo !== "object")
      return "";
    const candidates = [
      userInfo.role,
      userInfo.Role,
      userInfo.user_role,
      userInfo.userRole,
      userInfo.type,
      userInfo.user_type,
      userInfo.userType,
      userInfo.account_type,
      userInfo.accountType,
      userInfo.identity,
      userInfo["角色"]
    ];
    for (const value2 of candidates) {
      const role = String(value2 || "").trim().toLowerCase();
      if (!role)
        continue;
      if (role === "merchant" || role === "shop" || role === "商家") {
        return "merchant";
      }
    }
    return "";
  }
  function getUserId(userInfo = getUser()) {
    if (!userInfo || typeof userInfo !== "object")
      return "";
    return userInfo.id || userInfo.userId || userInfo.user_id || userInfo.uid || "";
  }
  function isMerchantUser(userInfo = getUser()) {
    return normalizeUserRole(userInfo) === "merchant";
  }
  function hasValidMerchantSession() {
    const token = getToken();
    const userInfo = getUser();
    return !!(token && getUserId(userInfo) && isMerchantUser(userInfo));
  }
  function clearAuth() {
    uni.removeStorageSync(TOKEN_KEY);
    uni.removeStorageSync(USER_KEY);
    MERCHANT_KEYS.forEach((key) => uni.removeStorageSync(key));
  }
  const PACKET_TYPES = /* @__PURE__ */ Object.create(null);
  PACKET_TYPES["open"] = "0";
  PACKET_TYPES["close"] = "1";
  PACKET_TYPES["ping"] = "2";
  PACKET_TYPES["pong"] = "3";
  PACKET_TYPES["message"] = "4";
  PACKET_TYPES["upgrade"] = "5";
  PACKET_TYPES["noop"] = "6";
  const PACKET_TYPES_REVERSE = /* @__PURE__ */ Object.create(null);
  Object.keys(PACKET_TYPES).forEach((key) => {
    PACKET_TYPES_REVERSE[PACKET_TYPES[key]] = key;
  });
  const ERROR_PACKET = { type: "error", data: "parser error" };
  const withNativeBlob$1 = typeof Blob === "function" || typeof Blob !== "undefined" && Object.prototype.toString.call(Blob) === "[object BlobConstructor]";
  const withNativeArrayBuffer$2 = typeof ArrayBuffer === "function";
  const isView$1 = (obj) => {
    return typeof ArrayBuffer.isView === "function" ? ArrayBuffer.isView(obj) : obj && obj.buffer instanceof ArrayBuffer;
  };
  const encodePacket = ({ type, data }, supportsBinary, callback) => {
    if (withNativeBlob$1 && data instanceof Blob) {
      if (supportsBinary) {
        return callback(data);
      } else {
        return encodeBlobAsBase64(data, callback);
      }
    } else if (withNativeArrayBuffer$2 && (data instanceof ArrayBuffer || isView$1(data))) {
      if (supportsBinary) {
        return callback(data);
      } else {
        return encodeBlobAsBase64(new Blob([data]), callback);
      }
    }
    return callback(PACKET_TYPES[type] + (data || ""));
  };
  const encodeBlobAsBase64 = (data, callback) => {
    const fileReader = new FileReader();
    fileReader.onload = function() {
      const content = fileReader.result.split(",")[1];
      callback("b" + (content || ""));
    };
    return fileReader.readAsDataURL(data);
  };
  function toArray(data) {
    if (data instanceof Uint8Array) {
      return data;
    } else if (data instanceof ArrayBuffer) {
      return new Uint8Array(data);
    } else {
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
  }
  let TEXT_ENCODER;
  function encodePacketToBinary(packet, callback) {
    if (withNativeBlob$1 && packet.data instanceof Blob) {
      return packet.data.arrayBuffer().then(toArray).then(callback);
    } else if (withNativeArrayBuffer$2 && (packet.data instanceof ArrayBuffer || isView$1(packet.data))) {
      return callback(toArray(packet.data));
    }
    encodePacket(packet, false, (encoded) => {
      if (!TEXT_ENCODER) {
        TEXT_ENCODER = new TextEncoder();
      }
      callback(TEXT_ENCODER.encode(encoded));
    });
  }
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup$1 = typeof Uint8Array === "undefined" ? [] : new Uint8Array(256);
  for (let i2 = 0; i2 < chars.length; i2++) {
    lookup$1[chars.charCodeAt(i2)] = i2;
  }
  const decode$1 = (base64) => {
    let bufferLength = base64.length * 0.75, len = base64.length, i2, p2 = 0, encoded1, encoded2, encoded3, encoded4;
    if (base64[base64.length - 1] === "=") {
      bufferLength--;
      if (base64[base64.length - 2] === "=") {
        bufferLength--;
      }
    }
    const arraybuffer = new ArrayBuffer(bufferLength), bytes = new Uint8Array(arraybuffer);
    for (i2 = 0; i2 < len; i2 += 4) {
      encoded1 = lookup$1[base64.charCodeAt(i2)];
      encoded2 = lookup$1[base64.charCodeAt(i2 + 1)];
      encoded3 = lookup$1[base64.charCodeAt(i2 + 2)];
      encoded4 = lookup$1[base64.charCodeAt(i2 + 3)];
      bytes[p2++] = encoded1 << 2 | encoded2 >> 4;
      bytes[p2++] = (encoded2 & 15) << 4 | encoded3 >> 2;
      bytes[p2++] = (encoded3 & 3) << 6 | encoded4 & 63;
    }
    return arraybuffer;
  };
  const withNativeArrayBuffer$1 = typeof ArrayBuffer === "function";
  const decodePacket = (encodedPacket, binaryType) => {
    if (typeof encodedPacket !== "string") {
      return {
        type: "message",
        data: mapBinary(encodedPacket, binaryType)
      };
    }
    const type = encodedPacket.charAt(0);
    if (type === "b") {
      return {
        type: "message",
        data: decodeBase64Packet(encodedPacket.substring(1), binaryType)
      };
    }
    const packetType = PACKET_TYPES_REVERSE[type];
    if (!packetType) {
      return ERROR_PACKET;
    }
    return encodedPacket.length > 1 ? {
      type: PACKET_TYPES_REVERSE[type],
      data: encodedPacket.substring(1)
    } : {
      type: PACKET_TYPES_REVERSE[type]
    };
  };
  const decodeBase64Packet = (data, binaryType) => {
    if (withNativeArrayBuffer$1) {
      const decoded = decode$1(data);
      return mapBinary(decoded, binaryType);
    } else {
      return { base64: true, data };
    }
  };
  const mapBinary = (data, binaryType) => {
    switch (binaryType) {
      case "blob":
        if (data instanceof Blob) {
          return data;
        } else {
          return new Blob([data]);
        }
      case "arraybuffer":
      default:
        if (data instanceof ArrayBuffer) {
          return data;
        } else {
          return data.buffer;
        }
    }
  };
  const SEPARATOR = String.fromCharCode(30);
  const encodePayload = (packets, callback) => {
    const length = packets.length;
    const encodedPackets = new Array(length);
    let count = 0;
    packets.forEach((packet, i2) => {
      encodePacket(packet, false, (encodedPacket) => {
        encodedPackets[i2] = encodedPacket;
        if (++count === length) {
          callback(encodedPackets.join(SEPARATOR));
        }
      });
    });
  };
  const decodePayload = (encodedPayload, binaryType) => {
    const encodedPackets = encodedPayload.split(SEPARATOR);
    const packets = [];
    for (let i2 = 0; i2 < encodedPackets.length; i2++) {
      const decodedPacket = decodePacket(encodedPackets[i2], binaryType);
      packets.push(decodedPacket);
      if (decodedPacket.type === "error") {
        break;
      }
    }
    return packets;
  };
  function createPacketEncoderStream() {
    return new TransformStream({
      transform(packet, controller) {
        encodePacketToBinary(packet, (encodedPacket) => {
          const payloadLength = encodedPacket.length;
          let header;
          if (payloadLength < 126) {
            header = new Uint8Array(1);
            new DataView(header.buffer).setUint8(0, payloadLength);
          } else if (payloadLength < 65536) {
            header = new Uint8Array(3);
            const view = new DataView(header.buffer);
            view.setUint8(0, 126);
            view.setUint16(1, payloadLength);
          } else {
            header = new Uint8Array(9);
            const view = new DataView(header.buffer);
            view.setUint8(0, 127);
            view.setBigUint64(1, BigInt(payloadLength));
          }
          if (packet.data && typeof packet.data !== "string") {
            header[0] |= 128;
          }
          controller.enqueue(header);
          controller.enqueue(encodedPacket);
        });
      }
    });
  }
  let TEXT_DECODER;
  function totalLength(chunks) {
    return chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  }
  function concatChunks(chunks, size) {
    if (chunks[0].length === size) {
      return chunks.shift();
    }
    const buffer = new Uint8Array(size);
    let j2 = 0;
    for (let i2 = 0; i2 < size; i2++) {
      buffer[i2] = chunks[0][j2++];
      if (j2 === chunks[0].length) {
        chunks.shift();
        j2 = 0;
      }
    }
    if (chunks.length && j2 < chunks[0].length) {
      chunks[0] = chunks[0].slice(j2);
    }
    return buffer;
  }
  function createPacketDecoderStream(maxPayload, binaryType) {
    if (!TEXT_DECODER) {
      TEXT_DECODER = new TextDecoder();
    }
    const chunks = [];
    let state = 0;
    let expectedLength = -1;
    let isBinary2 = false;
    return new TransformStream({
      transform(chunk, controller) {
        chunks.push(chunk);
        while (true) {
          if (state === 0) {
            if (totalLength(chunks) < 1) {
              break;
            }
            const header = concatChunks(chunks, 1);
            isBinary2 = (header[0] & 128) === 128;
            expectedLength = header[0] & 127;
            if (expectedLength < 126) {
              state = 3;
            } else if (expectedLength === 126) {
              state = 1;
            } else {
              state = 2;
            }
          } else if (state === 1) {
            if (totalLength(chunks) < 2) {
              break;
            }
            const headerArray = concatChunks(chunks, 2);
            expectedLength = new DataView(headerArray.buffer, headerArray.byteOffset, headerArray.length).getUint16(0);
            state = 3;
          } else if (state === 2) {
            if (totalLength(chunks) < 8) {
              break;
            }
            const headerArray = concatChunks(chunks, 8);
            const view = new DataView(headerArray.buffer, headerArray.byteOffset, headerArray.length);
            const n2 = view.getUint32(0);
            if (n2 > Math.pow(2, 53 - 32) - 1) {
              controller.enqueue(ERROR_PACKET);
              break;
            }
            expectedLength = n2 * Math.pow(2, 32) + view.getUint32(4);
            state = 3;
          } else {
            if (totalLength(chunks) < expectedLength) {
              break;
            }
            const data = concatChunks(chunks, expectedLength);
            controller.enqueue(decodePacket(isBinary2 ? data : TEXT_DECODER.decode(data), binaryType));
            state = 0;
          }
          if (expectedLength === 0 || expectedLength > maxPayload) {
            controller.enqueue(ERROR_PACKET);
            break;
          }
        }
      }
    });
  }
  const protocol$1 = 4;
  function Emitter(obj) {
    if (obj)
      return mixin(obj);
  }
  function mixin(obj) {
    for (var key in Emitter.prototype) {
      obj[key] = Emitter.prototype[key];
    }
    return obj;
  }
  Emitter.prototype.on = Emitter.prototype.addEventListener = function(event, fn2) {
    this._callbacks = this._callbacks || {};
    (this._callbacks["$" + event] = this._callbacks["$" + event] || []).push(fn2);
    return this;
  };
  Emitter.prototype.once = function(event, fn2) {
    function on2() {
      this.off(event, on2);
      fn2.apply(this, arguments);
    }
    on2.fn = fn2;
    this.on(event, on2);
    return this;
  };
  Emitter.prototype.off = Emitter.prototype.removeListener = Emitter.prototype.removeAllListeners = Emitter.prototype.removeEventListener = function(event, fn2) {
    this._callbacks = this._callbacks || {};
    if (0 == arguments.length) {
      this._callbacks = {};
      return this;
    }
    var callbacks = this._callbacks["$" + event];
    if (!callbacks)
      return this;
    if (1 == arguments.length) {
      delete this._callbacks["$" + event];
      return this;
    }
    var cb;
    for (var i2 = 0; i2 < callbacks.length; i2++) {
      cb = callbacks[i2];
      if (cb === fn2 || cb.fn === fn2) {
        callbacks.splice(i2, 1);
        break;
      }
    }
    if (callbacks.length === 0) {
      delete this._callbacks["$" + event];
    }
    return this;
  };
  Emitter.prototype.emit = function(event) {
    this._callbacks = this._callbacks || {};
    var args = new Array(arguments.length - 1), callbacks = this._callbacks["$" + event];
    for (var i2 = 1; i2 < arguments.length; i2++) {
      args[i2 - 1] = arguments[i2];
    }
    if (callbacks) {
      callbacks = callbacks.slice(0);
      for (var i2 = 0, len = callbacks.length; i2 < len; ++i2) {
        callbacks[i2].apply(this, args);
      }
    }
    return this;
  };
  Emitter.prototype.emitReserved = Emitter.prototype.emit;
  Emitter.prototype.listeners = function(event) {
    this._callbacks = this._callbacks || {};
    return this._callbacks["$" + event] || [];
  };
  Emitter.prototype.hasListeners = function(event) {
    return !!this.listeners(event).length;
  };
  const nextTick = (() => {
    const isPromiseAvailable = typeof Promise === "function" && typeof Promise.resolve === "function";
    if (isPromiseAvailable) {
      return (cb) => Promise.resolve().then(cb);
    } else {
      return (cb, setTimeoutFn) => setTimeoutFn(cb, 0);
    }
  })();
  const globalThisShim = (() => {
    if (typeof self !== "undefined") {
      return self;
    } else if (typeof window !== "undefined") {
      return window;
    } else {
      return Function("return this")();
    }
  })();
  const defaultBinaryType = "arraybuffer";
  function createCookieJar() {
  }
  function pick(obj, ...attr) {
    return attr.reduce((acc, k) => {
      if (obj.hasOwnProperty(k)) {
        acc[k] = obj[k];
      }
      return acc;
    }, {});
  }
  const NATIVE_SET_TIMEOUT = globalThisShim.setTimeout;
  const NATIVE_CLEAR_TIMEOUT = globalThisShim.clearTimeout;
  function installTimerFunctions(obj, opts) {
    if (opts.useNativeTimers) {
      obj.setTimeoutFn = NATIVE_SET_TIMEOUT.bind(globalThisShim);
      obj.clearTimeoutFn = NATIVE_CLEAR_TIMEOUT.bind(globalThisShim);
    } else {
      obj.setTimeoutFn = globalThisShim.setTimeout.bind(globalThisShim);
      obj.clearTimeoutFn = globalThisShim.clearTimeout.bind(globalThisShim);
    }
  }
  const BASE64_OVERHEAD = 1.33;
  function byteLength(obj) {
    if (typeof obj === "string") {
      return utf8Length(obj);
    }
    return Math.ceil((obj.byteLength || obj.size) * BASE64_OVERHEAD);
  }
  function utf8Length(str) {
    let c2 = 0, length = 0;
    for (let i2 = 0, l2 = str.length; i2 < l2; i2++) {
      c2 = str.charCodeAt(i2);
      if (c2 < 128) {
        length += 1;
      } else if (c2 < 2048) {
        length += 2;
      } else if (c2 < 55296 || c2 >= 57344) {
        length += 3;
      } else {
        i2++;
        length += 4;
      }
    }
    return length;
  }
  function randomString() {
    return Date.now().toString(36).substring(3) + Math.random().toString(36).substring(2, 5);
  }
  function encode(obj) {
    let str = "";
    for (let i2 in obj) {
      if (obj.hasOwnProperty(i2)) {
        if (str.length)
          str += "&";
        str += encodeURIComponent(i2) + "=" + encodeURIComponent(obj[i2]);
      }
    }
    return str;
  }
  function decode(qs2) {
    let qry = {};
    let pairs = qs2.split("&");
    for (let i2 = 0, l2 = pairs.length; i2 < l2; i2++) {
      let pair = pairs[i2].split("=");
      qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
    }
    return qry;
  }
  class TransportError extends Error {
    constructor(reason, description, context) {
      super(reason);
      this.description = description;
      this.context = context;
      this.type = "TransportError";
    }
  }
  class Transport extends Emitter {
    /**
     * Transport abstract constructor.
     *
     * @param {Object} opts - options
     * @protected
     */
    constructor(opts) {
      super();
      this.writable = false;
      installTimerFunctions(this, opts);
      this.opts = opts;
      this.query = opts.query;
      this.socket = opts.socket;
      this.supportsBinary = !opts.forceBase64;
    }
    /**
     * Emits an error.
     *
     * @param {String} reason
     * @param description
     * @param context - the error context
     * @return {Transport} for chaining
     * @protected
     */
    onError(reason, description, context) {
      super.emitReserved("error", new TransportError(reason, description, context));
      return this;
    }
    /**
     * Opens the transport.
     */
    open() {
      this.readyState = "opening";
      this.doOpen();
      return this;
    }
    /**
     * Closes the transport.
     */
    close() {
      if (this.readyState === "opening" || this.readyState === "open") {
        this.doClose();
        this.onClose();
      }
      return this;
    }
    /**
     * Sends multiple packets.
     *
     * @param {Array} packets
     */
    send(packets) {
      if (this.readyState === "open") {
        this.write(packets);
      }
    }
    /**
     * Called upon open
     *
     * @protected
     */
    onOpen() {
      this.readyState = "open";
      this.writable = true;
      super.emitReserved("open");
    }
    /**
     * Called with data.
     *
     * @param {String} data
     * @protected
     */
    onData(data) {
      const packet = decodePacket(data, this.socket.binaryType);
      this.onPacket(packet);
    }
    /**
     * Called with a decoded packet.
     *
     * @protected
     */
    onPacket(packet) {
      super.emitReserved("packet", packet);
    }
    /**
     * Called upon close.
     *
     * @protected
     */
    onClose(details) {
      this.readyState = "closed";
      super.emitReserved("close", details);
    }
    /**
     * Pauses the transport, in order not to lose packets during an upgrade.
     *
     * @param onPause
     */
    pause(onPause) {
    }
    createUri(schema, query = {}) {
      return schema + "://" + this._hostname() + this._port() + this.opts.path + this._query(query);
    }
    _hostname() {
      const hostname = this.opts.hostname;
      return hostname.indexOf(":") === -1 ? hostname : "[" + hostname + "]";
    }
    _port() {
      if (this.opts.port && (this.opts.secure && Number(this.opts.port) !== 443 || !this.opts.secure && Number(this.opts.port) !== 80)) {
        return ":" + this.opts.port;
      } else {
        return "";
      }
    }
    _query(query) {
      const encodedQuery = encode(query);
      return encodedQuery.length ? "?" + encodedQuery : "";
    }
  }
  class Polling extends Transport {
    constructor() {
      super(...arguments);
      this._polling = false;
    }
    get name() {
      return "polling";
    }
    /**
     * Opens the socket (triggers polling). We write a PING message to determine
     * when the transport is open.
     *
     * @protected
     */
    doOpen() {
      this._poll();
    }
    /**
     * Pauses polling.
     *
     * @param {Function} onPause - callback upon buffers are flushed and transport is paused
     * @package
     */
    pause(onPause) {
      this.readyState = "pausing";
      const pause = () => {
        this.readyState = "paused";
        onPause();
      };
      if (this._polling || !this.writable) {
        let total = 0;
        if (this._polling) {
          total++;
          this.once("pollComplete", function() {
            --total || pause();
          });
        }
        if (!this.writable) {
          total++;
          this.once("drain", function() {
            --total || pause();
          });
        }
      } else {
        pause();
      }
    }
    /**
     * Starts polling cycle.
     *
     * @private
     */
    _poll() {
      this._polling = true;
      this.doPoll();
      this.emitReserved("poll");
    }
    /**
     * Overloads onData to detect payloads.
     *
     * @protected
     */
    onData(data) {
      const callback = (packet) => {
        if ("opening" === this.readyState && packet.type === "open") {
          this.onOpen();
        }
        if ("close" === packet.type) {
          this.onClose({ description: "transport closed by the server" });
          return false;
        }
        this.onPacket(packet);
      };
      decodePayload(data, this.socket.binaryType).forEach(callback);
      if ("closed" !== this.readyState) {
        this._polling = false;
        this.emitReserved("pollComplete");
        if ("open" === this.readyState) {
          this._poll();
        }
      }
    }
    /**
     * For polling, send a close packet.
     *
     * @protected
     */
    doClose() {
      const close = () => {
        this.write([{ type: "close" }]);
      };
      if ("open" === this.readyState) {
        close();
      } else {
        this.once("open", close);
      }
    }
    /**
     * Writes a packets payload.
     *
     * @param {Array} packets - data packets
     * @protected
     */
    write(packets) {
      this.writable = false;
      encodePayload(packets, (data) => {
        this.doWrite(data, () => {
          this.writable = true;
          this.emitReserved("drain");
        });
      });
    }
    /**
     * Generates uri for connection.
     *
     * @private
     */
    uri() {
      const schema = this.opts.secure ? "https" : "http";
      const query = this.query || {};
      if (false !== this.opts.timestampRequests) {
        query[this.opts.timestampParam] = randomString();
      }
      if (!this.supportsBinary && !query.sid) {
        query.b64 = 1;
      }
      return this.createUri(schema, query);
    }
  }
  let value = false;
  try {
    value = typeof XMLHttpRequest !== "undefined" && "withCredentials" in new XMLHttpRequest();
  } catch (err) {
  }
  const hasCORS = value;
  function empty() {
  }
  class BaseXHR extends Polling {
    /**
     * XHR Polling constructor.
     *
     * @param {Object} opts
     * @package
     */
    constructor(opts) {
      super(opts);
      if (typeof location !== "undefined") {
        const isSSL = "https:" === location.protocol;
        let port = location.port;
        if (!port) {
          port = isSSL ? "443" : "80";
        }
        this.xd = typeof location !== "undefined" && opts.hostname !== location.hostname || port !== opts.port;
      }
    }
    /**
     * Sends data.
     *
     * @param {String} data to send.
     * @param {Function} called upon flush.
     * @private
     */
    doWrite(data, fn2) {
      const req = this.request({
        method: "POST",
        data
      });
      req.on("success", fn2);
      req.on("error", (xhrStatus, context) => {
        this.onError("xhr post error", xhrStatus, context);
      });
    }
    /**
     * Starts a poll cycle.
     *
     * @private
     */
    doPoll() {
      const req = this.request();
      req.on("data", this.onData.bind(this));
      req.on("error", (xhrStatus, context) => {
        this.onError("xhr poll error", xhrStatus, context);
      });
      this.pollXhr = req;
    }
  }
  class Request extends Emitter {
    /**
     * Request constructor
     *
     * @param {Object} options
     * @package
     */
    constructor(createRequest, uri, opts) {
      super();
      this.createRequest = createRequest;
      installTimerFunctions(this, opts);
      this._opts = opts;
      this._method = opts.method || "GET";
      this._uri = uri;
      this._data = void 0 !== opts.data ? opts.data : null;
      this._create();
    }
    /**
     * Creates the XHR object and sends the request.
     *
     * @private
     */
    _create() {
      var _a;
      const opts = pick(this._opts, "agent", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "autoUnref");
      opts.xdomain = !!this._opts.xd;
      const xhr = this._xhr = this.createRequest(opts);
      try {
        xhr.open(this._method, this._uri, true);
        try {
          if (this._opts.extraHeaders) {
            xhr.setDisableHeaderCheck && xhr.setDisableHeaderCheck(true);
            for (let i2 in this._opts.extraHeaders) {
              if (this._opts.extraHeaders.hasOwnProperty(i2)) {
                xhr.setRequestHeader(i2, this._opts.extraHeaders[i2]);
              }
            }
          }
        } catch (e2) {
        }
        if ("POST" === this._method) {
          try {
            xhr.setRequestHeader("Content-type", "text/plain;charset=UTF-8");
          } catch (e2) {
          }
        }
        try {
          xhr.setRequestHeader("Accept", "*/*");
        } catch (e2) {
        }
        (_a = this._opts.cookieJar) === null || _a === void 0 ? void 0 : _a.addCookies(xhr);
        if ("withCredentials" in xhr) {
          xhr.withCredentials = this._opts.withCredentials;
        }
        if (this._opts.requestTimeout) {
          xhr.timeout = this._opts.requestTimeout;
        }
        xhr.onreadystatechange = () => {
          var _a2;
          if (xhr.readyState === 3) {
            (_a2 = this._opts.cookieJar) === null || _a2 === void 0 ? void 0 : _a2.parseCookies(
              // @ts-ignore
              xhr.getResponseHeader("set-cookie")
            );
          }
          if (4 !== xhr.readyState)
            return;
          if (200 === xhr.status || 1223 === xhr.status) {
            this._onLoad();
          } else {
            this.setTimeoutFn(() => {
              this._onError(typeof xhr.status === "number" ? xhr.status : 0);
            }, 0);
          }
        };
        xhr.send(this._data);
      } catch (e2) {
        this.setTimeoutFn(() => {
          this._onError(e2);
        }, 0);
        return;
      }
      if (typeof document !== "undefined") {
        this._index = Request.requestsCount++;
        Request.requests[this._index] = this;
      }
    }
    /**
     * Called upon error.
     *
     * @private
     */
    _onError(err) {
      this.emitReserved("error", err, this._xhr);
      this._cleanup(true);
    }
    /**
     * Cleans up house.
     *
     * @private
     */
    _cleanup(fromError) {
      if ("undefined" === typeof this._xhr || null === this._xhr) {
        return;
      }
      this._xhr.onreadystatechange = empty;
      if (fromError) {
        try {
          this._xhr.abort();
        } catch (e2) {
        }
      }
      if (typeof document !== "undefined") {
        delete Request.requests[this._index];
      }
      this._xhr = null;
    }
    /**
     * Called upon load.
     *
     * @private
     */
    _onLoad() {
      const data = this._xhr.responseText;
      if (data !== null) {
        this.emitReserved("data", data);
        this.emitReserved("success");
        this._cleanup();
      }
    }
    /**
     * Aborts the request.
     *
     * @package
     */
    abort() {
      this._cleanup();
    }
  }
  Request.requestsCount = 0;
  Request.requests = {};
  if (typeof document !== "undefined") {
    if (typeof attachEvent === "function") {
      attachEvent("onunload", unloadHandler);
    } else if (typeof addEventListener === "function") {
      const terminationEvent = "onpagehide" in globalThisShim ? "pagehide" : "unload";
      addEventListener(terminationEvent, unloadHandler, false);
    }
  }
  function unloadHandler() {
    for (let i2 in Request.requests) {
      if (Request.requests.hasOwnProperty(i2)) {
        Request.requests[i2].abort();
      }
    }
  }
  const hasXHR2 = function() {
    const xhr = newRequest({
      xdomain: false
    });
    return xhr && xhr.responseType !== null;
  }();
  class XHR extends BaseXHR {
    constructor(opts) {
      super(opts);
      const forceBase64 = opts && opts.forceBase64;
      this.supportsBinary = hasXHR2 && !forceBase64;
    }
    request(opts = {}) {
      Object.assign(opts, { xd: this.xd }, this.opts);
      return new Request(newRequest, this.uri(), opts);
    }
  }
  function newRequest(opts) {
    const xdomain = opts.xdomain;
    try {
      if ("undefined" !== typeof XMLHttpRequest && (!xdomain || hasCORS)) {
        return new XMLHttpRequest();
      }
    } catch (e2) {
    }
    if (!xdomain) {
      try {
        return new globalThisShim[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP");
      } catch (e2) {
      }
    }
  }
  const isReactNative = typeof navigator !== "undefined" && typeof navigator.product === "string" && navigator.product.toLowerCase() === "reactnative";
  class BaseWS extends Transport {
    get name() {
      return "websocket";
    }
    doOpen() {
      const uri = this.uri();
      const protocols = this.opts.protocols;
      const opts = isReactNative ? {} : pick(this.opts, "agent", "perMessageDeflate", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "localAddress", "protocolVersion", "origin", "maxPayload", "family", "checkServerIdentity");
      if (this.opts.extraHeaders) {
        opts.headers = this.opts.extraHeaders;
      }
      try {
        this.ws = this.createSocket(uri, protocols, opts);
      } catch (err) {
        return this.emitReserved("error", err);
      }
      this.ws.binaryType = this.socket.binaryType;
      this.addEventListeners();
    }
    /**
     * Adds event listeners to the socket
     *
     * @private
     */
    addEventListeners() {
      this.ws.onopen = () => {
        if (this.opts.autoUnref) {
          this.ws._socket.unref();
        }
        this.onOpen();
      };
      this.ws.onclose = (closeEvent) => this.onClose({
        description: "websocket connection closed",
        context: closeEvent
      });
      this.ws.onmessage = (ev) => this.onData(ev.data);
      this.ws.onerror = (e2) => this.onError("websocket error", e2);
    }
    write(packets) {
      this.writable = false;
      for (let i2 = 0; i2 < packets.length; i2++) {
        const packet = packets[i2];
        const lastPacket = i2 === packets.length - 1;
        encodePacket(packet, this.supportsBinary, (data) => {
          try {
            this.doWrite(packet, data);
          } catch (e2) {
          }
          if (lastPacket) {
            nextTick(() => {
              this.writable = true;
              this.emitReserved("drain");
            }, this.setTimeoutFn);
          }
        });
      }
    }
    doClose() {
      if (typeof this.ws !== "undefined") {
        this.ws.onerror = () => {
        };
        this.ws.close();
        this.ws = null;
      }
    }
    /**
     * Generates uri for connection.
     *
     * @private
     */
    uri() {
      const schema = this.opts.secure ? "wss" : "ws";
      const query = this.query || {};
      if (this.opts.timestampRequests) {
        query[this.opts.timestampParam] = randomString();
      }
      if (!this.supportsBinary) {
        query.b64 = 1;
      }
      return this.createUri(schema, query);
    }
  }
  const WebSocketCtor = globalThisShim.WebSocket || globalThisShim.MozWebSocket;
  class WS extends BaseWS {
    createSocket(uri, protocols, opts) {
      return !isReactNative ? protocols ? new WebSocketCtor(uri, protocols) : new WebSocketCtor(uri) : new WebSocketCtor(uri, protocols, opts);
    }
    doWrite(_packet, data) {
      this.ws.send(data);
    }
  }
  class WT extends Transport {
    get name() {
      return "webtransport";
    }
    doOpen() {
      try {
        this._transport = new WebTransport(this.createUri("https"), this.opts.transportOptions[this.name]);
      } catch (err) {
        return this.emitReserved("error", err);
      }
      this._transport.closed.then(() => {
        this.onClose();
      }).catch((err) => {
        this.onError("webtransport error", err);
      });
      this._transport.ready.then(() => {
        this._transport.createBidirectionalStream().then((stream) => {
          const decoderStream = createPacketDecoderStream(Number.MAX_SAFE_INTEGER, this.socket.binaryType);
          const reader = stream.readable.pipeThrough(decoderStream).getReader();
          const encoderStream = createPacketEncoderStream();
          encoderStream.readable.pipeTo(stream.writable);
          this._writer = encoderStream.writable.getWriter();
          const read = () => {
            reader.read().then(({ done, value: value2 }) => {
              if (done) {
                return;
              }
              this.onPacket(value2);
              read();
            }).catch((err) => {
            });
          };
          read();
          const packet = { type: "open" };
          if (this.query.sid) {
            packet.data = `{"sid":"${this.query.sid}"}`;
          }
          this._writer.write(packet).then(() => this.onOpen());
        });
      });
    }
    write(packets) {
      this.writable = false;
      for (let i2 = 0; i2 < packets.length; i2++) {
        const packet = packets[i2];
        const lastPacket = i2 === packets.length - 1;
        this._writer.write(packet).then(() => {
          if (lastPacket) {
            nextTick(() => {
              this.writable = true;
              this.emitReserved("drain");
            }, this.setTimeoutFn);
          }
        });
      }
    }
    doClose() {
      var _a;
      (_a = this._transport) === null || _a === void 0 ? void 0 : _a.close();
    }
  }
  const transports = {
    websocket: WS,
    webtransport: WT,
    polling: XHR
  };
  const re$1 = /^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;
  const parts = [
    "source",
    "protocol",
    "authority",
    "userInfo",
    "user",
    "password",
    "host",
    "port",
    "relative",
    "path",
    "directory",
    "file",
    "query",
    "anchor"
  ];
  function parse(str) {
    if (str.length > 8e3) {
      throw "URI too long";
    }
    const src = str, b2 = str.indexOf("["), e2 = str.indexOf("]");
    if (b2 != -1 && e2 != -1) {
      str = str.substring(0, b2) + str.substring(b2, e2).replace(/:/g, ";") + str.substring(e2, str.length);
    }
    let m2 = re$1.exec(str || ""), uri = {}, i2 = 14;
    while (i2--) {
      uri[parts[i2]] = m2[i2] || "";
    }
    if (b2 != -1 && e2 != -1) {
      uri.source = src;
      uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ":");
      uri.authority = uri.authority.replace("[", "").replace("]", "").replace(/;/g, ":");
      uri.ipv6uri = true;
    }
    uri.pathNames = pathNames(uri, uri["path"]);
    uri.queryKey = queryKey(uri, uri["query"]);
    return uri;
  }
  function pathNames(obj, path) {
    const regx = /\/{2,9}/g, names = path.replace(regx, "/").split("/");
    if (path.slice(0, 1) == "/" || path.length === 0) {
      names.splice(0, 1);
    }
    if (path.slice(-1) == "/") {
      names.splice(names.length - 1, 1);
    }
    return names;
  }
  function queryKey(uri, query) {
    const data = {};
    query.replace(/(?:^|&)([^&=]*)=?([^&]*)/g, function($0, $1, $2) {
      if ($1) {
        data[$1] = $2;
      }
    });
    return data;
  }
  const withEventListeners = typeof addEventListener === "function" && typeof removeEventListener === "function";
  const OFFLINE_EVENT_LISTENERS = [];
  if (withEventListeners) {
    addEventListener("offline", () => {
      OFFLINE_EVENT_LISTENERS.forEach((listener) => listener());
    }, false);
  }
  class SocketWithoutUpgrade extends Emitter {
    /**
     * Socket constructor.
     *
     * @param {String|Object} uri - uri or options
     * @param {Object} opts - options
     */
    constructor(uri, opts) {
      super();
      this.binaryType = defaultBinaryType;
      this.writeBuffer = [];
      this._prevBufferLen = 0;
      this._pingInterval = -1;
      this._pingTimeout = -1;
      this._maxPayload = -1;
      this._pingTimeoutTime = Infinity;
      if (uri && "object" === typeof uri) {
        opts = uri;
        uri = null;
      }
      if (uri) {
        const parsedUri = parse(uri);
        opts.hostname = parsedUri.host;
        opts.secure = parsedUri.protocol === "https" || parsedUri.protocol === "wss";
        opts.port = parsedUri.port;
        if (parsedUri.query)
          opts.query = parsedUri.query;
      } else if (opts.host) {
        opts.hostname = parse(opts.host).host;
      }
      installTimerFunctions(this, opts);
      this.secure = null != opts.secure ? opts.secure : typeof location !== "undefined" && "https:" === location.protocol;
      if (opts.hostname && !opts.port) {
        opts.port = this.secure ? "443" : "80";
      }
      this.hostname = opts.hostname || (typeof location !== "undefined" ? location.hostname : "localhost");
      this.port = opts.port || (typeof location !== "undefined" && location.port ? location.port : this.secure ? "443" : "80");
      this.transports = [];
      this._transportsByName = {};
      opts.transports.forEach((t2) => {
        const transportName = t2.prototype.name;
        this.transports.push(transportName);
        this._transportsByName[transportName] = t2;
      });
      this.opts = Object.assign({
        path: "/engine.io",
        agent: false,
        withCredentials: false,
        upgrade: true,
        timestampParam: "t",
        rememberUpgrade: false,
        addTrailingSlash: true,
        rejectUnauthorized: true,
        perMessageDeflate: {
          threshold: 1024
        },
        transportOptions: {},
        closeOnBeforeunload: false
      }, opts);
      this.opts.path = this.opts.path.replace(/\/$/, "") + (this.opts.addTrailingSlash ? "/" : "");
      if (typeof this.opts.query === "string") {
        this.opts.query = decode(this.opts.query);
      }
      if (withEventListeners) {
        if (this.opts.closeOnBeforeunload) {
          this._beforeunloadEventListener = () => {
            if (this.transport) {
              this.transport.removeAllListeners();
              this.transport.close();
            }
          };
          addEventListener("beforeunload", this._beforeunloadEventListener, false);
        }
        if (this.hostname !== "localhost") {
          this._offlineEventListener = () => {
            this._onClose("transport close", {
              description: "network connection lost"
            });
          };
          OFFLINE_EVENT_LISTENERS.push(this._offlineEventListener);
        }
      }
      if (this.opts.withCredentials) {
        this._cookieJar = createCookieJar();
      }
      this._open();
    }
    /**
     * Creates transport of the given type.
     *
     * @param {String} name - transport name
     * @return {Transport}
     * @private
     */
    createTransport(name) {
      const query = Object.assign({}, this.opts.query);
      query.EIO = protocol$1;
      query.transport = name;
      if (this.id)
        query.sid = this.id;
      const opts = Object.assign({}, this.opts, {
        query,
        socket: this,
        hostname: this.hostname,
        secure: this.secure,
        port: this.port
      }, this.opts.transportOptions[name]);
      return new this._transportsByName[name](opts);
    }
    /**
     * Initializes transport to use and starts probe.
     *
     * @private
     */
    _open() {
      if (this.transports.length === 0) {
        this.setTimeoutFn(() => {
          this.emitReserved("error", "No transports available");
        }, 0);
        return;
      }
      const transportName = this.opts.rememberUpgrade && SocketWithoutUpgrade.priorWebsocketSuccess && this.transports.indexOf("websocket") !== -1 ? "websocket" : this.transports[0];
      this.readyState = "opening";
      const transport = this.createTransport(transportName);
      transport.open();
      this.setTransport(transport);
    }
    /**
     * Sets the current transport. Disables the existing one (if any).
     *
     * @private
     */
    setTransport(transport) {
      if (this.transport) {
        this.transport.removeAllListeners();
      }
      this.transport = transport;
      transport.on("drain", this._onDrain.bind(this)).on("packet", this._onPacket.bind(this)).on("error", this._onError.bind(this)).on("close", (reason) => this._onClose("transport close", reason));
    }
    /**
     * Called when connection is deemed open.
     *
     * @private
     */
    onOpen() {
      this.readyState = "open";
      SocketWithoutUpgrade.priorWebsocketSuccess = "websocket" === this.transport.name;
      this.emitReserved("open");
      this.flush();
    }
    /**
     * Handles a packet.
     *
     * @private
     */
    _onPacket(packet) {
      if ("opening" === this.readyState || "open" === this.readyState || "closing" === this.readyState) {
        this.emitReserved("packet", packet);
        this.emitReserved("heartbeat");
        switch (packet.type) {
          case "open":
            this.onHandshake(JSON.parse(packet.data));
            break;
          case "ping":
            this._sendPacket("pong");
            this.emitReserved("ping");
            this.emitReserved("pong");
            this._resetPingTimeout();
            break;
          case "error":
            const err = new Error("server error");
            err.code = packet.data;
            this._onError(err);
            break;
          case "message":
            this.emitReserved("data", packet.data);
            this.emitReserved("message", packet.data);
            break;
        }
      }
    }
    /**
     * Called upon handshake completion.
     *
     * @param {Object} data - handshake obj
     * @private
     */
    onHandshake(data) {
      this.emitReserved("handshake", data);
      this.id = data.sid;
      this.transport.query.sid = data.sid;
      this._pingInterval = data.pingInterval;
      this._pingTimeout = data.pingTimeout;
      this._maxPayload = data.maxPayload;
      this.onOpen();
      if ("closed" === this.readyState)
        return;
      this._resetPingTimeout();
    }
    /**
     * Sets and resets ping timeout timer based on server pings.
     *
     * @private
     */
    _resetPingTimeout() {
      this.clearTimeoutFn(this._pingTimeoutTimer);
      const delay = this._pingInterval + this._pingTimeout;
      this._pingTimeoutTime = Date.now() + delay;
      this._pingTimeoutTimer = this.setTimeoutFn(() => {
        this._onClose("ping timeout");
      }, delay);
      if (this.opts.autoUnref) {
        this._pingTimeoutTimer.unref();
      }
    }
    /**
     * Called on `drain` event
     *
     * @private
     */
    _onDrain() {
      this.writeBuffer.splice(0, this._prevBufferLen);
      this._prevBufferLen = 0;
      if (0 === this.writeBuffer.length) {
        this.emitReserved("drain");
      } else {
        this.flush();
      }
    }
    /**
     * Flush write buffers.
     *
     * @private
     */
    flush() {
      if ("closed" !== this.readyState && this.transport.writable && !this.upgrading && this.writeBuffer.length) {
        const packets = this._getWritablePackets();
        this.transport.send(packets);
        this._prevBufferLen = packets.length;
        this.emitReserved("flush");
      }
    }
    /**
     * Ensure the encoded size of the writeBuffer is below the maxPayload value sent by the server (only for HTTP
     * long-polling)
     *
     * @private
     */
    _getWritablePackets() {
      const shouldCheckPayloadSize = this._maxPayload && this.transport.name === "polling" && this.writeBuffer.length > 1;
      if (!shouldCheckPayloadSize) {
        return this.writeBuffer;
      }
      let payloadSize = 1;
      for (let i2 = 0; i2 < this.writeBuffer.length; i2++) {
        const data = this.writeBuffer[i2].data;
        if (data) {
          payloadSize += byteLength(data);
        }
        if (i2 > 0 && payloadSize > this._maxPayload) {
          return this.writeBuffer.slice(0, i2);
        }
        payloadSize += 2;
      }
      return this.writeBuffer;
    }
    /**
     * Checks whether the heartbeat timer has expired but the socket has not yet been notified.
     *
     * Note: this method is private for now because it does not really fit the WebSocket API, but if we put it in the
     * `write()` method then the message would not be buffered by the Socket.IO client.
     *
     * @return {boolean}
     * @private
     */
    /* private */
    _hasPingExpired() {
      if (!this._pingTimeoutTime)
        return true;
      const hasExpired = Date.now() > this._pingTimeoutTime;
      if (hasExpired) {
        this._pingTimeoutTime = 0;
        nextTick(() => {
          this._onClose("ping timeout");
        }, this.setTimeoutFn);
      }
      return hasExpired;
    }
    /**
     * Sends a message.
     *
     * @param {String} msg - message.
     * @param {Object} options.
     * @param {Function} fn - callback function.
     * @return {Socket} for chaining.
     */
    write(msg, options, fn2) {
      this._sendPacket("message", msg, options, fn2);
      return this;
    }
    /**
     * Sends a message. Alias of {@link Socket#write}.
     *
     * @param {String} msg - message.
     * @param {Object} options.
     * @param {Function} fn - callback function.
     * @return {Socket} for chaining.
     */
    send(msg, options, fn2) {
      this._sendPacket("message", msg, options, fn2);
      return this;
    }
    /**
     * Sends a packet.
     *
     * @param {String} type: packet type.
     * @param {String} data.
     * @param {Object} options.
     * @param {Function} fn - callback function.
     * @private
     */
    _sendPacket(type, data, options, fn2) {
      if ("function" === typeof data) {
        fn2 = data;
        data = void 0;
      }
      if ("function" === typeof options) {
        fn2 = options;
        options = null;
      }
      if ("closing" === this.readyState || "closed" === this.readyState) {
        return;
      }
      options = options || {};
      options.compress = false !== options.compress;
      const packet = {
        type,
        data,
        options
      };
      this.emitReserved("packetCreate", packet);
      this.writeBuffer.push(packet);
      if (fn2)
        this.once("flush", fn2);
      this.flush();
    }
    /**
     * Closes the connection.
     */
    close() {
      const close = () => {
        this._onClose("forced close");
        this.transport.close();
      };
      const cleanupAndClose = () => {
        this.off("upgrade", cleanupAndClose);
        this.off("upgradeError", cleanupAndClose);
        close();
      };
      const waitForUpgrade = () => {
        this.once("upgrade", cleanupAndClose);
        this.once("upgradeError", cleanupAndClose);
      };
      if ("opening" === this.readyState || "open" === this.readyState) {
        this.readyState = "closing";
        if (this.writeBuffer.length) {
          this.once("drain", () => {
            if (this.upgrading) {
              waitForUpgrade();
            } else {
              close();
            }
          });
        } else if (this.upgrading) {
          waitForUpgrade();
        } else {
          close();
        }
      }
      return this;
    }
    /**
     * Called upon transport error
     *
     * @private
     */
    _onError(err) {
      SocketWithoutUpgrade.priorWebsocketSuccess = false;
      if (this.opts.tryAllTransports && this.transports.length > 1 && this.readyState === "opening") {
        this.transports.shift();
        return this._open();
      }
      this.emitReserved("error", err);
      this._onClose("transport error", err);
    }
    /**
     * Called upon transport close.
     *
     * @private
     */
    _onClose(reason, description) {
      if ("opening" === this.readyState || "open" === this.readyState || "closing" === this.readyState) {
        this.clearTimeoutFn(this._pingTimeoutTimer);
        this.transport.removeAllListeners("close");
        this.transport.close();
        this.transport.removeAllListeners();
        if (withEventListeners) {
          if (this._beforeunloadEventListener) {
            removeEventListener("beforeunload", this._beforeunloadEventListener, false);
          }
          if (this._offlineEventListener) {
            const i2 = OFFLINE_EVENT_LISTENERS.indexOf(this._offlineEventListener);
            if (i2 !== -1) {
              OFFLINE_EVENT_LISTENERS.splice(i2, 1);
            }
          }
        }
        this.readyState = "closed";
        this.id = null;
        this.emitReserved("close", reason, description);
        this.writeBuffer = [];
        this._prevBufferLen = 0;
      }
    }
  }
  SocketWithoutUpgrade.protocol = protocol$1;
  class SocketWithUpgrade extends SocketWithoutUpgrade {
    constructor() {
      super(...arguments);
      this._upgrades = [];
    }
    onOpen() {
      super.onOpen();
      if ("open" === this.readyState && this.opts.upgrade) {
        for (let i2 = 0; i2 < this._upgrades.length; i2++) {
          this._probe(this._upgrades[i2]);
        }
      }
    }
    /**
     * Probes a transport.
     *
     * @param {String} name - transport name
     * @private
     */
    _probe(name) {
      let transport = this.createTransport(name);
      let failed = false;
      SocketWithoutUpgrade.priorWebsocketSuccess = false;
      const onTransportOpen = () => {
        if (failed)
          return;
        transport.send([{ type: "ping", data: "probe" }]);
        transport.once("packet", (msg) => {
          if (failed)
            return;
          if ("pong" === msg.type && "probe" === msg.data) {
            this.upgrading = true;
            this.emitReserved("upgrading", transport);
            if (!transport)
              return;
            SocketWithoutUpgrade.priorWebsocketSuccess = "websocket" === transport.name;
            this.transport.pause(() => {
              if (failed)
                return;
              if ("closed" === this.readyState)
                return;
              cleanup();
              this.setTransport(transport);
              transport.send([{ type: "upgrade" }]);
              this.emitReserved("upgrade", transport);
              transport = null;
              this.upgrading = false;
              this.flush();
            });
          } else {
            const err = new Error("probe error");
            err.transport = transport.name;
            this.emitReserved("upgradeError", err);
          }
        });
      };
      function freezeTransport() {
        if (failed)
          return;
        failed = true;
        cleanup();
        transport.close();
        transport = null;
      }
      const onerror = (err) => {
        const error = new Error("probe error: " + err);
        error.transport = transport.name;
        freezeTransport();
        this.emitReserved("upgradeError", error);
      };
      function onTransportClose() {
        onerror("transport closed");
      }
      function onclose() {
        onerror("socket closed");
      }
      function onupgrade(to) {
        if (transport && to.name !== transport.name) {
          freezeTransport();
        }
      }
      const cleanup = () => {
        transport.removeListener("open", onTransportOpen);
        transport.removeListener("error", onerror);
        transport.removeListener("close", onTransportClose);
        this.off("close", onclose);
        this.off("upgrading", onupgrade);
      };
      transport.once("open", onTransportOpen);
      transport.once("error", onerror);
      transport.once("close", onTransportClose);
      this.once("close", onclose);
      this.once("upgrading", onupgrade);
      if (this._upgrades.indexOf("webtransport") !== -1 && name !== "webtransport") {
        this.setTimeoutFn(() => {
          if (!failed) {
            transport.open();
          }
        }, 200);
      } else {
        transport.open();
      }
    }
    onHandshake(data) {
      this._upgrades = this._filterUpgrades(data.upgrades);
      super.onHandshake(data);
    }
    /**
     * Filters upgrades, returning only those matching client transports.
     *
     * @param {Array} upgrades - server upgrades
     * @private
     */
    _filterUpgrades(upgrades) {
      const filteredUpgrades = [];
      for (let i2 = 0; i2 < upgrades.length; i2++) {
        if (~this.transports.indexOf(upgrades[i2]))
          filteredUpgrades.push(upgrades[i2]);
      }
      return filteredUpgrades;
    }
  }
  let Socket$1 = class Socket extends SocketWithUpgrade {
    constructor(uri, opts = {}) {
      const o2 = typeof uri === "object" ? uri : opts;
      if (!o2.transports || o2.transports && typeof o2.transports[0] === "string") {
        o2.transports = (o2.transports || ["polling", "websocket", "webtransport"]).map((transportName) => transports[transportName]).filter((t2) => !!t2);
      }
      super(uri, o2);
    }
  };
  function url(uri, path = "", loc) {
    let obj = uri;
    loc = loc || typeof location !== "undefined" && location;
    if (null == uri)
      uri = loc.protocol + "//" + loc.host;
    if (typeof uri === "string") {
      if ("/" === uri.charAt(0)) {
        if ("/" === uri.charAt(1)) {
          uri = loc.protocol + uri;
        } else {
          uri = loc.host + uri;
        }
      }
      if (!/^(https?|wss?):\/\//.test(uri)) {
        if ("undefined" !== typeof loc) {
          uri = loc.protocol + "//" + uri;
        } else {
          uri = "https://" + uri;
        }
      }
      obj = parse(uri);
    }
    if (!obj.port) {
      if (/^(http|ws)$/.test(obj.protocol)) {
        obj.port = "80";
      } else if (/^(http|ws)s$/.test(obj.protocol)) {
        obj.port = "443";
      }
    }
    obj.path = obj.path || "/";
    const ipv6 = obj.host.indexOf(":") !== -1;
    const host = ipv6 ? "[" + obj.host + "]" : obj.host;
    obj.id = obj.protocol + "://" + host + ":" + obj.port + path;
    obj.href = obj.protocol + "://" + host + (loc && loc.port === obj.port ? "" : ":" + obj.port);
    return obj;
  }
  const withNativeArrayBuffer = typeof ArrayBuffer === "function";
  const isView = (obj) => {
    return typeof ArrayBuffer.isView === "function" ? ArrayBuffer.isView(obj) : obj.buffer instanceof ArrayBuffer;
  };
  const toString = Object.prototype.toString;
  const withNativeBlob = typeof Blob === "function" || typeof Blob !== "undefined" && toString.call(Blob) === "[object BlobConstructor]";
  const withNativeFile = typeof File === "function" || typeof File !== "undefined" && toString.call(File) === "[object FileConstructor]";
  function isBinary(obj) {
    return withNativeArrayBuffer && (obj instanceof ArrayBuffer || isView(obj)) || withNativeBlob && obj instanceof Blob || withNativeFile && obj instanceof File;
  }
  function hasBinary(obj, toJSON) {
    if (!obj || typeof obj !== "object") {
      return false;
    }
    if (Array.isArray(obj)) {
      for (let i2 = 0, l2 = obj.length; i2 < l2; i2++) {
        if (hasBinary(obj[i2])) {
          return true;
        }
      }
      return false;
    }
    if (isBinary(obj)) {
      return true;
    }
    if (obj.toJSON && typeof obj.toJSON === "function" && arguments.length === 1) {
      return hasBinary(obj.toJSON(), true);
    }
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key) && hasBinary(obj[key])) {
        return true;
      }
    }
    return false;
  }
  function deconstructPacket(packet) {
    const buffers = [];
    const packetData = packet.data;
    const pack = packet;
    pack.data = _deconstructPacket(packetData, buffers);
    pack.attachments = buffers.length;
    return { packet: pack, buffers };
  }
  function _deconstructPacket(data, buffers) {
    if (!data)
      return data;
    if (isBinary(data)) {
      const placeholder = { _placeholder: true, num: buffers.length };
      buffers.push(data);
      return placeholder;
    } else if (Array.isArray(data)) {
      const newData = new Array(data.length);
      for (let i2 = 0; i2 < data.length; i2++) {
        newData[i2] = _deconstructPacket(data[i2], buffers);
      }
      return newData;
    } else if (typeof data === "object" && !(data instanceof Date)) {
      const newData = {};
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          newData[key] = _deconstructPacket(data[key], buffers);
        }
      }
      return newData;
    }
    return data;
  }
  function reconstructPacket(packet, buffers) {
    packet.data = _reconstructPacket(packet.data, buffers);
    delete packet.attachments;
    return packet;
  }
  function _reconstructPacket(data, buffers) {
    if (!data)
      return data;
    if (data && data._placeholder === true) {
      const isIndexValid = typeof data.num === "number" && data.num >= 0 && data.num < buffers.length;
      if (isIndexValid) {
        return buffers[data.num];
      } else {
        throw new Error("illegal attachments");
      }
    } else if (Array.isArray(data)) {
      for (let i2 = 0; i2 < data.length; i2++) {
        data[i2] = _reconstructPacket(data[i2], buffers);
      }
    } else if (typeof data === "object") {
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          data[key] = _reconstructPacket(data[key], buffers);
        }
      }
    }
    return data;
  }
  function getDefaultExportFromCjs(x2) {
    return x2 && x2.__esModule && Object.prototype.hasOwnProperty.call(x2, "default") ? x2["default"] : x2;
  }
  var browser = { exports: {} };
  var ms$1;
  var hasRequiredMs;
  function requireMs() {
    if (hasRequiredMs)
      return ms$1;
    hasRequiredMs = 1;
    var s2 = 1e3;
    var m2 = s2 * 60;
    var h2 = m2 * 60;
    var d2 = h2 * 24;
    var w2 = d2 * 7;
    var y2 = d2 * 365.25;
    ms$1 = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse2(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse2(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n2 = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n2 * y2;
        case "weeks":
        case "week":
        case "w":
          return n2 * w2;
        case "days":
        case "day":
        case "d":
          return n2 * d2;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n2 * h2;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n2 * m2;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n2 * s2;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n2;
        default:
          return void 0;
      }
    }
    function fmtShort(ms2) {
      var msAbs = Math.abs(ms2);
      if (msAbs >= d2) {
        return Math.round(ms2 / d2) + "d";
      }
      if (msAbs >= h2) {
        return Math.round(ms2 / h2) + "h";
      }
      if (msAbs >= m2) {
        return Math.round(ms2 / m2) + "m";
      }
      if (msAbs >= s2) {
        return Math.round(ms2 / s2) + "s";
      }
      return ms2 + "ms";
    }
    function fmtLong(ms2) {
      var msAbs = Math.abs(ms2);
      if (msAbs >= d2) {
        return plural(ms2, msAbs, d2, "day");
      }
      if (msAbs >= h2) {
        return plural(ms2, msAbs, h2, "hour");
      }
      if (msAbs >= m2) {
        return plural(ms2, msAbs, m2, "minute");
      }
      if (msAbs >= s2) {
        return plural(ms2, msAbs, s2, "second");
      }
      return ms2 + " ms";
    }
    function plural(ms2, msAbs, n2, name) {
      var isPlural = msAbs >= n2 * 1.5;
      return Math.round(ms2 / n2) + " " + name + (isPlural ? "s" : "");
    }
    return ms$1;
  }
  function setup(env) {
    createDebug.debug = createDebug;
    createDebug.default = createDebug;
    createDebug.coerce = coerce;
    createDebug.disable = disable;
    createDebug.enable = enable;
    createDebug.enabled = enabled;
    createDebug.humanize = requireMs();
    createDebug.destroy = destroy;
    Object.keys(env).forEach((key) => {
      createDebug[key] = env[key];
    });
    createDebug.names = [];
    createDebug.skips = [];
    createDebug.formatters = {};
    function selectColor(namespace) {
      let hash = 0;
      for (let i2 = 0; i2 < namespace.length; i2++) {
        hash = (hash << 5) - hash + namespace.charCodeAt(i2);
        hash |= 0;
      }
      return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    }
    createDebug.selectColor = selectColor;
    function createDebug(namespace) {
      let prevTime;
      let enableOverride = null;
      let namespacesCache;
      let enabledCache;
      function debug2(...args) {
        if (!debug2.enabled) {
          return;
        }
        const self2 = debug2;
        const curr = Number(/* @__PURE__ */ new Date());
        const ms2 = curr - (prevTime || curr);
        self2.diff = ms2;
        self2.prev = prevTime;
        self2.curr = curr;
        prevTime = curr;
        args[0] = createDebug.coerce(args[0]);
        if (typeof args[0] !== "string") {
          args.unshift("%O");
        }
        let index = 0;
        args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
          if (match === "%%") {
            return "%";
          }
          index++;
          const formatter = createDebug.formatters[format];
          if (typeof formatter === "function") {
            const val = args[index];
            match = formatter.call(self2, val);
            args.splice(index, 1);
            index--;
          }
          return match;
        });
        createDebug.formatArgs.call(self2, args);
        const logFn = self2.log || createDebug.log;
        logFn.apply(self2, args);
      }
      debug2.namespace = namespace;
      debug2.useColors = createDebug.useColors();
      debug2.color = createDebug.selectColor(namespace);
      debug2.extend = extend;
      debug2.destroy = createDebug.destroy;
      Object.defineProperty(debug2, "enabled", {
        enumerable: true,
        configurable: false,
        get: () => {
          if (enableOverride !== null) {
            return enableOverride;
          }
          if (namespacesCache !== createDebug.namespaces) {
            namespacesCache = createDebug.namespaces;
            enabledCache = createDebug.enabled(namespace);
          }
          return enabledCache;
        },
        set: (v2) => {
          enableOverride = v2;
        }
      });
      if (typeof createDebug.init === "function") {
        createDebug.init(debug2);
      }
      return debug2;
    }
    function extend(namespace, delimiter) {
      const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
      newDebug.log = this.log;
      return newDebug;
    }
    function enable(namespaces) {
      createDebug.save(namespaces);
      createDebug.namespaces = namespaces;
      createDebug.names = [];
      createDebug.skips = [];
      const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
      for (const ns of split) {
        if (ns[0] === "-") {
          createDebug.skips.push(ns.slice(1));
        } else {
          createDebug.names.push(ns);
        }
      }
    }
    function matchesTemplate(search, template) {
      let searchIndex = 0;
      let templateIndex = 0;
      let starIndex = -1;
      let matchIndex = 0;
      while (searchIndex < search.length) {
        if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
          if (template[templateIndex] === "*") {
            starIndex = templateIndex;
            matchIndex = searchIndex;
            templateIndex++;
          } else {
            searchIndex++;
            templateIndex++;
          }
        } else if (starIndex !== -1) {
          templateIndex = starIndex + 1;
          matchIndex++;
          searchIndex = matchIndex;
        } else {
          return false;
        }
      }
      while (templateIndex < template.length && template[templateIndex] === "*") {
        templateIndex++;
      }
      return templateIndex === template.length;
    }
    function disable() {
      const namespaces = [
        ...createDebug.names,
        ...createDebug.skips.map((namespace) => "-" + namespace)
      ].join(",");
      createDebug.enable("");
      return namespaces;
    }
    function enabled(name) {
      for (const skip of createDebug.skips) {
        if (matchesTemplate(name, skip)) {
          return false;
        }
      }
      for (const ns of createDebug.names) {
        if (matchesTemplate(name, ns)) {
          return true;
        }
      }
      return false;
    }
    function coerce(val) {
      if (val instanceof Error) {
        return val.stack || val.message;
      }
      return val;
    }
    function destroy() {
      formatAppLog("warn", "at node_modules/debug/src/common.js:284", "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    createDebug.enable(createDebug.load());
    return createDebug;
  }
  var common = setup;
  (function(module, exports) {
    var define_process_env_default = {};
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.storage = localstorage();
    exports.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          formatAppLog("warn", "at node_modules/debug/src/browser.js:18", "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      let m2;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && (m2 = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m2[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c2 = "color: " + this.color;
      args.splice(1, 0, c2, "color: inherit");
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        if (match === "%%") {
          return;
        }
        index++;
        if (match === "%c") {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c2);
    }
    exports.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        if (namespaces) {
          exports.storage.setItem("debug", namespaces);
        } else {
          exports.storage.removeItem("debug");
        }
      } catch (error) {
      }
    }
    function load() {
      let r2;
      try {
        r2 = exports.storage.getItem("debug") || exports.storage.getItem("DEBUG");
      } catch (error) {
      }
      if (!r2 && typeof process !== "undefined" && "env" in process) {
        r2 = define_process_env_default.DEBUG;
      }
      return r2;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch (error) {
      }
    }
    module.exports = common(exports);
    const { formatters } = module.exports;
    formatters.j = function(v2) {
      try {
        return JSON.stringify(v2);
      } catch (error) {
        return "[UnexpectedJSONParseError]: " + error.message;
      }
    };
  })(browser, browser.exports);
  var browserExports = browser.exports;
  const debugModule = /* @__PURE__ */ getDefaultExportFromCjs(browserExports);
  const debug = debugModule("socket.io-parser");
  const RESERVED_EVENTS$1 = [
    "connect",
    // used on the client side
    "connect_error",
    // used on the client side
    "disconnect",
    // used on both sides
    "disconnecting",
    // used on the server side
    "newListener",
    // used by the Node.js EventEmitter
    "removeListener"
    // used by the Node.js EventEmitter
  ];
  const protocol = 5;
  var PacketType;
  (function(PacketType2) {
    PacketType2[PacketType2["CONNECT"] = 0] = "CONNECT";
    PacketType2[PacketType2["DISCONNECT"] = 1] = "DISCONNECT";
    PacketType2[PacketType2["EVENT"] = 2] = "EVENT";
    PacketType2[PacketType2["ACK"] = 3] = "ACK";
    PacketType2[PacketType2["CONNECT_ERROR"] = 4] = "CONNECT_ERROR";
    PacketType2[PacketType2["BINARY_EVENT"] = 5] = "BINARY_EVENT";
    PacketType2[PacketType2["BINARY_ACK"] = 6] = "BINARY_ACK";
  })(PacketType || (PacketType = {}));
  class Encoder {
    /**
     * Encoder constructor
     *
     * @param {function} replacer - custom replacer to pass down to JSON.parse
     */
    constructor(replacer) {
      this.replacer = replacer;
    }
    /**
     * Encode a packet as a single string if non-binary, or as a
     * buffer sequence, depending on packet type.
     *
     * @param {Object} obj - packet object
     */
    encode(obj) {
      debug("encoding packet %j", obj);
      if (obj.type === PacketType.EVENT || obj.type === PacketType.ACK) {
        if (hasBinary(obj)) {
          return this.encodeAsBinary({
            type: obj.type === PacketType.EVENT ? PacketType.BINARY_EVENT : PacketType.BINARY_ACK,
            nsp: obj.nsp,
            data: obj.data,
            id: obj.id
          });
        }
      }
      return [this.encodeAsString(obj)];
    }
    /**
     * Encode packet as string.
     */
    encodeAsString(obj) {
      let str = "" + obj.type;
      if (obj.type === PacketType.BINARY_EVENT || obj.type === PacketType.BINARY_ACK) {
        str += obj.attachments + "-";
      }
      if (obj.nsp && "/" !== obj.nsp) {
        str += obj.nsp + ",";
      }
      if (null != obj.id) {
        str += obj.id;
      }
      if (null != obj.data) {
        str += JSON.stringify(obj.data, this.replacer);
      }
      debug("encoded %j as %s", obj, str);
      return str;
    }
    /**
     * Encode packet as 'buffer sequence' by removing blobs, and
     * deconstructing packet into object with placeholders and
     * a list of buffers.
     */
    encodeAsBinary(obj) {
      const deconstruction = deconstructPacket(obj);
      const pack = this.encodeAsString(deconstruction.packet);
      const buffers = deconstruction.buffers;
      buffers.unshift(pack);
      return buffers;
    }
  }
  class Decoder extends Emitter {
    /**
     * Decoder constructor
     */
    constructor(opts) {
      super();
      this.opts = Object.assign({
        reviver: void 0,
        maxAttachments: 10
      }, typeof opts === "function" ? { reviver: opts } : opts);
    }
    /**
     * Decodes an encoded packet string into packet JSON.
     *
     * @param {String} obj - encoded packet
     */
    add(obj) {
      let packet;
      if (typeof obj === "string") {
        if (this.reconstructor) {
          throw new Error("got plaintext data when reconstructing a packet");
        }
        packet = this.decodeString(obj);
        const isBinaryEvent = packet.type === PacketType.BINARY_EVENT;
        if (isBinaryEvent || packet.type === PacketType.BINARY_ACK) {
          packet.type = isBinaryEvent ? PacketType.EVENT : PacketType.ACK;
          this.reconstructor = new BinaryReconstructor(packet);
          if (packet.attachments === 0) {
            super.emitReserved("decoded", packet);
          }
        } else {
          super.emitReserved("decoded", packet);
        }
      } else if (isBinary(obj) || obj.base64) {
        if (!this.reconstructor) {
          throw new Error("got binary data when not reconstructing a packet");
        } else {
          packet = this.reconstructor.takeBinaryData(obj);
          if (packet) {
            this.reconstructor = null;
            super.emitReserved("decoded", packet);
          }
        }
      } else {
        throw new Error("Unknown type: " + obj);
      }
    }
    /**
     * Decode a packet String (JSON data)
     *
     * @param {String} str
     * @return {Object} packet
     */
    decodeString(str) {
      let i2 = 0;
      const p2 = {
        type: Number(str.charAt(0))
      };
      if (PacketType[p2.type] === void 0) {
        throw new Error("unknown packet type " + p2.type);
      }
      if (p2.type === PacketType.BINARY_EVENT || p2.type === PacketType.BINARY_ACK) {
        const start = i2 + 1;
        while (str.charAt(++i2) !== "-" && i2 != str.length) {
        }
        const buf = str.substring(start, i2);
        if (buf != Number(buf) || str.charAt(i2) !== "-") {
          throw new Error("Illegal attachments");
        }
        const n2 = Number(buf);
        if (!isInteger(n2) || n2 < 0) {
          throw new Error("Illegal attachments");
        } else if (n2 > this.opts.maxAttachments) {
          throw new Error("too many attachments");
        }
        p2.attachments = n2;
      }
      if ("/" === str.charAt(i2 + 1)) {
        const start = i2 + 1;
        while (++i2) {
          const c2 = str.charAt(i2);
          if ("," === c2)
            break;
          if (i2 === str.length)
            break;
        }
        p2.nsp = str.substring(start, i2);
      } else {
        p2.nsp = "/";
      }
      const next = str.charAt(i2 + 1);
      if ("" !== next && Number(next) == next) {
        const start = i2 + 1;
        while (++i2) {
          const c2 = str.charAt(i2);
          if (null == c2 || Number(c2) != c2) {
            --i2;
            break;
          }
          if (i2 === str.length)
            break;
        }
        p2.id = Number(str.substring(start, i2 + 1));
      }
      if (str.charAt(++i2)) {
        const payload = this.tryParse(str.substr(i2));
        if (Decoder.isPayloadValid(p2.type, payload)) {
          p2.data = payload;
        } else {
          throw new Error("invalid payload");
        }
      }
      debug("decoded %s as %j", str, p2);
      return p2;
    }
    tryParse(str) {
      try {
        return JSON.parse(str, this.opts.reviver);
      } catch (e2) {
        return false;
      }
    }
    static isPayloadValid(type, payload) {
      switch (type) {
        case PacketType.CONNECT:
          return isObject(payload);
        case PacketType.DISCONNECT:
          return payload === void 0;
        case PacketType.CONNECT_ERROR:
          return typeof payload === "string" || isObject(payload);
        case PacketType.EVENT:
        case PacketType.BINARY_EVENT:
          return Array.isArray(payload) && (typeof payload[0] === "number" || typeof payload[0] === "string" && RESERVED_EVENTS$1.indexOf(payload[0]) === -1);
        case PacketType.ACK:
        case PacketType.BINARY_ACK:
          return Array.isArray(payload);
      }
    }
    /**
     * Deallocates a parser's resources
     */
    destroy() {
      if (this.reconstructor) {
        this.reconstructor.finishedReconstruction();
        this.reconstructor = null;
      }
    }
  }
  class BinaryReconstructor {
    constructor(packet) {
      this.packet = packet;
      this.buffers = [];
      this.reconPack = packet;
    }
    /**
     * Method to be called when binary data received from connection
     * after a BINARY_EVENT packet.
     *
     * @param {Buffer | ArrayBuffer} binData - the raw binary data received
     * @return {null | Object} returns null if more binary data is expected or
     *   a reconstructed packet object if all buffers have been received.
     */
    takeBinaryData(binData) {
      this.buffers.push(binData);
      if (this.buffers.length === this.reconPack.attachments) {
        const packet = reconstructPacket(this.reconPack, this.buffers);
        this.finishedReconstruction();
        return packet;
      }
      return null;
    }
    /**
     * Cleans up binary packet reconstruction variables.
     */
    finishedReconstruction() {
      this.reconPack = null;
      this.buffers = [];
    }
  }
  function isNamespaceValid(nsp) {
    return typeof nsp === "string";
  }
  const isInteger = Number.isInteger || function(value2) {
    return typeof value2 === "number" && isFinite(value2) && Math.floor(value2) === value2;
  };
  function isAckIdValid(id) {
    return id === void 0 || isInteger(id);
  }
  function isObject(value2) {
    return Object.prototype.toString.call(value2) === "[object Object]";
  }
  function isDataValid(type, payload) {
    switch (type) {
      case PacketType.CONNECT:
        return payload === void 0 || isObject(payload);
      case PacketType.DISCONNECT:
        return payload === void 0;
      case PacketType.EVENT:
        return Array.isArray(payload) && (typeof payload[0] === "number" || typeof payload[0] === "string" && RESERVED_EVENTS$1.indexOf(payload[0]) === -1);
      case PacketType.ACK:
        return Array.isArray(payload);
      case PacketType.CONNECT_ERROR:
        return typeof payload === "string" || isObject(payload);
      default:
        return false;
    }
  }
  function isPacketValid(packet) {
    return isNamespaceValid(packet.nsp) && isAckIdValid(packet.id) && isDataValid(packet.type, packet.data);
  }
  const parser = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    Decoder,
    Encoder,
    get PacketType() {
      return PacketType;
    },
    isPacketValid,
    protocol
  }, Symbol.toStringTag, { value: "Module" }));
  function on$1(obj, ev, fn2) {
    obj.on(ev, fn2);
    return function subDestroy() {
      obj.off(ev, fn2);
    };
  }
  const RESERVED_EVENTS = Object.freeze({
    connect: 1,
    connect_error: 1,
    disconnect: 1,
    disconnecting: 1,
    // EventEmitter reserved events: https://nodejs.org/api/events.html#events_event_newlistener
    newListener: 1,
    removeListener: 1
  });
  class Socket extends Emitter {
    /**
     * `Socket` constructor.
     */
    constructor(io, nsp, opts) {
      super();
      this.connected = false;
      this.recovered = false;
      this.receiveBuffer = [];
      this.sendBuffer = [];
      this._queue = [];
      this._queueSeq = 0;
      this.ids = 0;
      this.acks = {};
      this.flags = {};
      this.io = io;
      this.nsp = nsp;
      if (opts && opts.auth) {
        this.auth = opts.auth;
      }
      this._opts = Object.assign({}, opts);
      if (this.io._autoConnect)
        this.open();
    }
    /**
     * Whether the socket is currently disconnected
     *
     * @example
     * const socket = io();
     *
     * socket.on("connect", () => {
     *   __f__('log','at node_modules/socket.io-client/build/esm/socket.js:129',socket.disconnected); // false
     * });
     *
     * socket.on("disconnect", () => {
     *   __f__('log','at node_modules/socket.io-client/build/esm/socket.js:133',socket.disconnected); // true
     * });
     */
    get disconnected() {
      return !this.connected;
    }
    /**
     * Subscribe to open, close and packet events
     *
     * @private
     */
    subEvents() {
      if (this.subs)
        return;
      const io = this.io;
      this.subs = [
        on$1(io, "open", this.onopen.bind(this)),
        on$1(io, "packet", this.onpacket.bind(this)),
        on$1(io, "error", this.onerror.bind(this)),
        on$1(io, "close", this.onclose.bind(this))
      ];
    }
    /**
     * Whether the Socket will try to reconnect when its Manager connects or reconnects.
     *
     * @example
     * const socket = io();
     *
     * __f__('log','at node_modules/socket.io-client/build/esm/socket.js:161',socket.active); // true
     *
     * socket.on("disconnect", (reason) => {
     *   if (reason === "io server disconnect") {
     *     // the disconnection was initiated by the server, you need to manually reconnect
     *     __f__('log','at node_modules/socket.io-client/build/esm/socket.js:166',socket.active); // false
     *   }
     *   // else the socket will automatically try to reconnect
     *   __f__('log','at node_modules/socket.io-client/build/esm/socket.js:169',socket.active); // true
     * });
     */
    get active() {
      return !!this.subs;
    }
    /**
     * "Opens" the socket.
     *
     * @example
     * const socket = io({
     *   autoConnect: false
     * });
     *
     * socket.connect();
     */
    connect() {
      if (this.connected)
        return this;
      this.subEvents();
      if (!this.io["_reconnecting"])
        this.io.open();
      if ("open" === this.io._readyState)
        this.onopen();
      return this;
    }
    /**
     * Alias for {@link connect()}.
     */
    open() {
      return this.connect();
    }
    /**
     * Sends a `message` event.
     *
     * This method mimics the WebSocket.send() method.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send
     *
     * @example
     * socket.send("hello");
     *
     * // this is equivalent to
     * socket.emit("message", "hello");
     *
     * @return self
     */
    send(...args) {
      args.unshift("message");
      this.emit.apply(this, args);
      return this;
    }
    /**
     * Override `emit`.
     * If the event is in `events`, it's emitted normally.
     *
     * @example
     * socket.emit("hello", "world");
     *
     * // all serializable datastructures are supported (no need to call JSON.stringify)
     * socket.emit("hello", 1, "2", { 3: ["4"], 5: Uint8Array.from([6]) });
     *
     * // with an acknowledgement from the server
     * socket.emit("hello", "world", (val) => {
     *   // ...
     * });
     *
     * @return self
     */
    emit(ev, ...args) {
      var _a, _b, _c;
      if (RESERVED_EVENTS.hasOwnProperty(ev)) {
        throw new Error('"' + ev.toString() + '" is a reserved event name');
      }
      args.unshift(ev);
      if (this._opts.retries && !this.flags.fromQueue && !this.flags.volatile) {
        this._addToQueue(args);
        return this;
      }
      const packet = {
        type: PacketType.EVENT,
        data: args
      };
      packet.options = {};
      packet.options.compress = this.flags.compress !== false;
      if ("function" === typeof args[args.length - 1]) {
        const id = this.ids++;
        const ack = args.pop();
        this._registerAckCallback(id, ack);
        packet.id = id;
      }
      const isTransportWritable = (_b = (_a = this.io.engine) === null || _a === void 0 ? void 0 : _a.transport) === null || _b === void 0 ? void 0 : _b.writable;
      const isConnected = this.connected && !((_c = this.io.engine) === null || _c === void 0 ? void 0 : _c._hasPingExpired());
      const discardPacket = this.flags.volatile && !isTransportWritable;
      if (discardPacket)
        ;
      else if (isConnected) {
        this.notifyOutgoingListeners(packet);
        this.packet(packet);
      } else {
        this.sendBuffer.push(packet);
      }
      this.flags = {};
      return this;
    }
    /**
     * @private
     */
    _registerAckCallback(id, ack) {
      var _a;
      const timeout = (_a = this.flags.timeout) !== null && _a !== void 0 ? _a : this._opts.ackTimeout;
      if (timeout === void 0) {
        this.acks[id] = ack;
        return;
      }
      const timer = this.io.setTimeoutFn(() => {
        delete this.acks[id];
        for (let i2 = 0; i2 < this.sendBuffer.length; i2++) {
          if (this.sendBuffer[i2].id === id) {
            this.sendBuffer.splice(i2, 1);
          }
        }
        ack.call(this, new Error("operation has timed out"));
      }, timeout);
      const fn2 = (...args) => {
        this.io.clearTimeoutFn(timer);
        ack.apply(this, args);
      };
      fn2.withError = true;
      this.acks[id] = fn2;
    }
    /**
     * Emits an event and waits for an acknowledgement
     *
     * @example
     * // without timeout
     * const response = await socket.emitWithAck("hello", "world");
     *
     * // with a specific timeout
     * try {
     *   const response = await socket.timeout(1000).emitWithAck("hello", "world");
     * } catch (err) {
     *   // the server did not acknowledge the event in the given delay
     * }
     *
     * @return a Promise that will be fulfilled when the server acknowledges the event
     */
    emitWithAck(ev, ...args) {
      return new Promise((resolve, reject) => {
        const fn2 = (arg1, arg2) => {
          return arg1 ? reject(arg1) : resolve(arg2);
        };
        fn2.withError = true;
        args.push(fn2);
        this.emit(ev, ...args);
      });
    }
    /**
     * Add the packet to the queue.
     * @param args
     * @private
     */
    _addToQueue(args) {
      let ack;
      if (typeof args[args.length - 1] === "function") {
        ack = args.pop();
      }
      const packet = {
        id: this._queueSeq++,
        tryCount: 0,
        pending: false,
        args,
        flags: Object.assign({ fromQueue: true }, this.flags)
      };
      args.push((err, ...responseArgs) => {
        if (packet !== this._queue[0])
          ;
        const hasError = err !== null;
        if (hasError) {
          if (packet.tryCount > this._opts.retries) {
            this._queue.shift();
            if (ack) {
              ack(err);
            }
          }
        } else {
          this._queue.shift();
          if (ack) {
            ack(null, ...responseArgs);
          }
        }
        packet.pending = false;
        return this._drainQueue();
      });
      this._queue.push(packet);
      this._drainQueue();
    }
    /**
     * Send the first packet of the queue, and wait for an acknowledgement from the server.
     * @param force - whether to resend a packet that has not been acknowledged yet
     *
     * @private
     */
    _drainQueue(force = false) {
      if (!this.connected || this._queue.length === 0) {
        return;
      }
      const packet = this._queue[0];
      if (packet.pending && !force) {
        return;
      }
      packet.pending = true;
      packet.tryCount++;
      this.flags = packet.flags;
      this.emit.apply(this, packet.args);
    }
    /**
     * Sends a packet.
     *
     * @param packet
     * @private
     */
    packet(packet) {
      packet.nsp = this.nsp;
      this.io._packet(packet);
    }
    /**
     * Called upon engine `open`.
     *
     * @private
     */
    onopen() {
      if (typeof this.auth == "function") {
        this.auth((data) => {
          this._sendConnectPacket(data);
        });
      } else {
        this._sendConnectPacket(this.auth);
      }
    }
    /**
     * Sends a CONNECT packet to initiate the Socket.IO session.
     *
     * @param data
     * @private
     */
    _sendConnectPacket(data) {
      this.packet({
        type: PacketType.CONNECT,
        data: this._pid ? Object.assign({ pid: this._pid, offset: this._lastOffset }, data) : data
      });
    }
    /**
     * Called upon engine or manager `error`.
     *
     * @param err
     * @private
     */
    onerror(err) {
      if (!this.connected) {
        this.emitReserved("connect_error", err);
      }
    }
    /**
     * Called upon engine `close`.
     *
     * @param reason
     * @param description
     * @private
     */
    onclose(reason, description) {
      this.connected = false;
      delete this.id;
      this.emitReserved("disconnect", reason, description);
      this._clearAcks();
    }
    /**
     * Clears the acknowledgement handlers upon disconnection, since the client will never receive an acknowledgement from
     * the server.
     *
     * @private
     */
    _clearAcks() {
      Object.keys(this.acks).forEach((id) => {
        const isBuffered = this.sendBuffer.some((packet) => String(packet.id) === id);
        if (!isBuffered) {
          const ack = this.acks[id];
          delete this.acks[id];
          if (ack.withError) {
            ack.call(this, new Error("socket has been disconnected"));
          }
        }
      });
    }
    /**
     * Called with socket packet.
     *
     * @param packet
     * @private
     */
    onpacket(packet) {
      const sameNamespace = packet.nsp === this.nsp;
      if (!sameNamespace)
        return;
      switch (packet.type) {
        case PacketType.CONNECT:
          if (packet.data && packet.data.sid) {
            this.onconnect(packet.data.sid, packet.data.pid);
          } else {
            this.emitReserved("connect_error", new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));
          }
          break;
        case PacketType.EVENT:
        case PacketType.BINARY_EVENT:
          this.onevent(packet);
          break;
        case PacketType.ACK:
        case PacketType.BINARY_ACK:
          this.onack(packet);
          break;
        case PacketType.DISCONNECT:
          this.ondisconnect();
          break;
        case PacketType.CONNECT_ERROR:
          this.destroy();
          const err = new Error(packet.data.message);
          err.data = packet.data.data;
          this.emitReserved("connect_error", err);
          break;
      }
    }
    /**
     * Called upon a server event.
     *
     * @param packet
     * @private
     */
    onevent(packet) {
      const args = packet.data || [];
      if (null != packet.id) {
        args.push(this.ack(packet.id));
      }
      if (this.connected) {
        this.emitEvent(args);
      } else {
        this.receiveBuffer.push(Object.freeze(args));
      }
    }
    emitEvent(args) {
      if (this._anyListeners && this._anyListeners.length) {
        const listeners = this._anyListeners.slice();
        for (const listener of listeners) {
          listener.apply(this, args);
        }
      }
      super.emit.apply(this, args);
      if (this._pid && args.length && typeof args[args.length - 1] === "string") {
        this._lastOffset = args[args.length - 1];
      }
    }
    /**
     * Produces an ack callback to emit with an event.
     *
     * @private
     */
    ack(id) {
      const self2 = this;
      let sent = false;
      return function(...args) {
        if (sent)
          return;
        sent = true;
        self2.packet({
          type: PacketType.ACK,
          id,
          data: args
        });
      };
    }
    /**
     * Called upon a server acknowledgement.
     *
     * @param packet
     * @private
     */
    onack(packet) {
      const ack = this.acks[packet.id];
      if (typeof ack !== "function") {
        return;
      }
      delete this.acks[packet.id];
      if (ack.withError) {
        packet.data.unshift(null);
      }
      ack.apply(this, packet.data);
    }
    /**
     * Called upon server connect.
     *
     * @private
     */
    onconnect(id, pid) {
      this.id = id;
      this.recovered = pid && this._pid === pid;
      this._pid = pid;
      this.connected = true;
      this.emitBuffered();
      this._drainQueue(true);
      this.emitReserved("connect");
    }
    /**
     * Emit buffered events (received and emitted).
     *
     * @private
     */
    emitBuffered() {
      this.receiveBuffer.forEach((args) => this.emitEvent(args));
      this.receiveBuffer = [];
      this.sendBuffer.forEach((packet) => {
        this.notifyOutgoingListeners(packet);
        this.packet(packet);
      });
      this.sendBuffer = [];
    }
    /**
     * Called upon server disconnect.
     *
     * @private
     */
    ondisconnect() {
      this.destroy();
      this.onclose("io server disconnect");
    }
    /**
     * Called upon forced client/server side disconnections,
     * this method ensures the manager stops tracking us and
     * that reconnections don't get triggered for this.
     *
     * @private
     */
    destroy() {
      if (this.subs) {
        this.subs.forEach((subDestroy) => subDestroy());
        this.subs = void 0;
      }
      this.io["_destroy"](this);
    }
    /**
     * Disconnects the socket manually. In that case, the socket will not try to reconnect.
     *
     * If this is the last active Socket instance of the {@link Manager}, the low-level connection will be closed.
     *
     * @example
     * const socket = io();
     *
     * socket.on("disconnect", (reason) => {
     *   // __f__('log','at node_modules/socket.io-client/build/esm/socket.js:641',reason); prints "io client disconnect"
     * });
     *
     * socket.disconnect();
     *
     * @return self
     */
    disconnect() {
      if (this.connected) {
        this.packet({ type: PacketType.DISCONNECT });
      }
      this.destroy();
      if (this.connected) {
        this.onclose("io client disconnect");
      }
      return this;
    }
    /**
     * Alias for {@link disconnect()}.
     *
     * @return self
     */
    close() {
      return this.disconnect();
    }
    /**
     * Sets the compress flag.
     *
     * @example
     * socket.compress(false).emit("hello");
     *
     * @param compress - if `true`, compresses the sending data
     * @return self
     */
    compress(compress) {
      this.flags.compress = compress;
      return this;
    }
    /**
     * Sets a modifier for a subsequent event emission that the event message will be dropped when this socket is not
     * ready to send messages.
     *
     * @example
     * socket.volatile.emit("hello"); // the server may or may not receive it
     *
     * @returns self
     */
    get volatile() {
      this.flags.volatile = true;
      return this;
    }
    /**
     * Sets a modifier for a subsequent event emission that the callback will be called with an error when the
     * given number of milliseconds have elapsed without an acknowledgement from the server:
     *
     * @example
     * socket.timeout(5000).emit("my-event", (err) => {
     *   if (err) {
     *     // the server did not acknowledge the event in the given delay
     *   }
     * });
     *
     * @returns self
     */
    timeout(timeout) {
      this.flags.timeout = timeout;
      return this;
    }
    /**
     * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
     * callback.
     *
     * @example
     * socket.onAny((event, ...args) => {
     *   __f__('log','at node_modules/socket.io-client/build/esm/socket.js:717',`got ${event}`);
     * });
     *
     * @param listener
     */
    onAny(listener) {
      this._anyListeners = this._anyListeners || [];
      this._anyListeners.push(listener);
      return this;
    }
    /**
     * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
     * callback. The listener is added to the beginning of the listeners array.
     *
     * @example
     * socket.prependAny((event, ...args) => {
     *   __f__('log','at node_modules/socket.io-client/build/esm/socket.js:733',`got event ${event}`);
     * });
     *
     * @param listener
     */
    prependAny(listener) {
      this._anyListeners = this._anyListeners || [];
      this._anyListeners.unshift(listener);
      return this;
    }
    /**
     * Removes the listener that will be fired when any event is emitted.
     *
     * @example
     * const catchAllListener = (event, ...args) => {
     *   __f__('log','at node_modules/socket.io-client/build/esm/socket.js:748',`got event ${event}`);
     * }
     *
     * socket.onAny(catchAllListener);
     *
     * // remove a specific listener
     * socket.offAny(catchAllListener);
     *
     * // or remove all listeners
     * socket.offAny();
     *
     * @param listener
     */
    offAny(listener) {
      if (!this._anyListeners) {
        return this;
      }
      if (listener) {
        const listeners = this._anyListeners;
        for (let i2 = 0; i2 < listeners.length; i2++) {
          if (listener === listeners[i2]) {
            listeners.splice(i2, 1);
            return this;
          }
        }
      } else {
        this._anyListeners = [];
      }
      return this;
    }
    /**
     * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
     * e.g. to remove listeners.
     */
    listenersAny() {
      return this._anyListeners || [];
    }
    /**
     * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
     * callback.
     *
     * Note: acknowledgements sent to the server are not included.
     *
     * @example
     * socket.onAnyOutgoing((event, ...args) => {
     *   __f__('log','at node_modules/socket.io-client/build/esm/socket.js:794',`sent event ${event}`);
     * });
     *
     * @param listener
     */
    onAnyOutgoing(listener) {
      this._anyOutgoingListeners = this._anyOutgoingListeners || [];
      this._anyOutgoingListeners.push(listener);
      return this;
    }
    /**
     * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
     * callback. The listener is added to the beginning of the listeners array.
     *
     * Note: acknowledgements sent to the server are not included.
     *
     * @example
     * socket.prependAnyOutgoing((event, ...args) => {
     *   __f__('log','at node_modules/socket.io-client/build/esm/socket.js:812',`sent event ${event}`);
     * });
     *
     * @param listener
     */
    prependAnyOutgoing(listener) {
      this._anyOutgoingListeners = this._anyOutgoingListeners || [];
      this._anyOutgoingListeners.unshift(listener);
      return this;
    }
    /**
     * Removes the listener that will be fired when any event is emitted.
     *
     * @example
     * const catchAllListener = (event, ...args) => {
     *   __f__('log','at node_modules/socket.io-client/build/esm/socket.js:827',`sent event ${event}`);
     * }
     *
     * socket.onAnyOutgoing(catchAllListener);
     *
     * // remove a specific listener
     * socket.offAnyOutgoing(catchAllListener);
     *
     * // or remove all listeners
     * socket.offAnyOutgoing();
     *
     * @param [listener] - the catch-all listener (optional)
     */
    offAnyOutgoing(listener) {
      if (!this._anyOutgoingListeners) {
        return this;
      }
      if (listener) {
        const listeners = this._anyOutgoingListeners;
        for (let i2 = 0; i2 < listeners.length; i2++) {
          if (listener === listeners[i2]) {
            listeners.splice(i2, 1);
            return this;
          }
        }
      } else {
        this._anyOutgoingListeners = [];
      }
      return this;
    }
    /**
     * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
     * e.g. to remove listeners.
     */
    listenersAnyOutgoing() {
      return this._anyOutgoingListeners || [];
    }
    /**
     * Notify the listeners for each packet sent
     *
     * @param packet
     *
     * @private
     */
    notifyOutgoingListeners(packet) {
      if (this._anyOutgoingListeners && this._anyOutgoingListeners.length) {
        const listeners = this._anyOutgoingListeners.slice();
        for (const listener of listeners) {
          listener.apply(this, packet.data);
        }
      }
    }
  }
  function Backoff(opts) {
    opts = opts || {};
    this.ms = opts.min || 100;
    this.max = opts.max || 1e4;
    this.factor = opts.factor || 2;
    this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
    this.attempts = 0;
  }
  Backoff.prototype.duration = function() {
    var ms2 = this.ms * Math.pow(this.factor, this.attempts++);
    if (this.jitter) {
      var rand = Math.random();
      var deviation = Math.floor(rand * this.jitter * ms2);
      ms2 = (Math.floor(rand * 10) & 1) == 0 ? ms2 - deviation : ms2 + deviation;
    }
    return Math.min(ms2, this.max) | 0;
  };
  Backoff.prototype.reset = function() {
    this.attempts = 0;
  };
  Backoff.prototype.setMin = function(min) {
    this.ms = min;
  };
  Backoff.prototype.setMax = function(max) {
    this.max = max;
  };
  Backoff.prototype.setJitter = function(jitter) {
    this.jitter = jitter;
  };
  class Manager extends Emitter {
    constructor(uri, opts) {
      var _a;
      super();
      this.nsps = {};
      this.subs = [];
      if (uri && "object" === typeof uri) {
        opts = uri;
        uri = void 0;
      }
      opts = opts || {};
      opts.path = opts.path || "/socket.io";
      this.opts = opts;
      installTimerFunctions(this, opts);
      this.reconnection(opts.reconnection !== false);
      this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
      this.reconnectionDelay(opts.reconnectionDelay || 1e3);
      this.reconnectionDelayMax(opts.reconnectionDelayMax || 5e3);
      this.randomizationFactor((_a = opts.randomizationFactor) !== null && _a !== void 0 ? _a : 0.5);
      this.backoff = new Backoff({
        min: this.reconnectionDelay(),
        max: this.reconnectionDelayMax(),
        jitter: this.randomizationFactor()
      });
      this.timeout(null == opts.timeout ? 2e4 : opts.timeout);
      this._readyState = "closed";
      this.uri = uri;
      const _parser = opts.parser || parser;
      this.encoder = new _parser.Encoder();
      this.decoder = new _parser.Decoder();
      this._autoConnect = opts.autoConnect !== false;
      if (this._autoConnect)
        this.open();
    }
    reconnection(v2) {
      if (!arguments.length)
        return this._reconnection;
      this._reconnection = !!v2;
      if (!v2) {
        this.skipReconnect = true;
      }
      return this;
    }
    reconnectionAttempts(v2) {
      if (v2 === void 0)
        return this._reconnectionAttempts;
      this._reconnectionAttempts = v2;
      return this;
    }
    reconnectionDelay(v2) {
      var _a;
      if (v2 === void 0)
        return this._reconnectionDelay;
      this._reconnectionDelay = v2;
      (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMin(v2);
      return this;
    }
    randomizationFactor(v2) {
      var _a;
      if (v2 === void 0)
        return this._randomizationFactor;
      this._randomizationFactor = v2;
      (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setJitter(v2);
      return this;
    }
    reconnectionDelayMax(v2) {
      var _a;
      if (v2 === void 0)
        return this._reconnectionDelayMax;
      this._reconnectionDelayMax = v2;
      (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMax(v2);
      return this;
    }
    timeout(v2) {
      if (!arguments.length)
        return this._timeout;
      this._timeout = v2;
      return this;
    }
    /**
     * Starts trying to reconnect if reconnection is enabled and we have not
     * started reconnecting yet
     *
     * @private
     */
    maybeReconnectOnOpen() {
      if (!this._reconnecting && this._reconnection && this.backoff.attempts === 0) {
        this.reconnect();
      }
    }
    /**
     * Sets the current transport `socket`.
     *
     * @param {Function} fn - optional, callback
     * @return self
     * @public
     */
    open(fn2) {
      if (~this._readyState.indexOf("open"))
        return this;
      this.engine = new Socket$1(this.uri, this.opts);
      const socket2 = this.engine;
      const self2 = this;
      this._readyState = "opening";
      this.skipReconnect = false;
      const openSubDestroy = on$1(socket2, "open", function() {
        self2.onopen();
        fn2 && fn2();
      });
      const onError = (err) => {
        this.cleanup();
        this._readyState = "closed";
        this.emitReserved("error", err);
        if (fn2) {
          fn2(err);
        } else {
          this.maybeReconnectOnOpen();
        }
      };
      const errorSub = on$1(socket2, "error", onError);
      if (false !== this._timeout) {
        const timeout = this._timeout;
        const timer = this.setTimeoutFn(() => {
          openSubDestroy();
          onError(new Error("timeout"));
          socket2.close();
        }, timeout);
        if (this.opts.autoUnref) {
          timer.unref();
        }
        this.subs.push(() => {
          this.clearTimeoutFn(timer);
        });
      }
      this.subs.push(openSubDestroy);
      this.subs.push(errorSub);
      return this;
    }
    /**
     * Alias for open()
     *
     * @return self
     * @public
     */
    connect(fn2) {
      return this.open(fn2);
    }
    /**
     * Called upon transport open.
     *
     * @private
     */
    onopen() {
      this.cleanup();
      this._readyState = "open";
      this.emitReserved("open");
      const socket2 = this.engine;
      this.subs.push(
        on$1(socket2, "ping", this.onping.bind(this)),
        on$1(socket2, "data", this.ondata.bind(this)),
        on$1(socket2, "error", this.onerror.bind(this)),
        on$1(socket2, "close", this.onclose.bind(this)),
        // @ts-ignore
        on$1(this.decoder, "decoded", this.ondecoded.bind(this))
      );
    }
    /**
     * Called upon a ping.
     *
     * @private
     */
    onping() {
      this.emitReserved("ping");
    }
    /**
     * Called with data.
     *
     * @private
     */
    ondata(data) {
      try {
        this.decoder.add(data);
      } catch (e2) {
        this.onclose("parse error", e2);
      }
    }
    /**
     * Called when parser fully decodes a packet.
     *
     * @private
     */
    ondecoded(packet) {
      nextTick(() => {
        this.emitReserved("packet", packet);
      }, this.setTimeoutFn);
    }
    /**
     * Called upon socket error.
     *
     * @private
     */
    onerror(err) {
      this.emitReserved("error", err);
    }
    /**
     * Creates a new socket for the given `nsp`.
     *
     * @return {Socket}
     * @public
     */
    socket(nsp, opts) {
      let socket2 = this.nsps[nsp];
      if (!socket2) {
        socket2 = new Socket(this, nsp, opts);
        this.nsps[nsp] = socket2;
      } else if (this._autoConnect && !socket2.active) {
        socket2.connect();
      }
      return socket2;
    }
    /**
     * Called upon a socket close.
     *
     * @param socket
     * @private
     */
    _destroy(socket2) {
      const nsps = Object.keys(this.nsps);
      for (const nsp of nsps) {
        const socket3 = this.nsps[nsp];
        if (socket3.active) {
          return;
        }
      }
      this._close();
    }
    /**
     * Writes a packet.
     *
     * @param packet
     * @private
     */
    _packet(packet) {
      const encodedPackets = this.encoder.encode(packet);
      for (let i2 = 0; i2 < encodedPackets.length; i2++) {
        this.engine.write(encodedPackets[i2], packet.options);
      }
    }
    /**
     * Clean up transport subscriptions and packet buffer.
     *
     * @private
     */
    cleanup() {
      this.subs.forEach((subDestroy) => subDestroy());
      this.subs.length = 0;
      this.decoder.destroy();
    }
    /**
     * Close the current socket.
     *
     * @private
     */
    _close() {
      this.skipReconnect = true;
      this._reconnecting = false;
      this.onclose("forced close");
    }
    /**
     * Alias for close()
     *
     * @private
     */
    disconnect() {
      return this._close();
    }
    /**
     * Called when:
     *
     * - the low-level engine is closed
     * - the parser encountered a badly formatted packet
     * - all sockets are disconnected
     *
     * @private
     */
    onclose(reason, description) {
      var _a;
      this.cleanup();
      (_a = this.engine) === null || _a === void 0 ? void 0 : _a.close();
      this.backoff.reset();
      this._readyState = "closed";
      this.emitReserved("close", reason, description);
      if (this._reconnection && !this.skipReconnect) {
        this.reconnect();
      }
    }
    /**
     * Attempt a reconnection.
     *
     * @private
     */
    reconnect() {
      if (this._reconnecting || this.skipReconnect)
        return this;
      const self2 = this;
      if (this.backoff.attempts >= this._reconnectionAttempts) {
        this.backoff.reset();
        this.emitReserved("reconnect_failed");
        this._reconnecting = false;
      } else {
        const delay = this.backoff.duration();
        this._reconnecting = true;
        const timer = this.setTimeoutFn(() => {
          if (self2.skipReconnect)
            return;
          this.emitReserved("reconnect_attempt", self2.backoff.attempts);
          if (self2.skipReconnect)
            return;
          self2.open((err) => {
            if (err) {
              self2._reconnecting = false;
              self2.reconnect();
              this.emitReserved("reconnect_error", err);
            } else {
              self2.onreconnect();
            }
          });
        }, delay);
        if (this.opts.autoUnref) {
          timer.unref();
        }
        this.subs.push(() => {
          this.clearTimeoutFn(timer);
        });
      }
    }
    /**
     * Called upon successful reconnect.
     *
     * @private
     */
    onreconnect() {
      const attempt = this.backoff.attempts;
      this._reconnecting = false;
      this.backoff.reset();
      this.emitReserved("reconnect", attempt);
    }
  }
  const cache = {};
  function lookup(uri, opts) {
    if (typeof uri === "object") {
      opts = uri;
      uri = void 0;
    }
    opts = opts || {};
    const parsed = url(uri, opts.path || "/socket.io");
    const source = parsed.source;
    const id = parsed.id;
    const path = parsed.path;
    const sameNamespace = cache[id] && path in cache[id]["nsps"];
    const newConnection = opts.forceNew || opts["force new connection"] || false === opts.multiplex || sameNamespace;
    let io;
    if (newConnection) {
      io = new Manager(source, opts);
    } else {
      if (!cache[id]) {
        cache[id] = new Manager(source, opts);
      }
      io = cache[id];
    }
    if (parsed.query && !opts.query) {
      opts.query = parsed.queryKey;
    }
    return io.socket(parsed.path, opts);
  }
  Object.assign(lookup, {
    Manager,
    Socket,
    io: lookup,
    connect: lookup
  });
  const STORAGE_KEY = "merchantNotifyEnabled";
  const AUDIO_PATH = "/static/audio/new-order.mp3";
  let _audio = null;
  let _webAudioContext = null;
  let _enabled = false;
  let _unlocked = false;
  let _lastError = "";
  let _mode = "idle";
  function beepByAppDevice() {
    try {
      if (typeof plus !== "undefined" && plus.device && typeof plus.device.beep === "function") {
        plus.device.beep(1);
        _mode = "app-beep";
        _lastError = "";
        emitNotifyStatus();
        logNotify("app-beep-success", { count: 1 });
        return true;
      }
    } catch (e2) {
      _lastError = e2 && (e2.message || e2.errMsg) || "app-beep-failed";
      logNotify("app-beep-failed", _lastError);
      emitNotifyStatus();
    }
    return false;
  }
  function speakByAppTTS(text) {
    try {
      if (typeof plus !== "undefined" && plus.speech && typeof plus.speech.speak === "function") {
        plus.speech.speak(String(text || "您有新的订单，请及时处理"), {
          engine: "baidu",
          volume: 1,
          pitch: 1,
          rate: 1
        });
        _mode = "app-tts";
        _lastError = "";
        emitNotifyStatus();
        logNotify("app-tts-success", { text });
        return true;
      }
    } catch (e2) {
      _lastError = e2 && (e2.message || e2.errMsg) || "app-tts-failed";
      logNotify("app-tts-failed", _lastError);
      emitNotifyStatus();
    }
    return false;
  }
  function isH5Runtime() {
    return typeof window !== "undefined" && typeof document !== "undefined";
  }
  function logNotify(step, payload) {
    try {
      formatAppLog("log", "at utils/merchant-notify.js:69", "[merchant-notify][" + step + "]", payload || "");
    } catch (e2) {
    }
  }
  function emitNotifyStatus() {
    try {
      uni.$emit("merchant_notify_status_changed", getMerchantNotifyStatus());
    } catch (e2) {
    }
  }
  function persistEnabled(enabled) {
    _enabled = !!enabled;
    try {
      uni.setStorageSync(STORAGE_KEY, _enabled ? 1 : 0);
    } catch (e2) {
    }
    emitNotifyStatus();
  }
  function initEnabledState() {
    if (_enabled || _unlocked)
      return;
    try {
      const saved = uni.getStorageSync(STORAGE_KEY);
      if (saved === 1 || saved === "1" || saved === true) {
        _enabled = true;
        _unlocked = !isH5Runtime();
      } else if (!isH5Runtime()) {
        _enabled = true;
        _unlocked = true;
      }
    } catch (e2) {
      if (!isH5Runtime()) {
        _enabled = true;
        _unlocked = true;
      }
    }
  }
  function ensureInnerAudio() {
    if (typeof uni.createInnerAudioContext !== "function")
      return null;
    if (_audio)
      return _audio;
    _audio = uni.createInnerAudioContext();
    _audio.autoplay = false;
    _audio.loop = false;
    _audio.obeyMuteSwitch = false;
    _audio.src = AUDIO_PATH;
    _audio.onCanplay(() => {
      _mode = "audio-file";
      logNotify("audio-canplay", { src: AUDIO_PATH });
      emitNotifyStatus();
    });
    _audio.onPlay(() => {
      _mode = "audio-file";
      _lastError = "";
      logNotify("audio-play-success", { src: AUDIO_PATH });
      emitNotifyStatus();
    });
    _audio.onError((err) => {
      _lastError = err && (err.errMsg || err.message) || "audio-error";
      logNotify("audio-play-error", err);
      emitNotifyStatus();
    });
    return _audio;
  }
  function ensureWebAudioContext() {
    if (!isH5Runtime())
      return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx)
      return null;
    if (!_webAudioContext) {
      _webAudioContext = new AudioCtx();
    }
    return _webAudioContext;
  }
  async function unlockWebAudio() {
    const ctx = ensureWebAudioContext();
    if (!ctx)
      return false;
    try {
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 1e-4;
      osc.type = "sine";
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now2 = ctx.currentTime;
      osc.start(now2);
      osc.stop(now2 + 0.02);
      _mode = "web-audio";
      _lastError = "";
      return true;
    } catch (e2) {
      _lastError = e2 && e2.message || "web-audio-unlock-failed";
      logNotify("unlock-web-audio-failed", _lastError);
      return false;
    }
  }
  function playWebAudioBeep() {
    const ctx = ensureWebAudioContext();
    if (!ctx)
      return false;
    if (ctx.state !== "running") {
      _lastError = "web-audio-not-running";
      return false;
    }
    const now2 = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(1e-4, now2);
    gain.gain.exponentialRampToValueAtTime(0.2, now2 + 0.01);
    gain.gain.exponentialRampToValueAtTime(1e-4, now2 + 0.45);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now2);
    osc.frequency.setValueAtTime(988, now2 + 0.18);
    osc.connect(gain);
    osc.start(now2);
    osc.stop(now2 + 0.46);
    const osc2 = ctx.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(660, now2 + 0.12);
    osc2.frequency.setValueAtTime(784, now2 + 0.34);
    osc2.connect(gain);
    osc2.start(now2 + 0.12);
    osc2.stop(now2 + 0.48);
    _mode = "web-audio";
    _lastError = "";
    return true;
  }
  function getMerchantNotifyStatus() {
    initEnabledState();
    return {
      enabled: !!_enabled,
      unlocked: !!_unlocked,
      mode: _mode,
      lastError: _lastError
    };
  }
  async function enableMerchantNotifyByUserGesture() {
    initEnabledState();
    logNotify("enable-start", getMerchantNotifyStatus());
    let unlocked = false;
    const audio = ensureInnerAudio();
    if (audio && typeof audio.play === "function") {
      try {
        audio.stop();
        audio.play();
        audio.pause();
        audio.seek && audio.seek(0);
        unlocked = true;
        _mode = "audio-file";
        _lastError = "";
        logNotify("enable-inner-audio-success", { src: AUDIO_PATH });
      } catch (e2) {
        _lastError = e2 && e2.message || "inner-audio-unlock-failed";
        logNotify("enable-inner-audio-failed", _lastError);
      }
    }
    if (!unlocked) {
      unlocked = await unlockWebAudio();
    }
    _unlocked = unlocked || _unlocked || !isH5Runtime();
    if (_unlocked) {
      persistEnabled(true);
    } else {
      emitNotifyStatus();
    }
    logNotify("enable-end", getMerchantNotifyStatus());
    return getMerchantNotifyStatus();
  }
  async function ensureMerchantNotifyReady() {
    initEnabledState();
    if (!_enabled) {
      emitNotifyStatus();
      return getMerchantNotifyStatus();
    }
    if (_unlocked) {
      emitNotifyStatus();
      return getMerchantNotifyStatus();
    }
    const audio = ensureInnerAudio();
    if (audio && typeof audio.play === "function") {
      try {
        audio.stop();
        audio.play();
        audio.pause();
        audio.seek && audio.seek(0);
        _unlocked = true;
        _mode = "audio-file";
        _lastError = "";
        emitNotifyStatus();
        logNotify("ensure-inner-audio-success", getMerchantNotifyStatus());
        return getMerchantNotifyStatus();
      } catch (e2) {
        _lastError = e2 && e2.message || "ensure-inner-audio-failed";
        logNotify("ensure-inner-audio-failed", _lastError);
      }
    }
    if (!isH5Runtime()) {
      _unlocked = true;
      _lastError = "";
      emitNotifyStatus();
      logNotify("ensure-non-h5-ready", getMerchantNotifyStatus());
      return getMerchantNotifyStatus();
    }
    emitNotifyStatus();
    logNotify("ensure-h5-wait-user-gesture", getMerchantNotifyStatus());
    return getMerchantNotifyStatus();
  }
  function playMerchantNewOrderNotify() {
    initEnabledState();
    logNotify("play-start", getMerchantNotifyStatus());
    try {
      uni.vibrateLong();
    } catch (e2) {
      try {
        uni.vibrateShort();
      } catch (e22) {
      }
    }
    if (!_enabled) {
      _lastError = "notify-disabled";
      logNotify("play-skipped", { reason: _lastError });
      emitNotifyStatus();
      return false;
    }
    if (beepByAppDevice()) {
      return true;
    }
    if (speakByAppTTS("您有新的订单，请及时处理")) {
      return true;
    }
    const audio = ensureInnerAudio();
    if (audio) {
      try {
        audio.stop();
        audio.seek && audio.seek(0);
        audio.play();
        logNotify("play-inner-audio-called", { src: AUDIO_PATH });
        return true;
      } catch (e2) {
        _lastError = e2 && e2.message || "inner-audio-play-failed";
        logNotify("play-inner-audio-failed", _lastError);
      }
    }
    const webAudioPlayed = playWebAudioBeep();
    if (webAudioPlayed) {
      logNotify("play-web-audio-success", getMerchantNotifyStatus());
      emitNotifyStatus();
      return true;
    }
    logNotify("play-failed", getMerchantNotifyStatus());
    emitNotifyStatus();
    return false;
  }
  let socket = null;
  const newOrderCallbacks = [];
  const orderUpdateCallbacks = [];
  const newDeliveryCallbacks = [];
  function bindSocketListeners() {
    if (!socket)
      return;
    socket.on("connect", () => {
      formatAppLog("log", "at utils/socket.js:13", "[socket] connected", socket.id);
    });
    socket.on("connect_error", (err) => {
      formatAppLog("log", "at utils/socket.js:16", "[socket] connect_error", JSON.stringify({
        message: err == null ? void 0 : err.message,
        description: err == null ? void 0 : err.description,
        type: err == null ? void 0 : err.type
      }));
    });
    socket.on("disconnect", (reason) => {
      formatAppLog("log", "at utils/socket.js:23", "[socket] disconnect", reason);
    });
    socket.on("new_order", (data) => {
      formatAppLog("log", "at utils/socket.js:26", "[socket] new_order received", data);
      try {
        const played = playMerchantNewOrderNotify();
        formatAppLog("log", "at utils/socket.js:29", "[socket] new_order notify played =", played);
      } catch (e2) {
        formatAppLog("error", "at utils/socket.js:31", "[socket] playMerchantNewOrderNotify", e2);
      }
      try {
        uni.showToast({ title: "您有新的外卖订单！", icon: "none" });
      } catch (e2) {
      }
      try {
        uni.$emit("merchant_new_order", data);
      } catch (e2) {
        formatAppLog("error", "at utils/socket.js:39", "[socket] merchant_new_order emit failed", e2);
      }
      newOrderCallbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (e2) {
          formatAppLog("error", "at utils/socket.js:45", "new_order 回调异常", e2);
        }
      });
    });
    socket.on("order_update", (data) => {
      orderUpdateCallbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (e2) {
          formatAppLog("error", "at utils/socket.js:54", "order_update 回调异常", e2);
        }
      });
    });
    socket.on("new_delivery", (data) => {
      newDeliveryCallbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (e2) {
          formatAppLog("error", "at utils/socket.js:63", "new_delivery 回调异常", e2);
        }
      });
    });
  }
  function initSocket(token, userId) {
    if (!token) {
      formatAppLog("log", "at utils/socket.js:71", "[socket] init skipped: missing token");
      return null;
    }
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    const tokenStr = typeof token === "string" ? token : "";
    const bearer = tokenStr.startsWith("Bearer ") ? tokenStr : "Bearer " + tokenStr;
    formatAppLog("log", "at utils/socket.js:81", "[socket] initSocket", {
      socketUrl: SOCKET_URL,
      role: "merchant",
      userId: String(userId || "")
    });
    socket = lookup(SOCKET_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      upgrade: true,
      rememberUpgrade: true,
      timeout: 6e4,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1e3,
      reconnectionDelayMax: 5e3,
      // 仅传 token，避免后端握手校验不通过（多余字段可能导致进不了商家房间）
      auth: {
        token: bearer
      },
      query: {
        role: "merchant",
        userId: String(userId || "")
      }
    });
    bindSocketListeners();
    return socket;
  }
  function getSocket() {
    return socket;
  }
  function disconnectSocket() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  }
  function onNewOrder(callback) {
    if (typeof callback !== "function")
      return;
    if (!newOrderCallbacks.includes(callback)) {
      newOrderCallbacks.push(callback);
    }
  }
  function offNewOrder(callback) {
    const i2 = newOrderCallbacks.indexOf(callback);
    if (i2 !== -1)
      newOrderCallbacks.splice(i2, 1);
  }
  function offAllListeners() {
    newOrderCallbacks.length = 0;
    orderUpdateCallbacks.length = 0;
    newDeliveryCallbacks.length = 0;
    if (socket) {
      socket.removeAllListeners();
    }
  }
  const _export_sfc = (sfc, props) => {
    const target = sfc.__vccOpts || sfc;
    for (const [key, val] of props) {
      target[key] = val;
    }
    return target;
  };
  const _sfc_main$j = {
    data() {
      return {
        todayOrders: 0,
        todayIncome: "0.00",
        todayNewOrders: 0,
        pendingCount: 0,
        notifyEnabled: false,
        notifyStatusText: "",
        pageState: "loading",
        pageMessage: ""
      };
    },
    onLoad() {
      if (!this.ensureMerchantAccess())
        return;
      const token = getToken();
      const userInfo = getUser();
      const userId = getUserId(userInfo);
      if (token && userId && !getSocket()) {
        initSocket(token, userId);
      }
      this.syncNotifyStatus();
      uni.$on("merchant_notify_status_changed", this.syncNotifyStatus);
      uni.$on("merchant_new_order", this.loadData);
      this.loadData();
    },
    onUnload() {
      uni.$off("merchant_notify_status_changed", this.syncNotifyStatus);
      uni.$off("merchant_new_order", this.loadData);
    },
    onShow() {
      if (!this.ensureMerchantAccess())
        return;
      ensureMerchantNotifyReady();
      this.syncNotifyStatus();
      this.loadData();
    },
    methods: {
      ensureMerchantAccess() {
        if (hasValidMerchantSession())
          return true;
        clearAuth();
        this.pageState = "loading";
        this.pageMessage = "";
        uni.reLaunch({ url: "/pages/login/index" });
        return false;
      },
      resetDashboard() {
        this.todayOrders = 0;
        this.todayIncome = "0.00";
        this.todayNewOrders = 0;
        this.pendingCount = 0;
      },
      normalizeMoney(value2) {
        const num = Number(value2);
        return Number.isFinite(num) ? num.toFixed(2) : "0.00";
      },
      hasDashboardMetrics(data) {
        if (!data || typeof data !== "object")
          return false;
        const metricKeys = ["todayOrders", "todayRevenue", "todayNewOrders", "pendingOrders", "orderCount", "income", "pendingCount"];
        return metricKeys.some((key) => Object.prototype.hasOwnProperty.call(data, key));
      },
      applyDashboardData(data) {
        this.todayOrders = Number(data.todayOrders ?? data.orderCount ?? 0);
        this.todayIncome = this.normalizeMoney(data.todayRevenue ?? data.income ?? 0);
        this.todayNewOrders = Number(data.todayNewOrders ?? data.todayOrders ?? data.orderCount ?? 0);
        this.pendingCount = Number(data.pendingOrders ?? data.pendingCount ?? 0);
      },
      async resolveHasShop() {
        try {
          const merchant = await fetchMerchantMy();
          return !!(merchant && typeof merchant === "object");
        } catch (e2) {
          return null;
        }
      },
      syncNotifyStatus() {
        const status = getMerchantNotifyStatus();
        this.notifyEnabled = !!status.enabled;
        this.notifyStatusText = status.lastError || "";
        formatAppLog("log", "at pages/index/index.vue:188", "[merchant-notify][status-sync]", status);
      },
      async enableNotifySound() {
        const status = await enableMerchantNotifyByUserGesture();
        this.notifyEnabled = !!status.enabled;
        this.notifyStatusText = status.lastError || "";
        formatAppLog("log", "at pages/index/index.vue:194", "[merchant-notify][enable-click-result]", status);
        uni.showToast({
          title: status.enabled ? "提示音已开启" : "提示音开启失败",
          icon: "none"
        });
      },
      async loadData() {
        if (!this.ensureMerchantAccess())
          return;
        this.pageState = "loading";
        this.pageMessage = "";
        this.resetDashboard();
        const hasShop = await this.resolveHasShop();
        if (hasShop === false) {
          this.pageState = "no_shop";
          return;
        }
        if (hasShop == null) {
          this.pageState = "error";
          this.pageMessage = "店铺信息校验失败，请稍后重试。";
          return;
        }
        try {
          const res = await getDashboard$1();
          formatAppLog("log", "at pages/index/index.vue:217", "工作台数据:", res);
          const data = res && typeof res === "object" && res.data !== void 0 ? res.data : res;
          if (this.hasDashboardMetrics(data)) {
            this.applyDashboardData(data);
            this.pageState = "ready";
            return;
          }
          this.pageState = "empty";
        } catch (e2) {
          formatAppLog("error", "at pages/index/index.vue:226", "加载工作台数据失败:", e2);
          this.pageState = "error";
          this.pageMessage = e2 && (e2.detail || e2.message || e2.msg) || "暂时无法获取首页数据，请稍后重试。";
        }
      },
      goOpenShop() {
        uni.navigateTo({ url: "/pages/shop/shop-apply" });
      },
      goOrders() {
        uni.switchTab({ url: "/pages/order/list" });
      },
      goProducts() {
        uni.navigateTo({ url: "/pages/product/list" });
      },
      goShop() {
        uni.navigateTo({ url: "/pages/shop/index" });
      },
      goFinance() {
        uni.navigateTo({ url: "/pages/finance/index" });
      },
      goStats() {
        uni.navigateTo({ url: "/pages/stats/index" });
      },
      goReview() {
        uni.navigateTo({ url: "/pages/review/list" });
      }
    }
  };
  function _sfc_render$i(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      $data.pageState === "loading" ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "card state-card"
      }, [
        vue.createElementVNode("text", { class: "state-title" }, "工作台加载中"),
        vue.createElementVNode("text", { class: "state-desc" }, "正在获取店铺经营数据，请稍候。")
      ])) : $data.pageState === "no_shop" ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "card state-card"
      }, [
        vue.createElementVNode("text", { class: "state-title" }, "您还没有店铺"),
        vue.createElementVNode("text", { class: "state-desc" }, "当前账号还未完成开店，请先去提交开店信息。"),
        vue.createElementVNode("button", {
          class: "state-btn primary",
          type: "default",
          onClick: _cache[0] || (_cache[0] = (...args) => $options.goOpenShop && $options.goOpenShop(...args))
        }, "去开店")
      ])) : $data.pageState === "error" ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 2,
        class: "card state-card"
      }, [
        vue.createElementVNode("text", { class: "state-title" }, "工作台加载失败"),
        vue.createElementVNode(
          "text",
          { class: "state-desc" },
          vue.toDisplayString($data.pageMessage || "暂时无法获取首页数据，请稍后重试。"),
          1
          /* TEXT */
        ),
        vue.createElementVNode("button", {
          class: "state-btn primary",
          type: "default",
          onClick: _cache[1] || (_cache[1] = (...args) => $options.loadData && $options.loadData(...args))
        }, "重新加载")
      ])) : (vue.openBlock(), vue.createElementBlock(
        vue.Fragment,
        { key: 3 },
        [
          $data.pageState === "empty" ? (vue.openBlock(), vue.createElementBlock("view", {
            key: 0,
            class: "card state-card"
          }, [
            vue.createElementVNode("text", { class: "state-title" }, "暂无经营数据"),
            vue.createElementVNode("text", { class: "state-desc" }, "店铺已存在，但首页暂未返回有效统计数据，请稍后刷新或联系后端排查。"),
            vue.createElementVNode("button", {
              class: "state-btn",
              type: "default",
              onClick: _cache[2] || (_cache[2] = (...args) => $options.loadData && $options.loadData(...args))
            }, "刷新首页")
          ])) : vue.createCommentVNode("v-if", true),
          $data.pageState === "ready" ? (vue.openBlock(), vue.createElementBlock("view", {
            key: 1,
            class: "card overview"
          }, [
            vue.createElementVNode("view", { class: "section-title" }, "今日概览"),
            vue.createElementVNode("view", { class: "overview-grid" }, [
              vue.createElementVNode("view", { class: "overview-item" }, [
                vue.createElementVNode(
                  "text",
                  { class: "num primary-color" },
                  vue.toDisplayString($data.pendingCount),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode("text", { class: "label" }, "待处理订单")
              ]),
              vue.createElementVNode("view", { class: "overview-item" }, [
                vue.createElementVNode(
                  "text",
                  { class: "num" },
                  vue.toDisplayString($data.todayIncome),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode("text", { class: "label" }, "今日营收(元)")
              ]),
              vue.createElementVNode("view", { class: "overview-item" }, [
                vue.createElementVNode(
                  "text",
                  { class: "num" },
                  vue.toDisplayString($data.todayNewOrders),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode("text", { class: "label" }, "新订单")
              ])
            ])
          ])) : vue.createCommentVNode("v-if", true),
          vue.createElementVNode("view", {
            class: "sound-tip-card",
            onClick: _cache[3] || (_cache[3] = (...args) => $options.enableNotifySound && $options.enableNotifySound(...args))
          }, [
            vue.createElementVNode("view", { class: "sound-tip-main" }, [
              vue.createElementVNode("text", { class: "sound-tip-title" }, "新订单提示音"),
              vue.createElementVNode(
                "text",
                { class: "sound-tip-desc" },
                vue.toDisplayString($data.notifyEnabled ? "已开启，收到新订单会播放提示音" : "未开启，点击启用提示音"),
                1
                /* TEXT */
              )
            ]),
            vue.createElementVNode(
              "text",
              {
                class: vue.normalizeClass(["sound-tip-status", { off: !$data.notifyEnabled }])
              },
              vue.toDisplayString($data.notifyEnabled ? "已开启" : "未开启"),
              3
              /* TEXT, CLASS */
            )
          ]),
          $data.pageState === "ready" && $data.pendingCount > 0 ? (vue.openBlock(), vue.createElementBlock("view", {
            key: 2,
            class: "pending-alert",
            onClick: _cache[4] || (_cache[4] = (...args) => $options.goOrders && $options.goOrders(...args))
          }, [
            vue.createElementVNode(
              "text",
              null,
              "您有 " + vue.toDisplayString($data.pendingCount) + " 个订单待接单，点击处理",
              1
              /* TEXT */
            ),
            vue.createElementVNode("text", { class: "arrow" }, "›")
          ])) : vue.createCommentVNode("v-if", true),
          vue.createElementVNode("view", { class: "card menu-grid" }, [
            vue.createElementVNode("view", {
              class: "menu-item",
              onClick: _cache[5] || (_cache[5] = (...args) => $options.goOrders && $options.goOrders(...args))
            }, [
              vue.createElementVNode("view", { class: "icon-wrap order" }, [
                vue.createElementVNode("text", { class: "icon" }, "📋")
              ]),
              vue.createElementVNode("text", null, "订单管理")
            ]),
            vue.createElementVNode("view", {
              class: "menu-item",
              onClick: _cache[6] || (_cache[6] = (...args) => $options.goProducts && $options.goProducts(...args))
            }, [
              vue.createElementVNode("view", { class: "icon-wrap product" }, [
                vue.createElementVNode("text", { class: "icon" }, "🍱")
              ]),
              vue.createElementVNode("text", null, "商品管理")
            ]),
            vue.createElementVNode("view", {
              class: "menu-item",
              onClick: _cache[7] || (_cache[7] = (...args) => $options.goShop && $options.goShop(...args))
            }, [
              vue.createElementVNode("view", { class: "icon-wrap shop" }, [
                vue.createElementVNode("text", { class: "icon" }, "🏪")
              ]),
              vue.createElementVNode("text", null, "店铺设置")
            ]),
            vue.createElementVNode("view", {
              class: "menu-item",
              onClick: _cache[8] || (_cache[8] = (...args) => $options.goFinance && $options.goFinance(...args))
            }, [
              vue.createElementVNode("view", { class: "icon-wrap finance" }, [
                vue.createElementVNode("text", { class: "icon" }, "💰")
              ]),
              vue.createElementVNode("text", null, "财务管理")
            ]),
            vue.createElementVNode("view", {
              class: "menu-item",
              onClick: _cache[9] || (_cache[9] = (...args) => $options.goStats && $options.goStats(...args))
            }, [
              vue.createElementVNode("view", { class: "icon-wrap stats" }, [
                vue.createElementVNode("text", { class: "icon" }, "📊")
              ]),
              vue.createElementVNode("text", null, "数据统计")
            ]),
            vue.createElementVNode("view", {
              class: "menu-item",
              onClick: _cache[10] || (_cache[10] = (...args) => $options.goReview && $options.goReview(...args))
            }, [
              vue.createElementVNode("view", { class: "icon-wrap review" }, [
                vue.createElementVNode("text", { class: "icon" }, "⭐")
              ]),
              vue.createElementVNode("text", null, "顾客评价")
            ])
          ])
        ],
        64
        /* STABLE_FRAGMENT */
      ))
    ]);
  }
  const PagesIndexIndex = /* @__PURE__ */ _export_sfc(_sfc_main$j, [["render", _sfc_render$i], ["__scopeId", "data-v-1cf27b2a"], ["__file", "E:/固始县外卖商家端/pages/index/index.vue"]]);
  function getDashboard() {
    return request({ url: "/shop/dashboard", method: "GET" });
  }
  function getOrderDetail(id) {
    return request({ url: "/order/detail/" + id, method: "GET" });
  }
  function acceptOrder$1(id, data = {}) {
    return request({ url: "/order/accept", method: "POST", data: { order_id: id, ...data } });
  }
  function rejectOrder(id, data) {
    return request({ url: "/order/reject", method: "POST", data: { order_id: id, reason: (data == null ? void 0 : data.reason) || "商品已售罄" } });
  }
  function prepareOrder(id) {
    return request({ url: "/order/prepare", method: "POST", data: { order_id: id } });
  }
  function deliverOrder(id) {
    return request({ url: "/order/deliver", method: "POST", data: { order_id: id } });
  }
  function getFinanceStats(params) {
    return request({ url: "/merchant/finance/stats", method: "GET", data: params });
  }
  function getWithdrawList(params) {
    return request({ url: "/merchant/finance/withdraw", method: "GET", data: params });
  }
  function applyWithdraw(data) {
    return request({ url: "/merchant/finance/withdraw", method: "POST", data });
  }
  function getStatsData(params) {
    return request({ url: "/merchant/stats", method: "GET", data: params });
  }
  function getHotProducts() {
    return request({ url: "/merchant/hot-products", method: "GET" });
  }
  function getReviewList(params) {
    return request({ url: "/merchant/reviews", method: "GET", data: params });
  }
  function replyReview(orderId, data) {
    return request({ url: "/merchant/reviews/" + orderId + "/reply", method: "POST", data });
  }
  function formatMoney(num) {
    if (num === void 0 || num === null)
      return "0.00";
    return Number(num).toFixed(2);
  }
  function formatTime(timestamp, format = "YYYY-MM-DD HH:mm") {
    if (!timestamp)
      return "";
    const date = new Date(timestamp * 1e3);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    const second = String(date.getSeconds()).padStart(2, "0");
    return format.replace("YYYY", year).replace("MM", month).replace("DD", day).replace("HH", hour).replace("mm", minute).replace("ss", second);
  }
  const ORDER_STATUS = {
    0: { text: "待支付", color: "#FF6B35" },
    1: { text: "已支付待接单", color: "#1890ff" },
    2: { text: "备餐中", color: "#722ed1" },
    3: { text: "待配送", color: "#faad14" },
    4: { text: "配送中", color: "#1890ff" },
    5: { text: "已完成", color: "#52c41a" },
    6: { text: "已取消", color: "#999" }
  };
  const HALL_TAB_CONFIG = [
    { key: "new", label: "新订单", statuses: [1] },
    { key: "making", label: "制作中", statuses: [2] },
    { key: "delivery", label: "待配送", statuses: [3, 4, 5] }
  ];
  const _sfc_main$i = {
    data() {
      return {
        // 统计数据
        todayStats: {
          orderCount: 0,
          income: "0.00",
          pendingCount: 0
        },
        // 搜索
        searchKey: "",
        // 日期筛选
        currentDate: "today",
        dateFilters: [
          { label: "今日", value: "today" },
          { label: "昨日", value: "yesterday" },
          { label: "近7天", value: "week" },
          { label: "近30天", value: "month" }
        ],
        hallTab: "new",
        hallTabs: HALL_TAB_CONFIG,
        // 订单列表（已适配后端字段）
        orderList: [],
        page: 1,
        pageSize: 10,
        refreshing: false,
        loadingMore: false,
        noMore: false,
        _newOrderHandler: null
      };
    },
    computed: {
      emptyTip() {
        if (this.searchKey) {
          return "未找到匹配的订单";
        }
        const activeTab = this.hallTabs.find((item) => item.key === this.hallTab);
        return activeTab ? `${activeTab.label}暂无真实订单` : "当前阶段暂无订单";
      }
    },
    onLoad() {
      if (!this.ensureMerchantAccess())
        return;
      try {
        const pages2 = getCurrentPages();
        const cur = pages2 && pages2.length ? pages2[pages2.length - 1] : null;
        formatAppLog("log", "at pages/order/list.vue:307", "order-page route =", cur && cur.route);
        formatAppLog("log", "at pages/order/list.vue:308", "order-page fullPath =", cur && cur.$page && cur.$page.fullPath);
      } catch (e2) {
        formatAppLog("log", "at pages/order/list.vue:310", "order-page route read failed =", e2);
      }
      this.loadStats();
      this.loadOrderList();
      const token = getToken();
      const userInfo = getUser();
      const userId = getUserId(userInfo);
      if (token && userId && !getSocket()) {
        initSocket(token, userId);
      }
      this._newOrderHandler = () => {
        this.page = 1;
        this.loadOrderList();
        this.loadStats();
      };
      onNewOrder(this._newOrderHandler);
    },
    onUnload() {
      if (this._newOrderHandler) {
        offNewOrder(this._newOrderHandler);
        this._newOrderHandler = null;
      }
    },
    onShow() {
      if (!this.ensureMerchantAccess())
        return;
      this.loadStats();
      this.loadOrderList();
    },
    async onPullDownRefresh() {
      try {
        this.page = 1;
        this.refreshing = true;
        await Promise.all([this.loadOrderList(), this.loadStats()]);
      } catch (e2) {
        formatAppLog("error", "at pages/order/list.vue:349", e2);
      } finally {
        this.refreshing = false;
        uni.stopPullDownRefresh();
      }
    },
    methods: {
      ensureMerchantAccess() {
        if (hasValidMerchantSession())
          return true;
        clearAuth();
        uni.reLaunch({ url: "/pages/login/index" });
        return false;
      },
      // 加载统计数据
      async loadStats() {
        if (!this.ensureMerchantAccess())
          return;
        try {
          const res = await getDashboard();
          const data = (res == null ? void 0 : res.data) || res || {};
          this.todayStats = {
            orderCount: Number(data.todayOrders || data.orderCount || 0),
            income: Number(data.todayRevenue || data.income || 0).toFixed(2),
            pendingCount: Number(data.pendingOrders || data.pendingCount || 0)
          };
        } catch (e2) {
          this.todayStats = {
            orderCount: 0,
            income: "0.00",
            pendingCount: 0
          };
        }
      },
      // 搜索
      onSearch() {
        this.page = 1;
        this.loadOrderList();
      },
      clearSearch() {
        this.searchKey = "";
        this.page = 1;
        this.loadOrderList();
      },
      // 切换日期
      switchDate(date) {
        this.currentDate = date;
        this.page = 1;
        this.loadOrderList();
      },
      switchHallTab(key) {
        this.hallTab = key;
        this.page = 1;
        this.loadOrderList();
      },
      extractListPayload(res) {
        var _a, _b;
        if (Array.isArray(res))
          return res;
        if (Array.isArray((_a = res == null ? void 0 : res.data) == null ? void 0 : _a.订单列表))
          return res.data.订单列表;
        if (Array.isArray((_b = res == null ? void 0 : res.data) == null ? void 0 : _b.data))
          return res.data.data;
        if (Array.isArray(res == null ? void 0 : res.订单列表))
          return res.订单列表;
        if (Array.isArray(res == null ? void 0 : res.data))
          return res.data;
        return [];
      },
      getActiveStatuses() {
        const activeTab = this.hallTabs.find((item) => item.key === this.hallTab);
        return activeTab && Array.isArray(activeTab.statuses) ? activeTab.statuses : [];
      },
      filterOrdersByActiveStatuses(orderList) {
        const statuses = this.getActiveStatuses().map((item) => Number(item));
        if (!statuses.length)
          return Array.isArray(orderList) ? orderList : [];
        return (Array.isArray(orderList) ? orderList : []).filter((order) => {
          const status = Number(order && order.status);
          return statuses.includes(status);
        });
      },
      buildOrderListParams(extra = {}) {
        const params = {
          page: this.page,
          page_size: this.pageSize,
          ...extra
        };
        if (this.searchKey) {
          params.keyword = this.searchKey;
        }
        if (this.currentDate) {
          params.date_range = this.currentDate;
        }
        return params;
      },
      fetchMerchantOrders(params) {
        return request({ url: "/merchant/orders", method: "GET", data: params });
      },
      formatDeliveryAddress(rawAddress) {
        if (!rawAddress)
          return "";
        if (typeof rawAddress === "string") {
          const s2 = String(rawAddress).trim();
          const looksJson = s2.startsWith("{") && s2.endsWith("}") || s2.startsWith("[") && s2.endsWith("]") || /"lng"|"lat"|"contact_phone"|"contact_name"/.test(s2);
          try {
            const parsed = JSON.parse(s2);
            if (parsed && typeof parsed === "object") {
              const detail = parsed.detail != null ? String(parsed.detail).trim() : "";
              const address = parsed.address != null ? String(parsed.address).trim() : "";
              const town = parsed.town != null ? String(parsed.town).trim() : "";
              return detail || (town && address ? `${town}${address}` : address || town || "");
            }
          } catch (e2) {
            if (!looksJson)
              return s2;
            const pick2 = (key) => {
              const m2 = s2.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`));
              return m2 && m2[1] ? String(m2[1]).trim() : "";
            };
            const detail = pick2("detail");
            const address = pick2("address");
            const town = pick2("town");
            return detail || (town && address ? `${town}${address}` : address || town || "");
          }
          return looksJson ? "" : s2;
        }
        if (typeof rawAddress === "object") {
          const detail = rawAddress.detail != null ? String(rawAddress.detail).trim() : "";
          const address = rawAddress.address != null ? String(rawAddress.address).trim() : "";
          const town = rawAddress.town != null ? String(rawAddress.town).trim() : "";
          return detail || (town && address ? `${town}${address}` : address || town || "");
        }
        return String(rawAddress);
      },
      mapOrderRow(o2) {
        var _a, _b, _c;
        const rawStatus = Number(o2.status);
        const status = Number.isFinite(rawStatus) ? rawStatus : o2.status;
        let goodsList = [];
        try {
          let raw = o2.products_info ?? o2.items;
          if (typeof raw === "string") {
            raw = JSON.parse(raw);
          }
          const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
          goodsList = arr.map((g2) => ({
            name: g2.name || g2.商品名称 || g2.title || "",
            num: g2.num || g2.数量 || g2.count || 1,
            price: g2.price || g2.价格 || g2.amount || 0,
            spec: g2.spec || g2.规格 || "",
            image: g2.image || g2.img || ""
          }));
        } catch (e2) {
          goodsList = [];
        }
        const createdAt = o2.createdAt || o2.created_at;
        const customerName = ((_a = o2.user) == null ? void 0 : _a.nickname) || o2.contact_name || "顾客";
        const customerPhone = o2.contact_phone || ((_b = o2.user) == null ? void 0 : _b.phone) || "";
        const rawAddress = o2.delivery_address;
        const address = this.formatDeliveryAddress(rawAddress);
        const pay = Number(o2.pay_amount);
        const fee = Number(o2.delivery_fee);
        let est = pay;
        if (Number.isFinite(pay) && Number.isFinite(fee)) {
          est = pay - fee;
        } else if (Number.isFinite(pay)) {
          est = pay;
        } else {
          est = 0;
        }
        return {
          id: o2.id || o2.order_id,
          orderNo: o2.order_no || o2.orderNo || String(o2.order_id || ""),
          status,
          statusText: ((_c = ORDER_STATUS[status]) == null ? void 0 : _c.text) || `状态${status}`,
          createTime: createdAt ? formatTime(new Date(createdAt).getTime() / 1e3, "HH:mm") : "",
          customerName,
          customerPhone,
          address,
          goodsList,
          goodsAmount: o2.total_amount,
          deliveryFee: o2.delivery_fee,
          totalAmount: o2.pay_amount,
          estimatedIncome: Number.isFinite(est) ? Number(est).toFixed(2) : "0.00",
          remark: o2.remark || o2.buyer_remark || "",
          orderType: o2.order_type || o2.orderType || "",
          isUrgent: false,
          rawRecordId: o2.id,
          rawOrderId: o2.order_id,
          rawStatus: o2.status,
          rawDeliveryAddress: rawAddress,
          category: o2.category || o2.merchant_category || o2.shop_category || "",
          supermarketDeliveryPermissionSnapshot: o2.supermarket_delivery_permission_snapshot || "",
          supermarketDeliveryMode: o2.supermarket_delivery_mode || "",
          settlementRuleSnapshot: o2.settlement_rule_snapshot || null,
          merchantLng: this.toCoordinateNumber(o2.merchant_lng ?? o2.merchantLng),
          merchantLat: this.toCoordinateNumber(o2.merchant_lat ?? o2.merchantLat),
          customerLng: this.toCoordinateNumber(o2.customer_lng ?? o2.delivery_longitude ?? o2.longitude),
          customerLat: this.toCoordinateNumber(o2.customer_lat ?? o2.delivery_latitude ?? o2.latitude)
        };
      },
      mergeSupermarketOrderDetail(order, detailRaw) {
        var _a, _b;
        const nextOrder = { ...order };
        const permissionSnapshot = detailRaw == null ? void 0 : detailRaw.supermarket_delivery_permission_snapshot;
        const deliveryMode = detailRaw == null ? void 0 : detailRaw.supermarket_delivery_mode;
        const settlementRuleSnapshot = detailRaw == null ? void 0 : detailRaw.settlement_rule_snapshot;
        const category = (detailRaw == null ? void 0 : detailRaw.category) || (detailRaw == null ? void 0 : detailRaw.merchant_category) || (detailRaw == null ? void 0 : detailRaw.shop_category) || ((_a = detailRaw == null ? void 0 : detailRaw.merchant) == null ? void 0 : _a.category) || ((_b = detailRaw == null ? void 0 : detailRaw.shop) == null ? void 0 : _b.category) || nextOrder.category;
        nextOrder.category = category != null ? String(category) : nextOrder.category;
        if (this.isSupermarketOrder(nextOrder)) {
          if (permissionSnapshot != null) {
            nextOrder.supermarketDeliveryPermissionSnapshot = String(permissionSnapshot);
          }
          if (deliveryMode != null) {
            nextOrder.supermarketDeliveryMode = String(deliveryMode);
          }
          if (settlementRuleSnapshot != null) {
            nextOrder.settlementRuleSnapshot = settlementRuleSnapshot;
          }
        } else {
          nextOrder.supermarketDeliveryPermissionSnapshot = "";
          nextOrder.supermarketDeliveryMode = "";
          nextOrder.settlementRuleSnapshot = null;
        }
        if (this.toCoordinateNumber((detailRaw == null ? void 0 : detailRaw.merchant_lng) ?? (detailRaw == null ? void 0 : detailRaw.merchantLng)) != null) {
          nextOrder.merchantLng = this.toCoordinateNumber((detailRaw == null ? void 0 : detailRaw.merchant_lng) ?? (detailRaw == null ? void 0 : detailRaw.merchantLng));
        }
        if (this.toCoordinateNumber((detailRaw == null ? void 0 : detailRaw.merchant_lat) ?? (detailRaw == null ? void 0 : detailRaw.merchantLat)) != null) {
          nextOrder.merchantLat = this.toCoordinateNumber((detailRaw == null ? void 0 : detailRaw.merchant_lat) ?? (detailRaw == null ? void 0 : detailRaw.merchantLat));
        }
        if (this.toCoordinateNumber((detailRaw == null ? void 0 : detailRaw.customer_lng) ?? (detailRaw == null ? void 0 : detailRaw.delivery_longitude) ?? (detailRaw == null ? void 0 : detailRaw.longitude)) != null) {
          nextOrder.customerLng = this.toCoordinateNumber((detailRaw == null ? void 0 : detailRaw.customer_lng) ?? (detailRaw == null ? void 0 : detailRaw.delivery_longitude) ?? (detailRaw == null ? void 0 : detailRaw.longitude));
        }
        if (this.toCoordinateNumber((detailRaw == null ? void 0 : detailRaw.customer_lat) ?? (detailRaw == null ? void 0 : detailRaw.delivery_latitude) ?? (detailRaw == null ? void 0 : detailRaw.latitude)) != null) {
          nextOrder.customerLat = this.toCoordinateNumber((detailRaw == null ? void 0 : detailRaw.customer_lat) ?? (detailRaw == null ? void 0 : detailRaw.delivery_latitude) ?? (detailRaw == null ? void 0 : detailRaw.latitude));
        }
        return nextOrder;
      },
      toCoordinateNumber(value2) {
        const num = Number(value2);
        return Number.isFinite(num) ? num : null;
      },
      getValidCoordinatePair(longitude, latitude) {
        const lng = this.toCoordinateNumber(longitude);
        const lat = this.toCoordinateNumber(latitude);
        if (lng == null || lat == null)
          return null;
        if (lng === 0 && lat === 0)
          return null;
        return { lng, lat };
      },
      isSupermarketCategory(category) {
        return String(category || "").trim() === "超市";
      },
      isSupermarketOrder(order) {
        if (!order)
          return false;
        return this.isSupermarketCategory(order.category);
      },
      resolveSupermarketDeliveryMode(order) {
        if (!this.isSupermarketOrder(order))
          return "";
        if (order.supermarketDeliveryMode === "self_delivery" || order.supermarketDeliveryMode === "rider_delivery") {
          return order.supermarketDeliveryMode;
        }
        if (order.supermarketDeliveryPermissionSnapshot === "self_only") {
          return "self_delivery";
        }
        if (order.supermarketDeliveryPermissionSnapshot === "rider_only") {
          return "rider_delivery";
        }
        return "pending";
      },
      showSupermarketHybridModeChoice(order, targetMode) {
        return this.isSupermarketOrder(order) && order.status === 3 && order.supermarketDeliveryPermissionSnapshot === "hybrid" && this.resolveSupermarketDeliveryMode(order) === "pending" && ["self_delivery", "rider_delivery"].includes(targetMode);
      },
      showSupermarketSelfDeliveryStart(order) {
        return this.isSupermarketOrder(order) && order.status === 3 && this.resolveSupermarketDeliveryMode(order) === "self_delivery";
      },
      showSupermarketMerchantConfirm(order) {
        return this.isSupermarketOrder(order) && order.status === 5 && this.resolveSupermarketDeliveryMode(order) === "self_delivery";
      },
      showSupermarketSelfDeliveryNavigation(order) {
        return this.isSupermarketOrder(order) && (order.status === 4 || order.status === 5) && this.resolveSupermarketDeliveryMode(order) === "self_delivery";
      },
      showRiderDeliveryButton(order) {
        if (!this.isSupermarketOrder(order))
          return false;
        const deliveryMode = this.resolveSupermarketDeliveryMode(order);
        return order.status === 3 && deliveryMode === "rider_delivery";
      },
      getDeliverButtonText(order) {
        if (!this.isSupermarketOrder(order))
          return "";
        if (this.resolveSupermarketDeliveryMode(order) === "rider_delivery") {
          return "呼叫骑手";
        }
        return "";
      },
      async enrichSupermarketOrders(orderList) {
        const detailTargets = orderList.filter(
          (order) => order && this.isSupermarketOrder(order) && (order.status === 3 || order.status === 4 || order.status === 5)
        );
        if (!detailTargets.length)
          return orderList;
        const detailResults = await Promise.all(
          detailTargets.map(async (order) => {
            try {
              const detailRes = await getOrderDetail(order.id);
              const detailRaw = detailRes && detailRes.data !== void 0 ? detailRes.data : detailRes;
              return { id: order.id, detailRaw };
            } catch (e2) {
              return { id: order.id, detailRaw: null };
            }
          })
        );
        const detailMap = new Map(detailResults.map((item) => [item.id, item.detailRaw]));
        return orderList.map((order) => {
          const detailRaw = detailMap.get(order.id);
          return detailRaw ? this.mergeSupermarketOrderDetail(order, detailRaw) : order;
        });
      },
      async loadOrderList() {
        if (!this.ensureMerchantAccess())
          return;
        try {
          const statuses = this.getActiveStatuses();
          const responses = await Promise.all(
            statuses.map((status) => this.fetchMerchantOrders(this.buildOrderListParams({ status })))
          );
          const listGroup = responses.map((res) => this.extractListPayload(res));
          const byId = /* @__PURE__ */ new Map();
          listGroup.flat().forEach((row) => {
            if (row && row.id != null && !byId.has(row.id)) {
              byId.set(row.id, row);
            }
          });
          const list = Array.from(byId.values()).sort((x2, y2) => {
            const tx = new Date(x2.createdAt || x2.created_at || 0).getTime();
            const ty = new Date(y2.createdAt || y2.created_at || 0).getTime();
            return ty - tx;
          });
          const mapped = list.map((o2) => this.mapOrderRow(o2));
          mapped.forEach((order) => {
            formatAppLog("log", "at pages/order/list.vue:732", "order-card raw delivery_address =", order && order.rawDeliveryAddress);
            formatAppLog("log", "at pages/order/list.vue:733", "order-card formatted address =", order && order.address);
          });
          if (this.hallTab === "making") {
            mapped.forEach((order) => {
              formatAppLog("log", "at pages/order/list.vue:737", "making-tab order =", {
                rawStatus: order.rawStatus,
                status: order.status,
                id: order.id,
                orderNo: order.orderNo
              });
            });
          }
          const enrichedOrders = this.filterOrdersByActiveStatuses(await this.enrichSupermarketOrders(mapped));
          const mergedList = this.page > 1 ? [...this.orderList, ...enrichedOrders] : enrichedOrders;
          this.orderList = this.filterOrdersByActiveStatuses(mergedList);
          await this.loadStats();
          this.noMore = listGroup.every((items) => items.length < this.pageSize);
        } catch (e2) {
          this.orderList = this.page > 1 ? this.orderList : [];
          formatAppLog("error", "at pages/order/list.vue:753", "加载订单列表失败", e2);
        }
      },
      // 下拉刷新
      async onRefresh() {
        this.refreshing = true;
        this.page = 1;
        await this.loadOrderList();
        this.refreshing = false;
      },
      // 加载更多
      loadMore() {
        if (this.loadingMore || this.noMore)
          return;
        this.loadingMore = true;
        this.page++;
        this.loadOrderList().then(() => {
          this.loadingMore = false;
        });
      },
      applyLocalOrderStatus(orderId, nextStatus) {
        const targetId = String(orderId);
        const updatedList = this.orderList.map((item) => {
          var _a;
          if (String(item.id) !== targetId)
            return item;
          return {
            ...item,
            status: nextStatus,
            rawStatus: nextStatus,
            statusText: ((_a = ORDER_STATUS[nextStatus]) == null ? void 0 : _a.text) || `状态${nextStatus}`
          };
        });
        this.orderList = this.filterOrdersByActiveStatuses(updatedList);
      },
      async handleAccept(order) {
        try {
          await acceptOrder$1(order.id, {
            merchant_lng: 115.681123,
            merchant_lat: 32.181234
          });
          this.applyLocalOrderStatus(order.id, 2);
          uni.showToast({ title: "接单成功", icon: "success" });
          this.page = 1;
          await this.loadOrderList();
          await this.loadStats();
        } catch (e2) {
          uni.showToast({ title: "接单失败", icon: "none" });
        }
      },
      // 拒单（状态：1 待接单）
      rejectOrder(order) {
        uni.showModal({
          title: "拒单确认",
          content: "确定要拒绝此订单吗？",
          confirmText: "确定拒单",
          confirmColor: "#ff4d4f",
          success: (res) => {
            if (res.confirm) {
              this.doReject(order);
            }
          }
        });
      },
      async doReject(order) {
        try {
          await rejectOrder(order.id, { reason: "商品已售罄" });
          uni.showToast({ title: "已拒单", icon: "success" });
          this.loadOrderList();
        } catch (e2) {
          uni.showToast({ title: String(this.extractErrorMessage(e2, "操作失败")), icon: "none" });
        }
      },
      // 出餐完成：POST /api/order/prepare，状态 2 -> 3
      async finishMake(order) {
        const payload = { order_id: order && order.id };
        formatAppLog("log", "at pages/order/list.vue:833", "finishMake order =", order);
        formatAppLog("log", "at pages/order/list.vue:834", "finishMake order.id =", order && order.id);
        formatAppLog("log", "at pages/order/list.vue:835", "finishMake order.rawRecordId =", order && order.rawRecordId);
        formatAppLog("log", "at pages/order/list.vue:836", "finishMake order.rawOrderId =", order && order.rawOrderId);
        formatAppLog("log", "at pages/order/list.vue:837", "finishMake order.orderNo =", order && order.orderNo);
        formatAppLog("log", "at pages/order/list.vue:838", "finishMake order.status =", order && order.status);
        formatAppLog("log", "at pages/order/list.vue:839", "finishMake payload =", payload);
        try {
          try {
            const detailRes = await getOrderDetail(order.id);
            const detailRaw = detailRes && detailRes.data !== void 0 ? detailRes.data : detailRes;
            formatAppLog("log", "at pages/order/list.vue:844", "finishMake detail =", detailRaw);
            formatAppLog("log", "at pages/order/list.vue:845", "finishMake detail.status =", detailRaw && detailRaw.status);
          } catch (detailError) {
            formatAppLog("log", "at pages/order/list.vue:847", "finishMake detailError =", detailError);
          }
          await prepareOrder(order.id);
          uni.showToast({ title: "出餐完成", icon: "success" });
          this.page = 1;
          await this.loadOrderList();
          await this.loadStats();
        } catch (e2) {
          formatAppLog("log", "at pages/order/list.vue:855", "finishMake error =", e2);
          formatAppLog("log", "at pages/order/list.vue:856", "finishMake error.message =", e2 && e2.message);
          formatAppLog("log", "at pages/order/list.vue:857", "finishMake error.response =", e2 && e2.response);
          formatAppLog("log", "at pages/order/list.vue:858", "finishMake error.response.data =", e2 && e2.response && e2.response.data);
          const rawMessage = e2 && e2.response && e2.response.data && (e2.response.data.message || e2.response.data.msg || e2.response.data.detail) || e2 && e2.data && (e2.data.message || e2.data.msg || e2.data.detail) || e2 && (e2.message || e2.msg || e2.detail) || "操作失败";
          uni.showToast({ title: String(rawMessage), icon: "none" });
        }
      },
      // 当前页仅在已明确的配送按钮语义下调用 POST /api/order/deliver
      extractErrorMessage(error, fallback = "操作失败") {
        return error && error.response && error.response.data && (error.response.data.message || error.response.data.msg || error.response.data.detail) || error && error.data && (error.data.message || error.data.msg || error.data.detail) || error && (error.message || error.msg || error.detail) || fallback;
      },
      buildSelfDeliveryMapPayload(order, detailRaw = null) {
        const raw = detailRaw || {};
        const customerPair = this.getValidCoordinatePair(
          raw.customer_lng ?? raw.delivery_longitude ?? raw.longitude ?? order.customerLng,
          raw.customer_lat ?? raw.delivery_latitude ?? raw.latitude ?? order.customerLat
        );
        const merchantPair = this.getValidCoordinatePair(
          raw.merchant_lng ?? raw.merchantLng ?? order.merchantLng,
          raw.merchant_lat ?? raw.merchantLat ?? order.merchantLat
        );
        const contactPhone = String(raw.contact_phone || order.customerPhone || "").trim();
        const address = this.formatDeliveryAddress(raw.delivery_address || order.rawDeliveryAddress || order.address || "");
        return {
          customerLng: customerPair ? customerPair.lng : null,
          customerLat: customerPair ? customerPair.lat : null,
          merchantLng: merchantPair ? merchantPair.lng : null,
          merchantLat: merchantPair ? merchantPair.lat : null,
          contactPhone,
          address
        };
      },
      async openSelfDeliveryMap(order) {
        try {
          const detailRes = await getOrderDetail(order.id);
          const detailRaw = detailRes && detailRes.data !== void 0 ? detailRes.data : detailRes;
          const payload = this.buildSelfDeliveryMapPayload(order, detailRaw);
          if (payload.customerLng == null || payload.customerLat == null) {
            uni.showToast({ title: "订单缺少收货坐标，无法打开地图", icon: "none" });
            return;
          }
          const query = [
            "orderId=" + encodeURIComponent(String(order.id || "")),
            "customerLng=" + encodeURIComponent(String(payload.customerLng)),
            "customerLat=" + encodeURIComponent(String(payload.customerLat)),
            "merchantLng=" + encodeURIComponent(String(payload.merchantLng == null ? "" : payload.merchantLng)),
            "merchantLat=" + encodeURIComponent(String(payload.merchantLat == null ? "" : payload.merchantLat)),
            "address=" + encodeURIComponent(payload.address),
            "phone=" + encodeURIComponent(payload.contactPhone)
          ].join("&");
          uni.navigateTo({ url: "/pages/order/self-delivery-nav?" + query });
        } catch (e2) {
          uni.showToast({ title: String(this.extractErrorMessage(e2, "打开地图失败")), icon: "none" });
        }
      },
      async submitDeliver(order) {
        try {
          await deliverOrder(order.id);
          const mode = this.resolveSupermarketDeliveryMode(order);
          if (mode === "self_delivery") {
            await this.openSelfDeliveryMap(order);
          } else {
            uni.showToast({ title: "已呼叫骑手", icon: "success" });
          }
          this.page = 1;
          await this.loadOrderList();
          await this.loadStats();
        } catch (e2) {
          uni.showToast({ title: String(this.extractErrorMessage(e2, "操作失败")), icon: "none" });
        }
      },
      async selectSupermarketDeliveryMode(order, supermarketDeliveryMode) {
        try {
          await request({
            url: "/order/supermarket/delivery-mode",
            method: "POST",
            data: {
              order_id: order.id,
              supermarket_delivery_mode: supermarketDeliveryMode
            }
          });
          uni.showToast({ title: "配送方式已更新", icon: "success" });
          this.page = 1;
          await this.loadOrderList();
          await this.loadStats();
        } catch (e2) {
          uni.showToast({ title: String(this.extractErrorMessage(e2, "操作失败")), icon: "none" });
        }
      },
      async merchantConfirmDelivery(order) {
        try {
          await request({
            url: "/order/merchant-confirm-delivery",
            method: "POST",
            data: {
              order_id: order.id
            }
          });
          uni.showToast({ title: "确认送达成功", icon: "success" });
          this.page = 1;
          await this.loadOrderList();
          await this.loadStats();
        } catch (e2) {
          uni.showToast({ title: String(this.extractErrorMessage(e2, "操作失败")), icon: "none" });
        }
      },
      // 拨打电话
      callCustomer(phone) {
        uni.makePhoneCall({ phoneNumber: phone });
      },
      // 查看详情
      goDetail(id) {
        uni.navigateTo({ url: `/pages/order/detail?id=${id}` });
      }
    }
  };
  function _sfc_render$h(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "stats-card" }, [
        vue.createElementVNode("view", { class: "stats-item" }, [
          vue.createElementVNode(
            "text",
            { class: "stats-num" },
            vue.toDisplayString($data.todayStats.orderCount),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "stats-label" }, "今日订单")
        ]),
        vue.createElementVNode("view", { class: "stats-item" }, [
          vue.createElementVNode(
            "text",
            { class: "stats-num" },
            "¥" + vue.toDisplayString($data.todayStats.income),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "stats-label" }, "今日收入")
        ]),
        vue.createElementVNode("view", { class: "stats-item" }, [
          vue.createElementVNode(
            "text",
            { class: "stats-num" },
            vue.toDisplayString($data.todayStats.pendingCount),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "stats-label" }, "待处理")
        ])
      ]),
      vue.createElementVNode("view", { class: "search-bar" }, [
        vue.createElementVNode("view", { class: "search-input-wrap" }, [
          vue.createElementVNode("text", { class: "search-icon" }, "🔍"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $data.searchKey = $event),
              placeholder: "搜索订单号/手机号/顾客姓名",
              onConfirm: _cache[1] || (_cache[1] = (...args) => $options.onSearch && $options.onSearch(...args))
            },
            null,
            544
            /* NEED_HYDRATION, NEED_PATCH */
          ), [
            [vue.vModelText, $data.searchKey]
          ]),
          $data.searchKey ? (vue.openBlock(), vue.createElementBlock("text", {
            key: 0,
            class: "clear-icon",
            onClick: _cache[2] || (_cache[2] = (...args) => $options.clearSearch && $options.clearSearch(...args))
          }, "✕")) : vue.createCommentVNode("v-if", true)
        ])
      ]),
      vue.createElementVNode("view", { class: "date-filter" }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($data.dateFilters, (item) => {
            return vue.openBlock(), vue.createElementBlock("view", {
              key: item.value,
              class: vue.normalizeClass(["date-item", { active: $data.currentDate === item.value }]),
              onClick: ($event) => $options.switchDate(item.value)
            }, vue.toDisplayString(item.label), 11, ["onClick"]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ]),
      vue.createElementVNode("view", { class: "hall-tabs" }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($data.hallTabs, (tab) => {
            return vue.openBlock(), vue.createElementBlock("view", {
              key: tab.key,
              class: vue.normalizeClass(["hall-tab", { active: $data.hallTab === tab.key }]),
              onClick: ($event) => $options.switchHallTab(tab.key)
            }, [
              vue.createElementVNode(
                "text",
                { class: "hall-tab-text" },
                vue.toDisplayString(tab.label),
                1
                /* TEXT */
              )
            ], 10, ["onClick"]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ]),
      vue.createElementVNode("scroll-view", {
        "scroll-y": "",
        class: "order-scroll",
        onScrolltolower: _cache[3] || (_cache[3] = (...args) => $options.loadMore && $options.loadMore(...args)),
        "refresher-enabled": true,
        "refresher-triggered": $data.refreshing,
        onRefresherrefresh: _cache[4] || (_cache[4] = (...args) => $options.onRefresh && $options.onRefresh(...args))
      }, [
        $data.orderList.length ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "order-list"
        }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($data.orderList, (order) => {
              return vue.openBlock(), vue.createElementBlock("view", {
                key: order.id,
                class: vue.normalizeClass(["order-card", { urgent: order.isUrgent }]),
                onClick: ($event) => $options.goDetail(order.id)
              }, [
                vue.createElementVNode("view", { class: "order-header" }, [
                  vue.createElementVNode("view", { class: "header-left" }, [
                    vue.createElementVNode(
                      "text",
                      { class: "order-no" },
                      vue.toDisplayString(order.orderNo),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      { class: "order-time" },
                      vue.toDisplayString(order.createTime),
                      1
                      /* TEXT */
                    )
                  ]),
                  vue.createElementVNode(
                    "view",
                    {
                      class: vue.normalizeClass(["status-tag", "status-" + order.status])
                    },
                    vue.toDisplayString(order.statusText),
                    3
                    /* TEXT, CLASS */
                  )
                ]),
                vue.createElementVNode("view", { class: "customer-info" }, [
                  vue.createElementVNode("view", { class: "info-row" }, [
                    vue.createElementVNode("text", { class: "label" }, "顾客："),
                    vue.createElementVNode(
                      "text",
                      { class: "value" },
                      vue.toDisplayString(order.customerName) + " " + vue.toDisplayString(order.customerPhone),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode("text", {
                      class: "call-btn",
                      onClick: vue.withModifiers(($event) => $options.callCustomer(order.customerPhone), ["stop"])
                    }, "📞", 8, ["onClick"])
                  ]),
                  vue.createElementVNode("view", { class: "info-row" }, [
                    vue.createElementVNode("text", { class: "label" }, "地址："),
                    vue.createElementVNode(
                      "text",
                      { class: "value address" },
                      vue.toDisplayString(order.address),
                      1
                      /* TEXT */
                    )
                  ])
                ]),
                vue.createElementVNode("view", { class: "goods-list" }, [
                  (vue.openBlock(true), vue.createElementBlock(
                    vue.Fragment,
                    null,
                    vue.renderList(order.goodsList.slice(0, 3), (goods, idx) => {
                      return vue.openBlock(), vue.createElementBlock("view", {
                        key: idx,
                        class: "goods-item"
                      }, [
                        goods.image ? (vue.openBlock(), vue.createElementBlock("image", {
                          key: 0,
                          src: goods.image,
                          class: "goods-img",
                          mode: "aspectFill"
                        }, null, 8, ["src"])) : (vue.openBlock(), vue.createElementBlock("view", {
                          key: 1,
                          class: "goods-img placeholder"
                        }, "🍱")),
                        vue.createElementVNode("view", { class: "goods-info" }, [
                          vue.createElementVNode(
                            "text",
                            { class: "goods-name" },
                            vue.toDisplayString(goods.name),
                            1
                            /* TEXT */
                          ),
                          goods.spec ? (vue.openBlock(), vue.createElementBlock(
                            "text",
                            {
                              key: 0,
                              class: "goods-spec"
                            },
                            vue.toDisplayString(goods.spec),
                            1
                            /* TEXT */
                          )) : vue.createCommentVNode("v-if", true)
                        ]),
                        vue.createElementVNode("view", { class: "goods-price" }, [
                          vue.createElementVNode(
                            "text",
                            { class: "num" },
                            "x" + vue.toDisplayString(goods.num),
                            1
                            /* TEXT */
                          ),
                          vue.createElementVNode(
                            "text",
                            { class: "price" },
                            "¥" + vue.toDisplayString(goods.price),
                            1
                            /* TEXT */
                          )
                        ])
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  order.goodsList.length > 3 ? (vue.openBlock(), vue.createElementBlock(
                    "view",
                    {
                      key: 0,
                      class: "more-goods"
                    },
                    " 还有" + vue.toDisplayString(order.goodsList.length - 3) + "件商品... ",
                    1
                    /* TEXT */
                  )) : vue.createCommentVNode("v-if", true)
                ]),
                vue.createElementVNode("view", { class: "order-amount" }, [
                  vue.createElementVNode("text", { class: "amount-label" }, "预计收入"),
                  vue.createElementVNode(
                    "text",
                    { class: "amount-num" },
                    "¥" + vue.toDisplayString(order.estimatedIncome),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode("text", { class: "amount-detail" }, [
                    vue.createTextVNode(
                      " 实付¥" + vue.toDisplayString(order.totalAmount),
                      1
                      /* TEXT */
                    ),
                    order.deliveryFee != null ? (vue.openBlock(), vue.createElementBlock(
                      "text",
                      { key: 0 },
                      " · 配送¥" + vue.toDisplayString(order.deliveryFee),
                      1
                      /* TEXT */
                    )) : vue.createCommentVNode("v-if", true)
                  ])
                ]),
                order.remark ? (vue.openBlock(), vue.createElementBlock("view", {
                  key: 0,
                  class: "order-remark"
                }, [
                  vue.createElementVNode("text", { class: "remark-label" }, "买家备注："),
                  vue.createElementVNode(
                    "text",
                    { class: "remark-content" },
                    vue.toDisplayString(order.remark),
                    1
                    /* TEXT */
                  )
                ])) : vue.createCommentVNode("v-if", true),
                vue.createElementVNode("view", { class: "order-actions" }, [
                  order.status === 1 ? (vue.openBlock(), vue.createElementBlock("button", {
                    key: 0,
                    class: "btn btn-primary",
                    onClick: vue.withModifiers(($event) => $options.handleAccept(order), ["stop"])
                  }, " 接单 ", 8, ["onClick"])) : vue.createCommentVNode("v-if", true),
                  order.status === 1 ? (vue.openBlock(), vue.createElementBlock("button", {
                    key: 1,
                    class: "btn btn-danger",
                    onClick: vue.withModifiers(($event) => $options.rejectOrder(order), ["stop"])
                  }, " 拒单 ", 8, ["onClick"])) : vue.createCommentVNode("v-if", true),
                  order.status === 2 ? (vue.openBlock(), vue.createElementBlock("button", {
                    key: 2,
                    class: "btn btn-primary",
                    onClick: vue.withModifiers(($event) => $options.finishMake(order), ["stop"])
                  }, " 出餐完成 ", 8, ["onClick"])) : vue.createCommentVNode("v-if", true),
                  $options.showRiderDeliveryButton(order) ? (vue.openBlock(), vue.createElementBlock("button", {
                    key: 3,
                    class: "btn btn-primary",
                    onClick: vue.withModifiers(($event) => $options.submitDeliver(order), ["stop"])
                  }, vue.toDisplayString($options.getDeliverButtonText(order)), 9, ["onClick"])) : vue.createCommentVNode("v-if", true),
                  $options.showSupermarketHybridModeChoice(order, "self_delivery") ? (vue.openBlock(), vue.createElementBlock("button", {
                    key: 4,
                    class: "btn btn-primary",
                    onClick: vue.withModifiers(($event) => $options.selectSupermarketDeliveryMode(order, "self_delivery"), ["stop"])
                  }, " 老板自配 ", 8, ["onClick"])) : vue.createCommentVNode("v-if", true),
                  $options.showSupermarketHybridModeChoice(order, "rider_delivery") ? (vue.openBlock(), vue.createElementBlock("button", {
                    key: 5,
                    class: "btn btn-primary",
                    onClick: vue.withModifiers(($event) => $options.selectSupermarketDeliveryMode(order, "rider_delivery"), ["stop"])
                  }, " 骑手配送 ", 8, ["onClick"])) : vue.createCommentVNode("v-if", true),
                  $options.showSupermarketSelfDeliveryStart(order) ? (vue.openBlock(), vue.createElementBlock("button", {
                    key: 6,
                    class: "btn btn-primary",
                    onClick: vue.withModifiers(($event) => $options.submitDeliver(order), ["stop"])
                  }, " 开始配送 ", 8, ["onClick"])) : vue.createCommentVNode("v-if", true),
                  $options.showSupermarketMerchantConfirm(order) ? (vue.openBlock(), vue.createElementBlock("button", {
                    key: 7,
                    class: "btn btn-primary",
                    onClick: vue.withModifiers(($event) => $options.merchantConfirmDelivery(order), ["stop"])
                  }, " 确认送达 ", 8, ["onClick"])) : vue.createCommentVNode("v-if", true),
                  $options.showSupermarketSelfDeliveryNavigation(order) ? (vue.openBlock(), vue.createElementBlock("button", {
                    key: 8,
                    class: "btn btn-default",
                    onClick: vue.withModifiers(($event) => $options.openSelfDeliveryMap(order), ["stop"])
                  }, " 配送地图 ", 8, ["onClick"])) : vue.createCommentVNode("v-if", true),
                  order.status === 3 && !$options.isSupermarketOrder(order) ? (vue.openBlock(), vue.createElementBlock("text", {
                    key: 9,
                    class: "status-hint"
                  }, "待配送")) : vue.createCommentVNode("v-if", true),
                  order.status === 4 && !$options.isSupermarketOrder(order) ? (vue.openBlock(), vue.createElementBlock("text", {
                    key: 10,
                    class: "status-hint"
                  }, "配送中")) : vue.createCommentVNode("v-if", true),
                  vue.createElementVNode("button", {
                    class: "btn btn-default",
                    onClick: vue.withModifiers(($event) => $options.goDetail(order.id), ["stop"])
                  }, " 详情 ", 8, ["onClick"])
                ])
              ], 10, ["onClick"]);
            }),
            128
            /* KEYED_FRAGMENT */
          )),
          $data.loadingMore ? (vue.openBlock(), vue.createElementBlock("view", {
            key: 0,
            class: "load-more"
          }, [
            vue.createElementVNode("text", null, "加载中...")
          ])) : $data.noMore ? (vue.openBlock(), vue.createElementBlock("view", {
            key: 1,
            class: "no-more"
          }, [
            vue.createElementVNode("text", null, "没有更多订单了")
          ])) : vue.createCommentVNode("v-if", true)
        ])) : (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "empty-state"
        }, [
          vue.createElementVNode("text", { class: "empty-icon" }, "📋"),
          vue.createElementVNode("text", { class: "empty-text" }, "暂无订单"),
          vue.createElementVNode(
            "text",
            { class: "empty-tip" },
            vue.toDisplayString($options.emptyTip),
            1
            /* TEXT */
          )
        ]))
      ], 40, ["refresher-triggered"])
    ]);
  }
  const PagesOrderList = /* @__PURE__ */ _export_sfc(_sfc_main$i, [["render", _sfc_render$h], ["__scopeId", "data-v-456ecf67"], ["__file", "E:/固始县外卖商家端/pages/order/list.vue"]]);
  const _sfc_main$h = {
    data() {
      return {
        orderId: "",
        detail: null
      };
    },
    computed: {
      statusColor() {
        var _a;
        return this.detail ? ((_a = ORDER_STATUS[this.detail.status]) == null ? void 0 : _a.color) || "#999" : "#999";
      },
      showSelfDeliveryMapButton() {
        return !!(this.detail && this.isSupermarketSelfDelivery(this.detail) && (this.detail.status === 4 || this.detail.status === 5));
      }
    },
    onLoad(opt) {
      this.orderId = (opt == null ? void 0 : opt.id) || "";
      this.loadDetail();
    },
    methods: {
      toCoordinateNumber(value2) {
        const num = Number(value2);
        return Number.isFinite(num) ? num : null;
      },
      getValidCoordinatePair(longitude, latitude) {
        const lng = this.toCoordinateNumber(longitude);
        const lat = this.toCoordinateNumber(latitude);
        if (lng == null || lat == null)
          return null;
        if (lng === 0 && lat === 0)
          return null;
        return { lng, lat };
      },
      formatDeliveryAddress(rawAddress) {
        if (!rawAddress)
          return "";
        if (typeof rawAddress === "string") {
          const s2 = String(rawAddress).trim();
          const looksJson = s2.startsWith("{") && s2.endsWith("}") || s2.startsWith("[") && s2.endsWith("]") || /"lng"|"lat"|"contact_phone"|"contact_name"/.test(s2);
          try {
            const parsed = JSON.parse(s2);
            if (parsed && typeof parsed === "object") {
              const detail = parsed.detail != null ? String(parsed.detail).trim() : "";
              const address = parsed.address != null ? String(parsed.address).trim() : "";
              const town = parsed.town != null ? String(parsed.town).trim() : "";
              return detail || (town && address ? `${town}${address}` : address || town || "");
            }
          } catch (e2) {
            if (!looksJson)
              return s2;
          }
          return looksJson ? "" : s2;
        }
        if (typeof rawAddress === "object") {
          const detail = rawAddress.detail != null ? String(rawAddress.detail).trim() : "";
          const address = rawAddress.address != null ? String(rawAddress.address).trim() : "";
          const town = rawAddress.town != null ? String(rawAddress.town).trim() : "";
          return detail || (town && address ? `${town}${address}` : address || town || "");
        }
        return String(rawAddress);
      },
      isSupermarketSelfDelivery(detail) {
        if (!detail)
          return false;
        const isSupermarket = String(detail.category || "").trim() === "超市";
        return isSupermarket && detail.supermarketDeliveryMode === "self_delivery";
      },
      formatDetail(raw) {
        var _a, _b, _c;
        let goodsList = [];
        try {
          if (raw == null ? void 0 : raw.products_info) {
            const parsed = typeof raw.products_info === "string" ? JSON.parse(raw.products_info) : raw.products_info;
            goodsList = (parsed || []).map((g2) => ({
              name: g2.name || g2.商品名称 || "",
              num: g2.num || g2.数量 || 1,
              price: g2.price || g2.价格 || 0
            }));
          } else if (Array.isArray(raw == null ? void 0 : raw.goodsList)) {
            goodsList = raw.goodsList;
          }
        } catch (e2) {
          goodsList = [];
        }
        const status = Number((raw == null ? void 0 : raw.status) ?? -1);
        const customerPair = this.getValidCoordinatePair(
          (raw == null ? void 0 : raw.customer_lng) ?? (raw == null ? void 0 : raw.delivery_longitude) ?? (raw == null ? void 0 : raw.longitude),
          (raw == null ? void 0 : raw.customer_lat) ?? (raw == null ? void 0 : raw.delivery_latitude) ?? (raw == null ? void 0 : raw.latitude)
        );
        const merchantPair = this.getValidCoordinatePair(raw == null ? void 0 : raw.merchant_lng, raw == null ? void 0 : raw.merchant_lat);
        return {
          id: (raw == null ? void 0 : raw.id) || (raw == null ? void 0 : raw.order_id) || this.orderId,
          status,
          statusText: ((_a = ORDER_STATUS[status]) == null ? void 0 : _a.text) || "未知",
          orderNo: (raw == null ? void 0 : raw.order_no) || (raw == null ? void 0 : raw.orderNo) || "",
          createTime: (raw == null ? void 0 : raw.created_at) || (raw == null ? void 0 : raw.createTime) || "",
          deliveryTime: (raw == null ? void 0 : raw.delivery_time) || (raw == null ? void 0 : raw.deliveryTime) || "",
          receiver: (raw == null ? void 0 : raw.contact_name) || (raw == null ? void 0 : raw.receiver) || "",
          phone: (raw == null ? void 0 : raw.contact_phone) || (raw == null ? void 0 : raw.phone) || "",
          address: this.formatDeliveryAddress((raw == null ? void 0 : raw.delivery_address) || (raw == null ? void 0 : raw.address) || ""),
          goodsList,
          totalAmount: (raw == null ? void 0 : raw.pay_amount) || (raw == null ? void 0 : raw.total_amount) || (raw == null ? void 0 : raw.totalAmount) || 0,
          category: (raw == null ? void 0 : raw.category) || (raw == null ? void 0 : raw.merchant_category) || (raw == null ? void 0 : raw.shop_category) || ((_b = raw == null ? void 0 : raw.merchant) == null ? void 0 : _b.category) || ((_c = raw == null ? void 0 : raw.shop) == null ? void 0 : _c.category) || "",
          supermarketDeliveryMode: (raw == null ? void 0 : raw.supermarket_delivery_mode) || "",
          supermarketDeliveryPermissionSnapshot: (raw == null ? void 0 : raw.supermarket_delivery_permission_snapshot) || "",
          customerLng: customerPair ? customerPair.lng : null,
          customerLat: customerPair ? customerPair.lat : null,
          merchantLng: merchantPair ? merchantPair.lng : null,
          merchantLat: merchantPair ? merchantPair.lat : null
        };
      },
      async loadDetail() {
        try {
          const res = await getOrderDetail(this.orderId);
          const raw = (res == null ? void 0 : res.data) || res || {};
          this.detail = this.formatDetail(raw);
          this.orderId = this.detail.id || this.orderId;
        } catch (e2) {
          this.detail = null;
          uni.showToast({ title: "加载订单详情失败", icon: "none" });
        }
      },
      async acceptOrder() {
        var _a, _b;
        try {
          const realOrderId = Number(((_a = this.detail) == null ? void 0 : _a.id) || ((_b = this.detail) == null ? void 0 : _b.order_id) || this.orderId);
          if (!realOrderId || isNaN(realOrderId)) {
            uni.showToast({ title: "订单ID无效", icon: "none" });
            return;
          }
          await acceptOrder$1(realOrderId, {
            merchant_lng: 115.681123,
            merchant_lat: 32.181234
          });
          uni.showToast({ title: "接单成功" });
          this.loadDetail();
        } catch (e2) {
        }
      },
      rejectOrder() {
        uni.showModal({
          title: "拒单",
          content: "确定拒单吗？",
          success: async (res) => {
            if (res.confirm) {
              try {
                await rejectOrder(this.orderId, { reason: "商品已售罄" });
                uni.showToast({ title: "已拒单" });
                uni.navigateBack();
              } catch (e2) {
              }
            }
          }
        });
      },
      openSelfDeliveryMap() {
        if (!this.detail)
          return;
        if (this.detail.customerLng == null || this.detail.customerLat == null) {
          uni.showToast({ title: "订单缺少收货坐标，无法打开地图", icon: "none" });
          return;
        }
        const query = [
          "orderId=" + encodeURIComponent(String(this.detail.id || this.orderId || "")),
          "customerLng=" + encodeURIComponent(String(this.detail.customerLng)),
          "customerLat=" + encodeURIComponent(String(this.detail.customerLat)),
          "merchantLng=" + encodeURIComponent(String(this.detail.merchantLng == null ? "" : this.detail.merchantLng)),
          "merchantLat=" + encodeURIComponent(String(this.detail.merchantLat == null ? "" : this.detail.merchantLat)),
          "address=" + encodeURIComponent(String(this.detail.address || "").trim()),
          "phone=" + encodeURIComponent(String(this.detail.phone || "").trim())
        ].join("&");
        uni.navigateTo({ url: "/pages/order/self-delivery-nav?" + query });
      }
    }
  };
  function _sfc_render$g(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      $data.detail ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "card"
      }, [
        vue.createElementVNode("view", { class: "detail-row" }, [
          vue.createElementVNode("text", { class: "label" }, "订单状态"),
          vue.createElementVNode(
            "text",
            {
              class: "value status-tag",
              style: vue.normalizeStyle({ color: $options.statusColor })
            },
            vue.toDisplayString($data.detail.statusText),
            5
            /* TEXT, STYLE */
          )
        ]),
        vue.createElementVNode("view", { class: "detail-row" }, [
          vue.createElementVNode("text", { class: "label" }, "订单号"),
          vue.createElementVNode(
            "text",
            { class: "value" },
            vue.toDisplayString($data.detail.orderNo),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "detail-row" }, [
          vue.createElementVNode("text", { class: "label" }, "下单时间"),
          vue.createElementVNode(
            "text",
            { class: "value" },
            vue.toDisplayString($data.detail.createTime),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "detail-row" }, [
          vue.createElementVNode("text", { class: "label" }, "预计送达"),
          vue.createElementVNode(
            "text",
            { class: "value" },
            vue.toDisplayString($data.detail.deliveryTime),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "divider" }),
        vue.createElementVNode("view", { class: "detail-row" }, [
          vue.createElementVNode("text", { class: "label" }, "收货人"),
          vue.createElementVNode(
            "text",
            { class: "value" },
            vue.toDisplayString($data.detail.receiver) + " " + vue.toDisplayString($data.detail.phone),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "detail-row" }, [
          vue.createElementVNode("text", { class: "label" }, "配送地址"),
          vue.createElementVNode(
            "text",
            { class: "value" },
            vue.toDisplayString($data.detail.address),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "divider" }),
        vue.createElementVNode("view", { class: "goods-section" }, [
          vue.createElementVNode("view", { class: "section-title" }, "商品明细"),
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($data.detail.goodsList, (g2, i2) => {
              return vue.openBlock(), vue.createElementBlock("view", {
                key: i2,
                class: "goods-item flex-between"
              }, [
                vue.createElementVNode(
                  "text",
                  null,
                  vue.toDisplayString(g2.name) + " x" + vue.toDisplayString(g2.num),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode(
                  "text",
                  null,
                  "¥" + vue.toDisplayString(g2.price),
                  1
                  /* TEXT */
                )
              ]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ]),
        vue.createElementVNode("view", { class: "detail-row" }, [
          vue.createElementVNode("text", { class: "label" }, "订单金额"),
          vue.createElementVNode(
            "text",
            { class: "value primary-color text-bold" },
            "¥" + vue.toDisplayString($data.detail.totalAmount),
            1
            /* TEXT */
          )
        ]),
        $data.detail.status === 1 ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "footer-actions"
        }, [
          vue.createElementVNode("button", {
            class: "btn-primary",
            onClick: _cache[0] || (_cache[0] = (...args) => $options.acceptOrder && $options.acceptOrder(...args))
          }, "接单"),
          vue.createElementVNode("button", {
            class: "btn-outline",
            onClick: _cache[1] || (_cache[1] = (...args) => $options.rejectOrder && $options.rejectOrder(...args))
          }, "拒单")
        ])) : vue.createCommentVNode("v-if", true),
        $options.showSelfDeliveryMapButton ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "footer-actions"
        }, [
          vue.createElementVNode("button", {
            class: "btn-primary",
            onClick: _cache[2] || (_cache[2] = (...args) => $options.openSelfDeliveryMap && $options.openSelfDeliveryMap(...args))
          }, "配送地图")
        ])) : vue.createCommentVNode("v-if", true)
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesOrderDetail = /* @__PURE__ */ _export_sfc(_sfc_main$h, [["render", _sfc_render$g], ["__scopeId", "data-v-6b23c96c"], ["__file", "E:/固始县外卖商家端/pages/order/detail.vue"]]);
  const toCoordinateNumber = (value2) => {
    const num = Number(value2);
    return Number.isFinite(num) ? num : null;
  };
  const getValidCoordinatePair$5 = (longitude, latitude) => {
    const lng = toCoordinateNumber(longitude);
    const lat = toCoordinateNumber(latitude);
    if (lng == null || lat == null)
      return null;
    if (lng === 0 && lat === 0)
      return null;
    return { lng, lat };
  };
  const _sfc_main$g = {
    data() {
      return {
        webViewSrc: "",
        webViewDebugPath: "",
        customerLng: null,
        customerLat: null,
        merchantLng: null,
        merchantLat: null,
        addressText: "",
        phone: "",
        tk: ""
      };
    },
    computed: {
      isH5() {
        try {
          return typeof window !== "undefined" && typeof document !== "undefined";
        } catch (e2) {
          return false;
        }
      }
    },
    async onLoad(options) {
      const customerPair = getValidCoordinatePair$5(options.customerLng, options.customerLat);
      const merchantPair = getValidCoordinatePair$5(options.merchantLng, options.merchantLat);
      this.customerLng = customerPair ? customerPair.lng : null;
      this.customerLat = customerPair ? customerPair.lat : null;
      this.merchantLng = merchantPair ? merchantPair.lng : null;
      this.merchantLat = merchantPair ? merchantPair.lat : null;
      this.addressText = String(options.address || "").trim();
      this.phone = String(options.phone || "").trim();
      this.tk = uni.getStorageSync("tianditu_tk") || TIANDITU_TK || "";
      if (this.customerLng == null || this.customerLat == null) {
        uni.showToast({ title: "订单缺少收货坐标，无法打开地图", icon: "none" });
        return;
      }
      if (!this.tk) {
        uni.showToast({ title: "缺少天地图TK", icon: "none" });
        return;
      }
      await this.reloadRoute();
    },
    methods: {
      async resolveStartPosition() {
        try {
          const location2 = await new Promise((resolve, reject) => {
            uni.getLocation({
              type: "wgs84",
              isHighAccuracy: true,
              highAccuracyExpireTime: 3e3,
              success: resolve,
              fail: reject
            });
          });
          const currentPair = getValidCoordinatePair$5(location2 && location2.longitude, location2 && location2.latitude);
          if (currentPair) {
            return currentPair;
          }
        } catch (e2) {
        }
        const merchantPair = getValidCoordinatePair$5(this.merchantLng, this.merchantLat);
        if (merchantPair) {
          return merchantPair;
        }
        return null;
      },
      async reloadRoute() {
        const start = await this.resolveStartPosition();
        if (!start) {
          uni.showToast({ title: "无法获取商家定位，无法规划路线", icon: "none" });
          return;
        }
        const htmlPath = this.isH5 ? "/static/merchant_delivery_map.html" : "/hybrid/html/merchant_delivery_map.html";
        const query = [
          "stage=delivery",
          "mapVersion=NEW-MAP-V1",
          `tk=${encodeURIComponent(this.tk)}`,
          `startLng=${encodeURIComponent(String(start.lng))}`,
          `startLat=${encodeURIComponent(String(start.lat))}`,
          `destLng=${encodeURIComponent(String(this.customerLng))}`,
          `destLat=${encodeURIComponent(String(this.customerLat))}`,
          `t=${Date.now()}`
        ].join("&");
        this.webViewSrc = `${htmlPath}?${query}`;
        this.webViewDebugPath = this.webViewSrc;
        formatAppLog("log", "at pages/order/self-delivery-nav.vue:121", "[merchant-map-src]", this.webViewSrc);
      },
      callCustomer() {
        if (!this.phone) {
          uni.showToast({ title: "顾客电话缺失", icon: "none" });
          return;
        }
        uni.makePhoneCall({ phoneNumber: this.phone });
      }
    }
  };
  function _sfc_render$f(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      $options.isH5 && $data.webViewSrc ? (vue.openBlock(), vue.createElementBlock("iframe", {
        key: 0,
        src: $data.webViewSrc,
        class: "map-frame"
      }, null, 8, ["src"])) : $data.webViewSrc ? (vue.openBlock(), vue.createElementBlock("web-view", {
        key: 1,
        src: $data.webViewSrc,
        class: "map-webview"
      }, null, 8, ["src"])) : (vue.openBlock(), vue.createElementBlock("view", {
        key: 2,
        class: "loading-box"
      }, [
        vue.createElementVNode("text", { class: "loading-text" }, "正在加载天地图路线...")
      ])),
      vue.createElementVNode("view", { class: "info-bar" }, [
        vue.createElementVNode("view", { class: "info-main" }, [
          vue.createElementVNode("text", { class: "info-title" }, "老板自配送导航"),
          vue.createElementVNode(
            "text",
            { class: "info-address" },
            vue.toDisplayString($data.addressText),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("button", {
          class: "info-btn",
          onClick: _cache[0] || (_cache[0] = (...args) => $options.reloadRoute && $options.reloadRoute(...args))
        }, "重新定位"),
        $data.phone ? (vue.openBlock(), vue.createElementBlock("button", {
          key: 0,
          class: "info-btn info-btn-call",
          onClick: _cache[1] || (_cache[1] = (...args) => $options.callCustomer && $options.callCustomer(...args))
        }, "联系顾客")) : vue.createCommentVNode("v-if", true)
      ])
    ]);
  }
  const PagesOrderSelfDeliveryNav = /* @__PURE__ */ _export_sfc(_sfc_main$g, [["render", _sfc_render$f], ["__scopeId", "data-v-f454f9b5"], ["__file", "E:/固始县外卖商家端/pages/order/self-delivery-nav.vue"]]);
  const _sfc_main$f = {
    data() {
      return {
        userInfo: null
      };
    },
    onLoad() {
      this.userInfo = uni.getStorageSync("userInfo") || null;
    },
    computed: {
      userName() {
        var _a;
        return ((_a = this.userInfo) == null ? void 0 : _a.name) || "商家用户";
      },
      phone() {
        var _a;
        return ((_a = this.userInfo) == null ? void 0 : _a.phone) || "未绑定手机";
      }
    },
    methods: {
      logout() {
        uni.showModal({
          title: "提示",
          content: "确定退出登录吗？",
          success: (res) => {
            if (res.confirm) {
              offAllListeners();
              disconnectSocket();
              clearAuth();
              this.userInfo = null;
              uni.showToast({ title: "已退出", icon: "none" });
              setTimeout(() => {
                uni.reLaunch({ url: "/pages/login/index" });
              }, 500);
            }
          }
        });
      }
    }
  };
  function _sfc_render$e(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "card user-card" }, [
        vue.createElementVNode(
          "view",
          { class: "user-avatar" },
          vue.toDisplayString(($options.userName || "商").charAt(0)),
          1
          /* TEXT */
        ),
        vue.createElementVNode("view", { class: "user-info" }, [
          vue.createElementVNode(
            "text",
            { class: "user-name" },
            vue.toDisplayString($options.userName || "商家用户"),
            1
            /* TEXT */
          ),
          vue.createElementVNode(
            "text",
            { class: "user-phone text-gray" },
            vue.toDisplayString($options.phone || "未绑定手机"),
            1
            /* TEXT */
          )
        ])
      ]),
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("button", {
          class: "logout-btn",
          onClick: _cache[0] || (_cache[0] = (...args) => $options.logout && $options.logout(...args))
        }, "退出登录")
      ])
    ]);
  }
  const PagesMineIndex = /* @__PURE__ */ _export_sfc(_sfc_main$f, [["render", _sfc_render$e], ["__scopeId", "data-v-569e925a"], ["__file", "E:/固始县外卖商家端/pages/mine/index.vue"]]);
  function getTownServiceAreas() {
    return request({
      url: "/common/service-areas",
      method: "GET",
      data: {
        area_type: "town"
      }
    });
  }
  function getMerchantPrimaryCategories() {
    return request({
      url: "/common/merchant-primary-categories",
      method: "GET"
    });
  }
  function normalizeCoordinateValue$4(value2) {
    if (value2 == null)
      return null;
    const raw = typeof value2 === "string" ? value2.trim() : value2;
    if (raw === "")
      return null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  }
  function getValidCoordinatePair$4(latitude, longitude) {
    const lat = normalizeCoordinateValue$4(latitude);
    const lng = normalizeCoordinateValue$4(longitude);
    if (lat == null || lng == null)
      return null;
    if (lat === 0 && lng === 0)
      return null;
    return {
      latitude: lat,
      longitude: lng
    };
  }
  function registerMerchant(data) {
    const coordinatePair = getValidCoordinatePair$4(data.latitude, data.longitude);
    if (!coordinatePair) {
      throw new Error("地图坐标无效，请重新选点后再提交");
    }
    const body = {
      phone: data.phone,
      password: data.password,
      store_name: data.store_name,
      address: data.address,
      latitude: coordinatePair.latitude,
      longitude: coordinatePair.longitude,
      category: data.category,
      business_scope: data.business_scope,
      business_license: data.business_license
    };
    if (data.category === "超市" && data.supermarket_delivery_permission) {
      body.supermarket_delivery_permission = data.supermarket_delivery_permission;
    }
    if (data.category === "超市" && data.channel_tags) {
      body.channel_tags = data.channel_tags;
    }
    if (data.business_scope === "town_food" && data.town_code) {
      body.town_code = data.town_code;
    }
    formatAppLog("log", "at api/user.js:55", "[merchant-register][request-body]", body);
    return request({
      url: "/auth/register/merchant",
      method: "POST",
      data: body
    });
  }
  function login(data) {
    return request({
      url: "/auth/login",
      method: "POST",
      data: {
        phone: data.phone,
        password: data.password
      }
    });
  }
  var isVue2 = false;
  function set(target, key, val) {
    if (Array.isArray(target)) {
      target.length = Math.max(target.length, key);
      target.splice(key, 1, val);
      return val;
    }
    target[key] = val;
    return val;
  }
  function del(target, key) {
    if (Array.isArray(target)) {
      target.splice(key, 1);
      return;
    }
    delete target[key];
  }
  function getDevtoolsGlobalHook() {
    return getTarget().__VUE_DEVTOOLS_GLOBAL_HOOK__;
  }
  function getTarget() {
    return typeof navigator !== "undefined" && typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {};
  }
  const isProxyAvailable = typeof Proxy === "function";
  const HOOK_SETUP = "devtools-plugin:setup";
  const HOOK_PLUGIN_SETTINGS_SET = "plugin:settings:set";
  let supported;
  let perf;
  function isPerformanceSupported() {
    var _a;
    if (supported !== void 0) {
      return supported;
    }
    if (typeof window !== "undefined" && window.performance) {
      supported = true;
      perf = window.performance;
    } else if (typeof global !== "undefined" && ((_a = global.perf_hooks) === null || _a === void 0 ? void 0 : _a.performance)) {
      supported = true;
      perf = global.perf_hooks.performance;
    } else {
      supported = false;
    }
    return supported;
  }
  function now() {
    return isPerformanceSupported() ? perf.now() : Date.now();
  }
  class ApiProxy {
    constructor(plugin, hook) {
      this.target = null;
      this.targetQueue = [];
      this.onQueue = [];
      this.plugin = plugin;
      this.hook = hook;
      const defaultSettings = {};
      if (plugin.settings) {
        for (const id in plugin.settings) {
          const item = plugin.settings[id];
          defaultSettings[id] = item.defaultValue;
        }
      }
      const localSettingsSaveId = `__vue-devtools-plugin-settings__${plugin.id}`;
      let currentSettings = Object.assign({}, defaultSettings);
      try {
        const raw = localStorage.getItem(localSettingsSaveId);
        const data = JSON.parse(raw);
        Object.assign(currentSettings, data);
      } catch (e2) {
      }
      this.fallbacks = {
        getSettings() {
          return currentSettings;
        },
        setSettings(value2) {
          try {
            localStorage.setItem(localSettingsSaveId, JSON.stringify(value2));
          } catch (e2) {
          }
          currentSettings = value2;
        },
        now() {
          return now();
        }
      };
      if (hook) {
        hook.on(HOOK_PLUGIN_SETTINGS_SET, (pluginId, value2) => {
          if (pluginId === this.plugin.id) {
            this.fallbacks.setSettings(value2);
          }
        });
      }
      this.proxiedOn = new Proxy({}, {
        get: (_target, prop) => {
          if (this.target) {
            return this.target.on[prop];
          } else {
            return (...args) => {
              this.onQueue.push({
                method: prop,
                args
              });
            };
          }
        }
      });
      this.proxiedTarget = new Proxy({}, {
        get: (_target, prop) => {
          if (this.target) {
            return this.target[prop];
          } else if (prop === "on") {
            return this.proxiedOn;
          } else if (Object.keys(this.fallbacks).includes(prop)) {
            return (...args) => {
              this.targetQueue.push({
                method: prop,
                args,
                resolve: () => {
                }
              });
              return this.fallbacks[prop](...args);
            };
          } else {
            return (...args) => {
              return new Promise((resolve) => {
                this.targetQueue.push({
                  method: prop,
                  args,
                  resolve
                });
              });
            };
          }
        }
      });
    }
    async setRealTarget(target) {
      this.target = target;
      for (const item of this.onQueue) {
        this.target.on[item.method](...item.args);
      }
      for (const item of this.targetQueue) {
        item.resolve(await this.target[item.method](...item.args));
      }
    }
  }
  function setupDevtoolsPlugin(pluginDescriptor, setupFn) {
    const descriptor = pluginDescriptor;
    const target = getTarget();
    const hook = getDevtoolsGlobalHook();
    const enableProxy = isProxyAvailable && descriptor.enableEarlyProxy;
    if (hook && (target.__VUE_DEVTOOLS_PLUGIN_API_AVAILABLE__ || !enableProxy)) {
      hook.emit(HOOK_SETUP, pluginDescriptor, setupFn);
    } else {
      const proxy = enableProxy ? new ApiProxy(descriptor, hook) : null;
      const list = target.__VUE_DEVTOOLS_PLUGINS__ = target.__VUE_DEVTOOLS_PLUGINS__ || [];
      list.push({
        pluginDescriptor: descriptor,
        setupFn,
        proxy
      });
      if (proxy)
        setupFn(proxy.proxiedTarget);
    }
  }
  /*!
   * pinia v2.1.7
   * (c) 2023 Eduardo San Martin Morote
   * @license MIT
   */
  let activePinia;
  const setActivePinia = (pinia2) => activePinia = pinia2;
  const piniaSymbol = Symbol("pinia");
  function isPlainObject(o2) {
    return o2 && typeof o2 === "object" && Object.prototype.toString.call(o2) === "[object Object]" && typeof o2.toJSON !== "function";
  }
  var MutationType;
  (function(MutationType2) {
    MutationType2["direct"] = "direct";
    MutationType2["patchObject"] = "patch object";
    MutationType2["patchFunction"] = "patch function";
  })(MutationType || (MutationType = {}));
  const IS_CLIENT = typeof window !== "undefined";
  const USE_DEVTOOLS = IS_CLIENT;
  const _global = /* @__PURE__ */ (() => typeof window === "object" && window.window === window ? window : typeof self === "object" && self.self === self ? self : typeof global === "object" && global.global === global ? global : typeof globalThis === "object" ? globalThis : { HTMLElement: null })();
  function bom(blob, { autoBom = false } = {}) {
    if (autoBom && /^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)) {
      return new Blob([String.fromCharCode(65279), blob], { type: blob.type });
    }
    return blob;
  }
  function download(url2, name, opts) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url2);
    xhr.responseType = "blob";
    xhr.onload = function() {
      saveAs(xhr.response, name, opts);
    };
    xhr.onerror = function() {
      console.error("could not download file");
    };
    xhr.send();
  }
  function corsEnabled(url2) {
    const xhr = new XMLHttpRequest();
    xhr.open("HEAD", url2, false);
    try {
      xhr.send();
    } catch (e2) {
    }
    return xhr.status >= 200 && xhr.status <= 299;
  }
  function click(node) {
    try {
      node.dispatchEvent(new MouseEvent("click"));
    } catch (e2) {
      const evt = document.createEvent("MouseEvents");
      evt.initMouseEvent("click", true, true, window, 0, 0, 0, 80, 20, false, false, false, false, 0, null);
      node.dispatchEvent(evt);
    }
  }
  const _navigator = typeof navigator === "object" ? navigator : { userAgent: "" };
  const isMacOSWebView = /* @__PURE__ */ (() => /Macintosh/.test(_navigator.userAgent) && /AppleWebKit/.test(_navigator.userAgent) && !/Safari/.test(_navigator.userAgent))();
  const saveAs = !IS_CLIENT ? () => {
  } : (
    // Use download attribute first if possible (#193 Lumia mobile) unless this is a macOS WebView or mini program
    typeof HTMLAnchorElement !== "undefined" && "download" in HTMLAnchorElement.prototype && !isMacOSWebView ? downloadSaveAs : (
      // Use msSaveOrOpenBlob as a second approach
      "msSaveOrOpenBlob" in _navigator ? msSaveAs : (
        // Fallback to using FileReader and a popup
        fileSaverSaveAs
      )
    )
  );
  function downloadSaveAs(blob, name = "download", opts) {
    const a2 = document.createElement("a");
    a2.download = name;
    a2.rel = "noopener";
    if (typeof blob === "string") {
      a2.href = blob;
      if (a2.origin !== location.origin) {
        if (corsEnabled(a2.href)) {
          download(blob, name, opts);
        } else {
          a2.target = "_blank";
          click(a2);
        }
      } else {
        click(a2);
      }
    } else {
      a2.href = URL.createObjectURL(blob);
      setTimeout(function() {
        URL.revokeObjectURL(a2.href);
      }, 4e4);
      setTimeout(function() {
        click(a2);
      }, 0);
    }
  }
  function msSaveAs(blob, name = "download", opts) {
    if (typeof blob === "string") {
      if (corsEnabled(blob)) {
        download(blob, name, opts);
      } else {
        const a2 = document.createElement("a");
        a2.href = blob;
        a2.target = "_blank";
        setTimeout(function() {
          click(a2);
        });
      }
    } else {
      navigator.msSaveOrOpenBlob(bom(blob, opts), name);
    }
  }
  function fileSaverSaveAs(blob, name, opts, popup) {
    popup = popup || open("", "_blank");
    if (popup) {
      popup.document.title = popup.document.body.innerText = "downloading...";
    }
    if (typeof blob === "string")
      return download(blob, name, opts);
    const force = blob.type === "application/octet-stream";
    const isSafari = /constructor/i.test(String(_global.HTMLElement)) || "safari" in _global;
    const isChromeIOS = /CriOS\/[\d]+/.test(navigator.userAgent);
    if ((isChromeIOS || force && isSafari || isMacOSWebView) && typeof FileReader !== "undefined") {
      const reader = new FileReader();
      reader.onloadend = function() {
        let url2 = reader.result;
        if (typeof url2 !== "string") {
          popup = null;
          throw new Error("Wrong reader.result type");
        }
        url2 = isChromeIOS ? url2 : url2.replace(/^data:[^;]*;/, "data:attachment/file;");
        if (popup) {
          popup.location.href = url2;
        } else {
          location.assign(url2);
        }
        popup = null;
      };
      reader.readAsDataURL(blob);
    } else {
      const url2 = URL.createObjectURL(blob);
      if (popup)
        popup.location.assign(url2);
      else
        location.href = url2;
      popup = null;
      setTimeout(function() {
        URL.revokeObjectURL(url2);
      }, 4e4);
    }
  }
  function toastMessage(message, type) {
    const piniaMessage = "🍍 " + message;
    if (typeof __VUE_DEVTOOLS_TOAST__ === "function") {
      __VUE_DEVTOOLS_TOAST__(piniaMessage, type);
    } else if (type === "error") {
      console.error(piniaMessage);
    } else if (type === "warn") {
      console.warn(piniaMessage);
    } else {
      console.log(piniaMessage);
    }
  }
  function isPinia(o2) {
    return "_a" in o2 && "install" in o2;
  }
  function checkClipboardAccess() {
    if (!("clipboard" in navigator)) {
      toastMessage(`Your browser doesn't support the Clipboard API`, "error");
      return true;
    }
  }
  function checkNotFocusedError(error) {
    if (error instanceof Error && error.message.toLowerCase().includes("document is not focused")) {
      toastMessage('You need to activate the "Emulate a focused page" setting in the "Rendering" panel of devtools.', "warn");
      return true;
    }
    return false;
  }
  async function actionGlobalCopyState(pinia2) {
    if (checkClipboardAccess())
      return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(pinia2.state.value));
      toastMessage("Global state copied to clipboard.");
    } catch (error) {
      if (checkNotFocusedError(error))
        return;
      toastMessage(`Failed to serialize the state. Check the console for more details.`, "error");
      console.error(error);
    }
  }
  async function actionGlobalPasteState(pinia2) {
    if (checkClipboardAccess())
      return;
    try {
      loadStoresState(pinia2, JSON.parse(await navigator.clipboard.readText()));
      toastMessage("Global state pasted from clipboard.");
    } catch (error) {
      if (checkNotFocusedError(error))
        return;
      toastMessage(`Failed to deserialize the state from clipboard. Check the console for more details.`, "error");
      console.error(error);
    }
  }
  async function actionGlobalSaveState(pinia2) {
    try {
      saveAs(new Blob([JSON.stringify(pinia2.state.value)], {
        type: "text/plain;charset=utf-8"
      }), "pinia-state.json");
    } catch (error) {
      toastMessage(`Failed to export the state as JSON. Check the console for more details.`, "error");
      console.error(error);
    }
  }
  let fileInput;
  function getFileOpener() {
    if (!fileInput) {
      fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json";
    }
    function openFile() {
      return new Promise((resolve, reject) => {
        fileInput.onchange = async () => {
          const files = fileInput.files;
          if (!files)
            return resolve(null);
          const file = files.item(0);
          if (!file)
            return resolve(null);
          return resolve({ text: await file.text(), file });
        };
        fileInput.oncancel = () => resolve(null);
        fileInput.onerror = reject;
        fileInput.click();
      });
    }
    return openFile;
  }
  async function actionGlobalOpenStateFile(pinia2) {
    try {
      const open2 = getFileOpener();
      const result = await open2();
      if (!result)
        return;
      const { text, file } = result;
      loadStoresState(pinia2, JSON.parse(text));
      toastMessage(`Global state imported from "${file.name}".`);
    } catch (error) {
      toastMessage(`Failed to import the state from JSON. Check the console for more details.`, "error");
      console.error(error);
    }
  }
  function loadStoresState(pinia2, state) {
    for (const key in state) {
      const storeState = pinia2.state.value[key];
      if (storeState) {
        Object.assign(storeState, state[key]);
      } else {
        pinia2.state.value[key] = state[key];
      }
    }
  }
  function formatDisplay(display) {
    return {
      _custom: {
        display
      }
    };
  }
  const PINIA_ROOT_LABEL = "🍍 Pinia (root)";
  const PINIA_ROOT_ID = "_root";
  function formatStoreForInspectorTree(store) {
    return isPinia(store) ? {
      id: PINIA_ROOT_ID,
      label: PINIA_ROOT_LABEL
    } : {
      id: store.$id,
      label: store.$id
    };
  }
  function formatStoreForInspectorState(store) {
    if (isPinia(store)) {
      const storeNames = Array.from(store._s.keys());
      const storeMap = store._s;
      const state2 = {
        state: storeNames.map((storeId) => ({
          editable: true,
          key: storeId,
          value: store.state.value[storeId]
        })),
        getters: storeNames.filter((id) => storeMap.get(id)._getters).map((id) => {
          const store2 = storeMap.get(id);
          return {
            editable: false,
            key: id,
            value: store2._getters.reduce((getters, key) => {
              getters[key] = store2[key];
              return getters;
            }, {})
          };
        })
      };
      return state2;
    }
    const state = {
      state: Object.keys(store.$state).map((key) => ({
        editable: true,
        key,
        value: store.$state[key]
      }))
    };
    if (store._getters && store._getters.length) {
      state.getters = store._getters.map((getterName) => ({
        editable: false,
        key: getterName,
        value: store[getterName]
      }));
    }
    if (store._customProperties.size) {
      state.customProperties = Array.from(store._customProperties).map((key) => ({
        editable: true,
        key,
        value: store[key]
      }));
    }
    return state;
  }
  function formatEventData(events) {
    if (!events)
      return {};
    if (Array.isArray(events)) {
      return events.reduce((data, event) => {
        data.keys.push(event.key);
        data.operations.push(event.type);
        data.oldValue[event.key] = event.oldValue;
        data.newValue[event.key] = event.newValue;
        return data;
      }, {
        oldValue: {},
        keys: [],
        operations: [],
        newValue: {}
      });
    } else {
      return {
        operation: formatDisplay(events.type),
        key: formatDisplay(events.key),
        oldValue: events.oldValue,
        newValue: events.newValue
      };
    }
  }
  function formatMutationType(type) {
    switch (type) {
      case MutationType.direct:
        return "mutation";
      case MutationType.patchFunction:
        return "$patch";
      case MutationType.patchObject:
        return "$patch";
      default:
        return "unknown";
    }
  }
  let isTimelineActive = true;
  const componentStateTypes = [];
  const MUTATIONS_LAYER_ID = "pinia:mutations";
  const INSPECTOR_ID = "pinia";
  const { assign: assign$1 } = Object;
  const getStoreType = (id) => "🍍 " + id;
  function registerPiniaDevtools(app, pinia2) {
    setupDevtoolsPlugin({
      id: "dev.esm.pinia",
      label: "Pinia 🍍",
      logo: "https://pinia.vuejs.org/logo.svg",
      packageName: "pinia",
      homepage: "https://pinia.vuejs.org",
      componentStateTypes,
      app
    }, (api) => {
      if (typeof api.now !== "function") {
        toastMessage("You seem to be using an outdated version of Vue Devtools. Are you still using the Beta release instead of the stable one? You can find the links at https://devtools.vuejs.org/guide/installation.html.");
      }
      api.addTimelineLayer({
        id: MUTATIONS_LAYER_ID,
        label: `Pinia 🍍`,
        color: 15064968
      });
      api.addInspector({
        id: INSPECTOR_ID,
        label: "Pinia 🍍",
        icon: "storage",
        treeFilterPlaceholder: "Search stores",
        actions: [
          {
            icon: "content_copy",
            action: () => {
              actionGlobalCopyState(pinia2);
            },
            tooltip: "Serialize and copy the state"
          },
          {
            icon: "content_paste",
            action: async () => {
              await actionGlobalPasteState(pinia2);
              api.sendInspectorTree(INSPECTOR_ID);
              api.sendInspectorState(INSPECTOR_ID);
            },
            tooltip: "Replace the state with the content of your clipboard"
          },
          {
            icon: "save",
            action: () => {
              actionGlobalSaveState(pinia2);
            },
            tooltip: "Save the state as a JSON file"
          },
          {
            icon: "folder_open",
            action: async () => {
              await actionGlobalOpenStateFile(pinia2);
              api.sendInspectorTree(INSPECTOR_ID);
              api.sendInspectorState(INSPECTOR_ID);
            },
            tooltip: "Import the state from a JSON file"
          }
        ],
        nodeActions: [
          {
            icon: "restore",
            tooltip: 'Reset the state (with "$reset")',
            action: (nodeId) => {
              const store = pinia2._s.get(nodeId);
              if (!store) {
                toastMessage(`Cannot reset "${nodeId}" store because it wasn't found.`, "warn");
              } else if (typeof store.$reset !== "function") {
                toastMessage(`Cannot reset "${nodeId}" store because it doesn't have a "$reset" method implemented.`, "warn");
              } else {
                store.$reset();
                toastMessage(`Store "${nodeId}" reset.`);
              }
            }
          }
        ]
      });
      api.on.inspectComponent((payload, ctx) => {
        const proxy = payload.componentInstance && payload.componentInstance.proxy;
        if (proxy && proxy._pStores) {
          const piniaStores = payload.componentInstance.proxy._pStores;
          Object.values(piniaStores).forEach((store) => {
            payload.instanceData.state.push({
              type: getStoreType(store.$id),
              key: "state",
              editable: true,
              value: store._isOptionsAPI ? {
                _custom: {
                  value: vue.toRaw(store.$state),
                  actions: [
                    {
                      icon: "restore",
                      tooltip: "Reset the state of this store",
                      action: () => store.$reset()
                    }
                  ]
                }
              } : (
                // NOTE: workaround to unwrap transferred refs
                Object.keys(store.$state).reduce((state, key) => {
                  state[key] = store.$state[key];
                  return state;
                }, {})
              )
            });
            if (store._getters && store._getters.length) {
              payload.instanceData.state.push({
                type: getStoreType(store.$id),
                key: "getters",
                editable: false,
                value: store._getters.reduce((getters, key) => {
                  try {
                    getters[key] = store[key];
                  } catch (error) {
                    getters[key] = error;
                  }
                  return getters;
                }, {})
              });
            }
          });
        }
      });
      api.on.getInspectorTree((payload) => {
        if (payload.app === app && payload.inspectorId === INSPECTOR_ID) {
          let stores = [pinia2];
          stores = stores.concat(Array.from(pinia2._s.values()));
          payload.rootNodes = (payload.filter ? stores.filter((store) => "$id" in store ? store.$id.toLowerCase().includes(payload.filter.toLowerCase()) : PINIA_ROOT_LABEL.toLowerCase().includes(payload.filter.toLowerCase())) : stores).map(formatStoreForInspectorTree);
        }
      });
      api.on.getInspectorState((payload) => {
        if (payload.app === app && payload.inspectorId === INSPECTOR_ID) {
          const inspectedStore = payload.nodeId === PINIA_ROOT_ID ? pinia2 : pinia2._s.get(payload.nodeId);
          if (!inspectedStore) {
            return;
          }
          if (inspectedStore) {
            payload.state = formatStoreForInspectorState(inspectedStore);
          }
        }
      });
      api.on.editInspectorState((payload, ctx) => {
        if (payload.app === app && payload.inspectorId === INSPECTOR_ID) {
          const inspectedStore = payload.nodeId === PINIA_ROOT_ID ? pinia2 : pinia2._s.get(payload.nodeId);
          if (!inspectedStore) {
            return toastMessage(`store "${payload.nodeId}" not found`, "error");
          }
          const { path } = payload;
          if (!isPinia(inspectedStore)) {
            if (path.length !== 1 || !inspectedStore._customProperties.has(path[0]) || path[0] in inspectedStore.$state) {
              path.unshift("$state");
            }
          } else {
            path.unshift("state");
          }
          isTimelineActive = false;
          payload.set(inspectedStore, path, payload.state.value);
          isTimelineActive = true;
        }
      });
      api.on.editComponentState((payload) => {
        if (payload.type.startsWith("🍍")) {
          const storeId = payload.type.replace(/^🍍\s*/, "");
          const store = pinia2._s.get(storeId);
          if (!store) {
            return toastMessage(`store "${storeId}" not found`, "error");
          }
          const { path } = payload;
          if (path[0] !== "state") {
            return toastMessage(`Invalid path for store "${storeId}":
${path}
Only state can be modified.`);
          }
          path[0] = "$state";
          isTimelineActive = false;
          payload.set(store, path, payload.state.value);
          isTimelineActive = true;
        }
      });
    });
  }
  function addStoreToDevtools(app, store) {
    if (!componentStateTypes.includes(getStoreType(store.$id))) {
      componentStateTypes.push(getStoreType(store.$id));
    }
    setupDevtoolsPlugin({
      id: "dev.esm.pinia",
      label: "Pinia 🍍",
      logo: "https://pinia.vuejs.org/logo.svg",
      packageName: "pinia",
      homepage: "https://pinia.vuejs.org",
      componentStateTypes,
      app,
      settings: {
        logStoreChanges: {
          label: "Notify about new/deleted stores",
          type: "boolean",
          defaultValue: true
        }
        // useEmojis: {
        //   label: 'Use emojis in messages ⚡️',
        //   type: 'boolean',
        //   defaultValue: true,
        // },
      }
    }, (api) => {
      const now2 = typeof api.now === "function" ? api.now.bind(api) : Date.now;
      store.$onAction(({ after, onError, name, args }) => {
        const groupId = runningActionId++;
        api.addTimelineEvent({
          layerId: MUTATIONS_LAYER_ID,
          event: {
            time: now2(),
            title: "🛫 " + name,
            subtitle: "start",
            data: {
              store: formatDisplay(store.$id),
              action: formatDisplay(name),
              args
            },
            groupId
          }
        });
        after((result) => {
          activeAction = void 0;
          api.addTimelineEvent({
            layerId: MUTATIONS_LAYER_ID,
            event: {
              time: now2(),
              title: "🛬 " + name,
              subtitle: "end",
              data: {
                store: formatDisplay(store.$id),
                action: formatDisplay(name),
                args,
                result
              },
              groupId
            }
          });
        });
        onError((error) => {
          activeAction = void 0;
          api.addTimelineEvent({
            layerId: MUTATIONS_LAYER_ID,
            event: {
              time: now2(),
              logType: "error",
              title: "💥 " + name,
              subtitle: "end",
              data: {
                store: formatDisplay(store.$id),
                action: formatDisplay(name),
                args,
                error
              },
              groupId
            }
          });
        });
      }, true);
      store._customProperties.forEach((name) => {
        vue.watch(() => vue.unref(store[name]), (newValue, oldValue) => {
          api.notifyComponentUpdate();
          api.sendInspectorState(INSPECTOR_ID);
          if (isTimelineActive) {
            api.addTimelineEvent({
              layerId: MUTATIONS_LAYER_ID,
              event: {
                time: now2(),
                title: "Change",
                subtitle: name,
                data: {
                  newValue,
                  oldValue
                },
                groupId: activeAction
              }
            });
          }
        }, { deep: true });
      });
      store.$subscribe(({ events, type }, state) => {
        api.notifyComponentUpdate();
        api.sendInspectorState(INSPECTOR_ID);
        if (!isTimelineActive)
          return;
        const eventData = {
          time: now2(),
          title: formatMutationType(type),
          data: assign$1({ store: formatDisplay(store.$id) }, formatEventData(events)),
          groupId: activeAction
        };
        if (type === MutationType.patchFunction) {
          eventData.subtitle = "⤵️";
        } else if (type === MutationType.patchObject) {
          eventData.subtitle = "🧩";
        } else if (events && !Array.isArray(events)) {
          eventData.subtitle = events.type;
        }
        if (events) {
          eventData.data["rawEvent(s)"] = {
            _custom: {
              display: "DebuggerEvent",
              type: "object",
              tooltip: "raw DebuggerEvent[]",
              value: events
            }
          };
        }
        api.addTimelineEvent({
          layerId: MUTATIONS_LAYER_ID,
          event: eventData
        });
      }, { detached: true, flush: "sync" });
      const hotUpdate = store._hotUpdate;
      store._hotUpdate = vue.markRaw((newStore) => {
        hotUpdate(newStore);
        api.addTimelineEvent({
          layerId: MUTATIONS_LAYER_ID,
          event: {
            time: now2(),
            title: "🔥 " + store.$id,
            subtitle: "HMR update",
            data: {
              store: formatDisplay(store.$id),
              info: formatDisplay(`HMR update`)
            }
          }
        });
        api.notifyComponentUpdate();
        api.sendInspectorTree(INSPECTOR_ID);
        api.sendInspectorState(INSPECTOR_ID);
      });
      const { $dispose } = store;
      store.$dispose = () => {
        $dispose();
        api.notifyComponentUpdate();
        api.sendInspectorTree(INSPECTOR_ID);
        api.sendInspectorState(INSPECTOR_ID);
        api.getSettings().logStoreChanges && toastMessage(`Disposed "${store.$id}" store 🗑`);
      };
      api.notifyComponentUpdate();
      api.sendInspectorTree(INSPECTOR_ID);
      api.sendInspectorState(INSPECTOR_ID);
      api.getSettings().logStoreChanges && toastMessage(`"${store.$id}" store installed 🆕`);
    });
  }
  let runningActionId = 0;
  let activeAction;
  function patchActionForGrouping(store, actionNames, wrapWithProxy) {
    const actions = actionNames.reduce((storeActions, actionName) => {
      storeActions[actionName] = vue.toRaw(store)[actionName];
      return storeActions;
    }, {});
    for (const actionName in actions) {
      store[actionName] = function() {
        const _actionId = runningActionId;
        const trackedStore = wrapWithProxy ? new Proxy(store, {
          get(...args) {
            activeAction = _actionId;
            return Reflect.get(...args);
          },
          set(...args) {
            activeAction = _actionId;
            return Reflect.set(...args);
          }
        }) : store;
        activeAction = _actionId;
        const retValue = actions[actionName].apply(trackedStore, arguments);
        activeAction = void 0;
        return retValue;
      };
    }
  }
  function devtoolsPlugin({ app, store, options }) {
    if (store.$id.startsWith("__hot:")) {
      return;
    }
    store._isOptionsAPI = !!options.state;
    patchActionForGrouping(store, Object.keys(options.actions), store._isOptionsAPI);
    const originalHotUpdate = store._hotUpdate;
    vue.toRaw(store)._hotUpdate = function(newStore) {
      originalHotUpdate.apply(this, arguments);
      patchActionForGrouping(store, Object.keys(newStore._hmrPayload.actions), !!store._isOptionsAPI);
    };
    addStoreToDevtools(
      app,
      // FIXME: is there a way to allow the assignment from Store<Id, S, G, A> to StoreGeneric?
      store
    );
  }
  function createPinia() {
    const scope = vue.effectScope(true);
    const state = scope.run(() => vue.ref({}));
    let _p = [];
    let toBeInstalled = [];
    const pinia2 = vue.markRaw({
      install(app) {
        setActivePinia(pinia2);
        {
          pinia2._a = app;
          app.provide(piniaSymbol, pinia2);
          app.config.globalProperties.$pinia = pinia2;
          if (USE_DEVTOOLS) {
            registerPiniaDevtools(app, pinia2);
          }
          toBeInstalled.forEach((plugin) => _p.push(plugin));
          toBeInstalled = [];
        }
      },
      use(plugin) {
        if (!this._a && !isVue2) {
          toBeInstalled.push(plugin);
        } else {
          _p.push(plugin);
        }
        return this;
      },
      _p,
      // it's actually undefined here
      // @ts-expect-error
      _a: null,
      _e: scope,
      _s: /* @__PURE__ */ new Map(),
      state
    });
    if (USE_DEVTOOLS && typeof Proxy !== "undefined") {
      pinia2.use(devtoolsPlugin);
    }
    return pinia2;
  }
  function patchObject(newState, oldState) {
    for (const key in oldState) {
      const subPatch = oldState[key];
      if (!(key in newState)) {
        continue;
      }
      const targetValue = newState[key];
      if (isPlainObject(targetValue) && isPlainObject(subPatch) && !vue.isRef(subPatch) && !vue.isReactive(subPatch)) {
        newState[key] = patchObject(targetValue, subPatch);
      } else {
        {
          newState[key] = subPatch;
        }
      }
    }
    return newState;
  }
  const noop = () => {
  };
  function addSubscription(subscriptions, callback, detached, onCleanup = noop) {
    subscriptions.push(callback);
    const removeSubscription = () => {
      const idx = subscriptions.indexOf(callback);
      if (idx > -1) {
        subscriptions.splice(idx, 1);
        onCleanup();
      }
    };
    if (!detached && vue.getCurrentScope()) {
      vue.onScopeDispose(removeSubscription);
    }
    return removeSubscription;
  }
  function triggerSubscriptions(subscriptions, ...args) {
    subscriptions.slice().forEach((callback) => {
      callback(...args);
    });
  }
  const fallbackRunWithContext = (fn2) => fn2();
  function mergeReactiveObjects(target, patchToApply) {
    if (target instanceof Map && patchToApply instanceof Map) {
      patchToApply.forEach((value2, key) => target.set(key, value2));
    }
    if (target instanceof Set && patchToApply instanceof Set) {
      patchToApply.forEach(target.add, target);
    }
    for (const key in patchToApply) {
      if (!patchToApply.hasOwnProperty(key))
        continue;
      const subPatch = patchToApply[key];
      const targetValue = target[key];
      if (isPlainObject(targetValue) && isPlainObject(subPatch) && target.hasOwnProperty(key) && !vue.isRef(subPatch) && !vue.isReactive(subPatch)) {
        target[key] = mergeReactiveObjects(targetValue, subPatch);
      } else {
        target[key] = subPatch;
      }
    }
    return target;
  }
  const skipHydrateSymbol = Symbol("pinia:skipHydration");
  function shouldHydrate(obj) {
    return !isPlainObject(obj) || !obj.hasOwnProperty(skipHydrateSymbol);
  }
  const { assign } = Object;
  function isComputed(o2) {
    return !!(vue.isRef(o2) && o2.effect);
  }
  function createOptionsStore(id, options, pinia2, hot) {
    const { state, actions, getters } = options;
    const initialState = pinia2.state.value[id];
    let store;
    function setup2() {
      if (!initialState && !hot) {
        {
          pinia2.state.value[id] = state ? state() : {};
        }
      }
      const localState = hot ? (
        // use ref() to unwrap refs inside state TODO: check if this is still necessary
        vue.toRefs(vue.ref(state ? state() : {}).value)
      ) : vue.toRefs(pinia2.state.value[id]);
      return assign(localState, actions, Object.keys(getters || {}).reduce((computedGetters, name) => {
        if (name in localState) {
          console.warn(`[🍍]: A getter cannot have the same name as another state property. Rename one of them. Found with "${name}" in store "${id}".`);
        }
        computedGetters[name] = vue.markRaw(vue.computed(() => {
          setActivePinia(pinia2);
          const store2 = pinia2._s.get(id);
          return getters[name].call(store2, store2);
        }));
        return computedGetters;
      }, {}));
    }
    store = createSetupStore(id, setup2, options, pinia2, hot, true);
    return store;
  }
  function createSetupStore($id, setup2, options = {}, pinia2, hot, isOptionsStore) {
    let scope;
    const optionsForPlugin = assign({ actions: {} }, options);
    if (!pinia2._e.active) {
      throw new Error("Pinia destroyed");
    }
    const $subscribeOptions = {
      deep: true
      // flush: 'post',
    };
    {
      $subscribeOptions.onTrigger = (event) => {
        if (isListening) {
          debuggerEvents = event;
        } else if (isListening == false && !store._hotUpdating) {
          if (Array.isArray(debuggerEvents)) {
            debuggerEvents.push(event);
          } else {
            console.error("🍍 debuggerEvents should be an array. This is most likely an internal Pinia bug.");
          }
        }
      };
    }
    let isListening;
    let isSyncListening;
    let subscriptions = [];
    let actionSubscriptions = [];
    let debuggerEvents;
    const initialState = pinia2.state.value[$id];
    if (!isOptionsStore && !initialState && !hot) {
      {
        pinia2.state.value[$id] = {};
      }
    }
    const hotState = vue.ref({});
    let activeListener;
    function $patch(partialStateOrMutator) {
      let subscriptionMutation;
      isListening = isSyncListening = false;
      {
        debuggerEvents = [];
      }
      if (typeof partialStateOrMutator === "function") {
        partialStateOrMutator(pinia2.state.value[$id]);
        subscriptionMutation = {
          type: MutationType.patchFunction,
          storeId: $id,
          events: debuggerEvents
        };
      } else {
        mergeReactiveObjects(pinia2.state.value[$id], partialStateOrMutator);
        subscriptionMutation = {
          type: MutationType.patchObject,
          payload: partialStateOrMutator,
          storeId: $id,
          events: debuggerEvents
        };
      }
      const myListenerId = activeListener = Symbol();
      vue.nextTick().then(() => {
        if (activeListener === myListenerId) {
          isListening = true;
        }
      });
      isSyncListening = true;
      triggerSubscriptions(subscriptions, subscriptionMutation, pinia2.state.value[$id]);
    }
    const $reset = isOptionsStore ? function $reset2() {
      const { state } = options;
      const newState = state ? state() : {};
      this.$patch(($state) => {
        assign($state, newState);
      });
    } : (
      /* istanbul ignore next */
      () => {
        throw new Error(`🍍: Store "${$id}" is built using the setup syntax and does not implement $reset().`);
      }
    );
    function $dispose() {
      scope.stop();
      subscriptions = [];
      actionSubscriptions = [];
      pinia2._s.delete($id);
    }
    function wrapAction(name, action) {
      return function() {
        setActivePinia(pinia2);
        const args = Array.from(arguments);
        const afterCallbackList = [];
        const onErrorCallbackList = [];
        function after(callback) {
          afterCallbackList.push(callback);
        }
        function onError(callback) {
          onErrorCallbackList.push(callback);
        }
        triggerSubscriptions(actionSubscriptions, {
          args,
          name,
          store,
          after,
          onError
        });
        let ret;
        try {
          ret = action.apply(this && this.$id === $id ? this : store, args);
        } catch (error) {
          triggerSubscriptions(onErrorCallbackList, error);
          throw error;
        }
        if (ret instanceof Promise) {
          return ret.then((value2) => {
            triggerSubscriptions(afterCallbackList, value2);
            return value2;
          }).catch((error) => {
            triggerSubscriptions(onErrorCallbackList, error);
            return Promise.reject(error);
          });
        }
        triggerSubscriptions(afterCallbackList, ret);
        return ret;
      };
    }
    const _hmrPayload = /* @__PURE__ */ vue.markRaw({
      actions: {},
      getters: {},
      state: [],
      hotState
    });
    const partialStore = {
      _p: pinia2,
      // _s: scope,
      $id,
      $onAction: addSubscription.bind(null, actionSubscriptions),
      $patch,
      $reset,
      $subscribe(callback, options2 = {}) {
        const removeSubscription = addSubscription(subscriptions, callback, options2.detached, () => stopWatcher());
        const stopWatcher = scope.run(() => vue.watch(() => pinia2.state.value[$id], (state) => {
          if (options2.flush === "sync" ? isSyncListening : isListening) {
            callback({
              storeId: $id,
              type: MutationType.direct,
              events: debuggerEvents
            }, state);
          }
        }, assign({}, $subscribeOptions, options2)));
        return removeSubscription;
      },
      $dispose
    };
    const store = vue.reactive(assign(
      {
        _hmrPayload,
        _customProperties: vue.markRaw(/* @__PURE__ */ new Set())
        // devtools custom properties
      },
      partialStore
      // must be added later
      // setupStore
    ));
    pinia2._s.set($id, store);
    const runWithContext = pinia2._a && pinia2._a.runWithContext || fallbackRunWithContext;
    const setupStore = runWithContext(() => pinia2._e.run(() => (scope = vue.effectScope()).run(setup2)));
    for (const key in setupStore) {
      const prop = setupStore[key];
      if (vue.isRef(prop) && !isComputed(prop) || vue.isReactive(prop)) {
        if (hot) {
          set(hotState.value, key, vue.toRef(setupStore, key));
        } else if (!isOptionsStore) {
          if (initialState && shouldHydrate(prop)) {
            if (vue.isRef(prop)) {
              prop.value = initialState[key];
            } else {
              mergeReactiveObjects(prop, initialState[key]);
            }
          }
          {
            pinia2.state.value[$id][key] = prop;
          }
        }
        {
          _hmrPayload.state.push(key);
        }
      } else if (typeof prop === "function") {
        const actionValue = hot ? prop : wrapAction(key, prop);
        {
          setupStore[key] = actionValue;
        }
        {
          _hmrPayload.actions[key] = prop;
        }
        optionsForPlugin.actions[key] = prop;
      } else {
        if (isComputed(prop)) {
          _hmrPayload.getters[key] = isOptionsStore ? (
            // @ts-expect-error
            options.getters[key]
          ) : prop;
          if (IS_CLIENT) {
            const getters = setupStore._getters || // @ts-expect-error: same
            (setupStore._getters = vue.markRaw([]));
            getters.push(key);
          }
        }
      }
    }
    {
      assign(store, setupStore);
      assign(vue.toRaw(store), setupStore);
    }
    Object.defineProperty(store, "$state", {
      get: () => hot ? hotState.value : pinia2.state.value[$id],
      set: (state) => {
        if (hot) {
          throw new Error("cannot set hotState");
        }
        $patch(($state) => {
          assign($state, state);
        });
      }
    });
    {
      store._hotUpdate = vue.markRaw((newStore) => {
        store._hotUpdating = true;
        newStore._hmrPayload.state.forEach((stateKey) => {
          if (stateKey in store.$state) {
            const newStateTarget = newStore.$state[stateKey];
            const oldStateSource = store.$state[stateKey];
            if (typeof newStateTarget === "object" && isPlainObject(newStateTarget) && isPlainObject(oldStateSource)) {
              patchObject(newStateTarget, oldStateSource);
            } else {
              newStore.$state[stateKey] = oldStateSource;
            }
          }
          set(store, stateKey, vue.toRef(newStore.$state, stateKey));
        });
        Object.keys(store.$state).forEach((stateKey) => {
          if (!(stateKey in newStore.$state)) {
            del(store, stateKey);
          }
        });
        isListening = false;
        isSyncListening = false;
        pinia2.state.value[$id] = vue.toRef(newStore._hmrPayload, "hotState");
        isSyncListening = true;
        vue.nextTick().then(() => {
          isListening = true;
        });
        for (const actionName in newStore._hmrPayload.actions) {
          const action = newStore[actionName];
          set(store, actionName, wrapAction(actionName, action));
        }
        for (const getterName in newStore._hmrPayload.getters) {
          const getter = newStore._hmrPayload.getters[getterName];
          const getterValue = isOptionsStore ? (
            // special handling of options api
            vue.computed(() => {
              setActivePinia(pinia2);
              return getter.call(store, store);
            })
          ) : getter;
          set(store, getterName, getterValue);
        }
        Object.keys(store._hmrPayload.getters).forEach((key) => {
          if (!(key in newStore._hmrPayload.getters)) {
            del(store, key);
          }
        });
        Object.keys(store._hmrPayload.actions).forEach((key) => {
          if (!(key in newStore._hmrPayload.actions)) {
            del(store, key);
          }
        });
        store._hmrPayload = newStore._hmrPayload;
        store._getters = newStore._getters;
        store._hotUpdating = false;
      });
    }
    if (USE_DEVTOOLS) {
      const nonEnumerable = {
        writable: true,
        configurable: true,
        // avoid warning on devtools trying to display this property
        enumerable: false
      };
      ["_p", "_hmrPayload", "_getters", "_customProperties"].forEach((p2) => {
        Object.defineProperty(store, p2, assign({ value: store[p2] }, nonEnumerable));
      });
    }
    pinia2._p.forEach((extender) => {
      if (USE_DEVTOOLS) {
        const extensions = scope.run(() => extender({
          store,
          app: pinia2._a,
          pinia: pinia2,
          options: optionsForPlugin
        }));
        Object.keys(extensions || {}).forEach((key) => store._customProperties.add(key));
        assign(store, extensions);
      } else {
        assign(store, scope.run(() => extender({
          store,
          app: pinia2._a,
          pinia: pinia2,
          options: optionsForPlugin
        })));
      }
    });
    if (store.$state && typeof store.$state === "object" && typeof store.$state.constructor === "function" && !store.$state.constructor.toString().includes("[native code]")) {
      console.warn(`[🍍]: The "state" must be a plain object. It cannot be
	state: () => new MyClass()
Found in store "${store.$id}".`);
    }
    if (initialState && isOptionsStore && options.hydrate) {
      options.hydrate(store.$state, initialState);
    }
    isListening = true;
    isSyncListening = true;
    return store;
  }
  function defineStore(idOrOptions, setup2, setupOptions) {
    let id;
    let options;
    const isSetupStore = typeof setup2 === "function";
    if (typeof idOrOptions === "string") {
      id = idOrOptions;
      options = isSetupStore ? setupOptions : setup2;
    } else {
      options = idOrOptions;
      id = idOrOptions.id;
      if (typeof id !== "string") {
        throw new Error(`[🍍]: "defineStore()" must be passed a store id as its first argument.`);
      }
    }
    function useStore(pinia2, hot) {
      const hasContext = vue.hasInjectionContext();
      pinia2 = // in test mode, ignore the argument provided as we can always retrieve a
      // pinia instance with getActivePinia()
      pinia2 || (hasContext ? vue.inject(piniaSymbol, null) : null);
      if (pinia2)
        setActivePinia(pinia2);
      if (!activePinia) {
        throw new Error(`[🍍]: "getActivePinia()" was called but there was no active Pinia. Are you trying to use a store before calling "app.use(pinia)"?
See https://pinia.vuejs.org/core-concepts/outside-component-usage.html for help.
This will fail in production.`);
      }
      pinia2 = activePinia;
      if (!pinia2._s.has(id)) {
        if (isSetupStore) {
          createSetupStore(id, setup2, options, pinia2);
        } else {
          createOptionsStore(id, options, pinia2);
        }
        {
          useStore._pinia = pinia2;
        }
      }
      const store = pinia2._s.get(id);
      if (hot) {
        const hotId = "__hot:" + id;
        const newStore = isSetupStore ? createSetupStore(hotId, setup2, options, pinia2, true) : createOptionsStore(hotId, assign({}, options), pinia2, true);
        hot._hotUpdate(newStore);
        delete pinia2.state.value[hotId];
        pinia2._s.delete(hotId);
      }
      if (IS_CLIENT) {
        const currentInstance = vue.getCurrentInstance();
        if (currentInstance && currentInstance.proxy && // avoid adding stores that are just built for hot module replacement
        !hot) {
          const vm = currentInstance.proxy;
          const cache2 = "_pStores" in vm ? vm._pStores : vm._pStores = {};
          cache2[id] = store;
        }
      }
      return store;
    }
    useStore.$id = id;
    return useStore;
  }
  const useUserStore = defineStore("user", {
    state: () => ({
      token: getToken(),
      userInfo: getUser()
    }),
    getters: {
      isLoggedIn: (state) => !!(state.token && state.userInfo),
      role: (state) => {
        var _a;
        return ((_a = state.userInfo) == null ? void 0 : _a["角色"]) || "user";
      },
      nickname: (state) => {
        var _a;
        return ((_a = state.userInfo) == null ? void 0 : _a["昵称"]) || "";
      }
    },
    actions: {
      login(token, userInfo) {
        this.token = token;
        this.userInfo = userInfo;
        setToken(token);
        setUser(userInfo);
      },
      logout() {
        this.token = "";
        this.userInfo = null;
        clearAuth();
      }
    }
  });
  function isValidPhone(phone) {
    return /^1[3-9]\d{9}$/.test(phone);
  }
  function isValidPassword(pwd) {
    return typeof pwd === "string" && pwd.length >= 6;
  }
  function isNotEmpty(str) {
    return typeof str === "string" && str.trim().length > 0;
  }
  const normalizeCoordinateValue$3 = (value2) => {
    if (value2 == null)
      return null;
    const raw = typeof value2 === "string" ? value2.trim() : value2;
    if (raw === "")
      return null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  };
  const getValidCoordinatePair$3 = (latitude, longitude) => {
    const lat = normalizeCoordinateValue$3(latitude);
    const lng = normalizeCoordinateValue$3(longitude);
    if (lat == null || lng == null)
      return null;
    if (lat === 0 && lng === 0)
      return null;
    return {
      latitude: lat,
      longitude: lng
    };
  };
  const _sfc_main$e = {
    data() {
      return {
        isRegister: false,
        phone: "",
        verifyCode: "",
        password: "",
        confirmPassword: "",
        store_name: "",
        address: "",
        latitude: null,
        longitude: null,
        category: "",
        supermarket_channel_direction: "普通超市",
        supermarket_delivery_permission: "",
        business_scope: "county_food",
        business_license: "",
        businessScopeOptions: [
          { value: "county_food", label: "固始县城县域商家" },
          { value: "town_food", label: "乡镇商家" }
        ],
        supermarketDeliveryOptions: [
          { value: "self_only", label: "自己配送" },
          { value: "rider_only", label: "骑手配送" },
          { value: "hybrid", label: "两个都支持" }
        ],
        supermarketChannelOptions: [
          { value: "普通超市", label: "普通超市" },
          { value: "冷饮雪糕批发", label: "冷饮雪糕批发" }
        ],
        categoryOptions: [],
        categoryPickerIndex: 0,
        categoryLoading: false,
        categoryLoadFailed: false,
        townOptions: [],
        townPickerIndex: 0,
        townLoading: false,
        uploadingLicense: false,
        loading: false
      };
    },
    computed: {
      scopePickerIndex() {
        const i2 = this.businessScopeOptions.findIndex((o2) => o2.value === this.business_scope);
        return i2 >= 0 ? i2 : 0;
      },
      currentBusinessScopeLabel() {
        const o2 = this.businessScopeOptions[this.scopePickerIndex];
        return o2 ? o2.label : "请选择所属经营区域";
      },
      hasLocationCoords() {
        return !!getValidCoordinatePair$3(this.latitude, this.longitude);
      },
      currentCategoryLabel() {
        if (this.category)
          return this.category;
        return this.categoryLoading ? "主营类目加载中..." : "请选择主营类目";
      },
      currentTownLabel() {
        const o2 = this.townOptions[this.townPickerIndex];
        if (o2)
          return o2.label;
        return this.townLoading ? "乡镇加载中..." : "请选择所属乡镇";
      },
      businessLicensePreviewUrl() {
        if (!this.business_license)
          return "";
        if (this.business_license.startsWith("http://") || this.business_license.startsWith("https://") || this.business_license.startsWith("data:image") || this.business_license.startsWith("blob:")) {
          return this.business_license;
        }
        return this.business_license.startsWith("/") ? BASE_URL + this.business_license : BASE_URL + "/" + this.business_license;
      }
    },
    methods: {
      resetRegisterForm() {
        this.password = "";
        this.confirmPassword = "";
        this.verifyCode = "";
        this.store_name = "";
        this.address = "";
        this.latitude = null;
        this.longitude = null;
        this.category = "";
        this.supermarket_channel_direction = "普通超市";
        this.supermarket_delivery_permission = "";
        this.business_scope = "county_food";
        this.business_license = "";
        this.categoryPickerIndex = 0;
        this.townPickerIndex = 0;
      },
      switchAuthMode(isRegister) {
        this.isRegister = isRegister;
        if (isRegister) {
          this.ensureCategoryOptions();
        }
        if (isRegister && this.business_scope === "town_food") {
          this.ensureTownOptions();
        }
      },
      onBusinessScopeChange(e2) {
        const i2 = Number(e2.detail.value);
        const o2 = this.businessScopeOptions[i2];
        if (!o2)
          return;
        this.business_scope = o2.value;
        if (o2.value === "town_food") {
          this.ensureTownOptions();
        }
      },
      onTownChange(e2) {
        this.townPickerIndex = Number(e2.detail.value);
      },
      onCategoryChange(e2) {
        if (!this.categoryOptions.length)
          return;
        const previousCategory = this.category;
        const index = Number(e2.detail.value);
        this.categoryPickerIndex = index;
        this.category = this.categoryOptions[index] || "";
        if (this.category === "超市" && previousCategory !== "超市") {
          this.supermarket_channel_direction = "普通超市";
          return;
        }
        if (this.category !== "超市" && previousCategory === "超市") {
          this.supermarket_channel_direction = "普通超市";
          this.supermarket_delivery_permission = "";
        }
      },
      onSupermarketChannelDirectionChange(e2) {
        var _a;
        const value2 = ((_a = e2 == null ? void 0 : e2.detail) == null ? void 0 : _a.value) || "普通超市";
        this.supermarket_channel_direction = value2 === "冷饮雪糕批发" ? "冷饮雪糕批发" : "普通超市";
        formatAppLog("log", "at pages/login/index.vue:338", "[merchant-register][supermarket-direction-change]", {
          category: this.category,
          supermarket_channel_direction: this.supermarket_channel_direction
        });
      },
      onSupermarketDeliveryPermissionChange(e2) {
        var _a;
        this.supermarket_delivery_permission = ((_a = e2 == null ? void 0 : e2.detail) == null ? void 0 : _a.value) || "";
      },
      formatCoord(v2) {
        if (v2 == null || v2 === "")
          return "-";
        const n2 = Number(v2);
        return Number.isFinite(n2) ? n2.toFixed(6) : String(v2);
      },
      openTiandituPicker() {
        const lat = this.latitude != null ? String(this.latitude) : "";
        const lng = this.longitude != null ? String(this.longitude) : "";
        const address = this.address != null ? String(this.address) : "";
        uni.navigateTo({
          url: `/pages/shop/tianditu-picker?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&address=${encodeURIComponent(address)}`,
          events: {
            picked: (data) => {
              if (!data)
                return;
              const coordinatePair = getValidCoordinatePair$3(data.latitude, data.longitude);
              if (!coordinatePair) {
                this.latitude = null;
                this.longitude = null;
                uni.showToast({ title: "地图选点无效，请重新选点", icon: "none" });
                return;
              }
              this.latitude = coordinatePair.latitude;
              this.longitude = coordinatePair.longitude;
              if (data.address) {
                this.address = data.address;
              } else if (data.town) {
                this.address = data.town;
              }
            }
          }
        });
      },
      async ensureCategoryOptions() {
        if (this.categoryLoading || this.categoryOptions.length)
          return;
        this.categoryLoading = true;
        this.categoryLoadFailed = false;
        try {
          const res = await getMerchantPrimaryCategories();
          const list = Array.isArray(res) ? res : Array.isArray(res == null ? void 0 : res.data) ? res.data : [];
          const categoryOptions = list.map((item) => String(item || "").trim()).filter(Boolean);
          if (!categoryOptions.length) {
            uni.showToast({ title: "未获取到主营类目，请稍后重试", icon: "none" });
            return;
          }
          this.categoryOptions = categoryOptions;
          const currentIndex = this.categoryOptions.findIndex((item) => item === this.category);
          this.categoryPickerIndex = currentIndex >= 0 ? currentIndex : 0;
        } catch (e2) {
          this.categoryOptions = [];
          this.categoryLoadFailed = true;
        } finally {
          this.categoryLoading = false;
        }
      },
      async ensureTownOptions() {
        if (this.townLoading || this.townOptions.length)
          return;
        this.townLoading = true;
        try {
          const res = await getTownServiceAreas();
          const list = Array.isArray(res) ? res : Array.isArray(res == null ? void 0 : res.data) ? res.data : [];
          const townOptions = list.filter((item) => (item == null ? void 0 : item.area_code) && (item == null ? void 0 : item.area_name)).map((item) => ({
            town_code: item.area_code,
            label: item.area_name
          }));
          if (!townOptions.length) {
            uni.showToast({ title: "未获取到乡镇数据，请稍后重试", icon: "none" });
            return;
          }
          this.townOptions = townOptions;
          this.townPickerIndex = 0;
        } catch (e2) {
          this.townOptions = [];
        } finally {
          this.townLoading = false;
        }
      },
      chooseAndUploadLicense() {
        if (this.uploadingLicense)
          return;
        uni.chooseImage({
          count: 1,
          sizeType: ["compressed"],
          sourceType: ["album", "camera"],
          success: (chooseRes) => {
            const filePath = chooseRes.tempFilePaths && chooseRes.tempFilePaths[0];
            if (!filePath)
              return;
            this.uploadingLicense = true;
            const token = uni.getStorageSync("token") || "";
            const header = token ? { Authorization: "Bearer " + token } : {};
            uni.uploadFile({
              url: BASE_URL + "/api/upload/image",
              filePath,
              name: "file",
              header,
              success: (uploadRes) => {
                const url2 = this.parseUploadResponse(uploadRes.data);
                if (!url2) {
                  uni.showToast({ title: "营业执照上传失败", icon: "none" });
                  return;
                }
                this.business_license = url2;
                uni.showToast({ title: "营业执照上传成功", icon: "success" });
              },
              fail: () => {
                uni.showToast({ title: "营业执照上传失败", icon: "none" });
              },
              complete: () => {
                this.uploadingLicense = false;
              }
            });
          },
          fail: (err) => {
            const msg = err && err.errMsg || "选择图片失败";
            uni.showToast({ title: msg, icon: "none" });
          }
        });
      },
      parseUploadResponse(rawData) {
        let parsed = rawData;
        if (typeof rawData === "string") {
          try {
            parsed = JSON.parse(rawData);
          } catch (e2) {
            parsed = null;
          }
        }
        const data = parsed && parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
        const url2 = data && data.url ? data.url : "";
        return url2 ? String(url2) : "";
      },
      previewBusinessLicense() {
        if (!this.businessLicensePreviewUrl)
          return;
        uni.previewImage({ urls: [this.businessLicensePreviewUrl], current: this.businessLicensePreviewUrl });
      },
      extractMerchantAuditState(loginRes, userInfo) {
        var _a, _b, _c;
        const candidates = [
          (_b = (_a = loginRes == null ? void 0 : loginRes.data) == null ? void 0 : _a.user) == null ? void 0 : _b.audit_status,
          (_c = loginRes == null ? void 0 : loginRes.data) == null ? void 0 : _c.audit_status,
          userInfo == null ? void 0 : userInfo.audit_status
        ];
        for (const value2 of candidates) {
          const auditStatus = Number(value2);
          if ([0, 1, 2].includes(auditStatus))
            return auditStatus;
        }
        return null;
      },
      handleBlockedAuditState(auditState) {
        const blockedMap = {
          0: {
            title: "待平台审核",
            content: "入驻申请已提交，请等待平台审核"
          },
          2: {
            title: "审核未通过",
            content: "入驻审核未通过，请联系平台后重新提交"
          }
        };
        const modal = blockedMap[auditState];
        if (!modal)
          return false;
        uni.showModal({
          title: modal.title,
          content: modal.content,
          showCancel: false
        });
        return true;
      },
      async handleSubmit() {
        var _a, _b, _c, _d;
        if (!isValidPhone(this.phone)) {
          uni.showToast({ title: "请输入正确的11位手机号", icon: "none" });
          return;
        }
        if (!isValidPassword(this.password)) {
          uni.showToast({ title: "密码至少6位", icon: "none" });
          return;
        }
        if (this.isRegister && this.password !== this.confirmPassword) {
          uni.showToast({ title: "两次输入的密码不一致", icon: "none" });
          return;
        }
        if (this.isRegister && !isNotEmpty(this.store_name)) {
          uni.showToast({ title: "请填写店铺名称", icon: "none" });
          return;
        }
        if (this.isRegister && !isNotEmpty(this.address)) {
          uni.showToast({ title: "请先选择店铺位置", icon: "none" });
          return;
        }
        if (this.isRegister && !this.hasLocationCoords) {
          uni.showToast({ title: "请在地图上完成店铺选点", icon: "none" });
          return;
        }
        if (this.isRegister && this.categoryLoading) {
          uni.showToast({ title: "主营类目加载中，请稍后", icon: "none" });
          return;
        }
        if (this.isRegister && !this.categoryOptions.length) {
          uni.showToast({ title: "主营类目暂不可用，请稍后重试", icon: "none" });
          return;
        }
        if (this.isRegister && !isNotEmpty(this.category)) {
          uni.showToast({ title: "请选择主营类目", icon: "none" });
          return;
        }
        if (this.isRegister && !this.categoryOptions.includes(this.category)) {
          uni.showToast({ title: "请选择有效的主营类目", icon: "none" });
          return;
        }
        if (this.isRegister && this.category === "超市" && !isNotEmpty(this.supermarket_delivery_permission)) {
          uni.showToast({ title: "请选择超市配送方式", icon: "none" });
          return;
        }
        if (this.isRegister && this.business_scope === "town_food") {
          const t2 = this.townOptions[this.townPickerIndex];
          if (!t2 || !t2.town_code) {
            uni.showToast({ title: "请选择所属乡镇", icon: "none" });
            return;
          }
        }
        if (this.isRegister && !isNotEmpty(this.business_license)) {
          uni.showToast({ title: "请先上传营业执照", icon: "none" });
          return;
        }
        const coordinatePair = this.isRegister ? getValidCoordinatePair$3(this.latitude, this.longitude) : null;
        if (this.isRegister && !coordinatePair) {
          uni.showToast({ title: "地图坐标无效，请重新选点", icon: "none" });
          return;
        }
        this.loading = true;
        try {
          if (this.isRegister) {
            const normalizedCategory = String(this.category || "").trim();
            const normalizedSupermarketChannelDirection = String(this.supermarket_channel_direction || "").trim();
            const payload = {
              phone: this.phone,
              password: this.password,
              store_name: this.store_name.trim(),
              address: this.address.trim(),
              latitude: coordinatePair.latitude,
              longitude: coordinatePair.longitude,
              category: normalizedCategory,
              business_scope: this.business_scope,
              business_license: this.business_license.trim()
            };
            if (normalizedCategory === "超市") {
              payload.supermarket_delivery_permission = this.supermarket_delivery_permission;
              if (normalizedSupermarketChannelDirection === "冷饮雪糕批发") {
                payload.channel_tags = "冷饮雪糕批发";
              }
            }
            if (this.business_scope === "town_food") {
              payload.town_code = this.townOptions[this.townPickerIndex].town_code;
            }
            formatAppLog("log", "at pages/login/index.vue:611", "[merchant-register][submit-before]", {
              category: normalizedCategory,
              supermarket_channel_direction: normalizedSupermarketChannelDirection,
              payload
            });
            await registerMerchant(payload);
            this.switchAuthMode(false);
            this.resetRegisterForm();
            uni.showModal({
              title: "入驻申请已提交",
              content: "请等待平台审核，审核通过后即可正式经营。",
              showCancel: false
            });
          } else {
            const res = await login({
              phone: this.phone,
              password: this.password
            });
            const userStore = useUserStore();
            const token = ((_a = res.data) == null ? void 0 : _a.token) || res.token || res.access_token || ((_b = res.data) == null ? void 0 : _b.access_token) || "";
            const userInfo = ((_c = res.data) == null ? void 0 : _c.userInfo) || ((_d = res.data) == null ? void 0 : _d.user) || res.userInfo || res.user || null;
            if (!token || !userInfo || !isMerchantUser(userInfo) || !getUserId(userInfo)) {
              clearAuth();
              uni.showToast({ title: "登录返回数据异常，未获取到 Token", icon: "none" });
              return;
            }
            const auditState = this.extractMerchantAuditState(res, userInfo);
            if (this.handleBlockedAuditState(auditState)) {
              return;
            }
            userStore.login(token, userInfo);
            const userId = getUserId(userInfo);
            initSocket(token, userId);
            ensureMerchantNotifyReady();
            uni.showToast({ title: "登录成功", icon: "success" });
            setTimeout(() => {
              uni.reLaunch({ url: `/pages/shop/shop-apply?token=${token}` });
            }, 50);
          }
        } catch (e2) {
        } finally {
          this.loading = false;
        }
      }
    },
    onLoad() {
      this.ensureCategoryOptions();
    }
  };
  function _sfc_render$d(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "logo-area" }, [
        vue.createElementVNode("text", { class: "logo-emoji" }, "🏪"),
        vue.createElementVNode("text", { class: "logo-title" }, "固始县外卖"),
        vue.createElementVNode("text", { class: "logo-sub" }, "商家端 · 店铺经营与订单管理")
      ]),
      vue.createElementVNode("view", { class: "form-card" }, [
        vue.createElementVNode("view", { class: "tab-bar" }, [
          vue.createElementVNode(
            "text",
            {
              class: vue.normalizeClass(["tab-item", !$data.isRegister && "tab-active"]),
              onClick: _cache[0] || (_cache[0] = ($event) => $options.switchAuthMode(false))
            },
            "登录",
            2
            /* CLASS */
          ),
          vue.createElementVNode(
            "text",
            {
              class: vue.normalizeClass(["tab-item", $data.isRegister && "tab-active"]),
              onClick: _cache[1] || (_cache[1] = ($event) => $options.switchAuthMode(true))
            },
            "注册",
            2
            /* CLASS */
          )
        ]),
        vue.createElementVNode("view", { class: "input-group" }, [
          vue.createElementVNode("text", { class: "input-icon" }, "📱"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "input",
              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => $data.phone = $event),
              placeholder: "请输入手机号",
              type: "number",
              maxlength: "11"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.phone]
          ])
        ]),
        $data.isRegister ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "input-group verify-row"
        }, [
          vue.createElementVNode("text", { class: "input-icon" }, "🔢"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "input",
              "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => $data.verifyCode = $event),
              placeholder: "请输入短信验证码（预留）",
              maxlength: "6"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.verifyCode]
          ]),
          vue.createElementVNode("button", {
            class: "verify-btn",
            type: "default",
            disabled: ""
          }, "发送验证码")
        ])) : vue.createCommentVNode("v-if", true),
        vue.createElementVNode("view", { class: "input-group" }, [
          vue.createElementVNode("text", { class: "input-icon" }, "🔒"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "input",
              "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => $data.password = $event),
              placeholder: "请输入密码",
              password: ""
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.password]
          ])
        ]),
        $data.isRegister ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "input-group"
        }, [
          vue.createElementVNode("text", { class: "input-icon" }, "✅"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "input",
              "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => $data.confirmPassword = $event),
              placeholder: "请再次输入密码",
              password: ""
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.confirmPassword]
          ])
        ])) : vue.createCommentVNode("v-if", true),
        $data.isRegister ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 2,
          class: "input-group"
        }, [
          vue.createElementVNode("text", { class: "input-icon" }, "🏪"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "input",
              "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => $data.store_name = $event),
              placeholder: "店铺名称（必填）"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.store_name]
          ])
        ])) : vue.createCommentVNode("v-if", true),
        $data.isRegister ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 3,
          class: "input-group picker-row"
        }, [
          vue.createElementVNode("text", { class: "input-icon" }, "🗺️"),
          vue.createElementVNode("view", { class: "picker-block" }, [
            vue.createElementVNode("text", { class: "picker-label" }, "店铺位置（必填）"),
            $options.hasLocationCoords ? (vue.openBlock(), vue.createElementBlock(
              "view",
              {
                key: 0,
                class: "picker-value coord-text"
              },
              " 纬度 " + vue.toDisplayString($options.formatCoord($data.latitude)) + "，经度 " + vue.toDisplayString($options.formatCoord($data.longitude)),
              1
              /* TEXT */
            )) : (vue.openBlock(), vue.createElementBlock(
              "view",
              {
                key: 1,
                class: "picker-value"
              },
              vue.toDisplayString($data.address ? $data.address : "请先在地图上选择店铺位置"),
              1
              /* TEXT */
            )),
            $data.address ? (vue.openBlock(), vue.createElementBlock(
              "text",
              {
                key: 2,
                class: "picker-tip"
              },
              vue.toDisplayString($data.address),
              1
              /* TEXT */
            )) : vue.createCommentVNode("v-if", true),
            vue.createElementVNode("button", {
              class: "location-btn",
              type: "default",
              onClick: _cache[7] || (_cache[7] = (...args) => $options.openTiandituPicker && $options.openTiandituPicker(...args))
            }, "在地图上选择店铺位置")
          ])
        ])) : vue.createCommentVNode("v-if", true),
        $data.isRegister ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 4,
          class: "input-group picker-row"
        }, [
          vue.createElementVNode("text", { class: "input-icon" }, "📍"),
          vue.createElementVNode("view", { class: "picker-block" }, [
            vue.createElementVNode("text", { class: "picker-label" }, "所属经营区域（必选）"),
            vue.createElementVNode("picker", {
              mode: "selector",
              range: $data.businessScopeOptions,
              "range-key": "label",
              value: $options.scopePickerIndex,
              onChange: _cache[8] || (_cache[8] = (...args) => $options.onBusinessScopeChange && $options.onBusinessScopeChange(...args))
            }, [
              vue.createElementVNode(
                "view",
                { class: "picker-value" },
                vue.toDisplayString($options.currentBusinessScopeLabel),
                1
                /* TEXT */
              )
            ], 40, ["range", "value"]),
            vue.createElementVNode("text", { class: "picker-tip" }, "用于区分商家所属区域线，不用于区分美食、超市等主营类目")
          ])
        ])) : vue.createCommentVNode("v-if", true),
        $data.isRegister ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 5,
          class: "input-group picker-row"
        }, [
          vue.createElementVNode("text", { class: "input-icon" }, "🏷️"),
          vue.createElementVNode("view", { class: "picker-block" }, [
            vue.createElementVNode("text", { class: "picker-label" }, "主营类目（必填）"),
            vue.createElementVNode("picker", {
              mode: "selector",
              range: $data.categoryOptions,
              value: $data.categoryPickerIndex,
              disabled: !$data.categoryOptions.length,
              onChange: _cache[9] || (_cache[9] = (...args) => $options.onCategoryChange && $options.onCategoryChange(...args))
            }, [
              vue.createElementVNode(
                "view",
                { class: "picker-value" },
                vue.toDisplayString($options.currentCategoryLabel),
                1
                /* TEXT */
              )
            ], 40, ["range", "value", "disabled"]),
            $data.categoryLoading ? (vue.openBlock(), vue.createElementBlock("text", {
              key: 0,
              class: "picker-tip"
            }, "主营类目加载中...")) : $data.categoryLoadFailed ? (vue.openBlock(), vue.createElementBlock("text", {
              key: 1,
              class: "picker-tip error"
            }, "主营类目加载失败，请稍后重试")) : !$data.categoryOptions.length ? (vue.openBlock(), vue.createElementBlock("text", {
              key: 2,
              class: "picker-tip error"
            }, "暂无可选主营类目")) : vue.createCommentVNode("v-if", true)
          ])
        ])) : vue.createCommentVNode("v-if", true),
        $data.isRegister && $data.category === "超市" ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 6,
          class: "input-group delivery-row"
        }, [
          vue.createElementVNode("text", { class: "input-icon" }, "🚚"),
          vue.createElementVNode("view", { class: "picker-block" }, [
            vue.createElementVNode("text", { class: "picker-label" }, "经营方向"),
            vue.createElementVNode(
              "radio-group",
              {
                class: "delivery-group",
                onChange: _cache[10] || (_cache[10] = (...args) => $options.onSupermarketChannelDirectionChange && $options.onSupermarketChannelDirectionChange(...args))
              },
              [
                (vue.openBlock(true), vue.createElementBlock(
                  vue.Fragment,
                  null,
                  vue.renderList($data.supermarketChannelOptions, (item) => {
                    return vue.openBlock(), vue.createElementBlock("label", {
                      key: item.value,
                      class: "delivery-option"
                    }, [
                      vue.createElementVNode("radio", {
                        value: item.value,
                        checked: $data.supermarket_channel_direction === item.value,
                        color: "#FF6B35"
                      }, null, 8, ["value", "checked"]),
                      vue.createElementVNode(
                        "text",
                        { class: "delivery-text" },
                        vue.toDisplayString(item.label),
                        1
                        /* TEXT */
                      )
                    ]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ],
              32
              /* NEED_HYDRATION */
            )
          ])
        ])) : vue.createCommentVNode("v-if", true),
        $data.isRegister && $data.category === "超市" ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 7,
          class: "input-group delivery-row"
        }, [
          vue.createElementVNode("text", { class: "input-icon" }, "🚚"),
          vue.createElementVNode("view", { class: "picker-block" }, [
            vue.createElementVNode("text", { class: "picker-label" }, "配送方式（超市必填）"),
            vue.createElementVNode(
              "radio-group",
              {
                class: "delivery-group",
                onChange: _cache[11] || (_cache[11] = (...args) => $options.onSupermarketDeliveryPermissionChange && $options.onSupermarketDeliveryPermissionChange(...args))
              },
              [
                (vue.openBlock(true), vue.createElementBlock(
                  vue.Fragment,
                  null,
                  vue.renderList($data.supermarketDeliveryOptions, (item) => {
                    return vue.openBlock(), vue.createElementBlock("label", {
                      key: item.value,
                      class: "delivery-option"
                    }, [
                      vue.createElementVNode("radio", {
                        value: item.value,
                        checked: $data.supermarket_delivery_permission === item.value,
                        color: "#FF6B35"
                      }, null, 8, ["value", "checked"]),
                      vue.createElementVNode(
                        "text",
                        { class: "delivery-text" },
                        vue.toDisplayString(item.label),
                        1
                        /* TEXT */
                      )
                    ]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ],
              32
              /* NEED_HYDRATION */
            )
          ])
        ])) : vue.createCommentVNode("v-if", true),
        $data.isRegister && $data.business_scope === "town_food" ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 8,
          class: "input-group picker-row"
        }, [
          vue.createElementVNode("text", { class: "input-icon" }, "🏘️"),
          vue.createElementVNode("view", { class: "picker-block" }, [
            vue.createElementVNode("text", { class: "picker-label" }, "所属乡镇（乡镇商家必选）"),
            vue.createElementVNode("picker", {
              mode: "selector",
              range: $data.townOptions,
              "range-key": "label",
              value: $data.townPickerIndex,
              onChange: _cache[12] || (_cache[12] = (...args) => $options.onTownChange && $options.onTownChange(...args))
            }, [
              vue.createElementVNode(
                "view",
                { class: "picker-value" },
                vue.toDisplayString($options.currentTownLabel),
                1
                /* TEXT */
              )
            ], 40, ["range", "value"])
          ])
        ])) : vue.createCommentVNode("v-if", true),
        $data.isRegister ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 9,
          class: "input-group license-row"
        }, [
          vue.createElementVNode("text", { class: "input-icon" }, "📄"),
          vue.createElementVNode("view", { class: "picker-block" }, [
            vue.createElementVNode("text", { class: "picker-label" }, "营业执照（必填）"),
            vue.createElementVNode("button", {
              class: "upload-btn",
              type: "default",
              disabled: $data.uploadingLicense,
              loading: $data.uploadingLicense,
              onClick: _cache[13] || (_cache[13] = (...args) => $options.chooseAndUploadLicense && $options.chooseAndUploadLicense(...args))
            }, vue.toDisplayString($data.business_license ? "重新上传营业执照" : "上传营业执照"), 9, ["disabled", "loading"]),
            $options.businessLicensePreviewUrl ? (vue.openBlock(), vue.createElementBlock("image", {
              key: 0,
              class: "license-preview",
              src: $options.businessLicensePreviewUrl,
              mode: "widthFix",
              onClick: _cache[14] || (_cache[14] = (...args) => $options.previewBusinessLicense && $options.previewBusinessLicense(...args))
            }, null, 8, ["src"])) : vue.createCommentVNode("v-if", true)
          ])
        ])) : vue.createCommentVNode("v-if", true),
        vue.createElementVNode("button", {
          class: "submit-btn",
          onClick: _cache[15] || (_cache[15] = (...args) => $options.handleSubmit && $options.handleSubmit(...args)),
          loading: $data.loading
        }, vue.toDisplayString($data.isRegister ? "注册成为商家" : "登 录"), 9, ["loading"])
      ])
    ]);
  }
  const PagesLoginIndex = /* @__PURE__ */ _export_sfc(_sfc_main$e, [["render", _sfc_render$d], ["__scopeId", "data-v-d08ef7d4"], ["__file", "E:/固始县外卖商家端/pages/login/index.vue"]]);
  const _sfc_main$d = {
    data() {
      return {
        keyword: "",
        list: [],
        categories: [],
        selectedCategoryId: "all",
        categoryDialogVisible: false,
        categorySubmitting: false,
        newCategoryName: ""
      };
    },
    computed: {
      filteredList() {
        const kw = (this.keyword || "").trim().toLowerCase();
        return this.list.filter((item) => {
          const byCategory = this.selectedCategoryId === "all" || String(item.category_id) === String(this.selectedCategoryId);
          const byKeyword = !kw || String(item.name || "").toLowerCase().includes(kw);
          return byCategory && byKeyword;
        });
      }
    },
    onLoad() {
      this.loadData();
      uni.$on("refreshProductList", this.onRefreshProductList);
    },
    onUnload() {
      uni.$off("refreshProductList", this.onRefreshProductList);
    },
    onShow() {
      this.loadData();
    },
    async onPullDownRefresh() {
      try {
        await this.loadData();
      } finally {
        uni.stopPullDownRefresh();
      }
    },
    methods: {
      onRefreshProductList() {
        this.loadData();
      },
      async loadData() {
        await Promise.all([this.loadCategories(), this.loadProducts()]);
      },
      formatImageUrl(url2) {
        if (!url2)
          return "";
        if (url2.startsWith("http://") || url2.startsWith("https://") || url2.startsWith("data:image") || url2.startsWith("blob:")) {
          return url2;
        }
        return url2.startsWith("/") ? BASE_URL + url2 : BASE_URL + "/" + url2;
      },
      normalizeCategories(res) {
        const arr = res && res.data && Array.isArray(res.data.data) && res.data.data || res && Array.isArray(res.data) && res.data || res && Array.isArray(res) && res || [];
        return arr.map((c2) => ({
          id: c2.id,
          name: c2.name != null ? String(c2.name) : ""
        })).filter((c2) => c2.id != null);
      },
      normalizeProducts(res) {
        const raw = res && typeof res === "object" && res.data !== void 0 ? res.data : res;
        const arr = Array.isArray(raw) ? raw : raw && Array.isArray(raw.list) ? raw.list : [];
        return arr.map((p2) => ({
          id: p2.id,
          name: p2.name != null ? String(p2.name) : "",
          price: p2.price,
          original_price: p2.original_price,
          stock: p2.stock != null ? p2.stock : p2.inventory != null ? p2.inventory : 0,
          status: p2.status === 0 || p2.status === 1 ? p2.status : 0,
          description: p2.description != null ? String(p2.description) : "",
          category_id: p2.category_id,
          image: p2.image || p2.cover || p2.cover_url || ""
        }));
      },
      async loadCategories() {
        try {
          const res = await getMerchantCategoryList();
          this.categories = this.normalizeCategories(res);
          const exists = this.selectedCategoryId === "all" || this.categories.some((c2) => String(c2.id) === String(this.selectedCategoryId));
          if (!exists)
            this.selectedCategoryId = "all";
        } catch (e2) {
          this.categories = [];
          this.selectedCategoryId = "all";
        }
      },
      async loadProducts() {
        try {
          const res = await getMyProducts({});
          this.list = this.normalizeProducts(res);
        } catch (e2) {
          this.list = [];
        }
      },
      formatPrice(v2) {
        const n2 = Number(v2);
        return Number.isFinite(n2) ? n2.toFixed(2) : "--";
      },
      openCategoryDialog() {
        this.newCategoryName = "";
        this.categoryDialogVisible = true;
      },
      closeCategoryDialog() {
        this.categoryDialogVisible = false;
        this.newCategoryName = "";
      },
      async submitCategory() {
        const name = (this.newCategoryName || "").trim();
        if (!name) {
          uni.showToast({ title: "请输入分类名称", icon: "none" });
          return;
        }
        this.categorySubmitting = true;
        try {
          await createCategory({ name, sort: 1 });
          uni.showToast({ title: "创建成功", icon: "success" });
          this.closeCategoryDialog();
          await this.loadCategories();
        } catch (e2) {
          uni.showToast({ title: e2 && e2.message || "创建失败", icon: "none" });
        } finally {
          this.categorySubmitting = false;
        }
      },
      goAddProduct() {
        uni.navigateTo({ url: "/pages/shop/product-publish" });
      },
      goEdit(item) {
        uni.navigateTo({ url: `/pages/shop/food-edit?id=${item.id}` });
      },
      async toggleStatus(item) {
        const newStatus = item.status === 1 ? 0 : 1;
        try {
          await updateProduct(item.id, { status: newStatus });
          uni.showToast({ title: newStatus === 1 ? "已上架" : "已下架" });
          await this.loadProducts();
        } catch (e2) {
        }
      },
      deleteProduct(item) {
        uni.showModal({
          title: "确认删除",
          content: `确定删除「${item.name}」吗？`,
          success: async (res) => {
            if (!res.confirm)
              return;
            try {
              await deleteProduct(item.id);
              uni.showToast({ title: "已删除", icon: "success" });
              await this.loadProducts();
            } catch (e2) {
            }
          }
        });
      }
    }
  };
  function _sfc_render$c(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "card toolbar" }, [
        vue.withDirectives(vue.createElementVNode(
          "input",
          {
            "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $data.keyword = $event),
            class: "search-input",
            placeholder: "搜索商品名称"
          },
          null,
          512
          /* NEED_PATCH */
        ), [
          [vue.vModelText, $data.keyword]
        ]),
        vue.createElementVNode("button", {
          class: "btn-light",
          type: "default",
          onClick: _cache[1] || (_cache[1] = (...args) => $options.openCategoryDialog && $options.openCategoryDialog(...args))
        }, "新增分类"),
        vue.createElementVNode("button", {
          class: "btn-primary",
          type: "default",
          onClick: _cache[2] || (_cache[2] = (...args) => $options.goAddProduct && $options.goAddProduct(...args))
        }, "添加商品")
      ]),
      vue.createElementVNode("view", { class: "card category-card" }, [
        vue.createElementVNode("scroll-view", {
          "scroll-x": "",
          class: "category-scroll",
          "show-scrollbar": false
        }, [
          vue.createElementVNode(
            "view",
            {
              class: vue.normalizeClass(["category-item", { active: $data.selectedCategoryId === "all" }]),
              onClick: _cache[3] || (_cache[3] = ($event) => $data.selectedCategoryId = "all")
            },
            " 全部 ",
            2
            /* CLASS */
          ),
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($data.categories, (c2) => {
              return vue.openBlock(), vue.createElementBlock("view", {
                key: c2.id,
                class: vue.normalizeClass(["category-item", { active: String($data.selectedCategoryId) === String(c2.id) }]),
                onClick: ($event) => $data.selectedCategoryId = c2.id
              }, vue.toDisplayString(c2.name), 11, ["onClick"]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])
      ]),
      $options.filteredList.length ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "product-list"
      }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($options.filteredList, (item) => {
            return vue.openBlock(), vue.createElementBlock("view", {
              key: item.id,
              class: "card product-item"
            }, [
              vue.createElementVNode("view", { class: "product-img-wrap" }, [
                item.image ? (vue.openBlock(), vue.createElementBlock("image", {
                  key: 0,
                  class: "product-img",
                  src: $options.formatImageUrl(item.image),
                  mode: "aspectFill"
                }, null, 8, ["src"])) : (vue.openBlock(), vue.createElementBlock("text", {
                  key: 1,
                  class: "product-img-ph"
                }, "无图"))
              ]),
              vue.createElementVNode("view", { class: "product-info" }, [
                vue.createElementVNode(
                  "text",
                  { class: "name" },
                  vue.toDisplayString(item.name),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode(
                  "text",
                  { class: "desc" },
                  vue.toDisplayString(item.description || "暂无描述"),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode("view", { class: "price-row" }, [
                  vue.createElementVNode(
                    "text",
                    { class: "price" },
                    "¥" + vue.toDisplayString($options.formatPrice(item.price)),
                    1
                    /* TEXT */
                  ),
                  item.original_price ? (vue.openBlock(), vue.createElementBlock(
                    "text",
                    {
                      key: 0,
                      class: "original-price"
                    },
                    "¥" + vue.toDisplayString($options.formatPrice(item.original_price)),
                    1
                    /* TEXT */
                  )) : vue.createCommentVNode("v-if", true)
                ]),
                vue.createElementVNode("view", { class: "status-row" }, [
                  vue.createElementVNode(
                    "text",
                    { class: "stock" },
                    "库存: " + vue.toDisplayString(item.stock),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    {
                      class: vue.normalizeClass(["status-tag", item.status === 1 ? "on" : "off"])
                    },
                    vue.toDisplayString(item.status === 1 ? "上架中" : "已下架"),
                    3
                    /* TEXT, CLASS */
                  )
                ]),
                vue.createElementVNode("view", { class: "actions" }, [
                  vue.createElementVNode("text", {
                    class: "link",
                    onClick: ($event) => $options.toggleStatus(item)
                  }, vue.toDisplayString(item.status === 1 ? "下架" : "上架"), 9, ["onClick"]),
                  vue.createElementVNode("text", {
                    class: "link",
                    onClick: ($event) => $options.goEdit(item)
                  }, "编辑", 8, ["onClick"]),
                  vue.createElementVNode("text", {
                    class: "link danger",
                    onClick: ($event) => $options.deleteProduct(item)
                  }, "删除", 8, ["onClick"])
                ])
              ])
            ]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ])) : (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "empty"
      }, [
        vue.createElementVNode("text", { class: "empty-title" }, "暂无商品"),
        vue.createElementVNode("text", { class: "empty-hint" }, "请点击上方「添加商品」发布")
      ])),
      $data.categoryDialogVisible ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 2,
        class: "mask",
        onClick: _cache[8] || (_cache[8] = vue.withModifiers((...args) => $options.closeCategoryDialog && $options.closeCategoryDialog(...args), ["self"]))
      }, [
        vue.createElementVNode("view", {
          class: "dialog",
          onClick: _cache[7] || (_cache[7] = vue.withModifiers(() => {
          }, ["stop"]))
        }, [
          vue.createElementVNode("text", { class: "dialog-title" }, "新增分类"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => $data.newCategoryName = $event),
              class: "dialog-input",
              placeholder: "请输入分类名称",
              "placeholder-class": "ph"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.newCategoryName]
          ]),
          vue.createElementVNode("view", { class: "dialog-actions" }, [
            vue.createElementVNode("button", {
              class: "dialog-btn ghost",
              type: "default",
              onClick: _cache[5] || (_cache[5] = (...args) => $options.closeCategoryDialog && $options.closeCategoryDialog(...args))
            }, "取消"),
            vue.createElementVNode("button", {
              class: "dialog-btn primary",
              type: "default",
              loading: $data.categorySubmitting,
              onClick: _cache[6] || (_cache[6] = (...args) => $options.submitCategory && $options.submitCategory(...args))
            }, "确定", 8, ["loading"])
          ])
        ])
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesProductList = /* @__PURE__ */ _export_sfc(_sfc_main$d, [["render", _sfc_render$c], ["__scopeId", "data-v-e958a167"], ["__file", "E:/固始县外卖商家端/pages/product/list.vue"]]);
  const _sfc_main$c = {
    data() {
      return {
        balance: "0.00",
        todayIncome: "0.00",
        weekIncome: "0.00",
        monthIncome: "0.00",
        withdrawList: []
      };
    },
    onLoad() {
      this.loadData();
    },
    methods: {
      async loadData() {
        var _a;
        try {
          const [statsRes, withdrawRes] = await Promise.all([
            getFinanceStats(),
            getWithdrawList({ page: 1, size: 10 })
          ]);
          const s2 = (statsRes == null ? void 0 : statsRes.data) || {};
          this.balance = formatMoney(s2.balance);
          this.todayIncome = formatMoney(s2.todayIncome);
          this.weekIncome = formatMoney(s2.weekIncome);
          this.monthIncome = formatMoney(s2.monthIncome);
          const list = ((_a = withdrawRes == null ? void 0 : withdrawRes.data) == null ? void 0 : _a.list) || [];
          this.withdrawList = list.map((item, index) => ({
            id: item.id || index,
            amount: formatMoney(item.amount),
            createTime: item.created_at || item.create_time || "",
            status: item.status || "pending",
            statusText: item.statusText || (item.status === "done" ? "已到账" : "审核中")
          }));
        } catch (e2) {
          this.balance = "256.80";
          this.todayIncome = "128.50";
          this.weekIncome = "856.30";
          this.monthIncome = "3256.00";
          this.withdrawList = [
            { id: 1, amount: "200.00", createTime: "2024-03-08 14:30", status: "done", statusText: "已到账" },
            { id: 2, amount: "150.00", createTime: "2024-03-05 10:00", status: "pending", statusText: "审核中" }
          ];
        }
      },
      // 申请提现：调用后端 /merchant/finance/withdraw
      applyWithdraw() {
        const maxAmount = parseFloat(this.balance || 0);
        if (!maxAmount || maxAmount <= 0) {
          uni.showToast({ title: "暂无可提现余额", icon: "none" });
          return;
        }
        uni.showModal({
          title: "申请提现",
          editable: true,
          placeholderText: `本次最多可提 ${this.balance} 元`,
          content: "",
          success: async (res) => {
            if (!res.confirm)
              return;
            const value2 = (res.content || "").trim();
            const amount = parseFloat(value2);
            if (!amount || amount <= 0) {
              uni.showToast({ title: "请输入正确的金额", icon: "none" });
              return;
            }
            if (amount > maxAmount) {
              uni.showToast({ title: "金额不能大于可提现余额", icon: "none" });
              return;
            }
            try {
              await applyWithdraw({ amount });
              uni.showToast({ title: "提现申请已提交", icon: "success" });
              this.loadData();
            } catch (e2) {
            }
          }
        });
      }
    }
  };
  function _sfc_render$b(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "card balance-card" }, [
        vue.createElementVNode("text", { class: "label" }, "可提现余额(元)"),
        vue.createElementVNode(
          "text",
          { class: "amount" },
          vue.toDisplayString($data.balance),
          1
          /* TEXT */
        ),
        vue.createElementVNode("button", {
          class: "btn-primary",
          onClick: _cache[0] || (_cache[0] = (...args) => $options.applyWithdraw && $options.applyWithdraw(...args))
        }, "申请提现")
      ]),
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("view", { class: "section-title" }, "近期统计"),
        vue.createElementVNode("view", { class: "stats-row" }, [
          vue.createElementVNode("view", { class: "stats-item" }, [
            vue.createElementVNode(
              "text",
              { class: "num" },
              vue.toDisplayString($data.todayIncome),
              1
              /* TEXT */
            ),
            vue.createElementVNode("text", { class: "label" }, "今日营收")
          ]),
          vue.createElementVNode("view", { class: "stats-item" }, [
            vue.createElementVNode(
              "text",
              { class: "num" },
              vue.toDisplayString($data.weekIncome),
              1
              /* TEXT */
            ),
            vue.createElementVNode("text", { class: "label" }, "本周营收")
          ]),
          vue.createElementVNode("view", { class: "stats-item" }, [
            vue.createElementVNode(
              "text",
              { class: "num" },
              vue.toDisplayString($data.monthIncome),
              1
              /* TEXT */
            ),
            vue.createElementVNode("text", { class: "label" }, "本月营收")
          ])
        ])
      ]),
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("view", { class: "section-title" }, "提现记录"),
        $data.withdrawList.length ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "record-list"
        }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($data.withdrawList, (item) => {
              return vue.openBlock(), vue.createElementBlock("view", {
                key: item.id,
                class: "record-item flex-between"
              }, [
                vue.createElementVNode("view", null, [
                  vue.createElementVNode(
                    "text",
                    { class: "amount" },
                    "¥" + vue.toDisplayString(item.amount),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    { class: "time text-gray" },
                    vue.toDisplayString(item.createTime),
                    1
                    /* TEXT */
                  )
                ]),
                vue.createElementVNode(
                  "text",
                  {
                    class: vue.normalizeClass(["status", item.status])
                  },
                  vue.toDisplayString(item.statusText),
                  3
                  /* TEXT, CLASS */
                )
              ]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])) : (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "empty text-gray"
        }, "暂无提现记录"))
      ])
    ]);
  }
  const PagesFinanceIndex = /* @__PURE__ */ _export_sfc(_sfc_main$c, [["render", _sfc_render$b], ["__scopeId", "data-v-b0c916dd"], ["__file", "E:/固始县外卖商家端/pages/finance/index.vue"]]);
  const _sfc_main$b = {
    data() {
      return {
        totalOrders: 0,
        completeOrders: 0,
        totalIncome: "0.00",
        weekData: [],
        hotProducts: []
      };
    },
    onLoad() {
      this.loadData();
    },
    methods: {
      async loadData() {
        try {
          const [statsRes, hotRes] = await Promise.all([
            getStatsData(),
            getHotProducts()
          ]);
          const stats = (statsRes == null ? void 0 : statsRes.data) || [];
          let totalOrders = 0;
          let completeOrders = 0;
          let totalIncome = 0;
          const weekData = stats.map((item) => {
            const orders = item.orders || 0;
            const revenue = parseFloat(item.revenue || 0);
            totalOrders += orders;
            completeOrders += orders;
            totalIncome += revenue;
            return {
              day: item.day || item.date || "",
              count: orders,
              revenue: formatMoney(revenue),
              raw: item
            };
          });
          const maxCount = Math.max(...weekData.map((i2) => i2.count), 1);
          this.weekData = weekData.map((i2) => ({
            ...i2,
            height: Math.max(8, Math.round(i2.count / maxCount * 100))
          }));
          this.totalOrders = totalOrders;
          this.completeOrders = completeOrders;
          this.totalIncome = formatMoney(totalIncome);
          const hotList = (hotRes == null ? void 0 : hotRes.data) || [];
          this.hotProducts = (hotList || []).slice(0, 5).map((p2) => ({
            id: p2.id,
            name: p2.name || p2.title || "未知商品",
            count: p2.sales || p2.count || 0
          }));
        } catch (e2) {
          this.totalOrders = 156;
          this.completeOrders = 142;
          this.totalIncome = "3256.80";
          this.weekData = [
            { day: "周一", count: 18, height: 72 },
            { day: "周二", count: 22, height: 88 },
            { day: "周三", count: 25, height: 100 },
            { day: "周四", count: 20, height: 80 },
            { day: "周五", count: 28, height: 95 },
            { day: "周六", count: 30, height: 100 },
            { day: "周日", count: 15, height: 60 }
          ];
          this.hotProducts = [
            { name: "黄焖鸡米饭", count: 89 },
            { name: "酸辣土豆丝", count: 56 },
            { name: "鱼香肉丝", count: 42 },
            { name: "宫保鸡丁", count: 38 },
            { name: "番茄炒蛋", count: 35 }
          ];
        }
      }
    }
  };
  function _sfc_render$a(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("view", { class: "section-title" }, "订单统计"),
        vue.createElementVNode("view", { class: "stats-grid" }, [
          vue.createElementVNode("view", { class: "stats-item" }, [
            vue.createElementVNode(
              "text",
              { class: "num" },
              vue.toDisplayString($data.totalOrders),
              1
              /* TEXT */
            ),
            vue.createElementVNode("text", { class: "label" }, "总订单数")
          ]),
          vue.createElementVNode("view", { class: "stats-item" }, [
            vue.createElementVNode(
              "text",
              { class: "num" },
              vue.toDisplayString($data.completeOrders),
              1
              /* TEXT */
            ),
            vue.createElementVNode("text", { class: "label" }, "已完成")
          ]),
          vue.createElementVNode("view", { class: "stats-item" }, [
            vue.createElementVNode(
              "text",
              { class: "num primary-color" },
              vue.toDisplayString($data.totalIncome),
              1
              /* TEXT */
            ),
            vue.createElementVNode("text", { class: "label" }, "总营收(元)")
          ])
        ])
      ]),
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("view", { class: "section-title" }, "近7日订单趋势"),
        vue.createElementVNode("view", { class: "chart-placeholder" }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($data.weekData, (item, i2) => {
              return vue.openBlock(), vue.createElementBlock("view", {
                key: i2,
                class: "chart-bar-wrap"
              }, [
                vue.createElementVNode(
                  "view",
                  {
                    class: "chart-bar",
                    style: vue.normalizeStyle({ height: item.height + "%" })
                  },
                  null,
                  4
                  /* STYLE */
                ),
                vue.createElementVNode(
                  "text",
                  { class: "chart-label" },
                  vue.toDisplayString(item.day),
                  1
                  /* TEXT */
                )
              ]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])
      ]),
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("view", { class: "section-title" }, "热销商品 Top5"),
        $data.hotProducts.length ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "product-rank"
        }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($data.hotProducts, (item, i2) => {
              return vue.openBlock(), vue.createElementBlock("view", {
                key: i2,
                class: "rank-item flex-between"
              }, [
                vue.createElementVNode(
                  "text",
                  { class: "rank" },
                  vue.toDisplayString(i2 + 1),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode(
                  "text",
                  { class: "name" },
                  vue.toDisplayString(item.name),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode(
                  "text",
                  { class: "count" },
                  "售出 " + vue.toDisplayString(item.count) + " 份",
                  1
                  /* TEXT */
                )
              ]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])) : (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "empty text-gray"
        }, "暂无数据"))
      ])
    ]);
  }
  const PagesStatsIndex = /* @__PURE__ */ _export_sfc(_sfc_main$b, [["render", _sfc_render$a], ["__scopeId", "data-v-1fa681a1"], ["__file", "E:/固始县外卖商家端/pages/stats/index.vue"]]);
  const _sfc_main$a = {
    data() {
      return {
        list: [],
        replyVisible: false,
        replyContent: "",
        currentReview: null
      };
    },
    onLoad() {
      this.loadList();
    },
    methods: {
      async loadList() {
        var _a;
        try {
          const res = await getReviewList({ page: 1, size: 20 });
          this.list = ((_a = res == null ? void 0 : res.data) == null ? void 0 : _a.list) || [];
        } catch (e2) {
          this.list = [
            { id: 1, userName: "李**", rating: 5, content: "味道很好，送餐也快！", createTime: "2024-03-09 12:30", reply: "" },
            { id: 2, userName: "王**", rating: 4, content: "不错，下次还点", createTime: "2024-03-08 18:20", reply: "感谢您的支持！" }
          ];
        }
      },
      showReply(item) {
        this.currentReview = item;
        this.replyContent = "";
        this.replyVisible = true;
      },
      async submitReply() {
        if (!this.replyContent.trim()) {
          uni.showToast({ title: "请输入回复内容", icon: "none" });
          return;
        }
        try {
          await replyReview(this.currentReview.id, { content: this.replyContent });
          uni.showToast({ title: "回复成功" });
          this.replyVisible = false;
          this.loadList();
        } catch (e2) {
        }
      }
    }
  };
  function _sfc_render$9(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      $data.list.length ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "review-list"
      }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($data.list, (item) => {
            return vue.openBlock(), vue.createElementBlock("view", {
              key: item.id,
              class: "card review-item"
            }, [
              vue.createElementVNode("view", { class: "review-header flex-between" }, [
                vue.createElementVNode("view", { class: "user-info" }, [
                  vue.createElementVNode(
                    "text",
                    { class: "avatar" },
                    vue.toDisplayString((item.userName || "用户").charAt(0)),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode("view", null, [
                    vue.createElementVNode(
                      "text",
                      { class: "user-name" },
                      vue.toDisplayString(item.userName || "匿名用户"),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode("view", { class: "star-wrap" }, [
                      (vue.openBlock(), vue.createElementBlock(
                        vue.Fragment,
                        null,
                        vue.renderList(5, (n2) => {
                          return vue.createElementVNode(
                            "text",
                            {
                              key: n2,
                              class: vue.normalizeClass(["star", { active: n2 <= item.rating }])
                            },
                            "★",
                            2
                            /* CLASS */
                          );
                        }),
                        64
                        /* STABLE_FRAGMENT */
                      ))
                    ])
                  ])
                ]),
                vue.createElementVNode(
                  "text",
                  { class: "time text-gray" },
                  vue.toDisplayString(item.createTime),
                  1
                  /* TEXT */
                )
              ]),
              vue.createElementVNode(
                "view",
                { class: "review-content" },
                vue.toDisplayString(item.content),
                1
                /* TEXT */
              ),
              item.reply ? (vue.openBlock(), vue.createElementBlock("view", {
                key: 0,
                class: "reply-box"
              }, [
                vue.createElementVNode("text", { class: "reply-label" }, "商家回复："),
                vue.createElementVNode(
                  "text",
                  null,
                  vue.toDisplayString(item.reply),
                  1
                  /* TEXT */
                )
              ])) : (vue.openBlock(), vue.createElementBlock("view", {
                key: 1,
                class: "reply-btn"
              }, [
                vue.createElementVNode("button", {
                  class: "btn-small",
                  onClick: ($event) => $options.showReply(item)
                }, "回复", 8, ["onClick"])
              ]))
            ]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ])) : (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "empty"
      }, [
        vue.createElementVNode("text", null, "暂无评价")
      ])),
      $data.replyVisible ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 2,
        class: "reply-mask",
        onClick: _cache[4] || (_cache[4] = ($event) => $data.replyVisible = false)
      }, [
        vue.createElementVNode("view", {
          class: "reply-dialog",
          onClick: _cache[3] || (_cache[3] = vue.withModifiers(() => {
          }, ["stop"]))
        }, [
          vue.createElementVNode("text", { class: "dialog-title" }, "回复评价"),
          vue.withDirectives(vue.createElementVNode(
            "textarea",
            {
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $data.replyContent = $event),
              placeholder: "请输入回复内容",
              class: "reply-input"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.replyContent]
          ]),
          vue.createElementVNode("view", { class: "dialog-actions" }, [
            vue.createElementVNode("button", {
              onClick: _cache[1] || (_cache[1] = ($event) => $data.replyVisible = false)
            }, "取消"),
            vue.createElementVNode("button", {
              class: "btn-primary",
              onClick: _cache[2] || (_cache[2] = (...args) => $options.submitReply && $options.submitReply(...args))
            }, "提交")
          ])
        ])
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesReviewList = /* @__PURE__ */ _export_sfc(_sfc_main$a, [["render", _sfc_render$9], ["__scopeId", "data-v-eeac79e8"], ["__file", "E:/固始县外卖商家端/pages/review/list.vue"]]);
  const logShopMapStep = (step, payload) => {
    try {
      formatAppLog("log", "at pages/shop/index.vue:137", "[shop-setting-map][" + step + "]", payload || "");
    } catch (e2) {
    }
  };
  const logShopSaveStep = (step, payload) => {
    try {
      formatAppLog("log", "at pages/shop/index.vue:143", "[shop-setting-save][" + step + "]", payload || "");
    } catch (e2) {
    }
  };
  const normalizeCoordinateValue$2 = (value2) => {
    if (value2 == null)
      return null;
    const raw = typeof value2 === "string" ? value2.trim() : value2;
    if (raw === "")
      return null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  };
  const getValidCoordinatePair$2 = (latitude, longitude) => {
    const lat = normalizeCoordinateValue$2(latitude);
    const lng = normalizeCoordinateValue$2(longitude);
    if (lat == null || lng == null)
      return null;
    if (lat === 0 && lng === 0)
      return null;
    return {
      latitude: lat,
      longitude: lng
    };
  };
  const DEFAULT_FORM = () => ({
    name: "",
    phone: "",
    category: "",
    description: "",
    logo: "",
    cover: "",
    address: "",
    business_license: "",
    latitude: null,
    longitude: null,
    status: 1,
    delivery_radius: 3
  });
  const _sfc_main$9 = {
    data() {
      return {
        isCreateMode: false,
        submitting: false,
        logoPreviewLocal: "",
        coverPreviewLocal: "",
        logoUploading: false,
        coverUploading: false,
        categoryOptions: [],
        categoryLoading: false,
        categoryLoadFailed: false,
        form: DEFAULT_FORM()
      };
    },
    computed: {
      logoDisplay() {
        return this.logoPreviewLocal || this.resolveImageUrl(this.form.logo);
      },
      coverDisplay() {
        return this.coverPreviewLocal || this.resolveImageUrl(this.form.cover);
      },
      hasCoords() {
        return !!getValidCoordinatePair$2(this.form.latitude, this.form.longitude);
      },
      currentCategoryIndex() {
        return this.categoryOptions.indexOf(this.form.category);
      }
    },
    onLoad() {
      this.loadCategoryOptions();
      this.loadShopData("page-onload");
    },
    methods: {
      normalizeCategoryOptions(res) {
        const raw = res && typeof res === "object" && res.data !== void 0 ? res.data : res;
        const arr = Array.isArray(raw) ? raw : raw && Array.isArray(raw.data) ? raw.data : [];
        return arr.map((item) => String(item || "").trim()).filter(Boolean);
      },
      formatCoord(v2) {
        if (v2 == null || v2 === "")
          return "-";
        const n2 = Number(v2);
        return Number.isFinite(n2) ? n2.toFixed(6) : String(v2);
      },
      resolveImageUrl(url2) {
        const value2 = url2 != null ? String(url2).trim() : "";
        if (!value2)
          return "";
        if (/^(https?:)?\/\//i.test(value2) || /^data:image/i.test(value2) || /^blob:/i.test(value2)) {
          return value2;
        }
        return value2.startsWith("/") ? BASE_URL + value2 : BASE_URL + "/" + value2;
      },
      async loadCategoryOptions() {
        this.categoryLoading = true;
        this.categoryLoadFailed = false;
        try {
          const res = await getMerchantPrimaryCategories();
          this.categoryOptions = this.normalizeCategoryOptions(res);
        } catch (e2) {
          this.categoryOptions = [];
          this.categoryLoadFailed = true;
        } finally {
          this.categoryLoading = false;
        }
      },
      normalizeMerchant(raw) {
        if (!raw || typeof raw !== "object")
          return null;
        const m2 = raw.merchant && typeof raw.merchant === "object" ? raw.merchant : raw;
        const coordinatePair = getValidCoordinatePair$2(
          m2.latitude != null ? m2.latitude : m2.delivery_latitude != null ? m2.delivery_latitude : m2.lat,
          m2.longitude != null ? m2.longitude : m2.delivery_longitude != null ? m2.delivery_longitude : m2.lng
        );
        return {
          name: m2.name != null ? String(m2.name) : "",
          phone: m2.phone != null ? String(m2.phone) : "",
          category: m2.category != null ? String(m2.category) : "",
          description: m2.description != null ? String(m2.description) : "",
          logo: m2.logo != null ? String(m2.logo) : "",
          cover: m2.cover != null ? String(m2.cover) : "",
          address: m2.address != null ? String(m2.address) : "",
          business_license: m2.business_license != null ? String(m2.business_license) : "",
          latitude: coordinatePair ? coordinatePair.latitude : null,
          longitude: coordinatePair ? coordinatePair.longitude : null,
          status: m2.status === 0 ? 0 : 1,
          delivery_radius: m2.delivery_radius != null && m2.delivery_radius !== "" ? Number(m2.delivery_radius) : 3
        };
      },
      async loadShopData(source = "default") {
        try {
          const res = await getShopInfo();
          logShopSaveStep("loadShopData-response", {
            source,
            url: BASE_URL + "/api/merchant/my",
            response: res
          });
          const raw = res && typeof res === "object" && "data" in res ? res.data : res;
          const merchant = this.normalizeMerchant(raw);
          logShopSaveStep("loadShopData-normalized", {
            source,
            raw,
            merchant
          });
          const id = raw && raw.id != null ? raw.id : merchant && raw && raw.merchant && raw.merchant.id;
          const hasShop = !!(merchant && (merchant.name || id != null));
          if (hasShop) {
            this.isCreateMode = false;
            this.form = { ...DEFAULT_FORM(), ...merchant };
            this.logoPreviewLocal = "";
            this.coverPreviewLocal = "";
            logShopSaveStep("loadShopData-form-applied", {
              source,
              form: this.form
            });
          } else {
            this.isCreateMode = true;
            this.form = DEFAULT_FORM();
            this.logoPreviewLocal = "";
            this.coverPreviewLocal = "";
            logShopSaveStep("loadShopData-empty", { source });
          }
        } catch (e2) {
          logShopSaveStep("loadShopData-error", {
            source,
            url: BASE_URL + "/api/merchant/my",
            error: e2,
            message: e2 && (e2.detail || e2.message || e2.msg),
            statusCode: e2 && e2.statusCode,
            data: e2 && e2.data
          });
          formatAppLog("log", "at pages/shop/index.vue:310", "未获取到店铺或接口异常，进入创建模式", e2);
          this.isCreateMode = true;
          this.form = DEFAULT_FORM();
          this.logoPreviewLocal = "";
          this.coverPreviewLocal = "";
        }
      },
      onStatusChange(e2) {
        this.form.status = e2.detail.value ? 1 : 0;
      },
      onCategoryChange(e2) {
        if (!this.categoryOptions.length)
          return;
        const index = Number(e2 && e2.detail && e2.detail.value);
        this.form.category = this.categoryOptions[index] || "";
      },
      async chooseAndUploadImage(field) {
        const isLogo = field === "logo";
        const uploadingKey = isLogo ? "logoUploading" : "coverUploading";
        const previewKey = isLogo ? "logoPreviewLocal" : "coverPreviewLocal";
        const fieldLabel = isLogo ? "头像" : "封面";
        if (this[uploadingKey])
          return;
        uni.chooseImage({
          count: 1,
          sizeType: ["compressed"],
          sourceType: ["album", "camera"],
          success: async (res) => {
            const filePath = res.tempFilePaths && res.tempFilePaths[0];
            if (!filePath)
              return;
            this[uploadingKey] = true;
            try {
              const uploadRes = await uploadShopImage(filePath);
              const url2 = uploadRes && uploadRes.data && uploadRes.data.url ? String(uploadRes.data.url) : "";
              if (!url2) {
                throw new Error("上传成功但未返回图片地址");
              }
              this.form[field] = url2;
              this[previewKey] = filePath;
              uni.showToast({ title: fieldLabel + "上传成功", icon: "success" });
            } catch (e2) {
              const msg = e2 && (e2.message || e2.detail || e2.msg) || fieldLabel + "上传失败";
              uni.showToast({ title: msg, icon: "none" });
            } finally {
              this[uploadingKey] = false;
            }
          }
        });
      },
      openTiandituPicker() {
        const lat = this.form.latitude != null ? String(this.form.latitude) : "";
        const lng = this.form.longitude != null ? String(this.form.longitude) : "";
        const address = this.form.address != null ? String(this.form.address) : "";
        logShopMapStep("navigate-to-picker", { lat, lng, address });
        uni.navigateTo({
          url: `/pages/shop/tianditu-picker?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&address=${encodeURIComponent(address)}`,
          events: {
            picked: (data) => {
              logShopMapStep("picked-received", data);
              if (!data)
                return;
              const coordinatePair = getValidCoordinatePair$2(data.latitude, data.longitude);
              if (!coordinatePair) {
                this.form.latitude = null;
                this.form.longitude = null;
                uni.showToast({ title: "地图选点无效，请重新选点", icon: "none" });
                return;
              }
              this.form.latitude = coordinatePair.latitude;
              this.form.longitude = coordinatePair.longitude;
              if (data.address) {
                this.form.address = data.address;
              }
              if (data.town && !this.form.address) {
                this.form.address = data.town;
              }
              logShopMapStep("picked-applied", {
                latitude: this.form.latitude,
                longitude: this.form.longitude,
                address: this.form.address
              });
            }
          }
        });
      },
      buildPayload(includeStatus = true) {
        const logo = (this.form.logo || "").trim();
        const cover = (this.form.cover || "").trim();
        const businessLicense = (this.form.business_license || "").trim();
        const coordinatePair = getValidCoordinatePair$2(this.form.latitude, this.form.longitude);
        const payload = {
          name: (this.form.name || "").trim(),
          phone: (this.form.phone || "").trim(),
          category: (this.form.category || "").trim(),
          description: (this.form.description || "").trim(),
          address: (this.form.address || "").trim(),
          delivery_radius: Number(this.form.delivery_radius) || 0
        };
        if (includeStatus) {
          payload.status = this.form.status;
        }
        if (logo) {
          payload.logo = logo;
        }
        if (cover) {
          payload.cover = cover;
        }
        if (businessLicense) {
          payload.business_license = businessLicense;
        }
        if (coordinatePair) {
          payload.latitude = coordinatePair.latitude;
          payload.longitude = coordinatePair.longitude;
        }
        return payload;
      },
      async submitForm() {
        const p2 = this.buildPayload(this.isCreateMode);
        logShopSaveStep("submitForm-form-model", {
          form: {
            ...this.form,
            latitude: this.form.latitude,
            longitude: this.form.longitude,
            address: this.form.address
          },
          hasCoords: this.hasCoords,
          isCreateMode: this.isCreateMode
        });
        logShopSaveStep("submitForm-payload", p2);
        if (!p2.name) {
          uni.showToast({ title: "请填写店名", icon: "none" });
          return;
        }
        if (!p2.phone) {
          uni.showToast({ title: "请填写联系电话", icon: "none" });
          return;
        }
        if (this.categoryLoading) {
          uni.showToast({ title: "主营类目加载中，请稍后", icon: "none" });
          return;
        }
        if (!this.categoryOptions.length) {
          uni.showToast({ title: "主营类目暂不可用，请稍后重试", icon: "none" });
          return;
        }
        if (!p2.category) {
          uni.showToast({ title: "请选择店铺主营类目", icon: "none" });
          return;
        }
        if (!this.categoryOptions.includes(p2.category)) {
          uni.showToast({ title: "请选择有效的主营类目", icon: "none" });
          return;
        }
        if (!p2.address) {
          uni.showToast({ title: "请填写详细地址", icon: "none" });
          return;
        }
        const coordinatePair = getValidCoordinatePair$2(this.form.latitude, this.form.longitude);
        if (!coordinatePair || p2.latitude == null || p2.longitude == null) {
          uni.showToast({ title: "地图坐标无效，请重新选点", icon: "none" });
          return;
        }
        this.submitting = true;
        try {
          if (this.isCreateMode) {
            logShopSaveStep("submitForm-request", {
              url: BASE_URL + "/api/merchant/create",
              method: "POST",
              payload: p2
            });
            const res = await createShop(p2);
            logShopSaveStep("submitForm-response", {
              url: BASE_URL + "/api/merchant/create",
              response: res
            });
            if (res && (res.code === 200 || res.code === 201 || res.success)) {
              uni.showToast({ title: "创建成功", icon: "success" });
              this.isCreateMode = false;
              await this.loadShopData("after-create-success");
            } else {
              uni.showToast({ title: res && res.message || "创建失败", icon: "none" });
            }
          } else {
            logShopSaveStep("submitForm-request", {
              url: BASE_URL + "/api/merchant/update",
              method: "PUT",
              payload: p2
            });
            const res = await updateShopInfo(p2);
            logShopSaveStep("submitForm-response", {
              url: BASE_URL + "/api/merchant/update",
              response: res
            });
            if (res && (res.code === 200 || res.success)) {
              uni.showToast({ title: "保存成功", icon: "success" });
              await this.loadShopData("after-update-success");
            } else {
              uni.showToast({ title: res && res.message || "保存失败", icon: "none" });
            }
          }
        } catch (e2) {
          logShopSaveStep("submitForm-error", {
            url: BASE_URL + (this.isCreateMode ? "/api/merchant/create" : "/api/merchant/update"),
            error: e2,
            message: e2 && (e2.detail || e2.message || e2.msg),
            statusCode: e2 && e2.statusCode,
            data: e2 && e2.data
          });
          const msg = e2 && (e2.detail || e2.message || e2.msg) || "保存失败";
          uni.showToast({ title: msg, icon: "none" });
        } finally {
          this.submitting = false;
        }
      }
    }
  };
  function _sfc_render$8(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("scroll-view", {
      "scroll-y": "",
      class: "page",
      "show-scrollbar": false
    }, [
      vue.createElementVNode("view", { class: "hero" }, [
        vue.createElementVNode("view", {
          class: "cover",
          onClick: _cache[0] || (_cache[0] = ($event) => $options.chooseAndUploadImage("cover"))
        }, [
          $options.coverDisplay ? (vue.openBlock(), vue.createElementBlock("image", {
            key: 0,
            class: "cover-img",
            src: $options.coverDisplay,
            mode: "aspectFill"
          }, null, 8, ["src"])) : vue.createCommentVNode("v-if", true),
          vue.createElementVNode("view", { class: "cover-mask" }, [
            vue.createElementVNode(
              "text",
              { class: "cover-tip" },
              vue.toDisplayString($data.coverUploading ? "封面上传中..." : "点击更换店铺封面"),
              1
              /* TEXT */
            )
          ])
        ]),
        vue.createElementVNode("view", { class: "hero-main" }, [
          vue.createElementVNode("view", { class: "avatar-block" }, [
            vue.createElementVNode("view", {
              class: "avatar",
              onClick: _cache[1] || (_cache[1] = ($event) => $options.chooseAndUploadImage("logo"))
            }, [
              $options.logoDisplay ? (vue.openBlock(), vue.createElementBlock("image", {
                key: 0,
                class: "avatar-img",
                src: $options.logoDisplay,
                mode: "aspectFill"
              }, null, 8, ["src"])) : (vue.openBlock(), vue.createElementBlock(
                "text",
                {
                  key: 1,
                  class: "avatar-text"
                },
                vue.toDisplayString($data.form.name ? $data.form.name.slice(0, 1) : "店"),
                1
                /* TEXT */
              ))
            ]),
            vue.createElementVNode(
              "text",
              { class: "avatar-action" },
              vue.toDisplayString($data.logoUploading ? "头像上传中..." : "点击更换头像"),
              1
              /* TEXT */
            )
          ]),
          vue.createElementVNode("view", { class: "hero-text" }, [
            vue.createElementVNode(
              "text",
              { class: "hero-title" },
              vue.toDisplayString($data.form.name || "店铺基础设置"),
              1
              /* TEXT */
            ),
            vue.createElementVNode("text", { class: "hero-sub" }, "店铺头像、封面和基础资料在此统一维护")
          ])
        ])
      ]),
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("view", { class: "card-title" }, "基本信息"),
        vue.createElementVNode("view", { class: "cell" }, [
          vue.createElementVNode("text", { class: "label" }, "店名"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "input",
              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => $data.form.name = $event),
              placeholder: "请输入店铺名称",
              "placeholder-class": "ph"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.name]
          ])
        ]),
        vue.createElementVNode("view", { class: "cell" }, [
          vue.createElementVNode("text", { class: "label" }, "联系电话"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "input",
              "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => $data.form.phone = $event),
              type: "number",
              maxlength: "11",
              placeholder: "请输入手机号",
              "placeholder-class": "ph"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.phone]
          ])
        ]),
        vue.createElementVNode("view", { class: "cell" }, [
          vue.createElementVNode("text", { class: "label" }, "主营类目"),
          vue.createElementVNode("picker", {
            range: $data.categoryOptions,
            value: $options.currentCategoryIndex > -1 ? $options.currentCategoryIndex : 0,
            disabled: !$data.categoryOptions.length,
            onChange: _cache[4] || (_cache[4] = (...args) => $options.onCategoryChange && $options.onCategoryChange(...args))
          }, [
            vue.createElementVNode(
              "view",
              { class: "picker-line" },
              vue.toDisplayString($data.form.category || "请选择店铺主营类目"),
              1
              /* TEXT */
            )
          ], 40, ["range", "value", "disabled"]),
          $data.categoryLoading ? (vue.openBlock(), vue.createElementBlock("text", {
            key: 0,
            class: "picker-tip"
          }, "主营类目加载中...")) : $data.categoryLoadFailed ? (vue.openBlock(), vue.createElementBlock("text", {
            key: 1,
            class: "picker-tip error"
          }, "主营类目加载失败，请稍后重试")) : !$data.categoryOptions.length ? (vue.openBlock(), vue.createElementBlock("text", {
            key: 2,
            class: "picker-tip error"
          }, "暂无可选主营类目")) : vue.createCommentVNode("v-if", true)
        ]),
        vue.createElementVNode("view", { class: "cell column" }, [
          vue.createElementVNode("text", { class: "label" }, "店铺描述"),
          vue.withDirectives(vue.createElementVNode(
            "textarea",
            {
              class: "textarea",
              "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => $data.form.description = $event),
              placeholder: "简介、特色等（选填）",
              "placeholder-class": "ph",
              maxlength: "500"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.description]
          ])
        ]),
        vue.createElementVNode("view", { class: "cell column" }, [
          vue.createElementVNode("text", { class: "label" }, "详细地址"),
          vue.withDirectives(vue.createElementVNode(
            "textarea",
            {
              class: "textarea sm",
              "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => $data.form.address = $event),
              placeholder: "门牌、楼层等",
              "placeholder-class": "ph"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.address]
          ])
        ])
      ]),
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("view", { class: "card-title" }, "营业与配送"),
        vue.createElementVNode("view", { class: "cell switch-row" }, [
          vue.createElementVNode("view", { class: "switch-label" }, [
            vue.createElementVNode("text", { class: "label" }, "营业状态"),
            vue.createElementVNode(
              "text",
              { class: "hint" },
              vue.toDisplayString($data.form.status === 1 ? "营业中" : "休息中"),
              1
              /* TEXT */
            )
          ]),
          vue.createElementVNode("switch", {
            checked: $data.form.status === 1,
            color: "#FF6B35",
            onChange: _cache[7] || (_cache[7] = (...args) => $options.onStatusChange && $options.onStatusChange(...args))
          }, null, 40, ["checked"])
        ]),
        vue.createElementVNode("view", { class: "cell" }, [
          vue.createElementVNode("text", { class: "label" }, "配送半径(km)"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "input",
              "onUpdate:modelValue": _cache[8] || (_cache[8] = ($event) => $data.form.delivery_radius = $event),
              type: "digit",
              placeholder: "如 3",
              "placeholder-class": "ph"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [
              vue.vModelText,
              $data.form.delivery_radius,
              void 0,
              { number: true }
            ]
          ])
        ])
      ]),
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("view", { class: "card-title" }, "地图位置（天地图）"),
        vue.createElementVNode("view", { class: "cell column" }, [
          vue.createElementVNode("text", { class: "label" }, "当前坐标"),
          $options.hasCoords ? (vue.openBlock(), vue.createElementBlock(
            "text",
            {
              key: 0,
              class: "coord"
            },
            " 纬度 " + vue.toDisplayString($options.formatCoord($data.form.latitude)) + "，经度 " + vue.toDisplayString($options.formatCoord($data.form.longitude)),
            1
            /* TEXT */
          )) : (vue.openBlock(), vue.createElementBlock("text", {
            key: 1,
            class: "coord empty"
          }, "尚未在地图上选点")),
          vue.createElementVNode("button", {
            class: "map-btn",
            type: "default",
            onClick: _cache[9] || (_cache[9] = (...args) => $options.openTiandituPicker && $options.openTiandituPicker(...args))
          }, " 在地图上选择店铺位置 "),
          vue.createElementVNode("text", { class: "map-tip" }, "使用国家天地图选点，自动写入 latitude / longitude")
        ])
      ]),
      vue.createElementVNode("view", { class: "footer-space" }),
      vue.createElementVNode("view", { class: "footer" }, [
        vue.createElementVNode("button", {
          class: "submit",
          loading: $data.submitting,
          onClick: _cache[10] || (_cache[10] = (...args) => $options.submitForm && $options.submitForm(...args))
        }, vue.toDisplayString($data.isCreateMode ? "创建店铺" : "保存设置"), 9, ["loading"])
      ])
    ]);
  }
  const PagesShopIndex = /* @__PURE__ */ _export_sfc(_sfc_main$9, [["render", _sfc_render$8], ["__scopeId", "data-v-7db6cc15"], ["__file", "E:/固始县外卖商家端/pages/shop/index.vue"]]);
  const MERCHANT_MY_URL = BASE_URL + "/api/merchant/my";
  const MERCHANT_CREATE_URL = BASE_URL + "/api/merchant/create";
  const normalizeCoordinateValue$1 = (value2) => {
    if (value2 == null)
      return null;
    const raw = typeof value2 === "string" ? value2.trim() : value2;
    if (raw === "")
      return null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  };
  const getValidCoordinatePair$1 = (latitude, longitude) => {
    const lat = normalizeCoordinateValue$1(latitude);
    const lng = normalizeCoordinateValue$1(longitude);
    if (lat == null || lng == null)
      return null;
    if (lat === 0 && lng === 0)
      return null;
    return {
      latitude: lat,
      longitude: lng
    };
  };
  const _sfc_main$8 = {
    data() {
      return {
        loading: true,
        hasShop: false,
        shopDisplay: null,
        categoryOptions: [],
        categoryLoading: false,
        categoryLoadFailed: false,
        routeToken: "",
        submitting: false,
        uploadingLicense: false,
        form: {
          name: "",
          phone: "",
          address: "",
          category: "",
          min_price: "",
          delivery_fee: "",
          business_license: "",
          latitude: null,
          longitude: null
        }
      };
    },
    computed: {
      currentCategoryIndex() {
        return this.categoryOptions.indexOf(this.form.category);
      },
      hasCoords() {
        return !!getValidCoordinatePair$1(this.form.latitude, this.form.longitude);
      }
    },
    onLoad(options) {
      const routeToken = options && options.token ? decodeURIComponent(options.token) : "";
      if (routeToken) {
        this.routeToken = routeToken;
        uni.setStorageSync("token", routeToken);
      }
    },
    onShow() {
      const token = this.routeToken || getToken() || uni.getStorageSync("token") || "";
      if (!token) {
        uni.redirectTo({ url: "/pages/login/index" });
        return;
      }
      uni.setStorageSync("token", token);
      this.loadCategoryOptions();
      this.loadMerchant();
    },
    methods: {
      normalizeCategoryOptions(res) {
        const raw = res && typeof res === "object" && res.data !== void 0 ? res.data : res;
        const arr = Array.isArray(raw) ? raw : raw && Array.isArray(raw.data) ? raw.data : [];
        return arr.map((item) => String(item || "").trim()).filter(Boolean);
      },
      normalizeRaw(resBody) {
        if (!resBody || typeof resBody !== "object")
          return null;
        return "data" in resBody && resBody.data !== void 0 ? resBody.data : resBody;
      },
      formatCoord(v2) {
        if (v2 == null || v2 === "")
          return "-";
        const n2 = Number(v2);
        return Number.isFinite(n2) ? n2.toFixed(6) : String(v2);
      },
      async loadCategoryOptions() {
        this.categoryLoading = true;
        this.categoryLoadFailed = false;
        try {
          const res = await getMerchantPrimaryCategories();
          this.categoryOptions = this.normalizeCategoryOptions(res);
        } catch (e2) {
          this.categoryOptions = [];
          this.categoryLoadFailed = true;
        } finally {
          this.categoryLoading = false;
        }
      },
      loadMerchant() {
        this.loading = true;
        const token = this.routeToken || uni.getStorageSync("token") || getToken() || "";
        if (!token) {
          this.loading = false;
          uni.redirectTo({ url: "/pages/login/index" });
          return;
        }
        uni.request({
          url: MERCHANT_MY_URL,
          method: "GET",
          header: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
          },
          success: (res) => {
            const sc = res.statusCode;
            if (sc === 404) {
              this.hasShop = false;
              this.shopDisplay = null;
              return;
            }
            if (sc === 401 || sc === 403) {
              uni.showToast({ title: "登录已失效，请重新登录", icon: "none" });
              setTimeout(() => {
                uni.redirectTo({ url: "/pages/login/index" });
              }, 1200);
              return;
            }
            if (sc !== 200) {
              this.hasShop = false;
              this.shopDisplay = null;
              return;
            }
            const resBody = res.data;
            const raw = this.normalizeRaw(resBody);
            if (!raw || typeof raw !== "object") {
              this.hasShop = false;
              this.shopDisplay = null;
              return;
            }
            const id = raw.id;
            const name = raw.name;
            if (name || id != null) {
              this.hasShop = true;
              this.shopDisplay = {
                name: name != null ? String(name) : "",
                phone: raw.phone != null ? String(raw.phone) : "",
                address: raw.address != null ? String(raw.address) : "",
                category: raw.category != null ? String(raw.category) : "",
                min_price: raw.min_price != null ? raw.min_price : "",
                delivery_fee: raw.delivery_fee != null ? raw.delivery_fee : "",
                business_license: raw.business_license != null ? String(raw.business_license) : ""
              };
            } else {
              this.hasShop = false;
              this.shopDisplay = null;
            }
          },
          fail: () => {
            this.hasShop = false;
            this.shopDisplay = null;
            uni.showToast({ title: "网络异常", icon: "none" });
          },
          complete: () => {
            this.loading = false;
          }
        });
      },
      openTiandituPicker() {
        const lat = this.form.latitude != null ? String(this.form.latitude) : "";
        const lng = this.form.longitude != null ? String(this.form.longitude) : "";
        const address = this.form.address != null ? String(this.form.address) : "";
        uni.navigateTo({
          url: `/pages/shop/tianditu-picker?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&address=${encodeURIComponent(address)}`,
          events: {
            picked: (data) => {
              if (!data)
                return;
              const coordinatePair = getValidCoordinatePair$1(data.latitude, data.longitude);
              if (!coordinatePair) {
                this.form.latitude = null;
                this.form.longitude = null;
                uni.showToast({ title: "地图选点无效，请重新选点", icon: "none" });
                return;
              }
              this.form.latitude = coordinatePair.latitude;
              this.form.longitude = coordinatePair.longitude;
              if (data.address) {
                this.form.address = data.address;
              } else if (data.town && !this.form.address) {
                this.form.address = data.town;
              }
            }
          }
        });
      },
      goHome() {
        uni.reLaunch({ url: "/pages/index/index" });
      },
      previewUrl(url2) {
        if (!url2)
          return;
        uni.previewImage({ urls: [url2], current: url2 });
      },
      chooseAndUploadLicense() {
        const token = uni.getStorageSync("token") || "";
        if (!token) {
          uni.showToast({ title: "请先登录", icon: "none" });
          return;
        }
        uni.chooseImage({
          count: 1,
          sizeType: ["compressed"],
          sourceType: ["album", "camera"],
          success: (res) => {
            this.uploadingLicense = true;
            uni.uploadFile({
              url: BASE_URL + "/api/upload/image",
              filePath: res.tempFilePaths[0],
              name: "file",
              header: {
                Authorization: "Bearer " + token
              },
              success: (uploadRes) => {
                try {
                  const data = JSON.parse(uploadRes.data);
                  if (data.code === 200) {
                    this.form.business_license = data.data.url;
                    uni.showToast({ title: "上传成功", icon: "success" });
                  } else {
                    uni.showToast({ title: data.message || "上传失败", icon: "none" });
                  }
                } catch (e2) {
                  uni.showToast({ title: "解析失败", icon: "none" });
                }
              },
              fail: () => {
                uni.showToast({ title: "上传失败", icon: "none" });
              },
              complete: () => {
                this.uploadingLicense = false;
              }
            });
          },
          fail: (err) => {
            const msg = err && err.errMsg || "选择图片失败";
            uni.showToast({ title: msg, icon: "none" });
          }
        });
      },
      onCategoryChange(e2) {
        if (!this.categoryOptions.length)
          return;
        const index = Number(e2 && e2.detail && e2.detail.value);
        this.form.category = this.categoryOptions[index] || "";
      },
      submit() {
        const name = (this.form.name || "").trim();
        const phone = (this.form.phone || "").trim();
        const address = (this.form.address || "").trim();
        const category = (this.form.category || "").trim();
        const minPrice = parseFloat(this.form.min_price);
        const deliveryFee = parseFloat(this.form.delivery_fee);
        const business_license = (this.form.business_license || "").trim();
        const token = uni.getStorageSync("token") || "";
        if (!name) {
          uni.showToast({ title: "请填写店铺名称", icon: "none" });
          return;
        }
        if (!phone) {
          uni.showToast({ title: "请填写联系电话", icon: "none" });
          return;
        }
        if (!address) {
          uni.showToast({ title: "请填写详细地址", icon: "none" });
          return;
        }
        if (!this.hasCoords) {
          uni.showToast({ title: "请在地图上选择店铺位置", icon: "none" });
          return;
        }
        if (this.categoryLoading) {
          uni.showToast({ title: "主营类目加载中，请稍后", icon: "none" });
          return;
        }
        if (!this.categoryOptions.length) {
          uni.showToast({ title: "主营类目暂不可用，请稍后重试", icon: "none" });
          return;
        }
        if (!category) {
          uni.showToast({ title: "请选择店铺主营类目", icon: "none" });
          return;
        }
        if (!this.categoryOptions.includes(category)) {
          uni.showToast({ title: "请选择有效的主营类目", icon: "none" });
          return;
        }
        if (Number.isNaN(minPrice) || minPrice < 0) {
          uni.showToast({ title: "请填写有效起送价", icon: "none" });
          return;
        }
        if (Number.isNaN(deliveryFee) || deliveryFee < 0) {
          uni.showToast({ title: "请填写有效配送费", icon: "none" });
          return;
        }
        if (!token) {
          uni.showToast({ title: "请先登录", icon: "none" });
          return;
        }
        const coordinatePair = getValidCoordinatePair$1(this.form.latitude, this.form.longitude);
        if (!coordinatePair) {
          uni.showToast({ title: "地图坐标无效，请重新选点", icon: "none" });
          return;
        }
        const data = {
          name,
          phone,
          address,
          category,
          min_price: minPrice,
          delivery_fee: deliveryFee,
          business_license,
          latitude: coordinatePair.latitude,
          longitude: coordinatePair.longitude
        };
        this.submitting = true;
        uni.request({
          url: MERCHANT_CREATE_URL,
          method: "POST",
          header: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
          },
          data,
          success: (res) => {
            const sc = res.statusCode;
            const body = res.data;
            if (sc === 401 || sc === 403) {
              uni.showToast({ title: "登录已失效或无权限", icon: "none" });
              return;
            }
            if (sc === 200 || sc === 201) {
              if (body && typeof body === "object") {
                const c2 = body.code;
                if (c2 != null && c2 !== 0 && c2 !== 200 && c2 !== 201 && body.success !== true) {
                  const msg2 = body.message || body.msg || "提交失败";
                  uni.showToast({ title: String(msg2), icon: "none" });
                  return;
                }
              }
              uni.showToast({ title: "提交成功", icon: "success" });
              setTimeout(() => {
                uni.reLaunch({ url: "/pages/index/index" });
              }, 600);
              return;
            }
            let msg = "提交失败";
            if (body && typeof body === "object") {
              msg = body.detail || body.message || body.msg || msg;
            }
            uni.showToast({ title: typeof msg === "string" ? msg : "提交失败", icon: "none" });
          },
          fail: () => {
            uni.showToast({ title: "网络错误", icon: "none" });
          },
          complete: () => {
            this.submitting = false;
          }
        });
      }
    }
  };
  function _sfc_render$7(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      $data.loading ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "hint"
      }, "加载中…")) : $data.hasShop && $data.shopDisplay ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "card"
      }, [
        vue.createElementVNode("view", { class: "h1" }, "店铺信息"),
        vue.createElementVNode("view", { class: "row" }, [
          vue.createElementVNode("text", { class: "label" }, "店铺名称"),
          vue.createElementVNode(
            "text",
            { class: "val" },
            vue.toDisplayString($data.shopDisplay.name),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "row" }, [
          vue.createElementVNode("text", { class: "label" }, "联系电话"),
          vue.createElementVNode(
            "text",
            { class: "val" },
            vue.toDisplayString($data.shopDisplay.phone),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "row" }, [
          vue.createElementVNode("text", { class: "label" }, "详细地址"),
          vue.createElementVNode(
            "text",
            { class: "val" },
            vue.toDisplayString($data.shopDisplay.address),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "row" }, [
          vue.createElementVNode("text", { class: "label" }, "主营类目"),
          vue.createElementVNode(
            "text",
            { class: "val" },
            vue.toDisplayString($data.shopDisplay.category || "未填写"),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "row" }, [
          vue.createElementVNode("text", { class: "label" }, "起送价"),
          vue.createElementVNode(
            "text",
            { class: "val" },
            vue.toDisplayString($data.shopDisplay.min_price),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "row" }, [
          vue.createElementVNode("text", { class: "label" }, "配送费"),
          vue.createElementVNode(
            "text",
            { class: "val" },
            vue.toDisplayString($data.shopDisplay.delivery_fee),
            1
            /* TEXT */
          )
        ]),
        $data.shopDisplay.business_license ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "license-block"
        }, [
          vue.createElementVNode("text", { class: "label-row" }, "营业执照"),
          vue.createElementVNode("image", {
            class: "license-img",
            src: $data.shopDisplay.business_license,
            mode: "widthFix",
            onClick: _cache[0] || (_cache[0] = ($event) => $options.previewUrl($data.shopDisplay.business_license))
          }, null, 8, ["src"])
        ])) : vue.createCommentVNode("v-if", true),
        vue.createElementVNode("button", {
          class: "btn",
          type: "primary",
          onClick: _cache[1] || (_cache[1] = (...args) => $options.goHome && $options.goHome(...args))
        }, "进入工作台")
      ])) : (vue.openBlock(), vue.createElementBlock("view", {
        key: 2,
        class: "card"
      }, [
        vue.createElementVNode("view", { class: "h1" }, "申请开店"),
        vue.createElementVNode("view", { class: "field" }, [
          vue.createElementVNode("text", { class: "label" }, "店铺名称"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "input",
              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => $data.form.name = $event),
              placeholder: "店铺名称"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.name]
          ])
        ]),
        vue.createElementVNode("view", { class: "field" }, [
          vue.createElementVNode("text", { class: "label" }, "联系电话"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "input",
              "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => $data.form.phone = $event),
              type: "number",
              maxlength: "11",
              placeholder: "手机号"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.phone]
          ])
        ]),
        vue.createElementVNode("view", { class: "field" }, [
          vue.createElementVNode("text", { class: "label" }, "详细地址"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "input",
              "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => $data.form.address = $event),
              placeholder: "详细地址"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.address]
          ])
        ]),
        vue.createElementVNode("view", { class: "field" }, [
          vue.createElementVNode("text", { class: "label" }, "店铺位置"),
          vue.createElementVNode("view", {
            class: "picker-line coord-line",
            onClick: _cache[5] || (_cache[5] = (...args) => $options.openTiandituPicker && $options.openTiandituPicker(...args))
          }, [
            $options.hasCoords ? (vue.openBlock(), vue.createElementBlock(
              "text",
              { key: 0 },
              "纬度 " + vue.toDisplayString($options.formatCoord($data.form.latitude)) + "，经度 " + vue.toDisplayString($options.formatCoord($data.form.longitude)),
              1
              /* TEXT */
            )) : (vue.openBlock(), vue.createElementBlock("text", {
              key: 1,
              class: "placeholder-text"
            }, "请在地图上选择店铺位置"))
          ]),
          vue.createElementVNode("button", {
            class: "location-btn",
            type: "default",
            onClick: _cache[6] || (_cache[6] = (...args) => $options.openTiandituPicker && $options.openTiandituPicker(...args))
          }, "在地图上选择店铺位置"),
          vue.createElementVNode("text", { class: "picker-tip" }, "使用天地图选点，提交真实 latitude / longitude")
        ]),
        vue.createElementVNode("view", { class: "field" }, [
          vue.createElementVNode("text", { class: "label" }, "店铺主营类目"),
          vue.createElementVNode("picker", {
            range: $data.categoryOptions,
            value: $options.currentCategoryIndex > -1 ? $options.currentCategoryIndex : 0,
            disabled: !$data.categoryOptions.length,
            onChange: _cache[7] || (_cache[7] = (...args) => $options.onCategoryChange && $options.onCategoryChange(...args))
          }, [
            vue.createElementVNode(
              "view",
              { class: "picker-line" },
              vue.toDisplayString($data.form.category || "请选择店铺主营类目"),
              1
              /* TEXT */
            )
          ], 40, ["range", "value", "disabled"]),
          $data.categoryLoading ? (vue.openBlock(), vue.createElementBlock("text", {
            key: 0,
            class: "picker-tip"
          }, "主营类目加载中...")) : $data.categoryLoadFailed ? (vue.openBlock(), vue.createElementBlock("text", {
            key: 1,
            class: "picker-tip error"
          }, "主营类目加载失败，请稍后重试")) : !$data.categoryOptions.length ? (vue.openBlock(), vue.createElementBlock("text", {
            key: 2,
            class: "picker-tip error"
          }, "暂无可选主营类目")) : vue.createCommentVNode("v-if", true)
        ]),
        vue.createElementVNode("view", { class: "field" }, [
          vue.createElementVNode("text", { class: "label" }, "起送价"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "input",
              "onUpdate:modelValue": _cache[8] || (_cache[8] = ($event) => $data.form.min_price = $event),
              type: "digit",
              placeholder: "元"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.min_price]
          ])
        ]),
        vue.createElementVNode("view", { class: "field" }, [
          vue.createElementVNode("text", { class: "label" }, "配送费"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "input",
              "onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => $data.form.delivery_fee = $event),
              type: "digit",
              placeholder: "元"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.delivery_fee]
          ])
        ]),
        vue.createElementVNode("view", { class: "field" }, [
          vue.createElementVNode("text", { class: "label" }, "上传营业执照 (business_license)"),
          vue.createElementVNode("button", {
            class: "upload-btn",
            type: "default",
            disabled: $data.uploadingLicense,
            loading: $data.uploadingLicense,
            onClick: _cache[10] || (_cache[10] = (...args) => $options.chooseAndUploadLicense && $options.chooseAndUploadLicense(...args))
          }, vue.toDisplayString($data.form.business_license ? "重新选择图片" : "从相册选择"), 9, ["disabled", "loading"]),
          $data.form.business_license ? (vue.openBlock(), vue.createElementBlock("image", {
            key: 0,
            class: "license-preview",
            src: $data.form.business_license.startsWith("http://") || $data.form.business_license.startsWith("https://") ? $data.form.business_license : $data.form.business_license.startsWith("/") ? _ctx.BASE_URL + $data.form.business_license : _ctx.BASE_URL + "/" + $data.form.business_license,
            mode: "widthFix",
            onClick: _cache[11] || (_cache[11] = ($event) => $options.previewUrl($data.form.business_license.startsWith("http://") || $data.form.business_license.startsWith("https://") ? $data.form.business_license : $data.form.business_license.startsWith("/") ? _ctx.BASE_URL + $data.form.business_license : _ctx.BASE_URL + "/" + $data.form.business_license))
          }, null, 8, ["src"])) : vue.createCommentVNode("v-if", true)
        ]),
        vue.createElementVNode("button", {
          class: "btn",
          type: "primary",
          loading: $data.submitting,
          onClick: _cache[12] || (_cache[12] = (...args) => $options.submit && $options.submit(...args))
        }, "提交开店申请", 8, ["loading"])
      ]))
    ]);
  }
  const PagesShopShopApply = /* @__PURE__ */ _export_sfc(_sfc_main$8, [["render", _sfc_render$7], ["__scopeId", "data-v-797be701"], ["__file", "E:/固始县外卖商家端/pages/shop/shop-apply.vue"]]);
  const logPickerStep = (step, payload) => {
    try {
      formatAppLog("log", "at pages/shop/tianditu-picker.vue:15", "[shop-tianditu-picker][" + step + "]", payload || "");
    } catch (e2) {
    }
  };
  const normalizeCoordinateValue = (value2) => {
    if (value2 == null)
      return null;
    const raw = typeof value2 === "string" ? value2.trim() : value2;
    if (raw === "")
      return null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  };
  const getValidCoordinatePair = (latitude, longitude) => {
    const lat = normalizeCoordinateValue(latitude);
    const lng = normalizeCoordinateValue(longitude);
    if (lat == null || lng == null)
      return null;
    if (lat === 0 && lng === 0)
      return null;
    return {
      latitude: lat,
      longitude: lng
    };
  };
  const pickCoordinatePair = (source) => {
    if (!source || typeof source !== "object")
      return null;
    const deliveryAddress = source.delivery_address && typeof source.delivery_address === "object" ? source.delivery_address : {};
    return getValidCoordinatePair(
      source.latitude != null ? source.latitude : source.lat != null ? source.lat : source.delivery_latitude != null ? source.delivery_latitude : deliveryAddress.latitude,
      source.longitude != null ? source.longitude : source.lng != null ? source.lng : source.delivery_longitude != null ? source.delivery_longitude : deliveryAddress.longitude
    );
  };
  const _sfc_main$7 = {
    data() {
      return {
        src: "",
        eventChannel: null
      };
    },
    onLoad(options) {
      try {
        this.eventChannel = this.getOpenerEventChannel && this.getOpenerEventChannel();
      } catch (e2) {
        this.eventChannel = null;
      }
      logPickerStep("onLoad-eventChannel", { hasEventChannel: !!this.eventChannel });
      const lat = options.lat != null && options.lat !== "" ? String(options.lat) : "";
      const lng = options.lng != null && options.lng !== "" ? String(options.lng) : "";
      const address = options.address != null && options.address !== "" ? String(options.address) : "";
      const tk = TIANDITU_TK;
      const q2 = [
        "tk=" + encodeURIComponent(tk),
        "lat=" + encodeURIComponent(lat),
        "lng=" + encodeURIComponent(lng),
        "address=" + encodeURIComponent(address)
      ].join("&");
      this.src = "/static/hybrid/html/tianditu-picker.html?" + q2;
      logPickerStep("onLoad-src-ready", { src: this.src });
    },
    methods: {
      normalizeResult(raw) {
        const source = raw || {};
        const deliveryAddress = source.delivery_address && typeof source.delivery_address === "object" ? source.delivery_address : {};
        const coordinatePair = pickCoordinatePair(source);
        const address = String(source.address || deliveryAddress.detail || deliveryAddress.name || "").trim();
        const town = String(source.town || deliveryAddress.town || "").trim();
        return {
          latitude: coordinatePair ? coordinatePair.latitude : null,
          longitude: coordinatePair ? coordinatePair.longitude : null,
          address,
          town,
          delivery_address: {
            province: String(deliveryAddress.province || "").trim(),
            city: String(deliveryAddress.city || "").trim(),
            district: String(deliveryAddress.district || "").trim(),
            town,
            street: String(deliveryAddress.street || "").trim(),
            detail: String(deliveryAddress.detail || address || "").trim(),
            name: String(deliveryAddress.name || address || "").trim(),
            longitude: coordinatePair ? coordinatePair.longitude : null,
            latitude: coordinatePair ? coordinatePair.latitude : null
          }
        };
      },
      handlePicked(raw) {
        logPickerStep("handlePicked-enter", raw);
        const msg = this.normalizeResult(raw);
        logPickerStep("handlePicked-normalized", msg);
        if (msg == null || msg.latitude == null || msg.longitude == null) {
          uni.showToast({ title: "地图选点无效，请重新选点", icon: "none" });
          return;
        }
        const payload = {
          latitude: msg.latitude,
          longitude: msg.longitude
        };
        if (msg.address) {
          payload.address = msg.address;
        }
        if (msg.town) {
          payload.town = msg.town;
        }
        if (msg.delivery_address && typeof msg.delivery_address === "object") {
          payload.delivery_address = msg.delivery_address;
        }
        if (this.eventChannel) {
          logPickerStep("handlePicked-before-emit", payload);
          this.eventChannel.emit("picked", payload);
          logPickerStep("handlePicked-after-emit", { emitted: true });
        } else {
          logPickerStep("handlePicked-no-eventChannel", payload);
        }
        logPickerStep("handlePicked-before-navigateBack", payload);
        uni.navigateBack();
      },
      extractMessagePayload(e2) {
        const raw = e2 && e2.detail ? e2.detail.data : null;
        const candidates = [];
        if (Array.isArray(raw)) {
          candidates.push(...raw);
        } else if (raw != null) {
          candidates.push(raw);
        }
        for (let i2 = candidates.length - 1; i2 >= 0; i2 -= 1) {
          const item = candidates[i2];
          if (item && typeof item === "object") {
            if (pickCoordinatePair(item))
              return item;
            if (item.data && typeof item.data === "object") {
              const nested = item.data;
              if (pickCoordinatePair(nested))
                return nested;
            }
          }
        }
        return null;
      },
      onMessage(e2) {
        logPickerStep("onMessage-enter", e2 && e2.detail ? e2.detail.data : e2);
        const msg = this.extractMessagePayload(e2);
        logPickerStep("onMessage-extracted", msg);
        if (msg == null)
          return;
        this.handlePicked(msg);
      }
    }
  };
  function _sfc_render$6(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      $data.src ? (vue.openBlock(), vue.createElementBlock("web-view", {
        key: 0,
        src: $data.src,
        onMessage: _cache[0] || (_cache[0] = (...args) => $options.onMessage && $options.onMessage(...args))
      }, null, 40, ["src"])) : (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "fallback"
      }, [
        vue.createElementVNode("text", { class: "fallback-text" }, "正在加载天地图…")
      ]))
    ]);
  }
  const PagesShopTiandituPicker = /* @__PURE__ */ _export_sfc(_sfc_main$7, [["render", _sfc_render$6], ["__scopeId", "data-v-e6c2b886"], ["__file", "E:/固始县外卖商家端/pages/shop/tianditu-picker.vue"]]);
  const _sfc_main$6 = {
    data() {
      return {
        categoryList: [],
        productList: [],
        currentCategoryId: "all"
      };
    },
    computed: {
      displayList() {
        if (this.currentCategoryId === "all")
          return this.productList;
        const cid = Number(this.currentCategoryId);
        return this.productList.filter((p2) => Number(p2.category_id) === cid);
      }
    },
    onLoad() {
      this.bootstrap();
    },
    onShow() {
      this.bootstrap();
    },
    async onPullDownRefresh() {
      try {
        await this.bootstrap();
      } catch (e2) {
        formatAppLog("error", "at pages/shop/food-list.vue:107", e2);
      } finally {
        uni.stopPullDownRefresh();
      }
    },
    methods: {
      async bootstrap() {
        await Promise.all([this.loadCategories(), this.loadProducts()]);
      },
      normalizeCategories(res) {
        const arr = res && res.data && Array.isArray(res.data.data) && res.data.data || res && Array.isArray(res.data) && res.data || res && Array.isArray(res) && res || [];
        return arr.map((c2) => ({
          id: c2.id,
          name: c2.name != null ? String(c2.name) : ""
        })).filter((c2) => c2.id != null);
      },
      normalizeProducts(res) {
        const raw = res && typeof res === "object" && res.data !== void 0 ? res.data : res;
        const arr = Array.isArray(raw) ? raw : raw && Array.isArray(raw.list) ? raw.list : [];
        return arr.map((p2) => {
          const imageList = this.parseImageList(p2.images);
          return {
            id: p2.id,
            name: p2.name != null ? String(p2.name) : "",
            price: p2.price,
            stock: p2.stock != null ? p2.stock : p2.inventory != null ? p2.inventory : 0,
            status: p2.status === 0 || p2.status === 1 ? p2.status : 0,
            category_id: p2.category_id != null ? p2.category_id : null,
            image: imageList[0] || p2.image || p2.cover || p2.cover_url || p2.logo || ""
          };
        });
      },
      parseImageList(rawImages) {
        if (Array.isArray(rawImages)) {
          return rawImages.filter((u2) => typeof u2 === "string" && u2);
        }
        if (typeof rawImages !== "string" || !rawImages.trim())
          return [];
        try {
          const parsed = JSON.parse(rawImages);
          return Array.isArray(parsed) ? parsed.filter((u2) => typeof u2 === "string" && u2) : [];
        } catch (e2) {
          return [];
        }
      },
      formatImageUrl(url2) {
        if (!url2)
          return "";
        if (url2.startsWith("http://") || url2.startsWith("https://") || url2.startsWith("data:image") || url2.startsWith("blob:")) {
          return url2;
        }
        return url2.startsWith("/") ? BASE_URL + url2 : BASE_URL + "/" + url2;
      },
      async loadCategories() {
        try {
          const res = await request({ url: "/merchant/my-categories", method: "GET" });
          this.categoryList = this.normalizeCategories(res);
        } catch (e2) {
          this.categoryList = [];
        }
      },
      async loadProducts() {
        try {
          const res = await getMyProducts({});
          this.productList = this.normalizeProducts(res);
        } catch (e2) {
          this.productList = [];
        }
      },
      formatPrice(v2) {
        const n2 = Number(v2);
        return Number.isFinite(n2) ? n2.toFixed(2) : "--";
      },
      switchCategory(id) {
        this.currentCategoryId = id;
      },
      noopSearch() {
        uni.showToast({ title: "搜索功能敬请期待", icon: "none" });
      },
      goCategoryAdd() {
        uni.navigateTo({ url: "/pages/shop/category-add" });
      },
      goCategoryManage() {
        uni.navigateTo({ url: "/pages/shop/category-manage" });
      },
      goPublish() {
        uni.navigateTo({ url: "/pages/shop/product-publish" });
      },
      goEdit(item) {
        uni.navigateTo({ url: "/pages/shop/food-edit?id=" + item.id });
      },
      previewImg(item) {
        const u2 = this.formatImageUrl(item.image);
        if (!u2) {
          uni.showToast({ title: "暂无图片", icon: "none" });
          return;
        }
        uni.previewImage({ urls: [u2] });
      },
      async toggleShelf(item) {
        const next = item.status === 1 ? 0 : 1;
        try {
          await request({
            url: "/merchant/product/" + item.id,
            method: "PUT",
            data: { status: next }
          });
          uni.showToast({ title: next === 1 ? "已上架" : "已下架", icon: "success" });
          await this.loadProducts();
        } catch (e2) {
          uni.showToast({ title: "操作失败", icon: "none" });
        }
      },
      handleDelete(item) {
        uni.showModal({
          title: "删除商品",
          content: "确定删除「" + item.name + "」吗？",
          success: async (res) => {
            if (!res.confirm)
              return;
            try {
              await request({ url: "/merchant/product/" + item.id, method: "DELETE" });
              uni.showToast({ title: "已删除", icon: "success" });
              await this.loadProducts();
            } catch (e2) {
              uni.showToast({ title: "删除失败", icon: "none" });
            }
          }
        });
      }
    }
  };
  function _sfc_render$5(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "header" }, [
        vue.createElementVNode("view", { class: "header-row" }, [
          vue.createElementVNode("button", {
            class: "btn-cat",
            type: "default",
            onClick: _cache[0] || (_cache[0] = (...args) => $options.goCategoryAdd && $options.goCategoryAdd(...args))
          }, "添加分类"),
          vue.createElementVNode("button", {
            class: "btn-cat",
            type: "default",
            onClick: _cache[1] || (_cache[1] = (...args) => $options.goCategoryManage && $options.goCategoryManage(...args))
          }, "分类管理"),
          vue.createElementVNode("view", {
            class: "search-bar",
            onClick: _cache[2] || (_cache[2] = (...args) => $options.noopSearch && $options.noopSearch(...args))
          }, [
            vue.createElementVNode("text", { class: "search-icon" }, "🔍"),
            vue.createElementVNode("text", { class: "search-placeholder" }, "搜索商品（敬请期待）")
          ])
        ]),
        vue.createElementVNode("view", { class: "add-wrap" }, [
          vue.createElementVNode("button", {
            class: "add-btn",
            type: "default",
            onClick: _cache[3] || (_cache[3] = (...args) => $options.goPublish && $options.goPublish(...args))
          }, "添加商品")
        ])
      ]),
      vue.createElementVNode("view", { class: "category-scroll" }, [
        vue.createElementVNode("scroll-view", {
          "scroll-x": "",
          class: "category-list",
          "show-scrollbar": false
        }, [
          vue.createElementVNode(
            "view",
            {
              class: vue.normalizeClass(["category-item", { "category-active": $data.currentCategoryId === "all" }]),
              onClick: _cache[4] || (_cache[4] = ($event) => $options.switchCategory("all"))
            },
            [
              vue.createElementVNode("text", { class: "category-text" }, "全部")
            ],
            2
            /* CLASS */
          ),
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($data.categoryList, (c2) => {
              return vue.openBlock(), vue.createElementBlock("view", {
                key: c2.id,
                class: vue.normalizeClass(["category-item", { "category-active": $data.currentCategoryId === c2.id }]),
                onClick: ($event) => $options.switchCategory(c2.id)
              }, [
                vue.createElementVNode(
                  "text",
                  { class: "category-text" },
                  vue.toDisplayString(c2.name),
                  1
                  /* TEXT */
                )
              ], 10, ["onClick"]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])
      ]),
      $options.displayList.length > 0 ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "food-list"
      }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($options.displayList, (item) => {
            return vue.openBlock(), vue.createElementBlock("view", {
              class: "food-card",
              key: item.id
            }, [
              vue.createElementVNode("view", {
                class: "food-image",
                onClick: ($event) => $options.previewImg(item)
              }, [
                item.image ? (vue.openBlock(), vue.createElementBlock("image", {
                  key: 0,
                  class: "img",
                  src: $options.formatImageUrl(item.image),
                  mode: "aspectFill"
                }, null, 8, ["src"])) : (vue.openBlock(), vue.createElementBlock("text", {
                  key: 1,
                  class: "food-emoji"
                }, "🍱"))
              ], 8, ["onClick"]),
              vue.createElementVNode("view", { class: "food-info" }, [
                vue.createElementVNode("view", { class: "food-header" }, [
                  vue.createElementVNode(
                    "text",
                    { class: "food-name" },
                    vue.toDisplayString(item.name),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "view",
                    {
                      class: vue.normalizeClass(["food-status", { off: item.status !== 1 }])
                    },
                    [
                      vue.createElementVNode(
                        "text",
                        { class: "status-text" },
                        vue.toDisplayString(item.status === 1 ? "上架" : "下架"),
                        1
                        /* TEXT */
                      )
                    ],
                    2
                    /* CLASS */
                  )
                ]),
                vue.createElementVNode("view", { class: "food-footer" }, [
                  vue.createElementVNode("view", { class: "food-price-wrap" }, [
                    vue.createElementVNode("text", { class: "price-symbol" }, "¥"),
                    vue.createElementVNode(
                      "text",
                      { class: "food-price" },
                      vue.toDisplayString($options.formatPrice(item.price)),
                      1
                      /* TEXT */
                    )
                  ]),
                  vue.createElementVNode(
                    "text",
                    { class: "stock-text" },
                    "库存 " + vue.toDisplayString(item.stock),
                    1
                    /* TEXT */
                  )
                ]),
                vue.createElementVNode("view", { class: "food-actions" }, [
                  vue.createElementVNode("button", {
                    class: "mini",
                    size: "mini",
                    type: "default",
                    onClick: ($event) => $options.toggleShelf(item)
                  }, vue.toDisplayString(item.status === 1 ? "下架" : "上架"), 9, ["onClick"]),
                  vue.createElementVNode("button", {
                    class: "mini primary",
                    size: "mini",
                    type: "default",
                    onClick: ($event) => $options.goEdit(item)
                  }, "编辑", 8, ["onClick"]),
                  vue.createElementVNode("button", {
                    class: "mini danger",
                    size: "mini",
                    type: "default",
                    onClick: ($event) => $options.handleDelete(item)
                  }, "删除", 8, ["onClick"])
                ])
              ])
            ]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ])) : (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "empty"
      }, [
        vue.createElementVNode("text", { class: "empty-icon" }, "📦"),
        vue.createElementVNode("text", { class: "empty-text" }, "暂无商品"),
        vue.createElementVNode("button", {
          class: "empty-btn",
          type: "default",
          onClick: _cache[5] || (_cache[5] = (...args) => $options.goPublish && $options.goPublish(...args))
        }, "添加商品")
      ]))
    ]);
  }
  const PagesShopFoodList = /* @__PURE__ */ _export_sfc(_sfc_main$6, [["render", _sfc_render$5], ["__file", "E:/固始县外卖商家端/pages/shop/food-list.vue"]]);
  const _sfc_main$5 = {
    data() {
      return {
        list: [],
        dialogVisible: false,
        dialogMode: "add",
        dialogName: "",
        editingId: null
      };
    },
    onLoad() {
      this.loadList();
    },
    async onPullDownRefresh() {
      try {
        await this.loadList();
      } catch (e2) {
        formatAppLog("error", "at pages/shop/category-manage.vue:69", e2);
      } finally {
        uni.stopPullDownRefresh();
      }
    },
    methods: {
      normalizeList(res) {
        const arr = res && res.data && Array.isArray(res.data.data) && res.data.data || res && Array.isArray(res.data) && res.data || res && Array.isArray(res) && res || [];
        return arr.map((c2) => ({
          id: c2.id,
          name: c2.name != null ? String(c2.name) : ""
        }));
      },
      async loadList() {
        try {
          const res = await getMerchantCategoryList();
          this.list = this.normalizeList(res);
        } catch (e2) {
          this.list = [];
          formatAppLog("log", "at pages/shop/category-manage.vue:92", "分类列表加载失败", e2);
        }
      },
      openDialog(mode, item) {
        this.dialogMode = mode;
        this.dialogVisible = true;
        if (mode === "edit" && item) {
          this.editingId = item.id;
          this.dialogName = item.name;
        } else {
          this.editingId = null;
          this.dialogName = "";
        }
      },
      closeDialog() {
        this.dialogVisible = false;
        this.dialogName = "";
        this.editingId = null;
      },
      async submitDialog() {
        const name = (this.dialogName || "").trim();
        if (!name) {
          uni.showToast({ title: "请输入分类名称", icon: "none" });
          return;
        }
        try {
          if (this.dialogMode === "add") {
            await createCategory({ name, sort: 1 });
            uni.showToast({ title: "已新增", icon: "success" });
          } else {
            await updateCategory(this.editingId, { name });
            uni.showToast({ title: "已保存", icon: "success" });
          }
          this.closeDialog();
          await this.loadList();
        } catch (e2) {
          const msg = e2 && (e2.message || e2.detail || e2.msg) || "操作失败";
          uni.showToast({ title: msg, icon: "none" });
        }
      },
      confirmDelete(item) {
        uni.showModal({
          title: "删除分类",
          content: `确定删除「${item.name}」吗？`,
          success: async (res) => {
            if (!res.confirm)
              return;
            try {
              await deleteCategory(item.id);
              uni.showToast({ title: "已删除", icon: "success" });
              await this.loadList();
            } catch (e2) {
              const msg = e2 && (e2.message || e2.detail || e2.msg) || "删除失败";
              uni.showToast({ title: msg, icon: "none" });
            }
          }
        });
      }
    }
  };
  function _sfc_render$4(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      vue.createElementVNode("view", { class: "toolbar" }, [
        vue.createElementVNode("text", { class: "hint" }, "当前店铺的商品分类，可与后台「Merchant / Category」表对应"),
        vue.createElementVNode("button", {
          class: "btn-add",
          type: "default",
          onClick: _cache[0] || (_cache[0] = ($event) => $options.openDialog("add"))
        }, "＋ 新增分类")
      ]),
      $data.list.length ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "list"
      }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($data.list, (item) => {
            return vue.openBlock(), vue.createElementBlock("view", {
              key: item.id,
              class: "row"
            }, [
              vue.createElementVNode("view", { class: "row-main" }, [
                vue.createElementVNode(
                  "text",
                  { class: "name" },
                  vue.toDisplayString(item.name),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode(
                  "text",
                  { class: "id" },
                  "#" + vue.toDisplayString(item.id),
                  1
                  /* TEXT */
                )
              ]),
              vue.createElementVNode("view", { class: "row-actions" }, [
                vue.createElementVNode("text", {
                  class: "link",
                  onClick: ($event) => $options.openDialog("edit", item)
                }, "编辑", 8, ["onClick"]),
                vue.createElementVNode("text", {
                  class: "link danger",
                  onClick: ($event) => $options.confirmDelete(item)
                }, "删除", 8, ["onClick"])
              ])
            ]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ])) : (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "empty"
      }, [
        vue.createElementVNode("text", { class: "empty-icon" }, "📂"),
        vue.createElementVNode("text", { class: "empty-text" }, "暂无分类，请先新增")
      ])),
      $data.dialogVisible ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 2,
        class: "mask",
        onClick: _cache[5] || (_cache[5] = vue.withModifiers((...args) => $options.closeDialog && $options.closeDialog(...args), ["self"]))
      }, [
        vue.createElementVNode("view", {
          class: "dialog",
          onClick: _cache[4] || (_cache[4] = vue.withModifiers(() => {
          }, ["stop"]))
        }, [
          vue.createElementVNode(
            "text",
            { class: "dlg-title" },
            vue.toDisplayString($data.dialogMode === "add" ? "新增分类" : "编辑分类"),
            1
            /* TEXT */
          ),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "dlg-input",
              "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => $data.dialogName = $event),
              placeholder: "分类名称",
              "placeholder-class": "ph"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.dialogName]
          ]),
          vue.createElementVNode("view", { class: "dlg-btns" }, [
            vue.createElementVNode("button", {
              class: "dlg-btn ghost",
              type: "default",
              onClick: _cache[2] || (_cache[2] = (...args) => $options.closeDialog && $options.closeDialog(...args))
            }, "取消"),
            vue.createElementVNode("button", {
              class: "dlg-btn primary",
              type: "default",
              onClick: _cache[3] || (_cache[3] = (...args) => $options.submitDialog && $options.submitDialog(...args))
            }, "确定")
          ])
        ])
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesShopCategoryManage = /* @__PURE__ */ _export_sfc(_sfc_main$5, [["render", _sfc_render$4], ["__scopeId", "data-v-669817f8"], ["__file", "E:/固始县外卖商家端/pages/shop/category-manage.vue"]]);
  const _sfc_main$4 = {
    data() {
      return {
        name: "",
        loading: false
      };
    },
    methods: {
      async submit() {
        const name = (this.name || "").trim();
        if (!name) {
          uni.showToast({ title: "请输入分类名称", icon: "none" });
          return;
        }
        this.loading = true;
        try {
          await createCategory({ name, sort: 1 });
          uni.showToast({ title: "已添加", icon: "success" });
          this.name = "";
          setTimeout(() => uni.navigateBack(), 600);
        } catch (e2) {
        } finally {
          this.loading = false;
        }
      }
    }
  };
  function _sfc_render$3(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      vue.createElementVNode("view", { class: "field" }, [
        vue.createElementVNode("text", { class: "label" }, "分类名称"),
        vue.withDirectives(vue.createElementVNode(
          "input",
          {
            class: "input",
            "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $data.name = $event),
            placeholder: "请输入分类名称"
          },
          null,
          512
          /* NEED_PATCH */
        ), [
          [vue.vModelText, $data.name]
        ])
      ]),
      vue.createElementVNode("button", {
        class: "btn",
        type: "primary",
        loading: $data.loading,
        onClick: _cache[1] || (_cache[1] = (...args) => $options.submit && $options.submit(...args))
      }, "提交", 8, ["loading"])
    ]);
  }
  const PagesShopCategoryAdd = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["render", _sfc_render$3], ["__scopeId", "data-v-d1ff5ae2"], ["__file", "E:/固始县外卖商家端/pages/shop/category-add.vue"]]);
  const API_BASE_URL$1 = BASE_URL + "/api";
  const _sfc_main$3 = {
    data() {
      return {
        imageUrls: [],
        categoryList: [],
        categoryIndex: -1,
        merchantCategory: "",
        specGroupName: "",
        specOptions: [],
        form: {
          name: "",
          price: "",
          description: "",
          images: []
        },
        uploading: false,
        submitting: false,
        /** 接口成功后切换为结果态，不再停留在表单页 */
        publishDone: false
      };
    },
    computed: {
      isSupermarket() {
        return this.merchantCategory === "超市";
      }
    },
    onLoad() {
      this.bootstrap();
    },
    methods: {
      async bootstrap() {
        await Promise.all([this.loadCategoryList(), this.loadMerchantCategory()]);
      },
      formatImageUrl(url2) {
        if (!url2)
          return "";
        if (url2.startsWith("http://") || url2.startsWith("https://") || url2.startsWith("data:image") || url2.startsWith("blob:")) {
          return url2;
        }
        return url2.startsWith("/") ? BASE_URL + url2 : BASE_URL + "/" + url2;
      },
      parseUploadResponse(rawData) {
        let parsed = rawData;
        if (typeof rawData === "string") {
          try {
            parsed = JSON.parse(rawData);
          } catch (e2) {
            parsed = null;
          }
        }
        const data = parsed && parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
        const url2 = data && data.url ? data.url : "";
        return url2 ? String(url2) : "";
      },
      normalizeCategoryList(res) {
        const raw = res && typeof res === "object" && res.data !== void 0 ? res.data : res;
        const arr = Array.isArray(raw) ? raw : raw && Array.isArray(raw.list) ? raw.list : raw && Array.isArray(raw.data) ? raw.data : [];
        return arr.map((item) => ({
          id: item.id,
          name: item.name != null ? String(item.name) : ""
        })).filter((item) => item.id != null);
      },
      normalizeMerchantCategory(res) {
        const raw = res && typeof res === "object" && res.data !== void 0 ? res.data : res;
        const merchant = raw && typeof raw === "object" && raw.merchant && typeof raw.merchant === "object" ? raw.merchant : raw;
        return merchant && merchant.category != null ? String(merchant.category).trim() : "";
      },
      async loadCategoryList() {
        try {
          const res = await request({ url: "/merchant/my-categories", method: "GET" });
          this.categoryList = Array.isArray(res) ? res : res.data || [];
          if (this.categoryIndex >= this.categoryList.length) {
            this.categoryIndex = -1;
          }
        } catch (e2) {
          this.categoryList = [];
          this.categoryIndex = -1;
          formatAppLog("error", "at pages/shop/product-publish.vue:165", "拉取分类失败", e2);
        }
      },
      async loadMerchantCategory() {
        try {
          const res = await getShopInfo();
          this.merchantCategory = this.normalizeMerchantCategory(res);
        } catch (e2) {
          this.merchantCategory = "";
        }
      },
      onCategoryChange(e2) {
        this.categoryIndex = Number(e2 && e2.detail && e2.detail.value);
      },
      onSpecOptionInput(index, e2) {
        const value2 = e2 && e2.detail ? String(e2.detail.value || "") : "";
        this.$set ? this.$set(this.specOptions, index, value2) : this.specOptions.splice(index, 1, value2);
      },
      addSpecOption() {
        this.specOptions.push("");
      },
      removeSpecOption(index) {
        this.specOptions.splice(index, 1);
      },
      normalizeSpecOptions() {
        return this.specOptions.map((item) => String(item || "").trim()).filter(Boolean);
      },
      chooseAndUploadImage() {
        if (this.uploading)
          return;
        const token = uni.getStorageSync("token") || "";
        if (!token) {
          uni.showToast({ title: "请先登录后再上传", icon: "none" });
          return;
        }
        uni.chooseImage({
          count: 1,
          success: (chooseRes) => {
            const filePath = chooseRes.tempFilePaths && chooseRes.tempFilePaths[0];
            if (!filePath)
              return;
            this.uploading = true;
            uni.uploadFile({
              url: API_BASE_URL$1 + "/upload/image",
              filePath,
              name: "file",
              header: {
                Authorization: "Bearer " + token
              },
              success: (uploadRes) => {
                const url2 = this.parseUploadResponse(uploadRes.data);
                if (!url2) {
                  uni.showToast({ title: "图片上传失败", icon: "none" });
                  return;
                }
                this.imageUrls = [url2];
                this.form.images = [url2];
                uni.showToast({ title: "上传成功", icon: "success" });
              },
              fail: () => {
                uni.showToast({ title: "图片上传失败", icon: "none" });
              },
              complete: () => {
                this.uploading = false;
              }
            });
          }
        });
      },
      /**
       * 封装层在 HTTP 200 时 resolve(res.data)，等价于 res.statusCode === 200。
       * 若 body 含 code，则按数字比较（兼容字符串 "200"）；无 code 视为成功。
       */
      isPublishSuccess(data) {
        if (data == null || typeof data !== "object")
          return true;
        if (!Object.prototype.hasOwnProperty.call(data, "code"))
          return true;
        const n2 = Number(data.code);
        return n2 === 200 || n2 === 0 || n2 === 201;
      },
      /** 发布成功后离开当前页：优先返回上一页；无栈或 navigateBack 失败则直达商品列表 */
      finishPublishAndLeave() {
        this.submitting = false;
        try {
          uni.hideToast();
        } catch (e2) {
        }
        const listUrl = "/pages/product/list";
        const emitRefresh = () => {
          try {
            uni.$emit("refreshProductList");
          } catch (e2) {
          }
        };
        const goList = () => {
          uni.redirectTo({
            url: listUrl,
            success: emitRefresh,
            fail: () => {
              uni.reLaunch({ url: listUrl, success: emitRefresh });
            }
          });
        };
        try {
          const pages2 = getCurrentPages();
          if (pages2 && pages2.length > 1) {
            uni.navigateBack({
              delta: 1,
              success: emitRefresh,
              fail: goList
            });
          } else {
            goList();
          }
        } catch (e2) {
          goList();
        }
      },
      /** 清空表单，继续录入一条新商品 */
      continuePublish() {
        this.publishDone = false;
        this.form = {
          name: "",
          price: "",
          description: "",
          images: []
        };
        this.specGroupName = "";
        this.specOptions = [];
        this.imageUrls = [];
        this.categoryIndex = -1;
      },
      /** 返回商品列表（不依赖页面栈，保证能离开发布页） */
      backToProductList() {
        this.finishPublishAndLeave();
      },
      async submit() {
        const name = (this.form.name || "").trim();
        const price = Number(this.form.price);
        const description = (this.form.description || "").trim();
        const selectedCategory = this.categoryIndex > -1 ? this.categoryList[this.categoryIndex] : null;
        const categoryId = selectedCategory && selectedCategory.id != null ? selectedCategory.id : "";
        if (!name) {
          uni.showToast({ title: "请填写商品名称", icon: "none" });
          return;
        }
        if (!Number.isFinite(price) || price <= 0) {
          uni.showToast({ title: "请填写有效售价", icon: "none" });
          return;
        }
        if (categoryId === "") {
          uni.showToast({ title: "请选择商品分类", icon: "none" });
          return;
        }
        const spec_group_name = (this.specGroupName || "").trim();
        const spec_options = this.normalizeSpecOptions();
        if (this.isSupermarket) {
          if (spec_group_name && !spec_options.length) {
            uni.showToast({ title: "请至少填写一个规格项", icon: "none" });
            return;
          }
          if (!spec_group_name && spec_options.length) {
            uni.showToast({ title: "请填写规格组名", icon: "none" });
            return;
          }
        }
        const payload = {
          name,
          price,
          category_id: categoryId,
          description,
          images: JSON.stringify(Array.isArray(this.form.images) ? this.form.images : [])
        };
        if (this.isSupermarket) {
          payload.spec_group_name = spec_group_name;
          payload.spec_options = spec_options;
        }
        this.submitting = true;
        try {
          const data = await createMerchantProduct(payload);
          if (!this.isPublishSuccess(data)) {
            uni.showToast({ title: data && (data.message || data.msg) || "发布失败", icon: "none" });
            this.submitting = false;
            return;
          }
          this.submitting = false;
          uni.showToast({
            title: "发布成功",
            icon: "success",
            mask: true
          });
          setTimeout(() => {
            uni.navigateBack({
              delta: 1
            });
          }, 1500);
        } catch (e2) {
          if (this.isPublishSuccess(e2)) {
            this.submitting = false;
            uni.showToast({
              title: "发布成功",
              icon: "success",
              mask: true
            });
            setTimeout(() => {
              uni.navigateBack({
                delta: 1
              });
            }, 1500);
            return;
          }
          this.submitting = false;
          const msg = e2 && e2.data && (e2.data.message || e2.data.msg) || e2 && e2.message || "发布异常，请重试";
          uni.showToast({ title: msg, icon: "none" });
        }
      }
    }
  };
  function _sfc_render$2(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      !$data.publishDone ? (vue.openBlock(), vue.createElementBlock(
        vue.Fragment,
        { key: 0 },
        [
          vue.createElementVNode("view", { class: "card" }, [
            vue.createElementVNode("view", { class: "field" }, [
              vue.createElementVNode("text", { class: "label" }, "商品名称 (name)"),
              vue.withDirectives(vue.createElementVNode(
                "input",
                {
                  class: "input",
                  "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $data.form.name = $event),
                  placeholder: "请输入商品名称"
                },
                null,
                512
                /* NEED_PATCH */
              ), [
                [vue.vModelText, $data.form.name]
              ])
            ]),
            vue.createElementVNode("view", { class: "field" }, [
              vue.createElementVNode("text", { class: "label" }, "商品分类 (category_id) *必填"),
              vue.createElementVNode("picker", {
                range: $data.categoryList,
                "range-key": "name",
                value: $data.categoryIndex,
                onChange: _cache[1] || (_cache[1] = (...args) => $options.onCategoryChange && $options.onCategoryChange(...args))
              }, [
                vue.createElementVNode(
                  "view",
                  { class: "picker-line" },
                  vue.toDisplayString($data.categoryIndex > -1 && $data.categoryList[$data.categoryIndex] ? $data.categoryList[$data.categoryIndex].name : "请选择商品分类"),
                  1
                  /* TEXT */
                )
              ], 40, ["range", "value"])
            ]),
            vue.createElementVNode("view", { class: "field" }, [
              vue.createElementVNode("text", { class: "label" }, "现价 (price) *必填"),
              vue.withDirectives(vue.createElementVNode(
                "input",
                {
                  class: "input",
                  "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => $data.form.price = $event),
                  type: "digit",
                  placeholder: "请输入售价"
                },
                null,
                512
                /* NEED_PATCH */
              ), [
                [vue.vModelText, $data.form.price]
              ])
            ]),
            vue.createElementVNode("view", { class: "field" }, [
              vue.createElementVNode("text", { class: "label" }, "商品描述 (description)"),
              vue.withDirectives(vue.createElementVNode(
                "textarea",
                {
                  class: "textarea",
                  "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => $data.form.description = $event),
                  placeholder: "选填，输入商品描述",
                  maxlength: "2000"
                },
                null,
                512
                /* NEED_PATCH */
              ), [
                [vue.vModelText, $data.form.description]
              ])
            ]),
            $options.isSupermarket ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 0,
              class: "field"
            }, [
              vue.createElementVNode("text", { class: "label" }, "单组规格（超市专属）"),
              vue.withDirectives(vue.createElementVNode(
                "input",
                {
                  class: "input",
                  "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => $data.specGroupName = $event),
                  placeholder: "请输入规格组名，例如：口味"
                },
                null,
                512
                /* NEED_PATCH */
              ), [
                [vue.vModelText, $data.specGroupName]
              ]),
              vue.createElementVNode("view", { class: "spec-options" }, [
                (vue.openBlock(true), vue.createElementBlock(
                  vue.Fragment,
                  null,
                  vue.renderList($data.specOptions, (option, index) => {
                    return vue.openBlock(), vue.createElementBlock("view", {
                      key: "spec-" + index,
                      class: "spec-option-row"
                    }, [
                      vue.createElementVNode("input", {
                        class: "input spec-option-input",
                        value: option,
                        placeholder: "规格项" + (index + 1),
                        onInput: ($event) => $options.onSpecOptionInput(index, $event)
                      }, null, 40, ["value", "placeholder", "onInput"]),
                      vue.createElementVNode("button", {
                        class: "spec-remove-btn",
                        type: "warn",
                        size: "mini",
                        onClick: ($event) => $options.removeSpecOption(index)
                      }, "删除", 8, ["onClick"])
                    ]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ]),
              vue.createElementVNode("button", {
                class: "spec-add-btn",
                type: "default",
                size: "mini",
                onClick: _cache[5] || (_cache[5] = (...args) => $options.addSpecOption && $options.addSpecOption(...args))
              }, "添加规格项"),
              vue.createElementVNode("text", { class: "hint" }, "可不配置；如配置，将提交 `spec_group_name` 和 `spec_options`")
            ])) : vue.createCommentVNode("v-if", true),
            vue.createElementVNode("view", { class: "field" }, [
              vue.createElementVNode("text", { class: "label" }, "商品图片 (images)"),
              vue.createElementVNode("view", {
                class: "upload-area",
                onClick: _cache[6] || (_cache[6] = (...args) => $options.chooseAndUploadImage && $options.chooseAndUploadImage(...args))
              }, [
                $data.imageUrls[0] ? (vue.openBlock(), vue.createElementBlock("image", {
                  key: 0,
                  class: "upload-preview",
                  src: $options.formatImageUrl($data.imageUrls[0]),
                  mode: "aspectFill"
                }, null, 8, ["src"])) : (vue.openBlock(), vue.createElementBlock("text", {
                  key: 1,
                  class: "upload-text"
                }, "点击上传图片"))
              ]),
              vue.createElementVNode("text", { class: "hint" }, "上传后会保存为 JSON 字符串数组，未上传则提交 '[]'")
            ])
          ]),
          vue.createElementVNode("button", {
            class: "btn",
            type: "primary",
            loading: $data.submitting,
            onClick: _cache[7] || (_cache[7] = (...args) => $options.submit && $options.submit(...args))
          }, "发布商品", 8, ["loading"])
        ],
        64
        /* STABLE_FRAGMENT */
      )) : (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "result-wrap"
      }, [
        vue.createElementVNode("view", { class: "result-card" }, [
          vue.createElementVNode("view", { class: "result-icon-wrap" }, [
            vue.createElementVNode("text", { class: "result-icon" }, "✓")
          ]),
          vue.createElementVNode("text", { class: "result-title" }, "发布成功"),
          vue.createElementVNode("text", { class: "result-desc" }, "商品已写入数据库，可继续发布或返回列表"),
          vue.createElementVNode("button", {
            class: "btn-secondary",
            type: "default",
            onClick: _cache[8] || (_cache[8] = (...args) => $options.continuePublish && $options.continuePublish(...args))
          }, "继续发布"),
          vue.createElementVNode("button", {
            class: "btn-primary-line",
            type: "default",
            onClick: _cache[9] || (_cache[9] = (...args) => $options.backToProductList && $options.backToProductList(...args))
          }, "返回商品列表")
        ])
      ]))
    ]);
  }
  const PagesShopProductPublish = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["render", _sfc_render$2], ["__scopeId", "data-v-e8394149"], ["__file", "E:/固始县外卖商家端/pages/shop/product-publish.vue"]]);
  const API_BASE_URL = BASE_URL + "/api";
  const _sfc_main$2 = {
    data() {
      return {
        productId: "",
        categories: [],
        imageList: [],
        merchantCategory: "",
        specGroupName: "",
        specOptions: [],
        uploading: false,
        saving: false,
        deleting: false,
        form: {
          name: "",
          price: "",
          original_price: "",
          category_id: null,
          description: "",
          images: []
        }
      };
    },
    computed: {
      isSupermarket() {
        return this.merchantCategory === "超市";
      },
      pickerIndex() {
        if (!this.categories.length || this.form.category_id == null)
          return 0;
        const i2 = this.categories.findIndex((c2) => String(c2.id) === String(this.form.category_id));
        return i2 >= 0 ? i2 : 0;
      },
      categoryLabel() {
        if (!this.categories.length)
          return "暂无分类，请先新增分类";
        const c2 = this.categories[this.pickerIndex];
        return c2 ? `${c2.name} (id:${c2.id})` : "请选择分类";
      }
    },
    onLoad(options) {
      this.productId = options && options.id ? String(options.id) : "";
      if (!this.productId) {
        uni.showToast({ title: "商品ID无效", icon: "none" });
        setTimeout(() => uni.navigateBack(), 600);
        return;
      }
      uni.setNavigationBarTitle({ title: "编辑商品" });
      this.bootstrap();
    },
    methods: {
      formatImageUrl(url2) {
        if (!url2)
          return "";
        if (url2.startsWith("http://") || url2.startsWith("https://") || url2.startsWith("data:image") || url2.startsWith("blob:")) {
          return url2;
        }
        return url2.startsWith("/") ? BASE_URL + url2 : BASE_URL + "/" + url2;
      },
      async bootstrap() {
        await Promise.all([this.loadCategories(), this.loadProductDetail(), this.loadMerchantCategory()]);
        if (this.categories.length && this.form.category_id == null) {
          this.form.category_id = this.categories[0].id;
        }
      },
      normalizeCategoryList(res) {
        const arr = res && res.data && Array.isArray(res.data.data) && res.data.data || res && Array.isArray(res.data) && res.data || res && Array.isArray(res) && res || [];
        return arr.map((c2) => ({
          id: c2.id,
          name: c2.name != null ? String(c2.name) : ""
        })).filter((c2) => c2.id != null);
      },
      normalizeMerchantCategory(res) {
        const raw = res && typeof res === "object" && res.data !== void 0 ? res.data : res;
        const merchant = raw && typeof raw === "object" && raw.merchant && typeof raw.merchant === "object" ? raw.merchant : raw;
        return merchant && merchant.category != null ? String(merchant.category).trim() : "";
      },
      parseImageList(rawImages) {
        if (Array.isArray(rawImages)) {
          return rawImages.filter((u2) => typeof u2 === "string" && u2);
        }
        if (typeof rawImages !== "string" || !rawImages.trim())
          return [];
        try {
          const parsed = JSON.parse(rawImages);
          return Array.isArray(parsed) ? parsed.filter((u2) => typeof u2 === "string" && u2) : [];
        } catch (e2) {
          return [];
        }
      },
      parseUploadResponse(rawData) {
        let parsed = rawData;
        if (typeof rawData === "string") {
          try {
            parsed = JSON.parse(rawData);
          } catch (e2) {
            parsed = null;
          }
        }
        const data = parsed && parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
        return data && data.url ? String(data.url) : "";
      },
      parseSpecOptions(rawOptions) {
        if (Array.isArray(rawOptions)) {
          return rawOptions.map((item) => String(item || "").trim()).filter(Boolean);
        }
        if (typeof rawOptions !== "string" || !rawOptions.trim())
          return [];
        try {
          const parsed = JSON.parse(rawOptions);
          return Array.isArray(parsed) ? parsed.map((item) => String(item || "").trim()).filter(Boolean) : [];
        } catch (e2) {
          return rawOptions.split(",").map((item) => String(item || "").trim()).filter(Boolean);
        }
      },
      async loadCategories() {
        try {
          const res = await request({ url: "/merchant/my-categories", method: "GET" });
          this.categories = this.normalizeCategoryList(res);
        } catch (e2) {
          this.categories = [];
        }
      },
      async loadMerchantCategory() {
        try {
          const res = await getShopInfo();
          this.merchantCategory = this.normalizeMerchantCategory(res);
        } catch (e2) {
          this.merchantCategory = "";
        }
      },
      async loadProductDetail() {
        try {
          const res = await request({
            url: "/merchant/product/" + this.productId,
            method: "GET"
          });
          const raw = res && typeof res === "object" && res.data !== void 0 ? res.data : res;
          const p2 = raw && typeof raw === "object" ? raw : {};
          this.form = {
            name: p2.name != null ? String(p2.name) : "",
            price: p2.price != null ? String(p2.price) : "",
            original_price: p2.original_price != null ? String(p2.original_price) : "",
            category_id: p2.category_id != null ? p2.category_id : null,
            description: p2.description != null ? String(p2.description) : "",
            images: this.parseImageList(p2.images)
          };
          this.imageList = Array.isArray(this.form.images) ? [...this.form.images] : [];
          this.specGroupName = p2.spec_group_name != null ? String(p2.spec_group_name).trim() : "";
          this.specOptions = this.parseSpecOptions(p2.spec_options);
        } catch (e2) {
          uni.showToast({ title: "加载商品失败", icon: "none" });
        }
      },
      onSpecOptionInput(index, e2) {
        const value2 = e2 && e2.detail ? String(e2.detail.value || "") : "";
        this.$set ? this.$set(this.specOptions, index, value2) : this.specOptions.splice(index, 1, value2);
      },
      addSpecOption() {
        this.specOptions.push("");
      },
      removeSpecOption(index) {
        this.specOptions.splice(index, 1);
      },
      normalizeSpecOptions() {
        return this.specOptions.map((item) => String(item || "").trim()).filter(Boolean);
      },
      onCategoryPick(e2) {
        const index = Number(e2.detail.value);
        const c2 = this.categories[index];
        this.form.category_id = c2 ? c2.id : null;
      },
      removeImage(index) {
        this.imageList.splice(index, 1);
        this.form.images = [...this.imageList];
      },
      chooseAndUploadImage(replaceIndex = -1) {
        if (this.uploading)
          return;
        const token = uni.getStorageSync("token") || "";
        if (!token) {
          uni.showToast({ title: "请先登录", icon: "none" });
          return;
        }
        uni.chooseImage({
          count: 9,
          success: async (chooseRes) => {
            const files = (chooseRes.tempFilePaths || []).filter(Boolean);
            if (!files.length)
              return;
            this.uploading = true;
            try {
              for (const filePath of files) {
                const url2 = await this.uploadSingle(filePath, token);
                if (!url2)
                  continue;
                if (replaceIndex > -1) {
                  this.imageList.splice(replaceIndex, 1, url2);
                  replaceIndex = -1;
                } else {
                  this.imageList.push(url2);
                }
              }
              this.form.images = [...this.imageList];
              uni.showToast({ title: "上传成功", icon: "success" });
            } catch (e2) {
              uni.showToast({ title: "上传失败", icon: "none" });
            } finally {
              this.uploading = false;
            }
          }
        });
      },
      uploadSingle(filePath, token) {
        return new Promise((resolve, reject) => {
          uni.uploadFile({
            url: API_BASE_URL + "/upload/image",
            filePath,
            name: "file",
            header: {
              Authorization: "Bearer " + token
            },
            success: (uploadRes) => {
              const url2 = this.parseUploadResponse(uploadRes.data);
              if (!url2) {
                reject(new Error("no url"));
                return;
              }
              resolve(url2);
            },
            fail: reject
          });
        });
      },
      buildPayload() {
        const name = (this.form.name || "").trim();
        const price = Number(this.form.price);
        const originalPriceText = String(this.form.original_price || "").trim();
        const originalPrice = originalPriceText === "" ? null : Number(originalPriceText);
        const category_id = Number(this.form.category_id);
        const description = (this.form.description || "").trim();
        return {
          name,
          price,
          original_price: originalPriceText === "" ? null : originalPrice,
          category_id,
          description,
          images: JSON.stringify(Array.isArray(this.form.images) ? this.form.images : [])
        };
      },
      async saveProduct() {
        const payload = this.buildPayload();
        const spec_group_name = (this.specGroupName || "").trim();
        const spec_options = this.normalizeSpecOptions();
        if (!payload.name) {
          uni.showToast({ title: "请填写商品名称", icon: "none" });
          return;
        }
        if (!Number.isFinite(payload.price) || payload.price <= 0) {
          uni.showToast({ title: "请填写有效售价", icon: "none" });
          return;
        }
        if (payload.original_price != null && (!Number.isFinite(payload.original_price) || payload.original_price < 0)) {
          uni.showToast({ title: "原价格式不正确", icon: "none" });
          return;
        }
        if (!Number.isFinite(payload.category_id) || payload.category_id < 1) {
          uni.showToast({ title: "请选择分类", icon: "none" });
          return;
        }
        if (this.isSupermarket) {
          if (spec_group_name && !spec_options.length) {
            uni.showToast({ title: "请至少填写一个规格项", icon: "none" });
            return;
          }
          if (!spec_group_name && spec_options.length) {
            uni.showToast({ title: "请填写规格组名", icon: "none" });
            return;
          }
          payload.spec_group_name = spec_group_name;
          payload.spec_options = spec_options;
        }
        this.saving = true;
        try {
          await request({
            url: "/merchant/product/" + this.productId,
            method: "PUT",
            data: payload
          });
          uni.showToast({ title: "保存成功", icon: "success" });
          setTimeout(() => uni.navigateBack(), 600);
        } finally {
          this.saving = false;
        }
      },
      deleteProduct() {
        uni.showModal({
          title: "删除商品",
          content: "确定要删除该商品吗？",
          success: async (res) => {
            if (!res.confirm)
              return;
            this.deleting = true;
            try {
              await request({
                url: "/merchant/product/" + this.productId,
                method: "DELETE"
              });
              uni.showToast({ title: "删除成功", icon: "success" });
              setTimeout(() => uni.navigateBack(), 600);
            } finally {
              this.deleting = false;
            }
          }
        });
      }
    }
  };
  function _sfc_render$1(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("view", { class: "field" }, [
          vue.createElementVNode("text", { class: "label" }, "商品名称 (name)"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "input",
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $data.form.name = $event),
              placeholder: "请输入商品名称"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.name]
          ])
        ]),
        vue.createElementVNode("view", { class: "field" }, [
          vue.createElementVNode("text", { class: "label" }, "现价 (price)"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "input",
              "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => $data.form.price = $event),
              type: "digit",
              placeholder: "请输入售价"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.price]
          ])
        ]),
        vue.createElementVNode("view", { class: "field" }, [
          vue.createElementVNode("text", { class: "label" }, "原价 (original_price)"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "input",
              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => $data.form.original_price = $event),
              type: "digit",
              placeholder: "选填，原价用于划线价展示"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.original_price]
          ])
        ]),
        vue.createElementVNode("view", { class: "field" }, [
          vue.createElementVNode("text", { class: "label" }, "分类 (category_id)"),
          vue.createElementVNode("picker", {
            mode: "selector",
            range: $data.categories,
            "range-key": "name",
            value: $options.pickerIndex,
            onChange: _cache[3] || (_cache[3] = (...args) => $options.onCategoryPick && $options.onCategoryPick(...args))
          }, [
            vue.createElementVNode(
              "view",
              { class: "picker-line" },
              vue.toDisplayString($options.categoryLabel),
              1
              /* TEXT */
            )
          ], 40, ["range", "value"])
        ]),
        vue.createElementVNode("view", { class: "field" }, [
          vue.createElementVNode("text", { class: "label" }, "商品描述 (description)"),
          vue.withDirectives(vue.createElementVNode(
            "textarea",
            {
              class: "textarea",
              "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => $data.form.description = $event),
              placeholder: "选填，输入商品描述",
              maxlength: "2000"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.description]
          ])
        ]),
        $options.isSupermarket ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "field"
        }, [
          vue.createElementVNode("text", { class: "label" }, "单组规格（超市专属）"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "input",
              "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => $data.specGroupName = $event),
              placeholder: "请输入规格组名，例如：口味"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.specGroupName]
          ]),
          vue.createElementVNode("view", { class: "spec-options" }, [
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($data.specOptions, (option, index) => {
                return vue.openBlock(), vue.createElementBlock("view", {
                  key: "spec-" + index,
                  class: "spec-option-row"
                }, [
                  vue.createElementVNode("input", {
                    class: "input spec-option-input",
                    value: option,
                    placeholder: "规格项" + (index + 1),
                    onInput: ($event) => $options.onSpecOptionInput(index, $event)
                  }, null, 40, ["value", "placeholder", "onInput"]),
                  vue.createElementVNode("button", {
                    class: "spec-remove-btn",
                    type: "warn",
                    size: "mini",
                    onClick: ($event) => $options.removeSpecOption(index)
                  }, "删除", 8, ["onClick"])
                ]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ]),
          vue.createElementVNode("button", {
            class: "spec-add-btn",
            type: "default",
            size: "mini",
            onClick: _cache[6] || (_cache[6] = (...args) => $options.addSpecOption && $options.addSpecOption(...args))
          }, "添加规格项"),
          vue.createElementVNode("text", { class: "hint" }, "可不配置；如配置，将提交 `spec_group_name` 和 `spec_options`")
        ])) : vue.createCommentVNode("v-if", true),
        vue.createElementVNode("view", { class: "field" }, [
          vue.createElementVNode("text", { class: "label" }, "商品图片 (images)"),
          vue.createElementVNode("view", { class: "upload-list" }, [
            vue.createElementVNode("view", {
              class: "upload-item add",
              onClick: _cache[7] || (_cache[7] = (...args) => $options.chooseAndUploadImage && $options.chooseAndUploadImage(...args))
            }, [
              vue.createElementVNode(
                "text",
                { class: "add-text" },
                vue.toDisplayString($data.uploading ? "上传中..." : "+ 上传图片"),
                1
                /* TEXT */
              )
            ]),
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($data.imageList, (url2, i2) => {
                return vue.openBlock(), vue.createElementBlock("view", {
                  key: url2 + i2,
                  class: "upload-item preview",
                  onClick: ($event) => $options.chooseAndUploadImage(i2)
                }, [
                  vue.createElementVNode("image", {
                    class: "preview-img",
                    src: $options.formatImageUrl(url2),
                    mode: "aspectFill"
                  }, null, 8, ["src"]),
                  vue.createElementVNode("view", {
                    class: "remove",
                    onClick: vue.withModifiers(($event) => $options.removeImage(i2), ["stop"])
                  }, "×", 8, ["onClick"])
                ], 8, ["onClick"]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ])
        ])
      ]),
      vue.createElementVNode("button", {
        class: "btn-save",
        type: "primary",
        loading: $data.saving,
        onClick: _cache[8] || (_cache[8] = (...args) => $options.saveProduct && $options.saveProduct(...args))
      }, "保存商品", 8, ["loading"]),
      vue.createElementVNode("button", {
        class: "btn-delete",
        type: "default",
        loading: $data.deleting,
        onClick: _cache[9] || (_cache[9] = (...args) => $options.deleteProduct && $options.deleteProduct(...args))
      }, "删除商品", 8, ["loading"])
    ]);
  }
  const PagesShopFoodEdit = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["render", _sfc_render$1], ["__scopeId", "data-v-33502258"], ["__file", "E:/固始县外卖商家端/pages/shop/food-edit.vue"]]);
  function getOrderList(params = {}) {
    return request({ url: "/order/my", method: "GET", data: params });
  }
  function acceptOrder(orderId, data = {}) {
    return request({ url: "/order/accept", method: "POST", data: { order_id: orderId, ...data } });
  }
  const _sfc_main$1 = {
    data() {
      return {
        currentTab: 0,
        allOrders: [],
        tabs: [
          { label: "待接单", status: "待接单", count: 0, emptyText: "暂无待接订单" },
          { label: "备餐中", status: "备餐中", count: 0, emptyText: "暂无备餐订单" },
          { label: "配送中", status: "配送中", count: 0, emptyText: "暂无配送订单" },
          { label: "已完成", status: "已完成", count: 0, emptyText: "暂无已完成订单" },
          { label: "全部", status: "", count: 0, emptyText: "暂无订单" }
        ],
        _newOrderHandler: null
      };
    },
    computed: {
      currentList() {
        const status = this.tabs[this.currentTab].status;
        if (!status)
          return this.allOrders;
        return this.allOrders.filter((o2) => o2.状态 === status);
      }
    },
    onLoad() {
      const token = getToken();
      const userInfo = getUser();
      const userId = (userInfo == null ? void 0 : userInfo.id) || (userInfo == null ? void 0 : userInfo.userId) || "";
      if (token && !getSocket()) {
        initSocket(token, userId);
      }
      this._newOrderHandler = (data) => {
        formatAppLog("log", "at pages/shop/orders.vue:104", "收到新订单推送：", data);
        this.loadOrders();
      };
      onNewOrder(this._newOrderHandler);
    },
    onUnload() {
      if (this._newOrderHandler) {
        offNewOrder(this._newOrderHandler);
        this._newOrderHandler = null;
      }
    },
    onShow() {
      this.loadOrders();
    },
    methods: {
      async loadOrders() {
        var _a, _b;
        try {
          const res = await getOrderList();
          this.allOrders = ((_a = res == null ? void 0 : res.data) == null ? void 0 : _a.订单列表) || ((_b = res == null ? void 0 : res.data) == null ? void 0 : _b.data) || (res == null ? void 0 : res.订单列表) || (res == null ? void 0 : res.data) || [];
          this.tabs[0].count = this.allOrders.filter((o2) => o2.状态 === "待接单").length;
          this.tabs[1].count = this.allOrders.filter((o2) => o2.状态 === "备餐中").length;
          this.tabs[2].count = this.allOrders.filter((o2) => o2.状态 === "配送中").length;
          this.tabs[3].count = this.allOrders.filter((o2) => o2.状态 === "已完成").length;
          this.tabs[4].count = this.allOrders.length;
        } catch (e2) {
        }
      },
      switchTab(index) {
        this.currentTab = index;
      },
      statusClass(status) {
        return ORDER_STATUS_CLASS[status] || "";
      },
      async handleAccept(orderId) {
        uni.showModal({
          title: "确认接单",
          content: "接单后请尽快备餐",
          success: async (res) => {
            if (res.confirm) {
              try {
                await acceptOrder(orderId, {
                  merchant_lng: 115.681123,
                  merchant_lat: 32.181234,
                  shop_id: 1
                  // 临时写死 shop_id
                });
                uni.showToast({ title: "已接单", icon: "success" });
                this.loadOrders();
              } catch (e2) {
              }
            }
          }
        });
      }
    }
  };
  function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "tab-bar" }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($data.tabs, (tab, index) => {
            return vue.openBlock(), vue.createElementBlock("text", {
              key: index,
              class: vue.normalizeClass(["tab-item", $data.currentTab === index && "tab-active"]),
              onClick: ($event) => $options.switchTab(index)
            }, [
              vue.createTextVNode(
                vue.toDisplayString(tab.label) + " ",
                1
                /* TEXT */
              ),
              tab.count > 0 ? (vue.openBlock(), vue.createElementBlock(
                "text",
                {
                  key: 0,
                  class: "tab-badge"
                },
                vue.toDisplayString(tab.count),
                1
                /* TEXT */
              )) : vue.createCommentVNode("v-if", true)
            ], 10, ["onClick"]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ]),
      $options.currentList.length > 0 ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "order-list"
      }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($options.currentList, (order) => {
            return vue.openBlock(), vue.createElementBlock("view", {
              class: "order-card",
              key: order.订单ID
            }, [
              vue.createElementVNode("view", { class: "order-header" }, [
                vue.createElementVNode(
                  "text",
                  { class: "order-id" },
                  vue.toDisplayString(order.订单ID),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode(
                  "text",
                  {
                    class: vue.normalizeClass(["order-status", $options.statusClass(order.状态)])
                  },
                  vue.toDisplayString(order.状态),
                  3
                  /* TEXT, CLASS */
                )
              ]),
              vue.createElementVNode("view", { class: "order-user" }, [
                vue.createElementVNode("text", { class: "user-icon" }, "👤"),
                vue.createElementVNode(
                  "text",
                  { class: "user-name" },
                  vue.toDisplayString(order.用户昵称 || "用户"),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode(
                  "text",
                  { class: "user-phone" },
                  vue.toDisplayString(order.联系电话),
                  1
                  /* TEXT */
                )
              ]),
              vue.createElementVNode("view", { class: "order-foods" }, [
                (vue.openBlock(true), vue.createElementBlock(
                  vue.Fragment,
                  null,
                  vue.renderList(order.商品列表, (food, i2) => {
                    return vue.openBlock(), vue.createElementBlock("view", {
                      class: "food-row",
                      key: i2
                    }, [
                      vue.createElementVNode(
                        "text",
                        { class: "food-name" },
                        vue.toDisplayString(food.商品名称) + " x" + vue.toDisplayString(food.数量),
                        1
                        /* TEXT */
                      ),
                      vue.createElementVNode(
                        "text",
                        { class: "food-price" },
                        "¥" + vue.toDisplayString((food.价格 * food.数量).toFixed(2)),
                        1
                        /* TEXT */
                      )
                    ]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ]),
              order.收货地址 ? (vue.openBlock(), vue.createElementBlock("view", {
                key: 0,
                class: "order-addr"
              }, [
                vue.createElementVNode("text", { class: "addr-icon" }, "📍"),
                vue.createElementVNode(
                  "text",
                  { class: "addr-text" },
                  vue.toDisplayString(order.收货地址),
                  1
                  /* TEXT */
                )
              ])) : vue.createCommentVNode("v-if", true),
              order.备注 ? (vue.openBlock(), vue.createElementBlock("view", {
                key: 1,
                class: "order-remark"
              }, [
                vue.createElementVNode("text", { class: "remark-icon" }, "📝"),
                vue.createElementVNode(
                  "text",
                  { class: "remark-text" },
                  vue.toDisplayString(order.备注),
                  1
                  /* TEXT */
                )
              ])) : vue.createCommentVNode("v-if", true),
              vue.createElementVNode("view", { class: "order-footer" }, [
                vue.createElementVNode(
                  "text",
                  { class: "order-time" },
                  vue.toDisplayString(order.创建时间),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode("view", { class: "order-footer-right" }, [
                  vue.createElementVNode(
                    "text",
                    { class: "order-total" },
                    "¥" + vue.toDisplayString(order.总价),
                    1
                    /* TEXT */
                  ),
                  order.状态 === "待接单" ? (vue.openBlock(), vue.createElementBlock("view", {
                    key: 0,
                    class: "action-btn",
                    onClick: ($event) => $options.handleAccept(order.订单ID)
                  }, [
                    vue.createElementVNode("text", { class: "action-btn-text" }, "立即接单")
                  ], 8, ["onClick"])) : vue.createCommentVNode("v-if", true),
                  order.状态 === "备餐中" ? (vue.openBlock(), vue.createElementBlock("view", {
                    key: 1,
                    class: "action-btn cooking-btn"
                  }, [
                    vue.createElementVNode("text", { class: "action-btn-text" }, "备餐中...")
                  ])) : vue.createCommentVNode("v-if", true)
                ])
              ])
            ]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ])) : (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "empty"
      }, [
        vue.createElementVNode("text", { class: "empty-icon" }, "📋"),
        vue.createElementVNode(
          "text",
          { class: "empty-text" },
          vue.toDisplayString($data.tabs[$data.currentTab].emptyText),
          1
          /* TEXT */
        )
      ]))
    ]);
  }
  const PagesShopOrders = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["render", _sfc_render], ["__scopeId", "data-v-01c150c3"], ["__file", "E:/固始县外卖商家端/pages/shop/orders.vue"]]);
  __definePage("pages/index/index", PagesIndexIndex);
  __definePage("pages/order/list", PagesOrderList);
  __definePage("pages/order/detail", PagesOrderDetail);
  __definePage("pages/order/self-delivery-nav", PagesOrderSelfDeliveryNav);
  __definePage("pages/mine/index", PagesMineIndex);
  __definePage("pages/login/index", PagesLoginIndex);
  __definePage("pages/product/list", PagesProductList);
  __definePage("pages/finance/index", PagesFinanceIndex);
  __definePage("pages/stats/index", PagesStatsIndex);
  __definePage("pages/review/list", PagesReviewList);
  __definePage("pages/shop/index", PagesShopIndex);
  __definePage("pages/shop/shop-apply", PagesShopShopApply);
  __definePage("pages/shop/tianditu-picker", PagesShopTiandituPicker);
  __definePage("pages/shop/food-list", PagesShopFoodList);
  __definePage("pages/shop/category-manage", PagesShopCategoryManage);
  __definePage("pages/shop/category-add", PagesShopCategoryAdd);
  __definePage("pages/shop/product-publish", PagesShopProductPublish);
  __definePage("pages/shop/food-edit", PagesShopFoodEdit);
  __definePage("pages/shop/orders", PagesShopOrders);
  const _sfc_main = {
    onLaunch() {
      formatAppLog("log", "at App.vue:7", "App Launch");
      if (!hasValidMerchantSession()) {
        clearAuth();
        uni.reLaunch({ url: "/pages/login/index" });
        return;
      }
      const token = getToken();
      const userInfo = getUser();
      const userId = getUserId(userInfo);
      if (token && userId) {
        initSocket(token, userId);
      }
    },
    onShow() {
      formatAppLog("log", "at App.vue:22", "App Show");
    },
    onHide() {
      formatAppLog("log", "at App.vue:25", "App Hide");
    }
  };
  const App = /* @__PURE__ */ _export_sfc(_sfc_main, [["__file", "E:/固始县外卖商家端/App.vue"]]);
  const pinia = createPinia();
  const pages = [
    {
      path: "pages/index/index",
      style: {
        navigationBarTitleText: "商家工作台",
        navigationBarBackgroundColor: "#FF6B35"
      }
    },
    {
      path: "pages/order/list",
      style: {
        navigationBarTitleText: "订单管理",
        enablePullDownRefresh: true,
        backgroundTextStyle: "dark"
      }
    },
    {
      path: "pages/order/detail",
      style: {
        navigationBarTitleText: "订单详情"
      }
    },
    {
      path: "pages/order/self-delivery-nav",
      style: {
        navigationBarTitleText: "配送导航",
        navigationBarBackgroundColor: "#FF6B35"
      }
    },
    {
      path: "pages/mine/index",
      style: {
        navigationBarTitleText: "我的"
      }
    },
    {
      path: "pages/login/index",
      style: {
        navigationBarTitleText: "商家登录",
        navigationBarBackgroundColor: "#FF6B35"
      }
    },
    {
      path: "pages/product/list",
      style: {
        navigationBarTitleText: "商品管理",
        enablePullDownRefresh: true
      }
    },
    {
      path: "pages/finance/index",
      style: {
        navigationBarTitleText: "财务管理"
      }
    },
    {
      path: "pages/stats/index",
      style: {
        navigationBarTitleText: "数据统计"
      }
    },
    {
      path: "pages/review/list",
      style: {
        navigationBarTitleText: "顾客评价"
      }
    },
    {
      path: "pages/shop/index",
      style: {
        navigationBarTitleText: "店铺设置"
      }
    },
    {
      path: "pages/shop/shop-apply",
      style: {
        navigationBarTitleText: "申请开店"
      }
    },
    {
      path: "pages/shop/tianditu-picker",
      style: {
        navigationBarTitleText: "选择店铺位置",
        navigationBarBackgroundColor: "#FF6B35"
      }
    },
    {
      path: "pages/shop/food-list",
      style: {
        navigationBarTitleText: "商品管理",
        enablePullDownRefresh: true
      }
    },
    {
      path: "pages/shop/category-manage",
      style: {
        navigationBarTitleText: "商品分类",
        enablePullDownRefresh: true
      }
    },
    {
      path: "pages/shop/category-add",
      style: {
        navigationBarTitleText: "添加分类"
      }
    },
    {
      path: "pages/shop/product-publish",
      style: {
        navigationBarTitleText: "发布商品"
      }
    },
    {
      path: "pages/shop/food-edit",
      style: {
        navigationBarTitleText: "编辑商品"
      }
    },
    {
      path: "pages/shop/orders",
      style: {
        navigationBarTitleText: "订单管理"
      }
    }
  ];
  const globalStyle = {
    navigationBarTitleText: "固始县外卖跑腿",
    navigationBarTextStyle: "white",
    navigationBarBackgroundColor: "#FF6B35",
    backgroundColor: "#F5F5F5"
  };
  const tabBar = {
    color: "#999999",
    selectedColor: "#FF6B35",
    borderStyle: "black",
    backgroundColor: "#ffffff",
    list: [
      {
        pagePath: "pages/index/index",
        iconPath: "static/tabbar/home.png",
        selectedIconPath: "static/tabbar/home-active.png",
        text: "首页"
      },
      {
        pagePath: "pages/order/list",
        iconPath: "static/tabbar/order.png",
        selectedIconPath: "static/tabbar/order-active.png",
        text: "订单"
      },
      {
        pagePath: "pages/mine/index",
        iconPath: "static/tabbar/mine.png",
        selectedIconPath: "static/tabbar/mine-active.png",
        text: "我的"
      }
    ]
  };
  const e = {
    pages,
    globalStyle,
    tabBar
  };
  var define_process_env_UNI_SECURE_NETWORK_CONFIG_default = [];
  function t(e2) {
    return e2 && e2.__esModule && Object.prototype.hasOwnProperty.call(e2, "default") ? e2.default : e2;
  }
  function n(e2, t2, n2) {
    return e2(n2 = { path: t2, exports: {}, require: function(e3, t3) {
      return function() {
        throw new Error("Dynamic requires are not currently supported by @rollup/plugin-commonjs");
      }(null == t3 && n2.path);
    } }, n2.exports), n2.exports;
  }
  var s = n(function(e2, t2) {
    var n2;
    e2.exports = (n2 = n2 || function(e3, t3) {
      var n3 = Object.create || /* @__PURE__ */ function() {
        function e4() {
        }
        return function(t4) {
          var n4;
          return e4.prototype = t4, n4 = new e4(), e4.prototype = null, n4;
        };
      }(), s2 = {}, r2 = s2.lib = {}, i2 = r2.Base = { extend: function(e4) {
        var t4 = n3(this);
        return e4 && t4.mixIn(e4), t4.hasOwnProperty("init") && this.init !== t4.init || (t4.init = function() {
          t4.$super.init.apply(this, arguments);
        }), t4.init.prototype = t4, t4.$super = this, t4;
      }, create: function() {
        var e4 = this.extend();
        return e4.init.apply(e4, arguments), e4;
      }, init: function() {
      }, mixIn: function(e4) {
        for (var t4 in e4)
          e4.hasOwnProperty(t4) && (this[t4] = e4[t4]);
        e4.hasOwnProperty("toString") && (this.toString = e4.toString);
      }, clone: function() {
        return this.init.prototype.extend(this);
      } }, o2 = r2.WordArray = i2.extend({ init: function(e4, n4) {
        e4 = this.words = e4 || [], this.sigBytes = n4 != t3 ? n4 : 4 * e4.length;
      }, toString: function(e4) {
        return (e4 || c2).stringify(this);
      }, concat: function(e4) {
        var t4 = this.words, n4 = e4.words, s3 = this.sigBytes, r3 = e4.sigBytes;
        if (this.clamp(), s3 % 4)
          for (var i3 = 0; i3 < r3; i3++) {
            var o3 = n4[i3 >>> 2] >>> 24 - i3 % 4 * 8 & 255;
            t4[s3 + i3 >>> 2] |= o3 << 24 - (s3 + i3) % 4 * 8;
          }
        else
          for (i3 = 0; i3 < r3; i3 += 4)
            t4[s3 + i3 >>> 2] = n4[i3 >>> 2];
        return this.sigBytes += r3, this;
      }, clamp: function() {
        var t4 = this.words, n4 = this.sigBytes;
        t4[n4 >>> 2] &= 4294967295 << 32 - n4 % 4 * 8, t4.length = e3.ceil(n4 / 4);
      }, clone: function() {
        var e4 = i2.clone.call(this);
        return e4.words = this.words.slice(0), e4;
      }, random: function(t4) {
        for (var n4, s3 = [], r3 = function(t5) {
          t5 = t5;
          var n5 = 987654321, s4 = 4294967295;
          return function() {
            var r4 = ((n5 = 36969 * (65535 & n5) + (n5 >> 16) & s4) << 16) + (t5 = 18e3 * (65535 & t5) + (t5 >> 16) & s4) & s4;
            return r4 /= 4294967296, (r4 += 0.5) * (e3.random() > 0.5 ? 1 : -1);
          };
        }, i3 = 0; i3 < t4; i3 += 4) {
          var a3 = r3(4294967296 * (n4 || e3.random()));
          n4 = 987654071 * a3(), s3.push(4294967296 * a3() | 0);
        }
        return new o2.init(s3, t4);
      } }), a2 = s2.enc = {}, c2 = a2.Hex = { stringify: function(e4) {
        for (var t4 = e4.words, n4 = e4.sigBytes, s3 = [], r3 = 0; r3 < n4; r3++) {
          var i3 = t4[r3 >>> 2] >>> 24 - r3 % 4 * 8 & 255;
          s3.push((i3 >>> 4).toString(16)), s3.push((15 & i3).toString(16));
        }
        return s3.join("");
      }, parse: function(e4) {
        for (var t4 = e4.length, n4 = [], s3 = 0; s3 < t4; s3 += 2)
          n4[s3 >>> 3] |= parseInt(e4.substr(s3, 2), 16) << 24 - s3 % 8 * 4;
        return new o2.init(n4, t4 / 2);
      } }, u2 = a2.Latin1 = { stringify: function(e4) {
        for (var t4 = e4.words, n4 = e4.sigBytes, s3 = [], r3 = 0; r3 < n4; r3++) {
          var i3 = t4[r3 >>> 2] >>> 24 - r3 % 4 * 8 & 255;
          s3.push(String.fromCharCode(i3));
        }
        return s3.join("");
      }, parse: function(e4) {
        for (var t4 = e4.length, n4 = [], s3 = 0; s3 < t4; s3++)
          n4[s3 >>> 2] |= (255 & e4.charCodeAt(s3)) << 24 - s3 % 4 * 8;
        return new o2.init(n4, t4);
      } }, l2 = a2.Utf8 = { stringify: function(e4) {
        try {
          return decodeURIComponent(escape(u2.stringify(e4)));
        } catch (e5) {
          throw new Error("Malformed UTF-8 data");
        }
      }, parse: function(e4) {
        return u2.parse(unescape(encodeURIComponent(e4)));
      } }, h2 = r2.BufferedBlockAlgorithm = i2.extend({ reset: function() {
        this._data = new o2.init(), this._nDataBytes = 0;
      }, _append: function(e4) {
        "string" == typeof e4 && (e4 = l2.parse(e4)), this._data.concat(e4), this._nDataBytes += e4.sigBytes;
      }, _process: function(t4) {
        var n4 = this._data, s3 = n4.words, r3 = n4.sigBytes, i3 = this.blockSize, a3 = r3 / (4 * i3), c3 = (a3 = t4 ? e3.ceil(a3) : e3.max((0 | a3) - this._minBufferSize, 0)) * i3, u3 = e3.min(4 * c3, r3);
        if (c3) {
          for (var l3 = 0; l3 < c3; l3 += i3)
            this._doProcessBlock(s3, l3);
          var h3 = s3.splice(0, c3);
          n4.sigBytes -= u3;
        }
        return new o2.init(h3, u3);
      }, clone: function() {
        var e4 = i2.clone.call(this);
        return e4._data = this._data.clone(), e4;
      }, _minBufferSize: 0 });
      r2.Hasher = h2.extend({ cfg: i2.extend(), init: function(e4) {
        this.cfg = this.cfg.extend(e4), this.reset();
      }, reset: function() {
        h2.reset.call(this), this._doReset();
      }, update: function(e4) {
        return this._append(e4), this._process(), this;
      }, finalize: function(e4) {
        return e4 && this._append(e4), this._doFinalize();
      }, blockSize: 16, _createHelper: function(e4) {
        return function(t4, n4) {
          return new e4.init(n4).finalize(t4);
        };
      }, _createHmacHelper: function(e4) {
        return function(t4, n4) {
          return new d2.HMAC.init(e4, n4).finalize(t4);
        };
      } });
      var d2 = s2.algo = {};
      return s2;
    }(Math), n2);
  }), r = s, i = (n(function(e2, t2) {
    var n2;
    e2.exports = (n2 = r, function(e3) {
      var t3 = n2, s2 = t3.lib, r2 = s2.WordArray, i2 = s2.Hasher, o2 = t3.algo, a2 = [];
      !function() {
        for (var t4 = 0; t4 < 64; t4++)
          a2[t4] = 4294967296 * e3.abs(e3.sin(t4 + 1)) | 0;
      }();
      var c2 = o2.MD5 = i2.extend({ _doReset: function() {
        this._hash = new r2.init([1732584193, 4023233417, 2562383102, 271733878]);
      }, _doProcessBlock: function(e4, t4) {
        for (var n3 = 0; n3 < 16; n3++) {
          var s3 = t4 + n3, r3 = e4[s3];
          e4[s3] = 16711935 & (r3 << 8 | r3 >>> 24) | 4278255360 & (r3 << 24 | r3 >>> 8);
        }
        var i3 = this._hash.words, o3 = e4[t4 + 0], c3 = e4[t4 + 1], p2 = e4[t4 + 2], f2 = e4[t4 + 3], g2 = e4[t4 + 4], m2 = e4[t4 + 5], y2 = e4[t4 + 6], _2 = e4[t4 + 7], w2 = e4[t4 + 8], v2 = e4[t4 + 9], I2 = e4[t4 + 10], S2 = e4[t4 + 11], b2 = e4[t4 + 12], k2 = e4[t4 + 13], A2 = e4[t4 + 14], T2 = e4[t4 + 15], C2 = i3[0], P2 = i3[1], O2 = i3[2], E2 = i3[3];
        C2 = u2(C2, P2, O2, E2, o3, 7, a2[0]), E2 = u2(E2, C2, P2, O2, c3, 12, a2[1]), O2 = u2(O2, E2, C2, P2, p2, 17, a2[2]), P2 = u2(P2, O2, E2, C2, f2, 22, a2[3]), C2 = u2(C2, P2, O2, E2, g2, 7, a2[4]), E2 = u2(E2, C2, P2, O2, m2, 12, a2[5]), O2 = u2(O2, E2, C2, P2, y2, 17, a2[6]), P2 = u2(P2, O2, E2, C2, _2, 22, a2[7]), C2 = u2(C2, P2, O2, E2, w2, 7, a2[8]), E2 = u2(E2, C2, P2, O2, v2, 12, a2[9]), O2 = u2(O2, E2, C2, P2, I2, 17, a2[10]), P2 = u2(P2, O2, E2, C2, S2, 22, a2[11]), C2 = u2(C2, P2, O2, E2, b2, 7, a2[12]), E2 = u2(E2, C2, P2, O2, k2, 12, a2[13]), O2 = u2(O2, E2, C2, P2, A2, 17, a2[14]), C2 = l2(C2, P2 = u2(P2, O2, E2, C2, T2, 22, a2[15]), O2, E2, c3, 5, a2[16]), E2 = l2(E2, C2, P2, O2, y2, 9, a2[17]), O2 = l2(O2, E2, C2, P2, S2, 14, a2[18]), P2 = l2(P2, O2, E2, C2, o3, 20, a2[19]), C2 = l2(C2, P2, O2, E2, m2, 5, a2[20]), E2 = l2(E2, C2, P2, O2, I2, 9, a2[21]), O2 = l2(O2, E2, C2, P2, T2, 14, a2[22]), P2 = l2(P2, O2, E2, C2, g2, 20, a2[23]), C2 = l2(C2, P2, O2, E2, v2, 5, a2[24]), E2 = l2(E2, C2, P2, O2, A2, 9, a2[25]), O2 = l2(O2, E2, C2, P2, f2, 14, a2[26]), P2 = l2(P2, O2, E2, C2, w2, 20, a2[27]), C2 = l2(C2, P2, O2, E2, k2, 5, a2[28]), E2 = l2(E2, C2, P2, O2, p2, 9, a2[29]), O2 = l2(O2, E2, C2, P2, _2, 14, a2[30]), C2 = h2(C2, P2 = l2(P2, O2, E2, C2, b2, 20, a2[31]), O2, E2, m2, 4, a2[32]), E2 = h2(E2, C2, P2, O2, w2, 11, a2[33]), O2 = h2(O2, E2, C2, P2, S2, 16, a2[34]), P2 = h2(P2, O2, E2, C2, A2, 23, a2[35]), C2 = h2(C2, P2, O2, E2, c3, 4, a2[36]), E2 = h2(E2, C2, P2, O2, g2, 11, a2[37]), O2 = h2(O2, E2, C2, P2, _2, 16, a2[38]), P2 = h2(P2, O2, E2, C2, I2, 23, a2[39]), C2 = h2(C2, P2, O2, E2, k2, 4, a2[40]), E2 = h2(E2, C2, P2, O2, o3, 11, a2[41]), O2 = h2(O2, E2, C2, P2, f2, 16, a2[42]), P2 = h2(P2, O2, E2, C2, y2, 23, a2[43]), C2 = h2(C2, P2, O2, E2, v2, 4, a2[44]), E2 = h2(E2, C2, P2, O2, b2, 11, a2[45]), O2 = h2(O2, E2, C2, P2, T2, 16, a2[46]), C2 = d2(C2, P2 = h2(P2, O2, E2, C2, p2, 23, a2[47]), O2, E2, o3, 6, a2[48]), E2 = d2(E2, C2, P2, O2, _2, 10, a2[49]), O2 = d2(O2, E2, C2, P2, A2, 15, a2[50]), P2 = d2(P2, O2, E2, C2, m2, 21, a2[51]), C2 = d2(C2, P2, O2, E2, b2, 6, a2[52]), E2 = d2(E2, C2, P2, O2, f2, 10, a2[53]), O2 = d2(O2, E2, C2, P2, I2, 15, a2[54]), P2 = d2(P2, O2, E2, C2, c3, 21, a2[55]), C2 = d2(C2, P2, O2, E2, w2, 6, a2[56]), E2 = d2(E2, C2, P2, O2, T2, 10, a2[57]), O2 = d2(O2, E2, C2, P2, y2, 15, a2[58]), P2 = d2(P2, O2, E2, C2, k2, 21, a2[59]), C2 = d2(C2, P2, O2, E2, g2, 6, a2[60]), E2 = d2(E2, C2, P2, O2, S2, 10, a2[61]), O2 = d2(O2, E2, C2, P2, p2, 15, a2[62]), P2 = d2(P2, O2, E2, C2, v2, 21, a2[63]), i3[0] = i3[0] + C2 | 0, i3[1] = i3[1] + P2 | 0, i3[2] = i3[2] + O2 | 0, i3[3] = i3[3] + E2 | 0;
      }, _doFinalize: function() {
        var t4 = this._data, n3 = t4.words, s3 = 8 * this._nDataBytes, r3 = 8 * t4.sigBytes;
        n3[r3 >>> 5] |= 128 << 24 - r3 % 32;
        var i3 = e3.floor(s3 / 4294967296), o3 = s3;
        n3[15 + (r3 + 64 >>> 9 << 4)] = 16711935 & (i3 << 8 | i3 >>> 24) | 4278255360 & (i3 << 24 | i3 >>> 8), n3[14 + (r3 + 64 >>> 9 << 4)] = 16711935 & (o3 << 8 | o3 >>> 24) | 4278255360 & (o3 << 24 | o3 >>> 8), t4.sigBytes = 4 * (n3.length + 1), this._process();
        for (var a3 = this._hash, c3 = a3.words, u3 = 0; u3 < 4; u3++) {
          var l3 = c3[u3];
          c3[u3] = 16711935 & (l3 << 8 | l3 >>> 24) | 4278255360 & (l3 << 24 | l3 >>> 8);
        }
        return a3;
      }, clone: function() {
        var e4 = i2.clone.call(this);
        return e4._hash = this._hash.clone(), e4;
      } });
      function u2(e4, t4, n3, s3, r3, i3, o3) {
        var a3 = e4 + (t4 & n3 | ~t4 & s3) + r3 + o3;
        return (a3 << i3 | a3 >>> 32 - i3) + t4;
      }
      function l2(e4, t4, n3, s3, r3, i3, o3) {
        var a3 = e4 + (t4 & s3 | n3 & ~s3) + r3 + o3;
        return (a3 << i3 | a3 >>> 32 - i3) + t4;
      }
      function h2(e4, t4, n3, s3, r3, i3, o3) {
        var a3 = e4 + (t4 ^ n3 ^ s3) + r3 + o3;
        return (a3 << i3 | a3 >>> 32 - i3) + t4;
      }
      function d2(e4, t4, n3, s3, r3, i3, o3) {
        var a3 = e4 + (n3 ^ (t4 | ~s3)) + r3 + o3;
        return (a3 << i3 | a3 >>> 32 - i3) + t4;
      }
      t3.MD5 = i2._createHelper(c2), t3.HmacMD5 = i2._createHmacHelper(c2);
    }(Math), n2.MD5);
  }), n(function(e2, t2) {
    var n2;
    e2.exports = (n2 = r, void function() {
      var e3 = n2, t3 = e3.lib.Base, s2 = e3.enc.Utf8;
      e3.algo.HMAC = t3.extend({ init: function(e4, t4) {
        e4 = this._hasher = new e4.init(), "string" == typeof t4 && (t4 = s2.parse(t4));
        var n3 = e4.blockSize, r2 = 4 * n3;
        t4.sigBytes > r2 && (t4 = e4.finalize(t4)), t4.clamp();
        for (var i2 = this._oKey = t4.clone(), o2 = this._iKey = t4.clone(), a2 = i2.words, c2 = o2.words, u2 = 0; u2 < n3; u2++)
          a2[u2] ^= 1549556828, c2[u2] ^= 909522486;
        i2.sigBytes = o2.sigBytes = r2, this.reset();
      }, reset: function() {
        var e4 = this._hasher;
        e4.reset(), e4.update(this._iKey);
      }, update: function(e4) {
        return this._hasher.update(e4), this;
      }, finalize: function(e4) {
        var t4 = this._hasher, n3 = t4.finalize(e4);
        return t4.reset(), t4.finalize(this._oKey.clone().concat(n3));
      } });
    }());
  }), n(function(e2, t2) {
    e2.exports = r.HmacMD5;
  })), o = n(function(e2, t2) {
    e2.exports = r.enc.Utf8;
  }), a = n(function(e2, t2) {
    var n2;
    e2.exports = (n2 = r, function() {
      var e3 = n2, t3 = e3.lib.WordArray;
      function s2(e4, n3, s3) {
        for (var r2 = [], i2 = 0, o2 = 0; o2 < n3; o2++)
          if (o2 % 4) {
            var a2 = s3[e4.charCodeAt(o2 - 1)] << o2 % 4 * 2, c2 = s3[e4.charCodeAt(o2)] >>> 6 - o2 % 4 * 2;
            r2[i2 >>> 2] |= (a2 | c2) << 24 - i2 % 4 * 8, i2++;
          }
        return t3.create(r2, i2);
      }
      e3.enc.Base64 = { stringify: function(e4) {
        var t4 = e4.words, n3 = e4.sigBytes, s3 = this._map;
        e4.clamp();
        for (var r2 = [], i2 = 0; i2 < n3; i2 += 3)
          for (var o2 = (t4[i2 >>> 2] >>> 24 - i2 % 4 * 8 & 255) << 16 | (t4[i2 + 1 >>> 2] >>> 24 - (i2 + 1) % 4 * 8 & 255) << 8 | t4[i2 + 2 >>> 2] >>> 24 - (i2 + 2) % 4 * 8 & 255, a2 = 0; a2 < 4 && i2 + 0.75 * a2 < n3; a2++)
            r2.push(s3.charAt(o2 >>> 6 * (3 - a2) & 63));
        var c2 = s3.charAt(64);
        if (c2)
          for (; r2.length % 4; )
            r2.push(c2);
        return r2.join("");
      }, parse: function(e4) {
        var t4 = e4.length, n3 = this._map, r2 = this._reverseMap;
        if (!r2) {
          r2 = this._reverseMap = [];
          for (var i2 = 0; i2 < n3.length; i2++)
            r2[n3.charCodeAt(i2)] = i2;
        }
        var o2 = n3.charAt(64);
        if (o2) {
          var a2 = e4.indexOf(o2);
          -1 !== a2 && (t4 = a2);
        }
        return s2(e4, t4, r2);
      }, _map: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=" };
    }(), n2.enc.Base64);
  });
  const c = "FUNCTION", u = "OBJECT", l = "CLIENT_DB", h = "pending", d = "fulfilled", p = "rejected";
  function f(e2) {
    return Object.prototype.toString.call(e2).slice(8, -1).toLowerCase();
  }
  function g(e2) {
    return "object" === f(e2);
  }
  function m(e2) {
    return "function" == typeof e2;
  }
  function y(e2) {
    return function() {
      try {
        return e2.apply(e2, arguments);
      } catch (e3) {
        console.error(e3);
      }
    };
  }
  const _ = "REJECTED", w = "NOT_PENDING";
  class v {
    constructor({ createPromise: e2, retryRule: t2 = _ } = {}) {
      this.createPromise = e2, this.status = null, this.promise = null, this.retryRule = t2;
    }
    get needRetry() {
      if (!this.status)
        return true;
      switch (this.retryRule) {
        case _:
          return this.status === p;
        case w:
          return this.status !== h;
      }
    }
    exec() {
      return this.needRetry ? (this.status = h, this.promise = this.createPromise().then((e2) => (this.status = d, Promise.resolve(e2)), (e2) => (this.status = p, Promise.reject(e2))), this.promise) : this.promise;
    }
  }
  function I(e2) {
    return e2 && "string" == typeof e2 ? JSON.parse(e2) : e2;
  }
  const S = true, b = "app", A = I(define_process_env_UNI_SECURE_NETWORK_CONFIG_default), T = b, C = I(""), P = I("[]") || [];
  let E = "";
  try {
    E = "";
  } catch (e2) {
  }
  let x, L = {};
  function U(e2, t2 = {}) {
    var n2, s2;
    return n2 = L, s2 = e2, Object.prototype.hasOwnProperty.call(n2, s2) || (L[e2] = t2), L[e2];
  }
  function R() {
    return x || (x = function() {
      if ("undefined" != typeof globalThis)
        return globalThis;
      if ("undefined" != typeof self)
        return self;
      if ("undefined" != typeof window)
        return window;
      function e2() {
        return this;
      }
      return void 0 !== e2() ? e2() : new Function("return this")();
    }(), x);
  }
  L = uni._globalUniCloudObj ? uni._globalUniCloudObj : uni._globalUniCloudObj = {};
  const N = ["invoke", "success", "fail", "complete"], D = U("_globalUniCloudInterceptor");
  function M(e2, t2) {
    D[e2] || (D[e2] = {}), g(t2) && Object.keys(t2).forEach((n2) => {
      N.indexOf(n2) > -1 && function(e3, t3, n3) {
        let s2 = D[e3][t3];
        s2 || (s2 = D[e3][t3] = []), -1 === s2.indexOf(n3) && m(n3) && s2.push(n3);
      }(e2, n2, t2[n2]);
    });
  }
  function q(e2, t2) {
    D[e2] || (D[e2] = {}), g(t2) ? Object.keys(t2).forEach((n2) => {
      N.indexOf(n2) > -1 && function(e3, t3, n3) {
        const s2 = D[e3][t3];
        if (!s2)
          return;
        const r2 = s2.indexOf(n3);
        r2 > -1 && s2.splice(r2, 1);
      }(e2, n2, t2[n2]);
    }) : delete D[e2];
  }
  function F(e2, t2) {
    return e2 && 0 !== e2.length ? e2.reduce((e3, n2) => e3.then(() => n2(t2)), Promise.resolve()) : Promise.resolve();
  }
  function K(e2, t2) {
    return D[e2] && D[e2][t2] || [];
  }
  function j(e2) {
    M("callObject", e2);
  }
  const $ = U("_globalUniCloudListener"), B = "response", W = "needLogin", H = "refreshToken", J = "failover", z = "clientdb", V = "cloudfunction", G = "cloudobject";
  function Q(e2) {
    return $[e2] || ($[e2] = []), $[e2];
  }
  function Y(e2, t2) {
    const n2 = Q(e2);
    n2.includes(t2) || n2.push(t2);
  }
  function X(e2, t2) {
    const n2 = Q(e2), s2 = n2.indexOf(t2);
    -1 !== s2 && n2.splice(s2, 1);
  }
  function Z(e2, t2) {
    const n2 = Q(e2);
    for (let e3 = 0; e3 < n2.length; e3++) {
      (0, n2[e3])(t2);
    }
  }
  let ee, te = false;
  function ne() {
    return ee || (ee = new Promise((e2) => {
      te && e2(), function t2() {
        if ("function" == typeof getCurrentPages) {
          const t3 = getCurrentPages();
          t3 && t3[0] && (te = true, e2());
        }
        te || setTimeout(() => {
          t2();
        }, 30);
      }();
    }), ee);
  }
  function se(e2) {
    const t2 = {};
    for (const n2 in e2) {
      const s2 = e2[n2];
      m(s2) && (t2[n2] = y(s2));
    }
    return t2;
  }
  class re extends Error {
    constructor(e2) {
      const t2 = e2.message || e2.errMsg || "unknown system error";
      super(t2), this.errMsg = t2, this.code = this.errCode = e2.code || e2.errCode || "SYSTEM_ERROR", this.errSubject = this.subject = e2.subject || e2.errSubject, this.cause = e2.cause, this.requestId = e2.requestId;
    }
    toJson(e2 = 0) {
      if (!(e2 >= 10))
        return e2++, { errCode: this.errCode, errMsg: this.errMsg, errSubject: this.errSubject, cause: this.cause && this.cause.toJson ? this.cause.toJson(e2) : this.cause };
    }
  }
  var ie = { request: (e2) => uni.request(e2), uploadFile: (e2) => uni.uploadFile(e2), setStorageSync: (e2, t2) => uni.setStorageSync(e2, t2), getStorageSync: (e2) => uni.getStorageSync(e2), removeStorageSync: (e2) => uni.removeStorageSync(e2), clearStorageSync: () => uni.clearStorageSync(), connectSocket: (e2) => uni.connectSocket(e2) };
  function oe(e2) {
    return e2 && oe(e2.__v_raw) || e2;
  }
  function ae() {
    return { token: ie.getStorageSync("uni_id_token") || ie.getStorageSync("uniIdToken"), tokenExpired: ie.getStorageSync("uni_id_token_expired") };
  }
  function ce({ token: e2, tokenExpired: t2 } = {}) {
    e2 && ie.setStorageSync("uni_id_token", e2), t2 && ie.setStorageSync("uni_id_token_expired", t2);
  }
  let ue, le;
  function he() {
    return ue || (ue = uni.getSystemInfoSync()), ue;
  }
  function de() {
    let e2, t2;
    try {
      if (uni.getLaunchOptionsSync) {
        if (uni.getLaunchOptionsSync.toString().indexOf("not yet implemented") > -1)
          return;
        const { scene: n2, channel: s2 } = uni.getLaunchOptionsSync();
        e2 = s2, t2 = n2;
      }
    } catch (e3) {
    }
    return { channel: e2, scene: t2 };
  }
  let pe = {};
  function fe() {
    const e2 = uni.getLocale && uni.getLocale() || "en";
    if (le)
      return { ...pe, ...le, locale: e2, LOCALE: e2 };
    const t2 = he(), { deviceId: n2, osName: s2, uniPlatform: r2, appId: i2 } = t2, o2 = ["appId", "appLanguage", "appName", "appVersion", "appVersionCode", "appWgtVersion", "browserName", "browserVersion", "deviceBrand", "deviceId", "deviceModel", "deviceType", "osName", "osVersion", "romName", "romVersion", "ua", "hostName", "hostVersion", "uniPlatform", "uniRuntimeVersion", "uniRuntimeVersionCode", "uniCompilerVersion", "uniCompilerVersionCode"];
    for (const e3 in t2)
      Object.hasOwnProperty.call(t2, e3) && -1 === o2.indexOf(e3) && delete t2[e3];
    return le = { PLATFORM: r2, OS: s2, APPID: i2, DEVICEID: n2, ...de(), ...t2 }, { ...pe, ...le, locale: e2, LOCALE: e2 };
  }
  var ge = { sign: function(e2, t2) {
    let n2 = "";
    return Object.keys(e2).sort().forEach(function(t3) {
      e2[t3] && (n2 = n2 + "&" + t3 + "=" + e2[t3]);
    }), n2 = n2.slice(1), i(n2, t2).toString();
  }, wrappedRequest: function(e2, t2) {
    return new Promise((n2, s2) => {
      t2(Object.assign(e2, { complete(e3) {
        e3 || (e3 = {});
        const t3 = e3.data && e3.data.header && e3.data.header["x-serverless-request-id"] || e3.header && e3.header["request-id"];
        if (!e3.statusCode || e3.statusCode >= 400) {
          const n3 = e3.data && e3.data.error && e3.data.error.code || "SYS_ERR", r3 = e3.data && e3.data.error && e3.data.error.message || e3.errMsg || "request:fail";
          return s2(new re({ code: n3, message: r3, requestId: t3 }));
        }
        const r2 = e3.data;
        if (r2.error)
          return s2(new re({ code: r2.error.code, message: r2.error.message, requestId: t3 }));
        r2.result = r2.data, r2.requestId = t3, delete r2.data, n2(r2);
      } }));
    });
  }, toBase64: function(e2) {
    return a.stringify(o.parse(e2));
  } };
  var me = class {
    constructor(e2) {
      ["spaceId", "clientSecret"].forEach((t2) => {
        if (!Object.prototype.hasOwnProperty.call(e2, t2))
          throw new Error(`${t2} required`);
      }), this.config = Object.assign({}, { endpoint: 0 === e2.spaceId.indexOf("mp-") ? "https://api.next.bspapp.com" : "https://api.bspapp.com" }, e2), this.config.provider = "aliyun", this.config.requestUrl = this.config.endpoint + "/client", this.config.envType = this.config.envType || "public", this.config.accessTokenKey = "access_token_" + this.config.spaceId, this.adapter = ie, this._getAccessTokenPromiseHub = new v({ createPromise: () => this.requestAuth(this.setupRequest({ method: "serverless.auth.user.anonymousAuthorize", params: "{}" }, "auth")).then((e3) => {
        if (!e3.result || !e3.result.accessToken)
          throw new re({ code: "AUTH_FAILED", message: "获取accessToken失败" });
        this.setAccessToken(e3.result.accessToken);
      }), retryRule: w });
    }
    get hasAccessToken() {
      return !!this.accessToken;
    }
    setAccessToken(e2) {
      this.accessToken = e2;
    }
    requestWrapped(e2) {
      return ge.wrappedRequest(e2, this.adapter.request);
    }
    requestAuth(e2) {
      return this.requestWrapped(e2);
    }
    request(e2, t2) {
      return Promise.resolve().then(() => this.hasAccessToken ? t2 ? this.requestWrapped(e2) : this.requestWrapped(e2).catch((t3) => new Promise((e3, n2) => {
        !t3 || "GATEWAY_INVALID_TOKEN" !== t3.code && "InvalidParameter.InvalidToken" !== t3.code ? n2(t3) : e3();
      }).then(() => this.getAccessToken()).then(() => {
        const t4 = this.rebuildRequest(e2);
        return this.request(t4, true);
      })) : this.getAccessToken().then(() => {
        const t3 = this.rebuildRequest(e2);
        return this.request(t3, true);
      }));
    }
    rebuildRequest(e2) {
      const t2 = Object.assign({}, e2);
      return t2.data.token = this.accessToken, t2.header["x-basement-token"] = this.accessToken, t2.header["x-serverless-sign"] = ge.sign(t2.data, this.config.clientSecret), t2;
    }
    setupRequest(e2, t2) {
      const n2 = Object.assign({}, e2, { spaceId: this.config.spaceId, timestamp: Date.now() }), s2 = { "Content-Type": "application/json" };
      return "auth" !== t2 && (n2.token = this.accessToken, s2["x-basement-token"] = this.accessToken), s2["x-serverless-sign"] = ge.sign(n2, this.config.clientSecret), { url: this.config.requestUrl, method: "POST", data: n2, dataType: "json", header: s2 };
    }
    getAccessToken() {
      return this._getAccessTokenPromiseHub.exec();
    }
    async authorize() {
      await this.getAccessToken();
    }
    callFunction(e2) {
      const t2 = { method: "serverless.function.runtime.invoke", params: JSON.stringify({ functionTarget: e2.name, functionArgs: e2.data || {} }) };
      return this.request({ ...this.setupRequest(t2), timeout: e2.timeout });
    }
    getOSSUploadOptionsFromPath(e2) {
      const t2 = { method: "serverless.file.resource.generateProximalSign", params: JSON.stringify(e2) };
      return this.request(this.setupRequest(t2));
    }
    uploadFileToOSS({ url: e2, formData: t2, name: n2, filePath: s2, fileType: r2, onUploadProgress: i2 }) {
      return new Promise((o2, a2) => {
        const c2 = this.adapter.uploadFile({ url: e2, formData: t2, name: n2, filePath: s2, fileType: r2, header: { "X-OSS-server-side-encrpytion": "AES256" }, success(e3) {
          e3 && e3.statusCode < 400 ? o2(e3) : a2(new re({ code: "UPLOAD_FAILED", message: "文件上传失败" }));
        }, fail(e3) {
          a2(new re({ code: e3.code || "UPLOAD_FAILED", message: e3.message || e3.errMsg || "文件上传失败" }));
        } });
        "function" == typeof i2 && c2 && "function" == typeof c2.onProgressUpdate && c2.onProgressUpdate((e3) => {
          i2({ loaded: e3.totalBytesSent, total: e3.totalBytesExpectedToSend });
        });
      });
    }
    reportOSSUpload(e2) {
      const t2 = { method: "serverless.file.resource.report", params: JSON.stringify(e2) };
      return this.request(this.setupRequest(t2));
    }
    async uploadFile({ filePath: e2, cloudPath: t2, fileType: n2 = "image", cloudPathAsRealPath: s2 = false, onUploadProgress: r2, config: i2 }) {
      if ("string" !== f(t2))
        throw new re({ code: "INVALID_PARAM", message: "cloudPath必须为字符串类型" });
      if (!(t2 = t2.trim()))
        throw new re({ code: "INVALID_PARAM", message: "cloudPath不可为空" });
      if (/:\/\//.test(t2))
        throw new re({ code: "INVALID_PARAM", message: "cloudPath不合法" });
      const o2 = i2 && i2.envType || this.config.envType;
      if (s2 && ("/" !== t2[0] && (t2 = "/" + t2), t2.indexOf("\\") > -1))
        throw new re({ code: "INVALID_PARAM", message: "使用cloudPath作为路径时，cloudPath不可包含“\\”" });
      const a2 = (await this.getOSSUploadOptionsFromPath({ env: o2, filename: s2 ? t2.split("/").pop() : t2, fileId: s2 ? t2 : void 0 })).result, c2 = "https://" + a2.cdnDomain + "/" + a2.ossPath, { securityToken: u2, accessKeyId: l2, signature: h2, host: d2, ossPath: p2, id: g2, policy: m2, ossCallbackUrl: y2 } = a2, _2 = { "Cache-Control": "max-age=2592000", "Content-Disposition": "attachment", OSSAccessKeyId: l2, Signature: h2, host: d2, id: g2, key: p2, policy: m2, success_action_status: 200 };
      if (u2 && (_2["x-oss-security-token"] = u2), y2) {
        const e3 = JSON.stringify({ callbackUrl: y2, callbackBody: JSON.stringify({ fileId: g2, spaceId: this.config.spaceId }), callbackBodyType: "application/json" });
        _2.callback = ge.toBase64(e3);
      }
      const w2 = { url: "https://" + a2.host, formData: _2, fileName: "file", name: "file", filePath: e2, fileType: n2 };
      if (await this.uploadFileToOSS(Object.assign({}, w2, { onUploadProgress: r2 })), y2)
        return { success: true, filePath: e2, fileID: c2 };
      if ((await this.reportOSSUpload({ id: g2 })).success)
        return { success: true, filePath: e2, fileID: c2 };
      throw new re({ code: "UPLOAD_FAILED", message: "文件上传失败" });
    }
    getTempFileURL({ fileList: e2 } = {}) {
      return new Promise((t2, n2) => {
        Array.isArray(e2) && 0 !== e2.length || n2(new re({ code: "INVALID_PARAM", message: "fileList的元素必须是非空的字符串" })), this.getFileInfo({ fileList: e2 }).then((n3) => {
          t2({ fileList: e2.map((e3, t3) => {
            const s2 = n3.fileList[t3];
            return { fileID: e3, tempFileURL: s2 && s2.url || e3 };
          }) });
        });
      });
    }
    async getFileInfo({ fileList: e2 } = {}) {
      if (!Array.isArray(e2) || 0 === e2.length)
        throw new re({ code: "INVALID_PARAM", message: "fileList的元素必须是非空的字符串" });
      const t2 = { method: "serverless.file.resource.info", params: JSON.stringify({ id: e2.map((e3) => e3.split("?")[0]).join(",") }) };
      return { fileList: (await this.request(this.setupRequest(t2))).result };
    }
  };
  var ye = { init(e2) {
    const t2 = new me(e2), n2 = { signInAnonymously: function() {
      return t2.authorize();
    }, getLoginState: function() {
      return Promise.resolve(false);
    } };
    return t2.auth = function() {
      return n2;
    }, t2.customAuth = t2.auth, t2;
  } };
  const _e = "undefined" != typeof location && "http:" === location.protocol ? "http:" : "https:";
  var we;
  !function(e2) {
    e2.local = "local", e2.none = "none", e2.session = "session";
  }(we || (we = {}));
  var ve = function() {
  }, Ie = n(function(e2, t2) {
    var n2;
    e2.exports = (n2 = r, function(e3) {
      var t3 = n2, s2 = t3.lib, r2 = s2.WordArray, i2 = s2.Hasher, o2 = t3.algo, a2 = [], c2 = [];
      !function() {
        function t4(t5) {
          for (var n4 = e3.sqrt(t5), s4 = 2; s4 <= n4; s4++)
            if (!(t5 % s4))
              return false;
          return true;
        }
        function n3(e4) {
          return 4294967296 * (e4 - (0 | e4)) | 0;
        }
        for (var s3 = 2, r3 = 0; r3 < 64; )
          t4(s3) && (r3 < 8 && (a2[r3] = n3(e3.pow(s3, 0.5))), c2[r3] = n3(e3.pow(s3, 1 / 3)), r3++), s3++;
      }();
      var u2 = [], l2 = o2.SHA256 = i2.extend({ _doReset: function() {
        this._hash = new r2.init(a2.slice(0));
      }, _doProcessBlock: function(e4, t4) {
        for (var n3 = this._hash.words, s3 = n3[0], r3 = n3[1], i3 = n3[2], o3 = n3[3], a3 = n3[4], l3 = n3[5], h2 = n3[6], d2 = n3[7], p2 = 0; p2 < 64; p2++) {
          if (p2 < 16)
            u2[p2] = 0 | e4[t4 + p2];
          else {
            var f2 = u2[p2 - 15], g2 = (f2 << 25 | f2 >>> 7) ^ (f2 << 14 | f2 >>> 18) ^ f2 >>> 3, m2 = u2[p2 - 2], y2 = (m2 << 15 | m2 >>> 17) ^ (m2 << 13 | m2 >>> 19) ^ m2 >>> 10;
            u2[p2] = g2 + u2[p2 - 7] + y2 + u2[p2 - 16];
          }
          var _2 = s3 & r3 ^ s3 & i3 ^ r3 & i3, w2 = (s3 << 30 | s3 >>> 2) ^ (s3 << 19 | s3 >>> 13) ^ (s3 << 10 | s3 >>> 22), v2 = d2 + ((a3 << 26 | a3 >>> 6) ^ (a3 << 21 | a3 >>> 11) ^ (a3 << 7 | a3 >>> 25)) + (a3 & l3 ^ ~a3 & h2) + c2[p2] + u2[p2];
          d2 = h2, h2 = l3, l3 = a3, a3 = o3 + v2 | 0, o3 = i3, i3 = r3, r3 = s3, s3 = v2 + (w2 + _2) | 0;
        }
        n3[0] = n3[0] + s3 | 0, n3[1] = n3[1] + r3 | 0, n3[2] = n3[2] + i3 | 0, n3[3] = n3[3] + o3 | 0, n3[4] = n3[4] + a3 | 0, n3[5] = n3[5] + l3 | 0, n3[6] = n3[6] + h2 | 0, n3[7] = n3[7] + d2 | 0;
      }, _doFinalize: function() {
        var t4 = this._data, n3 = t4.words, s3 = 8 * this._nDataBytes, r3 = 8 * t4.sigBytes;
        return n3[r3 >>> 5] |= 128 << 24 - r3 % 32, n3[14 + (r3 + 64 >>> 9 << 4)] = e3.floor(s3 / 4294967296), n3[15 + (r3 + 64 >>> 9 << 4)] = s3, t4.sigBytes = 4 * n3.length, this._process(), this._hash;
      }, clone: function() {
        var e4 = i2.clone.call(this);
        return e4._hash = this._hash.clone(), e4;
      } });
      t3.SHA256 = i2._createHelper(l2), t3.HmacSHA256 = i2._createHmacHelper(l2);
    }(Math), n2.SHA256);
  }), Se = Ie, be = n(function(e2, t2) {
    e2.exports = r.HmacSHA256;
  });
  const ke = () => {
    let e2;
    if (!Promise) {
      e2 = () => {
      }, e2.promise = {};
      const t3 = () => {
        throw new re({ message: 'Your Node runtime does support ES6 Promises. Set "global.Promise" to your preferred implementation of promises.' });
      };
      return Object.defineProperty(e2.promise, "then", { get: t3 }), Object.defineProperty(e2.promise, "catch", { get: t3 }), e2;
    }
    const t2 = new Promise((t3, n2) => {
      e2 = (e3, s2) => e3 ? n2(e3) : t3(s2);
    });
    return e2.promise = t2, e2;
  };
  function Ae(e2) {
    return void 0 === e2;
  }
  function Te(e2) {
    return "[object Null]" === Object.prototype.toString.call(e2);
  }
  function Ce(e2 = "") {
    return e2.replace(/([\s\S]+)\s+(请前往云开发AI小助手查看问题：.*)/, "$1");
  }
  function Pe(e2 = 32) {
    const t2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", n2 = t2.length;
    let s2 = "";
    for (let r2 = 0; r2 < e2; r2++)
      s2 += t2.charAt(Math.floor(Math.random() * n2));
    return s2;
  }
  var Oe;
  function Ee(e2) {
    const t2 = (n2 = e2, "[object Array]" === Object.prototype.toString.call(n2) ? e2 : [e2]);
    var n2;
    for (const e3 of t2) {
      const { isMatch: t3, genAdapter: n3, runtime: s2 } = e3;
      if (t3())
        return { adapter: n3(), runtime: s2 };
    }
  }
  !function(e2) {
    e2.WEB = "web", e2.WX_MP = "wx_mp";
  }(Oe || (Oe = {}));
  const xe = { adapter: null, runtime: void 0 }, Le = ["anonymousUuidKey"];
  class Ue extends ve {
    constructor() {
      super(), xe.adapter.root.tcbObject || (xe.adapter.root.tcbObject = {});
    }
    setItem(e2, t2) {
      xe.adapter.root.tcbObject[e2] = t2;
    }
    getItem(e2) {
      return xe.adapter.root.tcbObject[e2];
    }
    removeItem(e2) {
      delete xe.adapter.root.tcbObject[e2];
    }
    clear() {
      delete xe.adapter.root.tcbObject;
    }
  }
  function Re(e2, t2) {
    switch (e2) {
      case "local":
        return t2.localStorage || new Ue();
      case "none":
        return new Ue();
      default:
        return t2.sessionStorage || new Ue();
    }
  }
  class Ne {
    constructor(e2) {
      if (!this._storage) {
        this._persistence = xe.adapter.primaryStorage || e2.persistence, this._storage = Re(this._persistence, xe.adapter);
        const t2 = `access_token_${e2.env}`, n2 = `access_token_expire_${e2.env}`, s2 = `refresh_token_${e2.env}`, r2 = `anonymous_uuid_${e2.env}`, i2 = `login_type_${e2.env}`, o2 = "device_id", a2 = `token_type_${e2.env}`, c2 = `user_info_${e2.env}`;
        this.keys = { accessTokenKey: t2, accessTokenExpireKey: n2, refreshTokenKey: s2, anonymousUuidKey: r2, loginTypeKey: i2, userInfoKey: c2, deviceIdKey: o2, tokenTypeKey: a2 };
      }
    }
    updatePersistence(e2) {
      if (e2 === this._persistence)
        return;
      const t2 = "local" === this._persistence;
      this._persistence = e2;
      const n2 = Re(e2, xe.adapter);
      for (const e3 in this.keys) {
        const s2 = this.keys[e3];
        if (t2 && Le.includes(e3))
          continue;
        const r2 = this._storage.getItem(s2);
        Ae(r2) || Te(r2) || (n2.setItem(s2, r2), this._storage.removeItem(s2));
      }
      this._storage = n2;
    }
    setStore(e2, t2, n2) {
      if (!this._storage)
        return;
      const s2 = { version: n2 || "localCachev1", content: t2 }, r2 = JSON.stringify(s2);
      try {
        this._storage.setItem(e2, r2);
      } catch (e3) {
        throw e3;
      }
    }
    getStore(e2, t2) {
      try {
        if (!this._storage)
          return;
      } catch (e3) {
        return "";
      }
      t2 = t2 || "localCachev1";
      const n2 = this._storage.getItem(e2);
      if (!n2)
        return "";
      if (n2.indexOf(t2) >= 0) {
        return JSON.parse(n2).content;
      }
      return "";
    }
    removeStore(e2) {
      this._storage.removeItem(e2);
    }
  }
  const De = {}, Me = {};
  function qe(e2) {
    return De[e2];
  }
  class Fe {
    constructor(e2, t2) {
      this.data = t2 || null, this.name = e2;
    }
  }
  class Ke extends Fe {
    constructor(e2, t2) {
      super("error", { error: e2, data: t2 }), this.error = e2;
    }
  }
  const je = new class {
    constructor() {
      this._listeners = {};
    }
    on(e2, t2) {
      return function(e3, t3, n2) {
        n2[e3] = n2[e3] || [], n2[e3].push(t3);
      }(e2, t2, this._listeners), this;
    }
    off(e2, t2) {
      return function(e3, t3, n2) {
        if (n2 && n2[e3]) {
          const s2 = n2[e3].indexOf(t3);
          -1 !== s2 && n2[e3].splice(s2, 1);
        }
      }(e2, t2, this._listeners), this;
    }
    fire(e2, t2) {
      if (e2 instanceof Ke)
        return console.error(e2.error), this;
      const n2 = "string" == typeof e2 ? new Fe(e2, t2 || {}) : e2;
      const s2 = n2.name;
      if (this._listens(s2)) {
        n2.target = this;
        const e3 = this._listeners[s2] ? [...this._listeners[s2]] : [];
        for (const t3 of e3)
          t3.call(this, n2);
      }
      return this;
    }
    _listens(e2) {
      return this._listeners[e2] && this._listeners[e2].length > 0;
    }
  }();
  function $e(e2, t2) {
    je.on(e2, t2);
  }
  function Be(e2, t2 = {}) {
    je.fire(e2, t2);
  }
  function We(e2, t2) {
    je.off(e2, t2);
  }
  const He = "loginStateChanged", Je = "loginStateExpire", ze = "loginTypeChanged", Ve = "anonymousConverted", Ge = "refreshAccessToken";
  var Qe;
  !function(e2) {
    e2.ANONYMOUS = "ANONYMOUS", e2.WECHAT = "WECHAT", e2.WECHAT_PUBLIC = "WECHAT-PUBLIC", e2.WECHAT_OPEN = "WECHAT-OPEN", e2.CUSTOM = "CUSTOM", e2.EMAIL = "EMAIL", e2.USERNAME = "USERNAME", e2.NULL = "NULL";
  }(Qe || (Qe = {}));
  class Ye {
    constructor() {
      this._fnPromiseMap = /* @__PURE__ */ new Map();
    }
    async run(e2, t2) {
      let n2 = this._fnPromiseMap.get(e2);
      return n2 || (n2 = new Promise(async (n3, s2) => {
        try {
          await this._runIdlePromise();
          const s3 = t2();
          n3(await s3);
        } catch (e3) {
          s2(e3);
        } finally {
          this._fnPromiseMap.delete(e2);
        }
      }), this._fnPromiseMap.set(e2, n2)), n2;
    }
    _runIdlePromise() {
      return Promise.resolve();
    }
  }
  class Xe {
    constructor(e2) {
      this._singlePromise = new Ye(), this._cache = qe(e2.env), this._baseURL = `https://${e2.env}.ap-shanghai.tcb-api.tencentcloudapi.com`, this._reqClass = new xe.adapter.reqClass({ timeout: e2.timeout, timeoutMsg: `请求在${e2.timeout / 1e3}s内未完成，已中断`, restrictedMethods: ["post"] });
    }
    _getDeviceId() {
      if (this._deviceID)
        return this._deviceID;
      const { deviceIdKey: e2 } = this._cache.keys;
      let t2 = this._cache.getStore(e2);
      return "string" == typeof t2 && t2.length >= 16 && t2.length <= 48 || (t2 = Pe(), this._cache.setStore(e2, t2)), this._deviceID = t2, t2;
    }
    async _request(e2, t2, n2 = {}) {
      const s2 = { "x-request-id": Pe(), "x-device-id": this._getDeviceId() };
      if (n2.withAccessToken) {
        const { tokenTypeKey: e3 } = this._cache.keys, t3 = await this.getAccessToken(), n3 = this._cache.getStore(e3);
        s2.authorization = `${n3} ${t3}`;
      }
      return this._reqClass["get" === n2.method ? "get" : "post"]({ url: `${this._baseURL}${e2}`, data: t2, headers: s2 });
    }
    async _fetchAccessToken() {
      const { loginTypeKey: e2, accessTokenKey: t2, accessTokenExpireKey: n2, tokenTypeKey: s2 } = this._cache.keys, r2 = this._cache.getStore(e2);
      if (r2 && r2 !== Qe.ANONYMOUS)
        throw new re({ code: "INVALID_OPERATION", message: "非匿名登录不支持刷新 access token" });
      const i2 = await this._singlePromise.run("fetchAccessToken", async () => (await this._request("/auth/v1/signin/anonymously", {}, { method: "post" })).data), { access_token: o2, expires_in: a2, token_type: c2 } = i2;
      return this._cache.setStore(s2, c2), this._cache.setStore(t2, o2), this._cache.setStore(n2, Date.now() + 1e3 * a2), o2;
    }
    isAccessTokenExpired(e2, t2) {
      let n2 = true;
      return e2 && t2 && (n2 = t2 < Date.now()), n2;
    }
    async getAccessToken() {
      const { accessTokenKey: e2, accessTokenExpireKey: t2 } = this._cache.keys, n2 = this._cache.getStore(e2), s2 = this._cache.getStore(t2);
      return this.isAccessTokenExpired(n2, s2) ? this._fetchAccessToken() : n2;
    }
    async refreshAccessToken() {
      const { accessTokenKey: e2, accessTokenExpireKey: t2, loginTypeKey: n2 } = this._cache.keys;
      return this._cache.removeStore(e2), this._cache.removeStore(t2), this._cache.setStore(n2, Qe.ANONYMOUS), this.getAccessToken();
    }
    async getUserInfo() {
      return this._singlePromise.run("getUserInfo", async () => (await this._request("/auth/v1/user/me", {}, { withAccessToken: true, method: "get" })).data);
    }
  }
  const Ze = ["auth.getJwt", "auth.logout", "auth.signInWithTicket", "auth.signInAnonymously", "auth.signIn", "auth.fetchAccessTokenWithRefreshToken", "auth.signUpWithEmailAndPassword", "auth.activateEndUserMail", "auth.sendPasswordResetEmail", "auth.resetPasswordWithToken", "auth.isUsernameRegistered"], et = { "X-SDK-Version": "1.3.5" };
  function tt(e2, t2, n2) {
    const s2 = e2[t2];
    e2[t2] = function(t3) {
      const r2 = {}, i2 = {};
      n2.forEach((n3) => {
        const { data: s3, headers: o3 } = n3.call(e2, t3);
        Object.assign(r2, s3), Object.assign(i2, o3);
      });
      const o2 = t3.data;
      return o2 && (() => {
        var e3;
        if (e3 = o2, "[object FormData]" !== Object.prototype.toString.call(e3))
          t3.data = { ...o2, ...r2 };
        else
          for (const e4 in r2)
            o2.append(e4, r2[e4]);
      })(), t3.headers = { ...t3.headers || {}, ...i2 }, s2.call(e2, t3);
    };
  }
  function nt() {
    const e2 = Math.random().toString(16).slice(2);
    return { data: { seqId: e2 }, headers: { ...et, "x-seqid": e2 } };
  }
  class st {
    constructor(e2 = {}) {
      var t2;
      this.config = e2, this._reqClass = new xe.adapter.reqClass({ timeout: this.config.timeout, timeoutMsg: `请求在${this.config.timeout / 1e3}s内未完成，已中断`, restrictedMethods: ["post"] }), this._cache = qe(this.config.env), this._localCache = (t2 = this.config.env, Me[t2]), this.oauth = new Xe(this.config), tt(this._reqClass, "post", [nt]), tt(this._reqClass, "upload", [nt]), tt(this._reqClass, "download", [nt]);
    }
    async post(e2) {
      return await this._reqClass.post(e2);
    }
    async upload(e2) {
      return await this._reqClass.upload(e2);
    }
    async download(e2) {
      return await this._reqClass.download(e2);
    }
    async refreshAccessToken() {
      let e2, t2;
      this._refreshAccessTokenPromise || (this._refreshAccessTokenPromise = this._refreshAccessToken());
      try {
        e2 = await this._refreshAccessTokenPromise;
      } catch (e3) {
        t2 = e3;
      }
      if (this._refreshAccessTokenPromise = null, this._shouldRefreshAccessTokenHook = null, t2)
        throw t2;
      return e2;
    }
    async _refreshAccessToken() {
      const { accessTokenKey: e2, accessTokenExpireKey: t2, refreshTokenKey: n2, loginTypeKey: s2, anonymousUuidKey: r2 } = this._cache.keys;
      this._cache.removeStore(e2), this._cache.removeStore(t2);
      let i2 = this._cache.getStore(n2);
      if (!i2)
        throw new re({ message: "未登录CloudBase" });
      const o2 = { refresh_token: i2 }, a2 = await this.request("auth.fetchAccessTokenWithRefreshToken", o2);
      if (a2.data.code) {
        const { code: e3 } = a2.data;
        if ("SIGN_PARAM_INVALID" === e3 || "REFRESH_TOKEN_EXPIRED" === e3 || "INVALID_REFRESH_TOKEN" === e3) {
          if (this._cache.getStore(s2) === Qe.ANONYMOUS && "INVALID_REFRESH_TOKEN" === e3) {
            const e4 = this._cache.getStore(r2), t3 = this._cache.getStore(n2), s3 = await this.send("auth.signInAnonymously", { anonymous_uuid: e4, refresh_token: t3 });
            return this.setRefreshToken(s3.refresh_token), this._refreshAccessToken();
          }
          Be(Je), this._cache.removeStore(n2);
        }
        throw new re({ code: a2.data.code, message: `刷新access token失败：${a2.data.code}` });
      }
      if (a2.data.access_token)
        return Be(Ge), this._cache.setStore(e2, a2.data.access_token), this._cache.setStore(t2, a2.data.access_token_expire + Date.now()), { accessToken: a2.data.access_token, accessTokenExpire: a2.data.access_token_expire };
      a2.data.refresh_token && (this._cache.removeStore(n2), this._cache.setStore(n2, a2.data.refresh_token), this._refreshAccessToken());
    }
    async getAccessToken() {
      const { accessTokenKey: e2, accessTokenExpireKey: t2, refreshTokenKey: n2 } = this._cache.keys;
      if (!this._cache.getStore(n2))
        throw new re({ message: "refresh token不存在，登录状态异常" });
      let s2 = this._cache.getStore(e2), r2 = this._cache.getStore(t2), i2 = true;
      return this._shouldRefreshAccessTokenHook && !await this._shouldRefreshAccessTokenHook(s2, r2) && (i2 = false), (!s2 || !r2 || r2 < Date.now()) && i2 ? this.refreshAccessToken() : { accessToken: s2, accessTokenExpire: r2 };
    }
    async request(e2, t2, n2) {
      const s2 = `x-tcb-trace_${this.config.env}`;
      let r2 = "application/x-www-form-urlencoded";
      const i2 = { action: e2, env: this.config.env, dataVersion: "2019-08-16", ...t2 };
      let o2;
      if (-1 === Ze.indexOf(e2) && (this._cache.keys, i2.access_token = await this.oauth.getAccessToken()), "storage.uploadFile" === e2) {
        o2 = new FormData();
        for (let e3 in o2)
          o2.hasOwnProperty(e3) && void 0 !== o2[e3] && o2.append(e3, i2[e3]);
        r2 = "multipart/form-data";
      } else {
        r2 = "application/json", o2 = {};
        for (let e3 in i2)
          void 0 !== i2[e3] && (o2[e3] = i2[e3]);
      }
      let a2 = { headers: { "content-type": r2 } };
      n2 && n2.timeout && (a2.timeout = n2.timeout), n2 && n2.onUploadProgress && (a2.onUploadProgress = n2.onUploadProgress);
      const c2 = this._localCache.getStore(s2);
      c2 && (a2.headers["X-TCB-Trace"] = c2);
      const { parse: u2, inQuery: l2, search: h2 } = t2;
      let d2 = { env: this.config.env };
      u2 && (d2.parse = true), l2 && (d2 = { ...l2, ...d2 });
      let p2 = function(e3, t3, n3 = {}) {
        const s3 = /\?/.test(t3);
        let r3 = "";
        for (let e4 in n3)
          "" === r3 ? !s3 && (t3 += "?") : r3 += "&", r3 += `${e4}=${encodeURIComponent(n3[e4])}`;
        return /^http(s)?\:\/\//.test(t3 += r3) ? t3 : `${e3}${t3}`;
      }(_e, "//tcb-api.tencentcloudapi.com/web", d2);
      h2 && (p2 += h2);
      const f2 = await this.post({ url: p2, data: o2, ...a2 }), g2 = f2.header && f2.header["x-tcb-trace"];
      if (g2 && this._localCache.setStore(s2, g2), 200 !== Number(f2.status) && 200 !== Number(f2.statusCode) || !f2.data)
        throw new re({ code: "NETWORK_ERROR", message: "network request error" });
      return f2;
    }
    async send(e2, t2 = {}, n2 = {}) {
      const s2 = await this.request(e2, t2, { ...n2, onUploadProgress: t2.onUploadProgress });
      if (("ACCESS_TOKEN_DISABLED" === s2.data.code || "ACCESS_TOKEN_EXPIRED" === s2.data.code) && -1 === Ze.indexOf(e2)) {
        await this.oauth.refreshAccessToken();
        const s3 = await this.request(e2, t2, { ...n2, onUploadProgress: t2.onUploadProgress });
        if (s3.data.code)
          throw new re({ code: s3.data.code, message: Ce(s3.data.message) });
        return s3.data;
      }
      if (s2.data.code)
        throw new re({ code: s2.data.code, message: Ce(s2.data.message) });
      return s2.data;
    }
    setRefreshToken(e2) {
      const { accessTokenKey: t2, accessTokenExpireKey: n2, refreshTokenKey: s2 } = this._cache.keys;
      this._cache.removeStore(t2), this._cache.removeStore(n2), this._cache.setStore(s2, e2);
    }
  }
  const rt = {};
  function it(e2) {
    return rt[e2];
  }
  class ot {
    constructor(e2) {
      this.config = e2, this._cache = qe(e2.env), this._request = it(e2.env);
    }
    setRefreshToken(e2) {
      const { accessTokenKey: t2, accessTokenExpireKey: n2, refreshTokenKey: s2 } = this._cache.keys;
      this._cache.removeStore(t2), this._cache.removeStore(n2), this._cache.setStore(s2, e2);
    }
    setAccessToken(e2, t2) {
      const { accessTokenKey: n2, accessTokenExpireKey: s2 } = this._cache.keys;
      this._cache.setStore(n2, e2), this._cache.setStore(s2, t2);
    }
    async refreshUserInfo() {
      const { data: e2 } = await this._request.send("auth.getUserInfo", {});
      return this.setLocalUserInfo(e2), e2;
    }
    setLocalUserInfo(e2) {
      const { userInfoKey: t2 } = this._cache.keys;
      this._cache.setStore(t2, e2);
    }
  }
  class at {
    constructor(e2) {
      if (!e2)
        throw new re({ code: "PARAM_ERROR", message: "envId is not defined" });
      this._envId = e2, this._cache = qe(this._envId), this._request = it(this._envId), this.setUserInfo();
    }
    linkWithTicket(e2) {
      if ("string" != typeof e2)
        throw new re({ code: "PARAM_ERROR", message: "ticket must be string" });
      return this._request.send("auth.linkWithTicket", { ticket: e2 });
    }
    linkWithRedirect(e2) {
      e2.signInWithRedirect();
    }
    updatePassword(e2, t2) {
      return this._request.send("auth.updatePassword", { oldPassword: t2, newPassword: e2 });
    }
    updateEmail(e2) {
      return this._request.send("auth.updateEmail", { newEmail: e2 });
    }
    updateUsername(e2) {
      if ("string" != typeof e2)
        throw new re({ code: "PARAM_ERROR", message: "username must be a string" });
      return this._request.send("auth.updateUsername", { username: e2 });
    }
    async getLinkedUidList() {
      const { data: e2 } = await this._request.send("auth.getLinkedUidList", {});
      let t2 = false;
      const { users: n2 } = e2;
      return n2.forEach((e3) => {
        e3.wxOpenId && e3.wxPublicId && (t2 = true);
      }), { users: n2, hasPrimaryUid: t2 };
    }
    setPrimaryUid(e2) {
      return this._request.send("auth.setPrimaryUid", { uid: e2 });
    }
    unlink(e2) {
      return this._request.send("auth.unlink", { platform: e2 });
    }
    async update(e2) {
      const { nickName: t2, gender: n2, avatarUrl: s2, province: r2, country: i2, city: o2 } = e2, { data: a2 } = await this._request.send("auth.updateUserInfo", { nickName: t2, gender: n2, avatarUrl: s2, province: r2, country: i2, city: o2 });
      this.setLocalUserInfo(a2);
    }
    async refresh() {
      const e2 = await this._request.oauth.getUserInfo();
      return this.setLocalUserInfo(e2), e2;
    }
    setUserInfo() {
      const { userInfoKey: e2 } = this._cache.keys, t2 = this._cache.getStore(e2);
      ["uid", "loginType", "openid", "wxOpenId", "wxPublicId", "unionId", "qqMiniOpenId", "email", "hasPassword", "customUserId", "nickName", "gender", "avatarUrl"].forEach((e3) => {
        this[e3] = t2[e3];
      }), this.location = { country: t2.country, province: t2.province, city: t2.city };
    }
    setLocalUserInfo(e2) {
      const { userInfoKey: t2 } = this._cache.keys;
      this._cache.setStore(t2, e2), this.setUserInfo();
    }
  }
  class ct {
    constructor(e2) {
      if (!e2)
        throw new re({ code: "PARAM_ERROR", message: "envId is not defined" });
      this._cache = qe(e2);
      const { refreshTokenKey: t2, accessTokenKey: n2, accessTokenExpireKey: s2 } = this._cache.keys, r2 = this._cache.getStore(t2), i2 = this._cache.getStore(n2), o2 = this._cache.getStore(s2);
      this.credential = { refreshToken: r2, accessToken: i2, accessTokenExpire: o2 }, this.user = new at(e2);
    }
    get isAnonymousAuth() {
      return this.loginType === Qe.ANONYMOUS;
    }
    get isCustomAuth() {
      return this.loginType === Qe.CUSTOM;
    }
    get isWeixinAuth() {
      return this.loginType === Qe.WECHAT || this.loginType === Qe.WECHAT_OPEN || this.loginType === Qe.WECHAT_PUBLIC;
    }
    get loginType() {
      return this._cache.getStore(this._cache.keys.loginTypeKey);
    }
  }
  class ut extends ot {
    async signIn() {
      this._cache.updatePersistence("local"), await this._request.oauth.getAccessToken(), Be(He), Be(ze, { env: this.config.env, loginType: Qe.ANONYMOUS, persistence: "local" });
      const e2 = new ct(this.config.env);
      return await e2.user.refresh(), e2;
    }
    async linkAndRetrieveDataWithTicket(e2) {
      const { anonymousUuidKey: t2, refreshTokenKey: n2 } = this._cache.keys, s2 = this._cache.getStore(t2), r2 = this._cache.getStore(n2), i2 = await this._request.send("auth.linkAndRetrieveDataWithTicket", { anonymous_uuid: s2, refresh_token: r2, ticket: e2 });
      if (i2.refresh_token)
        return this._clearAnonymousUUID(), this.setRefreshToken(i2.refresh_token), await this._request.refreshAccessToken(), Be(Ve, { env: this.config.env }), Be(ze, { loginType: Qe.CUSTOM, persistence: "local" }), { credential: { refreshToken: i2.refresh_token } };
      throw new re({ message: "匿名转化失败" });
    }
    _setAnonymousUUID(e2) {
      const { anonymousUuidKey: t2, loginTypeKey: n2 } = this._cache.keys;
      this._cache.removeStore(t2), this._cache.setStore(t2, e2), this._cache.setStore(n2, Qe.ANONYMOUS);
    }
    _clearAnonymousUUID() {
      this._cache.removeStore(this._cache.keys.anonymousUuidKey);
    }
  }
  class lt extends ot {
    async signIn(e2) {
      if ("string" != typeof e2)
        throw new re({ code: "PARAM_ERROR", message: "ticket must be a string" });
      const { refreshTokenKey: t2 } = this._cache.keys, n2 = await this._request.send("auth.signInWithTicket", { ticket: e2, refresh_token: this._cache.getStore(t2) || "" });
      if (n2.refresh_token)
        return this.setRefreshToken(n2.refresh_token), await this._request.refreshAccessToken(), Be(He), Be(ze, { env: this.config.env, loginType: Qe.CUSTOM, persistence: this.config.persistence }), await this.refreshUserInfo(), new ct(this.config.env);
      throw new re({ message: "自定义登录失败" });
    }
  }
  class ht extends ot {
    async signIn(e2, t2) {
      if ("string" != typeof e2)
        throw new re({ code: "PARAM_ERROR", message: "email must be a string" });
      const { refreshTokenKey: n2 } = this._cache.keys, s2 = await this._request.send("auth.signIn", { loginType: "EMAIL", email: e2, password: t2, refresh_token: this._cache.getStore(n2) || "" }), { refresh_token: r2, access_token: i2, access_token_expire: o2 } = s2;
      if (r2)
        return this.setRefreshToken(r2), i2 && o2 ? this.setAccessToken(i2, o2) : await this._request.refreshAccessToken(), await this.refreshUserInfo(), Be(He), Be(ze, { env: this.config.env, loginType: Qe.EMAIL, persistence: this.config.persistence }), new ct(this.config.env);
      throw s2.code ? new re({ code: s2.code, message: `邮箱登录失败: ${s2.message}` }) : new re({ message: "邮箱登录失败" });
    }
    async activate(e2) {
      return this._request.send("auth.activateEndUserMail", { token: e2 });
    }
    async resetPasswordWithToken(e2, t2) {
      return this._request.send("auth.resetPasswordWithToken", { token: e2, newPassword: t2 });
    }
  }
  class dt extends ot {
    async signIn(e2, t2) {
      if ("string" != typeof e2)
        throw new re({ code: "PARAM_ERROR", message: "username must be a string" });
      "string" != typeof t2 && (t2 = "", console.warn("password is empty"));
      const { refreshTokenKey: n2 } = this._cache.keys, s2 = await this._request.send("auth.signIn", { loginType: Qe.USERNAME, username: e2, password: t2, refresh_token: this._cache.getStore(n2) || "" }), { refresh_token: r2, access_token_expire: i2, access_token: o2 } = s2;
      if (r2)
        return this.setRefreshToken(r2), o2 && i2 ? this.setAccessToken(o2, i2) : await this._request.refreshAccessToken(), await this.refreshUserInfo(), Be(He), Be(ze, { env: this.config.env, loginType: Qe.USERNAME, persistence: this.config.persistence }), new ct(this.config.env);
      throw s2.code ? new re({ code: s2.code, message: `用户名密码登录失败: ${s2.message}` }) : new re({ message: "用户名密码登录失败" });
    }
  }
  class pt {
    constructor(e2) {
      this.config = e2, this._cache = qe(e2.env), this._request = it(e2.env), this._onAnonymousConverted = this._onAnonymousConverted.bind(this), this._onLoginTypeChanged = this._onLoginTypeChanged.bind(this), $e(ze, this._onLoginTypeChanged);
    }
    get currentUser() {
      const e2 = this.hasLoginState();
      return e2 && e2.user || null;
    }
    get loginType() {
      return this._cache.getStore(this._cache.keys.loginTypeKey);
    }
    anonymousAuthProvider() {
      return new ut(this.config);
    }
    customAuthProvider() {
      return new lt(this.config);
    }
    emailAuthProvider() {
      return new ht(this.config);
    }
    usernameAuthProvider() {
      return new dt(this.config);
    }
    async signInAnonymously() {
      return new ut(this.config).signIn();
    }
    async signInWithEmailAndPassword(e2, t2) {
      return new ht(this.config).signIn(e2, t2);
    }
    signInWithUsernameAndPassword(e2, t2) {
      return new dt(this.config).signIn(e2, t2);
    }
    async linkAndRetrieveDataWithTicket(e2) {
      this._anonymousAuthProvider || (this._anonymousAuthProvider = new ut(this.config)), $e(Ve, this._onAnonymousConverted);
      return await this._anonymousAuthProvider.linkAndRetrieveDataWithTicket(e2);
    }
    async signOut() {
      if (this.loginType === Qe.ANONYMOUS)
        throw new re({ message: "匿名用户不支持登出操作" });
      const { refreshTokenKey: e2, accessTokenKey: t2, accessTokenExpireKey: n2 } = this._cache.keys, s2 = this._cache.getStore(e2);
      if (!s2)
        return;
      const r2 = await this._request.send("auth.logout", { refresh_token: s2 });
      return this._cache.removeStore(e2), this._cache.removeStore(t2), this._cache.removeStore(n2), Be(He), Be(ze, { env: this.config.env, loginType: Qe.NULL, persistence: this.config.persistence }), r2;
    }
    async signUpWithEmailAndPassword(e2, t2) {
      return this._request.send("auth.signUpWithEmailAndPassword", { email: e2, password: t2 });
    }
    async sendPasswordResetEmail(e2) {
      return this._request.send("auth.sendPasswordResetEmail", { email: e2 });
    }
    onLoginStateChanged(e2) {
      $e(He, () => {
        const t3 = this.hasLoginState();
        e2.call(this, t3);
      });
      const t2 = this.hasLoginState();
      e2.call(this, t2);
    }
    onLoginStateExpired(e2) {
      $e(Je, e2.bind(this));
    }
    onAccessTokenRefreshed(e2) {
      $e(Ge, e2.bind(this));
    }
    onAnonymousConverted(e2) {
      $e(Ve, e2.bind(this));
    }
    onLoginTypeChanged(e2) {
      $e(ze, () => {
        const t2 = this.hasLoginState();
        e2.call(this, t2);
      });
    }
    async getAccessToken() {
      return { accessToken: (await this._request.getAccessToken()).accessToken, env: this.config.env };
    }
    hasLoginState() {
      const { accessTokenKey: e2, accessTokenExpireKey: t2 } = this._cache.keys, n2 = this._cache.getStore(e2), s2 = this._cache.getStore(t2);
      return this._request.oauth.isAccessTokenExpired(n2, s2) ? null : new ct(this.config.env);
    }
    async isUsernameRegistered(e2) {
      if ("string" != typeof e2)
        throw new re({ code: "PARAM_ERROR", message: "username must be a string" });
      const { data: t2 } = await this._request.send("auth.isUsernameRegistered", { username: e2 });
      return t2 && t2.isRegistered;
    }
    getLoginState() {
      return Promise.resolve(this.hasLoginState());
    }
    async signInWithTicket(e2) {
      return new lt(this.config).signIn(e2);
    }
    shouldRefreshAccessToken(e2) {
      this._request._shouldRefreshAccessTokenHook = e2.bind(this);
    }
    getUserInfo() {
      return this._request.send("auth.getUserInfo", {}).then((e2) => e2.code ? e2 : { ...e2.data, requestId: e2.seqId });
    }
    getAuthHeader() {
      const { refreshTokenKey: e2, accessTokenKey: t2 } = this._cache.keys, n2 = this._cache.getStore(e2);
      return { "x-cloudbase-credentials": this._cache.getStore(t2) + "/@@/" + n2 };
    }
    _onAnonymousConverted(e2) {
      const { env: t2 } = e2.data;
      t2 === this.config.env && this._cache.updatePersistence(this.config.persistence);
    }
    _onLoginTypeChanged(e2) {
      const { loginType: t2, persistence: n2, env: s2 } = e2.data;
      s2 === this.config.env && (this._cache.updatePersistence(n2), this._cache.setStore(this._cache.keys.loginTypeKey, t2));
    }
  }
  const ft = function(e2, t2) {
    t2 = t2 || ke();
    const n2 = it(this.config.env), { cloudPath: s2, filePath: r2, onUploadProgress: i2, fileType: o2 = "image" } = e2;
    return n2.send("storage.getUploadMetadata", { path: s2 }).then((e3) => {
      const { data: { url: a2, authorization: c2, token: u2, fileId: l2, cosFileId: h2 }, requestId: d2 } = e3, p2 = { key: s2, signature: c2, "x-cos-meta-fileid": h2, success_action_status: "201", "x-cos-security-token": u2 };
      n2.upload({ url: a2, data: p2, file: r2, name: s2, fileType: o2, onUploadProgress: i2 }).then((e4) => {
        201 === e4.statusCode ? t2(null, { fileID: l2, requestId: d2 }) : t2(new re({ code: "STORAGE_REQUEST_FAIL", message: `STORAGE_REQUEST_FAIL: ${e4.data}` }));
      }).catch((e4) => {
        t2(e4);
      });
    }).catch((e3) => {
      t2(e3);
    }), t2.promise;
  }, gt = function(e2, t2) {
    t2 = t2 || ke();
    const n2 = it(this.config.env), { cloudPath: s2 } = e2;
    return n2.send("storage.getUploadMetadata", { path: s2 }).then((e3) => {
      t2(null, e3);
    }).catch((e3) => {
      t2(e3);
    }), t2.promise;
  }, mt = function({ fileList: e2 }, t2) {
    if (t2 = t2 || ke(), !e2 || !Array.isArray(e2))
      return { code: "INVALID_PARAM", message: "fileList必须是非空的数组" };
    for (let t3 of e2)
      if (!t3 || "string" != typeof t3)
        return { code: "INVALID_PARAM", message: "fileList的元素必须是非空的字符串" };
    const n2 = { fileid_list: e2 };
    return it(this.config.env).send("storage.batchDeleteFile", n2).then((e3) => {
      e3.code ? t2(null, e3) : t2(null, { fileList: e3.data.delete_list, requestId: e3.requestId });
    }).catch((e3) => {
      t2(e3);
    }), t2.promise;
  }, yt = function({ fileList: e2 }, t2) {
    t2 = t2 || ke(), e2 && Array.isArray(e2) || t2(null, { code: "INVALID_PARAM", message: "fileList必须是非空的数组" });
    let n2 = [];
    for (let s3 of e2)
      "object" == typeof s3 ? (s3.hasOwnProperty("fileID") && s3.hasOwnProperty("maxAge") || t2(null, { code: "INVALID_PARAM", message: "fileList的元素必须是包含fileID和maxAge的对象" }), n2.push({ fileid: s3.fileID, max_age: s3.maxAge })) : "string" == typeof s3 ? n2.push({ fileid: s3 }) : t2(null, { code: "INVALID_PARAM", message: "fileList的元素必须是字符串" });
    const s2 = { file_list: n2 };
    return it(this.config.env).send("storage.batchGetDownloadUrl", s2).then((e3) => {
      e3.code ? t2(null, e3) : t2(null, { fileList: e3.data.download_list, requestId: e3.requestId });
    }).catch((e3) => {
      t2(e3);
    }), t2.promise;
  }, _t = async function({ fileID: e2 }, t2) {
    const n2 = (await yt.call(this, { fileList: [{ fileID: e2, maxAge: 600 }] })).fileList[0];
    if ("SUCCESS" !== n2.code)
      return t2 ? t2(n2) : new Promise((e3) => {
        e3(n2);
      });
    const s2 = it(this.config.env);
    let r2 = n2.download_url;
    if (r2 = encodeURI(r2), !t2)
      return s2.download({ url: r2 });
    t2(await s2.download({ url: r2 }));
  }, wt = function({ name: e2, data: t2, query: n2, parse: s2, search: r2, timeout: i2 }, o2) {
    const a2 = o2 || ke();
    let c2;
    try {
      c2 = t2 ? JSON.stringify(t2) : "";
    } catch (e3) {
      return Promise.reject(e3);
    }
    if (!e2)
      return Promise.reject(new re({ code: "PARAM_ERROR", message: "函数名不能为空" }));
    const u2 = { inQuery: n2, parse: s2, search: r2, function_name: e2, request_data: c2 };
    return it(this.config.env).send("functions.invokeFunction", u2, { timeout: i2 }).then((e3) => {
      if (e3.code)
        a2(null, e3);
      else {
        let t3 = e3.data.response_data;
        if (s2)
          a2(null, { result: t3, requestId: e3.requestId });
        else
          try {
            t3 = JSON.parse(e3.data.response_data), a2(null, { result: t3, requestId: e3.requestId });
          } catch (e4) {
            a2(new re({ message: "response data must be json" }));
          }
      }
      return a2.promise;
    }).catch((e3) => {
      a2(e3);
    }), a2.promise;
  }, vt = { timeout: 15e3, persistence: "session" }, It = {};
  class St {
    constructor(e2) {
      this.config = e2 || this.config, this.authObj = void 0;
    }
    init(e2) {
      switch (xe.adapter || (this.requestClient = new xe.adapter.reqClass({ timeout: e2.timeout || 5e3, timeoutMsg: `请求在${(e2.timeout || 5e3) / 1e3}s内未完成，已中断` })), this.config = { ...vt, ...e2 }, true) {
        case this.config.timeout > 6e5:
          console.warn("timeout大于可配置上限[10分钟]，已重置为上限数值"), this.config.timeout = 6e5;
          break;
        case this.config.timeout < 100:
          console.warn("timeout小于可配置下限[100ms]，已重置为下限数值"), this.config.timeout = 100;
      }
      return new St(this.config);
    }
    auth({ persistence: e2 } = {}) {
      if (this.authObj)
        return this.authObj;
      const t2 = e2 || xe.adapter.primaryStorage || vt.persistence;
      var n2;
      return t2 !== this.config.persistence && (this.config.persistence = t2), function(e3) {
        const { env: t3 } = e3;
        De[t3] = new Ne(e3), Me[t3] = new Ne({ ...e3, persistence: "local" });
      }(this.config), n2 = this.config, rt[n2.env] = new st(n2), this.authObj = new pt(this.config), this.authObj;
    }
    on(e2, t2) {
      return $e.apply(this, [e2, t2]);
    }
    off(e2, t2) {
      return We.apply(this, [e2, t2]);
    }
    callFunction(e2, t2) {
      return wt.apply(this, [e2, t2]);
    }
    deleteFile(e2, t2) {
      return mt.apply(this, [e2, t2]);
    }
    getTempFileURL(e2, t2) {
      return yt.apply(this, [e2, t2]);
    }
    downloadFile(e2, t2) {
      return _t.apply(this, [e2, t2]);
    }
    uploadFile(e2, t2) {
      return ft.apply(this, [e2, t2]);
    }
    getUploadMetadata(e2, t2) {
      return gt.apply(this, [e2, t2]);
    }
    registerExtension(e2) {
      It[e2.name] = e2;
    }
    async invokeExtension(e2, t2) {
      const n2 = It[e2];
      if (!n2)
        throw new re({ message: `扩展${e2} 必须先注册` });
      return await n2.invoke(t2, this);
    }
    useAdapters(e2) {
      const { adapter: t2, runtime: n2 } = Ee(e2) || {};
      t2 && (xe.adapter = t2), n2 && (xe.runtime = n2);
    }
  }
  var bt = new St();
  function kt(e2, t2, n2) {
    void 0 === n2 && (n2 = {});
    var s2 = /\?/.test(t2), r2 = "";
    for (var i2 in n2)
      "" === r2 ? !s2 && (t2 += "?") : r2 += "&", r2 += i2 + "=" + encodeURIComponent(n2[i2]);
    return /^http(s)?:\/\//.test(t2 += r2) ? t2 : "" + e2 + t2;
  }
  class At {
    get(e2) {
      const { url: t2, data: n2, headers: s2, timeout: r2 } = e2;
      return new Promise((e3, i2) => {
        ie.request({ url: kt("https:", t2), data: n2, method: "GET", header: s2, timeout: r2, success(t3) {
          e3(t3);
        }, fail(e4) {
          i2(e4);
        } });
      });
    }
    post(e2) {
      const { url: t2, data: n2, headers: s2, timeout: r2 } = e2;
      return new Promise((e3, i2) => {
        ie.request({ url: kt("https:", t2), data: n2, method: "POST", header: s2, timeout: r2, success(t3) {
          e3(t3);
        }, fail(e4) {
          i2(e4);
        } });
      });
    }
    upload(e2) {
      return new Promise((t2, n2) => {
        const { url: s2, file: r2, data: i2, headers: o2, fileType: a2 } = e2, c2 = ie.uploadFile({ url: kt("https:", s2), name: "file", formData: Object.assign({}, i2), filePath: r2, fileType: a2, header: o2, success(e3) {
          const n3 = { statusCode: e3.statusCode, data: e3.data || {} };
          200 === e3.statusCode && i2.success_action_status && (n3.statusCode = parseInt(i2.success_action_status, 10)), t2(n3);
        }, fail(e3) {
          n2(new Error(e3.errMsg || "uploadFile:fail"));
        } });
        "function" == typeof e2.onUploadProgress && c2 && "function" == typeof c2.onProgressUpdate && c2.onProgressUpdate((t3) => {
          e2.onUploadProgress({ loaded: t3.totalBytesSent, total: t3.totalBytesExpectedToSend });
        });
      });
    }
  }
  const Tt = { setItem(e2, t2) {
    ie.setStorageSync(e2, t2);
  }, getItem: (e2) => ie.getStorageSync(e2), removeItem(e2) {
    ie.removeStorageSync(e2);
  }, clear() {
    ie.clearStorageSync();
  } };
  var Ct = { genAdapter: function() {
    return { root: {}, reqClass: At, localStorage: Tt, primaryStorage: "local" };
  }, isMatch: function() {
    return true;
  }, runtime: "uni_app" };
  bt.useAdapters(Ct);
  const Pt = bt, Ot = Pt.init;
  Pt.init = function(e2) {
    e2.env = e2.spaceId;
    const t2 = Ot.call(this, e2);
    t2.config.provider = "tencent", t2.config.spaceId = e2.spaceId;
    const n2 = t2.auth;
    return t2.auth = function(e3) {
      const t3 = n2.call(this, e3);
      return ["linkAndRetrieveDataWithTicket", "signInAnonymously", "signOut", "getAccessToken", "getLoginState", "signInWithTicket", "getUserInfo"].forEach((e4) => {
        var n3;
        t3[e4] = (n3 = t3[e4], function(e5) {
          e5 = e5 || {};
          const { success: t4, fail: s2, complete: r2 } = se(e5);
          if (!(t4 || s2 || r2))
            return n3.call(this, e5);
          n3.call(this, e5).then((e6) => {
            t4 && t4(e6), r2 && r2(e6);
          }, (e6) => {
            s2 && s2(e6), r2 && r2(e6);
          });
        }).bind(t3);
      }), t3;
    }, t2.customAuth = t2.auth, t2;
  };
  var Et = Pt;
  async function xt(e2, t2) {
    const n2 = `http://${e2}:${t2}/system/ping`;
    try {
      const e3 = await (s2 = { url: n2, timeout: 500 }, new Promise((e4, t3) => {
        ie.request({ ...s2, success(t4) {
          e4(t4);
        }, fail(e5) {
          t3(e5);
        } });
      }));
      return !(!e3.data || 0 !== e3.data.code);
    } catch (e3) {
      return false;
    }
    var s2;
  }
  async function Lt(e2, t2) {
    let n2;
    for (let s2 = 0; s2 < e2.length; s2++) {
      const r2 = e2[s2];
      if (await xt(r2, t2)) {
        n2 = r2;
        break;
      }
    }
    return { address: n2, port: t2 };
  }
  const Ut = { "serverless.file.resource.generateProximalSign": "storage/generate-proximal-sign", "serverless.file.resource.report": "storage/report", "serverless.file.resource.delete": "storage/delete", "serverless.file.resource.getTempFileURL": "storage/get-temp-file-url" };
  var Rt = class {
    constructor(e2) {
      if (["spaceId", "clientSecret"].forEach((t2) => {
        if (!Object.prototype.hasOwnProperty.call(e2, t2))
          throw new Error(`${t2} required`);
      }), !e2.endpoint)
        throw new Error("集群空间未配置ApiEndpoint，配置后需要重新关联服务空间后生效");
      this.config = Object.assign({}, e2), this.config.provider = "dcloud", this.config.requestUrl = this.config.endpoint + "/client", this.config.envType = this.config.envType || "public", this.adapter = ie;
    }
    async request(e2, t2 = true) {
      const n2 = t2;
      return e2 = n2 ? await this.setupLocalRequest(e2) : this.setupRequest(e2), Promise.resolve().then(() => n2 ? this.requestLocal(e2) : ge.wrappedRequest(e2, this.adapter.request));
    }
    requestLocal(e2) {
      return new Promise((t2, n2) => {
        this.adapter.request(Object.assign(e2, { complete(e3) {
          if (e3 || (e3 = {}), !e3.statusCode || e3.statusCode >= 400) {
            const t3 = e3.data && e3.data.code || "SYS_ERR", s2 = e3.data && e3.data.message || "request:fail";
            return n2(new re({ code: t3, message: s2 }));
          }
          t2({ success: true, result: e3.data });
        } }));
      });
    }
    setupRequest(e2) {
      const t2 = Object.assign({}, e2, { spaceId: this.config.spaceId, timestamp: Date.now() }), n2 = { "Content-Type": "application/json" };
      n2["x-serverless-sign"] = ge.sign(t2, this.config.clientSecret);
      const s2 = fe();
      n2["x-client-info"] = encodeURIComponent(JSON.stringify(s2));
      const { token: r2 } = ae();
      return n2["x-client-token"] = r2, { url: this.config.requestUrl, method: "POST", data: t2, dataType: "json", header: JSON.parse(JSON.stringify(n2)) };
    }
    async setupLocalRequest(e2) {
      const t2 = fe(), { token: n2 } = ae(), s2 = Object.assign({}, e2, { spaceId: this.config.spaceId, timestamp: Date.now(), clientInfo: t2, token: n2 }), { address: r2, servePort: i2 } = this.__dev__ && this.__dev__.debugInfo || {}, { address: o2 } = await Lt(r2, i2);
      return { url: `http://${o2}:${i2}/${Ut[e2.method]}`, method: "POST", data: s2, dataType: "json", header: JSON.parse(JSON.stringify({ "Content-Type": "application/json" })) };
    }
    callFunction(e2) {
      const t2 = { method: "serverless.function.runtime.invoke", params: JSON.stringify({ functionTarget: e2.name, functionArgs: e2.data || {} }) };
      return this.request(t2, false);
    }
    getUploadFileOptions(e2) {
      const t2 = { method: "serverless.file.resource.generateProximalSign", params: JSON.stringify(e2) };
      return this.request(t2);
    }
    reportUploadFile(e2) {
      const t2 = { method: "serverless.file.resource.report", params: JSON.stringify(e2) };
      return this.request(t2);
    }
    uploadFile({ filePath: e2, cloudPath: t2, fileType: n2 = "image", onUploadProgress: s2 }) {
      if (!t2)
        throw new re({ code: "CLOUDPATH_REQUIRED", message: "cloudPath不可为空" });
      let r2;
      return this.getUploadFileOptions({ cloudPath: t2 }).then((t3) => {
        const { url: i2, formData: o2, name: a2 } = t3.result;
        return r2 = t3.result.fileUrl, new Promise((t4, r3) => {
          const c2 = this.adapter.uploadFile({ url: i2, formData: o2, name: a2, filePath: e2, fileType: n2, success(e3) {
            e3 && e3.statusCode < 400 ? t4(e3) : r3(new re({ code: "UPLOAD_FAILED", message: "文件上传失败" }));
          }, fail(e3) {
            r3(new re({ code: e3.code || "UPLOAD_FAILED", message: e3.message || e3.errMsg || "文件上传失败" }));
          } });
          "function" == typeof s2 && c2 && "function" == typeof c2.onProgressUpdate && c2.onProgressUpdate((e3) => {
            s2({ loaded: e3.totalBytesSent, total: e3.totalBytesExpectedToSend });
          });
        });
      }).then(() => this.reportUploadFile({ cloudPath: t2 })).then((t3) => new Promise((n3, s3) => {
        t3.success ? n3({ success: true, filePath: e2, fileID: r2 }) : s3(new re({ code: "UPLOAD_FAILED", message: "文件上传失败" }));
      }));
    }
    deleteFile({ fileList: e2 }) {
      const t2 = { method: "serverless.file.resource.delete", params: JSON.stringify({ fileList: e2 }) };
      return this.request(t2).then((e3) => {
        if (e3.success)
          return e3.result;
        throw new re({ code: "DELETE_FILE_FAILED", message: "删除文件失败" });
      });
    }
    getTempFileURL({ fileList: e2, maxAge: t2 } = {}) {
      if (!Array.isArray(e2) || 0 === e2.length)
        throw new re({ code: "INVALID_PARAM", message: "fileList的元素必须是非空的字符串" });
      const n2 = { method: "serverless.file.resource.getTempFileURL", params: JSON.stringify({ fileList: e2, maxAge: t2 }) };
      return this.request(n2).then((e3) => {
        if (e3.success)
          return { fileList: e3.result.fileList.map((e4) => ({ fileID: e4.fileID, tempFileURL: e4.tempFileURL })) };
        throw new re({ code: "GET_TEMP_FILE_URL_FAILED", message: "获取临时文件链接失败" });
      });
    }
  };
  var Nt = { init(e2) {
    const t2 = new Rt(e2), n2 = { signInAnonymously: function() {
      return Promise.resolve();
    }, getLoginState: function() {
      return Promise.resolve(false);
    } };
    return t2.auth = function() {
      return n2;
    }, t2.customAuth = t2.auth, t2;
  } }, Dt = n(function(e2, t2) {
    e2.exports = r.enc.Hex;
  });
  function Mt() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(e2) {
      var t2 = 16 * Math.random() | 0;
      return ("x" === e2 ? t2 : 3 & t2 | 8).toString(16);
    });
  }
  function qt(e2 = "", t2 = {}) {
    const { data: n2, functionName: s2, method: r2, headers: i2, signHeaderKeys: o2 = [], config: a2 } = t2, c2 = String(Date.now()), u2 = Mt(), l2 = Object.assign({}, i2, { "x-from-app-id": a2.spaceAppId, "x-from-env-id": a2.spaceId, "x-to-env-id": a2.spaceId, "x-from-instance-id": c2, "x-from-function-name": s2, "x-client-timestamp": c2, "x-alipay-source": "client", "x-request-id": u2, "x-alipay-callid": u2, "x-trace-id": u2 }), h2 = ["x-from-app-id", "x-from-env-id", "x-to-env-id", "x-from-instance-id", "x-from-function-name", "x-client-timestamp"].concat(o2), [d2 = "", p2 = ""] = e2.split("?") || [], f2 = function(e3) {
      const t3 = e3.signedHeaders.join(";"), n3 = e3.signedHeaders.map((t4) => `${t4.toLowerCase()}:${e3.headers[t4]}
`).join(""), s3 = Se(e3.body).toString(Dt), r3 = `${e3.method.toUpperCase()}
${e3.path}
${e3.query}
${n3}
${t3}
${s3}
`, i3 = Se(r3).toString(Dt), o3 = `HMAC-SHA256
${e3.timestamp}
${i3}
`, a3 = be(o3, e3.secretKey).toString(Dt);
      return `HMAC-SHA256 Credential=${e3.secretId}, SignedHeaders=${t3}, Signature=${a3}`;
    }({ path: d2, query: p2, method: r2, headers: l2, timestamp: c2, body: JSON.stringify(n2), secretId: a2.accessKey, secretKey: a2.secretKey, signedHeaders: h2.sort() });
    return { url: `${a2.endpoint}${e2}`, headers: Object.assign({}, l2, { Authorization: f2 }) };
  }
  function Ft({ url: e2, data: t2, method: n2 = "POST", headers: s2 = {}, timeout: r2 }) {
    return new Promise((i2, o2) => {
      ie.request({ url: e2, method: n2, data: "object" == typeof t2 ? JSON.stringify(t2) : t2, header: s2, dataType: "json", timeout: r2, complete: (e3 = {}) => {
        const t3 = s2["x-trace-id"] || "";
        if (!e3.statusCode || e3.statusCode >= 400) {
          const { message: n3, errMsg: s3, trace_id: r3 } = e3.data || {};
          return o2(new re({ code: "SYS_ERR", message: n3 || s3 || "request:fail", requestId: r3 || t3 }));
        }
        i2({ status: e3.statusCode, data: e3.data, headers: e3.header, requestId: t3 });
      } });
    });
  }
  function Kt(e2, t2) {
    const { path: n2, data: s2, method: r2 = "GET" } = e2, { url: i2, headers: o2 } = qt(n2, { functionName: "", data: s2, method: r2, headers: { "x-alipay-cloud-mode": "oss", "x-data-api-type": "oss", "x-expire-timestamp": String(Date.now() + 6e4) }, signHeaderKeys: ["x-data-api-type", "x-expire-timestamp"], config: t2 });
    return Ft({ url: i2, data: s2, method: r2, headers: o2 }).then((e3) => {
      const t3 = e3.data || {};
      if (!t3.success)
        throw new re({ code: e3.errCode, message: e3.errMsg, requestId: e3.requestId });
      return t3.data || {};
    }).catch((e3) => {
      throw new re({ code: e3.errCode, message: e3.errMsg, requestId: e3.requestId });
    });
  }
  function jt(e2 = "") {
    const t2 = e2.trim().replace(/^cloud:\/\//, ""), n2 = t2.indexOf("/");
    if (n2 <= 0)
      throw new re({ code: "INVALID_PARAM", message: "fileID不合法" });
    const s2 = t2.substring(0, n2), r2 = t2.substring(n2 + 1);
    return s2 !== this.config.spaceId && console.warn("file ".concat(e2, " does not belong to env ").concat(this.config.spaceId)), r2;
  }
  function $t(e2 = "") {
    return "cloud://".concat(this.config.spaceId, "/").concat(e2.replace(/^\/+/, ""));
  }
  class Bt {
    constructor(e2) {
      this.config = e2;
    }
    signedURL(e2, t2 = {}) {
      const n2 = `/ws/function/${e2}`, s2 = this.config.wsEndpoint.replace(/^ws(s)?:\/\//, ""), r2 = Object.assign({}, t2, { accessKeyId: this.config.accessKey, signatureNonce: Mt(), timestamp: "" + Date.now() }), i2 = [n2, ["accessKeyId", "authorization", "signatureNonce", "timestamp"].sort().map(function(e3) {
        return r2[e3] ? "".concat(e3, "=").concat(r2[e3]) : null;
      }).filter(Boolean).join("&"), `host:${s2}`].join("\n"), o2 = ["HMAC-SHA256", Se(i2).toString(Dt)].join("\n"), a2 = be(o2, this.config.secretKey).toString(Dt), c2 = Object.keys(r2).map((e3) => `${e3}=${encodeURIComponent(r2[e3])}`).join("&");
      return `${this.config.wsEndpoint}${n2}?${c2}&signature=${a2}`;
    }
  }
  class Wt {
    constructor(e2) {
      this.config = e2;
    }
    signedURL(e2, t2 = {}) {
      const n2 = `/ws/sse/function/${e2}`, s2 = this.config.endpoint.replace(/^http(s)?:\/\//, ""), r2 = Object.assign({}, t2, { accessKeyId: this.config.accessKey, signatureNonce: Mt(), timestamp: "" + Date.now() }), i2 = ["accessKeyId", "authorization", "signatureNonce", "timestamp"].sort().map(function(e3) {
        return r2[e3] ? "".concat(e3, "=").concat(r2[e3]) : null;
      }).filter(Boolean).join("&"), o2 = [n2.replace("/ws", ""), i2, `host:${s2}`].join("\n"), a2 = ["HMAC-SHA256", Se(o2).toString(Dt)].join("\n"), c2 = be(a2, this.config.secretKey).toString(Dt), u2 = Object.keys(r2).map((e3) => `${e3}=${encodeURIComponent(r2[e3])}`).join("&");
      return `${this.config.endpoint}${n2}?${u2}&signature=${c2}`;
    }
  }
  var Ht = class {
    constructor(e2) {
      if (["spaceId", "spaceAppId", "accessKey", "secretKey"].forEach((t2) => {
        if (!Object.prototype.hasOwnProperty.call(e2, t2))
          throw new Error(`${t2} required`);
      }), e2.endpoint) {
        if ("string" != typeof e2.endpoint)
          throw new Error("endpoint must be string");
        if (!/^https:\/\//.test(e2.endpoint))
          throw new Error("endpoint must start with https://");
        e2.endpoint = e2.endpoint.replace(/\/$/, "");
      }
      this.config = Object.assign({}, e2, { endpoint: e2.endpoint || `https://${e2.spaceId}.api-hz.cloudbasefunction.cn`, wsEndpoint: e2.wsEndpoint || `wss://${e2.spaceId}.api-hz.cloudbasefunction.cn` }), this._websocket = new Bt(this.config), this._sse = new Wt(this.config);
    }
    callFunction(e2) {
      return function(e3, t2) {
        const { name: n2, data: s2, async: r2 = false, timeout: i2 } = e3, o2 = "POST", a2 = { "x-to-function-name": n2 };
        r2 && (a2["x-function-invoke-type"] = "async");
        const { url: c2, headers: u2 } = qt("/functions/invokeFunction", { functionName: n2, data: s2, method: o2, headers: a2, signHeaderKeys: ["x-to-function-name"], config: t2 });
        return Ft({ url: c2, data: s2, method: o2, headers: u2, timeout: i2 }).then((e4) => {
          let t3 = 0;
          if (r2) {
            const n3 = e4.data || {};
            t3 = "200" === n3.errCode ? 0 : n3.errCode, e4.data = n3.data || {}, e4.errMsg = n3.errMsg;
          }
          if (0 !== t3)
            throw new re({ code: t3, message: e4.errMsg, requestId: e4.requestId });
          return { errCode: t3, success: 0 === t3, requestId: e4.requestId, result: e4.data };
        }).catch((e4) => {
          throw new re({ code: e4.errCode, message: e4.errMsg, requestId: e4.requestId });
        });
      }(e2, this.config);
    }
    uploadFileToOSS({ url: e2, filePath: t2, fileType: n2, formData: s2, onUploadProgress: r2 }) {
      return new Promise((i2, o2) => {
        const a2 = ie.uploadFile({ url: e2, filePath: t2, fileType: n2, formData: s2, name: "file", success(e3) {
          e3 && e3.statusCode < 400 ? i2(e3) : o2(new re({ code: "UPLOAD_FAILED", message: "文件上传失败" }));
        }, fail(e3) {
          o2(new re({ code: e3.code || "UPLOAD_FAILED", message: e3.message || e3.errMsg || "文件上传失败" }));
        } });
        "function" == typeof r2 && a2 && "function" == typeof a2.onProgressUpdate && a2.onProgressUpdate((e3) => {
          r2({ loaded: e3.totalBytesSent, total: e3.totalBytesExpectedToSend });
        });
      });
    }
    async uploadFile({ filePath: e2, cloudPath: t2 = "", fileType: n2 = "image", onUploadProgress: s2 }) {
      if ("string" !== f(t2))
        throw new re({ code: "INVALID_PARAM", message: "cloudPath必须为字符串类型" });
      if (!(t2 = t2.trim()))
        throw new re({ code: "INVALID_PARAM", message: "cloudPath不可为空" });
      if (/:\/\//.test(t2))
        throw new re({ code: "INVALID_PARAM", message: "cloudPath不合法" });
      const r2 = await Kt({ path: "/".concat(t2.replace(/^\//, ""), "?post_url") }, this.config), { file_id: i2, upload_url: o2, form_data: a2 } = r2, c2 = a2 && a2.reduce((e3, t3) => (e3[t3.key] = t3.value, e3), {});
      return this.uploadFileToOSS({ url: o2, filePath: e2, fileType: n2, formData: c2, onUploadProgress: s2 }).then(() => ({ fileID: i2 }));
    }
    async getTempFileURL({ fileList: e2 }) {
      return new Promise((t2, n2) => {
        (!e2 || e2.length < 0) && t2({ code: "INVALID_PARAM", message: "fileList不能为空数组" }), e2.length > 50 && t2({ code: "INVALID_PARAM", message: "fileList数组长度不能超过50" });
        const s2 = [];
        for (const n3 of e2) {
          let e3;
          "string" !== f(n3) && t2({ code: "INVALID_PARAM", message: "fileList的元素必须是非空的字符串" });
          try {
            e3 = jt.call(this, n3);
          } catch (t3) {
            console.warn(t3.errCode, t3.errMsg), e3 = n3;
          }
          s2.push({ file_id: e3, expire: 600 });
        }
        Kt({ path: "/?download_url", data: { file_list: s2 }, method: "POST" }, this.config).then((e3) => {
          const { file_list: n3 = [] } = e3;
          t2({ fileList: n3.map((e4) => ({ fileID: $t.call(this, e4.file_id), tempFileURL: e4.download_url })) });
        }).catch((e3) => n2(e3));
      });
    }
    async connectWebSocket(e2) {
      const { name: t2, query: n2 } = e2;
      return ie.connectSocket({ url: this._websocket.signedURL(t2, n2), complete: () => {
      } });
    }
    requestSSE(e2) {
      const { name: t2, data: n2 } = e2;
      return ie.request({ method: "POST", url: this._sse.signedURL(t2), data: n2, header: { "content-type": "application/json" }, dataType: "json" });
    }
  };
  var Jt = { init: (e2) => {
    e2.provider = "alipay";
    const t2 = new Ht(e2);
    return t2.auth = function() {
      return { signInAnonymously: function() {
        return Promise.resolve();
      }, getLoginState: function() {
        return Promise.resolve(true);
      } };
    }, t2;
  } };
  function zt({ data: e2 }) {
    let t2;
    t2 = fe();
    const n2 = JSON.parse(JSON.stringify(e2 || {}));
    if (Object.assign(n2, { clientInfo: t2 }), !n2.uniIdToken) {
      const { token: e3 } = ae();
      e3 && (n2.uniIdToken = e3);
    }
    return n2;
  }
  const Vt = { enable: false, interval: 0, space: {} };
  let Gt = null, Qt = 0, Yt = false;
  function Xt() {
    return Array.isArray(P) && P.length ? P[0] : {};
  }
  function Zt(e2) {
    return `${e2}_${Xt().spaceId || "default"}`;
  }
  function en() {
    if (Gt)
      return Gt;
    try {
      const e2 = ie.getStorageSync(Zt("UNICLOUD_FAILOVER_CONFIG"));
      if (g(e2))
        return Gt = e2, e2;
    } catch (e2) {
    }
    return null;
  }
  function tn(e2) {
    Qt = e2;
    try {
      ie.setStorageSync(Zt("UNICLOUD_FAILOVER_LAST_REQUEST"), e2);
    } catch (e3) {
    }
  }
  function nn(e2) {
    if (null === e2 || e2 < 0)
      return false;
    if (0 === e2)
      return true;
    const t2 = function() {
      if (Qt)
        return Qt;
      try {
        const e3 = ie.getStorageSync(Zt("UNICLOUD_FAILOVER_LAST_REQUEST"));
        if (e3 && "number" == typeof e3)
          return Qt = e3, e3;
      } catch (e3) {
      }
      return 0;
    }();
    if (!t2)
      return true;
    return Date.now() - t2 >= e2;
  }
  async function sn() {
    const e2 = Xt(), { failoverEndpoint: t2 } = e2;
    if (!t2)
      return null;
    if (Yt)
      return en();
    Yt = true;
    try {
      const e3 = `${t2}/.unicloud/failover-cfg.json`, n2 = await ie.request({ url: e3, method: "GET", dataType: "json", timeout: 5e3 });
      if (tn(Date.now()), 200 !== n2.statusCode || !g(n2.data))
        return null;
      const s2 = { ...Vt, ...n2.data }, { enable: r2 = false, interval: i2 = 0, space: o2 = {} } = s2, a2 = en(), c2 = a2 && a2.enable, u2 = function(e4, t3) {
        if (!e4)
          return t3.enable;
        if (e4.enable !== t3.enable)
          return true;
        if (e4.interval !== t3.interval)
          return true;
        if (t3._lastModifiedAt && e4._lastModifiedAt !== t3._lastModifiedAt)
          return true;
        if (JSON.stringify(e4.space) !== JSON.stringify(t3.space))
          return true;
        return false;
      }(a2, s2);
      return function(e4) {
        try {
          Gt = e4, e4 && e4.enable ? ie.setStorageSync(Zt("UNICLOUD_FAILOVER_CONFIG"), e4) : (ie.removeStorageSync(Zt("UNICLOUD_FAILOVER_CONFIG")), ie.removeStorageSync(Zt("UNICLOUD_FAILOVER_LAST_REQUEST")));
        } catch (e5) {
        }
      }({ enable: r2, interval: i2, space: o2, _lastModifiedAt: n2.data._lastModifiedAt || Date.now() }), u2 && Z(J, { isEnabled: r2, hasStatusChanged: c2 !== r2, failoverSpace: o2 }), s2;
    } catch (e3) {
      return en();
    } finally {
      Yt = false;
    }
  }
  async function rn(e2 = {}) {
    await this.__dev__.initLocalNetwork();
    const { localAddress: t2, localPort: n2 } = this.__dev__, s2 = Xt(), r2 = { aliyun: "aliyun", tencent: "tcb", alipay: "alipay", dcloud: "dcloud" }[s2.provider], i2 = s2.spaceId, o2 = `http://${t2}:${n2}/system/check-function`, a2 = `http://${t2}:${n2}/cloudfunctions/${e2.name}`;
    return new Promise((t3, n3) => {
      ie.request({ method: "POST", url: o2, data: { name: e2.name, platform: T, provider: r2, spaceId: i2 }, timeout: 3e3, success(e3) {
        t3(e3);
      }, fail() {
        t3({ data: { code: "NETWORK_ERROR", message: "连接本地调试服务失败，请检查客户端是否和主机在同一局域网下，自动切换为已部署的云函数。" } });
      } });
    }).then(({ data: e3 } = {}) => {
      const { code: t3, message: n3 } = e3 || {};
      return { code: 0 === t3 ? 0 : t3 || "SYS_ERR", message: n3 || "SYS_ERR" };
    }).then(({ code: t3, message: n3 }) => {
      if (0 !== t3) {
        switch (t3) {
          case "MODULE_ENCRYPTED":
            console.error(`此云函数（${e2.name}）依赖加密公共模块不可本地调试，自动切换为云端已部署的云函数`);
            break;
          case "FUNCTION_ENCRYPTED":
            console.error(`此云函数（${e2.name}）已加密不可本地调试，自动切换为云端已部署的云函数`);
            break;
          case "ACTION_ENCRYPTED":
            console.error(n3 || "需要访问加密的uni-clientDB-action，自动切换为云端环境");
            break;
          case "NETWORK_ERROR":
            console.error(n3 || "连接本地调试服务失败，请检查客户端是否和主机在同一局域网下");
            break;
          case "SWITCH_TO_CLOUD":
            break;
          default: {
            const e3 = `检测本地调试服务出现错误：${n3}，请检查网络环境或重启客户端再试`;
            throw console.error(e3), new Error(e3);
          }
        }
        return this._callCloudFunction(e2);
      }
      return new Promise((t4, n4) => {
        const s3 = zt.call(this, { data: e2.data });
        ie.request({ method: "POST", url: a2, data: { provider: r2, platform: T, param: s3 }, timeout: e2.timeout, success: ({ statusCode: e3, data: s4 } = {}) => !e3 || e3 >= 400 ? n4(new re({ code: s4.code || "SYS_ERR", message: s4.message || "request:fail" })) : t4({ result: s4 }), fail(e3) {
          n4(new re({ code: e3.code || e3.errCode || "SYS_ERR", message: e3.message || e3.errMsg || "request:fail" }));
        } });
      });
    });
  }
  const on = [{ rule: /fc_function_not_found|FUNCTION_NOT_FOUND/, content: "，云函数[{functionName}]在云端不存在，请检查此云函数名称是否正确以及该云函数是否已上传到服务空间", mode: "append" }];
  var an = /[\\^$.*+?()[\]{}|]/g, cn = RegExp(an.source);
  function un(e2, t2, n2) {
    return e2.replace(new RegExp((s2 = t2) && cn.test(s2) ? s2.replace(an, "\\$&") : s2, "g"), n2);
    var s2;
  }
  const hn = "request", dn = "response", pn = "both", fn = { code: 2e4, message: "System error" }, gn = { code: 20101, message: "Invalid client" };
  function _n(e2) {
    const { errSubject: t2, subject: n2, errCode: s2, errMsg: r2, code: i2, message: o2, cause: a2 } = e2 || {};
    return new re({ subject: t2 || n2 || "uni-secure-network", code: s2 || i2 || fn.code, message: r2 || o2, cause: a2 });
  }
  let ts;
  function os({ secretType: e2 } = {}) {
    return e2 === hn || e2 === dn || e2 === pn;
  }
  function as({ name: e2, data: t2 = {} } = {}) {
    return "DCloud-clientDB" === e2 && "encryption" === t2.redirectTo && "getAppClientKey" === t2.action;
  }
  function cs({ provider: e2, spaceId: t2, functionName: n2 } = {}) {
    const { appId: s2, uniPlatform: r2, osName: i2 } = he();
    let o2 = r2;
    "app" === r2 && (o2 = i2);
    const a2 = function({ provider: e3, spaceId: t3 } = {}) {
      const n3 = A;
      if (!n3)
        return {};
      e3 = /* @__PURE__ */ function(e4) {
        return "tencent" === e4 ? "tcb" : e4;
      }(e3);
      const s3 = n3.find((n4) => n4.provider === e3 && n4.spaceId === t3);
      return s3 && s3.config;
    }({ provider: e2, spaceId: t2 });
    if (!a2 || !a2.accessControl || !a2.accessControl.enable)
      return false;
    const c2 = a2.accessControl.function || {}, u2 = Object.keys(c2);
    if (0 === u2.length)
      return true;
    const l2 = function(e3, t3) {
      let n3, s3, r3;
      for (let i3 = 0; i3 < e3.length; i3++) {
        const o3 = e3[i3];
        o3 !== t3 ? "*" !== o3 ? o3.split(",").map((e4) => e4.trim()).indexOf(t3) > -1 && (s3 = o3) : r3 = o3 : n3 = o3;
      }
      return n3 || s3 || r3;
    }(u2, n2);
    if (!l2)
      return false;
    if ((c2[l2] || []).find((e3 = {}) => e3.appId === s2 && (e3.platform || "").toLowerCase() === o2.toLowerCase()))
      return true;
    throw console.error(`此应用[appId: ${s2}, platform: ${o2}]不在云端配置的允许访问的应用列表内，参考：https://uniapp.dcloud.net.cn/uniCloud/secure-network.html#verify-client`), _n(gn);
  }
  function us({ functionName: e2, result: t2, logPvd: n2 }) {
    if (this.__dev__.debugLog && t2 && t2.requestId) {
      const s2 = JSON.stringify({ spaceId: this.config.spaceId, functionName: e2, requestId: t2.requestId });
      console.log(`[${n2}-request]${s2}[/${n2}-request]`);
    }
  }
  function ls(e2) {
    const t2 = e2.callFunction, n2 = function(n3) {
      const s2 = n3.name;
      n3.data = zt.call(e2, { data: n3.data });
      const r2 = { aliyun: "aliyun", tencent: "tcb", tcb: "tcb", alipay: "alipay", dcloud: "dcloud" }[this.config.provider], i2 = os(n3), o2 = as(n3), a2 = i2 || o2;
      return t2.call(this, n3).then((e3) => (e3.errCode = 0, !a2 && us.call(this, { functionName: s2, result: e3, logPvd: r2 }), Promise.resolve(e3)), (e3) => (!a2 && us.call(this, { functionName: s2, result: e3, logPvd: r2 }), e3 && e3.message && (e3.message = function({ message: e4 = "", extraInfo: t3 = {}, formatter: n4 = [] } = {}) {
        for (let s3 = 0; s3 < n4.length; s3++) {
          const { rule: r3, content: i3, mode: o3 } = n4[s3], a3 = e4.match(r3);
          if (!a3)
            continue;
          let c2 = i3;
          for (let e5 = 1; e5 < a3.length; e5++)
            c2 = un(c2, `{$${e5}}`, a3[e5]);
          for (const e5 in t3)
            c2 = un(c2, `{${e5}}`, t3[e5]);
          return "replace" === o3 ? c2 : e4 + c2;
        }
        return e4;
      }({ message: `[${n3.name}]: ${e3.message}`, formatter: on, extraInfo: { functionName: s2 } })), Promise.reject(e3)));
    };
    e2.callFunction = function(t3) {
      const { provider: s2, spaceId: r2 } = e2.config, i2 = t3.name;
      let o2, a2;
      if (t3.data = t3.data || {}, e2.__dev__.debugInfo && !e2.__dev__.debugInfo.forceRemote && P ? (e2._callCloudFunction || (e2._callCloudFunction = n2, e2._callLocalFunction = rn), o2 = rn) : o2 = n2, o2 = o2.bind(e2), as(t3))
        a2 = n2.call(e2, t3);
      else if (os(t3)) {
        a2 = new ts({ secretType: t3.secretType, uniCloudIns: e2 }).wrapEncryptDataCallFunction(n2.bind(e2))(t3);
      } else if (cs({ provider: s2, spaceId: r2, functionName: i2 })) {
        a2 = new ts({ secretType: t3.secretType, uniCloudIns: e2 }).wrapVerifyClientCallFunction(n2.bind(e2))(t3);
      } else
        a2 = o2(t3);
      return Object.defineProperty(a2, "result", { get: () => (console.warn("当前返回结果为Promise类型，不可直接访问其result属性，详情请参考：https://uniapp.dcloud.net.cn/uniCloud/faq?id=promise"), {}) }), a2.then((e3) => e3);
    };
  }
  ts = class {
    constructor() {
      throw _n({ message: `Platform ${T} is not enabled, please check whether secure network module is enabled in your manifest.json` });
    }
  };
  const hs = Symbol("CLIENT_DB_INTERNAL");
  function ds(e2, t2) {
    return e2.then = "DoNotReturnProxyWithAFunctionNamedThen", e2._internalType = hs, e2.inspect = null, e2.__v_raw = void 0, new Proxy(e2, { get(e3, n2, s2) {
      if ("_uniClient" === n2)
        return null;
      if ("symbol" == typeof n2)
        return e3[n2];
      if (n2 in e3 || "string" != typeof n2) {
        const t3 = e3[n2];
        return "function" == typeof t3 ? t3.bind(e3) : t3;
      }
      return t2.get(e3, n2, s2);
    } });
  }
  function ps(e2) {
    return { on: (t2, n2) => {
      e2[t2] = e2[t2] || [], e2[t2].indexOf(n2) > -1 || e2[t2].push(n2);
    }, off: (t2, n2) => {
      e2[t2] = e2[t2] || [];
      const s2 = e2[t2].indexOf(n2);
      -1 !== s2 && e2[t2].splice(s2, 1);
    } };
  }
  const fs = ["db.Geo", "db.command", "command.aggregate"];
  function gs(e2, t2) {
    return fs.indexOf(`${e2}.${t2}`) > -1;
  }
  function ms(e2) {
    switch (f(e2 = oe(e2))) {
      case "array":
        return e2.map((e3) => ms(e3));
      case "object":
        return e2._internalType === hs || Object.keys(e2).forEach((t2) => {
          e2[t2] = ms(e2[t2]);
        }), e2;
      case "regexp":
        return { $regexp: { source: e2.source, flags: e2.flags } };
      case "date":
        return { $date: e2.toISOString() };
      default:
        return e2;
    }
  }
  function ys(e2) {
    return e2 && e2.content && e2.content.$method;
  }
  class _s {
    constructor(e2, t2, n2) {
      this.content = e2, this.prevStage = t2 || null, this.udb = null, this._database = n2;
    }
    toJSON() {
      let e2 = this;
      const t2 = [e2.content];
      for (; e2.prevStage; )
        e2 = e2.prevStage, t2.push(e2.content);
      return { $db: t2.reverse().map((e3) => ({ $method: e3.$method, $param: ms(e3.$param) })) };
    }
    toString() {
      return JSON.stringify(this.toJSON());
    }
    getAction() {
      const e2 = this.toJSON().$db.find((e3) => "action" === e3.$method);
      return e2 && e2.$param && e2.$param[0];
    }
    getCommand() {
      return { $db: this.toJSON().$db.filter((e2) => "action" !== e2.$method) };
    }
    get isAggregate() {
      let e2 = this;
      for (; e2; ) {
        const t2 = ys(e2), n2 = ys(e2.prevStage);
        if ("aggregate" === t2 && "collection" === n2 || "pipeline" === t2)
          return true;
        e2 = e2.prevStage;
      }
      return false;
    }
    get isCommand() {
      let e2 = this;
      for (; e2; ) {
        if ("command" === ys(e2))
          return true;
        e2 = e2.prevStage;
      }
      return false;
    }
    get isAggregateCommand() {
      let e2 = this;
      for (; e2; ) {
        const t2 = ys(e2), n2 = ys(e2.prevStage);
        if ("aggregate" === t2 && "command" === n2)
          return true;
        e2 = e2.prevStage;
      }
      return false;
    }
    getNextStageFn(e2) {
      const t2 = this;
      return function() {
        return ws({ $method: e2, $param: ms(Array.from(arguments)) }, t2, t2._database);
      };
    }
    get count() {
      return this.isAggregate ? this.getNextStageFn("count") : function() {
        return this._send("count", Array.from(arguments));
      };
    }
    get remove() {
      return this.isCommand ? this.getNextStageFn("remove") : function() {
        return this._send("remove", Array.from(arguments));
      };
    }
    get() {
      return this._send("get", Array.from(arguments));
    }
    get add() {
      return this.isCommand ? this.getNextStageFn("add") : function() {
        return this._send("add", Array.from(arguments));
      };
    }
    update() {
      return this._send("update", Array.from(arguments));
    }
    end() {
      return this._send("end", Array.from(arguments));
    }
    get set() {
      return this.isCommand ? this.getNextStageFn("set") : function() {
        throw new Error("JQL禁止使用set方法");
      };
    }
    _send(e2, t2) {
      const n2 = this.getAction(), s2 = this.getCommand();
      if (s2.$db.push({ $method: e2, $param: ms(t2) }), S) {
        const e3 = s2.$db.find((e4) => "collection" === e4.$method), t3 = e3 && e3.$param;
        t3 && 1 === t3.length && "string" == typeof e3.$param[0] && e3.$param[0].indexOf(",") > -1 && console.warn("检测到使用JQL语法联表查询时，未使用getTemp先过滤主表数据，在主表数据量大的情况下可能会查询缓慢。\n- 如何优化请参考此文档：https://uniapp.dcloud.net.cn/uniCloud/jql?id=lookup-with-temp \n- 如果主表数据量很小请忽略此信息，项目发行时不会出现此提示。");
      }
      return this._database._callCloudFunction({ action: n2, command: s2 });
    }
  }
  function ws(e2, t2, n2) {
    return ds(new _s(e2, t2, n2), { get(e3, t3) {
      let s2 = "db";
      return e3 && e3.content && (s2 = e3.content.$method), gs(s2, t3) ? ws({ $method: t3 }, e3, n2) : function() {
        return ws({ $method: t3, $param: ms(Array.from(arguments)) }, e3, n2);
      };
    } });
  }
  function vs({ path: e2, method: t2 }) {
    return class {
      constructor() {
        this.param = Array.from(arguments);
      }
      toJSON() {
        return { $newDb: [...e2.map((e3) => ({ $method: e3 })), { $method: t2, $param: this.param }] };
      }
      toString() {
        return JSON.stringify(this.toJSON());
      }
    };
  }
  function Is(e2, t2 = {}) {
    return ds(new e2(t2), { get: (e3, t3) => gs("db", t3) ? ws({ $method: t3 }, null, e3) : function() {
      return ws({ $method: t3, $param: ms(Array.from(arguments)) }, null, e3);
    } });
  }
  class Ss extends class {
    constructor({ uniClient: e2 = {}, isJQL: t2 = false } = {}) {
      this._uniClient = e2, this._authCallBacks = {}, this._dbCallBacks = {}, e2._isDefault && (this._dbCallBacks = U("_globalUniCloudDatabaseCallback")), t2 || (this.auth = ps(this._authCallBacks)), this._isJQL = t2, Object.assign(this, ps(this._dbCallBacks)), this.env = ds({}, { get: (e3, t3) => ({ $env: t3 }) }), this.Geo = ds({}, { get: (e3, t3) => vs({ path: ["Geo"], method: t3 }) }), this.serverDate = vs({ path: [], method: "serverDate" }), this.RegExp = vs({ path: [], method: "RegExp" });
    }
    getCloudEnv(e2) {
      if ("string" != typeof e2 || !e2.trim())
        throw new Error("getCloudEnv参数错误");
      return { $env: e2.replace("$cloudEnv_", "") };
    }
    _callback(e2, t2) {
      const n2 = this._dbCallBacks;
      n2[e2] && n2[e2].forEach((e3) => {
        e3(...t2);
      });
    }
    _callbackAuth(e2, t2) {
      const n2 = this._authCallBacks;
      n2[e2] && n2[e2].forEach((e3) => {
        e3(...t2);
      });
    }
    multiSend() {
      const e2 = Array.from(arguments), t2 = e2.map((e3) => {
        const t3 = e3.getAction(), n2 = e3.getCommand();
        if ("getTemp" !== n2.$db[n2.$db.length - 1].$method)
          throw new Error("multiSend只支持子命令内使用getTemp");
        return { action: t3, command: n2 };
      });
      return this._callCloudFunction({ multiCommand: t2, queryList: e2 });
    }
    startTransaction() {
      throw new Error("JQL 事务仅支持在云端使用");
    }
    commit() {
      throw new Error("JQL 事务仅支持在云端使用");
    }
    rollback() {
      throw new Error("JQL 事务仅支持在云端使用");
    }
  } {
    _parseResult(e2) {
      return this._isJQL ? e2.result : e2;
    }
    _callCloudFunction({ action: e2, command: t2, multiCommand: n2, queryList: s2 }) {
      function r2(e3, t3) {
        if (n2 && s2)
          for (let n3 = 0; n3 < s2.length; n3++) {
            const r3 = s2[n3];
            r3.udb && "function" == typeof r3.udb.setResult && (t3 ? r3.udb.setResult(t3) : r3.udb.setResult(e3.result.dataList[n3]));
          }
      }
      const i2 = this, o2 = this._isJQL ? "databaseForJQL" : "database";
      function a2(e3) {
        return i2._callback("error", [e3]), F(K(o2, "fail"), e3).then(() => F(K(o2, "complete"), e3)).then(() => (r2(null, e3), Z(B, { type: z, content: e3 }), Promise.reject(e3)));
      }
      const c2 = F(K(o2, "invoke")), u2 = this._uniClient;
      return c2.then(() => u2.callFunction({ name: "DCloud-clientDB", type: l, data: { action: e2, command: t2, multiCommand: n2 } })).then((e3) => {
        const { code: t3, message: n3, token: s3, tokenExpired: c3, systemInfo: u3 = [] } = e3.result;
        if (u3)
          for (let e4 = 0; e4 < u3.length; e4++) {
            const { level: t4, message: n4, detail: s4 } = u3[e4], r3 = console["warn" === t4 ? "error" : t4] || console.log;
            let i3 = "[System Info]" + n4;
            s4 && (i3 = `${i3}
详细信息：${s4}`), r3(i3);
          }
        if (t3) {
          return a2(new re({ code: t3, message: n3, requestId: e3.requestId }));
        }
        e3.result.errCode = e3.result.errCode || e3.result.code, e3.result.errMsg = e3.result.errMsg || e3.result.message, s3 && c3 && (ce({ token: s3, tokenExpired: c3 }), this._callbackAuth("refreshToken", [{ token: s3, tokenExpired: c3 }]), this._callback("refreshToken", [{ token: s3, tokenExpired: c3 }]), Z(H, { token: s3, tokenExpired: c3 }));
        const l2 = [{ prop: "affectedDocs", tips: "affectedDocs不再推荐使用，请使用inserted/deleted/updated/data.length替代" }, { prop: "code", tips: "code不再推荐使用，请使用errCode替代" }, { prop: "message", tips: "message不再推荐使用，请使用errMsg替代" }];
        for (let t4 = 0; t4 < l2.length; t4++) {
          const { prop: n4, tips: s4 } = l2[t4];
          if (n4 in e3.result) {
            const t5 = e3.result[n4];
            Object.defineProperty(e3.result, n4, { get: () => (console.warn(s4), t5) });
          }
        }
        return function(e4) {
          return F(K(o2, "success"), e4).then(() => F(K(o2, "complete"), e4)).then(() => {
            r2(e4, null);
            const t4 = i2._parseResult(e4);
            return Z(B, { type: z, content: t4 }), Promise.resolve(t4);
          });
        }(e3);
      }, (e3) => {
        /fc_function_not_found|FUNCTION_NOT_FOUND/g.test(e3.message) && console.warn("clientDB未初始化，请在web控制台保存一次schema以开启clientDB");
        return a2(new re({ code: e3.code || "SYSTEM_ERROR", message: e3.message, requestId: e3.requestId }));
      });
    }
  }
  const bs = "token无效，跳转登录页面", ks = "token过期，跳转登录页面", As = { TOKEN_INVALID_TOKEN_EXPIRED: ks, TOKEN_INVALID_INVALID_CLIENTID: bs, TOKEN_INVALID: bs, TOKEN_INVALID_WRONG_TOKEN: bs, TOKEN_INVALID_ANONYMOUS_USER: bs }, Ts = { "uni-id-token-expired": ks, "uni-id-check-token-failed": bs, "uni-id-token-not-exist": bs, "uni-id-check-device-feature-failed": bs }, Cs = { ...As, ...Ts, default: "用户未登录或登录状态过期，自动跳转登录页面" };
  function Ps(e2, t2) {
    let n2 = "";
    return n2 = e2 ? `${e2}/${t2}` : t2, n2.replace(/^\//, "");
  }
  function Os(e2 = [], t2 = "") {
    const n2 = [], s2 = [];
    return e2.forEach((e3) => {
      true === e3.needLogin ? n2.push(Ps(t2, e3.path)) : false === e3.needLogin && s2.push(Ps(t2, e3.path));
    }), { needLoginPage: n2, notNeedLoginPage: s2 };
  }
  function Es(e2) {
    return e2.split("?")[0].replace(/^\//, "");
  }
  function xs() {
    return function(e2) {
      let t2 = e2 && e2.$page && e2.$page.fullPath;
      return t2 ? ("/" !== t2.charAt(0) && (t2 = "/" + t2), t2) : "";
    }(function() {
      const e2 = getCurrentPages();
      return e2[e2.length - 1];
    }());
  }
  function Ls() {
    return Es(xs());
  }
  function Us(e2 = "", t2 = {}) {
    if (!e2)
      return false;
    if (!(t2 && t2.list && t2.list.length))
      return false;
    const n2 = t2.list, s2 = Es(e2);
    return n2.some((e3) => e3.pagePath === s2);
  }
  const Rs = !!e.uniIdRouter;
  const { loginPage: Ns, routerNeedLogin: Ds, resToLogin: Ms, needLoginPage: qs, notNeedLoginPage: Fs, loginPageInTabBar: Ks } = function({ pages: t2 = [], subPackages: n2 = [], uniIdRouter: s2 = {}, tabBar: r2 = {} } = e) {
    const { loginPage: i2, needLogin: o2 = [], resToLogin: a2 = true } = s2, { needLoginPage: c2, notNeedLoginPage: u2 } = Os(t2), { needLoginPage: l2, notNeedLoginPage: h2 } = function(e2 = []) {
      const t3 = [], n3 = [];
      return e2.forEach((e3) => {
        const { root: s3, pages: r3 = [] } = e3, { needLoginPage: i3, notNeedLoginPage: o3 } = Os(r3, s3);
        t3.push(...i3), n3.push(...o3);
      }), { needLoginPage: t3, notNeedLoginPage: n3 };
    }(n2);
    return { loginPage: i2, routerNeedLogin: o2, resToLogin: a2, needLoginPage: [...c2, ...l2], notNeedLoginPage: [...u2, ...h2], loginPageInTabBar: Us(i2, r2) };
  }();
  if (qs.indexOf(Ns) > -1)
    throw new Error(`Login page [${Ns}] should not be "needLogin", please check your pages.json`);
  function js(e2) {
    const t2 = Ls();
    if ("/" === e2.charAt(0))
      return e2;
    const [n2, s2] = e2.split("?"), r2 = n2.replace(/^\//, "").split("/"), i2 = t2.split("/");
    i2.pop();
    for (let e3 = 0; e3 < r2.length; e3++) {
      const t3 = r2[e3];
      ".." === t3 ? i2.pop() : "." !== t3 && i2.push(t3);
    }
    return "" === i2[0] && i2.shift(), "/" + i2.join("/") + (s2 ? "?" + s2 : "");
  }
  function $s(e2, t2) {
    return new RegExp(t2).test(e2);
  }
  function Bs({ redirect: e2 }) {
    const t2 = Es(e2), n2 = Es(Ns);
    return Ls() !== n2 && t2 !== n2;
  }
  function Ws({ api: e2, redirect: t2 } = {}) {
    if (!t2 || !Bs({ redirect: t2 }))
      return;
    const n2 = function(e3, t3) {
      return "/" !== e3.charAt(0) && (e3 = "/" + e3), t3 ? e3.indexOf("?") > -1 ? e3 + `&uniIdRedirectUrl=${encodeURIComponent(t3)}` : e3 + `?uniIdRedirectUrl=${encodeURIComponent(t3)}` : e3;
    }(Ns, t2);
    Ks ? "navigateTo" !== e2 && "redirectTo" !== e2 || (e2 = "switchTab") : "switchTab" === e2 && (e2 = "navigateTo");
    const s2 = { navigateTo: uni.navigateTo, redirectTo: uni.redirectTo, switchTab: uni.switchTab, reLaunch: uni.reLaunch };
    setTimeout(() => {
      s2[e2]({ url: n2 });
    }, 0);
  }
  function Hs({ url: e2 } = {}) {
    const t2 = { abortLoginPageJump: false, autoToLoginPage: false }, n2 = function() {
      const { token: e3, tokenExpired: t3 } = ae();
      let n3;
      if (e3) {
        if (t3 < Date.now()) {
          const e4 = "uni-id-token-expired";
          n3 = { errCode: e4, errMsg: Cs[e4] };
        }
      } else {
        const e4 = "uni-id-check-token-failed";
        n3 = { errCode: e4, errMsg: Cs[e4] };
      }
      return n3;
    }();
    if (function(e3) {
      const t3 = Es(js(e3));
      return !(Fs.indexOf(t3) > -1) && (qs.indexOf(t3) > -1 || Ds.some((n3) => $s(t3, n3) || $s(e3, n3)));
    }(e2) && n2) {
      n2.uniIdRedirectUrl = e2;
      if (Q(W).length > 0)
        return setTimeout(() => {
          Z(W, n2);
        }, 0), t2.abortLoginPageJump = true, t2;
      t2.autoToLoginPage = true;
    }
    return t2;
  }
  function Js() {
    const e2 = xs(), { abortLoginPageJump: t2, autoToLoginPage: n2 } = Hs({ url: e2 });
    t2 || n2 && Ws({ api: "redirectTo", redirect: e2 });
  }
  function zs() {
    Js();
    const e2 = ["navigateTo", "redirectTo", "reLaunch", "switchTab"];
    for (let t2 = 0; t2 < e2.length; t2++) {
      const n2 = e2[t2];
      uni.addInterceptor(n2, { invoke(e3) {
        const { abortLoginPageJump: t3, autoToLoginPage: s2 } = Hs({ url: e3.url });
        return t3 ? e3 : s2 ? (Ws({ api: n2, redirect: js(e3.url) }), false) : e3;
      } });
    }
  }
  function Vs() {
    this.onResponse((e2) => {
      const { type: t2, content: n2 } = e2;
      let s2 = false;
      switch (t2) {
        case "cloudobject":
          s2 = function(e3) {
            if ("object" != typeof e3)
              return false;
            const { errCode: t3 } = e3 || {};
            return t3 in Cs;
          }(n2);
          break;
        case "clientdb":
          s2 = function(e3) {
            if ("object" != typeof e3)
              return false;
            const { errCode: t3 } = e3 || {};
            return t3 in As;
          }(n2);
      }
      s2 && function(e3 = {}) {
        const t3 = Q(W);
        ne().then(() => {
          const n3 = xs();
          if (n3 && Bs({ redirect: n3 }))
            return t3.length > 0 ? Z(W, Object.assign({ uniIdRedirectUrl: n3 }, e3)) : void (Ns && Ws({ api: "navigateTo", redirect: n3 }));
        });
      }(n2);
    });
  }
  function Gs(e2) {
    e2.onNeedLogin = function(e3) {
      Y(W, e3);
    }, e2.offNeedLogin = function(e3) {
      X(W, e3);
    }, Rs && (U("_globalUniCloudStatus").needLoginInit || (U("_globalUniCloudStatus").needLoginInit = true, ne().then(() => {
      zs.call(e2);
    }), Ms && Vs.call(e2)));
  }
  function Qs(e2) {
    e2.onFailover = function(e3) {
      Y(J, e3);
    }, e2.offFailover = function(e3) {
      X(J, e3);
    }, e2.refreshFailoverConfig = function() {
      return e2.config, tn(0), sn();
    }, e2.clearFailoverConfig = function() {
      !function() {
        Gt = null, Qt = 0;
        try {
          ie.removeStorageSync(Zt("UNICLOUD_FAILOVER_CONFIG")), ie.removeStorageSync(Zt("UNICLOUD_FAILOVER_LAST_REQUEST"));
        } catch (e3) {
        }
      }();
    };
  }
  function Ys(e2) {
    !function(e3) {
      e3.onResponse = function(e4) {
        Y(B, e4);
      }, e3.offResponse = function(e4) {
        X(B, e4);
      };
    }(e2), Gs(e2), function(e3) {
      e3.onRefreshToken = function(e4) {
        Y(H, e4);
      }, e3.offRefreshToken = function(e4) {
        X(H, e4);
      };
    }(e2), Qs(e2);
  }
  const Xs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", Zs = /^(?:[A-Za-z\d+/]{4})*?(?:[A-Za-z\d+/]{2}(?:==)?|[A-Za-z\d+/]{3}=?)?$/;
  function er(e2) {
    return decodeURIComponent(function(e3) {
      if (e3 = String(e3).replace(/[\t\n\f\r ]+/g, ""), !Zs.test(e3))
        throw new Error("Failed to execute 'atob' on 'Window': The string to be decoded is not correctly encoded.");
      var t2;
      e3 += "==".slice(2 - (3 & e3.length));
      for (var n2, s2, r2 = "", i2 = 0; i2 < e3.length; )
        t2 = Xs.indexOf(e3.charAt(i2++)) << 18 | Xs.indexOf(e3.charAt(i2++)) << 12 | (n2 = Xs.indexOf(e3.charAt(i2++))) << 6 | (s2 = Xs.indexOf(e3.charAt(i2++))), r2 += 64 === n2 ? String.fromCharCode(t2 >> 16 & 255) : 64 === s2 ? String.fromCharCode(t2 >> 16 & 255, t2 >> 8 & 255) : String.fromCharCode(t2 >> 16 & 255, t2 >> 8 & 255, 255 & t2);
      return r2;
    }(e2).split("").map(function(e3) {
      return "%" + ("00" + e3.charCodeAt(0).toString(16)).slice(-2);
    }).join(""));
  }
  function tr() {
    const e2 = ae().token || "", t2 = e2.split(".");
    if (!e2 || 3 !== t2.length)
      return { uid: null, role: [], permission: [], tokenExpired: 0 };
    let n2;
    try {
      n2 = JSON.parse(er(t2[1]));
    } catch (e3) {
      throw new Error("获取当前用户信息出错，详细错误信息为：" + e3.message);
    }
    return n2.tokenExpired = 1e3 * n2.exp, delete n2.exp, delete n2.iat, n2;
  }
  var nr = n(function(e2, t2) {
    Object.defineProperty(t2, "__esModule", { value: true });
    const n2 = "chooseAndUploadFile:ok", s2 = "chooseAndUploadFile:fail";
    function r2(e3, t3) {
      return e3.tempFiles.forEach((e4, n3) => {
        e4.name || (e4.name = e4.path.substring(e4.path.lastIndexOf("/") + 1)), t3 && (e4.fileType = t3), e4.cloudPath = Date.now() + "_" + n3 + e4.name.substring(e4.name.lastIndexOf("."));
      }), e3.tempFilePaths || (e3.tempFilePaths = e3.tempFiles.map((e4) => e4.path)), e3;
    }
    function i2(e3, t3, { onChooseFile: s3, onUploadProgress: r3 }) {
      return t3.then((e4) => {
        if (s3) {
          const t4 = s3(e4);
          if (void 0 !== t4)
            return Promise.resolve(t4).then((t5) => void 0 === t5 ? e4 : t5);
        }
        return e4;
      }).then((t4) => false === t4 ? { errMsg: n2, tempFilePaths: [], tempFiles: [] } : function(e4, t5, s4 = 5, r4) {
        (t5 = Object.assign({}, t5)).errMsg = n2;
        const i3 = t5.tempFiles, o2 = i3.length;
        let a2 = 0;
        return new Promise((n3) => {
          for (; a2 < s4; )
            c2();
          function c2() {
            const s5 = a2++;
            if (s5 >= o2)
              return void (!i3.find((e5) => !e5.url && !e5.errMsg) && n3(t5));
            const u2 = i3[s5];
            e4.uploadFile({ provider: u2.provider, filePath: u2.path, cloudPath: u2.cloudPath, fileType: u2.fileType, cloudPathAsRealPath: u2.cloudPathAsRealPath, onUploadProgress(e5) {
              e5.index = s5, e5.tempFile = u2, e5.tempFilePath = u2.path, r4 && r4(e5);
            } }).then((e5) => {
              u2.url = e5.fileID, s5 < o2 && c2();
            }).catch((e5) => {
              u2.errMsg = e5.errMsg || e5.message, s5 < o2 && c2();
            });
          }
        });
      }(e3, t4, 5, r3));
    }
    t2.initChooseAndUploadFile = function(e3) {
      return function(t3 = { type: "all" }) {
        return "image" === t3.type ? i2(e3, function(e4) {
          const { count: t4, sizeType: n3, sourceType: i3 = ["album", "camera"], extension: o2 } = e4;
          return new Promise((e5, a2) => {
            uni.chooseImage({ count: t4, sizeType: n3, sourceType: i3, extension: o2, success(t5) {
              e5(r2(t5, "image"));
            }, fail(e6) {
              a2({ errMsg: e6.errMsg.replace("chooseImage:fail", s2) });
            } });
          });
        }(t3), t3) : "video" === t3.type ? i2(e3, function(e4) {
          const { camera: t4, compressed: n3, maxDuration: i3, sourceType: o2 = ["album", "camera"], extension: a2 } = e4;
          return new Promise((e5, c2) => {
            uni.chooseVideo({ camera: t4, compressed: n3, maxDuration: i3, sourceType: o2, extension: a2, success(t5) {
              const { tempFilePath: n4, duration: s3, size: i4, height: o3, width: a3 } = t5;
              e5(r2({ errMsg: "chooseVideo:ok", tempFilePaths: [n4], tempFiles: [{ name: t5.tempFile && t5.tempFile.name || "", path: n4, size: i4, type: t5.tempFile && t5.tempFile.type || "", width: a3, height: o3, duration: s3, fileType: "video", cloudPath: "" }] }, "video"));
            }, fail(e6) {
              c2({ errMsg: e6.errMsg.replace("chooseVideo:fail", s2) });
            } });
          });
        }(t3), t3) : i2(e3, function(e4) {
          const { count: t4, extension: n3 } = e4;
          return new Promise((e5, i3) => {
            let o2 = uni.chooseFile;
            if ("undefined" != typeof wx && "function" == typeof wx.chooseMessageFile && (o2 = wx.chooseMessageFile), "function" != typeof o2)
              return i3({ errMsg: s2 + " 请指定 type 类型，该平台仅支持选择 image 或 video。" });
            o2({ type: "all", count: t4, extension: n3, success(t5) {
              e5(r2(t5));
            }, fail(e6) {
              i3({ errMsg: e6.errMsg.replace("chooseFile:fail", s2) });
            } });
          });
        }(t3), t3);
      };
    };
  }), sr = t(nr);
  const rr = "manual";
  function ir(e2) {
    return { props: { localdata: { type: Array, default: () => [] }, options: { type: [Object, Array], default: () => ({}) }, spaceInfo: { type: Object, default: () => ({}) }, collection: { type: [String, Array], default: "" }, action: { type: String, default: "" }, field: { type: String, default: "" }, orderby: { type: String, default: "" }, where: { type: [String, Object], default: "" }, pageData: { type: String, default: "add" }, pageCurrent: { type: Number, default: 1 }, pageSize: { type: Number, default: 20 }, getcount: { type: [Boolean, String], default: false }, gettree: { type: [Boolean, String], default: false }, gettreepath: { type: [Boolean, String], default: false }, startwith: { type: String, default: "" }, limitlevel: { type: Number, default: 10 }, groupby: { type: String, default: "" }, groupField: { type: String, default: "" }, distinct: { type: [Boolean, String], default: false }, foreignKey: { type: String, default: "" }, loadtime: { type: String, default: "auto" }, manual: { type: Boolean, default: false } }, data: () => ({ mixinDatacomLoading: false, mixinDatacomHasMore: false, mixinDatacomResData: [], mixinDatacomErrorMessage: "", mixinDatacomPage: {}, mixinDatacomError: null }), created() {
      this.mixinDatacomPage = { current: this.pageCurrent, size: this.pageSize, count: 0 }, this.$watch(() => {
        var e3 = [];
        return ["pageCurrent", "pageSize", "localdata", "collection", "action", "field", "orderby", "where", "getont", "getcount", "gettree", "groupby", "groupField", "distinct"].forEach((t2) => {
          e3.push(this[t2]);
        }), e3;
      }, (e3, t2) => {
        if (this.loadtime === rr)
          return;
        let n2 = false;
        const s2 = [];
        for (let r2 = 2; r2 < e3.length; r2++)
          e3[r2] !== t2[r2] && (s2.push(e3[r2]), n2 = true);
        e3[0] !== t2[0] && (this.mixinDatacomPage.current = this.pageCurrent), this.mixinDatacomPage.size = this.pageSize, this.onMixinDatacomPropsChange(n2, s2);
      });
    }, methods: { onMixinDatacomPropsChange(e3, t2) {
    }, mixinDatacomEasyGet({ getone: e3 = false, success: t2, fail: n2 } = {}) {
      this.mixinDatacomLoading || (this.mixinDatacomLoading = true, this.mixinDatacomErrorMessage = "", this.mixinDatacomError = null, this.mixinDatacomGet().then((n3) => {
        this.mixinDatacomLoading = false;
        const { data: s2, count: r2 } = n3.result;
        this.getcount && (this.mixinDatacomPage.count = r2), this.mixinDatacomHasMore = s2.length < this.pageSize;
        const i2 = e3 ? s2.length ? s2[0] : void 0 : s2;
        this.mixinDatacomResData = i2, t2 && t2(i2);
      }).catch((e4) => {
        this.mixinDatacomLoading = false, this.mixinDatacomErrorMessage = e4, this.mixinDatacomError = e4, n2 && n2(e4);
      }));
    }, mixinDatacomGet(t2 = {}) {
      let n2;
      t2 = t2 || {}, n2 = "undefined" != typeof __uniX && __uniX ? e2.databaseForJQL(this.spaceInfo) : e2.database(this.spaceInfo);
      const s2 = t2.action || this.action;
      s2 && (n2 = n2.action(s2));
      const r2 = t2.collection || this.collection;
      n2 = Array.isArray(r2) ? n2.collection(...r2) : n2.collection(r2);
      const i2 = t2.where || this.where;
      i2 && Object.keys(i2).length && (n2 = n2.where(i2));
      const o2 = t2.field || this.field;
      o2 && (n2 = n2.field(o2));
      const a2 = t2.foreignKey || this.foreignKey;
      a2 && (n2 = n2.foreignKey(a2));
      const c2 = t2.groupby || this.groupby;
      c2 && (n2 = n2.groupBy(c2));
      const u2 = t2.groupField || this.groupField;
      u2 && (n2 = n2.groupField(u2));
      true === (void 0 !== t2.distinct ? t2.distinct : this.distinct) && (n2 = n2.distinct());
      const l2 = t2.orderby || this.orderby;
      l2 && (n2 = n2.orderBy(l2));
      const h2 = void 0 !== t2.pageCurrent ? t2.pageCurrent : this.mixinDatacomPage.current, d2 = void 0 !== t2.pageSize ? t2.pageSize : this.mixinDatacomPage.size, p2 = void 0 !== t2.getcount ? t2.getcount : this.getcount, f2 = void 0 !== t2.gettree ? t2.gettree : this.gettree, g2 = void 0 !== t2.gettreepath ? t2.gettreepath : this.gettreepath, m2 = { getCount: p2 }, y2 = { limitLevel: void 0 !== t2.limitlevel ? t2.limitlevel : this.limitlevel, startWith: void 0 !== t2.startwith ? t2.startwith : this.startwith };
      return f2 && (m2.getTree = y2), g2 && (m2.getTreePath = y2), n2 = n2.skip(d2 * (h2 - 1)).limit(d2).get(m2), n2;
    } } };
  }
  function or(e2) {
    return function(t2, n2 = {}) {
      n2 = function(e3, t3 = {}) {
        return e3.customUI = t3.customUI || e3.customUI, e3.parseSystemError = t3.parseSystemError || e3.parseSystemError, Object.assign(e3.loadingOptions, t3.loadingOptions), Object.assign(e3.errorOptions, t3.errorOptions), "object" == typeof t3.secretMethods && (e3.secretMethods = t3.secretMethods), e3;
      }({ customUI: false, loadingOptions: { title: "加载中...", mask: true }, errorOptions: { type: "modal", retry: false } }, n2);
      const { customUI: s2, loadingOptions: r2, errorOptions: i2, parseSystemError: o2 } = n2, a2 = !s2;
      return new Proxy({}, { get(s3, c2) {
        switch (c2) {
          case "toString":
            return "[object UniCloudObject]";
          case "toJSON":
            return {};
        }
        return function({ fn: e3, interceptorName: t3, getCallbackArgs: n3 } = {}) {
          return async function(...s4) {
            const r3 = n3 ? n3({ params: s4 }) : {};
            let i3, o3;
            try {
              return await F(K(t3, "invoke"), { ...r3 }), i3 = await e3(...s4), await F(K(t3, "success"), { ...r3, result: i3 }), i3;
            } catch (e4) {
              throw o3 = e4, await F(K(t3, "fail"), { ...r3, error: o3 }), o3;
            } finally {
              await F(K(t3, "complete"), o3 ? { ...r3, error: o3 } : { ...r3, result: i3 });
            }
          };
        }({ fn: async function s4(...l2) {
          let h2;
          a2 && uni.showLoading({ title: r2.title, mask: r2.mask });
          const d2 = { name: t2, type: u, data: { method: c2, params: l2 } };
          "object" == typeof n2.secretMethods && function(e3, t3) {
            const n3 = t3.data.method, s5 = e3.secretMethods || {}, r3 = s5[n3] || s5["*"];
            r3 && (t3.secretType = r3);
          }(n2, d2);
          let p2 = false;
          try {
            h2 = await e2.callFunction(d2);
          } catch (e3) {
            p2 = true, h2 = { result: new re(e3) };
          }
          const { errSubject: f2, errCode: g2, errMsg: m2, newToken: y2 } = h2.result || {};
          if (a2 && uni.hideLoading(), y2 && y2.token && y2.tokenExpired && (ce(y2), Z(H, { ...y2 })), g2) {
            let e3 = m2;
            if (p2 && o2) {
              e3 = (await o2({ objectName: t2, methodName: c2, params: l2, errSubject: f2, errCode: g2, errMsg: m2 })).errMsg || m2;
            }
            if (a2)
              if ("toast" === i2.type)
                uni.showToast({ title: e3, icon: "none" });
              else {
                if ("modal" !== i2.type)
                  throw new Error(`Invalid errorOptions.type: ${i2.type}`);
                {
                  const { confirm: t3 } = await async function({ title: e4, content: t4, showCancel: n4, cancelText: s5, confirmText: r3 } = {}) {
                    return new Promise((i3, o3) => {
                      uni.showModal({ title: e4, content: t4, showCancel: n4, cancelText: s5, confirmText: r3, success(e5) {
                        i3(e5);
                      }, fail() {
                        i3({ confirm: false, cancel: true });
                      } });
                    });
                  }({ title: "提示", content: e3, showCancel: i2.retry, cancelText: "取消", confirmText: i2.retry ? "重试" : "确定" });
                  if (i2.retry && t3)
                    return s4(...l2);
                }
              }
            const n3 = new re({ subject: f2, code: g2, message: m2, requestId: h2.requestId });
            throw n3.detail = h2.result, Z(B, { type: G, content: n3 }), n3;
          }
          return Z(B, { type: G, content: h2.result }), h2.result;
        }, interceptorName: "callObject", getCallbackArgs: function({ params: e3 } = {}) {
          return { objectName: t2, methodName: c2, params: e3 };
        } });
      } });
    };
  }
  function ar(e2) {
    return U("_globalUniCloudSecureNetworkCache__{spaceId}".replace("{spaceId}", e2.config.spaceId));
  }
  async function cr({ openid: e2, callLoginByWeixin: t2 = false } = {}) {
    ar(this);
    throw new Error(`[SecureNetwork] API \`initSecureNetworkByWeixin\` is not supported on platform \`${T}\``);
  }
  async function ur(e2) {
    const t2 = ar(this);
    return t2.initPromise || (t2.initPromise = cr.call(this, e2).then((e3) => e3).catch((e3) => {
      throw delete t2.initPromise, e3;
    })), t2.initPromise;
  }
  function lr(e2) {
    return function({ openid: t2, callLoginByWeixin: n2 = false } = {}) {
      return ur.call(e2, { openid: t2, callLoginByWeixin: n2 });
    };
  }
  function hr(e2) {
    !function(e3) {
      pe = e3;
    }(e2);
  }
  function dr(e2) {
    const n2 = { getAppBaseInfo: uni.getSystemInfo, getPushClientId: uni.getPushClientId };
    return function(s2) {
      return new Promise((r2, i2) => {
        n2[e2]({ ...s2, success(e3) {
          r2(e3);
        }, fail(e3) {
          i2(e3);
        } });
      });
    };
  }
  class pr extends class {
    constructor() {
      this._callback = {};
    }
    addListener(e2, t2) {
      this._callback[e2] || (this._callback[e2] = []), this._callback[e2].push(t2);
    }
    on(e2, t2) {
      return this.addListener(e2, t2);
    }
    removeListener(e2, t2) {
      if (!t2)
        throw new Error('The "listener" argument must be of type function. Received undefined');
      const n2 = this._callback[e2];
      if (!n2)
        return;
      const s2 = function(e3, t3) {
        for (let n3 = e3.length - 1; n3 >= 0; n3--)
          if (e3[n3] === t3)
            return n3;
        return -1;
      }(n2, t2);
      n2.splice(s2, 1);
    }
    off(e2, t2) {
      return this.removeListener(e2, t2);
    }
    removeAllListener(e2) {
      delete this._callback[e2];
    }
    emit(e2, ...t2) {
      const n2 = this._callback[e2];
      if (n2)
        for (let e3 = 0; e3 < n2.length; e3++)
          n2[e3](...t2);
    }
  } {
    constructor() {
      super(), this._uniPushMessageCallback = this._receivePushMessage.bind(this), this._currentMessageId = -1, this._payloadQueue = [];
    }
    init() {
      return Promise.all([dr("getAppBaseInfo")(), dr("getPushClientId")()]).then(([{ appId: e2 } = {}, { cid: t2 } = {}] = []) => {
        if (!e2)
          throw new Error("Invalid appId, please check the manifest.json file");
        if (!t2)
          throw new Error("Invalid push client id");
        this._appId = e2, this._pushClientId = t2, this._seqId = Date.now() + "-" + Math.floor(9e5 * Math.random() + 1e5), this.emit("open"), this._initMessageListener();
      }, (e2) => {
        throw this.emit("error", e2), this.close(), e2;
      });
    }
    async open() {
      return this.init();
    }
    _isUniCloudSSE(e2) {
      if ("receive" !== e2.type)
        return false;
      const t2 = e2 && e2.data && e2.data.payload;
      return !(!t2 || "UNI_CLOUD_SSE" !== t2.channel || t2.seqId !== this._seqId);
    }
    _receivePushMessage(e2) {
      if (!this._isUniCloudSSE(e2))
        return;
      const t2 = e2 && e2.data && e2.data.payload, { action: n2, messageId: s2, message: r2 } = t2;
      this._payloadQueue.push({ action: n2, messageId: s2, message: r2 }), this._consumMessage();
    }
    _consumMessage() {
      for (; ; ) {
        const e2 = this._payloadQueue.find((e3) => e3.messageId === this._currentMessageId + 1);
        if (!e2)
          break;
        this._currentMessageId++, this._parseMessagePayload(e2);
      }
    }
    _parseMessagePayload(e2) {
      const { action: t2, messageId: n2, message: s2 } = e2;
      "end" === t2 ? this._end({ messageId: n2, message: s2 }) : "message" === t2 && this._appendMessage({ messageId: n2, message: s2 });
    }
    _appendMessage({ messageId: e2, message: t2 } = {}) {
      this.emit("message", t2);
    }
    _end({ messageId: e2, message: t2 } = {}) {
      this.emit("end", t2), this.close();
    }
    _initMessageListener() {
      uni.onPushMessage(this._uniPushMessageCallback);
    }
    _destroy() {
      uni.offPushMessage(this._uniPushMessageCallback);
    }
    toJSON() {
      return { appId: this._appId, pushClientId: this._pushClientId, seqId: this._seqId };
    }
    close() {
      this._destroy(), this.emit("close");
    }
  }
  async function fr(e2) {
    {
      const { osName: e3, osVersion: t3 } = he();
      "ios" === e3 && function(e4) {
        if (!e4 || "string" != typeof e4)
          return 0;
        const t4 = e4.match(/^(\d+)./);
        return t4 && t4[1] ? parseInt(t4[1]) : 0;
      }(t3) >= 14 && console.warn("iOS 14及以上版本连接uniCloud本地调试服务需要允许客户端查找并连接到本地网络上的设备（仅开发期间需要，发行后不需要）");
    }
    const t2 = e2.__dev__;
    if (!t2.debugInfo)
      return;
    const { address: n2, servePort: s2 } = t2.debugInfo, { address: r2 } = await Lt(n2, s2);
    if (r2)
      return t2.localAddress = r2, void (t2.localPort = s2);
    const i2 = console["error"];
    let o2 = "";
    if ("remote" === t2.debugInfo.initialLaunchType ? (t2.debugInfo.forceRemote = true, o2 = "当前客户端和HBuilderX不在同一局域网下（或其他网络原因无法连接HBuilderX），uniCloud本地调试服务不对当前客户端生效。\n- 如果不使用uniCloud本地调试服务，请直接忽略此信息。\n- 如需使用uniCloud本地调试服务，请将客户端与主机连接到同一局域网下并重新运行到客户端。") : o2 = "无法连接uniCloud本地调试服务，请检查当前客户端是否与主机在同一局域网下。\n- 如需使用uniCloud本地调试服务，请将客户端与主机连接到同一局域网下并重新运行到客户端。", o2 += "\n- 如果在HBuilderX开启的状态下切换过网络环境，请重启HBuilderX后再试\n- 检查系统防火墙是否拦截了HBuilderX自带的nodejs\n- 检查是否错误的使用拦截器修改uni.request方法的参数", 0 === T.indexOf("mp-") && (o2 += "\n- 小程序中如何使用uniCloud，请参考：https://uniapp.dcloud.net.cn/uniCloud/publish.html#useinmp"), !t2.debugInfo.forceRemote)
      throw new Error(o2);
    i2(o2);
  }
  function gr(e2) {
    e2._initPromiseHub || (e2._initPromiseHub = new v({ createPromise: function() {
      let t2 = Promise.resolve();
      var n2;
      n2 = 1, t2 = new Promise((e3) => {
        setTimeout(() => {
          e3();
        }, n2);
      });
      const s2 = e2.auth();
      return t2.then(() => s2.getLoginState()).then((e3) => e3 ? Promise.resolve() : s2.signInAnonymously());
    } }));
  }
  const mr = { tcb: Et, tencent: Et, aliyun: ye, private: Nt, dcloud: Nt, alipay: Jt };
  let yr = new class {
    init(e2) {
      let t2 = {};
      const n2 = mr[e2.provider];
      if (!n2)
        throw new Error("未提供正确的provider参数");
      t2 = n2.init(e2), function(e3) {
        const t3 = {};
        e3.__dev__ = t3, t3.debugLog = "app" === T;
        const n3 = C;
        n3 && !n3.code && (t3.debugInfo = n3);
        const s2 = new v({ createPromise: function() {
          return fr(e3);
        } });
        t3.initLocalNetwork = function() {
          return s2.exec();
        };
      }(t2), gr(t2), ls(t2), function(e3) {
        const t3 = e3.uploadFile;
        e3.uploadFile = function(e4) {
          return t3.call(this, e4);
        };
      }(t2), function(e3) {
        e3.database = function(t3) {
          if (t3 && Object.keys(t3).length > 0)
            return e3.init(t3).database();
          if (this._database)
            return this._database;
          const n3 = Is(Ss, { uniClient: e3 });
          return this._database = n3, n3;
        }, e3.databaseForJQL = function(t3) {
          if (t3 && Object.keys(t3).length > 0)
            return e3.init(t3).databaseForJQL();
          if (this._databaseForJQL)
            return this._databaseForJQL;
          const n3 = Is(Ss, { uniClient: e3, isJQL: true });
          return this._databaseForJQL = n3, n3;
        };
      }(t2), function(e3) {
        e3.getCurrentUserInfo = tr, e3.chooseAndUploadFile = sr.initChooseAndUploadFile(e3), Object.assign(e3, { get mixinDatacom() {
          return ir(e3);
        } }), e3.SSEChannel = pr, e3.initSecureNetworkByWeixin = lr(e3), e3.setCustomClientInfo = hr, e3.importObject = or(e3);
      }(t2);
      return ["callFunction", "uploadFile", "deleteFile", "getTempFileURL", "downloadFile", "chooseAndUploadFile"].forEach((e3) => {
        if (!t2[e3])
          return;
        const n3 = t2[e3];
        t2[e3] = function() {
          return n3.apply(t2, Array.from(arguments));
        }, t2[e3] = (/* @__PURE__ */ function(e4, t3) {
          return function(n4) {
            let s2 = false;
            if ("callFunction" === t3) {
              const e5 = n4 && n4.type || c;
              s2 = e5 !== c;
            }
            const r2 = "callFunction" === t3 && !s2, i2 = this._initPromiseHub.exec();
            n4 = n4 || {};
            const { success: o2, fail: a2, complete: u2 } = se(n4), l2 = i2.then(() => s2 ? Promise.resolve() : F(K(t3, "invoke"), n4)).then(() => e4.call(this, n4)).then((e5) => s2 ? Promise.resolve(e5) : F(K(t3, "success"), e5).then(() => F(K(t3, "complete"), e5)).then(() => (r2 && Z(B, { type: V, content: e5 }), Promise.resolve(e5))), (e5) => s2 ? Promise.reject(e5) : F(K(t3, "fail"), e5).then(() => F(K(t3, "complete"), e5)).then(() => (Z(B, { type: V, content: e5 }), Promise.reject(e5))));
            if (!(o2 || a2 || u2))
              return l2;
            l2.then((e5) => {
              o2 && o2(e5), u2 && u2(e5), r2 && Z(B, { type: V, content: e5 });
            }, (e5) => {
              a2 && a2(e5), u2 && u2(e5), r2 && Z(B, { type: V, content: e5 });
            });
          };
        }(t2[e3], e3)).bind(t2);
      }), t2.init = this.init, t2;
    }
  }();
  (() => {
    const e2 = Array.isArray(P) ? P.length : 0, t2 = function() {
      const e3 = Xt(), t3 = en();
      return t3 && t3.enable && g(t3.space) ? t3.space : e3;
    }();
    if (1 === e2)
      yr = yr.init(t2), yr._isDefault = true;
    else {
      const t3 = ["database", "getCurrentUserInfo", "importObject"];
      let n2;
      n2 = e2 > 0 ? "应用有多个服务空间，请通过uniCloud.init方法指定要使用的服务空间" : "应用未关联服务空间，请在uniCloud目录右键关联服务空间", [...["auth", "callFunction", "uploadFile", "deleteFile", "getTempFileURL", "downloadFile"], ...t3].forEach((e3) => {
        yr[e3] = function() {
          if (console.error(n2), -1 === t3.indexOf(e3))
            return Promise.reject(new re({ code: "SYS_ERR", message: n2 }));
          console.error(n2);
        };
      });
    }
    if (Object.assign(yr, { get mixinDatacom() {
      return ir(yr);
    } }), Ys(yr), yr.addInterceptor = M, yr.removeInterceptor = q, yr.interceptObject = j, uni.__uniCloud = yr, "app" === T) {
      const e3 = R();
      e3.uniCloud = yr, e3.UniCloudError = re;
    }
    !function() {
      const { failoverEndpoint: e3 } = Xt();
      if (!e3)
        return;
      sn().catch((e4) => {
        console.error("请求故障切换配置失败：", e4);
      });
      const t3 = { fail() {
        const e4 = en();
        nn(e4 && e4.interval || 0) && sn().catch((e5) => {
          console.error("请求故障切换配置失败：", e5);
        });
      } };
      M("callFunction", t3), M("database", t3), M("uploadFile", t3);
    }();
  })();
  var _r = yr;
  var define_process_env_UNI_STATISTICS_CONFIG_default = { version: "2", enable: true };
  var define_process_env_UNI_STAT_TITLE_JSON_default = { "pages/index/index": "商家工作台", "pages/order/list": "订单管理", "pages/order/detail": "订单详情", "pages/order/self-delivery-nav": "配送导航", "pages/mine/index": "我的", "pages/login/index": "商家登录", "pages/product/list": "商品管理", "pages/finance/index": "财务管理", "pages/stats/index": "数据统计", "pages/review/list": "顾客评价", "pages/shop/index": "店铺设置", "pages/shop/shop-apply": "申请开店", "pages/shop/tianditu-picker": "选择店铺位置", "pages/shop/food-list": "商品管理", "pages/shop/category-manage": "商品分类", "pages/shop/category-add": "添加分类", "pages/shop/product-publish": "发布商品", "pages/shop/food-edit": "编辑商品", "pages/shop/orders": "订单管理" };
  var define_process_env_UNI_STAT_UNI_CLOUD_default = {};
  const sys = uni.getSystemInfoSync();
  const STAT_VERSION = "5.07";
  const STAT_URL = "https://tongji.dcloud.io/uni/stat";
  const STAT_H5_URL = "https://tongji.dcloud.io/uni/stat.gif";
  const PAGE_PVER_TIME = 1800;
  const APP_PVER_TIME = 300;
  const OPERATING_TIME = 10;
  const DIFF_TIME = 60 * 1e3 * 60 * 24;
  const appid = "";
  const dbSet = (name, value2) => {
    let data = uni.getStorageSync("$$STAT__DBDATA:" + appid) || {};
    if (!data) {
      data = {};
    }
    data[name] = value2;
    uni.setStorageSync("$$STAT__DBDATA:" + appid, data);
  };
  const dbGet = (name) => {
    let data = uni.getStorageSync("$$STAT__DBDATA:" + appid) || {};
    if (!data[name]) {
      let dbdata = uni.getStorageSync("$$STAT__DBDATA:" + appid);
      if (!dbdata) {
        dbdata = {};
      }
      if (!dbdata[name]) {
        return void 0;
      }
      data[name] = dbdata[name];
    }
    return data[name];
  };
  const dbRemove = (name) => {
    let data = uni.getStorageSync("$$STAT__DBDATA:" + appid) || {};
    if (data[name]) {
      delete data[name];
      uni.setStorageSync("$$STAT__DBDATA:" + appid, data);
    } else {
      data = uni.getStorageSync("$$STAT__DBDATA:" + appid);
      if (data[name]) {
        delete data[name];
        uni.setStorageSync("$$STAT__DBDATA:" + appid, data);
      }
    }
  };
  const uniStatisticsConfig = define_process_env_UNI_STATISTICS_CONFIG_default;
  let statConfig = {
    appid: ""
  };
  let titleJsons = {};
  titleJsons = define_process_env_UNI_STAT_TITLE_JSON_default;
  const UUID_KEY = "__DC_STAT_UUID";
  const UUID_VALUE = "__DC_UUID_VALUE";
  function getUuid() {
    let uuid = "";
    if (get_platform_name() === "n") {
      try {
        uuid = plus.runtime.getDCloudId();
      } catch (e2) {
        uuid = "";
      }
      return uuid;
    }
    try {
      uuid = uni.getStorageSync(UUID_KEY);
    } catch (e2) {
      uuid = UUID_VALUE;
    }
    if (!uuid) {
      uuid = Date.now() + "" + Math.floor(Math.random() * 1e7);
      try {
        uni.setStorageSync(UUID_KEY, uuid);
      } catch (e2) {
        uni.setStorageSync(UUID_KEY, UUID_VALUE);
      }
    }
    return uuid;
  }
  const get_uuid = (statData2) => {
    return sys.deviceId || getUuid();
  };
  const get_odid = (statData2) => {
    let odid = "";
    if (get_platform_name() === "n") {
      try {
        odid = plus.device.uuid;
      } catch (e2) {
        odid = "";
      }
      return odid;
    }
    return sys.deviceId || getUuid();
  };
  const stat_config = statConfig;
  const get_sgin = (statData2) => {
    let arr = Object.keys(statData2);
    let sortArr = arr.sort();
    let sgin = {};
    let sginStr = "";
    for (var i2 in sortArr) {
      sgin[sortArr[i2]] = statData2[sortArr[i2]];
      sginStr += sortArr[i2] + "=" + statData2[sortArr[i2]] + "&";
    }
    return {
      sign: "",
      options: sginStr.substr(0, sginStr.length - 1)
    };
  };
  const get_encodeURIComponent_options = (statData2) => {
    let data = {};
    for (let prop in statData2) {
      data[prop] = encodeURIComponent(statData2[prop]);
    }
    return data;
  };
  const get_platform_name = () => {
    const aliArr = ["y", "a", "p", "mp-ali"];
    const platformList = {
      app: "n",
      "app-plus": "n",
      "app-harmony": "n",
      "mp-harmony": "mhm",
      h5: "h5",
      "mp-weixin": "wx",
      [aliArr.reverse().join("")]: "ali",
      "mp-baidu": "bd",
      "mp-toutiao": "tt",
      "mp-qq": "qq",
      "quickapp-native": "qn",
      "mp-kuaishou": "ks",
      "mp-lark": "lark",
      "quickapp-webview": "qw",
      "mp-xhs": "xhs"
    };
    if (platformList["app"] === "ali") {
      if (my && my.env) {
        const clientName = my.env.clientName;
        if (clientName === "ap")
          return "ali";
        if (clientName === "dingtalk")
          return "dt";
      }
    }
    return platformList["app"] || "app";
  };
  const get_pack_name = () => {
    let packName = "";
    if (get_platform_name() === "wx" || get_platform_name() === "qq") {
      if (uni.canIUse("getAccountInfoSync")) {
        packName = uni.getAccountInfoSync().miniProgram.appId || "";
      }
    }
    if (get_platform_name() === "n")
      ;
    return packName;
  };
  const get_version = () => {
    return get_platform_name() === "n" ? plus.runtime.version : "";
  };
  const get_channel = () => {
    const platformName = get_platform_name();
    let channel = "";
    if (platformName === "n") {
      channel = plus.runtime.channel;
    }
    return channel;
  };
  const get_scene = (options) => {
    const platformName = get_platform_name();
    let scene = "";
    if (options) {
      return options;
    }
    if (platformName === "wx") {
      scene = uni.getLaunchOptionsSync().scene;
    }
    return scene;
  };
  const get_route = (pageVm) => {
    let _self = pageVm || get_page_vm();
    if (get_platform_name() === "bd") {
      let mp_route = _self.$mp && _self.$mp.page && _self.$mp.page.is;
      let scope_route = _self.$scope && _self.$scope.is;
      return mp_route || scope_route || "";
    } else {
      return _self.route || _self.$scope && _self.$scope.route || _self.$mp && _self.$mp.page.route;
    }
  };
  const get_page_route = (pageVm) => {
    let page = pageVm && (pageVm.$page || pageVm.$scope && pageVm.$scope.$page);
    let lastPageRoute = uni.getStorageSync("_STAT_LAST_PAGE_ROUTE");
    if (!page)
      return lastPageRoute || "";
    return page.fullPath === "/" ? page.route : page.fullPath || page.route;
  };
  const get_page_vm = () => {
    let pages2 = getCurrentPages();
    let $page = pages2[pages2.length - 1];
    if (!$page)
      return null;
    return $page.$vm;
  };
  const get_page_types = (self2) => {
    if (self2.mpType === "page" || self2.$mpType === "page" || self2.$mp && self2.$mp.mpType === "page" || self2.$options.mpType === "page") {
      return "page";
    }
    if (self2.mpType === "app" || self2.$mpType === "app" || self2.$mp && self2.$mp.mpType === "app" || self2.$options.mpType === "app") {
      return "app";
    }
    return null;
  };
  const handle_data = (statData2) => {
    let firstArr = [];
    let contentArr = [];
    let lastArr = [];
    for (let i2 in statData2) {
      const rd = statData2[i2];
      rd.forEach((elm) => {
        let newData = "";
        {
          newData = elm;
        }
        if (i2 === 0) {
          firstArr.push(newData);
        } else if (i2 === 3) {
          lastArr.push(newData);
        } else {
          contentArr.push(newData);
        }
      });
    }
    firstArr.push(...contentArr, ...lastArr);
    return JSON.stringify(firstArr);
  };
  const calibration = (eventName, options) => {
    if (!eventName) {
      console.error(`uni.report Missing [eventName] parameter`);
      return true;
    }
    if (typeof eventName !== "string") {
      console.error(
        `uni.report [eventName] Parameter type error, it can only be of type String`
      );
      return true;
    }
    if (eventName.length > 255) {
      console.error(
        `uni.report [eventName] Parameter length cannot be greater than 255`
      );
      return true;
    }
    if (typeof options !== "string" && typeof options !== "object") {
      console.error(
        "uni.report [options] Parameter type error, Only supports String or Object type"
      );
      return true;
    }
    if (typeof options === "string" && options.length > 255) {
      console.error(
        `uni.report [options] Parameter length cannot be greater than 255`
      );
      return true;
    }
    if (eventName === "title" && typeof options !== "string") {
      console.error(
        `uni.report [eventName] When the parameter is title, the [options] parameter can only be of type String`
      );
      return true;
    }
  };
  const get_page_name = (routepath) => {
    return titleJsons && titleJsons[routepath] || "";
  };
  const Report_Data_Time = "Report_Data_Time";
  const Report_Status = "Report_Status";
  const is_report_data = () => {
    return new Promise((resolve, reject) => {
      let start_time = "";
      let end_time = (/* @__PURE__ */ new Date()).getTime();
      let diff_time = DIFF_TIME;
      let report_status = 1;
      try {
        start_time = uni.getStorageSync(Report_Data_Time);
        report_status = uni.getStorageSync(Report_Status);
      } catch (e2) {
        start_time = "";
        report_status = 1;
      }
      if (report_status === "") {
        requestData(({ enable }) => {
          uni.setStorageSync(Report_Data_Time, end_time);
          uni.setStorageSync(Report_Status, enable);
          if (enable === 1) {
            resolve();
          }
        });
        return;
      }
      if (report_status === 1) {
        resolve();
      }
      if (!start_time) {
        uni.setStorageSync(Report_Data_Time, end_time);
        start_time = end_time;
      }
      if (end_time - start_time > diff_time) {
        requestData(({ enable }) => {
          uni.setStorageSync(Report_Data_Time, end_time);
          uni.setStorageSync(Report_Status, enable);
        });
      }
    });
  };
  const requestData = (done) => {
    const appid2 = "";
    let formData = {
      usv: STAT_VERSION,
      conf: JSON.stringify({
        ak: appid2
      })
    };
    uni.request({
      url: STAT_URL,
      method: "GET",
      data: formData,
      success: (res) => {
        const { data } = res;
        if (data.ret === 0) {
          typeof done === "function" && done({
            enable: data.enable
          });
        }
      },
      fail: (e2) => {
        let report_status_code = 1;
        try {
          report_status_code = uni.getStorageSync(Report_Status);
        } catch (e22) {
          report_status_code = 1;
        }
        if (report_status_code === "") {
          report_status_code = 1;
        }
        typeof done === "function" && done({
          enable: report_status_code
        });
      }
    });
  };
  const uni_cloud_config = () => {
    return define_process_env_UNI_STAT_UNI_CLOUD_default || {};
  };
  const get_space = (config) => {
    const uniCloudConfig = uni_cloud_config();
    const { spaceId, provider, clientSecret, secretKey, secretId } = uniCloudConfig;
    const space_type = ["tcb", "tencent", "aliyun", "alipay", "private", "dcloud"];
    const is_provider = space_type.indexOf(provider) !== -1;
    const is_aliyun = provider === "aliyun" && spaceId && clientSecret;
    const is_tcb = (provider === "tcb" || provider === "tencent") && spaceId;
    const is_alipay = provider === "alipay" && spaceId && secretKey && secretId;
    const is_private = provider === "private" && spaceId && clientSecret;
    const is_dcloud = provider === "dcloud" && spaceId && clientSecret;
    if (is_provider && (is_aliyun || is_tcb || is_alipay || is_private || is_dcloud)) {
      return uniCloudConfig;
    } else {
      if (config && config.spaceId) {
        return config;
      }
    }
    return null;
  };
  const get_report_Interval = (defaultTime) => {
    let time = uniStatisticsConfig.reportInterval;
    if (Number(time) === 0)
      return 0;
    time = time || defaultTime;
    let reg = /(^[1-9]\d*$)/;
    if (!reg.test(time))
      return defaultTime;
    return Number(time);
  };
  const is_push_clientid = () => {
    if (uniStatisticsConfig.collectItems) {
      const ClientID = uniStatisticsConfig.collectItems.uniPushClientID;
      return typeof ClientID === "boolean" ? ClientID : false;
    }
    return false;
  };
  const is_page_report = () => {
    if (uniStatisticsConfig.collectItems) {
      const statPageLog = uniStatisticsConfig.collectItems.uniStatPageLog;
      if (statPageLog === void 0)
        return true;
      return typeof statPageLog === "boolean" ? statPageLog : true;
    }
    return true;
  };
  const IS_HANDLE_DEVECE_ID = "is_handle_device_id";
  const is_handle_device = () => {
    let isHandleDevice = dbGet(IS_HANDLE_DEVECE_ID) || "";
    dbSet(IS_HANDLE_DEVECE_ID, "1");
    return isHandleDevice === "1";
  };
  const FIRST_VISIT_TIME_KEY = "__first__visit__time";
  const LAST_VISIT_TIME_KEY = "__last__visit__time";
  const get_time = () => {
    return parseInt((/* @__PURE__ */ new Date()).getTime() / 1e3);
  };
  const get_first_visit_time = () => {
    const timeStorge = dbGet(FIRST_VISIT_TIME_KEY);
    let time = 0;
    if (timeStorge) {
      time = timeStorge;
    } else {
      time = get_time();
      dbSet(FIRST_VISIT_TIME_KEY, time);
      dbRemove(LAST_VISIT_TIME_KEY);
    }
    return time;
  };
  const get_last_visit_time = () => {
    const timeStorge = dbGet(LAST_VISIT_TIME_KEY);
    let time = 0;
    if (timeStorge) {
      time = timeStorge;
    }
    dbSet(LAST_VISIT_TIME_KEY, get_time());
    return time;
  };
  const PAGE_RESIDENCE_TIME = "__page__residence__time";
  let First_Page_Residence_Time = 0;
  let Last_Page_Residence_Time = 0;
  const set_page_residence_time = () => {
    First_Page_Residence_Time = get_time();
    dbSet(PAGE_RESIDENCE_TIME, First_Page_Residence_Time);
    return First_Page_Residence_Time;
  };
  const get_page_residence_time = () => {
    Last_Page_Residence_Time = get_time();
    First_Page_Residence_Time = dbGet(PAGE_RESIDENCE_TIME);
    return Last_Page_Residence_Time - First_Page_Residence_Time;
  };
  const TOTAL_VISIT_COUNT = "__total__visit__count";
  const get_total_visit_count = () => {
    const timeStorge = dbGet(TOTAL_VISIT_COUNT);
    let count = 1;
    if (timeStorge) {
      count = timeStorge;
      count++;
    }
    dbSet(TOTAL_VISIT_COUNT, count);
    return count;
  };
  const FIRST_TIME = "__first_time";
  const set_first_time = () => {
    let time = get_time();
    const timeStorge = dbSet(FIRST_TIME, time);
    return timeStorge;
  };
  const get_residence_time = (type) => {
    let residenceTime = 0;
    const first_time = dbGet(FIRST_TIME);
    const last_time = get_time();
    if (first_time !== 0) {
      residenceTime = last_time - first_time;
    }
    residenceTime = residenceTime < 1 ? 1 : residenceTime;
    if (type === "app") {
      let overtime = residenceTime > APP_PVER_TIME ? true : false;
      return {
        residenceTime,
        overtime
      };
    }
    if (type === "page") {
      let overtime = residenceTime > PAGE_PVER_TIME ? true : false;
      return {
        residenceTime,
        overtime
      };
    }
    return {
      residenceTime
    };
  };
  const eport_Interval = get_report_Interval(OPERATING_TIME);
  let statData = {
    uuid: get_uuid(),
    // 设备标识
    ak: stat_config.appid,
    // uni-app 应用 Appid
    p: "",
    // 手机系统，客户端平台
    ut: get_platform_name(),
    // 平台类型
    mpn: get_pack_name(),
    // 原生平台包名、小程序 appid
    usv: STAT_VERSION,
    // 统计 sdk 版本
    v: get_version(),
    // 应用版本，仅app
    ch: get_channel(),
    // 渠道信息
    cn: "",
    // 国家
    pn: "",
    // 省份
    ct: "",
    // 城市
    t: get_time(),
    // 上报数据时的时间戳
    tt: "",
    brand: sys.brand || "",
    // 手机品牌
    md: sys.model,
    // 手机型号
    sv: "",
    // 手机系统版本
    mpsdk: sys.SDKVersion || "",
    // x程序 sdk version
    mpv: sys.version || "",
    // 小程序平台版本 ，如微信、支付宝
    lang: sys.language,
    // 语言
    pr: sys.pixelRatio,
    // pixelRatio 设备像素比
    ww: sys.windowWidth,
    // windowWidth 可使用窗口宽度
    wh: sys.windowHeight,
    // windowHeight 可使用窗口高度
    sw: sys.screenWidth,
    // screenWidth 屏幕宽度
    sh: sys.screenHeight
    // screenHeight 屏幕高度
  };
  if (sys.platform) {
    switch (sys.platform) {
      case "android":
        statData.p = "a";
        break;
      case "ios":
        statData.p = "i";
        break;
      case "harmonyos":
        statData.p = "h";
        break;
    }
  }
  if (sys.system) {
    statData.sv = sys.system.replace(/(Android|iOS)\s/, "");
  }
  class Report {
    constructor() {
      this.self = "";
      this.__licationShow = false;
      this.__licationHide = false;
      this.statData = statData;
      this._navigationBarTitle = {
        config: "",
        page: "",
        report: "",
        lt: ""
      };
      this._query = {};
      let registerInterceptor = typeof uni.addInterceptor === "function";
      if (registerInterceptor) {
        this.addInterceptorInit();
        this.interceptLogin();
        this.interceptShare(true);
        this.interceptRequestPayment();
      }
    }
    addInterceptorInit() {
      let self2 = this;
      uni.addInterceptor("setNavigationBarTitle", {
        invoke(args) {
          self2._navigationBarTitle.page = args.title;
        }
      });
    }
    interceptLogin() {
      let self2 = this;
      uni.addInterceptor("login", {
        complete() {
          self2._login();
        }
      });
    }
    interceptShare(type) {
      let self2 = this;
      if (!type) {
        self2._share();
        return;
      }
      uni.addInterceptor("share", {
        success() {
          self2._share();
        },
        fail() {
          self2._share();
        }
      });
    }
    interceptRequestPayment() {
      let self2 = this;
      uni.addInterceptor("requestPayment", {
        success() {
          self2._payment("pay_success");
        },
        fail() {
          self2._payment("pay_fail");
        }
      });
    }
    _login() {
      this.sendEventRequest(
        {
          key: "login"
        },
        0
      );
    }
    _share() {
      this.sendEventRequest(
        {
          key: "share"
        },
        0
      );
    }
    _payment(key) {
      this.sendEventRequest(
        {
          key
        },
        0
      );
    }
    /**
     * 进入应用触发
     */
    applicationShow() {
      if (this.__licationHide) {
        const time = get_residence_time("app");
        if (time.overtime) {
          let lastPageRoute = uni.getStorageSync("_STAT_LAST_PAGE_ROUTE");
          let options = {
            path: lastPageRoute,
            scene: this.statData.sc,
            cst: 2
          };
          this.sendReportRequest(options);
        } else {
          const scene = get_scene();
          if (scene !== this.statData.sc) {
            let lastPageRoute = uni.getStorageSync("_STAT_LAST_PAGE_ROUTE");
            let options = {
              path: lastPageRoute,
              scene,
              cst: 2
            };
            this.sendReportRequest(options);
          }
        }
        this.__licationHide = false;
      }
    }
    /**
     * 离开应用触发
     * @param {Object} self
     * @param {Object} type
     */
    applicationHide(self2, type) {
      if (!self2) {
        self2 = get_page_vm();
      }
      this.__licationHide = true;
      const time = get_residence_time();
      const route = get_page_route(self2);
      uni.setStorageSync("_STAT_LAST_PAGE_ROUTE", route);
      this.sendHideRequest(
        {
          urlref: route,
          urlref_ts: time.residenceTime
        },
        type
      );
      set_first_time();
    }
    /**
     * 进入页面触发
     */
    pageShow(self2) {
      this._navigationBarTitle = {
        config: "",
        page: "",
        report: "",
        lt: ""
      };
      const route = get_page_route(self2);
      const routepath = get_route(self2);
      this._navigationBarTitle.config = get_page_name(routepath);
      if (this.__licationShow) {
        set_first_time();
        uni.setStorageSync("_STAT_LAST_PAGE_ROUTE", route);
        this.__licationShow = false;
        return;
      }
      const time = get_residence_time("page");
      if (time.overtime) {
        let options = {
          path: route,
          scene: this.statData.sc,
          cst: 3
        };
        this.sendReportRequest(options);
      }
      set_first_time();
    }
    /**
     * 离开页面触发
     */
    pageHide(self2) {
      if (!this.__licationHide) {
        const time = get_residence_time("page");
        let route = get_page_route(self2);
        let lastPageRoute = uni.getStorageSync("_STAT_LAST_PAGE_ROUTE");
        if (!lastPageRoute) {
          lastPageRoute = route;
        }
        uni.setStorageSync("_STAT_LAST_PAGE_ROUTE", route);
        this.sendPageRequest({
          url: route,
          urlref: lastPageRoute,
          urlref_ts: time.residenceTime
        });
        return;
      }
    }
    /**
     * 发送请求,应用维度上报
     * @param {Object} options 页面信息
     * @param {Boolean} type 是否立即上报
     */
    sendReportRequest(options, type) {
      this._navigationBarTitle.lt = "1";
      this._navigationBarTitle.config = get_page_name(options.path);
      let is_opt = options.query && JSON.stringify(options.query) !== "{}";
      let query = is_opt ? "?" + JSON.stringify(options.query) : "";
      const last_time = get_last_visit_time();
      if (last_time !== 0 || !last_time) {
        const odid = get_odid();
        {
          const have_device = is_handle_device();
          if (!have_device) {
            this.statData.odid = odid;
          }
        }
      }
      Object.assign(this.statData, {
        lt: "1",
        url: options.path + query || "",
        t: get_time(),
        sc: get_scene(options.scene),
        fvts: get_first_visit_time(),
        lvts: last_time,
        tvc: get_total_visit_count(),
        // create session type  上报类型 ，1 应用进入 2.后台30min进入 3.页面30min进入
        cst: options.cst || 1
      });
      if (get_platform_name() === "n") {
        this.getProperty(type);
      } else {
        this.getNetworkInfo(type);
      }
    }
    /**
     * 发送请求,页面维度上报
     * @param {Object} opt
     */
    sendPageRequest(opt) {
      let { url: url2, urlref, urlref_ts } = opt;
      this._navigationBarTitle.lt = "11";
      let options = {
        ak: this.statData.ak,
        uuid: this.statData.uuid,
        p: this.statData.p,
        lt: "11",
        ut: this.statData.ut,
        url: url2,
        tt: this.statData.tt,
        urlref,
        urlref_ts,
        ch: this.statData.ch,
        usv: this.statData.usv,
        t: get_time()
      };
      this.request(options);
    }
    /**
     * 进入后台上报数据
     * @param {Object} opt
     * @param {Object} type
     */
    sendHideRequest(opt, type) {
      let { urlref, urlref_ts } = opt;
      let options = {
        ak: this.statData.ak,
        uuid: this.statData.uuid,
        p: this.statData.p,
        lt: "3",
        ut: this.statData.ut,
        urlref,
        urlref_ts,
        ch: this.statData.ch,
        usv: this.statData.usv,
        t: get_time()
      };
      this.request(options, type);
    }
    /**
     * 自定义事件上报
     */
    sendEventRequest({ key = "", value: value2 = "" } = {}) {
      let routepath = "";
      try {
        routepath = get_route();
      } catch (error) {
        const launch_options = dbGet("__launch_options");
        routepath = launch_options.path;
      }
      this._navigationBarTitle.config = get_page_name(routepath);
      this._navigationBarTitle.lt = "21";
      let options = {
        ak: this.statData.ak,
        uuid: this.statData.uuid,
        p: this.statData.p,
        lt: "21",
        ut: this.statData.ut,
        url: routepath,
        ch: this.statData.ch,
        e_n: key,
        e_v: typeof value2 === "object" ? JSON.stringify(value2) : value2.toString(),
        usv: this.statData.usv,
        t: get_time()
      };
      this.request(options);
    }
    sendPushRequest(options, cid) {
      let time = get_time();
      const statData2 = {
        lt: "101",
        cid,
        t: time,
        ut: this.statData.ut
      };
      const stat_data = handle_data({
        101: [statData2]
      });
      let optionsData = {
        usv: STAT_VERSION,
        //统计 SDK 版本号
        t: time,
        //发送请求时的时间戮
        requests: stat_data
      };
      if (get_platform_name() === "n" && this.statData.p === "a") {
        setTimeout(() => {
          this.sendRequest(optionsData);
        }, 200);
        return;
      }
      this.sendRequest(optionsData);
    }
    /**
     * 获取wgt资源版本
     */
    getProperty(type) {
      plus.runtime.getProperty(plus.runtime.appid, (wgtinfo) => {
        this.statData.v = wgtinfo.version || "";
        this.getNetworkInfo(type);
      });
    }
    /**
     * 获取网络信息
     */
    getNetworkInfo(type) {
      uni.getNetworkType({
        success: (result) => {
          this.statData.net = result.networkType;
          this.getLocation(type);
        }
      });
    }
    /**
     * 获取位置信息
     */
    getLocation(type) {
      if (stat_config.getLocation) {
        uni.getLocation({
          type: "wgs84",
          geocode: true,
          success: (result) => {
            if (result.address) {
              this.statData.cn = result.address.country;
              this.statData.pn = result.address.province;
              this.statData.ct = result.address.city;
            }
            this.statData.lat = result.latitude;
            this.statData.lng = result.longitude;
            this.request(this.statData, type);
          }
        });
      } else {
        this.statData.lat = 0;
        this.statData.lng = 0;
        this.request(this.statData, type);
      }
    }
    /**
     * 发送请求
     * @param {Object} data 上报数据
     * @param {Object} type 类型
     */
    request(data, type) {
      let time = get_time();
      const title = this._navigationBarTitle;
      Object.assign(data, {
        ttn: title.page,
        ttpj: title.config,
        ttc: title.report
      });
      let uniStatData = dbGet("__UNI__STAT__DATA") || {};
      if (!uniStatData[data.lt]) {
        uniStatData[data.lt] = [];
      }
      uniStatData[data.lt].push(data);
      dbSet("__UNI__STAT__DATA", uniStatData);
      let page_residence_time = get_page_residence_time();
      if (page_residence_time < eport_Interval && !type)
        return;
      set_page_residence_time();
      const stat_data = handle_data(uniStatData);
      let optionsData = {
        usv: STAT_VERSION,
        //统计 SDK 版本号
        t: time,
        //发送请求时的时间戮
        requests: stat_data
      };
      dbRemove("__UNI__STAT__DATA");
      if (get_platform_name() === "n" && this.statData.p === "a") {
        setTimeout(() => {
          this.sendRequest(optionsData);
        }, 200);
        return;
      }
      this.sendRequest(optionsData);
    }
    getIsReportData() {
      return is_report_data();
    }
    /**
     * 数据上报
     * @param {Object} optionsData 需要上报的数据
     */
    sendRequest(optionsData) {
      {
        if (!uni.__stat_uniCloud_space) {
          console.error(
            "应用未关联服务空间，统计上报失败，请在uniCloud目录右键关联服务空间."
          );
          return;
        }
        const uniCloudObj = uni.__stat_uniCloud_space.importObject(
          "uni-stat-receiver",
          {
            customUI: true
          }
        );
        uniCloudObj.report(optionsData).then(() => {
        }).catch((err) => {
        });
      }
    }
    /**
     * h5 请求
     */
    imageRequest(data) {
      this.getIsReportData().then(() => {
        let image = new Image();
        let options = get_sgin(get_encodeURIComponent_options(data)).options;
        image.src = STAT_H5_URL + "?" + options;
      });
    }
    sendEvent(key, value2) {
      if (calibration(key, value2))
        return;
      if (key === "title") {
        this._navigationBarTitle.report = value2;
        return;
      }
      this.sendEventRequest(
        {
          key,
          value: typeof value2 === "object" ? JSON.stringify(value2) : value2
        },
        1
      );
    }
  }
  class Stat extends Report {
    static getInstance() {
      if (!uni.__stat_instance) {
        uni.__stat_instance = new Stat();
      }
      {
        let space = get_space(_r.config);
        if (!uni.__stat_uniCloud_space) {
          if (space && Object.keys(space).length !== 0) {
            let spaceData = {
              provider: space.provider,
              spaceId: space.spaceId,
              clientSecret: space.clientSecret
            };
            if (space.endpoint) {
              spaceData.endpoint = space.endpoint;
            }
            if (space.provider === "alipay") {
              spaceData.secretKey = space.secretKey;
              spaceData.accessKey = space.accessKey || space.secretId;
              spaceData.spaceAppId = space.spaceAppId || space.appId;
            }
            uni.__stat_uniCloud_space = _r.init(spaceData);
          } else {
            console.error("应用未关联服务空间，请在uniCloud目录右键关联服务空间");
          }
        }
      }
      return uni.__stat_instance;
    }
    constructor() {
      super();
    }
    /**
     * 获取推送id
     */
    pushEvent(options) {
      const ClientID = is_push_clientid();
      if (uni.getPushClientId && ClientID) {
        uni.getPushClientId({
          success: (res) => {
            const cid = res.cid || false;
            if (cid) {
              this.sendPushRequest(options, cid);
            }
          }
        });
      }
    }
    /**
     * 进入应用
     * @param {Object} options 页面参数
     * @param {Object} self	当前页面实例
     */
    launch(options, self2) {
      set_page_residence_time();
      this.__licationShow = true;
      dbSet("__launch_options", options);
      options.cst = 1;
      this.sendReportRequest(options, true);
    }
    load(options, self2) {
      this.self = self2;
      this._query = options;
    }
    appHide(self2) {
      this.applicationHide(self2, true);
    }
    appShow(self2) {
      this.applicationShow(self2);
    }
    show(self2) {
      this.self = self2;
      if (get_page_types(self2) === "page") {
        const isPageReport = is_page_report();
        if (isPageReport) {
          this.pageShow(self2);
        }
      }
      if (get_platform_name() === "h5" || get_platform_name() === "n") {
        if (get_page_types(self2) === "app") {
          this.appShow();
        }
      }
    }
    hide(self2) {
      this.self = self2;
      if (get_page_types(self2) === "page") {
        const isPageReport = is_page_report();
        if (isPageReport) {
          this.pageHide(self2);
        }
      }
      if (get_platform_name() === "h5" || get_platform_name() === "n") {
        if (get_page_types(self2) === "app") {
          this.appHide();
        }
      }
    }
    error(em) {
      let emVal = "";
      if (!em.message) {
        emVal = JSON.stringify(em);
      } else {
        emVal = em.stack;
      }
      let route = "";
      try {
        route = get_route();
      } catch (e2) {
        route = "";
      }
      let options = {
        ak: this.statData.ak,
        uuid: this.statData.uuid,
        p: this.statData.p,
        lt: "31",
        url: route,
        ut: this.statData.ut,
        ch: this.statData.ch,
        mpsdk: this.statData.mpsdk,
        mpv: this.statData.mpv,
        v: this.statData.v,
        em: emVal,
        usv: this.statData.usv,
        t: parseInt((/* @__PURE__ */ new Date()).getTime() / 1e3)
      };
      this.request(options);
    }
  }
  Stat.getInstance();
  function main() {
    {
      {
        uni.report = function(type, options) {
        };
      }
    }
  }
  main();
  function createApp() {
    const app = vue.createVueApp(App);
    app.use(pinia);
    return { app };
  }
  const { app: __app__, Vuex: __Vuex__, Pinia: __Pinia__ } = createApp();
  uni.Vuex = __Vuex__;
  uni.Pinia = __Pinia__;
  __app__.provide("__globalStyles", __uniConfig.styles);
  __app__._component.mpType = "app";
  __app__._component.render = () => {
  };
  __app__.mount("#app");
})(Vue);
