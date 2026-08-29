const OpenAI = require('openai');
const config = require('../config/config');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const OpenCC = require('opencc-js');
const axios = require('axios');


// 建立簡體轉繁體轉換器
const converter = OpenCC.Converter({ from: 'cn', to: 'tw' });

const openai = new OpenAI({
  apiKey: config.openaiApiKey,
});

// 初始化 S3 客戶端
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

async function transcribeAudio(fileUrl) {
  try {
    console.log('開始下載音頻文件...', fileUrl);
    
    // 從 URL 獲取 bucket 和 key
    const urlParts = new URL(fileUrl);
    const key = urlParts.pathname.substring(1);
    const bucket = urlParts.hostname.split('.')[0];

    // 創建臨時目錄（如果不存在）
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    // 創建臨時文件路徑
    const tempFilePath = path.join(tempDir, `temp-${Date.now()}.wav`);

    // 使用 S3 SDK 下載文件
    const fileData = await s3.getObject({
      Bucket: bucket,
      Key: key
    }).promise();

    // 將文件數據寫入臨時文件
    fs.writeFileSync(tempFilePath, fileData.Body);

    console.log('開始進行音頻轉錄...');

    // 創建文件流
    const fileStream = fs.createReadStream(tempFilePath);

    // 使用 OpenAI API 進行轉錄
    const transcription = await openai.audio.transcriptions.create({
      file: fileStream,
      model: "whisper-1",
      language: "zh"
    });

    // 刪除臨時文件
    fs.unlinkSync(tempFilePath);

    // 將轉錄文字轉換為繁體中文
    const traditionalText = converter(transcription.text);
    console.log('原始轉錄文字:', transcription.text);
    console.log('轉換後繁體文字:', traditionalText);

    return traditionalText;

  } catch (error) {
    console.error('音頻轉錄失敗:', error);
    throw error;
  }
}


async function generateChatResponse(messages) {
  try {
      console.log('Sending request to OpenAI:', messages);
      
      const chatCompletion = await openai.chat.completions.create({
          messages,
          model: "gpt-4o-mini", 
          temperature: 0.7,
          max_tokens: 1000
      });

      if (!chatCompletion?.choices?.[0]?.message?.content) {
          throw new Error('Invalid response format from OpenAI');
      }
      
      const response = chatCompletion.choices[0].message.content.trim();
      console.log('OpenAI response:', response);
      return response;
      
  } catch (error) {
      console.error('OpenAI Chat API Error:', error);
      throw new Error(error.message || 'AI 回應生成失敗');
  }
}



async function generateSpeech(text, voice = 'shimmer') {
  try {
    // 檢查輸入文字
    if (!text || typeof text !== 'string') {
      throw new Error('無效的文字輸入');
    }

    const apiKey = config.openaiApiKey;
    if (!apiKey) {
      throw new Error('OpenAI API 金鑰未設定');
    }

    // 確保臨時目錄存在
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 生成唯一的檔案名稱
    const timestamp = Date.now();
    const outputPath = path.join(tempDir, `speech-${timestamp}.mp3`);

    // 檢查檔案是否已存在
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath); // 如果存在則刪除
    }

    const response = await axios({
      method: 'POST',
      url: 'https://api.openai.com/v1/audio/speech',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      responseType: 'stream',
      data: {
        model: 'tts-1',
        input: text,
        voice: voice,
        response_format: 'mp3',
        speed: 1.15
      }
    });

    // 使用 Promise 處理檔案寫入
    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(outputPath);
      
      writer.on('error', (error) => {
        console.error('寫入音頻檔案失敗:', error);
        reject(new Error('音頻檔案寫入失敗'));
      });

      writer.on('finish', () => {
        console.log('音頻檔案已生成:', outputPath);
        resolve(outputPath);
      });

      // 處理串流錯誤
      response.data.on('error', (error) => {
        console.error('音頻串流錯誤:', error);
        writer.end();
        reject(new Error('音頻串流處理失敗'));
      });

      // 將回應串流導向檔案
      response.data.pipe(writer);
    });

  } catch (error) {
    console.error('語音合成失敗:', error.response?.data || error.message);
    // 清理可能的部分檔案
    if (outputPath && fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath);
      } catch (cleanupError) {
        console.error('清理臨時檔案失敗:', cleanupError);
      }
    }
    throw new Error(error.response?.data?.error?.message || error.message || '語音合成失敗');
  }
}


module.exports = {
  transcribeAudio,
  generateSpeech,
  generateChatResponse: async (messages) => {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
      });

      // 確保回應也轉換為繁體中文
      const response = completion.choices[0].message.content;
      return converter(response);
    } catch (error) {
      console.error('生成回應失敗:', error);
      throw error;
    }
  }
};