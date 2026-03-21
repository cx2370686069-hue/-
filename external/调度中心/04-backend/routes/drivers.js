/**
 * 司机路由
 * 处理司机的增删改查
 */

const express = require('express');
const router = express.Router();
const { query, run } = require('../database/db');

/**
 * 获取所有司机
 * GET /api/drivers
 */
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        let sql = 'SELECT * FROM drivers';
        let params = [];
        
        if (status) {
            sql += ' WHERE status = ?';
            params.push(status);
        }
        
        sql += ' ORDER BY created_at DESC';
        
        const drivers = await query(sql, params);
        res.json({
            success: true,
            data: drivers,
            count: drivers.length
        });
    } catch (error) {
        console.error('获取司机失败:', error);
        res.status(500).json({
            success: false,
            message: '获取司机失败',
            error: error.message
        });
    }
});

/**
 * 获取单个司机
 * GET /api/drivers/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const drivers = await query('SELECT * FROM drivers WHERE id = ?', [id]);
        
        if (drivers.length === 0) {
            return res.status(404).json({
                success: false,
                message: '司机不存在'
            });
        }
        
        res.json({
            success: true,
            data: drivers[0]
        });
    } catch (error) {
        console.error('获取司机详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取司机详情失败',
            error: error.message
        });
    }
});

/**
 * 创建新司机
 * POST /api/drivers
 */
router.post('/', async (req, res) => {
    try {
        const {
            id,
            name,
            phone,
            vehicle_type = 'van',
            max_capacity = 20
        } = req.body;
        
        // 参数验证
        if (!id || !name) {
            return res.status(400).json({
                success: false,
                message: '缺少必要参数：id, name'
            });
        }
        
        const sql = `
            INSERT INTO drivers (id, name, phone, vehicle_type, max_capacity, status)
            VALUES (?, ?, ?, ?, ?, 'free')
        `;
        
        await run(sql, [id, name, phone, vehicle_type, max_capacity]);
        
        // 获取刚创建的司机
        const newDriver = await query('SELECT * FROM drivers WHERE id = ?', [id]);
        
        // 通过 WebSocket 广播新司机
        if (req.io) {
            req.io.to('dispatch_room').emit('driver_added', newDriver[0]);
        }
        
        res.status(201).json({
            success: true,
            message: '司机创建成功',
            data: newDriver[0]
        });
    } catch (error) {
        console.error('创建司机失败:', error);
        res.status(500).json({
            success: false,
            message: '创建司机失败',
            error: error.message
        });
    }
});

/**
 * 更新司机状态
 * PUT /api/drivers/:id/status
 */
router.put('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, lat, lon } = req.body;
        
        // 验证状态值
        const validStatuses = ['free', 'busy', 'offline'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: '无效的状态值'
            });
        }
        
        let sql = 'UPDATE drivers SET';
        let params = [];
        const updates = [];
        
        if (status) {
            updates.push('status = ?');
            params.push(status);
        }
        
        if (lat !== undefined && lon !== undefined) {
            updates.push('current_lat = ?, current_lon = ?');
            params.push(lat, lon);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: '没有要更新的字段'
            });
        }
        
        sql += ' ' + updates.join(', ');
        sql += ' WHERE id = ?';
        params.push(id);
        
        const result = await run(sql, params);
        
        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: '司机不存在'
            });
        }
        
        // 获取更新后的司机
        const updatedDriver = await query('SELECT * FROM drivers WHERE id = ?', [id]);
        
        // 通过 WebSocket 广播司机更新
        if (req.io) {
            req.io.to('dispatch_room').emit('driver_updated', updatedDriver[0]);
        }
        
        res.json({
            success: true,
            message: '司机状态更新成功',
            data: updatedDriver[0]
        });
    } catch (error) {
        console.error('更新司机状态失败:', error);
        res.status(500).json({
            success: false,
            message: '更新司机状态失败',
            error: error.message
        });
    }
});

/**
 * 更新司机位置
 * PUT /api/drivers/:id/location
 */
router.put('/:id/location', async (req, res) => {
    try {
        const { id } = req.params;
        const { lat, lon } = req.body;
        
        if (lat === undefined || lon === undefined) {
            return res.status(400).json({
                success: false,
                message: '缺少经纬度参数'
            });
        }
        
        const sql = 'UPDATE drivers SET current_lat = ?, current_lon = ? WHERE id = ?';
        const result = await run(sql, [lat, lon, id]);
        
        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: '司机不存在'
            });
        }
        
        // 获取更新后的司机
        const updatedDriver = await query('SELECT * FROM drivers WHERE id = ?', [id]);
        
        // 通过 WebSocket 广播位置更新
        if (req.io) {
            req.io.to('dispatch_room').emit('driver_location_update', {
                driverId: id,
                lat,
                lon,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            message: '位置更新成功',
            data: updatedDriver[0]
        });
    } catch (error) {
        console.error('更新司机位置失败:', error);
        res.status(500).json({
            success: false,
            message: '更新司机位置失败',
            error: error.message
        });
    }
});

/**
 * 获取司机任务
 * GET /api/drivers/:id/tasks
 */
router.get('/:id/tasks', async (req, res) => {
    try {
        const { id } = req.params;
        
        // 获取分配给该司机的订单
        const orders = await query(
            'SELECT * FROM orders WHERE driver_id = ? AND status IN (?, ?) ORDER BY create_time ASC',
            [id, 'assigned', 'delivering']
        );
        
        res.json({
            success: true,
            data: orders,
            count: orders.length
        });
    } catch (error) {
        console.error('获取司机任务失败:', error);
        res.status(500).json({
            success: false,
            message: '获取司机任务失败',
            error: error.message
        });
    }
});

/**
 * 删除司机
 * DELETE /api/drivers/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await run('DELETE FROM drivers WHERE id = ?', [id]);
        
        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: '司机不存在'
            });
        }
        
        // 广播司机删除
        if (req.io) {
            req.io.to('dispatch_room').emit('driver_removed', { driverId: id });
        }
        
        res.json({
            success: true,
            message: '司机删除成功'
        });
    } catch (error) {
        console.error('删除司机失败:', error);
        res.status(500).json({
            success: false,
            message: '删除司机失败',
            error: error.message
        });
    }
});

module.exports = router;
