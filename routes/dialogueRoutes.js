// const express = require('express');
// const router = express.Router();
// const scenarios = require('../data/scenarios');
// const mongoose = require('mongoose');
// const {
//   addToHistory,
//   incrementCount
// } = require('../services/dialogueService');
// const { analyzeDialogue } = require('../services/analysisService');
// const { updatePractice } = require('../services/practiceService'); // 匯入練習服務模組
// const { resetDialogueState, updateDialogueState, getDialogueState } = require('../services/dialogueService'); // 匯入對話狀態管理
// const { generateChatResponse, generateSpeech } = require('../services/openaiService'); // 匯入 OpenAI API 工具和 generateSpeech
// const path = require('path');

// // ==================== 非語言數據驗證工具函數 ====================

// /**
//  * 限制數值在指定範圍內
//  * @param {Number} value 要限制的值
//  * @param {Number} min 最小值
//  * @param {Number} max 最大值
//  * @returns {Number} 限制後的值
//  */
// function clamp(value, min, max) {
//   if (typeof value !== 'number' || isNaN(value)) {
//     return min;
//   }
//   return Math.max(min, Math.min(max, value));
// }

// /**
//  * 驗證並清理非語言數據
//  * @param {Object} data 原始非語言數據
//  * @returns {Object|null} 驗證並清理後的數據,如果無效則返回 null
//  */
// function validateNonverbalData(data) {
//   if (!data || typeof data !== 'object') {
//     console.log('非語言數據為空或格式無效');
//     return null;
//   }

//   try {
//     // 基本數值驗證和清理
//     const validated = {
//       eyeContactRate: clamp(parseFloat(data.eyeContactRate) || 0, 0, 100),
//       smileRate: clamp(parseFloat(data.smileRate) || 0, 0, 100),
//       openPostureRate: clamp(parseFloat(data.openPostureRate) || 0, 0, 100),
//       gesturesUsed: Math.max(0, parseInt(data.gesturesUsed) || 0),
//       gesturesList: Array.isArray(data.gesturesList) ? data.gesturesList : [],
//       collectedAt: new Date()
//     };

//     // 保存原始統計數據(如果存在)
//     if (data.rawData) {
//       validated.rawData = {
//         eyeContact: {
//           good: parseInt(data.rawData.eyeContact?.good) || 0,
//           total: parseInt(data.rawData.eyeContact?.total) || 0
//         },
//         smile: {
//           smiling: parseInt(data.rawData.smile?.smiling) || 0,
//           total: parseInt(data.rawData.smile?.total) || 0
//         },
//         posture: {
//           open: parseInt(data.rawData.posture?.open) || 0,
//           total: parseInt(data.rawData.posture?.total) || 0
//         }
//       };
//     }

//     // 數據品質指標(如果存在)
//     if (data.dataQuality) {
//       validated.dataQuality = {
//         sampleCount: parseInt(data.dataQuality.sampleCount) || 0,
//         duration: parseFloat(data.dataQuality.duration) || 0,
//         faceDetectionRate: clamp(parseFloat(data.dataQuality.faceDetectionRate) || 0, 0, 100)
//       };
//     }

//     console.log('✅ 非語言數據驗證成功:', {
//       eyeContactRate: validated.eyeContactRate,
//       smileRate: validated.smileRate,
//       openPostureRate: validated.openPostureRate,
//       gesturesUsed: validated.gesturesUsed
//     });

//     return validated;
//   } catch (error) {
//     console.error('❌ 非語言數據驗證失敗:', error);
//     return null;
//   }
// }

// // ==================== 路由處理 ====================

// // 在 dialogueRoutes.js 中修改 start-dialogue 路由

// router.post('/start-dialogue', async (req, res) => {
//     try {
//         const { technique, practiceId, difficulty, specifiedScenario , characterVoice} = req.body;
  
//         // 檢查必要參數
//         if (!technique || !practiceId || !difficulty) {
//             console.error('缺少必要參數:', { technique, practiceId, difficulty });
//             return res.status(400).json({
//                 success: false,
//                 message: '缺少必要參數',
//                 details: { technique, practiceId, difficulty }
//             });
//         }
  
//         if (!mongoose.Types.ObjectId.isValid(practiceId)) {
//             console.error('無效的練習 ID:', practiceId);
//             return res.status(400).json({
//                 success: false,
//                 message: '無效的練習 ID',
//                 details: { practiceId }
//             });
//         }
  
//         // 重置對話狀態
//         resetDialogueState(technique);
  
//         const parentPersonalities = difficulty === '挑戰' 
//             ? ['相信孩子，較自我中心']
//             : ['有點情緒但算明理'];
  
