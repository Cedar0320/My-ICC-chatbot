const mongoose = require('mongoose');
const User = require('../models/User');
const config = require('../config/config');

async function updateUserRoles() {
    try {
        // 連接資料庫
        await mongoose.connect(config.mongodb.uri);
        console.log('✅ MongoDB 已連接');

        // 獲取所有使用者
        const allUsers = await User.find();
        console.log(`📊 總共有 ${allUsers.length} 個使用者`);

        // 更新所有沒有 role 欄位或 role 為 undefined 的使用者
        let updatedCount = 0;
        for (const user of allUsers) {
            if (!user.role) {
                // 如果 username 是 'admin'，設為 admin，否則設為 user
                const newRole = user.username === 'admin' ? 'admin' : 'user';

                // 使用 updateOne 直接更新資料庫
                await User.updateOne(
                    { _id: user._id },
                    { $set: { role: newRole } }
                );

                updatedCount++;
                console.log(`✅ 更新使用者: ${user.username} (${user.email}) -> role: ${newRole}`);
            } else {
                console.log(`ℹ️  使用者已有 role: ${user.username} -> ${user.role}`);
            }
        }

        console.log(`\n更新了 ${updatedCount} 個使用者`);

        console.log('==========================================');
        console.log('✅ 所有使用者的 role 已更新完成！');
        console.log('==========================================');

        // 顯示所有使用者的角色
        const finalUsers = await User.find().select('username email role');
        console.log('\n📋 使用者列表:');
        finalUsers.forEach(user => {
            console.log(`  - ${user.username} (${user.email}): ${user.role}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ 更新失敗:', error);
        process.exit(1);
    }
}

updateUserRoles();
