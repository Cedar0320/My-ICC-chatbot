const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const adminAuth = require('../middleware/adminAuth');

console.log('✅ adminRoutes.js 已載入');

/**
 * 檢查非語言數據是否有效（有實際測量值，不全為0或undefined）
 */
function hasValidNonverbalData(nonverbalData) {
    if (!nonverbalData) return false;
    
    // 檢查是否有任何一個關鍵指標有有效的非零值
    const hasEyeContact = nonverbalData.eyeContactRate !== undefined && nonverbalData.eyeContactRate > 0;
    const hasSmile = nonverbalData.smileRate !== undefined && nonverbalData.smileRate > 0;
    const hasPosture = nonverbalData.openPostureRate !== undefined && nonverbalData.openPostureRate > 0;
    const hasGestures = nonverbalData.gesturesUsed !== undefined && nonverbalData.gesturesUsed > 0;
    
    return hasEyeContact || hasSmile || hasPosture || hasGestures;
}

/**
 * POST /api/admin/login
 * Admin 登入
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        console.log('Admin 登入嘗試:', username);

        // 驗證必要欄位
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: '請提供使用者名稱和密碼'
            });
        }

        // 查找用戶
        const user = await User.findOne({ username });
        console.log('找到使用者:', user ? `${user.username} (role: ${user.role})` : '無');

        if (!user) {
            console.log('❌ 使用者不存在');
            return res.status(401).json({
                success: false,
                message: '使用者名稱或密碼錯誤'
            });
        }

        // 檢查是否為 admin
        if (user.role !== 'admin') {
            console.log('❌ 不是管理員,角色:', user.role);
            return res.status(403).json({
                success: false,
                message: '權限不足,需要管理員權限'
            });
        }

        // 驗證密碼
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('密碼驗證:', isMatch ? '✅ 成功' : '❌ 失敗');

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: '使用者名稱或密碼錯誤'
            });
        }

        // 生成 JWT token (包含 role)
        const token = jwt.sign(
            {
                id: user._id,
                username: user.username,
                role: user.role
            },
            config.jwt.secret,
            { expiresIn: '24h' }
        );

        console.log('✅ Admin 登入成功:', username);

        res.json({
            success: true,
            message: '登入成功',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('❌ Admin 登入失敗:', error);
        res.status(500).json({
            success: false,
            message: '登入失敗',
            error: error.message
        });
    }
});

/**
 * GET /api/admin/users
 * 獲取所有使用者列表
 */
router.get('/users', adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;

        const query = search
            ? {
                $or: [
                    { username: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            }
            : {};

        const skip = (page - 1) * limit;

        const users = await User.find(query)
            .select('-password') // 不返回密碼
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        // 計算每個用戶的練習統計
        const usersWithStats = users.map(user => {
            const userObj = user.toObject();
            const practices = userObj.practices || [];

            return {
                ...userObj,
                stats: {
                    totalPractices: practices.filter(p => p.analysis && p.analysis.trim() !== '').length,
                    completedPractices: practices.filter(p => p.analysis && p.analysis.trim() !== '').length,
                    totalRecordings: practices.reduce((sum, p) => sum + (p.recordings?.length || 0), 0),
                    practicesWithNonverbal: practices.filter(p => {
                        return p.history?.some(h => h.role === '導師' && h.nonverbalData && hasValidNonverbalData(h.nonverbalData));
                    }).length
                }
            };
        });

        res.json({
            success: true,
            users: usersWithStats,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('❌ 獲取使用者列表失敗:', error);
        res.status(500).json({
            success: false,
            message: '獲取使用者列表失敗',
            error: error.message
        });
    }
});

/**
 * GET /api/admin/users/:userId
 * 獲取特定使用者詳細資料
 */
router.get('/users/:userId', adminAuth, async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: '使用者不存在'
            });
        }

        // 計算練習統計
        const practices = user.practices || [];
        const stats = {
            totalPractices: practices.filter(p => p.analysis && p.analysis.trim() !== '').length,
            completedPractices: practices.filter(p => p.analysis && p.analysis.trim() !== '').length,
            totalRecordings: practices.reduce((sum, p) => sum + (p.recordings?.length || 0), 0),
            practicesWithNonverbal: practices.filter(p => {
                return p.history?.some(h => h.role === '導師' && h.nonverbalData && hasValidNonverbalData(h.nonverbalData));
            }).length,
            techniqueBreakdown: {}
        };

        // 按技巧統計
        practices.forEach(p => {
            if (p.technique) {
                stats.techniqueBreakdown[p.technique] = (stats.techniqueBreakdown[p.technique] || 0) + 1;
            }
        });

        res.json({
            success: true,
            user: user.toObject(),
            stats
        });

    } catch (error) {
        console.error('❌ 獲取使用者詳情失敗:', error);
        res.status(500).json({
            success: false,
            message: '獲取使用者詳情失敗',
            error: error.message
        });
    }
});

