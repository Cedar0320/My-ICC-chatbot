// const os = require('os');
// const express = require('express');
// const bodyParser = require('body-parser');
// const path = require('path');
// const config = require('./config/config');
// const dialogueRoutes = require('./routes/dialogueRoutes');
// const pageRoutes = require('./routes/pageRoutes');
// const { connectDB } = require('./services/dbService');
// const authMiddleware = require('./middleware/auth');
// const authRoutes = require('./routes/authRoutes');
// const audioRoutes = require('./routes/audioRoutes');
// const AWS = require('aws-sdk');
// //const ttsRoutes = require('./routes/ttsRoutes');

// // 建立Express應用
// const app = express();
// //app.use('/api/tts', authMiddleware, ttsRoutes);

// // 驗證必要的環境變數
// const requiredEnvVars = [
//   'AWS_ACCESS_KEY_ID',
//   'AWS_SECRET_ACCESS_KEY',
//   'AWS_REGION',
//   'S3_BUCKET_NAME'
// ];

// requiredEnvVars.forEach(varName => {
//   if (!process.env[varName]) {
//     throw new Error(`環境變數 ${varName} 未設定`);
//   }
// });

// // AWS S3 配置
// const s3 = new AWS.S3({
//   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   region: process.env.AWS_REGION,
//   params: {
//     Bucket: process.env.S3_BUCKET_NAME
//   },
//   httpOptions: {
//     timeout: 60000, // 增加AWS SDK請求超時時間為60秒
//     connectTimeout: 30000 // 連接超時時間30秒
//   }
// });

// // 基本中間件
// // 增加請求體大小限制和超時設置
// app.use(bodyParser.json({ limit: '20mb' })); // 增加到20MB
// app.use(bodyParser.urlencoded({ extended: true, limit: '20mb' }));
// app.use(express.static(path.join(__dirname, 'public')));

// // 增加請求超時處理
// app.use((req, res, next) => {
//   // 設置全局請求超時為60秒
//   res.setTimeout(60000, () => {
//     console.log('請求超時:', req.path);
//     if (!res.headersSent) {
//       res.status(504).json({
//         success: false,
//         message: '請求處理超時，請稍後再試'
//       });
//     }
//   });
//   next();
// });

// // 增加請求日誌
// app.use((req, res, next) => {
//   const start = Date.now();
//   console.log(`${new Date().toISOString()} - 請求開始: ${req.method} ${req.path}`);
  
//   res.on('finish', () => {
//     const duration = Date.now() - start;
//     console.log(`${new Date().toISOString()} - 請求完成: ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
//   });
  
//   res.on('close', () => {
//     if (!res.finished) {
//       const duration = Date.now() - start;
//       console.log(`${new Date().toISOString()} - 請求提前關閉: ${req.method} ${req.path} (${duration}ms)`);
//     }
//   });
  
//   next();
// });

// // CORS 設定
// app.use((req, res, next) => {
//   res.header('Access-Control-Allow-Origin', '*');
//   res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
//   if (req.method === 'OPTIONS') {
//     res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
//     return res.status(200).json({});
//   }
//   next();
// });

// // 安全性中間件
// app.use((req, res, next) => {
//   res.setHeader('X-Content-Type-Options', 'nosniff');
//   res.setHeader('X-Frame-Options', 'DENY');
//   res.setHeader('X-XSS-Protection', '1; mode=block');
//   next();
// });

// // 健康檢查端點 - 用於監控系統狀態
// app.get('/health', (req, res) => {
//   res.status(200).json({
//     status: 'ok',
//     timestamp: new Date().toISOString(),
//     uptime: process.uptime(),
//     memory: process.memoryUsage(),
//     cpus: os.cpus().length
//   });
// });

// // 路由
// app.use('/api/auth', authRoutes);
// app.use('/', pageRoutes);
// app.use('/api/audio', authMiddleware, (req, res, next) => {
//   req.s3 = s3; // 將 s3 實例注入請求對象
//   audioRoutes(req, res, next);
// });

