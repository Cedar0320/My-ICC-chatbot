/**
 * NPC 像素角色動畫整合腳本 - v2.0
 * 支持多角色選擇（爸爸/媽媽）和對應語音
 */

// ==========================================
// NPC 像素角色動畫控制器類
// ==========================================
class NPCAvatarController {
    constructor() {
        // DOM 元素
        this.avatarImg = document.getElementById('npcAvatar');
        this.avatarPanel = document.getElementById('npcAvatarPanel');
        this.audioPlayer = document.getElementById('npcAudioPlayer');
        this.statusIndicator = document.getElementById('npcStatusIndicator');
        
        // 動畫狀態
        this.isAnimating = false;
        this.animationInterval = null;
        
        // 多角色圖片配置
        this.characterSets = {
            mother: {
                name: '媽媽',
                idle: '/assets/mother-idle.png',
                talkFrames: [
                    '/assets/mother-talk1.png',
                    '/assets/mother-talk2.png',
                    '/assets/mother-talk3.png',
                    '/assets/mother-talk4.png',
                    '/assets/mother-talk5.png'
                ],
                voice: 'nova'  // OpenAI TTS 女聲
            },
            father: {
                name: '爸爸',
                idle: '/assets/father-idle.png',
                talkFrames: [
                    '/assets/father-talk1.png',
                    '/assets/father-talk2.png'
                ],
                voice: 'onyx'  // OpenAI TTS 男聲
            }
        };
        
        // 當前角色（默認為媽媽）
        this.currentCharacter = 'mother';
        this.images = this.characterSets.mother;
        
        // 動畫設定
        this.frameInterval = 120; // 每120ms切換一次圖片（更流暢）
        this.currentFrame = 0;
        
        // 綁定音訊事件
        this.setupAudioEvents();
        
        console.log('✅ NPC Avatar Controller v2.0 初始化完成');
    }
    
    /**
     * 設置當前角色
     * @param {string} characterType - 角色類型 ('mother' 或 'father')
     */
    setCharacter(characterType) {
        if (this.characterSets[characterType]) {
            this.currentCharacter = characterType;
            this.images = this.characterSets[characterType];
            
            // 更新圖片
            if (this.avatarImg && !this.isAnimating) {
                this.avatarImg.src = this.images.idle;
            }
            
            console.log(`✅ 切換角色為: ${this.characterSets[characterType].name}`);
        } else {
            console.warn(`⚠️ 未知的角色類型: ${characterType}`);
        }
    }
    
    /**
     * 獲取當前角色的語音類型
     * @returns {string} OpenAI TTS 語音類型
     */
    getCurrentVoice() {
        return this.characterSets[this.currentCharacter].voice;
    }
    
    /**
     * 獲取當前角色名稱
     * @returns {string} 角色名稱
     */
    getCurrentCharacterName() {
        return this.characterSets[this.currentCharacter].name;
    }
    
    setupAudioEvents() {
        if (this.audioPlayer) {
            this.audioPlayer.addEventListener('play', () => {
                console.log('🎵 音訊開始播放，啟動說話動畫');
                this.startTalkingAnimation();
            });
            
            this.audioPlayer.addEventListener('ended', () => {
                console.log('✅ 音訊播放結束，停止說話動畫');
                this.stopTalkingAnimation();
            });
            
            this.audioPlayer.addEventListener('pause', () => {
                this.stopTalkingAnimation();
            });
            
            this.audioPlayer.addEventListener('error', (e) => {
                console.error('❌ 音訊播放錯誤:', e);
                this.stopTalkingAnimation();
            });
        }
    }
    
    show() {
        if (this.avatarPanel) {
            this.avatarPanel.style.display = 'block';
            // 顯示外層並排容器
            const dialogueWithAvatar = document.getElementById('dialogueWithAvatar');
            if (dialogueWithAvatar) {
                dialogueWithAvatar.style.display = 'flex';
            }
            // 更新標題顯示當前角色
            const title = this.avatarPanel.querySelector('h3');
            if (title) {
                title.textContent = `👤 ${this.getCurrentCharacterName()}`;
            }
            console.log('👤 顯示NPC角色面板:', this.getCurrentCharacterName());
        }
    }
    
    hide() {
        if (this.avatarPanel) {
            this.avatarPanel.style.display = 'none';
            this.stopTalkingAnimation();
            // 隱藏外層並排容器
            const dialogueWithAvatar = document.getElementById('dialogueWithAvatar');
            if (dialogueWithAvatar) {
                dialogueWithAvatar.style.display = 'none';
            }
        }
    }
    
    startTalkingAnimation() {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        this.currentFrame = 0;
        
        if (this.statusIndicator) {
            this.statusIndicator.classList.add('talking');
        }
        
        this.animationInterval = setInterval(() => {
            if (this.avatarImg && this.images.talkFrames.length > 0) {
                const frameIndex = this.currentFrame % this.images.talkFrames.length;
                this.avatarImg.src = this.images.talkFrames[frameIndex];
                this.currentFrame++;
            }
        }, this.frameInterval);
    }
    
