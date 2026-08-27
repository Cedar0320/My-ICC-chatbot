// backend-example.js
// 這是一個簡單的後端範例，展示如何提供 lipsync 數據給前端

const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// ==========================================
// 方式 1: 使用預先準備好的數據（Demo 用）
// ==========================================
app.post('/chat', async (req, res) => {
    const { message } = req.body;
    console.log('收到訊息:', message);

    // 這裡應該：
    // 1. 呼叫 TTS 服務（Azure Speech, ElevenLabs 等）
    // 2. 獲取音訊和 viseme 數據
    // 3. 回傳給前端

    // Demo 用的假數據
    const response = {
        messages: [{
            text: message,
            audio: "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA...", // 實際應該是完整的 base64 音訊
            facialExpression: "crazy",
            animation: "Idle",
            lipsync: {
                mouthCues: [
                    { start: 0.0, end: 0.3, value: "A" },   // 你
                    { start: 0.3, end: 0.6, value: "D" },   // 好
                    { start: 0.8, end: 1.1, value: "C" },   // 很
                    { start: 1.1, end: 1.4, value: "D" },   // 高
                    { start: 1.4, end: 1.7, value: "C" },   // 興
                    { start: 1.7, end: 2.0, value: "A" },   // 見
                    { start: 2.0, end: 2.3, value: "D" },   // 到
                    { start: 2.3, end: 2.6, value: "A" },   // 你
                ]
            }
        }]
    };

    res.json(response);
});



// ==========================================
// 方式 3: 使用 Rhubarb Lip Sync
// ==========================================
// Rhubarb 是一個開源的 lip sync 工具
// https://github.com/DanielSWolf/rhubarb-lip-sync

const { exec } = require('child_process');
const fs = require('fs');

app.post('/chat-rhubarb', async (req, res) => {
    const { audioFile, text } = req.body;

    // 1. 先用 TTS 生成音訊檔案（或使用上傳的檔案）
    // 2. 使用 Rhubarb 分析
    
    exec(`rhubarb -f json ${audioFile}`, (error, stdout, stderr) => {
        if (error) {
            console.error('Rhubarb 錯誤:', error);
            res.status(500).json({ error: error.message });
            return;
        }

        const rhubarbData = JSON.parse(stdout);
        
        // Rhubarb 輸出格式範例:
        // {
        //   "mouthCues": [
        //     {"start": 0.0, "end": 0.27, "value": "X"},
        //     {"start": 0.27, "end": 0.37, "value": "D"},
        //     ...
        //   ]
        // }

        // 讀取音訊檔案並轉換為 base64
        const audioData = fs.readFileSync(audioFile).toString('base64');

        res.json({
            messages: [{
                text: text,
                audio: audioData,
                facialExpression: "crazy",
                animation: "Idle",
                lipsync: rhubarbData
            }]
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 後端服務執行於 http://localhost:${PORT}`);
    console.log('\n可用的端點:');
    console.log('  POST /chat         - 使用預設數據（Demo）');
    console.log('  POST /chat-azure   - 使用 Azure Speech Service');
    console.log('  POST /chat-rhubarb - 使用 Rhubarb Lip Sync');
});