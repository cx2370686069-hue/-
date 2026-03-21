/**
 * API 调用模块
 * 包含天地图 API 和 WebSocket 连接
 */

const TIANDITU_KEY = 'c7e10854160bfd1cee679eef056bb9ce';
const API_BASE_URL = window.location.origin;

// ==================== WebSocket 连接 ====================

class SocketService {
    constructor() {
        this.socket = null;
        this.listeners = {};
        this.connected = false;
    }

    connect() {
        if (this.socket) return;

        // 连接 WebSocket
        this.socket = io(API_BASE_URL);

        this.socket.on('connect', () => {
            console.log('✅ WebSocket 连接成功');
            this.connected = true;
            this.emit('connected', null);
        });

        this.socket.on('disconnect', () => {
            console.log('❌ WebSocket 断开连接');
            this.connected = false;
            this.emit('disconnected', null);
        });

        // 监听新订单
        this.socket.on('new_order', (data) => {
            console.log('📦 收到新订单:', data);
            this.emit('new_order', data);
        });

        // 监听订单更新
        this.socket.on('order_updated', (data) => {
            console.log('📝 订单更新:', data);
            this.emit('order_updated', data);
        });

        // 监听订单删除
        this.socket.on('order_deleted', (data) => {
            console.log('🗑️ 订单删除:', data);
            this.emit('order_deleted', data);
        });

        // 监听司机位置更新
        this.socket.on('driver_location_update', (data) => {
            this.emit('driver_location', data);
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
        }
    }

    joinDispatchRoom() {
        if (this.socket) {
            this.socket.emit('join_dispatch');
        }
    }

    joinDriverRoom(driverId) {
        if (this.socket) {
            this.socket.emit('join_driver', driverId);
        }
    }

    updateDriverLocation(driverId, lat, lon) {
        if (this.socket) {
            this.socket.emit('driver_location', { driverId, lat, lon });
        }
    }

    updateOrderStatus(orderId, status, driverId) {
        if (this.socket) {
            this.socket.emit('order_status_update', { orderId, status, driverId });
        }
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
}

// 创建全局 Socket 实例
const socketService = new SocketService();

// ==================== HTTP API 调用 ====================

async function fetchAPI(url, options = {}) {
    const response = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
}

// 订单相关 API
const OrderAPI = {
    // 获取所有订单
    getAll: (status) => fetchAPI(`/api/orders${status ? `?status=${status}` : ''}`),
    
    // 获取单个订单
    getById: (id) => fetchAPI(`/api/orders/${id}`),
    
    // 创建订单
    create: (orderData) => fetchAPI('/api/orders', {
        method: 'POST',
        body: JSON.stringify(orderData)
    }),
    
    // 更新订单状态
    updateStatus: (id, status, driverId) => fetchAPI(`/api/orders/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, driver_id: driverId })
    }),
    
    // 删除订单
    delete: (id) => fetchAPI(`/api/orders/${id}`, {
        method: 'DELETE'
    }),
    
    // 获取待配送订单
    getPending: () => fetchAPI('/api/orders/pending/list'),
    
    // 按类型获取订单
    getByType: (type) => fetchAPI(`/api/orders/type/${type}`)
};

// 司机相关 API
const DriverAPI = {
    // 获取所有司机
    getAll: () => fetchAPI('/api/drivers'),
    
    // 创建司机
    create: (driverData) => fetchAPI('/api/drivers', {
        method: 'POST',
        body: JSON.stringify(driverData)
    }),
    
    // 更新司机状态
    updateStatus: (id, status) => fetchAPI(`/api/drivers/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
    }),
    
    // 更新司机位置
    updateLocation: (id, lat, lon) => fetchAPI(`/api/drivers/${id}/location`, {
        method: 'PUT',
        body: JSON.stringify({ lat, lon })
    }),
    
    // 获取司机任务
    getTasks: (id) => fetchAPI(`/api/drivers/${id}/tasks`)
};

// 批次相关 API
const BatchAPI = {
    // 获取所有批次
    getAll: () => fetchAPI('/api/batches'),
    
    // 获取当前批次
    getCurrent: () => fetchAPI('/api/batches/current'),
    
    // 创建批次
    create: (batchData) => fetchAPI('/api/batches', {
        method: 'POST',
        body: JSON.stringify(batchData)
    }),
    
    // 更新批次状态
    updateStatus: (id, status) => fetchAPI(`/api/batches/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
    }),
    
    // 获取批次订单
    getOrders: (id) => fetchAPI(`/api/batches/${id}/orders`)
};

// 线路相关 API
const RouteAPI = {
    // 生成线路
    generate: (batchId) => fetchAPI('/api/routes/generate', {
        method: 'POST',
        body: JSON.stringify({ batchId })
    }),
    
    // 获取线路详情
    getById: (id) => fetchAPI(`/api/routes/${id}`),
    
    // 更新线路
    update: (id, routeData) => fetchAPI(`/api/routes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(routeData)
    }),
    
