// const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');

// // 定義 User 模型
// const UserSchema = new mongoose.Schema({
//   username: {
//     type: String,
//     required: [true, '使用者名稱為必填'],
//     unique: true,
//     trim: true,
//     minlength: [3, '使用者名稱至少需要3個字元'],
//     maxlength: [20, '使用者名稱不能超過20個字元']
//   },
//   email: {
//     type: String,
//     required: [true, '電子郵件為必填'],
//     unique: true,
//     trim: true,
//     lowercase: true,
//     match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, '請輸入有效的電子郵件']
//   },
//   password: {
//     type: String,
//     required: [true, '密碼為必填'],
//     minlength: [6, '密碼至少需要6個字元']
//   },
//   role: {
//     type: String,
//     enum: ['user', 'admin'],
//     default: 'user'
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now
//   },
//   // 新增 practices 欄位
//   practices: [
//     {
//       createdAt: {
//         type: Date,
//         default: Date.now // 每個練習的創建時間
//       },
//       scenario: {
//         type: String, // 儲存情境內容
//       },
//       technique: {
//         type: String, // 溝通技巧名稱
//         required: [true, '溝通技巧為必填']
//       },
//       isNonverbalEnabled: {
//         type: Boolean,
//         default: false
//       },
//       history: [
//         {
//           role: {
//             type: String, // 角色：如 "家長" 或 "導師"
//             enum: ['家長', '導師'], // 僅限這兩個值
//             required: [true, '角色為必填']
//           },
//           content: {
//             type: String, // 聊天內容
//             required: [true, '聊天內容為必填']
//           },
//           timestamp: {
//             type: Date,
//             default: Date.now
//           },
//           // 非語言數據欄位(僅導師回應有此欄位)
//           nonverbalData: {
//             eyeContactRate: {
//               type: Number, // 眼神接觸率 (0-100)
//               min: 0,
//               max: 100
//             },
//             smileRate: {
//               type: Number, // 微笑率 (0-100)
//               min: 0,
//               max: 100
//             },
//             openPostureRate: {
//               type: Number, // 開放姿態率 (0-100)
//               min: 0,
//               max: 100
//             },
//             gesturesUsed: {
//               type: Number, // 手勢使用次數
//               min: 0
//             },
//             gesturesList: [{
//               name: String, // 手勢名稱 (Thumb_Up, Victory, etc.)
//               timestamp: Number // 發生時間戳
//             }],
//             // 原始統計數據(用於除錯/驗證)
//             rawData: {
//               eyeContact: {
//                 good: Number,
//                 total: Number
//               },
//               smile: {
//                 smiling: Number,
//                 total: Number
//               },
//               posture: {
//                 open: Number,
//                 total: Number
//               }
//             },
//             // 數據品質指標
//             dataQuality: {
//               sampleCount: Number,      // 採樣幀數
//               duration: Number,         // 錄音時長(秒)
//               faceDetectionRate: Number // 臉部偵測成功率
//             },
//             collectedAt: {
//               type: Date,
//               default: Date.now
//             }
//           }
//         }
//       ],
//       recordings: [
//         {
//           timestamp: {
//             type: Date, // 錄音的時間戳
//             default: Date.now
//           },
//           path: {
//             type: String, // 錄音檔案的路徑
//             required: [true, '錄音檔案路徑為必填']
//           },
//           transcription: {
//             type: String // 錄音文字轉譯（選填）
//           }
//         }
//       ],
//       analysis: {
//         type: String // 分析結果文字（選填）
//       },

//       difficulty: { type: String, enum: ['簡單', '挑戰'], default: '簡單' },

//       isRetry: {
//         type: Boolean,
//         default: false
//       },

//       originalPracticeId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Practice',
//         default: null
//       },
      
//       feedback: [
//         {
//           userId: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'User',
//             required: true
//           },
//           comment: {
//             type: String,
//             required: [true, '回饋內容為必填'],
//             minlength: [1, '回饋內容至少需要1個字元']
//           },
//           createdAt: {
//             type: Date,
//             default: Date.now
//           }
//         }
//       ],

//       // 整體練習的非語言表現摘要
//       nonverbalSummary: {
//         averageEyeContactRate: Number,
//         averageSmileRate: Number,
//         averageOpenPostureRate: Number,
//         totalGesturesUsed: Number,
//         teacherTurnsWithNonverbalData: Number, // 有非語言數據的導師回合數
//         calculatedAt: Date
//       }
//     }
//   ],
//   resetPasswordToken: String,
//   resetPasswordExpires: Date
// });