// // 對話路由 - 增加特定的錯誤處理和超時控制
// app.use('/api/dialogue', authMiddleware, (req, res, next) => {
//   // 為對話相關請求增加特定的超時處理
//   if (req.path === '/start-dialogue') {
//     res.setTimeout(90000); // 特別延長對話開始的超時時間到90秒
//     console.log('對話開始請求 - 設置超時時間為90秒');
//   }
//   dialogueRoutes(req, res, next);
// });

// // 練習相關路由
// const practiceRoutes = require('./routes/practiceRoutes');
// app.use('/api/practice', authMiddleware, practiceRoutes);

// // 非語言數據API路由
// const nonverbalRoutes = require('./routes/nonverbalRoutes');
// app.use('/api/nonverbal', authMiddleware, nonverbalRoutes);

// // Admin 管理後台路由
// const adminRoutes = require('./routes/adminRoutes');
// const adminAuth = require('./middleware/adminAuth');
// // Login route 不需要認證
// app.use('/api/admin', adminRoutes);
// // 其他 admin 路由需要 admin 權限保護在 route 內部處理

// // 添加 favicon 處理
// app.get('/favicon.ico', (req, res) => res.status(204));

// // 添加音頻檔案靜態服務
// app.use('/audio', express.static(path.join(__dirname, 'temp')));

// // 當服務器負載過高時的處理機制
// app.use((req, res, next) => {
//   // 監控服務器負載，如果負載過高，拒絕新請求
//   const loadAvg = os.loadavg()[0];
//   const cpuCount = os.cpus().length;
  
//   if (loadAvg > cpuCount * 0.8) { // 負載超過CPU核心數的80%
//     console.warn(`服務器負載過高 (${loadAvg}/${cpuCount})`);
//     // 為關鍵請求路徑放行，其他返回503
//     if (!req.path.includes('/api/auth') && !req.path.includes('/health')) {
//       return res.status(503).json({
//         success: false,
//         message: '服務器當前負載過高，請稍後再試'
//       });
//     }
//   }
  
//   next();
// });

// // 404 處理
// app.use((req, res, next) => {
//   console.log('未找到路徑:', req.path);
//   res.status(404).json({
//     success: false,
//     message: '找不到請求的資源',
//     path: req.path
//   });
// });

// // 改進的錯誤處理中間件
// app.use((err, req, res, next) => {
//   // 紀錄詳細錯誤信息
//   console.error('錯誤:', {
//     path: req.path,
//     method: req.method,
//     error: err.message,
//     stack: err.stack,
//     body: req.body ? JSON.stringify(req.body).substring(0, 200) : null // 記錄請求體前200字符
//   });
  
//   // 針對不同類型的錯誤提供特定的回應
//   let status = err.status || 500;
//   let message = err.message || '伺服器錯誤';
  
//   // 處理常見錯誤類型
//   if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
//     status = 504;
//     message = '處理請求超時，可能是因為某些外部服務暫時不可用';
//   } else if (err.code === 'ECONNREFUSED') {
//     status = 503;
//     message = '無法連接到必要的服務';
//   } else if (err.type === 'entity.too.large') {
//     status = 413;
//     message = '請求資料過大';
//   }
  
//   const response = {
//     success: false,
//     message: message,
//     requestId: Math.random().toString(36).substring(2, 15) // 生成一個追蹤ID
//   };
  
//   // 在開發模式下，返回完整的錯誤信息
//   if (process.env.NODE_ENV === 'development') {
//     response.error = err.stack;
//     response.code = err.code;
//   }
  
//   // 添加監控警報或通知的邏輯（根據具體情況實現）
//   if (status >= 500) {
//     // TODO: 這裡可以添加錯誤通知邏輯，例如發送郵件或推送通知
//   }
  
