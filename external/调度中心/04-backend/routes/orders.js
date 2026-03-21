/**
 * 订单路由
 * 处理订单的增删改查
 */

const express = require('express');
const router = express.Router();
const { query, run } = require('../database/db');

/**
 * 获取所有订单
 * GET /api/orders
 */
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        let sql = 'SELECT * FROM orders';
        let params = [];
        
        if (status) {
            sql += ' WHERE status = ?';
            params.push(status);
        }
        
        sql += ' ORDER BY create_time DESC';
        
        const orders = await query(sql, params);
        res.json({
            success: true,
            data: orders,
            count: orders.length
        });
    } catch (error) {
        console.error('获取订单失败:', error);
        res.status(500).json({
            success: false,
            message: '获取订单失败',
            error: error.message
        });
    }
});

/**
 * 获取单个订单
 * GET /api/orders/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const orders = await query('SELECT * FROM orders WHERE id = ?', [id]);
        
        if (orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: '订单不存在'
            });
        }
        
        res.json({
            success: true,
            data: orders[0]
        });
    } catch (error) {
        console.error('获取订单详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取订单详情失败',
            error: error.message
        });
    }
});

/**
 * 创建新订单
 * POST /api/orders
 */
router.post('/', async (req, res) => {
    try {
        const {
            id,
            restaurant,
            restaurant_lat,
            restaurant_lon,
            customer_town,
            customer_lat,
            customer_lon,
            order_type = 'county'
        } = req.body;
        
        // 参数验证
        if (!id || !restaurant || !customer_town) {
            return res.status(400).json({
                success: false,
                message: '缺少必要参数'
            });
        }
        
        const sql = `
            INSERT INTO orders (
                id, restaurant, restaurant_lat, restaurant_lon,
                customer_town, customer_lat, customer_lon, status, order_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        `;
        
        await run(sql, [
            id, restaurant, restaurant_lat, restaurant_lon,
            customer_town, customer_lat, customer_lon, order_type
        ]);
        
        // 获取刚创建的订单
        const newOrder = await query('SELECT * FROM orders WHERE id = ?', [id]);
        
        // 通过 WebSocket 广播新订单
        if (req.io) {
            req.io.to('dispatch_room').emit('new_order', newOrder[0]);
            console.log(`📢 广播新订单: ${id}`);
        }
        
        res.status(201).json({
            success: true,
            message: '订单创建成功',
            data: newOrder[0]
        });
    } catch (error) {
        console.error('创建订单失败:', error);
        res.status(500).json({
            success: false,
            message: '创建订单失败',
            error: error.message
        });
    }
});

/**
 * 更新订单状态
 * PUT /api/orders/:id/status
 */
router.put('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rider_id, driver_id, real_distance, real_duration } = req.body;
        
        // 验证状态值
        const validStatuses = ['pending', 'assigned', 'delivering', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: '无效的状态值'
            });
        }
        
        let sql = 'UPDATE orders SET status = ?';
        let params = [status];
        
        // 根据状态更新不同字段
        if (status === 'assigned' && (rider_id || driver_id)) {
            const assigneeId = rider_id || driver_id;
            sql += ', rider_id = ?, assign_time = CURRENT_TIMESTAMP';
            params.push(assigneeId);
        }
        
        if (status === 'completed') {
            sql += ', complete_time = CURRENT_TIMESTAMP';
        }
        
        if (real_distance !== undefined) {
            sql += ', real_distance = ?';
            params.push(real_distance);
        }
        
        if (real_duration !== undefined) {
            sql += ', real_duration = ?';
            params.push(real_duration);
        }
        
        sql += ' WHERE id = ?';
        params.push(id);
        
        const result = await run(sql, params);
        
        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: '订单不存在'
            });
        }
        
        // 获取更新后的订单
        const updatedOrder = await query('SELECT * FROM orders WHERE id = ?', [id]);
        
        // 通过 WebSocket 广播订单更新
        if (req.io) {
            req.io.emit('order_updated', {
                orderId: id,
                status: status,
                driverId: rider_id || driver_id,
                order: updatedOrder[0],
                timestamp: new Date().toISOString()
            });
            console.log(`📢 广播订单更新: ${id} -> ${status}`);
        }
        
        res.json({
            success: true,
            message: '订单状态更新成功',
            data: updatedOrder[0]
        });
    } catch (error) {
        console.error('更新订单状态失败:', error);
        res.status(500).json({
            success: false,
            message: '更新订单状态失败',
            error: error.message
        });
    }
});

/**
 * 删除订单
 * DELETE /api/orders/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await run('DELETE FROM orders WHERE id = ?', [id]);
        
        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: '订单不存在'
            });
        }
        
        // 广播订单删除
        if (req.io) {
            req.io.to('dispatch_room').emit('order_deleted', { orderId: id });
        }
        
        res.json({
            success: true,
            message: '订单删除成功'
        });
    } catch (error) {
        console.error('删除订单失败:', error);
        res.status(500).json({
            success: false,
            message: '删除订单失败',
            error: error.message
        });
    }
});

/**
 * 获取待配送订单（用于调度）
 * GET /api/orders/pending/list
 */
router.get('/pending/list', async (req, res) => {
    try {
        const orders = await query(
            'SELECT * FROM orders WHERE status = "pending" ORDER BY create_time ASC'
        );
        
        res.json({
            success: true,
            data: orders,
            count: orders.length
        });
    } catch (error) {
        console.error('获取待配送订单失败:', error);
        res.status(500).json({
            success: false,
            message: '获取待配送订单失败',
            error: error.message
        });
    }
});

/**
 * 按类型获取订单
 * GET /api/orders/type/:type
 */
router.get('/type/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const orders = await query(
            'SELECT * FROM orders WHERE order_type = ? ORDER BY create_time DESC',
            [type]
        );
        
        res.json({
            success: true,
            data: orders,
            count: orders.length
        });
    } catch (error) {
        console.error('获取订单失败:', error);
        res.status(500).json({
            success: false,
            message: '获取订单失败',
            error: error.message
        });
    }
});

module.exports = router;
