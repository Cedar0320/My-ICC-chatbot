const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const mongoose = require('mongoose');
const User = require('../models/User'); // 確保引入 User 模型
const { 
  createPractice, 
  updatePractice, 
  getPractices, 
  getPracticeDetails, 
  deletePractice 
} = require('../services/practiceService');

// 獲取所有練習
// router.get('/practices', async (req, res) => {
//   try {
//     const userId = req.user.id;
    
//     const practices = await getPractices(userId);
//     res.json({ success: true, practices });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

//301更新
router.get('/practices', async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    if (!userId) {
      return res.status(401).json({ success: false, message: "未授權訪問" });
    }

    const { technique, difficulty, dateRange, searchQuery, completed, page = 1, limit = 10 } = req.query;

    let practices = await getPractices(userId) || [];
    let filteredPractices = [...practices]; // 創建副本以便篩選

    // 篩選條件應用
    if (filteredPractices.length > 0) {
      // 只篩選已完成分析的練習（如果指定了該條件）
      if (completed === 'true') {
        filteredPractices = filteredPractices.filter(practice => practice.analysis);
      }

      // 技巧篩選
      if (technique && technique !== 'all') {
        filteredPractices = filteredPractices.filter(practice => practice.technique === technique);
      }

      // 難度篩選
      if (difficulty && difficulty !== 'all') {
        filteredPractices = filteredPractices.filter(practice => practice.difficulty === difficulty);
      }

      // 日期範圍篩選
      if (dateRange && dateRange !== 'all') {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        filteredPractices = filteredPractices.filter(practice => {
          const practiceDate = new Date(practice.createdAt);

          if (dateRange === 'today') {
            return practiceDate >= today;
          } else if (dateRange === 'week') {
            const firstDayOfWeek = new Date(today);
            const day = today.getDay() || 7;
            firstDayOfWeek.setUTCDate(today.getUTCDate() - day + 1);
            return practiceDate >= firstDayOfWeek;
          } else if (dateRange === '7days') {
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setUTCDate(today.getUTCDate() - 7);
            return practiceDate < sevenDaysAgo;
          }
          return true;
        });
      }

      // 關鍵字搜尋
      if (searchQuery && searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        filteredPractices = filteredPractices.filter(practice => {
          const scenarioMatch = practice.scenario && practice.scenario.toLowerCase().includes(query);
          const techniqueMatch = practice.technique && practice.technique.toLowerCase().includes(query);
          const historyMatch = Array.isArray(practice.history) &&
            practice.history.some(entry => entry.content && entry.content.toLowerCase().includes(query));

          return scenarioMatch || techniqueMatch || historyMatch;
        });
      }
    }

    // 計算分頁
    const totalPractices = filteredPractices.length;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const totalPages = Math.ceil(totalPractices / limitNum);

    // 應用分頁切片
    const paginatedPractices = filteredPractices.slice(skip, skip + limitNum);

    // 使用與原始代碼一致的格式返回結果
    return res.json({ 
      success: true, 
      practices: paginatedPractices,
      total: totalPractices,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: totalPages,
        hasMore: pageNum < totalPages
      }
    });
    
  } catch (error) {
    console.error("Error fetching practices:", error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || "伺服器內部錯誤"
    });
  }
});


