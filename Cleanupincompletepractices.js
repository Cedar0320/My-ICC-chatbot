/**
 * cleanupIncompletePractices.js
 *
 * 清理資料庫中沒有 analysis 的不完整練習紀錄。
 *
 * 使用方式：
 *   乾跑（只報告，不刪除）：
 *     node cleanupIncompletePractices.js
 *     node cleanupIncompletePractices.js --dry-run
 *
 *   正式執行（真正刪除）：
 *     node cleanupIncompletePractices.js --execute
 *
 * 建議先用 --dry-run 確認數字後，再用 --execute 執行。
 */

'use strict';

const path = require('path');
const mongoose = require('mongoose');

// ─── 讀取設定（與 app.js 相同路徑） ───────────────────────────────────────────
require('dotenv').config({ path: path.join(__dirname, '.env') });
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/communicationTraining';

// ─── 解析執行模式 ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');

// ─── 使用專案原本的 User model（確保 collection 名稱與 schema 完全一致） ──────
const User = require('./models/User');

// ─── 主程式 ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('════════════════════════════════════════════════════');
  console.log('  不完整練習清理工具');
  console.log(`  模式：${DRY_RUN ? '🔍 乾跑（只報告，不刪除）' : '🗑️  正式執行（將實際刪除）'}`);
  console.log('════════════════════════════════════════════════════\n');

  // 1. 連線
  console.log(`📡 連接資料庫：${MONGODB_URI}`);
  await mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('✅ 資料庫連線成功\n');

  // 2. 掃描所有使用者
  const users = await User.find({}, 'username email practices').lean();
  console.log(`👥 共找到 ${users.length} 位使用者，開始掃描...\n`);

  let totalPractices = 0;
  let totalIncomplete = 0;
  const report = []; // 每位使用者的摘要

  for (const user of users) {
    const practices = user.practices || [];
    const incomplete = practices.filter(
      (p) => !p.analysis || p.analysis.toString().trim() === ''
    );

    totalPractices += practices.length;
    totalIncomplete += incomplete.length;

    if (incomplete.length > 0) {
      report.push({
        userId: user._id,
        username: user.username || user.email || String(user._id),
        total: practices.length,
        incomplete: incomplete.length,
        incompleteIds: incomplete.map((p) => String(p._id)),
      });
    }
  }

  // 3. 報告
  console.log('─── 掃描結果 ───────────────────────────────────────');
  console.log(`  全部練習紀錄：${totalPractices} 筆`);
  console.log(`  有 analysis ：${totalPractices - totalIncomplete} 筆`);
  console.log(`  缺少 analysis：${totalIncomplete} 筆  ← 將被清理`);
  console.log(`  受影響使用者：${report.length} 位\n`);

  if (report.length > 0) {
    console.log('─── 受影響使用者明細 ────────────────────────────────');
    for (const r of report) {
      console.log(
        `  ${r.username.padEnd(20)} 總練習 ${String(r.total).padStart(4)} 筆 ｜ 將刪除 ${String(r.incomplete).padStart(4)} 筆`
      );
      if (DRY_RUN) {
        // 乾跑模式下印出要刪除的 practice ID，方便核對
        r.incompleteIds.forEach((id) => console.log(`    - ${id}`));
      }
    }
    console.log('');
  }

  // 4. 若為乾跑模式，到此結束
  if (DRY_RUN) {
    console.log('════════════════════════════════════════════════════');
    console.log('  ✋ 乾跑完成，未執行任何刪除。');
    console.log('  確認無誤後，請執行：');
    console.log('    node cleanupIncompletePractices.js --execute');
    console.log('════════════════════════════════════════════════════\n');
    await mongoose.disconnect();
    return;
  }

  // 5. 正式執行刪除
  console.log('─── 開始刪除 ────────────────────────────────────────');
  let successCount = 0;
  let failCount = 0;

  for (const r of report) {
    try {
      // 使用 $pull 搭配 $in 一次移除該使用者所有不完整的練習
      const result = await User.updateOne(
        { _id: r.userId },
        {
          $pull: {
            practices: {
              _id: { $in: r.incompleteIds.map((id) => new mongoose.Types.ObjectId(id)) },
            },
          },
        }
      );

      console.log(
        `  ✅ ${r.username}：已刪除 ${r.incomplete} 筆（modifiedCount: ${result.modifiedCount}）`
      );
      successCount += r.incomplete;
    } catch (err) {
      console.error(`  ❌ ${r.username}：刪除失敗 - ${err.message}`);
      failCount += r.incomplete;
    }
  }

  console.log('');
  console.log('════════════════════════════════════════════════════');
  console.log(`  🎉 清理完成`);
  console.log(`  成功刪除：${successCount} 筆`);
  if (failCount > 0) console.log(`  刪除失敗：${failCount} 筆（請查看上方錯誤訊息）`);
  console.log('════════════════════════════════════════════════════\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ 執行失敗：', err);
  mongoose.disconnect().finally(() => process.exit(1));
});