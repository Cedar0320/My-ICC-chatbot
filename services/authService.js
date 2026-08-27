const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

class AuthService {
  // 註冊新使用者
  async register(userData) {
    try {
      const { username, email, password } = userData;
      
      // 檢查使用者是否已存在
      const existingUser = await User.findOne({ 
        $or: [{ email }, { username }] 
      });
      
      if (existingUser) {
        throw new Error('使用者名稱或電子郵件已被使用');
      }

      // 加密密碼
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // 創建新使用者
      const user = new User({
        username,
        email,
        password: hashedPassword
      });

      await user.save();
      
      // 生成 JWT
      const token = this.generateToken(user);
      
      return { token, user: { id: user._id, username: user.username, email: user.email } };
    } catch (error) {
      throw error;
    }
  }

  // 使用者登入
  async login(email, password) {
    try {
      // 查找使用者
      const user = await User.findOne({ email });
      if (!user) {
        throw new Error('使用者不存在');
      }

      // 驗證密碼
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        throw new Error('密碼錯誤');
      }

      // 生成 JWT
      const token = this.generateToken(user);
      
      return { token, user: { id: user._id, username: user.username, email: user.email } };
    } catch (error) {
      throw error;
    }
  }

  // 生成 JWT Token
  generateToken(user) {
    return jwt.sign(
      { id: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  // 驗證 Token
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('無效的 token');
    }
  }
}

module.exports = new AuthService();