    // 分配线路给司机
    assignToDriver: (routeId, driverId) => fetchAPI(`/api/routes/${routeId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ driverId })
    })
};

// ==================== 天地图 API ====================

async function getDrivingRoute(startLon, startLat, endLon, endLat) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/tianditu/drive`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                orig: `${startLon},${startLat}`,
                dest: `${endLon},${endLat}`,
                style: '0'
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            console.error('天地图API错误:', data.message);
            return getFallbackDistance(startLat, startLon, endLat, endLon);
        }

        const result = data.data;
        const distance = result.distance || 0;
        const durationSeconds = result.duration || 0;
        const durationMinutes = Math.round(durationSeconds / 60);

        return {
            distance: distance,
            duration: durationMinutes,
            routePoints: [],
            success: true
        };
    } catch (error) {
        console.error('请求失败:', error);
        return getFallbackDistance(startLat, startLon, endLat, endLon);
    }
}

function getFallbackDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    const duration = Math.round(distance / 25 * 60 * 1.3);
    
    return {
        distance: Math.round(distance * 100) / 100,
        duration: duration,
        routePoints: [],
        success: false,
        fallback: true
    };
}

async function getBatchDrivingRoutes(routes) {
    const results = [];
    for (const route of routes) {
        try {
            const result = await getDrivingRoute(
                route.startLon,
                route.startLat,
                route.endLon,
                route.endLat
            );
            results.push({ ...result, id: route.id || null });
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            results.push({
                ...getFallbackDistance(route.startLat, route.startLon, route.endLat, route.endLon),
                id: route.id || null,
                error: true
            });
        }
    }
    return results;
}

async function updateOrderRealDistance(order) {
    const result = await getDrivingRoute(
        CONFIG.CENTER.lon,
        CONFIG.CENTER.lat,
        order.customerLon,
        order.customerLat
    );
    
    return {
        ...order,
        realDistance: result.distance,
        realDuration: result.duration,
        routePoints: result.routePoints,
        distanceSuccess: result.success
    };
}

async function calculateRiderTotalDistance(rider, orders) {
    if (orders.length === 0) return { distance: 0, duration: 0 };
    
    let totalDistance = 0;
    let totalDuration = 0;
    let currentLon = rider.lon;
    let currentLat = rider.lat;
    
    for (const order of orders) {
        const result = await getDrivingRoute(
            currentLon,
            currentLat,
            order.customerLon,
            order.customerLat
        );
        
        totalDistance += result.distance;
        totalDuration += result.duration;
        
        currentLon = order.customerLon;
        currentLat = order.customerLat;
    }
    
    const returnResult = await getDrivingRoute(
        currentLon,
        currentLat,
        CONFIG.CENTER.lon,
        CONFIG.CENTER.lat
    );
    
    totalDistance += returnResult.distance;
    totalDuration += returnResult.duration;
    
    return {
        distance: Math.round(totalDistance * 100) / 100,
        duration: totalDuration
    };
}

// ==================== 导出 ====================

window.API = {
    socket: socketService,
    orders: OrderAPI,
    drivers: DriverAPI,
    batches: BatchAPI,
    routes: RouteAPI
};

window.TiandituAPI = {
    getDrivingRoute,
    getBatchDrivingRoutes,
    updateOrderRealDistance,
    calculateRiderTotalDistance
};
