const jwt = require('jsonwebtoken');
const config = require('../config/config');

/**
 * Admin 認證中間件
 * 驗證 JWT token 且確認用戶為 admin 角色
 */
const adminAuth = (req, res, next) => {
    try {
        // 從 header 獲取 token
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                message: '未提供認證令牌'
            });
        }

        // 驗證 token
        const decoded = jwt.verify(token, config.jwt.secret);
        console.log('Admin 認證 - Decoded token:', { id: decoded.id, username: decoded.username, role: decoded.role });

        // 檢查是否為 admin
        if (decoded.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '權限不足,需要管理員權限'
            });
        }

        // 將解碼後的用戶資訊附加到請求對象
        req.user = decoded;
        next();

    } catch (error) {
        console.error('Admin 認證失敗:', error);
        return res.status(401).json({
            success: false,
            message: '認證令牌無效或已過期'
        });
    }
};

module.exports = adminAuth;