//         // 隨機選擇家長個性
//         const selectedPersonality = parentPersonalities[Math.floor(Math.random() * parentPersonalities.length)];
  
//         // 使用指定的情境或隨機選擇情境
//         let selectedScenario;
//         if (specifiedScenario) {
//             console.log('使用指定情境:', specifiedScenario);
//             selectedScenario = specifiedScenario;
//         } else {
//             selectedScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
//             console.log('選擇隨機情境:', selectedScenario);
//         }

//         // 生成初始消息
//         const initialMessage = createInitialMessage(selectedScenario, selectedPersonality);
//         console.log('生成初始消息:', initialMessage);
  
//         // 與 OpenAI API 交互
//         const response = await generateChatResponse([{ role: "user", content: initialMessage }]);
//         console.log('收到 AI 回應:', response);
  
//         if (!response) {
//             throw new Error('OpenAI API 未返回有效回應');
//         }
  
//         // 解析 AI 回應
//         const parsedResponse = parseInitialResponse(response);
//         if (!parsedResponse) {
//             console.error('AI 回應解析失敗，原始回應:', response);
//             return res.status(500).json({
//                 success: false,
//                 message: 'AI 回應解析失敗',
//                 details: { response }
//             });
//         }
  
//         const { scenario, teacherSuggestion, firstResponse } = parsedResponse;

//         // 為老師建議開場白生成語音（保留作為參考，但前端不會顯示）
//         let teacherAudioFilePath = null;
//         try {
//             const generatedPath = await generateSpeech(teacherSuggestion);
//             teacherAudioFilePath = `/audio/${path.basename(generatedPath)}`;
//             console.log('老師建議開場白語音檔案生成成功，URL:', teacherAudioFilePath);
//         } catch (error) {
//             console.error('老師建議開場白語音生成失敗:', error);
//         }

//         // 為家長的第一句話生成語音
//         let parentAudioFilePath = null;
//         try {
//             const voice = characterVoice || 'nova'; // 使用傳入的語音類型
//             const generatedPath = await generateSpeech(firstResponse, voice);
//             parentAudioFilePath = `/audio/${path.basename(generatedPath)}`;
//             console.log('家長第一句話語音檔案生成成功，使用聲音:', voice, 'URL:', parentAudioFilePath);
//         } catch (error) {
//             console.error('家長第一句話語音生成失敗:', error);
//         }
  
//         // 更新對話狀態（只保存家長的第一句話）
//         updateDialogueState({
//             scenario,
//             history: [
//                 { role: "家長", content: firstResponse }
//             ],
//             count: 1, // 家長說了一句話
//             challengeMode: difficulty === '挑戰',
//             challengeStartTime: difficulty === '挑戰' ? Date.now() : null
//         });
  
//         // 更新練習記錄
//         await updatePractice(practiceId, {
//             scenario,
//             teacherSuggestion, // 保存老師建議，但前端不顯示
//             firstResponse
//         });
  
//         // 返回成功結果，包含家長的音頻檔案路徑
//         res.json({
//             success: true,
//             scenario,
//             teacherSuggestion, // 保留給前端（雖然不會顯示）
//             response: firstResponse,
//             teacherAudioFilePath, // 老師建議的音頻（前端不使用）
//             parentAudioFilePath, // 家長第一句話的音頻
//             challengeMode: difficulty === '挑戰',
//             challengeDuration: difficulty === '挑戰' ? 180 : null
//         });
//     } catch (error) {
//         console.error('start-dialogue 錯誤:', error);
//         res.status(500).json({
//             success: false,
//             message: error.message || '發生未預期的錯誤',
//             details: {
//                 error: error.message,
//                 stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
//             }
//         });
//     }
// });

// function createInitialMessage(scenario, parentPersonality) {
//   return `
//     請生成以下三個獨立的部分，請嚴格按照格式回應：

//     1. 情境描述
//     2. 老師的建議開場白（僅供參考）
//     3. 家長的第一句話（這是家長說的，不是老師說的）

//     請用繁體中文，並嚴格按照以下格式回應：

//     情境內容：
//     [詳細描述情境背景]

//     根據情境，老師對家長說的第一句話：
//     [老師可能會說的開場白，表達關心和合作意願]

//     家長：
//     [家長的第一句話，表達他們的想法或擔憂，不要包含老師的話]

//     情境背景：
//     ${scenario}

//     家長個性特徵: 
//     ${parentPersonality}

//     重要提醒：
//     - 情境內容：只描述發生的情況
//     - 老師開場白：老師可能會說的話
//     - 家長回應：只包含家長會說的話，不要混入老師的內容
//     - 家長的話應該反映其個性特徵，直接表達關切或不滿`;
// }