// 創建新練習
router.post('/practices', async (req, res) => {
  try {
    const userId = req.user.id;
    const practice = await createPractice(userId, req.body);

    if (!practice || !practice._id) {
      throw new Error('練習創建失敗：無法生成練習ID');
    }

    res.status(201).json({ success: true, practice,message: '練習創建成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 獲取單一練習
router.get('/practices/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const practiceId = req.params.id;
    const practice = await getPracticeDetails(userId, practiceId);
    res.json({ success: true, practice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const { validatePracticeUpdate } = require('../middleware/validatePractice');
// 更新練習
router.patch('/practices/:id', validatePracticeUpdate, async (req, res) => {
  try {
    const practiceId = req.params.id;
    
    // 驗證 practiceId 格式
    if (!mongoose.Types.ObjectId.isValid(practiceId)) {
      return res.status(400).json({
        success: false,
        message: '無效的練習 ID 格式'
      });
    }

    // 驗證更新資料的格式
    const updates = req.body;
    console.log('Received update data:', updates); // 調試用

    // 驗證更新資料的結構
    if (updates.history) {
      if (!Array.isArray(updates.history)) {
        return res.status(400).json({
          success: false,
          message: 'history 必須是陣列格式'
        });
      }

      // 驗證每個歷史記錄的格式
      for (const entry of updates.history) {
        if (!entry.role || !entry.content) {
          return res.status(400).json({
            success: false,
            message: '對話歷史記錄格式不正確'
          });
        }
        if (!['導師', '家長'].includes(entry.role)) {
          return res.status(400).json({
            success: false,
            message: '無效的角色類型'
          });
        }
      }
    }

    // 進行更新
    const updatedPractice = await updatePractice(practiceId, updates);

    // 回傳更新結果
    res.json({
      success: true,
      practice: updatedPractice,
      message: '練習更新成功'
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 刪除練習
router.delete('/practices/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const practiceId = req.params.id;
    await deletePractice(userId, practiceId);
    res.json({ success: true, message: '練習已刪除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:practiceId/feedback', authMiddleware, async (req, res) => {
  try {
    const { practiceId } = req.params;
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({ success: false, message: '回饋內容為必填' });
    }

    const user = await User.findOne({ 'practices._id': practiceId });
    if (!user) {
      return res.status(404).json({ success: false, message: '找不到該練習記錄' });
    }

    const practice = user.practices.id(practiceId);
    if (!practice) {
      return res.status(404).json({ success: false, message: '練習不存在' });
    }

    practice.feedback.push({
      userId: req.user.id,
      comment,
      createdAt: new Date()
    });

    await user.save();
    res.json({ success: true, message: '心得提交成功' });
  } catch (error) {
    console.error('提交心得失敗:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 獲取指定練習的所有心得
router.get('/:practiceId/feedback', authMiddleware, async (req, res) => {
  try {
    const { practiceId } = req.params;

    // 確認練習 ID 格式是否有效
    if (!mongoose.Types.ObjectId.isValid(practiceId)) {
      return res.status(400).json({ success: false, message: '無效的練習 ID' });
    }

    // 查詢包含該練習的使用者
    const user = await User.findOne({ 'practices._id': practiceId }).select('practices');
    if (!user) {
      return res.status(404).json({ success: false, message: '找不到該練習記錄' });
    }

    // 從練習中提取心得記錄
    const practice = user.practices.id(practiceId);
    if (!practice) {
      return res.status(404).json({ success: false, message: '練習不存在' });
    }

    const feedback = practice.feedback || [];
    res.json({ success: true, feedback });
  } catch (error) {
    console.error('獲取心得失敗:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 0304更新

// 重新練習（基於現有練習創建新練習）
router.post('/practices/:id/retry', async (req, res) => {
  try {
    const userId = req.user.id;
    const originalPracticeId = req.params.id;
    
    // 獲取原始練習詳情
    const originalPractice = await getPracticeDetails(userId, originalPracticeId);
    
    if (!originalPractice) {
      return res.status(404).json({
        success: false,
        message: '找不到原始練習記錄'
      });
    }
    
    // 創建新練習，帶有與原始練習相同的技巧、難度和情境
    const newPractice = await createPractice(userId, {
      technique: originalPractice.technique,
      difficulty: originalPractice.difficulty,
      scenario: originalPractice.scenario,       // 保留相同的情境
      isRetry: true,
      originalPracticeId: originalPracticeId     // 記錄原始練習ID
    });
    
    if (!newPractice || !newPractice._id) {
      throw new Error('重新練習創建失敗');
    }
    
    res.status(201).json({
      success: true,
      practice: newPractice,
      message: '已創建重新練習'
    });
    
  } catch (error) {
    console.error('重新練習創建失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message || '重新練習創建失敗'
    });
  }
});

module.exports = router;