const User = require('../models/User');
const { calculateNonverbalSummary } = require('./practiceService');

/**
 * 只更新目前登入者擁有的練習，避免僅憑 practiceId 修改其他使用者資料。
 * 此服務不包含建立練習或自動清理資料的副作用。
 */
async function updateOwnedPractice(userId, practiceId, updates) {
  const updatesObj = typeof updates === 'string' ? { content: updates } : updates;

  const user = await User.findOne({
    _id: userId,
    'practices._id': practiceId
  });

  if (!user) {
    throw new Error('練習不存在或無權存取');
  }

  const practice = user.practices.id(practiceId);
  if (!practice) {
    throw new Error('練習不存在或無權存取');
  }

  if (updatesObj.history) {
    if (!Array.isArray(updatesObj.history)) {
      throw new Error('history 必須是陣列格式');
    }
    practice.history = updatesObj.history;
  }

  if (updatesObj.scenario !== undefined) {
    practice.scenario = updatesObj.scenario;
  }
  if (updatesObj.teacherSuggestion !== undefined) {
    practice.teacherSuggestion = updatesObj.teacherSuggestion;
  }
  if (updatesObj.analysis !== undefined) {
    practice.analysis = updatesObj.analysis;
  }
  if (updatesObj.difficulty !== undefined) {
    practice.difficulty = updatesObj.difficulty;
  }

  if (updatesObj.history && practice.analysis && practice.analysis.trim() !== '') {
    const nonverbalSummary = calculateNonverbalSummary(practice.history);
    if (nonverbalSummary) {
      practice.nonverbalSummary = nonverbalSummary;
    }
  }

  await user.save();
  return practice;
}

module.exports = { updateOwnedPractice };