//   res.status(status).json(response);
// });

// // 伺服器啟動函數
// async function startServer() {
//   try {
//     // 連接資料庫，添加重試機制
//     let dbConnected = false;
//     let retries = 3;
    
//     while (!dbConnected && retries > 0) {
//       try {
//         dbConnected = await connectDB();
//         if (!dbConnected) {
//           throw new Error('資料庫連接失敗');
//         }
//       } catch (error) {
//         retries--;
//         if (retries === 0) {
//           throw error;
//         }
//         console.log(`資料庫連接失敗，${retries}次重試後再嘗試...`);
//         await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒後重試
//       }
//     }

//     const port = config.port || 3000;
    
//     // 儲存伺服器實例以便優雅關閉
//     const server = app.listen(port, () => {
//       console.log(`伺服器運行在 port ${port}`);
//       console.log('環境:', process.env.NODE_ENV || 'development');
//       console.log('系統資訊:', {
//         platform: os.platform(),
//         arch: os.arch(),
//         cpus: os.cpus().length,
//         memory: Math.round(os.totalmem() / (1024 * 1024 * 1024)) + 'GB',
//         freemem: Math.round(os.freemem() / (1024 * 1024 * 1024)) + 'GB'
//       });
//     });
    
//     // 設置Keep-Alive超時
//     server.keepAliveTimeout = 65000; // 65秒
//     server.headersTimeout = 66000; // 66秒
    
//     // 優雅關閉 - 修正變量引用
//     process.on('SIGTERM', () => {
//       console.log('收到 SIGTERM 信號，準備關閉伺服器...');
//       server.close(() => {
//         console.log('伺服器已關閉');
//         process.exit(0);
//       });
      
//       // 設置強制關閉超時
//       setTimeout(() => {
//         console.error('無法優雅關閉，強制退出');
//         process.exit(1);
//       }, 30000);
//     });
    
//     // 處理未捕獲的錯誤
//     process.on('uncaughtException', (error) => {
//       console.error('未捕獲的異常:', error);
//       // 不立即退出，讓當前請求有機會完成
//       setTimeout(() => {
//         process.exit(1);
//       }, 3000);
//     });
    
//     process.on('unhandledRejection', (reason, promise) => {
//       console.error('未處理的Promise拒絕:', reason);
//     });

//     return server;

//   } catch (error) {
//     console.error('伺服器啟動失敗:', error);
//     process.exit(1);
//   }
// }

// // 啟動服務器並導出伺服器實例
// const serverPromise = startServer();

// module.exports = app;

const os = require('os');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const config = require('./config/config');
const dialogueRoutes = require('./routes/dialogueRoutes');
const pageRoutes = require('./routes/pageRoutes');
const { connectDB } = require('./services/dbService');
const authMiddleware = require('./middleware/auth');
const authRoutes = require('./routes/authRoutes');
const audioRoutes = require('./routes/audioRoutes');
const AWS = require('aws-sdk');
//const ttsRoutes = require('./routes/ttsRoutes');

const User = require('./models/User');

// ─── 定期清理殭屍練習（每天執行一次）─────────────────────────────────────────
async function cleanupPendingPractices() {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const users = await User.find({ 'practices.0': { $exists: true } }, '_id practices');
    let totalDeleted = 0;

    for (const user of users) {
      const before = user.practices.length;
      // 只刪除超過 24 小時且沒有 analysis 的練習（有 analysis 表示已完成）
      user.practices = user.practices.filter(p => 
        !(p.createdAt < oneDayAgo && !p.analysis)
      );
      const deleted = before - user.practices.length;
      if (deleted > 0) {
        await user.save();
        totalDeleted += deleted;
      }
    }

    if (totalDeleted > 0) {
      console.log(`[定期清理] 已從 DB 刪除 ${totalDeleted} 筆超過 24 小時的 pending 練習`);
    }
  } catch (error) {
    console.error('[定期清理] 清理殭屍練習時發生錯誤:', error);
  }
}

