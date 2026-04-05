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
  const global = uni.requireGlobal();
  ArrayBuffer = global.ArrayBuffer;
  Int8Array = global.Int8Array;
  Uint8Array = global.Uint8Array;
  Uint8ClampedArray = global.Uint8ClampedArray;
  Int16Array = global.Int16Array;
  Uint16Array = global.Uint16Array;
  Int32Array = global.Int32Array;
  Uint32Array = global.Uint32Array;
  Float32Array = global.Float32Array;
  Float64Array = global.Float64Array;
  BigInt64Array = global.BigInt64Array;
  BigUint64Array = global.BigUint64Array;
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
  const TIANDITU_TK = "63a693ed968db6b7256470395e40fe5b";
  const ORDER_STATUS = {
    0: { text: "待支付", color: "#FF6B35" },
    1: { text: "待接单", color: "#1890FF" },
    2: { text: "已接单", color: "#FAAD14" },
    3: { text: "备货中", color: "#FAAD14" },
    4: { text: "备货完成", color: "#2F54EB" },
    5: { text: "配送中", color: "#52C41A" },
    6: { text: "已完成", color: "#52C41A" },
    7: { text: "已取消", color: "#999" }
  };
  const API_BASE_URL = BASE_URL + "/api";
  function request({ url: url2, method = "GET", data = {} }) {
    return new Promise((resolve, reject) => {
      const token = uni.getStorageSync("token") || "";
      uni.request({
        url: API_BASE_URL + url2,
        method,
        data,
        header: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        success: (res) => {
          var _a, _b, _c;
          if (res.statusCode === 401) {
            uni.removeStorageSync("token");
            uni.removeStorageSync("userInfo");
            uni.reLaunch({ url: "/pages/login/index" });
            reject({ code: 401, msg: "请先登录" });
            return;
          }
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            const msg = ((_a = res.data) == null ? void 0 : _a.msg) || ((_b = res.data) == null ? void 0 : _b.message) || ((_c = res.data) == null ? void 0 : _c.detail) || "请求失败";
            uni.showToast({ title: msg, icon: "none", duration: 2e3 });
            reject({ code: res.statusCode, msg });
          }
        },
        fail: (err) => {
          formatAppLog("error", "at utils/request.js:51", "网络请求失败:", err);
          uni.showToast({
            title: "网络错误，请检查网络",
            icon: "none",
            duration: 2e3
          });
          reject({ code: 500, msg: "网络错误" });
        }
      });
    });
  }
  function get(url2, data) {
    return request({ url: url2, method: "GET", data });
  }
  function post(url2, data) {
    return request({ url: url2, method: "POST", data });
  }
  function login(data) {
    return post("/auth/login", data);
  }
  function register(data) {
    return post("/auth/register", data);
  }
  const STORAGE_KEY = {
    TOKEN: "token",
    USER_INFO: "userInfo",
    RIDER_STATUS: "riderStatus"
  };
  function setToken(token) {
    uni.setStorageSync(STORAGE_KEY.TOKEN, token);
  }
  function removeToken() {
    uni.removeStorageSync(STORAGE_KEY.TOKEN);
  }
  function setUserInfo(userInfo) {
    uni.setStorageSync(STORAGE_KEY.USER_INFO, JSON.stringify(userInfo));
  }
  function getUserInfo$1() {
    const str = uni.getStorageSync(STORAGE_KEY.USER_INFO);
    return str ? JSON.parse(str) : null;
  }
  function removeUserInfo() {
    uni.removeStorageSync(STORAGE_KEY.USER_INFO);
  }
  function setRiderStatus(status) {
    uni.setStorageSync(STORAGE_KEY.RIDER_STATUS, status);
  }
  function getRiderStatus() {
    return uni.getStorageSync(STORAGE_KEY.RIDER_STATUS) || 0;
  }
  const _export_sfc = (sfc, props) => {
    const target = sfc.__vccOpts || sfc;
    for (const [key, val] of props) {
      target[key] = val;
    }
    return target;
  };
  const _sfc_main$b = {
    data() {
      return {
        form: {
          phone: "",
          password: "",
          confirmPassword: "",
          nickname: ""
        },
        isRegisterMode: false,
        loading: false
      };
    },
    methods: {
      toggleMode() {
        this.isRegisterMode = !this.isRegisterMode;
        this.form.confirmPassword = "";
        this.form.nickname = "";
      },
      validateForm() {
        const { phone, password, confirmPassword, nickname } = this.form;
        if (!phone || phone.length !== 11) {
          uni.showToast({ title: "请输入正确的手机号", icon: "none" });
          return false;
        }
        if (!password || password.length < 6) {
          uni.showToast({ title: "密码至少 6 位", icon: "none" });
          return false;
        }
        if (this.isRegisterMode) {
          if (password !== confirmPassword) {
            uni.showToast({ title: "两次密码不一致", icon: "none" });
            return false;
          }
        }
        return true;
      },
      async handleSubmit() {
        if (!this.validateForm())
          return;
        this.loading = true;
        try {
          if (this.isRegisterMode) {
            await this.handleRegister();
          } else {
            await this.handleLogin();
          }
        } catch (e) {
          formatAppLog("error", "at pages/login/index.vue:120", "操作失败:", e);
        } finally {
          this.loading = false;
        }
      },
      async handleLogin() {
        const { phone, password } = this.form;
        const res = await login({ phone, password });
        if (res.data) {
          setToken(res.data.token);
          setUserInfo(res.data.user);
          if (res.data.user.role !== "rider") {
            uni.showToast({
              title: "该账号不是骑手账号",
              icon: "none",
              duration: 2e3
            });
            setTimeout(() => {
              uni.clearStorageSync();
            }, 2e3);
            return;
          }
          uni.showToast({ title: "登录成功", icon: "success" });
          setTimeout(() => {
            uni.reLaunch({ url: "/pages/index/index" });
          }, 1500);
        }
      },
      async handleRegister() {
        const { phone, password, nickname } = this.form;
        const registerData = {
          phone,
          password,
          nickname: nickname || `骑手${phone.slice(-4)}`,
          role: "rider",
          rider_kind: "county"
        };
        await register(registerData);
        uni.showToast({
          title: "注册成功，请登录",
          icon: "success",
          duration: 2e3
        });
        this.isRegisterMode = false;
        this.form.password = "";
        this.form.confirmPassword = "";
      }
    }
  };
  function _sfc_render$a(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "header" }, [
        vue.createElementVNode(
          "text",
          { class: "title" },
          vue.toDisplayString($data.isRegisterMode ? "骑手注册" : "骑手登录"),
          1
          /* TEXT */
        )
      ]),
      vue.createElementVNode("view", { class: "form-container" }, [
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "form-label" }, "手机号"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $data.form.phone = $event),
              type: "number",
              maxlength: "11",
              placeholder: "请输入手机号",
              class: "form-input"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.phone]
          ])
        ]),
        vue.createElementVNode("view", { class: "form-item" }, [
          vue.createElementVNode("text", { class: "form-label" }, "密码"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => $data.form.password = $event),
              type: "password",
              placeholder: "请输入密码（至少6位）",
              class: "form-input"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.password]
          ])
        ]),
        $data.isRegisterMode ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "form-item"
        }, [
          vue.createElementVNode("text", { class: "form-label" }, "确认密码"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => $data.form.confirmPassword = $event),
              type: "password",
              placeholder: "请再次输入密码",
              class: "form-input"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.confirmPassword]
          ])
        ])) : vue.createCommentVNode("v-if", true),
        $data.isRegisterMode ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "form-item"
        }, [
          vue.createElementVNode("text", { class: "form-label" }, "昵称（选填）"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => $data.form.nickname = $event),
              type: "text",
              placeholder: "请输入昵称",
              class: "form-input"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.form.nickname]
          ])
        ])) : vue.createCommentVNode("v-if", true),
        vue.createElementVNode(
          "button",
          {
            class: "submit-btn",
            onClick: _cache[4] || (_cache[4] = (...args) => $options.handleSubmit && $options.handleSubmit(...args))
          },
          vue.toDisplayString($data.isRegisterMode ? "注册" : "登录"),
          1
          /* TEXT */
        ),
        vue.createElementVNode("view", { class: "toggle-mode" }, [
          vue.createElementVNode(
            "text",
            { class: "tip-text" },
            vue.toDisplayString($data.isRegisterMode ? "已有账号？" : "没有账号？"),
            1
            /* TEXT */
          ),
          vue.createElementVNode(
            "text",
            {
              class: "tip-link",
              onClick: _cache[5] || (_cache[5] = (...args) => $options.toggleMode && $options.toggleMode(...args))
            },
            vue.toDisplayString($data.isRegisterMode ? "立即登录" : "立即注册"),
            1
            /* TEXT */
          )
        ])
      ])
    ]);
  }
  const PagesLoginIndex = /* @__PURE__ */ _export_sfc(_sfc_main$b, [["render", _sfc_render$a], ["__scopeId", "data-v-d08ef7d4"], ["__file", "E:/固始县外卖骑手端/pages/login/index.vue"]]);
  function getAvailableOrders(params = {}) {
    return get("/order/available", params);
  }
  function getRiderOrders(params = {}) {
    return get("/order/rider-orders", params);
  }
  function getOrderDetail(id) {
    return get("/order/detail/" + id);
  }
  function confirmDelivery(orderId) {
    return post("/order/confirm-delivery", { order_id: orderId });
  }
  function getErrandList(params = {}) {
    return get("/order/errand/list", params);
  }
  function getUserInfo() {
    return get("/auth/me");
  }
  function bindStationTown(town) {
    return post("/rider/station/bind", { town });
  }
  function reportLocation(latitude, longitude) {
    return post("/rider/location/report", { latitude, longitude });
  }
  function formatTime(time, format = "YYYY-MM-DD HH:mm") {
    if (!time)
      return "";
    const date = new Date(time);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return format.replace("YYYY", year).replace("MM", month).replace("DD", day).replace("HH", hours).replace("mm", minutes).replace("ss", seconds);
  }
  const _sfc_main$a = {
    data() {
      return {
        isOnline: true,
        nickname: "骑手",
        allOrders: [],
        errandOrders: [],
        stats: {
          todayDone: 0,
          delivering: 0,
          todayEarning: "0.00",
          pending: 0,
          errandPending: 0
        },
        // 确认弹窗相关
        showConfirmDialog: false,
        countdown: 5,
        countdownTimer: null
      };
    },
    computed: {
      pendingOrders() {
        return this.allOrders.filter((o) => o.status === 5);
      }
    },
    onLoad() {
      const savedStatus = getRiderStatus();
      this.isOnline = savedStatus === 1;
    },
    onShow() {
      this.loadData();
    },
    methods: {
      formatTime,
      async loadData() {
        await Promise.all([
          this.loadUserInfo(),
          this.loadOrders(),
          this.loadErrands()
        ]);
        this.calculateStats();
      },
      async loadUserInfo() {
        try {
          const res = await getUserInfo();
          if (res.data) {
            this.nickname = res.data.nickname || "骑手";
          }
        } catch (e) {
          formatAppLog("error", "at pages/index/index.vue:223", "加载用户信息失败", e);
        }
      },
      async loadOrders() {
        try {
          const res = await getAvailableOrders();
          this.allOrders = res.data || [];
        } catch (e) {
          formatAppLog("error", "at pages/index/index.vue:232", "加载订单失败", e);
          this.allOrders = [];
        }
      },
      async loadErrands() {
        try {
          const res = await getErrandList({ status: 1 });
          this.errandOrders = res.data || [];
        } catch (e) {
          formatAppLog("error", "at pages/index/index.vue:242", "加载跑腿订单失败", e);
          this.errandOrders = [];
        }
      },
      calculateStats() {
        const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
        const todayDoneList = this.allOrders.filter(
          (o) => o.status === 6 && o.delivered_at && o.delivered_at.startsWith(today)
        );
        const deliveringList = this.allOrders.filter((o) => o.status === 5);
        this.stats.todayDone = todayDoneList.length;
        this.stats.delivering = deliveringList.length;
        this.stats.todayEarning = todayDoneList.reduce((sum, o) => {
          return sum + (parseFloat(o.rider_fee) || 0);
        }, 0).toFixed(2);
        this.stats.pending = this.pendingOrders.length;
        this.stats.errandPending = this.errandOrders.length;
      },
      toggleOnline() {
        if (this.isOnline) {
          this.showConfirmDialog = true;
          this.countdown = 5;
          this.countdownTimer = setInterval(() => {
            this.countdown--;
            if (this.countdown <= 0) {
              clearInterval(this.countdownTimer);
            }
          }, 1e3);
        } else {
          this.isOnline = true;
          const newStatus = 1;
          setRiderStatus(newStatus);
          uni.showToast({
            title: "已开始接单",
            icon: "none"
          });
        }
      },
      // 确认下班
      confirmOffWork() {
        if (this.countdown > 0) {
          uni.showToast({
            title: "请等待倒计时结束",
            icon: "none"
          });
          return;
        }
        const newStatus = 0;
        setRiderStatus(newStatus);
        this.isOnline = false;
        this.showConfirmDialog = false;
        uni.showToast({
          title: "已暂停接单",
          icon: "none"
        });
      },
      // 取消下班
      cancelOffWork() {
        this.showConfirmDialog = false;
        clearInterval(this.countdownTimer);
      },
      getBriefAddress(order) {
        try {
          const addr = typeof order.delivery_address === "string" ? JSON.parse(order.delivery_address) : order.delivery_address;
          return addr.district + addr.street || "未知地址";
        } catch (e) {
          return "未知地址";
        }
      },
      goOrders() {
        uni.switchTab({ url: "/pages/orders/index" });
      },
      goErrands() {
        uni.navigateTo({ url: "/pages/errands/index" });
      },
      goTodayOrders() {
        uni.switchTab({ url: "/pages/orders/index" });
      },
      goEarnings() {
        uni.navigateTo({ url: "/pages/earnings/index" });
      },
      goWeekStats() {
        uni.navigateTo({ url: "/pages/earnings/index?period=week" });
      },
      goMonthStats() {
        uni.navigateTo({ url: "/pages/earnings/index?period=month" });
      },
      goProfile() {
        uni.switchTab({ url: "/pages/profile/index" });
      },
      goSettings() {
        uni.showToast({ title: "设置功能开发中", icon: "none" });
      },
      goHelp() {
        uni.showToast({ title: "帮助中心开发中", icon: "none" });
      },
      goOrderDetail(order) {
        const type = order.type === "errand" ? "errand" : "order";
        uni.navigateTo({
          url: `/pages/${type}/detail?id=${order.id}`
        });
      }
    }
  };
  function _sfc_render$9(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "header" }, [
        vue.createElementVNode("view", { class: "header-left" }, [
          vue.createElementVNode("text", { class: "header-emoji" }, "🛵"),
          vue.createElementVNode("view", { class: "header-info" }, [
            vue.createElementVNode("text", { class: "header-title" }, "骑手工作台"),
            vue.createElementVNode(
              "text",
              { class: "header-sub" },
              vue.toDisplayString($data.nickname) + "，今天也辛苦了",
              1
              /* TEXT */
            )
          ])
        ]),
        vue.createElementVNode("view", {
          class: "status-switch",
          onClick: _cache[0] || (_cache[0] = (...args) => $options.toggleOnline && $options.toggleOnline(...args))
        }, [
          vue.createElementVNode(
            "text",
            {
              class: vue.normalizeClass(["switch-text", { "highlight-online": $data.isOnline }])
            },
            vue.toDisplayString($data.isOnline ? "接单中" : "已休息"),
            3
            /* TEXT, CLASS */
          ),
          vue.createElementVNode(
            "view",
            {
              class: vue.normalizeClass(["switch-dot", { online: $data.isOnline }])
            },
            null,
            2
            /* CLASS */
          )
        ])
      ]),
      vue.createElementVNode("view", { class: "stats-grid" }, [
        vue.createElementVNode("view", { class: "stat-card" }, [
          vue.createElementVNode(
            "text",
            { class: "stat-num" },
            vue.toDisplayString($data.stats.todayDone),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "stat-label" }, "今日完成")
        ]),
        vue.createElementVNode("view", { class: "stat-card" }, [
          vue.createElementVNode(
            "text",
            { class: "stat-num" },
            vue.toDisplayString($data.stats.delivering),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "stat-label" }, "配送中")
        ]),
        vue.createElementVNode("view", { class: "stat-card" }, [
          vue.createElementVNode(
            "text",
            { class: "stat-num" },
            "¥" + vue.toDisplayString($data.stats.todayEarning),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "stat-label" }, "今日收入")
        ])
      ]),
      vue.createElementVNode("view", { class: "menu-section" }, [
        vue.createElementVNode("view", { class: "section-title-small" }, "📦 订单管理"),
        vue.createElementVNode("view", { class: "menu-grid" }, [
          vue.createElementVNode("view", {
            class: "menu-item",
            onClick: _cache[1] || (_cache[1] = (...args) => $options.goOrders && $options.goOrders(...args))
          }, [
            vue.createElementVNode("view", {
              class: "menu-icon-wrap",
              style: { "background-color": "#E6F7FF" }
            }, [
              vue.createElementVNode("text", { class: "menu-icon" }, "📋")
            ]),
            vue.createElementVNode("text", { class: "menu-text" }, "外卖订单"),
            $data.stats.pending > 0 ? (vue.openBlock(), vue.createElementBlock(
              "text",
              {
                key: 0,
                class: "menu-badge"
              },
              vue.toDisplayString($data.stats.pending),
              1
              /* TEXT */
            )) : vue.createCommentVNode("v-if", true)
          ]),
          vue.createElementVNode("view", {
            class: "menu-item",
            onClick: _cache[2] || (_cache[2] = (...args) => $options.goErrands && $options.goErrands(...args))
          }, [
            vue.createElementVNode("view", {
              class: "menu-icon-wrap",
              style: { "background-color": "#FFF7E6" }
            }, [
              vue.createElementVNode("text", { class: "menu-icon" }, "🏃")
            ]),
            vue.createElementVNode("text", { class: "menu-text" }, "跑腿订单"),
            $data.stats.errandPending > 0 ? (vue.openBlock(), vue.createElementBlock(
              "text",
              {
                key: 0,
                class: "menu-badge"
              },
              vue.toDisplayString($data.stats.errandPending),
              1
              /* TEXT */
            )) : vue.createCommentVNode("v-if", true)
          ]),
          vue.createElementVNode("view", {
            class: "menu-item",
            onClick: _cache[3] || (_cache[3] = (...args) => $options.goTodayOrders && $options.goTodayOrders(...args))
          }, [
            vue.createElementVNode("view", {
              class: "menu-icon-wrap",
              style: { "background-color": "#F0F5FF" }
            }, [
              vue.createElementVNode("text", { class: "menu-icon" }, "📊")
            ]),
            vue.createElementVNode("text", { class: "menu-text" }, "今日订单"),
            $data.stats.todayDone > 0 ? (vue.openBlock(), vue.createElementBlock(
              "text",
              {
                key: 0,
                class: "menu-badge"
              },
              vue.toDisplayString($data.stats.todayDone),
              1
              /* TEXT */
            )) : vue.createCommentVNode("v-if", true)
          ])
        ])
      ]),
      vue.createElementVNode("view", { class: "menu-section" }, [
        vue.createElementVNode("view", { class: "section-title-small" }, "💰 收入统计"),
        vue.createElementVNode("view", { class: "menu-grid" }, [
          vue.createElementVNode("view", {
            class: "menu-item",
            onClick: _cache[4] || (_cache[4] = (...args) => $options.goEarnings && $options.goEarnings(...args))
          }, [
            vue.createElementVNode("view", {
              class: "menu-icon-wrap",
              style: { "background-color": "#F6FFED" }
            }, [
              vue.createElementVNode("text", { class: "menu-icon" }, "💰")
            ]),
            vue.createElementVNode("text", { class: "menu-text" }, "收入明细")
          ]),
          vue.createElementVNode("view", {
            class: "menu-item",
            onClick: _cache[5] || (_cache[5] = (...args) => $options.goWeekStats && $options.goWeekStats(...args))
          }, [
            vue.createElementVNode("view", {
              class: "menu-icon-wrap",
              style: { "background-color": "#FFF0F6" }
            }, [
              vue.createElementVNode("text", { class: "menu-icon" }, "📈")
            ]),
            vue.createElementVNode("text", { class: "menu-text" }, "本周统计")
          ]),
          vue.createElementVNode("view", {
            class: "menu-item",
            onClick: _cache[6] || (_cache[6] = (...args) => $options.goMonthStats && $options.goMonthStats(...args))
          }, [
            vue.createElementVNode("view", {
              class: "menu-icon-wrap",
              style: { "background-color": "#FCF0FF" }
            }, [
              vue.createElementVNode("text", { class: "menu-icon" }, "📅")
            ]),
            vue.createElementVNode("text", { class: "menu-text" }, "本月统计")
          ])
        ])
      ]),
      vue.createElementVNode("view", { class: "menu-section" }, [
        vue.createElementVNode("view", { class: "section-title-small" }, "🛠️ 我的服务"),
        vue.createElementVNode("view", { class: "menu-grid" }, [
          vue.createElementVNode("view", {
            class: "menu-item",
            onClick: _cache[7] || (_cache[7] = (...args) => $options.goProfile && $options.goProfile(...args))
          }, [
            vue.createElementVNode("view", {
              class: "menu-icon-wrap",
              style: { "background-color": "#E6FFFB" }
            }, [
              vue.createElementVNode("text", { class: "menu-icon" }, "👤")
            ]),
            vue.createElementVNode("text", { class: "menu-text" }, "个人中心")
          ]),
          vue.createElementVNode("view", {
            class: "menu-item",
            onClick: _cache[8] || (_cache[8] = (...args) => $options.goSettings && $options.goSettings(...args))
          }, [
            vue.createElementVNode("view", {
              class: "menu-icon-wrap",
              style: { "background-color": "#FFF7E6" }
            }, [
              vue.createElementVNode("text", { class: "menu-icon" }, "⚙️")
            ]),
            vue.createElementVNode("text", { class: "menu-text" }, "设置")
          ]),
          vue.createElementVNode("view", {
            class: "menu-item",
            onClick: _cache[9] || (_cache[9] = (...args) => $options.goHelp && $options.goHelp(...args))
          }, [
            vue.createElementVNode("view", {
              class: "menu-icon-wrap",
              style: { "background-color": "#F0F5FF" }
            }, [
              vue.createElementVNode("text", { class: "menu-icon" }, "❓")
            ]),
            vue.createElementVNode("text", { class: "menu-text" }, "帮助中心")
          ])
        ])
      ]),
      $options.pendingOrders.length > 0 ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "section"
      }, [
        vue.createElementVNode("view", { class: "section-header" }, [
          vue.createElementVNode("text", { class: "section-title" }, "� 配送中订单"),
          vue.createElementVNode("text", {
            class: "section-action",
            onClick: _cache[10] || (_cache[10] = (...args) => $options.goOrders && $options.goOrders(...args))
          }, "查看全部")
        ]),
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($options.pendingOrders.slice(0, 3), (order) => {
            return vue.openBlock(), vue.createElementBlock("view", {
              class: "order-card",
              key: order.id,
              onClick: ($event) => $options.goOrderDetail(order)
            }, [
              vue.createElementVNode("view", { class: "order-top" }, [
                vue.createElementVNode(
                  "text",
                  { class: "order-type" },
                  vue.toDisplayString(order.type === "takeout" ? "外卖" : "跑腿"),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode(
                  "text",
                  { class: "order-price" },
                  "¥" + vue.toDisplayString(order.rider_fee || 0),
                  1
                  /* TEXT */
                )
              ]),
              vue.createElementVNode("view", { class: "order-addr" }, [
                vue.createElementVNode("text", { class: "addr-icon" }, "📍"),
                vue.createElementVNode(
                  "text",
                  { class: "addr-text" },
                  vue.toDisplayString($options.getBriefAddress(order)),
                  1
                  /* TEXT */
                )
              ]),
              vue.createElementVNode("view", { class: "order-bottom" }, [
                vue.createElementVNode(
                  "text",
                  { class: "order-time" },
                  vue.toDisplayString($options.formatTime(order.created_at)),
                  1
                  /* TEXT */
                )
              ])
            ], 8, ["onClick"]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ])) : vue.createCommentVNode("v-if", true),
      $options.pendingOrders.length === 0 && $data.isOnline ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "empty-state"
      }, [
        vue.createElementVNode("text", { class: "empty-icon" }, "☕"),
        vue.createElementVNode("text", { class: "empty-text" }, "暂无可接订单"),
        vue.createElementVNode("text", { class: "empty-tip" }, "休息一下，新订单快来了~")
      ])) : vue.createCommentVNode("v-if", true),
      $data.showConfirmDialog ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 2,
        class: "confirm-dialog"
      }, [
        vue.createElementVNode("view", {
          class: "dialog-mask",
          onClick: _cache[11] || (_cache[11] = (...args) => $options.cancelOffWork && $options.cancelOffWork(...args))
        }),
        vue.createElementVNode("view", { class: "dialog-content" }, [
          vue.createElementVNode("view", { class: "dialog-title" }, "提示"),
          vue.createElementVNode("view", { class: "dialog-message" }, "确定现在下班吗？"),
          vue.createElementVNode("view", { class: "dialog-buttons" }, [
            vue.createElementVNode(
              "button",
              {
                class: vue.normalizeClass(["dialog-btn confirm-btn", { disabled: $data.countdown > 0 }]),
                onClick: _cache[12] || (_cache[12] = (...args) => $options.confirmOffWork && $options.confirmOffWork(...args))
              },
              vue.toDisplayString($data.countdown > 0 ? `确定 (${$data.countdown}s)` : "确定"),
              3
              /* TEXT, CLASS */
            ),
            vue.createElementVNode("button", {
              class: "dialog-btn cancel-btn",
              onClick: _cache[13] || (_cache[13] = (...args) => $options.cancelOffWork && $options.cancelOffWork(...args))
            }, " 取消 ")
          ])
        ])
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesIndexIndex = /* @__PURE__ */ _export_sfc(_sfc_main$a, [["render", _sfc_render$9], ["__scopeId", "data-v-1cf27b2a"], ["__file", "E:/固始县外卖骑手端/pages/index/index.vue"]]);
  const _sfc_main$9 = {
    data() {
      return {
        currentStatus: "",
        statusTabs: [
          { key: "", label: "全部", count: 0 },
          { key: "1", label: "待接单", count: 0 },
          { key: "4", label: "备货完成", count: 0 },
          { key: "5", label: "配送中", count: 0 },
          { key: "6", label: "已完成", count: 0 }
        ],
        orderList: [],
        page: 1,
        pageSize: 10,
        refreshing: false,
        loadingMore: false
      };
    },
    onLoad() {
      this.loadOrderList();
    },
    onShow() {
      this.loadOrderList();
    },
    methods: {
      formatTime,
      getStatusText(status) {
        var _a;
        return ((_a = ORDER_STATUS[status]) == null ? void 0 : _a.text) || "未知";
      },
      getStatusColor(status) {
        var _a;
        return ((_a = ORDER_STATUS[status]) == null ? void 0 : _a.color) || "#999";
      },
      getFullAddress(order) {
        try {
          const addr = typeof order.delivery_address === "string" ? JSON.parse(order.delivery_address) : order.delivery_address;
          return addr.province + addr.city + addr.district + addr.street + addr.detail;
        } catch (e) {
          return "未知地址";
        }
      },
      getBriefAddress(order) {
        try {
          const addr = typeof order.delivery_address === "string" ? JSON.parse(order.delivery_address) : order.delivery_address;
          return (addr.district || "") + (addr.street || "") || "未知地址";
        } catch (e) {
          return "未知地址";
        }
      },
      switchStatus(status) {
        this.currentStatus = status;
        this.page = 1;
        this.loadOrderList();
      },
      async loadOrderList() {
        try {
          const params = {};
          if (this.currentStatus !== "") {
            params.status = this.currentStatus;
          }
          const res = await getRiderOrders(params);
          const list = res.data || [];
          this.orderList = list;
          this.updateStatusCounts();
        } catch (e) {
          formatAppLog("error", "at pages/orders/index.vue:185", "加载订单失败", e);
          this.orderList = [];
        }
      },
      updateStatusCounts() {
        const counter = {};
        this.orderList.forEach((order) => {
          counter[order.status] = (counter[order.status] || 0) + 1;
        });
        this.statusTabs = this.statusTabs.map((tab) => ({
          ...tab,
          count: tab.key === "" ? this.orderList.length : counter[tab.key] || 0
        }));
      },
      async onRefresh() {
        this.refreshing = true;
        this.page = 1;
        await this.loadOrderList();
        this.refreshing = false;
      },
      loadMore() {
        if (this.loadingMore)
          return;
        this.loadingMore = true;
        this.page++;
        this.loadingMore = false;
      },
      async confirmDelivery(order) {
        uni.showModal({
          title: "确认送达",
          content: "请确认已将餐品送达顾客手中",
          confirmText: "确认送达",
          success: async (res) => {
            if (res.confirm) {
              try {
                await confirmDelivery({ order_id: order.id });
                uni.showToast({ title: "送达成功", icon: "success" });
                this.loadOrderList();
              } catch (e) {
                formatAppLog("error", "at pages/orders/index.vue:229", "确认送达失败", e);
              }
            }
          }
        });
      },
      callMerchant(phone) {
        if (phone) {
          uni.makePhoneCall({ phoneNumber: phone });
        }
      },
      goDetail(order) {
        uni.navigateTo({
          url: `/pages/orders/detail?id=${order.id}`
        });
      }
    }
  };
  function _sfc_render$8(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "status-tabs" }, [
        vue.createElementVNode("scroll-view", {
          "scroll-x": "",
          class: "tabs-scroll"
        }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($data.statusTabs, (item) => {
              return vue.openBlock(), vue.createElementBlock("view", {
                key: item.key,
                class: vue.normalizeClass(["tab-item", { active: $data.currentStatus === item.key }]),
                onClick: ($event) => $options.switchStatus(item.key)
              }, vue.toDisplayString(item.label), 11, ["onClick"]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])
      ]),
      vue.createElementVNode("scroll-view", {
        "scroll-y": "",
        class: "order-scroll",
        onScrolltolower: _cache[0] || (_cache[0] = (...args) => $options.loadMore && $options.loadMore(...args)),
        "refresher-enabled": true,
        "refresher-triggered": $data.refreshing,
        onRefresherrefresh: _cache[1] || (_cache[1] = (...args) => $options.onRefresh && $options.onRefresh(...args))
      }, [
        $data.orderList.length ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "order-list"
        }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($data.orderList, (order) => {
              var _a;
              return vue.openBlock(), vue.createElementBlock("view", {
                key: order.id,
                class: vue.normalizeClass(["order-card", { "highlight-card": order.status === 1 || order.status === 4 }]),
                onClick: ($event) => $options.goDetail(order)
              }, [
                vue.createElementVNode("view", { class: "order-header" }, [
                  vue.createElementVNode("view", { class: "header-left" }, [
                    vue.createElementVNode("view", { class: "order-info-row" }, [
                      vue.createElementVNode(
                        "text",
                        { class: "order-no" },
                        vue.toDisplayString(order.order_no),
                        1
                        /* TEXT */
                      ),
                      vue.createElementVNode(
                        "view",
                        {
                          class: "status-tag",
                          style: vue.normalizeStyle({ backgroundColor: $options.getStatusColor(order.status) })
                        },
                        vue.toDisplayString($options.getStatusText(order.status)),
                        5
                        /* TEXT, STYLE */
                      )
                    ]),
                    vue.createElementVNode(
                      "text",
                      { class: "order-time" },
                      vue.toDisplayString($options.formatTime(order.created_at)),
                      1
                      /* TEXT */
                    )
                  ])
                ]),
                vue.createElementVNode("view", { class: "delivery-fee-section" }, [
                  vue.createElementVNode("text", { class: "fee-label" }, "💰 配送费"),
                  vue.createElementVNode(
                    "text",
                    { class: "fee-num" },
                    "¥" + vue.toDisplayString(order.rider_fee || 0),
                    1
                    /* TEXT */
                  )
                ]),
                vue.createElementVNode("view", { class: "simple-info" }, [
                  vue.createElementVNode("text", { class: "info-icon" }, "🏪"),
                  vue.createElementVNode(
                    "text",
                    { class: "info-text" },
                    vue.toDisplayString(((_a = order.merchant) == null ? void 0 : _a.name) || "未知商家"),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode("text", {
                    class: "call-btn",
                    onClick: vue.withModifiers(($event) => {
                      var _a2;
                      return $options.callMerchant((_a2 = order.merchant) == null ? void 0 : _a2.phone);
                    }, ["stop"])
                  }, "📞 打电话", 8, ["onClick"])
                ]),
                vue.createElementVNode("view", { class: "simple-info" }, [
                  vue.createElementVNode("text", { class: "info-icon" }, "📍"),
                  vue.createElementVNode(
                    "text",
                    { class: "info-text address-text" },
                    vue.toDisplayString($options.getBriefAddress(order)),
                    1
                    /* TEXT */
                  )
                ]),
                vue.createElementVNode("view", { class: "order-actions" }, [
                  order.status === 5 ? (vue.openBlock(), vue.createElementBlock("button", {
                    key: 0,
                    class: "btn btn-success",
                    onClick: vue.withModifiers(($event) => $options.confirmDelivery(order), ["stop"])
                  }, " 确认送达 ", 8, ["onClick"])) : vue.createCommentVNode("v-if", true),
                  vue.createElementVNode("button", {
                    class: "btn btn-default",
                    onClick: vue.withModifiers(($event) => $options.goDetail(order), ["stop"])
                  }, " 查看详情 ", 8, ["onClick"])
                ])
              ], 10, ["onClick"]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])) : (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "empty-state"
        }, [
          vue.createElementVNode("text", { class: "empty-icon" }, "📋"),
          vue.createElementVNode("text", { class: "empty-text" }, "暂无订单"),
          vue.createElementVNode(
            "text",
            { class: "empty-tip" },
            vue.toDisplayString($data.currentStatus === "" ? "暂无可接订单" : "该状态下暂无订单"),
            1
            /* TEXT */
          )
        ])),
        $data.loadingMore ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 2,
          class: "load-more"
        }, [
          vue.createElementVNode("text", null, "加载中...")
        ])) : vue.createCommentVNode("v-if", true)
      ], 40, ["refresher-triggered"])
    ]);
  }
  const PagesOrdersIndex = /* @__PURE__ */ _export_sfc(_sfc_main$9, [["render", _sfc_render$8], ["__scopeId", "data-v-e1e6274e"], ["__file", "E:/固始县外卖骑手端/pages/orders/index.vue"]]);
  const _sfc_main$8 = {
    data() {
      return {
        orderId: null,
        order: {}
      };
    },
    computed: {
      canDeliver() {
        return this.order.status === 5;
      }
    },
    onLoad(options) {
      this.orderId = options.id;
      this.loadOrderDetail();
    },
    methods: {
      formatTime,
      getStatusText(status) {
        var _a;
        return ((_a = ORDER_STATUS[status]) == null ? void 0 : _a.text) || "未知";
      },
      getStatusColor(status) {
        var _a;
        return ((_a = ORDER_STATUS[status]) == null ? void 0 : _a.color) || "#999";
      },
      getFullAddress(order) {
        try {
          const addr = typeof order.delivery_address === "string" ? JSON.parse(order.delivery_address) : order.delivery_address;
          return addr.province + addr.city + addr.district + addr.street + addr.detail;
        } catch (e) {
          return "未知地址";
        }
      },
      async loadOrderDetail() {
        try {
          const res = await getOrderDetail(this.orderId);
          this.order = res.data || {};
        } catch (e) {
          formatAppLog("error", "at pages/orders/detail.vue:107", "加载订单详情失败", e);
        }
      },
      async handleConfirmDelivery() {
        try {
          await confirmDelivery({ order_id: this.orderId });
          uni.showToast({ title: "送达成功", icon: "success" });
          this.loadOrderDetail();
        } catch (e) {
          formatAppLog("error", "at pages/orders/detail.vue:116", "确认送达失败", e);
        }
      },
      getRiderId() {
        const userInfoStr = uni.getStorageSync("userInfo");
        if (!userInfoStr) {
          return "";
        }
        try {
          const userInfo = JSON.parse(userInfoStr);
          return userInfo.id || "";
        } catch (e) {
          formatAppLog("error", "at pages/orders/detail.vue:128", "解析用户信息失败", e);
          return "";
        }
      },
      parseAddress() {
        try {
          return typeof this.order.delivery_address === "string" ? JSON.parse(this.order.delivery_address) : this.order.delivery_address || {};
        } catch (e) {
          return {};
        }
      },
      getCoordinateByKeys(source, keys) {
        for (let i = 0; i < keys.length; i++) {
          const value2 = source[keys[i]];
          if (value2 !== void 0 && value2 !== null && value2 !== "") {
            return value2;
          }
        }
        return "";
      },
      getMerchantCoords() {
        const address = this.parseAddress();
        const merchant = this.order.merchant || {};
        const lng = this.getCoordinateByKeys(merchant, ["lng", "lat_lng", "longitude", "lon", "map_lng", "merchant_lng", "merchantLng"]) || this.getCoordinateByKeys(this.order || {}, ["merchant_lng", "merchantLng", "shop_lng", "shopLng", "store_lng", "storeLng", "pickup_lng", "pickupLng", "from_lng", "fromLng"]) || this.getCoordinateByKeys(address, ["merchant_lng", "shop_lng", "store_lng", "pickup_lng", "from_lng"]);
        const lat = this.getCoordinateByKeys(merchant, ["lat", "latitude", "map_lat", "merchant_lat", "merchantLat"]) || this.getCoordinateByKeys(this.order || {}, ["merchant_lat", "merchantLat", "shop_lat", "shopLat", "store_lat", "storeLat", "pickup_lat", "pickupLat", "from_lat", "fromLat"]) || this.getCoordinateByKeys(address, ["merchant_lat", "shop_lat", "store_lat", "pickup_lat", "from_lat"]);
        return { lng, lat };
      },
      getCustomerCoords() {
        const address = this.parseAddress();
        const fallback = this.order || {};
        const lng = this.getCoordinateByKeys(address, ["lng", "longitude", "lon", "map_lng", "delivery_lng", "deliveryLng", "user_lng", "receiver_lng", "to_lng", "dest_lng", "customer_lng", "customerLng"]) || this.getCoordinateByKeys(fallback, ["delivery_lng", "deliveryLng", "delivery_longitude", "user_lng", "userLng", "contact_lng", "receiver_lng", "to_lng", "dest_lng", "customer_lng", "customerLng"]);
        const lat = this.getCoordinateByKeys(address, ["lat", "latitude", "map_lat", "delivery_lat", "deliveryLat", "user_lat", "receiver_lat", "to_lat", "dest_lat", "customer_lat", "customerLat"]) || this.getCoordinateByKeys(fallback, ["delivery_lat", "deliveryLat", "delivery_latitude", "user_lat", "userLat", "contact_lat", "receiver_lat", "to_lat", "dest_lat", "customer_lat", "customerLat"]);
        return { lng, lat };
      },
      navigateToMap(payload) {
        const riderId = this.getRiderId() || this.getCoordinateByKeys(this.order || {}, ["rider_id", "riderId", "user_id", "userId"]) || "test-rider";
        const token = uni.getStorageSync("token") || "";
        const stage = payload && payload.stage === "delivery" ? "delivery" : "pickup";
        const safeTk = TIANDITU_TK;
        const safeMerchantLng = payload && payload.merchantLng !== void 0 && payload.merchantLng !== null && payload.merchantLng !== "" ? String(payload.merchantLng) : "";
        const safeMerchantLat = payload && payload.merchantLat !== void 0 && payload.merchantLat !== null && payload.merchantLat !== "" ? String(payload.merchantLat) : "";
        const safeCustomerLng = payload && payload.customerLng !== void 0 && payload.customerLng !== null && payload.customerLng !== "" ? String(payload.customerLng) : "";
        const safeCustomerLat = payload && payload.customerLat !== void 0 && payload.customerLat !== null && payload.customerLat !== "" ? String(payload.customerLat) : "";
        uni.navigateTo({
          url: `/pages/map/nav?riderId=${encodeURIComponent(riderId)}&token=${encodeURIComponent(token)}&stage=${encodeURIComponent(stage)}&tk=${encodeURIComponent(safeTk)}&merchantLng=${encodeURIComponent(safeMerchantLng)}&merchantLat=${encodeURIComponent(safeMerchantLat)}&customerLng=${encodeURIComponent(safeCustomerLng)}&customerLat=${encodeURIComponent(safeCustomerLat)}`
        });
      },
      goPickup() {
        const merchant = this.getMerchantCoords();
        const customer = this.getCustomerCoords();
        this.navigateToMap({
          stage: "pickup",
          merchantLng: merchant.lng,
          merchantLat: merchant.lat,
          customerLng: customer.lng,
          customerLat: customer.lat
        });
      },
      goDelivery() {
        const merchant = this.getMerchantCoords();
        const customer = this.getCustomerCoords();
        this.navigateToMap({
          stage: "delivery",
          merchantLng: merchant.lng,
          merchantLat: merchant.lat,
          customerLng: customer.lng,
          customerLat: customer.lat
        });
      },
      callUser(phone) {
        if (phone) {
          uni.makePhoneCall({ phoneNumber: phone });
        }
      }
    }
  };
  function _sfc_render$7(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("text", { class: "section-title" }, "订单信息"),
        vue.createElementVNode("view", { class: "info-row" }, [
          vue.createElementVNode("text", { class: "label" }, "订单号"),
          vue.createElementVNode(
            "text",
            { class: "value" },
            vue.toDisplayString($data.order.order_no),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "info-row" }, [
          vue.createElementVNode("text", { class: "label" }, "订单状态"),
          vue.createElementVNode(
            "text",
            {
              class: "value status",
              style: vue.normalizeStyle({ color: $options.getStatusColor($data.order.status) })
            },
            vue.toDisplayString($options.getStatusText($data.order.status)),
            5
            /* TEXT, STYLE */
          )
        ]),
        vue.createElementVNode("view", { class: "info-row" }, [
          vue.createElementVNode("text", { class: "label" }, "下单时间"),
          vue.createElementVNode(
            "text",
            { class: "value" },
            vue.toDisplayString($options.formatTime($data.order.created_at)),
            1
            /* TEXT */
          )
        ])
      ]),
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("text", { class: "section-title" }, "配送信息"),
        vue.createElementVNode("view", { class: "info-row" }, [
          vue.createElementVNode("text", { class: "label" }, "配送地址"),
          vue.createElementVNode(
            "text",
            { class: "value" },
            vue.toDisplayString($options.getFullAddress($data.order)),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "info-row" }, [
          vue.createElementVNode("text", { class: "label" }, "联系人"),
          vue.createElementVNode(
            "text",
            { class: "value" },
            vue.toDisplayString($data.order.contact_name),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "info-row" }, [
          vue.createElementVNode("text", { class: "label" }, "联系电话"),
          vue.createElementVNode(
            "text",
            {
              class: "value",
              onClick: _cache[0] || (_cache[0] = ($event) => $options.callUser($data.order.contact_phone))
            },
            vue.toDisplayString($data.order.contact_phone),
            1
            /* TEXT */
          )
        ])
      ]),
      vue.createElementVNode("view", { class: "card" }, [
        vue.createElementVNode("text", { class: "section-title" }, "费用信息"),
        vue.createElementVNode("view", { class: "info-row" }, [
          vue.createElementVNode("text", { class: "label" }, "订单总额"),
          vue.createElementVNode(
            "text",
            { class: "value" },
            "¥" + vue.toDisplayString($data.order.pay_amount),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "info-row" }, [
          vue.createElementVNode("text", { class: "label" }, "配送费"),
          vue.createElementVNode(
            "text",
            { class: "value highlight" },
            "¥" + vue.toDisplayString($data.order.rider_fee),
            1
            /* TEXT */
          )
        ])
      ]),
      vue.createElementVNode("view", { class: "action-bar" }, [
        vue.createElementVNode("button", {
          class: "btn btn-primary",
          onClick: _cache[1] || (_cache[1] = (...args) => $options.goPickup && $options.goPickup(...args))
        }, " 去取餐 "),
        vue.createElementVNode("button", {
          class: "btn btn-primary",
          onClick: _cache[2] || (_cache[2] = (...args) => $options.goDelivery && $options.goDelivery(...args))
        }, " 去送餐 "),
        $options.canDeliver ? (vue.openBlock(), vue.createElementBlock("button", {
          key: 0,
          class: "btn btn-success",
          onClick: _cache[3] || (_cache[3] = (...args) => $options.handleConfirmDelivery && $options.handleConfirmDelivery(...args))
        }, " 确认送达 ")) : vue.createCommentVNode("v-if", true)
      ])
    ]);
  }
  const PagesOrdersDetail = /* @__PURE__ */ _export_sfc(_sfc_main$8, [["render", _sfc_render$7], ["__scopeId", "data-v-bc4602bd"], ["__file", "E:/固始县外卖骑手端/pages/orders/detail.vue"]]);
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
  for (let i = 0; i < chars.length; i++) {
    lookup$1[chars.charCodeAt(i)] = i;
  }
  const decode$1 = (base64) => {
    let bufferLength = base64.length * 0.75, len = base64.length, i, p = 0, encoded1, encoded2, encoded3, encoded4;
    if (base64[base64.length - 1] === "=") {
      bufferLength--;
      if (base64[base64.length - 2] === "=") {
        bufferLength--;
      }
    }
    const arraybuffer = new ArrayBuffer(bufferLength), bytes = new Uint8Array(arraybuffer);
    for (i = 0; i < len; i += 4) {
      encoded1 = lookup$1[base64.charCodeAt(i)];
      encoded2 = lookup$1[base64.charCodeAt(i + 1)];
      encoded3 = lookup$1[base64.charCodeAt(i + 2)];
      encoded4 = lookup$1[base64.charCodeAt(i + 3)];
      bytes[p++] = encoded1 << 2 | encoded2 >> 4;
      bytes[p++] = (encoded2 & 15) << 4 | encoded3 >> 2;
      bytes[p++] = (encoded3 & 3) << 6 | encoded4 & 63;
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
    packets.forEach((packet, i) => {
      encodePacket(packet, false, (encodedPacket) => {
        encodedPackets[i] = encodedPacket;
        if (++count === length) {
          callback(encodedPackets.join(SEPARATOR));
        }
      });
    });
  };
  const decodePayload = (encodedPayload, binaryType) => {
    const encodedPackets = encodedPayload.split(SEPARATOR);
    const packets = [];
    for (let i = 0; i < encodedPackets.length; i++) {
      const decodedPacket = decodePacket(encodedPackets[i], binaryType);
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
    let j = 0;
    for (let i = 0; i < size; i++) {
      buffer[i] = chunks[0][j++];
      if (j === chunks[0].length) {
        chunks.shift();
        j = 0;
      }
    }
    if (chunks.length && j < chunks[0].length) {
      chunks[0] = chunks[0].slice(j);
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
            const n = view.getUint32(0);
            if (n > Math.pow(2, 53 - 32) - 1) {
              controller.enqueue(ERROR_PACKET);
              break;
            }
            expectedLength = n * Math.pow(2, 32) + view.getUint32(4);
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
  Emitter.prototype.on = Emitter.prototype.addEventListener = function(event, fn) {
    this._callbacks = this._callbacks || {};
    (this._callbacks["$" + event] = this._callbacks["$" + event] || []).push(fn);
    return this;
  };
  Emitter.prototype.once = function(event, fn) {
    function on2() {
      this.off(event, on2);
      fn.apply(this, arguments);
    }
    on2.fn = fn;
    this.on(event, on2);
    return this;
  };
  Emitter.prototype.off = Emitter.prototype.removeListener = Emitter.prototype.removeAllListeners = Emitter.prototype.removeEventListener = function(event, fn) {
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
    for (var i = 0; i < callbacks.length; i++) {
      cb = callbacks[i];
      if (cb === fn || cb.fn === fn) {
        callbacks.splice(i, 1);
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
    for (var i = 1; i < arguments.length; i++) {
      args[i - 1] = arguments[i];
    }
    if (callbacks) {
      callbacks = callbacks.slice(0);
      for (var i = 0, len = callbacks.length; i < len; ++i) {
        callbacks[i].apply(this, args);
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
    let c = 0, length = 0;
    for (let i = 0, l = str.length; i < l; i++) {
      c = str.charCodeAt(i);
      if (c < 128) {
        length += 1;
      } else if (c < 2048) {
        length += 2;
      } else if (c < 55296 || c >= 57344) {
        length += 3;
      } else {
        i++;
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
    for (let i in obj) {
      if (obj.hasOwnProperty(i)) {
        if (str.length)
          str += "&";
        str += encodeURIComponent(i) + "=" + encodeURIComponent(obj[i]);
      }
    }
    return str;
  }
  function decode(qs) {
    let qry = {};
    let pairs = qs.split("&");
    for (let i = 0, l = pairs.length; i < l; i++) {
      let pair = pairs[i].split("=");
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
    doWrite(data, fn) {
      const req = this.request({
        method: "POST",
        data
      });
      req.on("success", fn);
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
            for (let i in this._opts.extraHeaders) {
              if (this._opts.extraHeaders.hasOwnProperty(i)) {
                xhr.setRequestHeader(i, this._opts.extraHeaders[i]);
              }
            }
          }
        } catch (e) {
        }
        if ("POST" === this._method) {
          try {
            xhr.setRequestHeader("Content-type", "text/plain;charset=UTF-8");
          } catch (e) {
          }
        }
        try {
          xhr.setRequestHeader("Accept", "*/*");
        } catch (e) {
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
      } catch (e) {
        this.setTimeoutFn(() => {
          this._onError(e);
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
        } catch (e) {
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
    for (let i in Request.requests) {
      if (Request.requests.hasOwnProperty(i)) {
        Request.requests[i].abort();
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
    } catch (e) {
    }
    if (!xdomain) {
      try {
        return new globalThisShim[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP");
      } catch (e) {
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
      this.ws.onerror = (e) => this.onError("websocket error", e);
    }
    write(packets) {
      this.writable = false;
      for (let i = 0; i < packets.length; i++) {
        const packet = packets[i];
        const lastPacket = i === packets.length - 1;
        encodePacket(packet, this.supportsBinary, (data) => {
          try {
            this.doWrite(packet, data);
          } catch (e) {
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
      for (let i = 0; i < packets.length; i++) {
        const packet = packets[i];
        const lastPacket = i === packets.length - 1;
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
  const re = /^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;
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
    const src = str, b = str.indexOf("["), e = str.indexOf("]");
    if (b != -1 && e != -1) {
      str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ";") + str.substring(e, str.length);
    }
    let m = re.exec(str || ""), uri = {}, i = 14;
    while (i--) {
      uri[parts[i]] = m[i] || "";
    }
    if (b != -1 && e != -1) {
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
      opts.transports.forEach((t) => {
        const transportName = t.prototype.name;
        this.transports.push(transportName);
        this._transportsByName[transportName] = t;
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
      for (let i = 0; i < this.writeBuffer.length; i++) {
        const data = this.writeBuffer[i].data;
        if (data) {
          payloadSize += byteLength(data);
        }
        if (i > 0 && payloadSize > this._maxPayload) {
          return this.writeBuffer.slice(0, i);
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
    write(msg, options, fn) {
      this._sendPacket("message", msg, options, fn);
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
    send(msg, options, fn) {
      this._sendPacket("message", msg, options, fn);
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
    _sendPacket(type, data, options, fn) {
      if ("function" === typeof data) {
        fn = data;
        data = void 0;
      }
      if ("function" === typeof options) {
        fn = options;
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
      if (fn)
        this.once("flush", fn);
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
            const i = OFFLINE_EVENT_LISTENERS.indexOf(this._offlineEventListener);
            if (i !== -1) {
              OFFLINE_EVENT_LISTENERS.splice(i, 1);
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
        for (let i = 0; i < this._upgrades.length; i++) {
          this._probe(this._upgrades[i]);
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
      for (let i = 0; i < upgrades.length; i++) {
        if (~this.transports.indexOf(upgrades[i]))
          filteredUpgrades.push(upgrades[i]);
      }
      return filteredUpgrades;
    }
  }
  let Socket$1 = class Socket extends SocketWithUpgrade {
    constructor(uri, opts = {}) {
      const o = typeof uri === "object" ? uri : opts;
      if (!o.transports || o.transports && typeof o.transports[0] === "string") {
        o.transports = (o.transports || ["polling", "websocket", "webtransport"]).map((transportName) => transports[transportName]).filter((t) => !!t);
      }
      super(uri, o);
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
      for (let i = 0, l = obj.length; i < l; i++) {
        if (hasBinary(obj[i])) {
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
      for (let i = 0; i < data.length; i++) {
        newData[i] = _deconstructPacket(data[i], buffers);
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
      for (let i = 0; i < data.length; i++) {
        data[i] = _reconstructPacket(data[i], buffers);
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
  function getDefaultExportFromCjs(x) {
    return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
  }
  var browser = { exports: {} };
  var ms;
  var hasRequiredMs;
  function requireMs() {
    if (hasRequiredMs)
      return ms;
    hasRequiredMs = 1;
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;
    ms = function(val, options) {
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
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "weeks":
        case "week":
        case "w":
          return n * w;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    function fmtShort(ms2) {
      var msAbs = Math.abs(ms2);
      if (msAbs >= d) {
        return Math.round(ms2 / d) + "d";
      }
      if (msAbs >= h) {
        return Math.round(ms2 / h) + "h";
      }
      if (msAbs >= m) {
        return Math.round(ms2 / m) + "m";
      }
      if (msAbs >= s) {
        return Math.round(ms2 / s) + "s";
      }
      return ms2 + "ms";
    }
    function fmtLong(ms2) {
      var msAbs = Math.abs(ms2);
      if (msAbs >= d) {
        return plural(ms2, msAbs, d, "day");
      }
      if (msAbs >= h) {
        return plural(ms2, msAbs, h, "hour");
      }
      if (msAbs >= m) {
        return plural(ms2, msAbs, m, "minute");
      }
      if (msAbs >= s) {
        return plural(ms2, msAbs, s, "second");
      }
      return ms2 + " ms";
    }
    function plural(ms2, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms2 / n) + " " + name + (isPlural ? "s" : "");
    }
    return ms;
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
      for (let i = 0; i < namespace.length; i++) {
        hash = (hash << 5) - hash + namespace.charCodeAt(i);
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
        set: (v) => {
          enableOverride = v;
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
      let m;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
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
      args.splice(lastC, 0, c);
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
      let r;
      try {
        r = exports.storage.getItem("debug") || exports.storage.getItem("DEBUG");
      } catch (error) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = define_process_env_default.DEBUG;
      }
      return r;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch (error) {
      }
    }
    module.exports = common(exports);
    const { formatters } = module.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
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
      let i = 0;
      const p = {
        type: Number(str.charAt(0))
      };
      if (PacketType[p.type] === void 0) {
        throw new Error("unknown packet type " + p.type);
      }
      if (p.type === PacketType.BINARY_EVENT || p.type === PacketType.BINARY_ACK) {
        const start = i + 1;
        while (str.charAt(++i) !== "-" && i != str.length) {
        }
        const buf = str.substring(start, i);
        if (buf != Number(buf) || str.charAt(i) !== "-") {
          throw new Error("Illegal attachments");
        }
        const n = Number(buf);
        if (!isInteger(n) || n < 0) {
          throw new Error("Illegal attachments");
        } else if (n > this.opts.maxAttachments) {
          throw new Error("too many attachments");
        }
        p.attachments = n;
      }
      if ("/" === str.charAt(i + 1)) {
        const start = i + 1;
        while (++i) {
          const c = str.charAt(i);
          if ("," === c)
            break;
          if (i === str.length)
            break;
        }
        p.nsp = str.substring(start, i);
      } else {
        p.nsp = "/";
      }
      const next = str.charAt(i + 1);
      if ("" !== next && Number(next) == next) {
        const start = i + 1;
        while (++i) {
          const c = str.charAt(i);
          if (null == c || Number(c) != c) {
            --i;
            break;
          }
          if (i === str.length)
            break;
        }
        p.id = Number(str.substring(start, i + 1));
      }
      if (str.charAt(++i)) {
        const payload = this.tryParse(str.substr(i));
        if (Decoder.isPayloadValid(p.type, payload)) {
          p.data = payload;
        } else {
          throw new Error("invalid payload");
        }
      }
      debug("decoded %s as %j", str, p);
      return p;
    }
    tryParse(str) {
      try {
        return JSON.parse(str, this.opts.reviver);
      } catch (e) {
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
  function on(obj, ev, fn) {
    obj.on(ev, fn);
    return function subDestroy() {
      obj.off(ev, fn);
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
        on(io, "open", this.onopen.bind(this)),
        on(io, "packet", this.onpacket.bind(this)),
        on(io, "error", this.onerror.bind(this)),
        on(io, "close", this.onclose.bind(this))
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
        for (let i = 0; i < this.sendBuffer.length; i++) {
          if (this.sendBuffer[i].id === id) {
            this.sendBuffer.splice(i, 1);
          }
        }
        ack.call(this, new Error("operation has timed out"));
      }, timeout);
      const fn = (...args) => {
        this.io.clearTimeoutFn(timer);
        ack.apply(this, args);
      };
      fn.withError = true;
      this.acks[id] = fn;
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
        const fn = (arg1, arg2) => {
          return arg1 ? reject(arg1) : resolve(arg2);
        };
        fn.withError = true;
        args.push(fn);
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
        for (let i = 0; i < listeners.length; i++) {
          if (listener === listeners[i]) {
            listeners.splice(i, 1);
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
        for (let i = 0; i < listeners.length; i++) {
          if (listener === listeners[i]) {
            listeners.splice(i, 1);
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
    reconnection(v) {
      if (!arguments.length)
        return this._reconnection;
      this._reconnection = !!v;
      if (!v) {
        this.skipReconnect = true;
      }
      return this;
    }
    reconnectionAttempts(v) {
      if (v === void 0)
        return this._reconnectionAttempts;
      this._reconnectionAttempts = v;
      return this;
    }
    reconnectionDelay(v) {
      var _a;
      if (v === void 0)
        return this._reconnectionDelay;
      this._reconnectionDelay = v;
      (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMin(v);
      return this;
    }
    randomizationFactor(v) {
      var _a;
      if (v === void 0)
        return this._randomizationFactor;
      this._randomizationFactor = v;
      (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setJitter(v);
      return this;
    }
    reconnectionDelayMax(v) {
      var _a;
      if (v === void 0)
        return this._reconnectionDelayMax;
      this._reconnectionDelayMax = v;
      (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMax(v);
      return this;
    }
    timeout(v) {
      if (!arguments.length)
        return this._timeout;
      this._timeout = v;
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
    open(fn) {
      if (~this._readyState.indexOf("open"))
        return this;
      this.engine = new Socket$1(this.uri, this.opts);
      const socket = this.engine;
      const self2 = this;
      this._readyState = "opening";
      this.skipReconnect = false;
      const openSubDestroy = on(socket, "open", function() {
        self2.onopen();
        fn && fn();
      });
      const onError = (err) => {
        this.cleanup();
        this._readyState = "closed";
        this.emitReserved("error", err);
        if (fn) {
          fn(err);
        } else {
          this.maybeReconnectOnOpen();
        }
      };
      const errorSub = on(socket, "error", onError);
      if (false !== this._timeout) {
        const timeout = this._timeout;
        const timer = this.setTimeoutFn(() => {
          openSubDestroy();
          onError(new Error("timeout"));
          socket.close();
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
    connect(fn) {
      return this.open(fn);
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
      const socket = this.engine;
      this.subs.push(
        on(socket, "ping", this.onping.bind(this)),
        on(socket, "data", this.ondata.bind(this)),
        on(socket, "error", this.onerror.bind(this)),
        on(socket, "close", this.onclose.bind(this)),
        // @ts-ignore
        on(this.decoder, "decoded", this.ondecoded.bind(this))
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
      } catch (e) {
        this.onclose("parse error", e);
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
      let socket = this.nsps[nsp];
      if (!socket) {
        socket = new Socket(this, nsp, opts);
        this.nsps[nsp] = socket;
      } else if (this._autoConnect && !socket.active) {
        socket.connect();
      }
      return socket;
    }
    /**
     * Called upon a socket close.
     *
     * @param socket
     * @private
     */
    _destroy(socket) {
      const nsps = Object.keys(this.nsps);
      for (const nsp of nsps) {
        const socket2 = this.nsps[nsp];
        if (socket2.active) {
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
      for (let i = 0; i < encodedPackets.length; i++) {
        this.engine.write(encodedPackets[i], packet.options);
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
  const _sfc_main$7 = {
    data() {
      return {
        webViewSrc: "",
        riderId: "",
        token: "",
        stage: "pickup",
        merchantLng: "",
        merchantLat: "",
        customerLng: "",
        customerLat: "",
        tk: "",
        simRunning: false,
        socket: null,
        watchId: null,
        trackingTimer: null,
        lastSent: { lng: null, lat: null, ts: 0 },
        fallbackPos: { lng: 115.66638, lat: 32.18385 },
        isDestroyed: false
      };
    },
    computed: {
      isH5() {
        try {
          return typeof window !== "undefined" && typeof document !== "undefined";
        } catch (e) {
          return false;
        }
      }
    },
    async onLoad(options) {
      const {
        riderId,
        token,
        stage,
        merchantLng,
        merchantLat,
        customerLng,
        customerLat,
        destLng,
        destLat,
        tk
      } = options || {};
      this.riderId = riderId || "rider-" + Date.now();
      this.token = token || "";
      this.stage = stage === "delivery" ? "delivery" : "pickup";
      this.merchantLng = merchantLng || "";
      this.merchantLat = merchantLat || "";
      this.customerLng = customerLng || "";
      this.customerLat = customerLat || "";
      this.tk = uni.getStorageSync("tianditu_tk") || tk || TIANDITU_TK || "";
      if (!this.tk) {
        uni.showToast({ title: "请配置天地图TK", icon: "none" });
      }
      const hasMerchant = this.merchantLng !== "" && this.merchantLat !== "";
      const hasCustomer = this.customerLng !== "" && this.customerLat !== "";
      const hasDest = destLng !== void 0 && destLat !== void 0 && destLng !== "" && destLat !== "";
      if (!hasMerchant && !hasCustomer && !hasDest) {
        uni.showToast({ title: "导航参数缺失", icon: "none" });
        return;
      }
      if (hasDest && !hasMerchant && !hasCustomer) {
        if (this.stage === "delivery") {
          this.customerLng = String(destLng);
          this.customerLat = String(destLat);
        } else {
          this.merchantLng = String(destLng);
          this.merchantLat = String(destLat);
        }
      }
      this.initSocket();
      this.startLocationTracking();
      if (this.isH5) {
        window.addEventListener("message", this.onMapMessage);
      }
      await this.refreshRoute();
    },
    onUnload() {
      this.isDestroyed = true;
      this.stopLocationTracking();
      this.destroySocket();
      if (this.isH5) {
        window.removeEventListener("message", this.onMapMessage);
      }
    },
    onHide() {
      this.stopLocationTracking();
    },
    onShow() {
      if (!this.isDestroyed) {
        this.startLocationTracking();
      }
    },
    methods: {
      onMapMessage(e) {
        const d = e && e.data ? e.data : null;
        if (!d || d.type !== "sim_location") {
          return;
        }
        this.stopLocationTracking();
        formatAppLog("log", "at pages/map/nav.vue:128", "收到模拟导航坐标:", d.lng, d.lat);
        const pos = {
          lng: d.lng,
          lat: d.lat,
          speed: d.speed || 30,
          heading: d.heading || 90,
          source: "sim"
        };
        this.emitLocationForce(pos);
      },
      initSocket() {
        const SOCKET_URL = "http://121.43.190.218:3000";
        formatAppLog("log", "at pages/map/nav.vue:140", "开始初始化 Socket.io，目标地址:", SOCKET_URL);
        try {
          this.socket = lookup(SOCKET_URL, {
            transports: ["websocket", "polling"],
            autoConnect: true,
            auth: {
              token: this.token,
              role: "rider",
              userId: this.riderId
            },
            query: {
              role: "rider",
              userId: this.riderId
            },
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1e3,
            timeout: 1e4
          });
          this.socket.on("connect", () => {
            formatAppLog("log", "at pages/map/nav.vue:162", "✅ Socket 已成功连接到:", SOCKET_URL);
            formatAppLog("log", "at pages/map/nav.vue:163", "Socket ID:", this.socket.id);
            formatAppLog("log", "at pages/map/nav.vue:164", "当前角色: rider, userId:", this.riderId);
          });
          this.socket.on("connect_error", (err) => {
            formatAppLog("error", "at pages/map/nav.vue:168", "❌ Socket 连接失败:", err.message);
            formatAppLog("error", "at pages/map/nav.vue:169", "错误详情:", err);
          });
          this.socket.on("disconnect", (reason) => {
            formatAppLog("warn", "at pages/map/nav.vue:173", "⚠️ Socket 已断开，原因:", reason);
          });
          this.socket.on("reconnect", (attemptNumber) => {
            formatAppLog("log", "at pages/map/nav.vue:177", "🔄 Socket 重连成功，尝试次数:", attemptNumber);
          });
          this.socket.on("reconnect_error", (err) => {
            formatAppLog("error", "at pages/map/nav.vue:181", "❌ Socket 重连失败:", err.message);
          });
          formatAppLog("log", "at pages/map/nav.vue:184", "Socket.io 实例已创建:", this.socket ? "成功" : "失败");
        } catch (e) {
          formatAppLog("error", "at pages/map/nav.vue:186", "❌ Socket 初始化异常:", e);
          this.socket = null;
        }
      },
      destroySocket() {
        if (this.socket) {
          try {
            this.socket.disconnect();
          } catch (e) {
          }
        }
        this.socket = null;
      },
      stopLocationTracking() {
        if (this.watchId !== null && typeof navigator !== "undefined" && navigator.geolocation) {
          try {
            navigator.geolocation.clearWatch(this.watchId);
          } catch (e) {
          }
        }
        this.watchId = null;
        if (this.trackingTimer) {
          clearInterval(this.trackingTimer);
        }
        this.trackingTimer = null;
      },
      startLocationTracking() {
        this.stopLocationTracking();
        if (typeof navigator !== "undefined" && navigator.geolocation && typeof navigator.geolocation.watchPosition === "function") {
          try {
            this.watchId = navigator.geolocation.watchPosition(
              (p) => {
                const pos = {
                  lng: p.coords.longitude,
                  lat: p.coords.latitude,
                  speed: p.coords.speed || 0,
                  heading: p.coords.heading || 0,
                  source: "real"
                };
                this.emitLocation(pos);
              },
              () => {
                this.startPollingLocation();
              },
              { enableHighAccuracy: true, maximumAge: 1e3, timeout: 5e3 }
            );
            return;
          } catch (e) {
          }
        }
        this.startPollingLocation();
      },
      startPollingLocation() {
        if (this.trackingTimer) {
          clearInterval(this.trackingTimer);
        }
        this.trackingTimer = setInterval(async () => {
          if (this.isDestroyed) {
            this.stopLocationTracking();
            return;
          }
          const pos = await this.getLocationWithFallback();
          if (this.isDestroyed)
            return;
          this.emitLocation(pos);
        }, 1e3);
      },
      async getLocationWithFallback() {
        const uniPos = await new Promise((resolve) => {
          try {
            uni.getLocation({
              type: "wgs84",
              isHighAccuracy: true,
              highAccuracyExpireTime: 3e3,
              success: (res) => {
                formatAppLog("log", "at pages/map/nav.vue:257", "✅ uni.getLocation 成功:", res.longitude, res.latitude);
                resolve({
                  lng: res.longitude,
                  lat: res.latitude,
                  speed: res.speed || 0,
                  heading: res.direction || 0,
                  source: "real"
                });
              },
              fail: (err) => {
                formatAppLog("warn", "at pages/map/nav.vue:267", "⚠️ uni.getLocation 失败:", err);
                resolve(null);
              }
            });
          } catch (e) {
            formatAppLog("warn", "at pages/map/nav.vue:272", "⚠️ uni.getLocation 异常:", e);
            resolve(null);
          }
        });
        if (uniPos && uniPos.lng && uniPos.lat) {
          return uniPos;
        }
        const navPos = await new Promise((resolve) => {
          try {
            if (typeof navigator === "undefined" || !navigator.geolocation) {
              resolve(null);
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (p) => {
                formatAppLog("log", "at pages/map/nav.vue:288", "✅ navigator.geolocation 成功:", p.coords.longitude, p.coords.latitude);
                resolve({
                  lng: p.coords.longitude,
                  lat: p.coords.latitude,
                  speed: p.coords.speed || 0,
                  heading: p.coords.heading || 0,
                  source: "real"
                });
              },
              (err) => {
                formatAppLog("warn", "at pages/map/nav.vue:298", "⚠️ navigator.geolocation 失败:", err);
                resolve(null);
              },
              { enableHighAccuracy: true, timeout: 3e3, maximumAge: 1e3 }
            );
          } catch (e) {
            formatAppLog("warn", "at pages/map/nav.vue:304", "⚠️ navigator.geolocation 异常:", e);
            resolve(null);
          }
        });
        if (navPos && navPos.lng && navPos.lat) {
          return navPos;
        }
        formatAppLog("warn", "at pages/map/nav.vue:312", "🔄 所有定位方式失败，使用固始县兜底坐标:", this.fallbackPos);
        uni.showToast({ title: "使用模拟测试坐标", icon: "none" });
        return {
          lng: this.fallbackPos.lng,
          lat: this.fallbackPos.lat,
          speed: 30,
          heading: 90,
          source: "fallback"
        };
      },
      shouldSend(lng, lat) {
        const now = Date.now();
        const last = this.lastSent || {};
        if (!last.ts) {
          return true;
        }
        if (now - last.ts < 800) {
          return false;
        }
        if (last.lng === null || last.lat === null) {
          return true;
        }
        const dlng = Math.abs(Number(lng) - Number(last.lng));
        const dlat = Math.abs(Number(lat) - Number(last.lat));
        return dlng + dlat > 5e-6;
      },
      emitLocation(pos) {
        if (this.isDestroyed)
          return;
        if (!pos) {
          return;
        }
        const lng = Number(pos.lng);
        const lat = Number(pos.lat);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
          return;
        }
        if (!this.shouldSend(lng, lat)) {
          return;
        }
        this.lastSent = { lng, lat, ts: Date.now() };
        this.doEmitLocation(lng, lat, pos);
      },
      emitLocationForce(pos) {
        if (this.isDestroyed)
          return;
        if (!pos) {
          return;
        }
        const lng = Number(pos.lng);
        const lat = Number(pos.lat);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
          return;
        }
        this.lastSent = { lng, lat, ts: Date.now() };
        this.doEmitLocation(lng, lat, pos);
      },
      doEmitLocation(lng, lat, pos) {
        if (!this.socket) {
          formatAppLog("warn", "at pages/map/nav.vue:370", "Socket 未初始化，无法上报坐标");
          return;
        }
        if (!this.socket.connected) {
          formatAppLog("warn", "at pages/map/nav.vue:374", "Socket 未连接，尝试重连...");
          this.socket.connect();
        }
        try {
          const payload = {
            type: "location_update",
            vehicleId: this.riderId,
            position: [lng, lat],
            speed: pos.speed || 30,
            direction: pos.heading || 90,
            status: this.stage === "delivery" ? "delivering" : "picking",
            timestamp: Date.now()
          };
          this.socket.emit("location_update", payload);
          formatAppLog("log", "at pages/map/nav.vue:388", "✅ 坐标已上报:", lng.toFixed(6), lat.toFixed(6), "vehicleId:", this.riderId);
        } catch (e) {
          formatAppLog("error", "at pages/map/nav.vue:390", "坐标上报失败:", e);
        }
      },
      handlePickup() {
        if (this.stage === "pickup")
          return;
        this.stage = "pickup";
        this.simRunning = false;
        this.refreshRoute();
      },
      handleDelivery() {
        if (this.stage === "delivery")
          return;
        this.stage = "delivery";
        this.simRunning = false;
        this.refreshRoute();
      },
      getDestByStage() {
        if (this.stage === "delivery") {
          return { lng: this.customerLng, lat: this.customerLat };
        }
        return { lng: this.merchantLng, lat: this.merchantLat };
      },
      async refreshRoute() {
        const dest = this.getDestByStage();
        const destLng = dest.lng === "" || dest.lng === void 0 || dest.lng === null ? "" : String(dest.lng);
        const destLat = dest.lat === "" || dest.lat === void 0 || dest.lat === null ? "" : String(dest.lat);
        if (!destLng || !destLat) {
          uni.showToast({ title: "目的地坐标缺失", icon: "none" });
          return;
        }
        const pos = await this.getLocationWithFallback();
        const timestamp = Date.now();
        const htmlPath = this.isH5 ? "/static/driver_map.html" : "/hybrid/html/driver_map.html";
        const url2 = `${htmlPath}?t=${timestamp}&stage=${encodeURIComponent(this.stage)}&tk=${encodeURIComponent(this.tk)}&startLng=${encodeURIComponent(String(pos.lng))}&startLat=${encodeURIComponent(String(pos.lat))}&destLng=${encodeURIComponent(destLng)}&destLat=${encodeURIComponent(destLat)}`;
        this.webViewSrc = url2;
        this.emitLocation(pos);
      },
      async toggleSimulate() {
        const frame = this.$refs.mapFrame;
        const win = frame && frame.contentWindow ? frame.contentWindow : null;
        if (!win) {
          return;
        }
        if (this.simRunning) {
          win.postMessage({ type: "stop_sim" }, "*");
          this.simRunning = false;
          this.startLocationTracking();
          return;
        }
        this.stopLocationTracking();
        win.postMessage({ type: "start_sim", intervalMs: 1500 }, "*");
        this.simRunning = true;
      }
    }
  };
  function _sfc_render$6(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      $options.isH5 && $data.webViewSrc ? (vue.openBlock(), vue.createElementBlock("iframe", {
        key: 0,
        ref: "mapFrame",
        src: $data.webViewSrc,
        class: "web-iframe"
      }, null, 8, ["src"])) : $data.webViewSrc ? (vue.openBlock(), vue.createElementBlock("web-view", {
        key: 1,
        class: "web-view",
        src: $data.webViewSrc
      }, null, 8, ["src"])) : (vue.openBlock(), vue.createElementBlock("view", {
        key: 2,
        class: "map-placeholder"
      }, [
        vue.createElementVNode("text", { class: "placeholder-text" }, "正在加载导航...")
      ])),
      vue.createElementVNode("view", { class: "action-bar" }, [
        vue.createElementVNode(
          "button",
          {
            class: vue.normalizeClass(["btn btn-primary", { active: $data.stage === "pickup" }]),
            onClick: _cache[0] || (_cache[0] = (...args) => $options.handlePickup && $options.handlePickup(...args))
          },
          "去取餐",
          2
          /* CLASS */
        ),
        vue.createElementVNode(
          "button",
          {
            class: vue.normalizeClass(["btn btn-primary", { active: $data.stage === "delivery" }]),
            onClick: _cache[1] || (_cache[1] = (...args) => $options.handleDelivery && $options.handleDelivery(...args))
          },
          "去送餐",
          2
          /* CLASS */
        ),
        $options.isH5 ? (vue.openBlock(), vue.createElementBlock(
          "button",
          {
            key: 0,
            class: "btn btn-sim",
            onClick: _cache[2] || (_cache[2] = (...args) => $options.toggleSimulate && $options.toggleSimulate(...args))
          },
          vue.toDisplayString($data.simRunning ? "停止模拟" : "模拟送货"),
          1
          /* TEXT */
        )) : vue.createCommentVNode("v-if", true)
      ])
    ]);
  }
  const PagesMapNav = /* @__PURE__ */ _export_sfc(_sfc_main$7, [["render", _sfc_render$6], ["__scopeId", "data-v-0827d2c9"], ["__file", "E:/固始县外卖骑手端/pages/map/nav.vue"]]);
  const _sfc_main$6 = {
    data() {
      return {};
    }
  };
  function _sfc_render$5(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "empty-state" }, [
        vue.createElementVNode("text", { class: "empty-icon" }, "🏃"),
        vue.createElementVNode("text", { class: "empty-text" }, "跑腿订单"),
        vue.createElementVNode("text", { class: "empty-tip" }, "功能开发中，敬请期待...")
      ])
    ]);
  }
  const PagesErrandsIndex = /* @__PURE__ */ _export_sfc(_sfc_main$6, [["render", _sfc_render$5], ["__scopeId", "data-v-04967d3f"], ["__file", "E:/固始县外卖骑手端/pages/errands/index.vue"]]);
  const _sfc_main$5 = {
    data() {
      return {};
    }
  };
  function _sfc_render$4(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "empty-state" }, [
        vue.createElementVNode("text", { class: "empty-icon" }, "📝"),
        vue.createElementVNode("text", { class: "empty-text" }, "跑腿订单详情"),
        vue.createElementVNode("text", { class: "empty-tip" }, "功能开发中，敬请期待...")
      ])
    ]);
  }
  const PagesErrandsDetail = /* @__PURE__ */ _export_sfc(_sfc_main$5, [["render", _sfc_render$4], ["__scopeId", "data-v-bf14a200"], ["__file", "E:/固始县外卖骑手端/pages/errands/detail.vue"]]);
  const _sfc_main$4 = {
    data() {
      return {};
    }
  };
  function _sfc_render$3(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "empty-state" }, [
        vue.createElementVNode("text", { class: "empty-icon" }, "💰"),
        vue.createElementVNode("text", { class: "empty-text" }, "收入明细"),
        vue.createElementVNode("text", { class: "empty-tip" }, "功能开发中，敬请期待...")
      ])
    ]);
  }
  const PagesEarningsIndex = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["render", _sfc_render$3], ["__scopeId", "data-v-0c33edd9"], ["__file", "E:/固始县外卖骑手端/pages/earnings/index.vue"]]);
  const _sfc_main$3 = {
    data() {
      return {
        userInfo: {},
        balance: "0.00",
        showStationPanel: false,
        stationTown: ""
      };
    },
    onLoad() {
      this.loadUserInfo();
    },
    methods: {
      async loadUserInfo() {
        const stored = getUserInfo$1();
        if (stored) {
          this.userInfo = stored;
        }
        try {
          const res = await getUserInfo();
          if (res.data) {
            this.userInfo = res.data;
            this.balance = res.data.rider_balance || "0.00";
            this.stationTown = res.data.rider_town || "";
          }
        } catch (e) {
          formatAppLog("error", "at pages/profile/index.vue:89", "加载用户信息失败", e);
        }
      },
      async bindTown() {
        const town = String(this.stationTown || "").trim();
        if (!town) {
          uni.showToast({ title: "请填写乡镇名称", icon: "none" });
          return;
        }
        try {
          await bindStationTown(town);
          uni.showToast({ title: "绑定成功", icon: "success" });
          this.loadUserInfo();
        } catch (e) {
          formatAppLog("error", "at pages/profile/index.vue:104", "绑定失败", e);
        }
      },
      showTip(name) {
        uni.showToast({ title: name + "功能开发中", icon: "none" });
      },
      handleLogout() {
        uni.showModal({
          title: "确认退出",
          content: "确定要退出登录吗？",
          success: (res) => {
            if (res.confirm) {
              removeToken();
              removeUserInfo();
              uni.reLaunch({ url: "/pages/login/index" });
            }
          }
        });
      }
    }
  };
  function _sfc_render$2(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "user-card" }, [
        vue.createElementVNode("view", { class: "avatar-wrap" }, [
          vue.createElementVNode("text", { class: "avatar-text" }, "🛵")
        ]),
        vue.createElementVNode("view", { class: "user-info" }, [
          vue.createElementVNode(
            "text",
            { class: "nickname" },
            vue.toDisplayString($data.userInfo.nickname || "骑手"),
            1
            /* TEXT */
          ),
          vue.createElementVNode(
            "text",
            { class: "phone" },
            vue.toDisplayString($data.userInfo.phone || "未绑定"),
            1
            /* TEXT */
          )
        ])
      ]),
      vue.createElementVNode("view", { class: "menu-list" }, [
        vue.createElementVNode("view", {
          class: "menu-item",
          onClick: _cache[0] || (_cache[0] = ($event) => $options.showTip("余额提现"))
        }, [
          vue.createElementVNode("text", { class: "menu-icon" }, "💰"),
          vue.createElementVNode("text", { class: "menu-text" }, "余额提现"),
          vue.createElementVNode(
            "text",
            { class: "menu-value" },
            "¥" + vue.toDisplayString($data.balance),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "menu-arrow" }, "›")
        ]),
        vue.createElementVNode("view", {
          class: "menu-item",
          onClick: _cache[1] || (_cache[1] = ($event) => $data.showStationPanel = !$data.showStationPanel)
        }, [
          vue.createElementVNode("text", { class: "menu-icon" }, "📍"),
          vue.createElementVNode("text", { class: "menu-text" }, "站长乡镇"),
          vue.createElementVNode(
            "text",
            { class: "menu-value" },
            vue.toDisplayString($data.userInfo.rider_town || "未绑定"),
            1
            /* TEXT */
          ),
          vue.createElementVNode("text", { class: "menu-arrow" }, "›")
        ]),
        vue.createElementVNode("view", {
          class: "menu-item",
          onClick: _cache[2] || (_cache[2] = ($event) => $options.showTip("修改密码"))
        }, [
          vue.createElementVNode("text", { class: "menu-icon" }, "🔒"),
          vue.createElementVNode("text", { class: "menu-text" }, "修改密码"),
          vue.createElementVNode("text", { class: "menu-arrow" }, "›")
        ]),
        vue.createElementVNode("view", {
          class: "menu-item",
          onClick: _cache[3] || (_cache[3] = ($event) => $options.showTip("联系客服"))
        }, [
          vue.createElementVNode("text", { class: "menu-icon" }, "📞"),
          vue.createElementVNode("text", { class: "menu-text" }, "联系客服"),
          vue.createElementVNode("text", { class: "menu-arrow" }, "›")
        ]),
        vue.createElementVNode("view", {
          class: "menu-item",
          onClick: _cache[4] || (_cache[4] = ($event) => $options.showTip("关于我们"))
        }, [
          vue.createElementVNode("text", { class: "menu-icon" }, "ℹ️"),
          vue.createElementVNode("text", { class: "menu-text" }, "关于我们"),
          vue.createElementVNode("text", { class: "menu-arrow" }, "›")
        ])
      ]),
      $data.showStationPanel ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "station-panel"
      }, [
        vue.createElementVNode("view", { class: "station-row" }, [
          vue.createElementVNode("text", { class: "station-label" }, "乡镇名称"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "station-input",
              "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => $data.stationTown = $event),
              placeholder: "例如：陈淋子镇"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.stationTown]
          ])
        ]),
        vue.createElementVNode("button", {
          class: "station-btn",
          onClick: _cache[6] || (_cache[6] = (...args) => $options.bindTown && $options.bindTown(...args))
        }, "绑定为站长"),
        vue.createElementVNode("text", { class: "station-tip" }, "每个乡镇只允许一个站长账号绑定")
      ])) : vue.createCommentVNode("v-if", true),
      vue.createElementVNode("view", {
        class: "logout-btn",
        onClick: _cache[7] || (_cache[7] = (...args) => $options.handleLogout && $options.handleLogout(...args))
      }, [
        vue.createElementVNode("text", { class: "logout-text" }, "退出登录")
      ])
    ]);
  }
  const PagesProfileIndex = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["render", _sfc_render$2], ["__scopeId", "data-v-201c0da5"], ["__file", "E:/固始县外卖骑手端/pages/profile/index.vue"]]);
  const _sfc_main$2 = {
    data() {
      return {};
    }
  };
  function _sfc_render$1(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("view", { class: "content" }, [
        vue.createElementVNode("text", { class: "title" }, "骑手端测试页面"),
        vue.createElementVNode("text", { class: "subtitle" }, "项目运行正常！✅")
      ])
    ]);
  }
  const PagesTestIndex = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["render", _sfc_render$1], ["__scopeId", "data-v-b11b71c1"], ["__file", "E:/固始县外卖骑手端/pages/test/index.vue"]]);
  const _sfc_main$1 = {
    data() {
      return {
        loading: false,
        order: null,
        stage: "pickup",
        webViewSrc: "",
        tk: "",
        tkInput: "",
        simRunning: false,
        socket: null,
        watchId: null,
        trackingTimer: null,
        lastSent: { lng: null, lat: null, ts: 0 },
        mockPos: { lng: 115.68233, lat: 32.18021 }
      };
    },
    computed: {
      isH5() {
        try {
          return typeof window !== "undefined" && typeof document !== "undefined";
        } catch (e) {
          return false;
        }
      },
      orderReady() {
        return !!(this.order && this.order.merchant_lng && this.order.merchant_lat && this.order.customer_lng && this.order.customer_lat);
      }
    },
    onLoad() {
      this.tk = uni.getStorageSync("tianditu_tk") || TIANDITU_TK || "";
      this.tkInput = this.tk;
      this.initSocket();
      this.startLocationTracking();
      if (this.isH5) {
        window.addEventListener("message", this.onMapMessage);
      }
    },
    onUnload() {
      this.stopLocationTracking();
      this.destroySocket();
      if (this.isH5) {
        window.removeEventListener("message", this.onMapMessage);
      }
    },
    methods: {
      onMapMessage(e) {
        const d = e && e.data ? e.data : null;
        if (!d || d.type !== "sim_location") {
          return;
        }
        const pos = {
          lng: d.lng,
          lat: d.lat,
          speed: d.speed || 8,
          heading: d.heading || 90,
          source: "sim"
        };
        this.emitLocation(pos);
      },
      saveTk() {
        const v = String(this.tkInput || "").trim();
        if (!v) {
          uni.showToast({ title: "请输入天地图TK", icon: "none" });
          return;
        }
        this.tk = v;
        uni.setStorageSync("tianditu_tk", v);
        uni.showToast({ title: "TK 已保存", icon: "success" });
      },
      async createTestOrder() {
        if (this.loading) {
          return;
        }
        this.loading = true;
        this.order = null;
        try {
          const res = await new Promise((resolve, reject) => {
            uni.request({
              url: "http://121.43.190.218:3000/api/orders/test-create",
              method: "POST",
              data: {},
              timeout: 1e4,
              success: resolve,
              fail: reject
            });
          });
          const body = res && res.data ? res.data : {};
          const data = body.data || body.order || body;
          this.order = data || null;
          if (!this.orderReady) {
            uni.showToast({ title: "订单坐标字段缺失", icon: "none" });
          } else {
            uni.showToast({ title: "订单已生成", icon: "success" });
            this.stage = "pickup";
            await this.drawRouteByStage();
          }
        } catch (e) {
          uni.showToast({ title: "生成失败，请检查后端", icon: "none" });
        } finally {
          this.loading = false;
        }
      },
      async goPickup() {
        if (!this.orderReady) {
          return;
        }
        this.stage = "pickup";
        await this.drawRouteByStage();
      },
      async goDelivery() {
        if (!this.orderReady) {
          return;
        }
        this.stage = "delivery";
        await this.drawRouteByStage();
      },
      async toggleSimulate() {
        if (!this.orderReady) {
          return;
        }
        if (!this.webViewSrc) {
          this.stage = "delivery";
          await this.drawRouteByStage();
          await new Promise((r) => setTimeout(r, 400));
        } else if (this.stage !== "delivery") {
          this.stage = "delivery";
          await this.drawRouteByStage();
          await new Promise((r) => setTimeout(r, 400));
        }
        const frame = this.$refs.mapFrame;
        const win = frame && frame.contentWindow ? frame.contentWindow : null;
        if (!win) {
          return;
        }
        if (this.simRunning) {
          win.postMessage({ type: "stop_sim" }, "*");
          this.simRunning = false;
          return;
        }
        win.postMessage({ type: "start_sim", intervalMs: 1500 }, "*");
        this.simRunning = true;
      },
      initSocket() {
        const SOCKET_URL = "http://121.43.190.218:3000";
        try {
          this.socket = lookup(SOCKET_URL, {
            transports: ["websocket", "polling"],
            autoConnect: true
          });
          this.socket.on("connect", () => {
            formatAppLog("log", "at pages/test-nav/test-nav.vue:192", "Socket 已连接到:", SOCKET_URL);
          });
          this.socket.on("connect_error", (err) => {
            formatAppLog("error", "at pages/test-nav/test-nav.vue:195", "Socket 连接失败:", err.message);
          });
        } catch (e) {
          formatAppLog("error", "at pages/test-nav/test-nav.vue:198", "Socket 初始化失败:", e);
          this.socket = null;
        }
      },
      destroySocket() {
        if (this.socket) {
          try {
            this.socket.disconnect();
          } catch (e) {
          }
        }
        this.socket = null;
      },
      stopLocationTracking() {
        if (this.watchId !== null && typeof navigator !== "undefined" && navigator.geolocation) {
          try {
            navigator.geolocation.clearWatch(this.watchId);
          } catch (e) {
          }
        }
        this.watchId = null;
        if (this.trackingTimer) {
          clearInterval(this.trackingTimer);
        }
        this.trackingTimer = null;
      },
      startLocationTracking() {
        this.stopLocationTracking();
        if (typeof navigator !== "undefined" && navigator.geolocation && typeof navigator.geolocation.watchPosition === "function") {
          try {
            this.watchId = navigator.geolocation.watchPosition(
              (p) => {
                const pos = {
                  lng: p.coords.longitude,
                  lat: p.coords.latitude,
                  speed: p.coords.speed || 0,
                  heading: p.coords.heading || 0,
                  source: "real"
                };
                this.emitLocation(pos);
              },
              () => {
                this.startPollingLocation();
              },
              { enableHighAccuracy: true, maximumAge: 1e3, timeout: 5e3 }
            );
            return;
          } catch (e) {
          }
        }
        this.startPollingLocation();
      },
      startPollingLocation() {
        if (this.trackingTimer) {
          clearInterval(this.trackingTimer);
        }
        this.trackingTimer = setInterval(async () => {
          const pos = await this.getLocationWithFallback();
          this.emitLocation(pos);
        }, 1e3);
      },
      async getLocationWithFallback() {
        const uniPos = await new Promise((resolve) => {
          try {
            uni.getLocation({
              type: "wgs84",
              isHighAccuracy: true,
              highAccuracyExpireTime: 3e3,
              success: (res) => {
                resolve({
                  lng: res.longitude,
                  lat: res.latitude,
                  speed: res.speed || 0,
                  heading: res.direction || 0,
                  source: "real"
                });
              },
              fail: () => resolve(null)
            });
          } catch (e) {
            resolve(null);
          }
        });
        if (uniPos && uniPos.lng && uniPos.lat) {
          return uniPos;
        }
        const navPos = await new Promise((resolve) => {
          try {
            if (typeof navigator === "undefined" || !navigator.geolocation) {
              resolve(null);
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (p) => {
                resolve({
                  lng: p.coords.longitude,
                  lat: p.coords.latitude,
                  speed: p.coords.speed || 0,
                  heading: p.coords.heading || 0,
                  source: "real"
                });
              },
              () => resolve(null),
              { enableHighAccuracy: true, timeout: 3e3, maximumAge: 1e3 }
            );
          } catch (e) {
            resolve(null);
          }
        });
        if (navPos && navPos.lng && navPos.lat) {
          return navPos;
        }
        this.mockPos = {
          lng: Number(this.mockPos.lng) + 2e-5,
          lat: Number(this.mockPos.lat) + 1e-5
        };
        return { lng: this.mockPos.lng, lat: this.mockPos.lat, speed: 8, heading: 90, source: "mock" };
      },
      shouldSend(lng, lat) {
        const now = Date.now();
        const last = this.lastSent || {};
        if (!last.ts) {
          return true;
        }
        if (now - last.ts < 800) {
          return false;
        }
        if (last.lng === null || last.lat === null) {
          return true;
        }
        const dlng = Math.abs(Number(lng) - Number(last.lng));
        const dlat = Math.abs(Number(lat) - Number(last.lat));
        return dlng + dlat > 5e-6;
      },
      emitLocation(pos) {
        if (!pos) {
          return;
        }
        const lng = Number(pos.lng);
        const lat = Number(pos.lat);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
          return;
        }
        if (!this.shouldSend(lng, lat)) {
          return;
        }
        this.lastSent = { lng, lat, ts: Date.now() };
        if (!this.socket) {
          formatAppLog("warn", "at pages/test-nav/test-nav.vue:345", "Socket 未初始化，无法上报坐标");
          return;
        }
        if (!this.socket.connected) {
          formatAppLog("warn", "at pages/test-nav/test-nav.vue:349", "Socket 未连接，尝试重连...");
          this.socket.connect();
        }
        try {
          const payload = {
            type: "location_update",
            vehicleId: "test-rider",
            position: [lng, lat],
            speed: pos.speed || 30,
            direction: pos.heading || 90,
            status: this.stage === "delivery" ? "delivering" : "picking",
            timestamp: Date.now()
          };
          this.socket.emit("location_update", payload);
          formatAppLog("log", "at pages/test-nav/test-nav.vue:363", "坐标已上报:", lng, lat, "vehicleId: test-rider");
        } catch (e) {
          formatAppLog("error", "at pages/test-nav/test-nav.vue:365", "坐标上报失败:", e);
        }
      },
      getDestByStage() {
        if (this.stage === "delivery") {
          return { lng: this.order.customer_lng, lat: this.order.customer_lat };
        }
        return { lng: this.order.merchant_lng, lat: this.order.merchant_lat };
      },
      async drawRouteByStage() {
        const tk = this.tk || "";
        if (!tk) {
          uni.showToast({ title: "请先填写天地图TK", icon: "none" });
          return;
        }
        const dest = this.getDestByStage();
        const destLng = dest && dest.lng !== void 0 && dest.lng !== null && dest.lng !== "" ? String(dest.lng) : "";
        const destLat = dest && dest.lat !== void 0 && dest.lat !== null && dest.lat !== "" ? String(dest.lat) : "";
        if (!destLng || !destLat) {
          uni.showToast({ title: "目的地坐标缺失", icon: "none" });
          return;
        }
        const pos = await this.getLocationWithFallback();
        const htmlPath = this.isH5 ? "/static/driver_map.html" : "/hybrid/html/driver_map.html";
        const timestamp = Date.now();
        this.webViewSrc = `${htmlPath}?t=${timestamp}&stage=${encodeURIComponent(this.stage)}&tk=${encodeURIComponent(tk)}&startLng=${encodeURIComponent(String(pos.lng))}&startLat=${encodeURIComponent(String(pos.lat))}&destLng=${encodeURIComponent(destLng)}&destLat=${encodeURIComponent(destLat)}`;
        this.emitLocation(pos);
      }
    }
  };
  function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      vue.createElementVNode("view", { class: "actions" }, [
        !$data.tk ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "tk-row"
        }, [
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $data.tkInput = $event),
              class: "tk-input",
              placeholder: "粘贴天地图 TK"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [vue.vModelText, $data.tkInput]
          ]),
          vue.createElementVNode("button", {
            class: "btn btn-save",
            onClick: _cache[1] || (_cache[1] = (...args) => $options.saveTk && $options.saveTk(...args))
          }, "保存")
        ])) : vue.createCommentVNode("v-if", true),
        vue.createElementVNode("button", {
          class: "btn btn-main",
          disabled: $data.loading,
          onClick: _cache[2] || (_cache[2] = (...args) => $options.createTestOrder && $options.createTestOrder(...args))
        }, vue.toDisplayString($data.loading ? "生成中..." : "生成测试订单并获取数据"), 9, ["disabled"]),
        $options.orderReady ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "row"
        }, [
          vue.createElementVNode(
            "button",
            {
              class: vue.normalizeClass(["btn btn-sub", { active: $data.stage === "pickup" }]),
              onClick: _cache[3] || (_cache[3] = (...args) => $options.goPickup && $options.goPickup(...args))
            },
            "去取餐",
            2
            /* CLASS */
          ),
          vue.createElementVNode(
            "button",
            {
              class: vue.normalizeClass(["btn btn-sub", { active: $data.stage === "delivery" }]),
              onClick: _cache[4] || (_cache[4] = (...args) => $options.goDelivery && $options.goDelivery(...args))
            },
            "去送餐",
            2
            /* CLASS */
          )
        ])) : vue.createCommentVNode("v-if", true),
        $options.orderReady && $options.isH5 ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 2,
          class: "row"
        }, [
          vue.createElementVNode(
            "button",
            {
              class: "btn btn-sub btn-sim",
              onClick: _cache[5] || (_cache[5] = (...args) => $options.toggleSimulate && $options.toggleSimulate(...args))
            },
            vue.toDisplayString($data.simRunning ? "停止模拟" : "模拟骑手送货"),
            1
            /* TEXT */
          )
        ])) : vue.createCommentVNode("v-if", true)
      ]),
      vue.createElementVNode("view", { class: "map-wrap" }, [
        $options.isH5 && $data.webViewSrc ? (vue.openBlock(), vue.createElementBlock("iframe", {
          key: 0,
          ref: "mapFrame",
          src: $data.webViewSrc,
          class: "web-iframe"
        }, null, 8, ["src"])) : $data.webViewSrc ? (vue.openBlock(), vue.createElementBlock("web-view", {
          key: 1,
          class: "web-view",
          src: $data.webViewSrc
        }, null, 8, ["src"])) : (vue.openBlock(), vue.createElementBlock("view", {
          key: 2,
          class: "map-placeholder"
        }, [
          vue.createElementVNode("text", { class: "placeholder-text" }, "等待生成订单后开始导航")
        ]))
      ])
    ]);
  }
  const PagesTestNavTestNav = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["render", _sfc_render], ["__scopeId", "data-v-9d29506f"], ["__file", "E:/固始县外卖骑手端/pages/test-nav/test-nav.vue"]]);
  __definePage("pages/login/index", PagesLoginIndex);
  __definePage("pages/index/index", PagesIndexIndex);
  __definePage("pages/orders/index", PagesOrdersIndex);
  __definePage("pages/orders/detail", PagesOrdersDetail);
  __definePage("pages/map/nav", PagesMapNav);
  __definePage("pages/errands/index", PagesErrandsIndex);
  __definePage("pages/errands/detail", PagesErrandsDetail);
  __definePage("pages/earnings/index", PagesEarningsIndex);
  __definePage("pages/profile/index", PagesProfileIndex);
  __definePage("pages/test/index", PagesTestIndex);
  __definePage("pages/test-nav/test-nav", PagesTestNavTestNav);
  let locationTimer = null;
  const _sfc_main = {
    onLaunch: function() {
      formatAppLog("log", "at App.vue:8", "App Launch - 骑手端启动");
    },
    onShow: function() {
      formatAppLog("log", "at App.vue:11", "App Show - 骑手端显示");
      this.startLocationReport();
    },
    onHide: function() {
      formatAppLog("log", "at App.vue:15", "App Hide - 骑手端隐藏");
      this.stopLocationReport();
    },
    methods: {
      startLocationReport() {
        this.stopLocationReport();
        const token = uni.getStorageSync("token");
        if (!token) {
          formatAppLog("log", "at App.vue:24", "未登录，不启动位置上报");
          return;
        }
        formatAppLog("log", "at App.vue:28", "启动位置上报定时器，间隔 10 秒");
        locationTimer = setInterval(() => {
          this.doReportLocation();
        }, 1e4);
        this.doReportLocation();
      },
      stopLocationReport() {
        if (locationTimer) {
          clearInterval(locationTimer);
          locationTimer = null;
          formatAppLog("log", "at App.vue:41", "位置上报定时器已停止");
        }
      },
      doReportLocation() {
        uni.getLocation({
          type: "gcj02",
          success: (res) => {
            formatAppLog("log", "at App.vue:49", "获取真实GPS成功:", res.latitude, res.longitude);
            reportLocation(res.latitude, res.longitude).catch((err) => formatAppLog("log", "at App.vue:51", "真实位置上报接口失败:", err));
          },
          fail: (err) => {
            formatAppLog("log", "at App.vue:54", "获取真实GPS失败，使用模拟测试坐标上报");
            reportLocation(32.1765, 115.6734).catch((e) => formatAppLog("log", "at App.vue:56", "模拟位置上报接口失败:", e));
          }
        });
      }
    }
  };
  const App = /* @__PURE__ */ _export_sfc(_sfc_main, [["__file", "E:/固始县外卖骑手端/App.vue"]]);
  function createApp() {
    const app = vue.createVueApp(App);
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
