// const User = require('../models/User');
// const mongoose = require('mongoose');

// // ==================== 非語言數據統計工具函數 ====================

// /**
//  * 計算練習的非語言表現摘要
//  * @param {Array} history 對話歷史記錄
//  * @returns {Object|null} 非語言表現摘要,如果沒有數據則返回 null
//  */
// function calculateNonverbalSummary(history) {
//   if (!Array.isArray(history) || history.length === 0) {
//     console.log('對話歷史為空,無法計算非語言摘要');
//     return null;
//   }

//   // 過濾出有非語言數據的導師回應
//   const teacherEntries = history.filter(
//     entry => entry.role === '導師' && entry.nonverbalData
//   );

//   if (teacherEntries.length === 0) {
//     console.log('沒有找到包含非語言數據的導師回應');
//     return null;
//   }

//   console.log(`找到 ${teacherEntries.length} 筆導師回應包含非語言數據`);

//   // 計算各項指標的總和
//   let totalEyeContact = 0;
//   let totalSmile = 0;
//   let totalOpenPosture = 0;
//   let totalGestures = 0;

//   teacherEntries.forEach(entry => {
//     const data = entry.nonverbalData;
//     totalEyeContact += parseFloat(data.eyeContactRate) || 0;
//     totalSmile += parseFloat(data.smileRate) || 0;
//     totalOpenPosture += parseFloat(data.openPostureRate) || 0;
//     totalGestures += parseInt(data.gesturesUsed) || 0;
//   });

//   const count = teacherEntries.length;

//   const summary = {
//     averageEyeContactRate: parseFloat((totalEyeContact / count).toFixed(1)),
//     averageSmileRate: parseFloat((totalSmile / count).toFixed(1)),
//     averageOpenPostureRate: parseFloat((totalOpenPosture / count).toFixed(1)),
//     totalGesturesUsed: totalGestures,
//     teacherTurnsWithNonverbalData: count,
//     calculatedAt: new Date()
//   };

//   console.log('✅ 非語言摘要計算完成:', summary);

//   return summary;
// }

// // ==================== 練習服務函數 ====================
// /**
//  * 更新指定練習的資料
//  * @param {String} userId 使用者 ID
//  * @param {String} practiceId 練習 ID
//  * @param {Object} updates 要更新的資料
//  * @returns {Object} 更新後的練習物件
//  */
// async function updatePractice(practiceId, updates) {
//   try {
//       console.log('Updating practice with:', { practiceId, updates });

//       const updatesObj = typeof updates === 'string' ? { content: updates } : updates;

//       const user = await User.findOne({ 'practices._id': practiceId });

//       if (!user) {
//           console.error('找不到練習:', practiceId);
//           throw new Error('練習不存在');
//       }

//       const practice = user.practices.id(practiceId);

//       if (!practice) {
//           console.error('練習不存在於用戶文檔中');
//           throw new Error('練習不存在');
//       }

//       // 修改歷史記錄更新方式，防止重複添加
//       if (updatesObj.history) {
//           if (!Array.isArray(practice.history)) {
//               practice.history = [];
//           }
          
//           // 如果選擇直接覆蓋歷史記錄
//           // 方案1: 直接覆蓋 - 如果希望完全替換舊記錄
//           practice.history = updatesObj.history;
          
//           // 方案2: 智能合併 - 如果需要保留之前記錄並添加新記錄
//           // 首先檢查新歷史記錄中是否有項目不在舊記錄中
//           // const existingEntries = new Set(practice.history.map(entry => 
//           //    `${entry.role}:${entry.content.substring(0, 50)}`
//           // ));
          
//           // const newEntries = updatesObj.history.filter(entry => {
//           //    const entryKey = `${entry.role}:${entry.content.substring(0, 50)}`;
//           //    return !existingEntries.has(entryKey);
//           // });
          
//           // practice.history = [...practice.history, ...newEntries];
//       }

//       if (updatesObj.scenario) {
//           practice.scenario = updatesObj.scenario;
//       }
//       if (updatesObj.teacherSuggestion) {
//           practice.teacherSuggestion = updatesObj.teacherSuggestion;
//       }
//       if (updatesObj.analysis) {
//           practice.analysis = updatesObj.analysis;
//       }
//       if (updatesObj.difficulty) {
//           practice.difficulty = updatesObj.difficulty;
//       }
//       if (updatesObj.completed !== undefined) {
//           practice.completed = updatesObj.completed;
//       }

//       // 如果更新包含 history 且對話已完成,計算非語言摘要
//       if (updatesObj.history && updatesObj.completed) {
//           const nonverbalSummary = calculateNonverbalSummary(practice.history);
//           if (nonverbalSummary) {
//               practice.nonverbalSummary = nonverbalSummary;
//               console.log('✅ 非語言摘要已添加到練習中');
//           }
//       }