// 建立Express應用
const app = express();
//app.use('/api/tts', authMiddleware, ttsRoutes);

// 驗證必要的環境變數
const requiredEnvVars = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'S3_BUCKET_NAME'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`環境變數 ${varName} 未設定`);
  }
});

// AWS S3 配置
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  params: {
    Bucket: process.env.S3_BUCKET_NAME
  },
  httpOptions: {
    timeout: 60000, // 增加AWS SDK請求超時時間為60秒
    connectTimeout: 30000 // 連接超時時間30秒
  }
});

// 基本中間件
// 增加請求體大小限制和超時設置
app.use(bodyParser.json({ limit: '20mb' })); // 增加到20MB
app.use(bodyParser.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 增加請求超時處理
app.use((req, res, next) => {
  // 設置全局請求超時為60秒
  res.setTimeout(60000, () => {
    console.log('請求超時:', req.path);
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        message: '請求處理超時，請稍後再試'
      });
    }
  });
  next();
});

// 增加請求日誌
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`${new Date().toISOString()} - 請求開始: ${req.method} ${req.path}`);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${new Date().toISOString()} - 請求完成: ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  
  res.on('close', () => {
    if (!res.finished) {
      const duration = Date.now() - start;
      console.log(`${new Date().toISOString()} - 請求提前關閉: ${req.method} ${req.path} (${duration}ms)`);
    }
  });
  
  next();
});

// CORS 設定
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
    return res.status(200).json({});
  }
  next();
});

// 安全性中間件
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// 健康檢查端點 - 用於監控系統狀態
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpus: os.cpus().length
  });
});

// 路由
app.use('/api/auth', authRoutes);
app.use('/', pageRoutes);
app.use('/api/audio', authMiddleware, (req, res, next) => {
  req.s3 = s3; // 將 s3 實例注入請求對象
  audioRoutes(req, res, next);
});

// 對話路由 - 增加特定的錯誤處理和超時控制
app.use('/api/dialogue', authMiddleware, (req, res, next) => {
  // 為對話相關請求增加特定的超時處理
  if (req.path === '/start-dialogue') {
    res.setTimeout(90000); // 特別延長對話開始的超時時間到90秒
    console.log('對話開始請求 - 設置超時時間為90秒');
  }
  dialogueRoutes(req, res, next);
});

// 練習相關路由
const practiceRoutes = require('./routes/practiceRoutes');
app.use('/api/practice', authMiddleware, practiceRoutes);

// 非語言數據API路由
const nonverbalRoutes = require('./routes/nonverbalRoutes');
app.use('/api/nonverbal', authMiddleware, nonverbalRoutes);

// Admin 管理後台路由
const adminRoutes = require('./routes/adminRoutes');
const adminAuth = require('./middleware/adminAuth');
// Login route 不需要認證
app.use('/api/admin', adminRoutes);
// 其他 admin 路由需要 admin 權限保護在 route 內部處理

// 添加 favicon 處理
app.get('/favicon.ico', (req, res) => res.status(204));

// 添加音頻檔案靜態服務
app.use('/audio', express.static(path.join(__dirname, 'temp')));

// 當服務器負載過高時的處理機制
app.use((req, res, next) => {
  // 監控服務器負載，如果負載過高，拒絕新請求
  const loadAvg = os.loadavg()[0];
  const cpuCount = os.cpus().length;
  
  if (loadAvg > cpuCount * 0.8) { // 負載超過CPU核心數的80%
    console.warn(`服務器負載過高 (${loadAvg}/${cpuCount})`);
    // 為關鍵請求路徑放行，其他返回503
    if (!req.path.includes('/api/auth') && !req.path.includes('/health')) {
      return res.status(503).json({
        success: false,
        message: '服務器當前負載過高，請稍後再試'
      });
    }
  }
  
  next();
});