// // 密碼雜湊中間件
// UserSchema.pre('save', async function(next) {
//   if (!this.isModified('password')) return next();
  
//   try {
//     const salt = await bcrypt.genSalt(10);
//     this.password = await bcrypt.hash(this.password, salt);
//     next();
//   } catch (error) {
//     next(error);
//   }
// });

// // 驗證密碼的方法
// UserSchema.methods.comparePassword = async function(candidatePassword) {
//   return bcrypt.compare(candidatePassword, this.password);
// };

// module.exports = mongoose.model('User', UserSchema);

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 定義 User 模型
const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, '使用者名稱為必填'],
    unique: true,
    trim: true,
    minlength: [3, '使用者名稱至少需要3個字元'],
    maxlength: [20, '使用者名稱不能超過20個字元']
  },
  email: {
    type: String,
    required: [true, '電子郵件為必填'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, '請輸入有效的電子郵件']
  },
  password: {
    type: String,
    required: [true, '密碼為必填'],
    minlength: [6, '密碼至少需要6個字元']
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // 新增 practices 欄位
  practices: [
    {
      createdAt: {
        type: Date,
        default: Date.now // 每個練習的創建時間
      },
      scenario: {
        type: String, // 儲存情境內容
      },
      technique: {
        type: String, // 溝通技巧名稱
        required: [true, '溝通技巧為必填']
      },
      isNonverbalEnabled: {
        type: Boolean,
        default: false
      },
      history: [
        {
          role: {
            type: String, // 角色：如 "家長" 或 "導師"
            enum: ['家長', '導師'], // 僅限這兩個值
            required: [true, '角色為必填']
          },
          content: {
            type: String, // 聊天內容
            required: [true, '聊天內容為必填']
          },
          timestamp: {
            type: Date,
            default: Date.now
          },
          // 非語言數據欄位(僅導師回應有此欄位)
          nonverbalData: {
            eyeContactRate: {
              type: Number, // 眼神接觸率 (0-100)
              min: 0,
              max: 100
            },
            smileRate: {
              type: Number, // 微笑率 (0-100)
              min: 0,
              max: 100
            },
            openPostureRate: {
              type: Number, // 開放姿態率 (0-100)
              min: 0,
              max: 100
            },
            gesturesUsed: {
              type: Number, // 手勢使用次數
              min: 0
            },
            gesturesList: [{
              name: String, // 手勢名稱 (Thumb_Up, Victory, etc.)
              timestamp: Number // 發生時間戳
            }],
            // 原始統計數據(用於除錯/驗證)
            rawData: {
              eyeContact: {
                good: Number,
                total: Number
              },
              smile: {
                smiling: Number,
                total: Number
              },
              posture: {
                open: Number,
                total: Number
              }
            },
            // 數據品質指標
            dataQuality: {
              sampleCount: Number,      // 採樣幀數
              duration: Number,         // 錄音時長(秒)
              faceDetectionRate: Number // 臉部偵測成功率
            },
            collectedAt: {
              type: Date,
              default: Date.now
            }
          }
        }
      ],
      recordings: [
        {
          timestamp: {
            type: Date, // 錄音的時間戳
            default: Date.now
          },
          path: {
            type: String, // 錄音檔案的路徑
            required: [true, '錄音檔案路徑為必填']
          },
          transcription: {
            type: String // 錄音文字轉譯（選填）
          }
        }
      ],
      analysis: {
        type: String // 分析結果文字（選填）
      },

      difficulty: { type: String, enum: ['簡單', '挑戰'], default: '簡單' },

      isRetry: {
        type: Boolean,
        default: false
      },

      originalPracticeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Practice',
        default: null
      },
      
      feedback: [
        {
          userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
          },
          comment: {
            type: String,
            required: [true, '回饋內容為必填'],
            minlength: [1, '回饋內容至少需要1個字元']
          },
          createdAt: {
            type: Date,
            default: Date.now
          }
        }
      ],

      // 整體練習的非語言表現摘要
      nonverbalSummary: {
        averageEyeContactRate: Number,
        averageSmileRate: Number,
        averageOpenPostureRate: Number,
        totalGesturesUsed: Number,
        teacherTurnsWithNonverbalData: Number, // 有非語言數據的導師回合數
        calculatedAt: Date
      }
    }
  ],
  resetPasswordToken: String,
  resetPasswordExpires: Date
});

// 密碼雜湊中間件
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 驗證密碼的方法
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);