//       console.log('練習更新前的內容:', practice);
//       await user.save();

//       console.log('練習更新成功');
//       return practice;

//   } catch (error) {
//       console.error('Error updating practice:', error.message || error);
//       throw error;
//   }
// }


// /**
//  * 獲取指定使用者的所有練習
//  * @param {String} userId 使用者 ID
//  * @returns {Array} 使用者的練習陣列
//  */
// async function getPractices(userId) {
//   try {
//     const user = await User.findById(userId).select('practices');
//     if (!user) {
//       throw new Error('使用者不存在');
//     }
//     return user.practices;
//   } catch (error) {
//     console.error('Error fetching practices:', error);
//     throw error;
//   }
// }

// /**
//  * 獲取單一練習詳細資料
//  * @param {String} userId 使用者 ID
//  * @param {String} practiceId 練習 ID
//  * @returns {Object} 指定的練習物件
//  */
// async function getPracticeDetails(userId, practiceId) {
//   try {
//     const user = await User.findById(userId);
//     if (!user) {
//       throw new Error('使用者不存在');
//     }

//     const practice = user.practices.id(practiceId);
//     if (!practice) {
//       throw new Error('練習不存在');
//     }

//     return practice;
//   } catch (error) {
//     console.error('Error fetching practice details:', error);
//     throw error;
//   }
// }

// /**
//  * 新增一個新的練習
//  * @param {String} userId 使用者 ID
//  * @param {Object} newPractice 新的練習資料
//  * @returns {Object} 新增的練習物件
//  */
// // async function createPractice(userId, newPractice) {
// //   try {
// //     const user = await User.findById(userId);
// //     if (!user) {
// //       throw new Error('使用者不存在');
// //     }

// //     const practice = {
// //       _id: new mongoose.Types.ObjectId(),
// //       createdAt: new Date(),
// //       technique: newPractice.technique || '未指定技巧',
// //       difficulty: newPractice.difficulty || '簡單',
// //       history: [],
// //       recordings: [],
// //       analysis: ''
// //     };

// //     user.practices.push(practice);
// //     await user.save();

// //     // 返回完整的練習對象（包含 _id）
// //     return practice;  // 轉換為普通對象

// //   } catch (error) {
// //     console.error('Error creating practice:', error);
// //     throw error;
// //   }
// // }

// //0304修改
// async function createPractice(userId, newPractice) {
//   try {
//     const user = await User.findById(userId);
//     if (!user) {
//       throw new Error('使用者不存在');
//     }

//     const practice = {
//       _id: new mongoose.Types.ObjectId(),
//       createdAt: new Date(),
//       technique: newPractice.technique || '未指定技巧',
//       difficulty: newPractice.difficulty || '簡單',
//       scenario: newPractice.scenario || '',  // 保存情境內容
//       history: [],
//       recordings: [],
//       analysis: '',
//       isRetry: newPractice.isRetry || false,
//       originalPracticeId: newPractice.originalPracticeId || null
//     };

//     user.practices.push(practice);
//     await user.save();

//     // 返回完整的練習對象（包含 _id）
//     return practice;
//   } catch (error) {
//     console.error('Error creating practice:', error);
//     throw error;
//   }
// }

// /**
//  * 刪除指定的練習
//  * @param {String} userId 使用者 ID
//  * @param {String} practiceId 練習 ID
//  * @returns {Boolean} 是否刪除成功
//  */
// async function deletePractice(userId, practiceId) {
//   try {
//     const user = await User.findById(userId);
//     if (!user) {
//       throw new Error('使用者不存在');
//     }

//     const practiceIndex = user.practices.findIndex(p => p._id.toString() === practiceId);
//     if (practiceIndex === -1) {
//       throw new Error('練習不存在');
//     }

//     user.practices.splice(practiceIndex, 1); // 從陣列中移除該練習
//     await user.save(); // 保存變更到資料庫

//     return true;
//   } catch (error) {
//     console.error('Error deleting practice:', error);
//     throw error;
//   }
// }

// // 添加一個新函數來獲取練習和其相關的重新練習記錄
// async function getPracticeWithRetries(userId, practiceId) {
//   try {
//     const user = await User.findById(userId);
//     if (!user) {
//       throw new Error('使用者不存在');
//     }

//     // 獲取原始練習
//     const originalPractice = user.practices.id(practiceId);
//     if (!originalPractice) {
//       throw new Error('練習不存在');
//     }

//     // 查找所有與此練習相關的重試記錄
//     const retryPractices = user.practices.filter(p => 
//       p.originalPracticeId && p.originalPracticeId.toString() === practiceId
//     );

