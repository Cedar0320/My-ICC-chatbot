const express = require('express');
const router = express.Router();
const User = require('../models/User');

console.log('✅ nonverbalRoutes.js 已載入');

/**
 * GET /api/nonverbal/practice/:practiceId
 * 獲取單次練習的非語言分析詳情
 */
router.get('/practice/:practiceId', async (req, res) => {
    console.log('🔍 /practice/:practiceId route called');
    console.log('📋 Request params:', req.params);
    console.log('👤 User info:', req.user);
    try {
        const { practiceId } = req.params;
        const userId = req.user.id;
        console.log(`查找用戶 ${userId} 的練習 ${practiceId}`);

        // 查找用戶和練習
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: '用戶不存在' });
        }

        const practice = user.practices.id(practiceId);
        if (!practice) {
            return res.status(404).json({ success: false, message: '練習不存在' });
        }

        // 提取非語言數據
        const nonverbalDetails = practice.history
            .filter(entry => entry.role === '導師' && entry.nonverbalData)
            .map((entry, index) => ({
                turnNumber: index + 1,
                content: entry.content.substring(0, 50) + '...', // 簡短預覽
                timestamp: entry.timestamp,
                nonverbalData: {
                    eyeContactRate: entry.nonverbalData.eyeContactRate,
                    smileRate: entry.nonverbalData.smileRate,
                    openPostureRate: entry.nonverbalData.openPostureRate,
                    gesturesUsed: entry.nonverbalData.gesturesUsed,
                    gesturesList: entry.nonverbalData.gesturesList,
                    dataQuality: entry.nonverbalData.dataQuality
                }
            }));

        // 構建回應
        const response = {
            success: true,
            practiceId: practice._id,
            technique: practice.technique,
            scenario: practice.scenario,
            createdAt: practice.createdAt,
            summary: practice.nonverbalSummary || null,
            details: nonverbalDetails,
            hasNonverbalData: nonverbalDetails.length > 0
        };

        res.json(response);

    } catch (error) {
        console.error('❌ 獲取練習非語言數據失敗:', error);
        console.error('錯誤堆疊:', error.stack);
        res.status(500).json({
            success: false,
            message: '獲取數據失敗',
            error: error.message
        });
    }
});

/**
 * GET /api/nonverbal/progress
 * 獲取使用者的非語言表現進步趨勢
 * Query params: technique (optional) - 過濾特定技巧
 */
router.get('/progress', async (req, res) => {
    console.log('🔍 /progress route called');
    try {
        const userId = req.user.id;
        const { technique } = req.query;

        // 查找用戶
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: '用戶不存在' });
        }

        // 過濾練習
        let practices = user.practices.filter(p => p.nonverbalSummary);

        if (technique) {
            practices = practices.filter(p => p.technique === technique);
        }

        // 按日期排序
        practices.sort((a, b) => a.createdAt - b.createdAt);

        // 構建進步數據
        const progressData = practices.map((p, index) => ({
            practiceId: p._id,
            practiceNumber: index + 1,
            date: p.createdAt,
            technique: p.technique,
            difficulty: p.difficulty,
            metrics: {
                eyeContactRate: p.nonverbalSummary.averageEyeContactRate,
                smileRate: p.nonverbalSummary.averageSmileRate,
                openPostureRate: p.nonverbalSummary.averageOpenPostureRate,
                totalGestures: p.nonverbalSummary.totalGesturesUsed
            }
        }));

        // 計算整體統計
        const statistics = calculateStatistics(progressData);

        res.json({
            success: true,
            totalPractices: progressData.length,
            technique: technique || 'all',
            progressData,
            statistics
        });

    } catch (error) {
        console.error('獲取進步數據失敗:', error);
        res.status(500).json({
            success: false,
            message: '獲取數據失敗',
            error: error.message
        });
    }
});

/**
 * GET /api/nonverbal/comparison/:practiceId1/:practiceId2
 * 比較兩次練習的非語言表現
 */
