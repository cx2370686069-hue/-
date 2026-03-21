/**
 * 固始县外卖调度中心 - 主程序（简化版 - 人工分配模式）
 */

// ==================== 配置 ====================
const CONFIG = {
    CENTER: { lat: 32.168, lon: 115.654, name: '固始县政府' },
    TOWNS: [
        { name: '城关镇', lat: 32.168, lon: 115.654 },
        { name: '汪店镇', lat: 32.245, lon: 115.612 },
        { name: '段集镇', lat: 32.058, lon: 115.712 },
        { name: '汪集镇', lat: 32.142, lon: 115.523 },
        { name: '三河尖镇', lat: 32.189, lon: 115.789 },
        { name: '郭陆滩镇', lat: 32.095, lon: 115.678 },
        { name: '陈淋子镇', lat: 31.987, lon: 115.823 },
        { name: '黎集镇', lat: 32.023, lon: 115.745 },
        { name: '蒋集镇', lat: 32.201, lon: 115.567 },
        { name: '往流镇', lat: 32.287, lon: 115.498 },
        { name: '洪埠乡', lat: 32.198, lon: 115.701 },
        { name: '杨集乡', lat: 32.134, lon: 115.589 },
        { name: '胡族铺镇', lat: 32.076, lon: 115.534 },
        { name: '马堽集乡', lat: 32.045, lon: 115.612 },
        { name: '草庙集乡', lat: 31.956, lon: 115.687 }
    ],
    RESTAURANTS: ['肯德基', '麦当劳', '必胜客', '老乡鸡', '海底捞', '星巴克', '瑞幸咖啡', '蜜雪冰城', '正新鸡排', '华莱士'],
    ZOOM: 11
};

// ==================== 全局状态 ====================
let map = null;
let orders = [];
let drivers = [];
let orderMarkers = {};
let driverMarkers = {};
let todayCompleted = 0;
let selectedOrder = null; // 当前选中的订单（用于分配）

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', function() {
    // 初始化 WebSocket 连接
    initWebSocket();
    
    // 初始化地图
    initMap();
    
    // 加载司机
    loadDrivers();
    
    // 加载订单
    loadOrders();
    
    // 更新时间
    updateTime();
    setInterval(updateTime, 1000);
});

// ==================== WebSocket 连接 ====================
function initWebSocket() {
    window.API.socket.connect();
    
    setTimeout(() => {
        window.API.socket.joinDispatchRoom();
        console.log('✅ 已加入调度室');
    }, 500);
    
    // 监听新订单
    window.API.socket.on('new_order', (order) => {
        console.log('📦 收到新订单:', order);
        orders.unshift(order);
        addOrderToMap(order);
        updateOrderPool();
        updateStats();
        showNotification(`新订单：${order.restaurant} → ${order.customer_town}`);
    });
    
    // 监听订单更新
    window.API.socket.on('order_updated', (data) => {
        console.log('📝 订单更新:', data);
        updateOrderInList(data.orderId, data.order);
    });
    
    // 监听司机位置更新
    window.API.socket.on('driver_location_update', (data) => {
        console.log('🚗 司机位置更新:', data);
        updateDriverPosition(data);
    });
}

// ==================== 地图功能 ====================
function initMap() {
    if (typeof T === 'undefined') {
        console.error('❌ 天地图 API 加载失败！');
        return;
    }
    
    try {
        map = new T.Map('map');
        map.centerAndZoom(new T.LngLat(CONFIG.CENTER.lon, CONFIG.CENTER.lat), CONFIG.ZOOM);
        map.enableScrollWheelZoom();
        map.enableDoubleClickZoom();
        map.enableKeyboard();
        
        // 添加配送中心标记
        const centerMarker = new T.Marker(new T.LngLat(CONFIG.CENTER.lon, CONFIG.CENTER.lat));
        map.addOverLay(centerMarker);
        
        centerMarker.addEventListener('click', function() {
            const infoWin = new T.InfoWindow('<b>配送中心</b><br>固始县政府');
            centerMarker.openInfoWindow(infoWin);
        });
        
        console.log('✅ 地图初始化成功');
    } catch (error) {
        console.error('地图初始化失败:', error);
    }
}

