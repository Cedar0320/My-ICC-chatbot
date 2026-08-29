const express = require('express');
const router = express.Router();
const scenarios = require('../data/scenarios');
const mongoose = require('mongoose');
const {
  addToHistory,
  incrementCount,
  resetDialogueState,
  updateDialogueState,
  getDialogueState,
  deleteDialogueState
} = require('../services/dialogueService');
const { analyzeDialogue } = require('../services/analysisService');
const { getPracticeDetails } = require('../services/practiceService');
const { updateOwnedPractice: updatePractice } = require('../services/ownedPracticeService');
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
        const userId = req.user.id;

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

        // 先確認練習屬於目前登入者，再建立獨立對話狀態。
        await getPracticeDetails(userId, practiceId);
        resetDialogueState(userId, practiceId, technique);

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
            console.error('AI 回應解析失敗');
            return res.status(500).json({
                success: false,
                message: 'AI 回應解析失敗',
                details: { response }
            });
        }

        const { scenario } = parsedResponse;

        // 對話歷史從空白開始，學生先開口
        updateDialogueState(userId, practiceId, {
            scenario,
            parentPersonality: selectedPersonality,
            history: [],
            count: 0,
            challengeMode: difficulty === '挑戰',
            challengeStartTime: difficulty === '挑戰' ? Date.now() : null
        });

        await updatePractice(userId, practiceId, { scenario });

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
        console.error('AI 初始回應缺少必要欄位');
        throw new Error(`解析 AI 回應失敗: ${error.message}`);
    }
}


// 0301更新

// 更新 continue-dialogue 路由，確保在對話完成時更新分析結果
router.post('/continue-dialogue', async (req, res) => {
    try {
        const { userResponse, practiceId, challengeTimeOver, nonverbalData, characterVoice } = req.body;
        const userId = req.user.id;
        console.log('收到繼續對話請求:', {
            hasUserResponse: Boolean(userResponse),
            challengeTimeOver: Boolean(challengeTimeOver),
            hasNonverbalData: Boolean(nonverbalData)
        });

        // 如果有非語言數據，記錄到日誌
        if (nonverbalData) {
            console.log("收到非語言數據:", nonverbalData);
        }

        if (!practiceId) {
            throw new Error('練習 ID 缺失');
        }

        const dialogueState = getDialogueState(userId, practiceId);
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
            const analysis = await analyzeDialogue(userId, practiceId);
            
            // 保存對話完成狀態和分析結果到練習紀錄
            await updatePractice(userId, practiceId, {
                history: dialogueState.history, // 直接覆蓋歷史記錄
                analysis
            });
            
            deleteDialogueState(userId, practiceId);
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

            addToHistory(userId, practiceId, historyEntry);
            incrementCount(userId, practiceId);
        }

        // 安全上限：基礎模式 24 句（12 輪），前端已透過「結束對話」按鈕控制流程
        if (!dialogueState.challengeMode && dialogueState.count >= 24) {
            const analysis = await analyzeDialogue(userId, practiceId);
            
            // 保存對話完成狀態和分析結果到練習紀錄
            await updatePractice(userId, practiceId, {
                history: dialogueState.history, // 直接覆蓋歷史記錄
                analysis
            });
            
            deleteDialogueState(userId, practiceId);
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

        addToHistory(userId, practiceId, { role: "家長", content: aiResponse });
        incrementCount(userId, practiceId);

        await updatePractice(userId, practiceId, {
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
        const { text, voice, practiceId } = req.body;
        if (!practiceId || !mongoose.Types.ObjectId.isValid(practiceId)) {
            return res.status(400).json({ success: false, error: '有效的 practiceId 為必填' });
        }
        if (!text || typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ success: false, error: 'text 為必填' });
        }
        if (text.length > 1000) {
            return res.status(400).json({ success: false, error: 'TTS 文字不可超過1000字' });
        }

        // 產生需付費的語音前，確認練習屬於目前登入者。
        await getPracticeDetails(req.user.id, practiceId);
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
        const userId = req.user.id;
        if (!practiceId) throw new Error('練習 ID 缺失');

        const dialogueState = getDialogueState(userId, practiceId);
        if (!dialogueState) throw new Error('對話狀態丟失');

        const analysis = await analyzeDialogue(userId, practiceId);

        await updatePractice(userId, practiceId, {
            history: dialogueState.history,
            analysis
        });

        deleteDialogueState(userId, practiceId);
        return res.json({ completed: true, analysis, practiceId });
    } catch (error) {
        console.error('end-dialogue 錯誤:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