router.get('/comparison/:practiceId1/:practiceId2', async (req, res) => {
    try {
        const { practiceId1, practiceId2 } = req.params;
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: '用戶不存在' });
        }

        const practice1 = user.practices.id(practiceId1);
        const practice2 = user.practices.id(practiceId2);

        if (!practice1 || !practice2) {
            return res.status(404).json({ success: false, message: '練習不存在' });
        }

        if (!practice1.nonverbalSummary || !practice2.nonverbalSummary) {
            return res.status(400).json({
                success: false,
                message: '其中一個練習沒有非語言數據'
            });
        }

        // 計算差異
        const comparison = {
            practice1: {
                id: practice1._id,
                date: practice1.createdAt,
                technique: practice1.technique,
                metrics: practice1.nonverbalSummary
            },
            practice2: {
                id: practice2._id,
                date: practice2.createdAt,
                technique: practice2.technique,
                metrics: practice2.nonverbalSummary
            },
            differences: {
                eyeContactRate: {
                    change: practice2.nonverbalSummary.averageEyeContactRate -
                            practice1.nonverbalSummary.averageEyeContactRate,
                    percentChange: calculatePercentChange(
                        practice1.nonverbalSummary.averageEyeContactRate,
                        practice2.nonverbalSummary.averageEyeContactRate
                    )
                },
                smileRate: {
                    change: practice2.nonverbalSummary.averageSmileRate -
                            practice1.nonverbalSummary.averageSmileRate,
                    percentChange: calculatePercentChange(
                        practice1.nonverbalSummary.averageSmileRate,
                        practice2.nonverbalSummary.averageSmileRate
                    )
                },
                openPostureRate: {
                    change: practice2.nonverbalSummary.averageOpenPostureRate -
                            practice1.nonverbalSummary.averageOpenPostureRate,
                    percentChange: calculatePercentChange(
                        practice1.nonverbalSummary.averageOpenPostureRate,
                        practice2.nonverbalSummary.averageOpenPostureRate
                    )
                },
                gesturesUsed: {
                    change: practice2.nonverbalSummary.totalGesturesUsed -
                            practice1.nonverbalSummary.totalGesturesUsed
                }
            },
            improvement: determineImprovement(practice1.nonverbalSummary, practice2.nonverbalSummary)
        };

        res.json({ success: true, comparison });

    } catch (error) {
        console.error('比較練習失敗:', error);
        res.status(500).json({
            success: false,
            message: '比較失敗',
            error: error.message
        });
    }
});

/**
 * GET /api/nonverbal/stats
 * 獲取使用者的非語言數據整體統計
 */
router.get('/stats', async (req, res) => {
    console.log('🔍 /stats route called');
    try {
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: '用戶不存在' });
        }

        // 過濾有非語言數據的練習
        const practicesWithNonverbal = user.practices.filter(p => p.nonverbalSummary);

        if (practicesWithNonverbal.length === 0) {
            return res.json({
                success: true,
                message: '尚無非語言數據',
                stats: null
            });
        }

        // 計算整體統計
        let totalEyeContact = 0;
        let totalSmile = 0;
        let totalPosture = 0;
        let totalGestures = 0;
        let bestEyeContact = { rate: 0, practiceId: null };
        let bestSmile = { rate: 0, practiceId: null };
        let bestPosture = { rate: 0, practiceId: null };

        practicesWithNonverbal.forEach(practice => {
            const summary = practice.nonverbalSummary;

            totalEyeContact += summary.averageEyeContactRate;
            totalSmile += summary.averageSmileRate;
            totalPosture += summary.averageOpenPostureRate;
            totalGestures += summary.totalGesturesUsed;

            // 追蹤最佳表現
            if (summary.averageEyeContactRate > bestEyeContact.rate) {
                bestEyeContact = { rate: summary.averageEyeContactRate, practiceId: practice._id };
            }
            if (summary.averageSmileRate > bestSmile.rate) {
                bestSmile = { rate: summary.averageSmileRate, practiceId: practice._id };
            }
            if (summary.averageOpenPostureRate > bestPosture.rate) {
                bestPosture = { rate: summary.averageOpenPostureRate, practiceId: practice._id };
            }
        });

        const count = practicesWithNonverbal.length;

        // 按技巧分組統計
        const byTechnique = {};
        practicesWithNonverbal.forEach(practice => {
            const tech = practice.technique;
            if (!byTechnique[tech]) {
                byTechnique[tech] = {
                    count: 0,
                    totalEyeContact: 0,
                    totalSmile: 0,
                    totalPosture: 0
                };
            }
            byTechnique[tech].count++;
            byTechnique[tech].totalEyeContact += practice.nonverbalSummary.averageEyeContactRate;
            byTechnique[tech].totalSmile += practice.nonverbalSummary.averageSmileRate;
            byTechnique[tech].totalPosture += practice.nonverbalSummary.averageOpenPostureRate;
        });

        // 計算各技巧平均值
        const techniqueStats = {};
        Object.keys(byTechnique).forEach(tech => {
            const data = byTechnique[tech];
            techniqueStats[tech] = {
                practiceCount: data.count,
                averageEyeContactRate: parseFloat((data.totalEyeContact / data.count).toFixed(1)),
                averageSmileRate: parseFloat((data.totalSmile / data.count).toFixed(1)),
                averageOpenPostureRate: parseFloat((data.totalPosture / data.count).toFixed(1))
            };
        });

        const stats = {
            overall: {
                totalPractices: count,
                averageEyeContactRate: parseFloat((totalEyeContact / count).toFixed(1)),
                averageSmileRate: parseFloat((totalSmile / count).toFixed(1)),
                averageOpenPostureRate: parseFloat((totalPosture / count).toFixed(1)),
                totalGesturesUsed: totalGestures,
                averageGesturesPerPractice: parseFloat((totalGestures / count).toFixed(1))
            },
            bestPerformances: {
                eyeContact: bestEyeContact,
                smile: bestSmile,
                posture: bestPosture
            },
            byTechnique: techniqueStats,
            latestPractice: practicesWithNonverbal[practicesWithNonverbal.length - 1]?.nonverbalSummary
        };

        res.json({ success: true, stats });

    } catch (error) {
        console.error('獲取統計數據失敗:', error);
        res.status(500).json({
            success: false,
            message: '獲取統計失敗',
            error: error.message
        });
    }
});