    stopTalkingAnimation() {
        if (!this.isAnimating) return;
        
        this.isAnimating = false;
        
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
        
        if (this.avatarImg) {
            this.avatarImg.src = this.images.idle;
        }
        
        if (this.statusIndicator) {
            this.statusIndicator.classList.remove('talking');
        }
        
        this.currentFrame = 0;
    }
    
    playAudioWithAnimation(audioUrl) {
        if (!audioUrl) {
            console.warn('⚠️ 未提供音訊URL');
            return;
        }
        
        this.stopAudio();
        
        if (this.audioPlayer) {
            this.audioPlayer.src = audioUrl;
            
            this.audioPlayer.play()
                .then(() => {
                    console.log('✅ 音訊播放成功:', audioUrl);
                })
                .catch(error => {
                    console.error('❌ 音訊播放失敗:', error);
                    this.stopTalkingAnimation();
                });
        }
    }
    
    stopAudio() {
        if (this.audioPlayer) {
            this.audioPlayer.pause();
            this.audioPlayer.currentTime = 0;
        }
        this.stopTalkingAnimation();
    }
    
    setAnimationSpeed(interval) {
        this.frameInterval = interval;
        if (this.isAnimating) {
            this.stopTalkingAnimation();
            this.startTalkingAnimation();
        }
    }
    
    reset() {
        this.stopAudio();
        this.stopTalkingAnimation();
        if (this.avatarImg) {
            this.avatarImg.src = this.images.idle;
        }
    }
}

// ==========================================
// 整合到現有系統
// ==========================================

// 全局NPC控制器實例
let npcAvatarController = null;

// 在頁面加載時初始化NPC控制器
// [npcIntegration.js 底部]

// 在頁面加載時初始化NPC控制器
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        // 確保這裡賦值給 window 對象
        window.npcAvatarController = new NPCAvatarController(); 
        npcAvatarController = window.npcAvatarController; // 保持本地變數同步

        // 📝 檢查並設置初始角色
        const characterSelect = document.getElementById('characterSelect');
        if (characterSelect) {
            const initialCharacter = characterSelect.value || 'mother';
            window.npcAvatarController.setCharacter(initialCharacter);
            // 注意：初始化時不要呼叫 show()，以免頁面剛載入就跳出角色擋住畫面
            // 只有在使用者「手動切換」時才顯示 (如步驟1所做的修改)
            console.log('🎮 初始角色設置為:', initialCharacter);
        }

        console.log('🎮 NPC動畫系統 v2.0 已就緒');
    }, 500);
});
// ==========================================
// RPG 風格對話管理
// ==========================================

// 儲存完整對話記錄
let fullDialogueHistory = [];
let isInPracticeMode = false;

// ==========================================
// 覆蓋原有的 updateDialogueDisplay 函數
// ==========================================

const originalUpdateDialogueDisplay = window.updateDialogueDisplay;

window.updateDialogueDisplay = function(speaker, message, audioFilePath = null) {
    // 儲存到完整對話記錄
    fullDialogueHistory.push({
        speaker: speaker,
        message: message,
        audioFilePath: audioFilePath,
        timestamp: new Date()
    });
    
    const dialogueDisplay = document.getElementById('dialogueDisplay');
    const speakerType = speaker.toLowerCase() === 'teacher' || speaker === '老師' ? '老師' : '家長';
    
    // 判斷是否在練習模式中
    if (isInPracticeMode && dialogueDisplay) {
        // RPG 風格：只顯示最新消息
        dialogueDisplay.classList.add('rpg-mode');
        dialogueDisplay.innerHTML = ''; // 清空舊內容
        
        // 創建新消息元素
        const messageDiv = createMessageElement(speaker, message, audioFilePath, speakerType);
        dialogueDisplay.appendChild(messageDiv);
        
    } else {
        // 完整記錄模式：調用原始函數
        if (typeof originalUpdateDialogueDisplay === 'function') {
            originalUpdateDialogueDisplay(speaker, message, audioFilePath);
        }
    }
    
    // 家長回應時觸發 NPC 動畫
    if (speakerType === '家長' && audioFilePath && npcAvatarController) {
        console.log('🎭 家長回應，觸發NPC動畫');
        npcAvatarController.show();
        npcAvatarController.playAudioWithAnimation(audioFilePath);
    }
};

