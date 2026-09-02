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

// Voice 2.0 的研究錄音保存：瀏覽器常見格式都可接受，
// 只負責保存，不再把 S3 當成轉錄的中繼站。
const voice2Upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = new Set([
      'audio/webm', 'audio/ogg', 'audio/wav', 'audio/x-wav',
      'audio/mp4', 'audio/mpeg'
    ]);
    const baseMime = (file.mimetype || '').split(';')[0].trim().toLowerCase();
    if (allowed.has(baseMime)) return cb(null, true);
    cb(new Error('不支援的錄音格式'));
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
      hasFile: Boolean(req.file),
      fileSize: req.file?.size || 0
    });

    // 驗證請求
    const validationErrors = validateRequest(req);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.map(err => converter(err)).join(', '));
    }

    // 在產生 AWS／OpenAI 費用前，先確認這筆練習屬於目前登入者。
    const user = await User.findOne({
      _id: req.user.id,
      'practices._id': req.body.practiceId
    });
    if (!user) {
      throw new Error(converter('練習記錄未找到或無權存取'));
    }

    const practice = user.practices.id(req.body.practiceId);
    if (!practice) {
      throw new Error(converter('練習記錄未找到或無權存取'));
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

// Voice 2.0：只保存已經由 Realtime 轉錄完成的使用者語音。
router.post('/save-recording', voice2Upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) throw new Error('未接收到音頻文件');
    if (!req.body.practiceId) throw new Error('練習 ID 缺失');

    const user = await User.findOne({
      _id: req.user.id,
      'practices._id': req.body.practiceId
    });
    if (!user) throw new Error('練習記錄未找到或無權存取');

    const practice = user.practices.id(req.body.practiceId);
    if (!practice) throw new Error('練習記錄未找到或無權存取');

    const extensionMap = {
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/mp4': 'm4a',
      'audio/mpeg': 'mp3'
    };
    const baseMime = (req.file.mimetype || '').split(';')[0].trim().toLowerCase();
    const ext = extensionMap[baseMime] || 'webm';
    const fileName = `recording-${Date.now()}.${ext}`;
    const s3Result = await uploadToS3(req.file, fileName);

    const newRecording = {
      timestamp: Date.now(),
      path: s3Result.Location,
      transcription: typeof req.body.transcription === 'string' ? req.body.transcription.trim() : ''
    };

    practice.recordings.push(newRecording);
    await user.save();

    res.json({ success: true, recording: newRecording });
  } catch (error) {
    console.error('Voice 2.0 錄音保存失敗:', error.message);
    res.status(500).json({ success: false, error: error.message || '錄音保存失敗' });
  }
});

// 獲取錄音歷史
router.get('/recordings', async (req, res) => {
  try {
    const { practiceId } = req.query;
    if (!practiceId) {
      throw new Error('練習 ID 必須提供');
    }

    const user = await User.findOne({
      _id: req.user.id,
      'practices._id': practiceId
    });
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