//     return {
//       originalPractice,
//       retryPractices
//     };
//   } catch (error) {
//     console.error('Error fetching practice with retries:', error);
//     throw error;
//   }
// }

// module.exports = {
//   updatePractice,
//   getPractices,
//   getPracticeDetails,
//   createPractice,
//   deletePractice,
//   getPracticeWithRetries,
//   calculateNonverbalSummary
// };

const User = require('../models/User');
const mongoose = require('mongoose');

// ==================== 非語言數據統計工具函數 ====================

/**
 * 計算練習的非語言表現摘要
 * @param {Array} history 對話歷史記錄
 * @returns {Object|null} 非語言表現摘要,如果沒有數據則返回 null
 */
function calculateNonverbalSummary(history) {
  if (!Array.isArray(history) || history.length === 0) {
    console.log('對話歷史為空,無法計算非語言摘要');
    return null;
  }

  // 過濾出有非語言數據的導師回應
  const teacherEntries = history.filter(
    entry => entry.role === '導師' && entry.nonverbalData
  );

  if (teacherEntries.length === 0) {
    console.log('沒有找到包含非語言數據的導師回應');
    return null;
  }

  console.log(`找到 ${teacherEntries.length} 筆導師回應包含非語言數據`);

  // 計算各項指標的總和
  let totalEyeContact = 0;
  let totalSmile = 0;
  let totalOpenPosture = 0;
  let totalGestures = 0;

  teacherEntries.forEach(entry => {
    const data = entry.nonverbalData;
    totalEyeContact += parseFloat(data.eyeContactRate) || 0;
    totalSmile += parseFloat(data.smileRate) || 0;
    totalOpenPosture += parseFloat(data.openPostureRate) || 0;
    totalGestures += parseInt(data.gesturesUsed) || 0;
  });

  const count = teacherEntries.length;

  const summary = {
    averageEyeContactRate: parseFloat((totalEyeContact / count).toFixed(1)),
    averageSmileRate: parseFloat((totalSmile / count).toFixed(1)),
    averageOpenPostureRate: parseFloat((totalOpenPosture / count).toFixed(1)),
    totalGesturesUsed: totalGestures,
    teacherTurnsWithNonverbalData: count,
    calculatedAt: new Date()
  };

  console.log('✅ 非語言摘要計算完成:', summary);

  return summary;
}

// ==================== 練習服務函數 ====================
/**
 * 更新指定練習的資料
 * @param {String} userId 使用者 ID
 * @param {String} practiceId 練習 ID
 * @param {Object} updates 要更新的資料
 * @returns {Object} 更新後的練習物件
 */
async function updatePractice(practiceId, updates) {
  try {
      console.log('Updating practice with:', { practiceId, updates });

      const updatesObj = typeof updates === 'string' ? { content: updates } : updates;

      const user = await User.findOne({ 'practices._id': practiceId });

      if (!user) {
          console.error('找不到練習:', practiceId);
          throw new Error('練習不存在');
      }

      const practice = user.practices.id(practiceId);

      if (!practice) {
          console.error('練習不存在於用戶文檔中');
          throw new Error('練習不存在');
      }

      // 修改歷史記錄更新方式，防止重複添加
      if (updatesObj.history) {
          if (!Array.isArray(practice.history)) {
              practice.history = [];
          }
          
          // 如果選擇直接覆蓋歷史記錄
          // 方案1: 直接覆蓋 - 如果希望完全替換舊記錄
          practice.history = updatesObj.history;
          
          // 方案2: 智能合併 - 如果需要保留之前記錄並添加新記錄
          // 首先檢查新歷史記錄中是否有項目不在舊記錄中
          // const existingEntries = new Set(practice.history.map(entry => 
          //    `${entry.role}:${entry.content.substring(0, 50)}`
          // ));
          
          // const newEntries = updatesObj.history.filter(entry => {
          //    const entryKey = `${entry.role}:${entry.content.substring(0, 50)}`;
          //    return !existingEntries.has(entryKey);
          // });
          
          // practice.history = [...practice.history, ...newEntries];
      }

      if (updatesObj.scenario) {
          practice.scenario = updatesObj.scenario;
      }
      if (updatesObj.teacherSuggestion) {
          practice.teacherSuggestion = updatesObj.teacherSuggestion;
      }
      if (updatesObj.analysis) {
          practice.analysis = updatesObj.analysis;
      }
      if (updatesObj.difficulty) {
          practice.difficulty = updatesObj.difficulty;
      }

      // 如果更新包含 history 且對話已完成(有 analysis)，計算非語言摘要
      if (updatesObj.history && practice.analysis && practice.analysis.trim() !== '') {
          const nonverbalSummary = calculateNonverbalSummary(practice.history);
          if (nonverbalSummary) {
              practice.nonverbalSummary = nonverbalSummary;
              console.log('✅ 非語言摘要已添加到練習中');
          }
      }

      console.log('練習更新前的內容:', practice);
      await user.save();

      console.log('練習更新成功');
      return practice;

  } catch (error) {
      console.error('Error updating practice:', error.message || error);
      throw error;
  }
}


