const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/config');


// 註冊
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // 檢查使用者是否已存在
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '使用者名稱或電子郵件已被使用'
      });
    }

    // 創建新使用者
    const user = new User({
      username,
      email,
      password
    });

    await user.save();

    // 生成 JWT
    const token = jwt.sign(
      { id: user._id, username: user.username },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({
      success: false,
      message: error.message || '註冊失敗'
    });
  }
});

// 登入
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 檢查使用者是否存在
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '電子郵件或密碼錯誤'
      });
    }

    // 驗證密碼
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: '電子郵件或密碼錯誤'
      });
    }

    // 生成 JWT (包含 role)
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(400).json({
      success: false,
      message: error.message || '登入失敗'
    });
  }
});

// 檢查 token
router.get('/verify', async (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: '未提供 token'
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '使用者不存在'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: '無效的 token'
    });
  }
});

// 忘記密碼路由
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
      const user = await User.findOne({ email });
      if (!user) {
          return res.status(404).json({ message: '該電子郵件未註冊' });
      }

      // 生成重設密碼 token
      const token = crypto.randomBytes(20).toString('hex');
      user.resetPasswordToken = token;
      user.resetPasswordExpires = Date.now() + 3600000; // 1小時有效
      await user.save();

      // 發送電子郵件
      const transporter = nodemailer.createTransport({
          service: 'Gmail',
          auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS
          }
      });

      const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;
      const mailOptions = {
          to: user.email,
          from: 'noreply@yourdomain.com',
          subject: '密碼重設請求',
          text: `點擊以下連結重設密碼：\n\n${resetUrl}\n\n如果你未請求此操作，請忽略此郵件。`
      };

      await transporter.sendMail(mailOptions);

      res.json({ message: '重設密碼的連結已發送至您的電子郵件' });
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: '發送電子郵件失敗，請稍後再試。' });
  }
});


// 重設密碼路由
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  try {
      const user = await User.findOne({
          resetPasswordToken: token,
          resetPasswordExpires: { $gt: Date.now() }
      });

      if (!user) {
          return res.status(400).json({ message: '無效或已過期的重設密碼 token' });
      }

      // 直接設置新密碼，讓 mongoose 中間件處理加密
      user.password = newPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      
      await user.save(); // 這會觸發 pre('save') 中間件

      res.json({ message: '密碼已成功重設，請重新登入' });
  } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: '密碼重設失敗，請稍後再試。' });
  }
});

module.exports = router;