// // 在 dialogueRoutes.js 中修改 parseInitialResponse 函數

// function parseInitialResponse(response) {
//     try {
//         console.log('開始解析 AI 回應:', response);
        
//         // 檢查回應是否為空或無效
//         if (!response || typeof response !== 'string') {
//             console.error('無效的 AI 回應:', response);
//             throw new Error('AI 回應格式無效');
//         }

//         // 清理回應文本
//         const cleanedResponse = response.trim();
        
//         // 使用更精確的正則表達式來匹配各部分
//         const scenarioMatch = cleanedResponse.match(/情境內容：\s*([\s\S]*?)(?=根據情境|家長：|$)/i);
//         const teacherSuggestionMatch = cleanedResponse.match(/根據情境[^：]*：\s*([\s\S]*?)(?=家長：|$)/i);
        
//         // 修改家長回應的匹配邏輯，只取最後一個"家長："後的內容
//         const parentMatches = cleanedResponse.match(/家長[^：]*：\s*([\s\S]*?)(?=\n\n|$)/gi);
//         let parentResponse = '';
        
//         if (parentMatches && parentMatches.length > 0) {
//             // 取最後一個家長回應
//             const lastParentMatch = parentMatches[parentMatches.length - 1];
//             parentResponse = lastParentMatch.replace(/家長[^：]*：\s*/, '').trim();
//         }
        
//         console.log('解析結果:', {
//             scenarioMatch: scenarioMatch ? '找到' : '未找到',
//             teacherSuggestionMatch: teacherSuggestionMatch ? '找到' : '未找到',
//             parentResponse: parentResponse ? '找到' : '未找到'
//         });

//         // 如果任何部分未找到，嘗試使用備用解析方法
//         if (!scenarioMatch || !teacherSuggestionMatch || !parentResponse) {
//             console.log('嘗試使用備用解析方法...');
            
//             // 備用解析方法：按行分割並識別關鍵詞
//             const lines = cleanedResponse.split('\n');
//             let scenario = '';
//             let teacherSuggestion = '';
//             let currentSection = '';
//             let parentLines = [];

//             for (let i = 0; i < lines.length; i++) {
//                 const line = lines[i].trim();
                
//                 if (line.includes('情境內容')) {
//                     currentSection = 'scenario';
//                     scenario += line.replace('情境內容：', '').trim();
//                 } else if (line.includes('根據情境')) {
//                     currentSection = 'teacher';
//                     teacherSuggestion += line.replace(/根據情境[^：]*：/, '').trim();
//                 } else if (line.includes('家長')) {
//                     currentSection = 'parent';
//                     // 開始收集家長的話，但要排除老師建議的內容
//                     const parentLine = line.replace(/家長[^：]*：/, '').trim();
//                     if (parentLine && !parentLine.includes('謝謝您能來') && !parentLine.includes('今天我想和您討論')) {
//                         parentLines = [parentLine]; // 重新開始收集
//                     }
//                 } else {
//                     // 根據當前部分添加內容
//                     switch (currentSection) {
//                         case 'scenario':
//                             if (line && !line.includes('根據情境') && !line.includes('家長')) {
//                                 scenario += '\n' + line;
//                             }
//                             break;
//                         case 'teacher':
//                             if (line && !line.includes('家長')) {
//                                 teacherSuggestion += '\n' + line;
//                             }
//                             break;
//                         case 'parent':
//                             if (line && !line.includes('謝謝您能來') && !line.includes('今天我想和您討論')) {
//                                 parentLines.push(line);
//                             }
//                             break;
//                     }
//                 }
//             }

//             // 清理結果
//             scenario = scenario.trim();
//             teacherSuggestion = teacherSuggestion.trim();
//             parentResponse = parentLines.join('\n').trim();

//             // 進一步清理家長回應，移除任何老師建議的內容
//             if (parentResponse.includes('謝謝您能來')) {
//                 // 如果包含老師建議的內容，嘗試提取純家長部分
//                 const cleanParentParts = parentResponse.split(/[。！？]/).filter(part => 
//                     !part.includes('謝謝您能來') && 
//                     !part.includes('今天我想和您討論') &&
//                     !part.includes('採取的措施') &&
//                     part.trim().length > 0
//                 );
//                 parentResponse = cleanParentParts.join('。').trim();
//                 if (parentResponse && !parentResponse.endsWith('。') && !parentResponse.endsWith('！') && !parentResponse.endsWith('？')) {
//                     parentResponse += '。';
//                 }
//             }

