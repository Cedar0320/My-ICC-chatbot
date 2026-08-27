const mongoose = require('mongoose');
const User = require('../models/User');
const config = require('../config/config');

async function createAdminUser() {
    try {
        // 連接資料庫
        await mongoose.connect(config.mongodb.uri);
        console.log('✅ MongoDB 已連接');

        // 檢查是否已經有 admin 使用者
        const existingAdmin = await User.findOne({ username: 'admin' });

        if (existingAdmin) {
            console.log('⚠️  Admin 使用者已存在');
            console.log('使用者名稱: admin');
            console.log('如需重設密碼,請手動刪除後重新執行此腳本');
            process.exit(0);
        }

        // 建立 admin 使用者
        const adminUser = new User({
            username: 'admin',
            email: 'admin@commai.com',
            password: 'admin123456', // 會自動經過 bcrypt 雜湊
            role: 'admin'
        });

        await adminUser.save();

        console.log('✅ Admin 使用者建立成功!');
        console.log('==========================================');
        console.log('使用者名稱: admin');
        console.log('密碼: admin123456');
        console.log('電子郵件: admin@commai.com');
        console.log('角色: admin');
        console.log('==========================================');
        console.log('請記住這些登入資訊!');
        console.log('登入網址: http://localhost:3037/admin-login.html');

        process.exit(0);
    } catch (error) {
        console.error('❌ 建立 Admin 使用者失敗:', error);
        process.exit(1);
    }
}

createAdminUser();
