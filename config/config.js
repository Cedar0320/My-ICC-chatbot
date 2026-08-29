const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: process.env.PORT || 3030,
  openaiApiKey: process.env.API_KEY,
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/communicationTraining'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: '24h'
  },
  recordingsConfig: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    cleanupInterval: 24 * 60 * 60 * 1000 // 1 day
  }
};