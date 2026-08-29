const dotenv = require('dotenv');
dotenv.config();

const requiredEnvVars = ['API_KEY', 'MONGODB_URI', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(name => !process.env[name]);

if (missingEnvVars.length > 0) {
  throw new Error(`缺少必要環境變數：${missingEnvVars.join(', ')}`);
}

module.exports = {
  port: process.env.PORT || 3030,
  openaiApiKey: process.env.API_KEY,
  mongodb: {
    uri: process.env.MONGODB_URI
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '24h'
  },
  tempAudioConfig: {
    maxAge: 24 * 60 * 60 * 1000, // TTS 暫存音檔保留 24 小時
    cleanupInterval: 6 * 60 * 60 * 1000 // 每 6 小時清理一次
  }
};