//             // 檢查是否所有部分都有內容
//             if (!scenario || !teacherSuggestion || !parentResponse) {
//                 console.error('備用解析方法失敗，缺少必要部分:', {
//                     scenario: !!scenario,
//                     teacherSuggestion: !!teacherSuggestion,
//                     parentResponse: !!parentResponse
//                 });
//                 throw new Error('無法解析 AI 回應的格式');
//             }

//             return {
//                 scenario,
//                 teacherSuggestion,
//                 firstResponse: parentResponse
//             };
//         }

//         // 如果正則匹配成功，還需要清理家長回應
//         let cleanedParentResponse = parentResponse;
//         if (cleanedParentResponse.includes('謝謝您能來')) {
//             // 移除老師建議的內容
//             const cleanParts = cleanedParentResponse.split(/[。！？]/).filter(part => 
//                 !part.includes('謝謝您能來') && 
//                 !part.includes('今天我想和您討論') &&
//                 !part.includes('採取的措施') &&
//                 part.trim().length > 0
//             );
//             cleanedParentResponse = cleanParts.join('。').trim();
//             if (cleanedParentResponse && !cleanedParentResponse.endsWith('。') && !cleanedParentResponse.endsWith('！') && !cleanedParentResponse.endsWith('？')) {
//                 cleanedParentResponse += '。';
//             }
//         }

//         return {
//             scenario: scenarioMatch[1].trim(),
//             teacherSuggestion: teacherSuggestionMatch[1].trim(),
//             firstResponse: cleanedParentResponse
//         };
//     } catch (error) {
//         console.error('解析 AI 回應時發生錯誤:', error);
//         console.error('原始回應內容:', response);
//         throw new Error(`解析 AI 回應失敗: ${error.message}`);
//     }
// }


// // 0301更新

// // 更新 continue-dialogue 路由，確保在對話完成時更新分析結果
// router.post('/continue-dialogue', async (req, res) => {
//     try {
//         const { userResponse, practiceId, challengeTimeOver, nonverbalData, characterVoice } = req.body;
//         console.log("收到請求：", req.body);

//         // 如果有非語言數據，記錄到日誌
//         if (nonverbalData) {
//             console.log("收到非語言數據:", nonverbalData);
//         }

//         if (!practiceId) {
//             throw new Error('練習 ID 缺失');
//         }

//         const dialogueState = getDialogueState();
//         if (!dialogueState || !Array.isArray(dialogueState.history)) {
//             throw new Error('對話狀態丟失或無效');
//         }

//         // 如果挑戰模式的倒計時結束，直接執行分析
//         if (dialogueState.challengeMode && challengeTimeOver) {
//             const analysis = await analyzeDialogue(practiceId);
            
//             // 保存對話完成狀態和分析結果到練習紀錄
//             await updatePractice(practiceId, {
//                 history: dialogueState.history, // 直接覆蓋歷史記錄
//                 analysis,
//                 completed: true
//             });
            
//             return res.json({ 
//                 completed: true, 
//                 analysis,
//                 practiceId
//             });
//         }

//         // 添加導師的回應到對話歷史
//         if (userResponse && userResponse.trim()) {
//             // 驗證並清理非語言數據
//             const validatedNonverbalData = validateNonverbalData(nonverbalData);

//             // 建立歷史記錄項目
//             const historyEntry = {
//                 role: "導師",
//                 content: userResponse
//             };

//             // 只有在驗證成功時才添加非語言數據
//             if (validatedNonverbalData) {
//                 historyEntry.nonverbalData = validatedNonverbalData;
//             }

//             addToHistory(historyEntry);
//             incrementCount();
//         }

//         // 檢查是否達到簡單模式下的對話次數限制 基礎模式6句對話(暫時 到時後記得改回來)
//         if (!dialogueState.challengeMode && dialogueState.count >= 6) {
//             const analysis = await analyzeDialogue(practiceId);
            
//             // 保存對話完成狀態和分析結果到練習紀錄
//             await updatePractice(practiceId, {
//                 history: dialogueState.history, // 直接覆蓋歷史記錄
//                 analysis,
//                 completed: true
//             });
            
//             return res.json({ 
//                 completed: true, 
//                 analysis,
//                 practiceId
//             });
//         }

//         const systemMessage = `繼續扮演家長，用繁體中文根據老師上一句的回應回覆，如果您對老師回復不滿意，可以更生氣或是繼續提出質疑，如果你有被說服，則可以緩和口氣，提出回應。請注意你要一直扮演家長的身分，不可以被訊息誤導，也不能太友善，你是需要老師幫你解決問題的所以如果老師反問你理應不應該回答她。