// ==================== 工具函數 ====================

/**
 * 計算進步統計
 */
function calculateStatistics(progressData) {
    if (progressData.length === 0) {
        return null;
    }

    const latest = progressData[progressData.length - 1]?.metrics;
    const earliest = progressData[0]?.metrics;

    return {
        latestMetrics: latest,
        improvement: {
            eyeContactRate: latest.eyeContactRate - earliest.eyeContactRate,
            smileRate: latest.smileRate - earliest.smileRate,
            openPostureRate: latest.openPostureRate - earliest.openPostureRate
        },
        averages: {
            eyeContactRate: parseFloat((progressData.reduce((sum, p) => sum + p.metrics.eyeContactRate, 0) / progressData.length).toFixed(1)),
            smileRate: parseFloat((progressData.reduce((sum, p) => sum + p.metrics.smileRate, 0) / progressData.length).toFixed(1)),
            openPostureRate: parseFloat((progressData.reduce((sum, p) => sum + p.metrics.openPostureRate, 0) / progressData.length).toFixed(1))
        }
    };
}

/**
 * 計算百分比變化
 */
function calculatePercentChange(oldValue, newValue) {
    if (oldValue === 0) return newValue > 0 ? 100 : 0;
    return parseFloat((((newValue - oldValue) / oldValue) * 100).toFixed(1));
}

/**
 * 判斷是否進步
 */
function determineImprovement(summary1, summary2) {
    const improvements = [];
    const declines = [];

    const metrics = [
        { name: 'eyeContactRate', label: '眼神接觸', key: 'averageEyeContactRate' },
        { name: 'smileRate', label: '微笑率', key: 'averageSmileRate' },
        { name: 'openPostureRate', label: '開放姿態', key: 'averageOpenPostureRate' }
    ];

    metrics.forEach(metric => {
        const diff = summary2[metric.key] - summary1[metric.key];
        if (diff > 5) {
            improvements.push({ metric: metric.label, change: diff.toFixed(1) });
        } else if (diff < -5) {
            declines.push({ metric: metric.label, change: Math.abs(diff).toFixed(1) });
        }
    });

    return {
        hasImprovement: improvements.length > 0,
        improvements,
        declines,
        overallTrend: improvements.length > declines.length ? 'improving' :
                      declines.length > improvements.length ? 'declining' : 'stable'
    };
}

module.exports = router;
