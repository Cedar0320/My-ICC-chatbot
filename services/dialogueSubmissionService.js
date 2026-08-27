/**
 * Deprecated:
 * 此檔案為舊版對話提交處理 prompt，目前未被任何路由調用。
 * 現行對話生成請使用 routes/dialogueRoutes.js 中的 continue-dialogue prompt。
 * 請勿再使用此 prompt，避免與基礎／挑戰模式及現行家長角色設定衝突。
 */
const { generateChatResponse } = require('./openaiService');
const { 
  getDialogueState, 
  addToHistory, 
  incrementCount, 
  resetCurrentRecordings 
} = require('./dialogueService');
const { analyzeDialogue } = require('./analysisService');
const { updatePractice } = require('../services/practiceService'); // 引入更新練習的模組

/**
 * 處理對話提交邏輯
 * @param {String} transcription - 使用者的語音文字轉錄
 * @param {String} practiceId - 對應練習的 ID
 */
async function handleDialogueSubmission(transcription, practiceId) {
  try {
    console.log('Handling dialogue submission for practice:', practiceId); // 調試用

    // 獲取當前對話狀態
    const dialogueState = getDialogueState();

    // 檢查輸入是否合法
    if (!transcription || !transcription.trim()) {
      throw new Error('Invalid transcription content');
    }

    // 添加教師回應到歷史
    addToHistory({ role: "導師", content: transcription });
    incrementCount();

    // 如果對話達到結束條件，執行分析
    if (dialogueState.count >= 12) {
      console.log('Dialogue complete, performing analysis'); // 調試用
      const analysis = await analyzeDialogue(practiceId);

      // 保存歷史到練習紀錄（analysis 和 status 由 analyzeDialogue 內部處理）
      await updatePractice(practiceId, { 
        history: dialogueState.history
      });

      return {
        completed: true,
        analysis: analysis
      };
    }

    // 準備 AI 回應
    const messages = [
      { 
        role: "system", 
        content: `
        請用繁體中文根據老師上一句的回應回覆。您是一位關心孩子但情緒較為激動的家長，請嚴格遵守以下規則：

        1. 角色設定：
           - 您是一位情緒較為激動的家長
           - 您對孩子的問題非常擔憂
           - 您希望老師能立即解決問題
           - 您不會提供具體的解決方案，而是要求老師想辦法

        2. 回應限制：
           - 只能針對當前情境中的孩子問題進行回應
           - 不能提供具體的解決方案或建議
           - 不能討論與當前情境無關的話題
           - 不能接受老師轉移話題

        3. 情緒表現：
           - 如果老師的回應不夠具體，表現出不耐煩
           - 如果老師的回應過於理論，要求具體做法
           - 如果老師的回應偏離主題，立即指出並要求回到問題核心
           - 如果老師的回應有說服力，可以稍微緩和語氣，但仍保持警惕

        4. 回應參考格式(不一定要完全照著這樣寫，但請盡量遵守)：
           - 開頭：直接表達對當前問題的擔憂或不滿
           - 中間：針對老師的回應提出質疑或要求
           - 結尾：要求老師提供具體的解決方案

        5. 禁止事項：
           - 不能提供具體的解決方案
           - 不能討論與當前情境無關的話題
           - 不能表現出過於理性或專業的態度
           - 不能接受老師轉移話題或拖延時間

        6. 當老師偏離主題時：
           - 立即指出：「這與我孩子的問題無關」
           - 重述當前問題
           - 要求老師回到問題核心
        `
      },
      ...dialogueState.history.map(entry => ({ 
        role: entry.role === "家長" ? "assistant" : "user", 
        content: entry.content 
      }))
    ];

    console.log('Preparing AI response with messages:', messages); // 調試用

    // 獲取 AI 回應
    const response = await generateChatResponse(messages);
    if (!response) {
      throw new Error('Failed to get AI response');
    }

    // 添加 AI 回應到歷史
    addToHistory({ role: "家長", content: response });

    // 保存對話歷史到練習紀錄
    await updatePractice(practiceId, { history: dialogueState.history });

    // 重置當前錄音
    resetCurrentRecordings();

    console.log('Dialogue submission completed successfully'); // 調試用

    return {
      completed: false,
      response: response
    };

  } catch (error) {
    console.error('Error in handleDialogueSubmission:', error);
    throw error;
  }
}

module.exports = {
  handleDialogueSubmission
};