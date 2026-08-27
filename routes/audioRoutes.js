const express = require('express');
const router = express.Router();
const multer = require('multer');
const AWS = require('aws-sdk');
const User = require('../models/User');
const { transcribeAudio } = require('../services/openaiService');
const OpenCC = require('opencc-js');

// 建立簡體轉繁體轉換器
const converter = OpenCC.Converter({ from: 'cn', to: 'tw' });

// AWS S3 配置
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Multer 配置
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 限制 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'audio/wav' || file.mimetype === 'audio/x-wav') {
      cb(null, true);
    } else {
      cb(new Error('只接受 WAV 格式的音頻文件'));
    }
  }
});

// 輔助函數：檢查請求參數
const validateRequest = (req) => {
  const errors = [];
  if (!req.file) errors.push('未接收到音頻文件');
  if (!req.body.practiceId) errors.push('練習 ID 缺失');
  
  return errors;
};

// 輔助函數：上傳檔案到 S3
const uploadToS3 = async (file, fileName) => {
  const uploadParams = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  return await s3.upload(uploadParams).promise();
};

// 上傳與轉錄音頻
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    console.log('收到音頻上傳請求:', {
      headers: req.headers,
      body: req.body,
      file: req.file ? '存在' : '不存在'
    });

    // 驗證請求
    const validationErrors = validateRequest(req);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.map(err => converter(err)).join(', '));
    }

    // 生成檔案名稱
    const fileName = `recording-${Date.now()}.wav`;

    // 上傳到 S3
    const s3Result = await uploadToS3(req.file, fileName);
    console.log('S3 上傳成功:', s3Result.Location);

    // 轉錄音頻（已包含簡繁轉換）
    const transcription = await transcribeAudio(s3Result.Location);
    console.log('轉錄完成:', transcription);

    // 準備錄音記錄
    const newRecording = {
      timestamp: Date.now(),
      path: s3Result.Location,
      transcription
    };

    // 更新用戶練習記錄
    const user = await User.findOne({ 'practices._id': req.body.practiceId });
    if (!user) {
      throw new Error(converter('練習記錄未找到'));
    }

    const practice = user.practices.id(req.body.practiceId);
    if (!practice) {
      throw new Error(converter('練習記錄未找到'));
    }

    // 避免重複儲存
    const isDuplicate = practice.recordings.some(r => r.path === newRecording.path);
    if (!isDuplicate) {
      practice.recordings.push(newRecording);
      await user.save();
      console.log('錄音記錄已保存');
    }

    res.json({
      success: true,
      text: transcription,
      path: s3Result.Location
    });

  } catch (error) {
    console.error('音頻處理失敗:', error);
    res.status(500).json({
      success: false,
      error: converter(error.message || '音頻處理失敗')
    });
  }
});

// 獲取錄音歷史
router.get('/recordings', async (req, res) => {
  try {
    const { practiceId } = req.query;
    if (!practiceId) {
      throw new Error('練習 ID 必須提供');
    }

    const user = await User.findOne({ 'practices._id': practiceId });
    if (!user) {
      throw new Error('找不到相關練習記錄');
    }

    const practice = user.practices.id(practiceId);
    if (!practice) {
      throw new Error('找不到相關練習記錄');
    }

    const formattedRecordings = practice.recordings.map(recording => ({
      timestamp: recording.timestamp,
      path: recording.path,
      transcription: recording.transcription || ''
    }));

    res.json({
      success: true,
      recordings: formattedRecordings
    });

  } catch (error) {
    console.error('獲取錄音記錄失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message || '獲取錄音記錄失敗'
    });
  }
});

module.exports = router;