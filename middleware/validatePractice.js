const mongoose = require('mongoose');

const validatePracticeUpdate = (req, res, next) => {
  const updates = req.body;

  // 基本資料格式驗證
  if (updates && typeof updates === 'object') {
    // 驗證 practiceId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: '無效的練習 ID'
      });
    }

    // 驗證更新內容
    try {
      // 如果有歷史記錄更新
      if (updates.history) {
        if (!Array.isArray(updates.history)) {
          throw new Error('history 必須是陣列格式');
        }

        updates.history.forEach(entry => {
          if (!entry.role || !entry.content) {
            throw new Error('對話歷史記錄格式不正確');
          }
          if (!['導師', '家長'].includes(entry.role)) {
            throw new Error('無效的角色類型');
          }
        });
      }

      next();
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  } else {
    return res.status(400).json({
      success: false,
      message: '更新資料格式不正確'
    });
  }
};

module.exports = { validatePracticeUpdate };