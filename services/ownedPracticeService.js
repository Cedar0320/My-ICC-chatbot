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
  }).select('practices');

  if (!user) {
    throw new Error('練習不存在或無權存取');
  }

  const practice = user.practices.id(practiceId);
  if (!practice) {
    throw new Error('練習不存在或無權存取');
  }

  const atomicSet = {};

  if (updatesObj.history !== undefined) {
    if (!Array.isArray(updatesObj.history)) {
      throw new Error('history 必須是陣列格式');
    }
    atomicSet['practices.$.history'] = updatesObj.history;
  }

  if (updatesObj.scenario !== undefined) {
    atomicSet['practices.$.scenario'] = updatesObj.scenario;
  }
  if (updatesObj.teacherSuggestion !== undefined) {
    atomicSet['practices.$.teacherSuggestion'] = updatesObj.teacherSuggestion;
  }
  if (updatesObj.analysis !== undefined) {
    atomicSet['practices.$.analysis'] = updatesObj.analysis;
  }
  if (updatesObj.difficulty !== undefined) {
    atomicSet['practices.$.difficulty'] = updatesObj.difficulty;
  }
  if (updatesObj.parentCharacter !== undefined) {
    if (!['mother', 'father'].includes(updatesObj.parentCharacter)) {
      throw new Error('無效的家長角色');
    }
    atomicSet['practices.$.parentCharacter'] = updatesObj.parentCharacter;
  }

  const nextHistory = updatesObj.history !== undefined ? updatesObj.history : practice.history;
  const nextAnalysis = updatesObj.analysis !== undefined ? updatesObj.analysis : practice.analysis;
  if (updatesObj.history !== undefined && nextAnalysis && nextAnalysis.trim() !== '') {
    const nonverbalSummary = calculateNonverbalSummary(nextHistory);
    if (nonverbalSummary) {
      atomicSet['practices.$.nonverbalSummary'] = nonverbalSummary;
    }
  }

  if (Object.keys(atomicSet).length === 0) return practice;

  // 只更新目標 practice 的欄位，不再 save() 整份 User 文件。
  // 這讓 history 與錄音的 $push 可以安全並行，避免 Mongoose VersionError。
  const updatedUser = await User.findOneAndUpdate(
    { _id: userId, 'practices._id': practiceId },
    { $set: atomicSet, $inc: { __v: 1 } },
    { new: true, runValidators: true }
  ).select('practices');

  if (!updatedUser) {
    throw new Error('練習不存在或無權存取');
  }

  return updatedUser.practices.id(practiceId);
}

module.exports = { updateOwnedPractice };