/**
 * GET /api/admin/users/:userId/practices
 * 獲取特定使用者的所有練習紀錄
 */
router.get('/users/:userId/practices', adminAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20, technique = '' } = req.query;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: '使用者不存在'
            });
        }

        let practices = user.practices || [];

        // 篩選技巧
        if (technique) {
            practices = practices.filter(p => p.technique === technique);
        }

        // 排序(最新的在前)
        practices.sort((a, b) => b.createdAt - a.createdAt);

        // 分頁
        const skip = (page - 1) * limit;
        const paginatedPractices = practices.slice(skip, skip + parseInt(limit));

        res.json({
            success: true,
            practices: paginatedPractices,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: practices.length,
                pages: Math.ceil(practices.length / limit)
            }
        });

    } catch (error) {
        console.error('❌ 獲取練習紀錄失敗:', error);
        res.status(500).json({
            success: false,
            message: '獲取練習紀錄失敗',
            error: error.message
        });
    }
});

/**
 * GET /api/admin/stats
 * 獲取整體系統統計
 */
router.get('/stats', adminAuth, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const adminUsers = await User.countDocuments({ role: 'admin' });

        // 獲取所有用戶的練習統計
        const users = await User.find();

        let totalPractices = 0;
        let completedPractices = 0;
        let totalRecordings = 0;
        let practicesWithNonverbal = 0;
        const techniqueStats = {};

        users.forEach(user => {
            const practices = user.practices || [];
            // 只統計已完成的練習（有 analysis 的）
            const completed = practices.filter(p => p.analysis && p.analysis.trim() !== '').length;
            totalPractices += completed;
            completedPractices += completed;
            totalRecordings += practices.reduce((sum, p) => sum + (p.recordings?.length || 0), 0);
            
            // 只統計真正有有效非語言數據的練習
            practicesWithNonverbal += practices.filter(p => {
                return p.history?.some(h => h.role === '導師' && h.nonverbalData && hasValidNonverbalData(h.nonverbalData));
            }).length;

            practices.forEach(p => {
                if (p.technique) {
                    techniqueStats[p.technique] = (techniqueStats[p.technique] || 0) + 1;
                }
            });
        });

        // 最近7天的用戶增長
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const newUsersLast7Days = await User.countDocuments({
            createdAt: { $gte: sevenDaysAgo }
        });

        res.json({
            success: true,
            stats: {
                users: {
                    total: totalUsers,
                    admins: adminUsers,
                    regular: totalUsers - adminUsers,
                    newLast7Days: newUsersLast7Days
                },
                practices: {
                    total: totalPractices,
                    completed: completedPractices,
                    withNonverbal: practicesWithNonverbal,
                    byTechnique: techniqueStats
                },
                recordings: {
                    total: totalRecordings
                }
            }
        });

    } catch (error) {
        console.error('❌ 獲取系統統計失敗:', error);
        res.status(500).json({
            success: false,
            message: '獲取系統統計失敗',
            error: error.message
        });
    }
});

/**
 * DELETE /api/admin/users/:userId
 * 刪除使用者
 */
router.delete('/users/:userId', adminAuth, async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: '使用者不存在'
            });
        }

        // 防止刪除管理員
        if (user.role === 'admin') {
            return res.status(403).json({
                success: false,
                message: '無法刪除管理員帳號'
            });
        }

        await User.findByIdAndDelete(userId);

        console.log('✅ 使用者已刪除:', user.username);

        res.json({
            success: true,
            message: '使用者已刪除'
        });

    } catch (error) {
        console.error('❌ 刪除使用者失敗:', error);
        res.status(500).json({
            success: false,
            message: '刪除使用者失敗',
            error: error.message
        });
    }
});

/**
 * GET /api/admin/users/:userId/practices/:practiceId/nonverbal
 * 獲取特定練習的詳細非語言分析數據
 */
