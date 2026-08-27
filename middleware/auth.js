const authService = require('../services/authService');

function authMiddleware(req, res, next) {
  try {
    // 從 header 獲取 token
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: '請先登入' });
    }

    // 驗證 token
    const decoded = authService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: '認證失敗' });
  }
}

module.exports = authMiddleware;