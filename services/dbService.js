// dbService.js
const mongoose = require('mongoose');
const config = require('../config/config');

async function connectDB() {
  try {
    await mongoose.connect(config.mongodb.uri, {
      tls: true,
      serverSelectionTimeoutMS: 3000,
      autoSelectFamily: false,
      dbName: 'communicationTraining'  // 指定資料庫名稱
    });
    
    console.log('MongoDB connected successfully');

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    return true;
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    return false;
  }
}

async function closeDB() {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Failed to close MongoDB connection:', error);
  }
}

module.exports = { connectDB, closeDB };