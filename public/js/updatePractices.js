// 引入必要模組
const mongoose = require('mongoose');
const User = require('../models/User'); // 路徑可能需要根據項目調整
const config = require('../config/config'); // 如果有配置檔案，確保正確加載

// 連接資料庫
async function connectDB() {
  try {
    await mongoose.connect(config.mongodb.uri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

// 更新練習的 difficulty 欄位
async function updateExistingPractices() {
  const users = await User.find({});

  for (const user of users) {
    for (const practice of user.practices) {
      if (!practice.difficulty) {
        practice.difficulty = '簡單'; // 默認為簡單模式
      }
    }
    await user.save();
  }

  console.log('All practices updated with default difficulty.');
}

// 主函數
async function main() {
  await connectDB();
  await updateExistingPractices();
  mongoose.disconnect();
}

// 執行腳本
main().catch(err => {
  console.error(err);
  mongoose.disconnect();
  process.exit(1);
});