function addOrderToMap(order) {
    if (orderMarkers[order.id]) {
        map.removeOverLay(orderMarkers[order.id]);
    }
    
    // 使用天地图标准 Marker（蓝色图钉）
    const marker = new T.Marker(new T.LngLat(order.customer_lon, order.customer_lat));
    map.addOverLay(marker);
    
    marker.addEventListener('click', function() {
        // 地图定位到订单
        map.panTo(new T.LngLat(order.customer_lon, order.customer_lat));
        map.setZoom(14);
        
        // 只有待分配的订单才高亮左侧列表
        if (order.status === 'pending') {
            highlightOrderInList(order.id);
        }
        
        // 显示信息窗口
        const infoContent = `
            <div style="padding: 5px;">
                <b>订单 ${order.id}</b><br>
                商家：${order.restaurant}<br>
                目的地：${order.customer_town}<br>
                状态：${getStatusText(order.status)}<br>
                ${order.status === 'pending' ? `
                <div style="margin-top: 8px;">
                    <button onclick="window.showAssignFromMap('${order.id}')" 
                            style="background: #1890ff; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                        📦 派单
                    </button>
                </div>
                ` : '<div style="margin-top: 8px; color: #999; font-size: 12px;">已分配，无需操作</div>'}
            </div>
        `;
        const infoWin = new T.InfoWindow(infoContent);
        marker.openInfoWindow(infoWin);
    });
    
    orderMarkers[order.id] = marker;
}

function clearOrderMarkers() {
    Object.values(orderMarkers).forEach(marker => map.removeOverLay(marker));
    orderMarkers = {};
}

function showAllOrders() {
    clearOrderMarkers();
    orders.forEach(order => addOrderToMap(order));
}

function resetMapView() {
    map.centerAndZoom(new T.LngLat(CONFIG.CENTER.lon, CONFIG.CENTER.lat), CONFIG.ZOOM);
}

// ==================== 订单管理 ====================
async function loadOrders() {
    try {
        const result = await window.API.orders.getAll();
        if (result.success) {
            orders = result.data;
            orders.forEach(order => addOrderToMap(order));
            updateOrderPool();
            updateStats();
        }
    } catch (error) {
        console.error('加载订单失败:', error);
    }
}

function updateOrderPool() {
    const pool = document.getElementById('orderPool');
    const pendingOrders = orders.filter(o => o.status === 'pending');
    
    document.getElementById('pendingBadge').textContent = pendingOrders.length;
    
    if (pendingOrders.length === 0) {
        pool.innerHTML = '<div style="text-align:center;color:#999;padding:40px 20px;">暂无待分配订单</div>';
        return;
    }
    
    pool.innerHTML = pendingOrders.map(order => {
        const minutes = getOrderAgeMinutes(order.create_time);
        const timeClass = minutes > 30 ? 'time-overdue' : minutes > 15 ? 'time-warning' : 'time-normal';
        
        return `
        <div class="order-card" onclick="selectOrder('${order.id}')">
            <div class="order-header">
                <span class="order-id">${order.id}</span>
                <span class="order-time">${formatTime(order.create_time)}</span>
            </div>
            <div class="order-route">
                <span class="from">${order.restaurant}</span>
                <span class="arrow">→</span>
                <span class="to">${order.customer_town}</span>
            </div>
            <div class="order-info">
                <span>📍 ${order.customer_lat.toFixed(4)}, ${order.customer_lon.toFixed(4)}</span>
                <span class="order-timer ${timeClass}">⏱️ ${minutes}分钟</span>
            </div>
            <button class="btn-assign" onclick="event.stopPropagation(); showAssignOptions('${order.id}')">派单</button>
        </div>
        `;
    }).join('');
}

function selectOrder(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    // 地图定位到订单
    map.panTo(new T.LngLat(order.customer_lon, order.customer_lat));
    map.setZoom(14);
}