// 創建消息元素的輔助函數
function createMessageElement(speaker, message, audioFilePath, speakerType) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${speakerType}`;
    
    const icon = speakerType === '老師' ? '👩‍🏫' : '👤';
    const alignment = speakerType === '老師' ? 'right' : 'left';
    
    messageDiv.innerHTML = `
        <div class="message-header" style="text-align: ${alignment}; font-weight: bold; margin-bottom: 5px;">
            ${icon} ${speakerType}
        </div>
        <div class="message-content" style="font-size: 1.1em;">
            ${message}
            ${audioFilePath ? `
                <button class="play-audio-btn" onclick="playAudio('${audioFilePath}')" title="播放語音">
                    🔊 播放
                </button>
            ` : ''}
        </div>
        <div class="message-time" style="text-align: ${alignment}; font-size: 0.85em; opacity: 0.7; margin-top: 5px;">
            ${new Date().toLocaleTimeString()}
        </div>
    `;
    
    return messageDiv;
}

// 顯示完整對話記錄
function showFullDialogueHistory() {
    const dialogueDisplay = document.getElementById('dialogueDisplay');
    if (!dialogueDisplay) return;
    
    dialogueDisplay.classList.remove('rpg-mode');
    dialogueDisplay.innerHTML = '';
    
    fullDialogueHistory.forEach(item => {
        const speakerType = item.speaker.toLowerCase() === 'teacher' || item.speaker === '老師' ? '老師' : '家長';
        const messageDiv = createMessageElement(item.speaker, item.message, item.audioFilePath, speakerType);
        dialogueDisplay.appendChild(messageDiv);
    });
    
    // 滾動到底部 - 已停用，讓用戶自行控制
    // dialogueDisplay.scrollTop = dialogueDisplay.scrollHeight;
}

// ==========================================
// 覆蓋原有的 playAudio 函數
// ==========================================

const originalPlayAudio = window.playAudio;

window.playAudio = function(audioFilePath) {
    console.log('🎵 播放音訊:', audioFilePath);
    
    if (window.currentAudioPlayer) {
        window.currentAudioPlayer.pause();
        window.currentAudioPlayer = null;
    }
    
    if (npcAvatarController) {
        npcAvatarController.show();
        npcAvatarController.playAudioWithAnimation(audioFilePath);
    } else {
        if (typeof originalPlayAudio === 'function') {
            originalPlayAudio(audioFilePath);
        } else {
            window.currentAudioPlayer = new Audio(audioFilePath);
            window.currentAudioPlayer.play().catch(error => {
                console.error('播放音頻失敗:', error);
            });
        }
    }
};

// ==========================================
// 練習相關事件監聽
// ==========================================

document.addEventListener('practiceStarted', () => {
    if (npcAvatarController) {
        npcAvatarController.show();
        npcAvatarController.reset();
        console.log('🎬 練習開始，顯示NPC角色');
    }
    
    // 進入練習模式（RPG風格）
    isInPracticeMode = true;
    fullDialogueHistory = []; // 清空對話記錄
    
    const dialogueDisplay = document.getElementById('dialogueDisplay');
    if (dialogueDisplay) {
        dialogueDisplay.classList.add('rpg-mode');
        dialogueDisplay.innerHTML = '';
    }
});

document.addEventListener('practiceEnded', () => {
    if (npcAvatarController) {
        setTimeout(() => {
            npcAvatarController.stopAudio();
            console.log('🏁 練習結束，停止NPC音訊');
        }, 1000);
    }
    
    // 退出練習模式，顯示完整對話記錄
    isInPracticeMode = false;
    
    setTimeout(() => {
        showFullDialogueHistory();
        console.log('📜 顯示完整對話記錄');
    }, 1500);
});

// ==========================================
// 工具函數
// ==========================================

window.testNPCAnimation = function() {
    if (npcAvatarController) {
        npcAvatarController.show();
        npcAvatarController.startTalkingAnimation();
        setTimeout(() => {
            npcAvatarController.stopTalkingAnimation();
        }, 3000);
    } else {
        console.error('❌ NPC控制器未初始化');
    }
};

window.testNPCAudio = function(audioUrl) {
    if (npcAvatarController) {
        npcAvatarController.show();
        npcAvatarController.playAudioWithAnimation(audioUrl);
    } else {
        console.error('❌ NPC控制器未初始化');
    }
};

// 新增：切換角色測試函數
window.testCharacterSwitch = function(characterType) {
    if (npcAvatarController) {
        npcAvatarController.setCharacter(characterType);
        npcAvatarController.show();
    } else {
        console.error('❌ NPC控制器未初始化');
    }
};

// 新增：手動切換對話顯示模式
window.toggleDialogueMode = function() {
    isInPracticeMode = !isInPracticeMode;
    if (isInPracticeMode) {
        const dialogueDisplay = document.getElementById('dialogueDisplay');
        if (dialogueDisplay) {
            dialogueDisplay.classList.add('rpg-mode');
        }
        console.log('🎮 切換到 RPG 模式');
    } else {
        showFullDialogueHistory();
        console.log('📜 切換到完整記錄模式');
    }
};

console.log('✅ NPC動畫整合腳本 v2.0 已載入（支持多角色 + RPG對話風格）');