router.get('/users/:userId/practices/:practiceId/nonverbal', adminAuth, async (req, res) => {
    try {
        const { userId, practiceId } = req.params;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: '使用者不存在'
            });
        }

        const practice = user.practices.id(practiceId);

        if (!practice) {
            return res.status(404).json({
                success: false,
                message: '練習不存在'
            });
        }

        // 提取所有包含有效非語言數據的對話輪次
        const nonverbalDetails = practice.history
            .filter(entry => entry.role === '導師' && entry.nonverbalData && hasValidNonverbalData(entry.nonverbalData))
            .map((entry, index) => ({
                turnNumber: index + 1,
                content: entry.content,
                timestamp: entry.timestamp,
                nonverbalData: {
                    eyeContactRate: entry.nonverbalData.eyeContactRate,
                    smileRate: entry.nonverbalData.smileRate,
                    openPostureRate: entry.nonverbalData.openPostureRate,
                    gesturesUsed: entry.nonverbalData.gesturesUsed,
                    gesturesList: entry.nonverbalData.gesturesList || [],
                    rawData: entry.nonverbalData.rawData || {},
                    dataQuality: entry.nonverbalData.dataQuality || {}
                }
            }));

        // 計算平均值
        let avgEyeContact = 0;
        let avgSmile = 0;
        let avgOpenPosture = 0;
        let totalGestures = 0;

        if (nonverbalDetails.length > 0) {
            nonverbalDetails.forEach(detail => {
                avgEyeContact += detail.nonverbalData.eyeContactRate || 0;
                avgSmile += detail.nonverbalData.smileRate || 0;
                avgOpenPosture += detail.nonverbalData.openPostureRate || 0;
                totalGestures += detail.nonverbalData.gesturesUsed || 0;
            });

            avgEyeContact /= nonverbalDetails.length;
            avgSmile /= nonverbalDetails.length;
            avgOpenPosture /= nonverbalDetails.length;
        }

        res.json({
            success: true,
            practiceId: practice._id,
            technique: practice.technique,
            scenario: practice.scenario,
            createdAt: practice.createdAt,
            summary: {
                averageEyeContactRate: avgEyeContact,
                averageSmileRate: avgSmile,
                averageOpenPostureRate: avgOpenPosture,
                totalGestures: totalGestures,
                dataPointsCount: nonverbalDetails.length
            },
            nonverbalSummary: practice.nonverbalSummary || null,
            details: nonverbalDetails,
            hasNonverbalData: nonverbalDetails.length > 0
        });

    } catch (error) {
        console.error('❌ 獲取非語言分析數據失敗:', error);
        res.status(500).json({
            success: false,
            message: '獲取非語言分析數據失敗',
            error: error.message
        });
    }
});

/**
 * GET /api/admin/nonverbal/overview
 * 獲取所有使用者的非語言數據概覽
 */
router.get('/nonverbal/overview', adminAuth, async (req, res) => {
    try {
        const { technique = '', limit = 50 } = req.query;

        const users = await User.find().select('username email practices');

        const nonverbalData = [];

        users.forEach(user => {
            let practices = user.practices || [];

            // 過濾有有效非語言數據的練習
            practices = practices.filter(p => {
                const hasValidNonverbal = p.history?.some(h => h.role === '導師' && h.nonverbalData && hasValidNonverbalData(h.nonverbalData));
                const matchesTechnique = technique ? p.technique === technique : true;
                return hasValidNonverbal && matchesTechnique;
            });

            practices.forEach(practice => {
                const nonverbalEntries = practice.history
                    .filter(h => h.role === '導師' && h.nonverbalData && hasValidNonverbalData(h.nonverbalData));

                if (nonverbalEntries.length > 0) {
                    // 計算這次練習的平均值
                    let avgEyeContact = 0;
                    let avgSmile = 0;
                    let avgOpenPosture = 0;
                    let totalGestures = 0;

                    nonverbalEntries.forEach(entry => {
                        avgEyeContact += entry.nonverbalData.eyeContactRate || 0;
                        avgSmile += entry.nonverbalData.smileRate || 0;
                        avgOpenPosture += entry.nonverbalData.openPostureRate || 0;
                        totalGestures += entry.nonverbalData.gesturesUsed || 0;
                    });

                    avgEyeContact /= nonverbalEntries.length;
                    avgSmile /= nonverbalEntries.length;
                    avgOpenPosture /= nonverbalEntries.length;

                    nonverbalData.push({
                        userId: user._id,
                        username: user.username,
                        email: user.email,
                        practiceId: practice._id,
                        technique: practice.technique,
                        createdAt: practice.createdAt,
                        averageEyeContactRate: avgEyeContact,
                        averageSmileRate: avgSmile,
                        averageOpenPostureRate: avgOpenPosture,
                        totalGestures: totalGestures,
                        dataPointsCount: nonverbalEntries.length
                    });
                }
            });
        });

        // 按時間排序（最新的在前）
        nonverbalData.sort((a, b) => b.createdAt - a.createdAt);

        // 限制返回數量
        const limitedData = nonverbalData.slice(0, parseInt(limit));

        res.json({
            success: true,
            total: nonverbalData.length,
            data: limitedData
        });

    } catch (error) {
        console.error('❌ 獲取非語言數據概覽失敗:', error);
        res.status(500).json({
            success: false,
            message: '獲取非語言數據概覽失敗',
            error: error.message
        });
    }
});

module.exports = router;