function highlightOrderInList(orderId) {
    console.log('高亮订单:', orderId);
    
    // 移除所有订单的高亮
    document.querySelectorAll('.order-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // 找到该订单卡片并高亮 - 使用多种方式匹配
    let orderCard = document.querySelector(`.order-card[onclick*="'${orderId}'"]`);
    
    // 如果没找到，尝试其他方式
    if (!orderCard) {
        const cards = document.querySelectorAll('.order-card');
        for (let card of cards) {
            if (card.textContent.includes(orderId)) {
                orderCard = card;
                break;
            }
        }
    }
    
    if (orderCard) {
        orderCard.classList.add('selected');
        
        // 滚动到该订单
        orderCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        console.log('✅ 已高亮订单:', orderId);
    } else {
        console.warn('⚠️ 未找到订单卡片:', orderId);
    }
}

// 从地图信息窗口调用派单
window.showAssignFromMap = function(orderId) {
    // 关闭信息窗口
    if (map) {
        map.closeInfoWindow();
    }
    // 打开分配弹窗
    showAssignOptions(orderId);
};

function updateOrderInList(orderId, updatedOrder) {
    const index = orders.findIndex(o => o.id === orderId);
    if (index >= 0) {
        orders[index] = updatedOrder;
        if (updatedOrder.status === 'completed') {
            todayCompleted++;
            if (orderMarkers[orderId]) {
                map.removeOverLay(orderMarkers[orderId]);
                delete orderMarkers[orderId];
            }
        } else {
            addOrderToMap(updatedOrder);
        }
        updateOrderPool();
        updateStats();
    }
}

// ==================== 订单分配 ====================
function showAssignOptions(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    selectedOrder = order;
    
    const freeDrivers = drivers.filter(d => d.status === 'free');
    
    const optionsHtml = freeDrivers.map(driver => `
        <div class="driver-option" onclick="assignToDriver('${driver.id}')">
            <span class="driver-option-name">🚗 ${driver.name}</span>
            <span class="driver-option-phone">${driver.phone || '无电话'}</span>
        </div>
    `).join('');
    
    const body = document.getElementById('assignBody');
    body.innerHTML = `
        <div style="margin-bottom: 20px;">
            <h4 style="margin-bottom: 10px;">📦 订单 ${order.id}</h4>
            <p style="color: #666; font-size: 13px;">${order.restaurant} → ${order.customer_town}</p>
            <p style="color: #999; font-size: 12px;">下单 ${getOrderAgeMinutes(order.create_time)} 分钟</p>
        </div>
        
        <div style="margin-bottom: 20px;">
            <h4 style="margin-bottom: 10px;">选择司机</h4>
            ${freeDrivers.length > 0 ? optionsHtml : '<p style="color: #f5222d; text-align: center; padding: 20px;">⚠️ 当前没有空闲司机</p>'}
        </div>
    `;
    
    const modal = document.getElementById('assignModal');
    modal.style.display = 'flex';
}

function assignToDriver(driverId) {
    if (!selectedOrder) return;
    
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return;
    
    if (confirm(`确定将订单 ${selectedOrder.id} 分配给 ${driver.name} 吗？`)) {
        performAssignment(selectedOrder.id, driverId, driver.name);
    }
}

async function performAssignment(orderId, driverId, driverName) {
    try {
        const result = await window.API.orders.updateStatus(orderId, 'assigned', driverId);
        if (result.success) {
            showNotification(`✅ 订单 ${orderId} 已分配给 ${driverName}`);
            closeAssignModal();
            loadOrders();
            loadDrivers();
        }
    } catch (error) {
        alert('分配失败：' + error.message);
    }
}

function closeAssignModal() {
    document.getElementById('assignModal').style.display = 'none';
    selectedOrder = null;
}

// ==================== 司机管理 ====================
async function loadDrivers() {
    try {
        const result = await window.API.drivers.getAll();
        if (result.success) {
            drivers = result.data;
            updateDriverList();
            updateStats();
            
            drivers.forEach(driver => {
                if (driver.current_lat && driver.current_lon) {
                    addDriverToMap(driver);
                }
            });
        }
    } catch (error) {
        console.error('加载司机失败:', error);
    }
}

async function initDrivers() {
    // 初始化 4 个固定司机
    const defaultDrivers = [
        { id: 'D1', name: '1 号司机', phone: '13800138001' },
        { id: 'D2', name: '2 号司机', phone: '13800138002' },
        { id: 'D3', name: '3 号司机', phone: '13800138003' },
        { id: 'D4', name: '4 号司机', phone: '13800138004' }
    ];
    
    for (const driver of defaultDrivers) {
        try {
            await window.API.drivers.create(driver);
        } catch (error) {
            // 司机可能已存在，忽略错误
        }
    }
    
    showNotification('✅ 已初始化 4 个司机');
    loadDrivers();
}

function updateDriverList() {
    const list = document.getElementById('driverList');
    
    if (drivers.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">暂无司机<br><button onclick="initDrivers()" style="margin-top:10px;padding:8px 16px;background:#1890ff;color:white;border:none;border-radius:4px;cursor:pointer;">+ 添加司机</button></div>';
        document.getElementById('onlineDrivers').textContent = '0';
        return;
    }
    
    document.getElementById('onlineDrivers').textContent = drivers.filter(d => d.status === 'free').length;
    
    list.innerHTML = drivers.map(driver => {
        const statusClass = driver.status === 'free' ? 'status-free' : 'status-busy';
        const statusText = driver.status === 'free' ? '空闲' : '配送中';
        const lastUpdate = driver.last_update ? getTimeAgo(new Date(driver.last_update)) : '未知';
        
        return `
        <div class="driver-card" onclick="showDriverLocation('${driver.id}')">
            <div class="driver-header">
                <span class="driver-name">🚗 ${driver.name}</span>
                <span class="driver-status ${statusClass}">${statusText}</span>
            </div>
            <div class="driver-info">
                <span>📱 ${driver.phone || '--'}</span>
                <span>🕒 ${lastUpdate}更新</span>
            </div>
        </div>
        `;
    }).join('');
}

function addDriverToMap(driver) {
    if (driverMarkers[driver.id]) {
        map.removeOverLay(driverMarkers[driver.id]);
    }
    
    const marker = new T.Marker(new T.LngLat(driver.current_lon, driver.current_lat));
    map.addOverLay(marker);
    
    marker.addEventListener('click', function() {
        const infoContent = `
            <div style="padding: 5px;">
                <b>${driver.name}</b><br>
                状态：${getStatusText(driver.status)}<br>
                电话：${driver.phone || '--'}<br>
                更新：${driver.last_update ? getTimeAgo(new Date(driver.last_update)) : '未知'}
            </div>
        `;
        const infoWin = new T.InfoWindow(infoContent);
        marker.openInfoWindow(infoWin);
    });
    
    driverMarkers[driver.id] = marker;
}

function updateDriverPosition(data) {
    const driver = drivers.find(d => d.id === data.driverId);
    if (driver) {
        driver.current_lat = data.lat;
        driver.current_lon = data.lon;
        driver.last_update = data.timestamp;
        
        if (driverMarkers[data.driverId]) {
            map.removeOverLay(driverMarkers[data.driverId]);
        }
        addDriverToMap(driver);
        updateDriverList();
    }
}

function showDriverLocation(driverId) {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver || !driver.current_lat || !driver.current_lon) return;
    
    map.panTo(new T.LngLat(driver.current_lon, driver.current_lat));
}