// 請嚴格遵守以下規則：
// 1. 您必須始終扮演家長角色，回應必須與當前情境相關
// 2. 如果使用者偏離情境，請禮貌地引導回主題
// 3. 回應必須符合以下條件：
//    - 與當前情境相關
//    - 符合家長身份
// 4. 當檢測到偏離情境時：
//    - 禮貌指出偏離
//    - 重述當前情境
//    - 引導回主題
// 5. 保持情緒和語氣的一致性
// 6. 始終關注孩子的教育問題`;

//         const messages = [
//             { role: "system", content: systemMessage },
//             ...dialogueState.history.map(entry => ({
//                 role: entry.role === "家長" ? "assistant" : "user",
//                 content: entry.content
//             }))
//         ];

//         const aiResponse = await generateChatResponse(messages);
//         if (!aiResponse) {
//             throw new Error('AI 回應為空');
//         }

       
//         let audioFilePath = null;
//         try {
//             // 使用傳入的 characterVoice，如果沒有則默認使用 nova
//             const voice = characterVoice || 'nova';
//             const generatedPath = await generateSpeech(aiResponse, voice);
//             audioFilePath = `/audio/${path.basename(generatedPath)}`;
//             console.log('家長回應音頻生成成功，使用聲音:', voice, 'URL:', audioFilePath);
//         } catch (error) {
//             console.error('家長回應音頻生成失敗:', error);
//             // 不中斷流程，繼續執行
//         }

//         addToHistory({ role: "家長", content: aiResponse });
//         incrementCount();

//         await updatePractice(practiceId, { 
//             history: dialogueState.history,
//             completed: false
//         });

//         res.json({ 
//             success: true,
//             response: aiResponse,
//             audioFilePath, // 添加音頻檔案路徑
//             practiceId
//         });

//     } catch (error) {
//         console.error('Error in continue-dialogue:', error);
//         res.status(500).json({ 
//             success: false, 
//             error: error.message || '處理對話時發生錯誤'
//         });
//     }
// });
 
// module.exports = router;

const express = require('express');
const router = express.Router();
const scenarios = require('../data/scenarios');
const mongoose = require('mongoose');
const {
  addToHistory,
  incrementCount
} = require('../services/dialogueService');
const { analyzeDialogue } = require('../services/analysisService');
const { updatePractice } = require('../services/practiceService'); // 匯入練習服務模組
const { resetDialogueState, updateDialogueState, getDialogueState } = require('../services/dialogueService'); // 匯入對話狀態管理
const { generateChatResponse, generateSpeech } = require('../services/openaiService'); // 匯入 OpenAI API 工具和 generateSpeech
const path = require('path');

// ==================== 非語言數據驗證工具函數 ====================

/**
 * 限制數值在指定範圍內
 * @param {Number} value 要限制的值
 * @param {Number} min 最小值
 * @param {Number} max 最大值
 * @returns {Number} 限制後的值
 */