/**
 * 獲取指定使用者的所有練習
 * @param {String} userId 使用者 ID
 * @returns {Array} 使用者的練習陣列
 */
async function getPractices(userId) {
  try {
    const user = await User.findById(userId).select('practices');
    if (!user) {
      throw new Error('使用者不存在');
    }
    return user.practices;
  } catch (error) {
    console.error('Error fetching practices:', error);
    throw error;
  }
}

/**
 * 獲取單一練習詳細資料
 * @param {String} userId 使用者 ID
 * @param {String} practiceId 練習 ID
 * @returns {Object} 指定的練習物件
 */
async function getPracticeDetails(userId, practiceId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('使用者不存在');
    }

    const practice = user.practices.id(practiceId);
    if (!practice) {
      throw new Error('練習不存在');
    }

    return practice;
  } catch (error) {
    console.error('Error fetching practice details:', error);
    throw error;
  }
}

/**
 * 新增一個新的練習
 * @param {String} userId 使用者 ID
 * @param {Object} newPractice 新的練習資料
 * @returns {Object} 新增的練習物件
 */
// async function createPractice(userId, newPractice) {
//   try {
//     const user = await User.findById(userId);
//     if (!user) {
//       throw new Error('使用者不存在');
//     }

//     const practice = {
//       _id: new mongoose.Types.ObjectId(),
//       createdAt: new Date(),
//       technique: newPractice.technique || '未指定技巧',
//       difficulty: newPractice.difficulty || '簡單',
//       history: [],
//       recordings: [],
//       analysis: ''
//     };

//     user.practices.push(practice);
//     await user.save();

//     // 返回完整的練習對象（包含 _id）
//     return practice;  // 轉換為普通對象

//   } catch (error) {
//     console.error('Error creating practice:', error);
//     throw error;
//   }
// }

//0304修改
async function createPractice(userId, newPractice) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('使用者不存在');
    }

    // 自動清除超過 24 小時且沒有 analysis 的練習（殭屍資料預防）
    // 有 analysis 的練習表示已完成，不會被刪除
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    user.practices = user.practices.filter(p => 
      !(p.createdAt < oneDayAgo && !p.analysis)
    );

    const practice = {
      _id: new mongoose.Types.ObjectId(),
      createdAt: new Date(),
      technique: newPractice.technique || '未指定技巧',
      difficulty: newPractice.difficulty || '簡單',
      scenario: newPractice.scenario || '',  // 保存情境內容
      history: [],
      recordings: [],
      analysis: '',  // 空字串表示尚未完成，有內容表示已完成
      isRetry: newPractice.isRetry || false,
      originalPracticeId: newPractice.originalPracticeId || null
    };

    user.practices.push(practice);
    await user.save();

    // 返回完整的練習對象（包含 _id）
    return practice;
  } catch (error) {
    console.error('Error creating practice:', error);
    throw error;
  }
}

/**
 * 刪除指定的練習
 * @param {String} userId 使用者 ID
 * @param {String} practiceId 練習 ID
 * @returns {Boolean} 是否刪除成功
 */
async function deletePractice(userId, practiceId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('使用者不存在');
    }

    const practiceIndex = user.practices.findIndex(p => p._id.toString() === practiceId);
    if (practiceIndex === -1) {
      throw new Error('練習不存在');
    }

    const practice = user.practices[practiceIndex];

    user.practices.splice(practiceIndex, 1); // 從陣列中移除該練習
    await user.save(); // 保存變更到資料庫

    return true;
  } catch (error) {
    console.error('Error deleting practice:', error);
    throw error;
  }
}

// 添加一個新函數來獲取練習和其相關的重新練習記錄
async function getPracticeWithRetries(userId, practiceId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('使用者不存在');
    }

    // 獲取原始練習
    const originalPractice = user.practices.id(practiceId);
    if (!originalPractice) {
      throw new Error('練習不存在');
    }

    // 查找所有與此練習相關的重試記錄
    const retryPractices = user.practices.filter(p => 
      p.originalPracticeId && p.originalPracticeId.toString() === practiceId
    );

    return {
      originalPractice,
      retryPractices
    };
  } catch (error) {
    console.error('Error fetching practice with retries:', error);
    throw error;
  }
}

module.exports = {
  updatePractice,
  getPractices,
  getPracticeDetails,
  createPractice,
  deletePractice,
  getPracticeWithRetries,
  calculateNonverbalSummary
};