function showAllDrivers() {
    Object.values(driverMarkers).forEach(marker => map.removeOverLay(marker));
    drivers.forEach(driver => {
        if (driver.current_lat && driver.current_lon) {
            addDriverToMap(driver);
        }
    });
}

// ==================== 统计更新 ====================
function updateStats() {
    const pendingOrders = orders.filter(o => o.status === 'pending');
    const deliveringOrders = orders.filter(o => o.status === 'assigned' || o.status === 'delivering');
    
    document.getElementById('onlineDrivers').textContent = drivers.filter(d => d.status === 'free').length;
    document.getElementById('pendingOrders').textContent = pendingOrders.length;
    document.getElementById('deliveringOrders').textContent = deliveringOrders.length;
    document.getElementById('todayCompleted').textContent = todayCompleted;
}

function updateTime() {
    const now = new Date();
    document.getElementById('currentTime').textContent = now.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
}

// ==================== 工具函数 ====================
function getStatusText(status) {
    const statusMap = {
        'pending': '待分配',
        'assigned': '已分配',
        'delivering': '配送中',
        'completed': '已完成',
        'cancelled': '已取消'
    };
    return statusMap[status] || status;
}

function formatTime(date) {
    if (typeof date === 'string') {
        date = new Date(date);
    }
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function getOrderAgeMinutes(createTime) {
    const now = new Date();
    const orderTime = new Date(createTime);
    const diffMs = now - orderTime;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return diffMinutes;
}

// 每 30 秒刷新一次订单列表（更新计时器）
setInterval(() => {
    updateOrderPool();
}, 30000);

function getTimeAgo(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // 秒
    
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    return `${Math.floor(diff / 86400)}天前`;
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}