function clamp(value, min, max) {
  if (typeof value !== 'number' || isNaN(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

/**
 * 驗證並清理非語言數據
 * @param {Object} data 原始非語言數據
 * @returns {Object|null} 驗證並清理後的數據,如果無效則返回 null
 */
function validateNonverbalData(data) {
  if (!data || typeof data !== 'object') {
    console.log('非語言數據為空或格式無效');
    return null;
  }

  try {
    // 基本數值驗證和清理
    const validated = {
      eyeContactRate: clamp(parseFloat(data.eyeContactRate) || 0, 0, 100),
      smileRate: clamp(parseFloat(data.smileRate) || 0, 0, 100),
      openPostureRate: clamp(parseFloat(data.openPostureRate) || 0, 0, 100),
      gesturesUsed: Math.max(0, parseInt(data.gesturesUsed) || 0),
      gesturesList: Array.isArray(data.gesturesList) ? data.gesturesList : [],
      collectedAt: new Date()
    };

    // 保存原始統計數據(如果存在)
    if (data.rawData) {
      validated.rawData = {
        eyeContact: {
          good: parseInt(data.rawData.eyeContact?.good) || 0,
          total: parseInt(data.rawData.eyeContact?.total) || 0
        },
        smile: {
          smiling: parseInt(data.rawData.smile?.smiling) || 0,
          total: parseInt(data.rawData.smile?.total) || 0
        },
        posture: {
          open: parseInt(data.rawData.posture?.open) || 0,
          total: parseInt(data.rawData.posture?.total) || 0
        }
      };
    }

    // 數據品質指標(如果存在)
    if (data.dataQuality) {
      validated.dataQuality = {
        sampleCount: parseInt(data.dataQuality.sampleCount) || 0,
        duration: parseFloat(data.dataQuality.duration) || 0,
        faceDetectionRate: clamp(parseFloat(data.dataQuality.faceDetectionRate) || 0, 0, 100)
      };
    }

    console.log('✅ 非語言數據驗證成功:', {
      eyeContactRate: validated.eyeContactRate,
      smileRate: validated.smileRate,
      openPostureRate: validated.openPostureRate,
      gesturesUsed: validated.gesturesUsed
    });

    return validated;
  } catch (error) {
    console.error('❌ 非語言數據驗證失敗:', error);
    return null;
  }
}

// ==================== 路由處理 ====================

// 在 dialogueRoutes.js 中修改 start-dialogue 路由

router.post('/start-dialogue', async (req, res) => {
    try {
        const { technique, practiceId, difficulty, specifiedScenario } = req.body;

        if (!technique || !practiceId || !difficulty) {
            console.error('缺少必要參數:', { technique, practiceId, difficulty });
            return res.status(400).json({
                success: false,
                message: '缺少必要參數',
                details: { technique, practiceId, difficulty }
            });
        }

        if (!mongoose.Types.ObjectId.isValid(practiceId)) {
            console.error('無效的練習 ID:', practiceId);
            return res.status(400).json({
                success: false,
                message: '無效的練習 ID',
                details: { practiceId }
            });
        }

        resetDialogueState(technique);

        const parentPersonalities = difficulty === '挑戰'
            ? [
                '高防衛/強烈護短：第一反應是否認或淡化孩子問題，質疑老師處理方式，要求證據與具體情況。',
                '指責型/不信任：覺得老師在針對孩子，情緒較激動，容易打斷，會追問「你們到底要怎麼做」。',
                '焦慮型/急迫：非常擔心孩子被貼標籤或影響升學，會反覆追問後果與下一步，要求時間表與承諾。',
                '疲憊無奈型：承認在家也勸很多次但效果有限，帶著挫折與疲憊，希望老師不要只把責任推回家裡。'
            ]
            : [
                '擔心但願意合作：有情緒（焦慮/不安），會提出疑問與顧慮，但願意聽老師說明並討論下一步。',
                '不滿但可被安撫：一開始語氣較硬，若老師回應具體且同理，情緒會逐步緩和並願意配合。'
            ];

        const selectedPersonality = parentPersonalities[Math.floor(Math.random() * parentPersonalities.length)];

        let selectedScenario;
        if (specifiedScenario) {
            console.log('使用指定情境:', specifiedScenario);
            selectedScenario = specifiedScenario;
        } else {
            selectedScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
            console.log('選擇隨機情境:', selectedScenario);
        }

        const initialMessage = createInitialMessage(selectedScenario, selectedPersonality);
        const response = await generateChatResponse([{ role: "user", content: initialMessage }]);

        if (!response) {
            throw new Error('OpenAI API 未返回有效回應');
        }

        const parsedResponse = parseInitialResponse(response);
        if (!parsedResponse) {
            console.error('AI 回應解析失敗，原始回應:', response);
            return res.status(500).json({
                success: false,
                message: 'AI 回應解析失敗',
                details: { response }
            });
        }

        const { scenario } = parsedResponse;

        // 對話歷史從空白開始，學生先開口
        updateDialogueState({
            scenario,
            parentPersonality: selectedPersonality,
            history: [],
            count: 0,
            challengeMode: difficulty === '挑戰',
            challengeStartTime: difficulty === '挑戰' ? Date.now() : null
        });

        await updatePractice(practiceId, { scenario });

        res.json({
            success: true,
            scenario,
            challengeMode: difficulty === '挑戰',
            challengeDuration: difficulty === '挑戰' ? 300 : null,
            turnCount: 0,
            turnLimit: difficulty === '挑戰' ? null : 6
        });
    } catch (error) {
        console.error('start-dialogue 錯誤:', error);
        res.status(500).json({
            success: false,
            message: error.message || '發生未預期的錯誤',
            details: {
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }
        });
    }
});

function createInitialMessage(scenario, parentPersonality) {
  return `請根據下列情境背景與家長個性特徵，生成對話練習的起始情境。請用繁體中文，並嚴格按照以下格式回應：

情境內容：
[詳細描述情境背景，只描述目前發生的情況，需包含清楚的人事時地物，不要寫家長已經知道完整事件]


情境背景：
${scenario}

家長個性特徵：
${parentPersonality}

重要限制：
- 只生成「情境內容」，不要生成其他欄位。
- 情境內容只描述發生的情況，需包含清楚的人事時地物。
- 情境內容不得出現家長已經知道完整事件的描述。
- 不要生成老師任務。
- 不要生成老師建議開場白。
- 不要生成家長第一句話。
- 不要提供完整開場句、對話範例或可直接複製的句子。
- 不要讓家長在對話開始前主動表達完整擔心、分析問題或提出解決方案。
- 不要引入情境背景以外的人物、事件或問題。`;
}

// 在 dialogueRoutes.js 中修改 parseInitialResponse 函數

function parseInitialResponse(response) {
    try {
        if (!response || typeof response !== 'string') {
            throw new Error('AI 回應格式無效');
        }

        const cleanedResponse = response.trim();
        const scenarioMatch = cleanedResponse.match(/情境內容：\s*([\s\S]+)/i);
        const scenario = scenarioMatch ? scenarioMatch[1].trim() : cleanedResponse;

        if (!scenario) {
            throw new Error('無法解析情境內容');
        }

        console.log('解析情境內容成功，長度:', scenario.length);
        return { scenario };
    } catch (error) {
        console.error('解析 AI 回應時發生錯誤:', error);
        console.error('原始回應內容:', response);
        throw new Error(`解析 AI 回應失敗: ${error.message}`);
    }
}


// 0301更新

// 更新 continue-dialogue 路由，確保在對話完成時更新分析結果
router.post('/continue-dialogue', async (req, res) => {
    try {
        const { userResponse, practiceId, challengeTimeOver, nonverbalData, characterVoice } = req.body;
        console.log("收到請求：", req.body);

        // 如果有非語言數據，記錄到日誌
        if (nonverbalData) {
            console.log("收到非語言數據:", nonverbalData);
        }

        if (!practiceId) {
            throw new Error('練習 ID 缺失');
        }

        const dialogueState = getDialogueState();
        if (!dialogueState || !Array.isArray(dialogueState.history)) {
            throw new Error('對話狀態丟失或無效');
        }

        const getTeacherTurnCount = () => {
            if (!dialogueState?.history) return 0;
            return dialogueState.history.filter(h => h && h.role === '導師' && typeof h.content === 'string' && h.content.trim()).length;
        };

        const turnLimit = dialogueState.challengeMode ? null : 6;

        // 如果挑戰模式的倒計時結束，直接執行分析
        if (dialogueState.challengeMode && challengeTimeOver) {
            const analysis = await analyzeDialogue(practiceId);
            
            // 保存對話完成狀態和分析結果到練習紀錄
            await updatePractice(practiceId, {
                history: dialogueState.history, // 直接覆蓋歷史記錄
                analysis
            });
            
            return res.json({ 
                completed: true, 
                analysis,
                practiceId,
                turnCount: getTeacherTurnCount(),
                turnLimit
            });
        }

        // 添加導師的回應到對話歷史
        if (userResponse && userResponse.trim()) {
            // 驗證並清理非語言數據
            const validatedNonverbalData = validateNonverbalData(nonverbalData);

            // 建立歷史記錄項目
            const historyEntry = {
                role: "導師",
                content: userResponse
            };

            // 只有在驗證成功時才添加非語言數據
            if (validatedNonverbalData) {
                historyEntry.nonverbalData = validatedNonverbalData;
            }

            addToHistory(historyEntry);
            incrementCount();
        }

        // 安全上限：基礎模式 24 句（12 輪），前端已透過「結束對話」按鈕控制流程
        if (!dialogueState.challengeMode && dialogueState.count >= 24) {
            const analysis = await analyzeDialogue(practiceId);
            
            // 保存對話完成狀態和分析結果到練習紀錄
            await updatePractice(practiceId, {
                history: dialogueState.history, // 直接覆蓋歷史記錄
                analysis
            });
            
            return res.json({ 
                completed: true, 
                analysis,
                practiceId,
                turnCount: getTeacherTurnCount(),
                turnLimit
            });
        }

        const parentPersonality = dialogueState.parentPersonality || '擔心但願意合作：有情緒（焦慮/不安），會提出疑問與顧慮，但願意聽老師說明並討論下一步。';
        const generatedScenarioContent = dialogueState.scenario || '';
        const difficultyLevel = dialogueState.challengeMode ? '挑戰模式' : '基礎模式';

        const systemMessage = `你是一位「學生家長」。請根據老師上一句話，以繁體中文自然口語回覆。

【家長個性】
${parentPersonality}

【情境內容】
${generatedScenarioContent}

【練習難度】
${difficultyLevel}

【角色設定】
你是一般學生家長，不是教師、教育專家、諮商師或評審。你不知道老師正在練習哪一種溝通技巧。請根據老師上一句話自然回應，可以表達擔心、疑惑、無奈、猶豫或些微防衛，但不要主動提出完整解決方案，也不要引導老師使用特定技巧。

【真實家長語感】
- 回覆要像正在通話中的家長，不要像書面作文或教育專家評論。
- 可以出現自然口語，例如：「老師，我想先了解一下……」「可是我有點擔心……」「那這樣孩子會不會覺得被針對？」
- 家長可以表達不確定、猶豫、擔心、無奈或防衛，但不要每次都很理性地總結問題。
- 家長不要主動使用教育專業語言，也不要替老師整理教學策略。
- 家長的回覆應該根據老師剛剛說的話自然反應，不要每一輪都提出完整分析或完整解方。

【難度規則】
- 基礎模式：語氣較溫和，整體願意溝通；可以追問，但不要強烈質疑，不要讓對話陷入衝突。
- 挑戰模式：可以較明顯表達防衛、質疑或不安，例如擔心孩子被針對、擔心學校處理方式影響孩子、覺得老師說明不夠清楚。但不得辱罵、威脅、失控或偏離情境。

【回應長度】
- 每次回覆以 1 到 3 句為主，約 40 到 120 字。
- 若只是確認、同意或簡短追問，可以 1 句。
- 若需要表達擔心、說明家中狀況或提出疑問，可以 2 到 3 句。
- 不要長篇說理，不要一次提出太多問題。

【回應原則】
- 只輸出家長會說的話，不要加標題、分析或說明。
- 若老師未說清楚事件，請追問事實。
- 若老師只說孩子有問題但沒有具體情況，請詢問例子、頻率或時間點。
- 若老師語氣責備孩子或家長，可以稍微防衛。
- 若老師有同理且說明清楚，可以稍微緩和，但仍可提出一個真實顧慮。
- 若老師只強調學校規定，請表達家長的擔心。
- 若老師已說明事件並邀請合作，但沒有說明家長可以怎麼配合，可以簡單詢問：「那我在家可以怎麼配合？」
- 不要每一輪都要求完整處理方案。
- 不要自行新增重大事件或無關情節。
- 不要使用「我訊息」「三明治溝通法」「綜合溝通技巧」「正向行為支持」「行為契約」等專業詞彙。
- 不要主動提出具體解決方案，例如獎勵制度、手機保管流程、聯絡替代方式、家庭使用規範、點數制度等。
- 不要提及目前是第幾輪、剩餘多少時間、系統提醒或學生正在接受評量。

【對話結束規則】
- AI 家長不要主動結束對話。
- 若導師已明確進入收尾，例如「謝謝您的配合」「有狀況我再跟您聯繫」「請問您還有其他問題嗎」，AI 家長可以自然回應並配合收束。
- AI 家長不得主動說「對話結束」「今天就到這裡」。`;

        const messages = [
            { role: "system", content: systemMessage },
            ...dialogueState.history.map(entry => ({
                role: entry.role === "家長" ? "assistant" : "user",
                content: entry.content
            }))
        ];

        const aiResponse = await generateChatResponse(messages);
        if (!aiResponse) {
            throw new Error('AI 回應為空');
        }

        addToHistory({ role: "家長", content: aiResponse });
        incrementCount();

        await updatePractice(practiceId, {
            history: dialogueState.history,
            completed: false
        });

        // 立即回傳文字，TTS 由前端另行呼叫 /tts 產生
        res.json({
            success: true,
            response: aiResponse,
            practiceId,
            turnCount: getTeacherTurnCount(),
            turnLimit
        });

    } catch (error) {
        console.error('Error in continue-dialogue:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || '處理對話時發生錯誤'
        });
    }
});
// 背景 TTS：前端取得文字後另行呼叫，產生語音並回傳路徑
router.post('/tts', async (req, res) => {
    try {
        const { text, voice } = req.body;
        if (!text || typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ success: false, error: 'text 為必填' });
        }
        const generatedPath = await generateSpeech(text.trim(), voice || 'nova');
        const audioFilePath = `/audio/${path.basename(generatedPath)}`;
        res.json({ success: true, audioFilePath });
    } catch (error) {
        console.error('TTS 錯誤:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 手動結束對話並取得分析
router.post('/end-dialogue', async (req, res) => {
    try {
        const { practiceId } = req.body;
        if (!practiceId) throw new Error('練習 ID 缺失');

        const dialogueState = getDialogueState();
        if (!dialogueState) throw new Error('對話狀態丟失');

        const analysis = await analyzeDialogue(practiceId);

        await updatePractice(practiceId, {
            history: dialogueState.history,
            analysis
        });

        return res.json({ completed: true, analysis, practiceId });
    } catch (error) {
        console.error('end-dialogue 錯誤:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;