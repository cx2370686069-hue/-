/**
 * 骑手路由
 * 处理骑手的增删改查
 */

const express = require('express');
const router = express.Router();
const { query, run } = require('../database/db');

/**
 * 获取所有骑手
 * GET /api/riders
 */
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        let sql = 'SELECT * FROM riders';
        let params = [];
        
        if (status) {
            sql += ' WHERE status = ?';
            params.push(status);
        }
        
        sql += ' ORDER BY online_time DESC';
        
        const riders = await query(sql, params);
        res.json({
            success: true,
            data: riders,
            count: riders.length
        });
    } catch (error) {
        console.error('获取骑手失败:', error);
        res.status(500).json({
            success: false,
            message: '获取骑手失败',
            error: error.message
        });
    }
});

/**
 * 获取单个骑手
 * GET /api/riders/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const riders = await query('SELECT * FROM riders WHERE id = ?', [id]);
        
        if (riders.length === 0) {
            return res.status(404).json({
                success: false,
                message: '骑手不存在'
            });
        }
        
        // 获取骑手的当前订单
        const orders = await query(
            'SELECT * FROM orders WHERE rider_id = ? AND status IN ("assigned", "delivering")',
            [id]
        );
        
        const rider = riders[0];
        rider.orders = orders;
        
        res.json({
            success: true,
            data: rider
        });
    } catch (error) {
        console.error('获取骑手详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取骑手详情失败',
            error: error.message
        });
    }
});

/**
 * 创建新骑手
 * POST /api/riders
 */
router.post('/', async (req, res) => {
    try {
        const { id, name, phone, lat, lon } = req.body;
        
        if (!id || !name) {
            return res.status(400).json({
                success: false,
                message: '缺少必要参数'
            });
        }
        
        const sql = `
            INSERT INTO riders (id, name, phone, lat, lon, status)
            VALUES (?, ?, ?, ?, ?, 'free')
        `;
        
        await run(sql, [id, name, phone, lat, lon]);
        
        res.status(201).json({
            success: true,
            message: '骑手创建成功',
            data: { id, name }
        });
    } catch (error) {
        console.error('创建骑手失败:', error);
        res.status(500).json({
            success: false,
            message: '创建骑手失败',
            error: error.message
        });
    }
});

/**
 * 更新骑手状态
 * PUT /api/riders/:id/status
 */
router.put('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, lat, lon } = req.body;
        
        const validStatuses = ['free', 'busy', 'offline'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: '无效的状态值'
            });
        }
        
        let sql = 'UPDATE riders SET status = ?';
        let params = [status];
        
        if (lat !== undefined) {
            sql += ', lat = ?';
            params.push(lat);
        }
        
        if (lon !== undefined) {
            sql += ', lon = ?';
            params.push(lon);
        }
        
        sql += ' WHERE id = ?';
        params.push(id);
        
        const result = await run(sql, params);
        
        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: '骑手不存在'
            });
        }
        
        res.json({
            success: true,
            message: '骑手状态更新成功'
        });
    } catch (error) {
        console.error('更新骑手状态失败:', error);
        res.status(500).json({
            success: false,
            message: '更新骑手状态失败',
            error: error.message
        });
    }
});

/**
 * 更新骑手位置
 * PUT /api/riders/:id/location
 */
router.put('/:id/location', async (req, res) => {
    try {
        const { id } = req.params;
        const { lat, lon } = req.body;
        
        if (lat === undefined || lon === undefined) {
            return res.status(400).json({
                success: false,
                message: '缺少位置参数'
            });
        }
        
        const result = await run(
            'UPDATE riders SET lat = ?, lon = ? WHERE id = ?',
            [lat, lon, id]
        );
        
        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: '骑手不存在'
            });
        }
        
        res.json({
            success: true,
            message: '位置更新成功'
        });
    } catch (error) {
        console.error('更新位置失败:', error);
        res.status(500).json({
            success: false,
            message: '更新位置失败',
            error: error.message
        });
    }
});

/**
 * 删除骑手
 * DELETE /api/riders/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await run('DELETE FROM riders WHERE id = ?', [id]);
        
        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: '骑手不存在'
            });
        }
        
        res.json({
            success: true,
            message: '骑手删除成功'
        });
    } catch (error) {
        console.error('删除骑手失败:', error);
        res.status(500).json({
            success: false,
            message: '删除骑手失败',
            error: error.message
        });
    }
});

/**
 * 获取在线骑手
 * GET /api/riders/online/list
 */
router.get('/online/list', async (req, res) => {
    try {
        const riders = await query(
            'SELECT * FROM riders WHERE status != "offline" ORDER BY status, name'
        );
        
        res.json({
            success: true,
            data: riders,
            count: riders.length
        });
    } catch (error) {
        console.error('获取在线骑手失败:', error);
        res.status(500).json({
            success: false,
            message: '获取在线骑手失败',
            error: error.message
        });
    }
});

module.exports = router;