// 404 處理
app.use((req, res, next) => {
  console.log('未找到路徑:', req.path);
  res.status(404).json({
    success: false,
    message: '找不到請求的資源',
    path: req.path
  });
});

// 改進的錯誤處理中間件
app.use((err, req, res, next) => {
  // 紀錄詳細錯誤信息
  console.error('錯誤:', {
    path: req.path,
    method: req.method,
    error: err.message,
    stack: err.stack,
    body: req.body ? JSON.stringify(req.body).substring(0, 200) : null // 記錄請求體前200字符
  });
  
  // 針對不同類型的錯誤提供特定的回應
  let status = err.status || 500;
  let message = err.message || '伺服器錯誤';
  
  // 處理常見錯誤類型
  if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
    status = 504;
    message = '處理請求超時，可能是因為某些外部服務暫時不可用';
  } else if (err.code === 'ECONNREFUSED') {
    status = 503;
    message = '無法連接到必要的服務';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = '請求資料過大';
  }
  
  const response = {
    success: false,
    message: message,
    requestId: Math.random().toString(36).substring(2, 15) // 生成一個追蹤ID
  };
  
  // 在開發模式下，返回完整的錯誤信息
  if (process.env.NODE_ENV === 'development') {
    response.error = err.stack;
    response.code = err.code;
  }
  
  // 添加監控警報或通知的邏輯（根據具體情況實現）
  if (status >= 500) {
    // TODO: 這裡可以添加錯誤通知邏輯，例如發送郵件或推送通知
  }
  
  res.status(status).json(response);
});

// 伺服器啟動函數
async function startServer() {
  try {
    // 連接資料庫，添加重試機制
    let dbConnected = false;
    let retries = 3;
    
    while (!dbConnected && retries > 0) {
      try {
        dbConnected = await connectDB();
        if (!dbConnected) {
          throw new Error('資料庫連接失敗');
        }

        // DB 連線成功後啟動定期清理（每 24 小時執行一次）
        cleanupPendingPractices(); // 啟動時先執行一次
        setInterval(cleanupPendingPractices, 24 * 60 * 60 * 1000);
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw error;
        }
        console.log(`資料庫連接失敗，${retries}次重試後再嘗試...`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒後重試
      }
    }

    const port = config.port || 3000;
    
    // 儲存伺服器實例以便優雅關閉
    const server = app.listen(port, () => {
      console.log(`伺服器運行在 port ${port}`);
      console.log('環境:', process.env.NODE_ENV || 'development');
      console.log('系統資訊:', {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        memory: Math.round(os.totalmem() / (1024 * 1024 * 1024)) + 'GB',
        freemem: Math.round(os.freemem() / (1024 * 1024 * 1024)) + 'GB'
      });
    });
    
    // 設置Keep-Alive超時
    server.keepAliveTimeout = 65000; // 65秒
    server.headersTimeout = 66000; // 66秒
    
    // 優雅關閉 - 修正變量引用
    process.on('SIGTERM', () => {
      console.log('收到 SIGTERM 信號，準備關閉伺服器...');
      server.close(() => {
        console.log('伺服器已關閉');
        process.exit(0);
      });
      
      // 設置強制關閉超時
      setTimeout(() => {
        console.error('無法優雅關閉，強制退出');
        process.exit(1);
      }, 30000);
    });
    
    // 處理未捕獲的錯誤
    process.on('uncaughtException', (error) => {
      console.error('未捕獲的異常:', error);
      // 不立即退出，讓當前請求有機會完成
      setTimeout(() => {
        process.exit(1);
      }, 3000);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('未處理的Promise拒絕:', reason);
    });

    return server;

  } catch (error) {
    console.error('伺服器啟動失敗:', error);
    process.exit(1);
  }
}

// 啟動服務器並導出伺服器實例
const serverPromise = startServer();

module.exports = app;