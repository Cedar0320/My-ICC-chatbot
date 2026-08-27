// ==========================================
// 全域變數定義
// ==========================================
let currentPracticeId = null;
let isNonverbalEnabled = false;
let nonverbalAnalysisActive = false;
let recordingTimer = null; // 用於跟踪錄音時間的計時器
const MAX_RECORDING_TIME = 120;  // 最大錄音時間（秒）
let recordingProgress = 0; // 錄音進度（0-100）
let isRecordingTimeDisplay = false; // 是否顯示倒計時

// 分頁相關變數
let currentPracticePage = 1;
const practicesPerPage = 10;
let totalPracticePages = 1;
let currentFilters = {};

let countdownTimer = null; 
let challengeTimer = null; // 挑戰倒計時計時器
let countdownRemaining = 300; // 倒計時剩餘時間（以秒為單位）5分鐘
let totalChallengeExtension = 0; // 累計已延長秒數（最多60秒）
let mediaRecorder = null;
let audioChunks = [];
let dialogueCount = 0;

// 基礎模式評分門檻：導師回覆 6 次後產生分析（後端 count>=12 因為家長/導師都算）
const BASIC_TURN_LIMIT = 6;
let turnProgress = { count: 0, limit: null };

function setTurnProgress(count, limit) {
    if (typeof count === 'number') turnProgress.count = count;
    turnProgress.limit = (limit === null || typeof limit === 'number') ? limit : turnProgress.limit;
}

function getTurnProgressText() {
    if (turnProgress.limit === null || typeof turnProgress.limit !== 'number') return '';
    return `（進度 ${turnProgress.count}/${turnProgress.limit}）`;
}

function getTaskAndReminder(technique, difficulty) {
    const isBasic = (difficulty === '簡單');
    const map = {
        '我訊息': {
            task: isBasic
                ? '請你以導師身分，使用「我訊息」主動聯繫家長。請說明你觀察到的具體情況、表達你的感受或擔心，並邀請家長一起了解原因或討論協助方式。'
                : '請你以導師身分，使用「我訊息」主動聯繫家長，開啟這次親師溝通。',
            reminder: isBasic
                ? '請記得包含以下重點：<br>1. 你觀察到的具體事件。<br>2. 你的感受或擔心。<br>3. 你擔心可能造成的影響。<br>4. 你希望與家長一起合作的方向。<br>5. 語氣要具體、溫和，避免責備學生或家長。'
                : '請盡量以具體、溫和、合作的方式表達你的觀察、擔心與合作方向。'
        },
        '三明治溝通法': {
            task: isBasic
                ? '請你以導師身分，使用「三明治溝通法」主動聯繫家長。請先肯定孩子或家長的正向面向，再溫和說明需要討論的問題，最後回到支持、鼓勵與合作的方向。'
                : '請你以導師身分，使用「三明治溝通法」主動聯繫家長，開啟這次親師溝通。',
            reminder: isBasic
                ? '請記得包含以下重點：<br>1. 先指出孩子的優點、努力或家長的用心。<br>2. 再具體說明目前需要關注的問題。<br>3. 說明問題可能造成的影響。<br>4. 最後回到鼓勵、支持與親師合作。<br>5. 語氣要真誠，避免讓肯定聽起來像客套或只是鋪陳責備。'
                : '請注意正向開場、問題說明與合作收束之間的平衡，語氣要真誠、具體，避免讓家長感覺只是先稱讚再批評。'
        },
        '綜合溝通技巧': {
            task: isBasic
                ? '請你以導師身分，綜合運用適合的親師溝通技巧，主動聯繫家長。請清楚說明情況，表達關心，回應家長可能的感受與疑問，並邀請家長一起討論協助孩子的方式。'
                : '請你以導師身分，綜合運用適合的親師溝通技巧，主動聯繫家長，開啟這次親師溝通。',
            reminder: isBasic
                ? '請在對話中注意以下重點：<br>1. 情感表現：能展現理解、關心與尊重，避免讓家長感到被責備。<br>2. 內容回應：能回應家長的疑問或擔心，不只重複自己的立場。<br>3. 清晰表達：能把事件、影響與合作方向說清楚，語氣自然且有條理。<br>4. 溝通技巧：能視情況運用我訊息、肯定、澄清、同理、邀請合作等技巧。<br>5. 對話目標是共同理解問題並協助孩子，而不是爭論責任。'
                : '請維持具體、溫和、合作的語氣，適時回應家長感受與疑問，讓對話朝向理解問題與協助孩子。'
        }
    };
    return map[technique] || { task: '請以導師身分開啟這次親師溝通。', reminder: '' };
}
let isWaitingForSubmission = false;
let submissionTimer = null;
let currentDialogueRecordings = [];
let isRecording = false;
const maxDialogues = 12;
let currentAccumulatedText = '';
let currentAudioPlayer = null; // 追蹤當前播放的音頻

// DOM 元素快取
const techniqueSelect = document.getElementById('techniqueSelect');
const startPracticeBtn = document.getElementById('startPracticeBtn');
const scenarioDisplay = document.getElementById('scenarioDisplay');
const dialogueDisplay = document.getElementById('dialogueDisplay');
const startRecordBtn = document.getElementById('startRecordBtn');
const stopRecordBtn = document.getElementById('stopRecordBtn');
const recordStatus = document.getElementById('recordStatus');
const analysisContent = document.getElementById('analysisContent');
const practiceSelect = document.getElementById('select-btn');
const difficultySelect = document.getElementById('difficultySelect');
const voiceInputControls = document.getElementById('voiceInputControls');
const textInputControls = document.getElementById('textInputControls');
const textInput = document.getElementById('textInput');
const submitTextBtn = document.getElementById('submitTextBtn');
const inputMethodRadios = document.querySelectorAll('input[name="inputMethod"]');
const enableNonverbalDetection = document.getElementById('enableNonverbalDetection');
const nonverbalWindow = document.getElementById('nonverbalWindow');
const textInputLabel = document.getElementById('textInputLabel');

// ==========================================
// 圖表渲染邏輯 (修正 Top-level await 問題)
// ==========================================
async function renderNonverbalProgressChart() {
    // 檢查元素是否存在，避免錯誤
    const canvas = document.getElementById('nonverbalProgressChart');
    if (!canvas) return; 
    
    const chartContainer = canvas.parentElement;

    // 等待 Chart.js 載入
    function waitForChartJs() {
        return new Promise(resolve => {
            if (window.Chart) return resolve();
            const check = setInterval(() => {
                if (window.Chart) {
                    clearInterval(check);
                    resolve();
                }
            }, 100);
        });
    }
    await waitForChartJs();

    try {
        const res = await fetchWithAuth('/api/nonverbal/progress');
        const data = await res.json();
        
        if (!data.success || !Array.isArray(data.progressData) || data.progressData.length === 0) {
            // 避免重複添加提示
            if (!chartContainer.querySelector('.no-data-msg')) {
                const p = document.createElement('p');
                p.className = 'no-data-msg';
                p.textContent = '尚無足夠非語言數據';
                chartContainer.appendChild(p);
            }
            return;
        }

        // 準備圖表資料
        const labels = data.progressData.map(p => {
            const d = new Date(p.date);
            return `${d.getMonth() + 1}/${d.getDate()}`;
        });
        const eyeContact = data.progressData.map(p => p.metrics.eyeContactRate ?? null);
        const smile = data.progressData.map(p => p.metrics.smileRate ?? null);
        const posture = data.progressData.map(p => p.metrics.openPostureRate ?? null);
        const gestures = data.progressData.map(p => p.metrics.totalGestures ?? null);

        // 銷毀舊圖表
        if (window.nonverbalProgressChartInstance) {
            window.nonverbalProgressChartInstance.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        window.nonverbalProgressChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: '眼神接觸率', data: eyeContact, borderColor: '#42a5f5', fill: false },
                    { label: '微笑率', data: smile, borderColor: '#e93ae1', fill: false },
                    { label: '開放姿態率', data: posture, borderColor: '#66bb6a', fill: false },
                    { label: '手勢次數', data: gestures, borderColor: '#ffa726', fill: false, yAxisID: 'y2' }
                ]
            },
            options: {
                responsive: true,
                interaction: { mode: 'index', intersect: false },
                stacked: false,
                plugins: { legend: { position: 'top' } },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: '百分比 (%)' } },
                    y2: {
                        beginAtZero: true,
                        position: 'right',
                        title: { display: true, text: '手勢次數' },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    } catch (error) {
        console.error('渲染圖表失敗:', error);
    }
}

// ==========================================
// 初始化與頁面載入
// ==========================================

// 頁面載入後自動渲染進步圖表與初始化
document.addEventListener('DOMContentLoaded', async () => {
    // 1. 檢查權限
    if (!checkAuthStatus()) return;

    // 2. 驗證 token 是否仍有效（避免 localStorage 殘留過期 token 造成 401）
    const isTokenValid = await refreshAuthToken();
    if (!isTokenValid) return;

    // 3. 檢查並修正 API (此函數內容已修正)
    await fixPracticeRoutes();

    // 4. 歡迎訊息與 UI 初始化
    const welcomeMessage = document.getElementById('welcomeMessage');
    const username = localStorage.getItem('username');

    // 預設禁用錄音按鈕
    if(startRecordBtn) startRecordBtn.disabled = true;
    if(stopRecordBtn) stopRecordBtn.disabled = true;

    if (username && welcomeMessage) {
        welcomeMessage.textContent = `歡迎, ${username}`;
    }

    if(scenarioDisplay) {
        scenarioDisplay.innerHTML = `
        <img src="/jpg/commai.png" alt="Login Page Image" class="login-image" />
            <p>使用教學：</p>
            <ul>
                <li><strong>Step 1:</strong> 選擇溝通技巧與模式：</li>
                <ul>
                    <li><strong>基礎模式：</strong>最多回應 6 句。</li>
                    <li><strong>挑戰模式：</strong>限時 5 分鐘回應。</li>
                </ul>
                <li><strong>Step 2:</strong> 按下「開始練習」按鈕後，練習將開始。</li>
                <li><strong>Step 3:</strong> 根據家長的回應，按下「開始錄音」進行回應，完成後按「停止錄音」。系統將轉錄並分析您的回應。</li>
            </ul>
        `;
    }

    if(dialogueDisplay) {
        dialogueDisplay.innerHTML = `
            <p>對話內容將顯示在這裡。開始練習後，家長的第一句話將出現在此。</p>
        `;
    }

    // 5. Banner 滾動效果
    const banner = document.querySelector('.site-banner');
    if(banner) {
        let lastScrollPosition = 0;
        window.addEventListener('scroll', () => {
            const currentScrollPosition = window.pageYOffset;
            if (currentScrollPosition > lastScrollPosition) {
                banner.style.transform = 'translateY(-100%)';
            } else {
                banner.style.transform = 'translateY(0)';
            }
            lastScrollPosition = currentScrollPosition;
        });
    }

    // 6. 載入練習列表
    await loadPractices();
    currentPracticeId = localStorage.getItem('currentPracticeId');

    // 顯示空練習提示
    const practiceList = document.getElementById('practiceList');
    const emptyPracticesGuide = document.getElementById('emptyPracticesGuide');
    
    if (practiceList && (practiceList.children.length === 0 || practiceList.innerHTML.includes('尚無練習記錄'))) {
        if (emptyPracticesGuide) {
            emptyPracticesGuide.style.display = 'block';
            practiceList.style.display = 'none';
        }
    } else {
        if (emptyPracticesGuide) {
            emptyPracticesGuide.style.display = 'none';
            if(practiceList) practiceList.style.display = 'block';
        }
    }

    if (currentPracticeId) {
        try {
            await loadPracticeDetails(currentPracticeId);
            await loadRecordingsHistory(currentPracticeId);
        } catch (error) {
            console.error('載入練習詳情失敗:', error);
            // alert('載入練習詳情失敗，請重新選擇練習'); // 選擇性開啟
            localStorage.removeItem('currentPracticeId');
            currentPracticeId = null;
        }
    } 
    
    // 7. 渲染圖表
    setTimeout(() => {
        renderNonverbalProgressChart();
    }, 800);
});

// 監聽角色選擇變更 - 即時預覽
document.addEventListener('DOMContentLoaded', () => {
    const characterSelect = document.getElementById('characterSelect');
    if (characterSelect) {
        characterSelect.addEventListener('change', (e) => {
            const selectedCharacter = e.target.value;
            if (window.npcAvatarController) {
                // 1. 設定角色圖片
                window.npcAvatarController.setCharacter(selectedCharacter);
                // 2. 關鍵修正：強制顯示面板，這樣才看得到圖片切換
                window.npcAvatarController.show(); 
                
                console.log('✅ 預覽角色已切換為:', selectedCharacter);
            }
        });
    }
});

// 定期檢查 token
setInterval(refreshAuthToken, 5 * 60 * 1000); // 每5分鐘檢查一次

// ==========================================
// 認證與登出邏輯
// ==========================================

function clearAuthStorage() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('currentPracticeId');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
}

function forceLogout() {
    clearAuthStorage();
    window.location.href = '/login';
}

async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');
    if (!token) {
        forceLogout();
        throw new Error('未登入');
    }

    const headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
    };

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
        // Token 無效/過期：自動清除，避免在 /login 因為舊 token 被再次導回 /test 造成死循環
        forceLogout();
        throw new Error('認證失敗');
    }

    return response;
}

function checkAuthStatus() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return false;
    }
    return true;
}

function checkAuth() {
    checkAuthStatus();
}

async function refreshAuthToken() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            return false;
        }

        const response = await fetch('/api/auth/verify', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error('Token 驗證失敗');
        }
        return true;
    } catch (error) {
        console.error('Token 驗證失敗:', error);
        forceLogout();
        return false;
    }
}

document.getElementById('logoutButton').addEventListener('click', () => {
    forceLogout();
});

// ==========================================
// 非語言偵測與輸入方式控制
// ==========================================

if (enableNonverbalDetection) {
    enableNonverbalDetection.addEventListener('change', (e) => {
        isNonverbalEnabled = e.target.checked;

        if (isNonverbalEnabled) {
            const voiceRadio = document.querySelector('input[name="inputMethod"][value="voice"]');
            if (voiceRadio) voiceRadio.checked = true;

            if (textInputLabel) textInputLabel.style.display = 'none';

            voiceInputControls.style.display = 'block';
            textInputControls.style.display = 'none';

            recordStatus.textContent = '已啟用非語言偵測 - 將使用語音輸入模式';
        } else {
            if (textInputLabel) textInputLabel.style.display = 'inline-block';
            recordStatus.textContent = '';
        }
    });
}

inputMethodRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'voice') {
            voiceInputControls.style.display = 'block';
            textInputControls.style.display = 'none';
            if (isRecording) {
                stopRecordBtn.click();
            }
        } else if (e.target.value === 'text') {
            if (isNonverbalEnabled) {
                e.preventDefault();
                const voiceRadio = document.querySelector('input[name="inputMethod"][value="voice"]');
                if (voiceRadio) voiceRadio.checked = true;
                recordStatus.textContent = '啟用非語言偵測時無法使用文字輸入';
                return;
            }
            voiceInputControls.style.display = 'none';
            textInputControls.style.display = 'block';
            if (isRecording) {
                stopRecordBtn.click();
            }
        }
    });
});

// ==========================================
// 練習管理 (列表、建立、選擇)
// ==========================================

// 修正後的篩選函數 (原名 displayPracticeDetails 改為 filterPractices)
function filterPractices() {
    if (!window.practicesData) return;
    
    const searchText = document.getElementById('practiceSearchInput').value.toLowerCase();
    const dateFilter = document.getElementById('practiceDateFilter').value;
    const techniqueFilter = document.getElementById('practiceTechniqueFilter').value;
    const difficultyFilter = document.getElementById('practiceDifficultyFilter').value;
    
    // 篩選練習
    let filteredPractices = window.practicesData.filter(practice => {
        // 搜尋關鍵字篩選
        const scenarioMatch = practice.scenario && practice.scenario.toLowerCase().includes(searchText);
        const techniqueMatch = practice.technique && practice.technique.toLowerCase().includes(searchText);
        const hasSearchText = !searchText || scenarioMatch || techniqueMatch;
        
        // 日期篩選
        let passDateFilter = true;
        if (dateFilter !== 'all') {
            const practiceDate = new Date(practice.createdAt);
            const today = new Date();
            
            if (dateFilter === 'today') {
                passDateFilter = isSameDay(practiceDate, today);
            } else if (dateFilter === 'week') {
                passDateFilter = isThisWeek(practiceDate, today);
            } else if (dateFilter === '7days') {
                const sevenDaysAgo = new Date(today);
                sevenDaysAgo.setUTCDate(today.getUTCDate() - 7);
                return practiceDate < sevenDaysAgo;
            }
        }
        
        // 技巧篩選
        const passTechniqueFilter = techniqueFilter === 'all' || practice.technique === techniqueFilter;
        
        // 難度篩選
        const passDifficultyFilter = difficultyFilter === 'all' || practice.difficulty === difficultyFilter;
        
        return hasSearchText && passDateFilter && passTechniqueFilter && passDifficultyFilter;
    });
    
    // 顯示篩選後的練習
    displayFilteredPractices(filteredPractices);
}

// 載入所有練習（支持分頁）
async function loadPractices(page = 1) {
    currentPracticePage = page;

    try {
        // 構建查詢參數
        const params = new URLSearchParams({
            page: page,
            limit: practicesPerPage,
            completed: 'true',
            ...currentFilters
        });

        const response = await fetchWithAuth(`/api/practice/practices?${params.toString()}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        const practiceList = document.getElementById('practiceList');
        const practiceSearchContainer = document.getElementById('practiceSearchContainer');
        const paginationContainer = document.getElementById('practicesPagination');
        
        // 建立篩選 UI
        if (!practiceSearchContainer) {
            const searchContainer = document.createElement('div');
            searchContainer.id = 'practiceSearchContainer';
            searchContainer.classList.add('practice-search-container');
            
            // 搜尋框
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.id = 'practiceSearchInput';
            searchInput.placeholder = '搜尋練習...';
            searchInput.classList.add('practice-search-input');
            
            // 日期篩選
            const dateFilter = document.createElement('select');
            dateFilter.id = 'practiceDateFilter';
            dateFilter.classList.add('practice-filter');
            const dateOptions = [
                { value: 'all', text: '所有日期' },
                { value: 'today', text: '今天' },
                { value: 'week', text: '本週' },
                { value: '7days', text: '超過7天' }
            ];
            dateOptions.forEach(opt => {
                const el = document.createElement('option');
                el.value = opt.value;
                el.textContent = opt.text;
                dateFilter.appendChild(el);
            });
            
            // 技巧篩選
            const techniqueFilter = document.createElement('select');
            techniqueFilter.id = 'practiceTechniqueFilter';
            techniqueFilter.classList.add('practice-filter');
            const techniqueOptions = [
                { value: 'all', text: '所有技巧' },
                { value: '我訊息', text: '我訊息' },
                { value: '三明治溝通法', text: '三明治溝通法' },
                { value: '綜合溝通技巧', text: '綜合溝通技巧' }
            ];
            techniqueOptions.forEach(opt => {
                const el = document.createElement('option');
                el.value = opt.value;
                el.textContent = opt.text;
                techniqueFilter.appendChild(el);
            });
            
            // 難度篩選
            const difficultyFilter = document.createElement('select');
            difficultyFilter.id = 'practiceDifficultyFilter';
            difficultyFilter.classList.add('practice-filter');
            const difficultyOptions = [
                { value: 'all', text: '所有模式' },
                { value: '簡單', text: '基礎模式' },
                { value: '挑戰', text: '挑戰模式' }
            ];
            difficultyOptions.forEach(opt => {
                const el = document.createElement('option');
                el.value = opt.value;
                el.textContent = opt.text;
                difficultyFilter.appendChild(el);
            });
            
            // 事件監聽 - 更新為使用分頁加載
            searchInput.addEventListener('input', () => {
                currentFilters.searchQuery = searchInput.value;
                loadPractices(1); // 搜索時返回第一頁
            });
            dateFilter.addEventListener('change', () => {
                currentFilters.dateRange = dateFilter.value;
                loadPractices(1);
            });
            techniqueFilter.addEventListener('change', () => {
                currentFilters.technique = techniqueFilter.value;
                loadPractices(1);
            });
            difficultyFilter.addEventListener('change', () => {
                currentFilters.difficulty = difficultyFilter.value;
                loadPractices(1);
            });
            
            searchContainer.appendChild(searchInput);
            searchContainer.appendChild(dateFilter);
            searchContainer.appendChild(techniqueFilter);
            searchContainer.appendChild(difficultyFilter);
            
            practiceList.parentNode.insertBefore(searchContainer, practiceList);
        }
        
        practiceList.innerHTML = '';

        let practices = [];
        let totalCount = 0;
        let pagination = null;

        if (data.success && Array.isArray(data.practices)) {
            practices = data.practices;
            totalCount = data.total || practices.length;
            pagination = data.pagination;
        } else if (Array.isArray(data)) {
            practices = data;
            totalCount = practices.length;
        } else {
            practiceList.innerHTML = '<li class="error-message">API回應格式異常</li>';
            if (paginationContainer) paginationContainer.style.display = 'none';
            return;
        }
        
        if (totalCount === 0) {
            practiceList.innerHTML = '<li class="no-practice">尚無完成的練習記錄</li>';
            const emptyPracticesGuide = document.getElementById('emptyPracticesGuide');
            if (emptyPracticesGuide) {
                emptyPracticesGuide.style.display = 'block';
                practiceList.style.display = 'none';
            }
            if (paginationContainer) paginationContainer.style.display = 'none';
            return;
        } else {
            const emptyPracticesGuide = document.getElementById('emptyPracticesGuide');
            if (emptyPracticesGuide) {
                emptyPracticesGuide.style.display = 'none';
                practiceList.style.display = 'block';
            }
        }
        
        const practicesCount = document.getElementById('practicesCount');
        if (practicesCount) {
            practicesCount.textContent = `(${totalCount})`;
        }
        
        // 更新分頁資訊
        if (pagination) {
            totalPracticePages = pagination.totalPages;
            updatePracticePagination(pagination);
        }
        
        displayFilteredPractices(practices);
        
    } catch (error) {
        console.error('載入練習失敗:', error);
        const practiceList = document.getElementById('practiceList');
        if(practiceList) practiceList.innerHTML = '<li class="error-message">載入練習時發生錯誤: ' + error.message + '</li>';
        const paginationContainer = document.getElementById('practicesPagination');
        if (paginationContainer) paginationContainer.style.display = 'none';
    }
}

// 更新分頁控件
function updatePracticePagination(pagination) {
    const paginationContainer = document.getElementById('practicesPagination');
    const paginationInfo = document.getElementById('practicesPaginationInfo');
    const prevBtn = document.getElementById('practicesPrevBtn');
    const nextBtn = document.getElementById('practicesNextBtn');

    if (!paginationContainer) return;

    // 如果只有一頁，隱藏分頁控件
    if (pagination.totalPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }

    paginationContainer.style.display = 'flex';
    paginationInfo.textContent = `第 ${pagination.page} / ${pagination.totalPages} 頁`;
    
    prevBtn.disabled = pagination.page === 1;
    nextBtn.disabled = pagination.page >= pagination.totalPages;
}

// 切換練習頁面
function changePracticePage(direction) {
    const newPage = currentPracticePage + direction;
    
    if (newPage >= 1 && newPage <= totalPracticePages) {
        loadPractices(newPage);
    }
}

// 修正後的篩選函數（已整合到 loadPractices 中）
function filterPractices() {
    // 現在由 loadPractices 處理篩選和分頁
    loadPractices(1);
}

// 顯示篩選後的練習列表
function displayFilteredPractices(practices) {
    const practiceList = document.getElementById('practiceList');
    practiceList.innerHTML = '';
    
    if (!Array.isArray(practices)) {
        practiceList.innerHTML = '<li class="error-message">練習資料格式不正確</li>';
        return;
    }
    
    if (practices.length === 0) {
        practiceList.innerHTML = '<li class="no-practice">沒有符合條件的練習</li>';
        return;
    }
    
    try {
        practices.sort((a, b) => {
            try {
                return new Date(b.createdAt) - new Date(a.createdAt);
            } catch (error) {
                return 0;
            }
        });
        
        practices.forEach(practice => {
            const listItem = document.createElement('li');
            listItem.classList.add('practice-item');
            
            if (practice.isRetry) {
                listItem.classList.add('retry');
            }
            
            listItem.setAttribute('data-practice-id', practice._id);
            
            let practiceDate = '未知日期';
            try {
                if (practice.createdAt) {
                    practiceDate = new Date(practice.createdAt).toLocaleDateString('zh-TW');
                }
            } catch (e) {
                console.warn('日期格式化錯誤', e);
            }
            
            const scenarioPreview = practice.scenario 
                ? (practice.scenario.length > 20 ? practice.scenario.substring(0, 20) + '...' : practice.scenario)
                : '無情境';
            
            let titleContent = `${practice.technique || '未知技巧'} - ${practiceDate}`;
            if (practice.isRetry) {
                titleContent += `<span class="retry-badge">重新練習</span>`;
            }
            
            listItem.innerHTML = `
                <div class="practice-item-title">${titleContent}</div>
                <div class="practice-item-scenario">${scenarioPreview}</div>
                <div class="practice-item-badge ${practice.difficulty === '挑戰' ? 'challenge' : 'basic'}">${practice.difficulty === '挑戰' ? '挑戰' : '基礎'}</div>
            `;
            
            listItem.addEventListener('click', async () => {
                document.querySelectorAll('.practice-item').forEach(item => {
                    item.classList.remove('selected');
                });
                listItem.classList.add('selected');
                await selectPractice(practice._id);
            });
            
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '刪除';
            deleteButton.classList.add('small-btn');
            
            deleteButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('確認刪除此練習紀錄？')) {
                    await deletePractice(practice._id);
                    await loadPractices();
                }
            });
            
            listItem.appendChild(deleteButton);
            practiceList.appendChild(listItem);
        });
    } catch (error) {
        console.error('顯示練習列表時發生錯誤:', error);
        practiceList.innerHTML = '<li class="error-message">顯示練習時發生錯誤</li>';
    }
}

// 選擇練習
async function selectPractice(practiceId) {
    currentPracticeId = practiceId;
    localStorage.setItem('currentPracticeId', practiceId);
    await loadPracticeDetails(practiceId);
    await loadRecordingsHistory(practiceId);
}

// 載入練習詳細資料
async function loadPracticeDetails(practiceId) {
    // 取得語言分析
    const response = await fetchWithAuth(`/api/practice/practices/${practiceId}`);
    const data = await response.json();

    // 取得非語言分析
    let nonverbalData = null;
    try {
        const nvRes = await fetchWithAuth(`/api/nonverbal/practice/${practiceId}`);
        const nvJson = await nvRes.json();
        if (nvJson.success) {
            nonverbalData = nvJson;
        }
    } catch (e) {
        console.error('非語言數據獲取失敗', e);
    }

    if (data.success) {
        displayPracticeDetails(data.practice, nonverbalData);
        await loadFeedbackList(practiceId);
    } else {
        console.error('Failed to load practice details:', data.message);
    }
}

// 顯示練習詳情與分析
function displayPracticeDetails(practice, nonverbalData) {


    const techniqueDisplay = document.getElementById('scenarioDisplay');

    techniqueDisplay.innerHTML = `
        <p><strong>溝通技巧：</strong>${practice.technique}</p>
        <p><strong>模式：</strong>${practice.difficulty || '簡單'}</p>
        <p><strong>情境：</strong>${practice.scenario}</p>
    `;

    analysisContent.innerHTML = '';
    
    // 檢查練習是否已結束（有分析結果代表已結束）
    const practiceCompleted = !!practice.analysis;
    
    // 控制分析結果框框的顯示
    const analysisDisplay = document.getElementById('analysisDisplay');
    if (practiceCompleted) {
        // 練習結束，顯示分析結果框框
        if (analysisDisplay) {
            analysisDisplay.style.display = 'block';
        }
    } else {
        // 練習進行中，隱藏分析結果框框
        if (analysisDisplay) {
            analysisDisplay.style.display = 'none';
        }
    }
    
    // 如果練習已結束，隱藏整個 record-controls panel
    if (practiceCompleted) {
        const recordControlsPanel = document.querySelector('.record-controls.panel');
        if (recordControlsPanel) {
            recordControlsPanel.style.display = 'none';
        }
    } else {
        // 如果練習進行中，確保 record-controls panel 顯示
        const recordControlsPanel = document.querySelector('.record-controls.panel');
        if (recordControlsPanel) {
            recordControlsPanel.style.display = 'block';
        }
    }
    
    // 顯示語言分析
        if (practice.analysis) {
            // 1. 基礎清理：移除裝飾線
            let rawContent = practice.analysis.replace(/━+/g, '').trim();

            // 2. ✨ 關鍵修正 A：移除評分的中括號 (例如 [D] -> D)
            rawContent = rawContent.replace(/\[([A-Z])\]/g, '$1');

            // 3. ✨ 關鍵修正 B：修復統計數據的斷行 (將 "- \n 眼神" 接回成 "- 眼神")
            // 這會抓取 "-" 後面跟著換行符號，再接著關鍵字的情況，把中間的換行拿掉
            rawContent = rawContent.replace(/-\s*[\r\n]+\s*(眼神接觸率|微笑率|開放姿態率|手勢使用次數)/g, '- $1');

            // 4. 切分每一行
            const lines = rawContent.split('\n').filter(line => line.trim() !== '');

            lines.forEach(line => {
                let text = line.trim();
                if (!text) return;

                const paragraphElement = document.createElement('div');
                paragraphElement.style.marginBottom = '6px'; // 微調行距
                paragraphElement.style.lineHeight = '1.6';

                // (A) 處理標題 (對話分析、統計數據等)
                if (text.match(/^(對話分析|具體修正建議|整體回饋|統計數據|逐句教練|逐句修正|示範改寫)[：:]?/)) {
                    // 加上左邊框裝飾，讓標題更明顯
                    paragraphElement.innerHTML = `<h4 style="margin: 15px 0 8px 0; color: #333; border-left: 4px solid #e93ae1; padding-left: 10px;">${text}</h4>`;
                }
                // (B) 處理統計數據列表 (以 - 開頭的行)
                else if (text.startsWith('-') && (text.includes('眼神') || text.includes('微笑') || text.includes('姿態') || text.includes('手勢'))) {
                    // 加粗關鍵字 (冒號前的部分)
                    text = text.replace(/^(.*?):/, '<strong>$1</strong>:');
                    paragraphElement.innerHTML = `<div style="padding-left: 10px; color: #444;">${text}</div>`;
                }
                // (C) 處理評分項目 (例如：情感表現：D)
                else if (text.match(/^(情感表現|內容回應|清晰表達|溝通技巧)[：:]/)) {
                    // 加粗關鍵字，確保呈現為 "項目：分數"
                    text = text.replace(/^(.*?)[：:]\s*(.*)/, '<strong>$1：</strong>$2');
                    paragraphElement.innerHTML = text;
                }
                // (D) 處理數字列表 (1. xxx)
                else if (text.match(/^\d+\./)) {
                    text = text.replace(/^(\d+\.)/, '<strong>$1</strong>');
                    paragraphElement.innerHTML = `<div style="padding-left: 10px;">${text}</div>`;
                }
                // (E) 一般文字
                else {
                    paragraphElement.innerHTML = text;
                }

                analysisContent.appendChild(paragraphElement);
            });

        } else {
            analysisContent.textContent = '尚無分析結果';
        }
    // if (practice.analysis) {
    //     const paragraphs = practice.analysis.split(/(?<=。)\s/);
    //     paragraphs.forEach(paragraph => {
    //         const cleanedParagraph = paragraph.replace(/[#*]/g, '').replace(/-/g, '').trim();
    //         const paragraphElement = document.createElement('p');
            
    //         let content = cleanedParagraph
    //             .replace(/整體回饋：/g, '<strong>整體回饋：</strong>')
    //             .replace(/具體描述對方行為：/g, '<strong>具體描述對方行為：</strong>');
            
    //         content = content.replace(/(\d+)/g, '<br>$1');
            
    //         const subtitleMatch = content.match(/^(.*?：)/);
    //         if (subtitleMatch) {
    //             const subtitle = subtitleMatch[1];
    //             content = content.replace(subtitle, '').trim();
    //             content = content.replace(/\)(.*?)/g, ')<br><strong>$1</strong>');
    //             content = content.replace(/(\d+\s*.*?):/g, '<strong>$1</strong>:');
    //             paragraphElement.innerHTML = `<strong>${subtitle}</strong>${content}`;
    //         } else {
    //             content = content.replace(/\)(.*?)/g, ')<br><strong>$1</strong>');
    //             content = content.replace(/(\d+\s*.*?):/g, '<strong>$1</strong>:');
    //             paragraphElement.innerHTML = content;
    //         }
    //         analysisContent.appendChild(paragraphElement);
    //     });
    // } else {
    //     analysisContent.textContent = '尚無分析結果';
    // }

    // 顯示非語言分析
    const nonverbalDisplayPanel = document.getElementById('nonverbalDataDisplay');
    const nonverbalDataContent = document.getElementById('nonverbalDataContent');

    //檢查是否真的有「非 0」的有效數據
    // 遍歷每一輪對話 (details)，只要有任何一輪的任何一個指標大於 0，就視為有效。
    const hasValidData = nonverbalData && Array.isArray(nonverbalData.details) && nonverbalData.details.some(d => {
        const n = d.nonverbalData || {};
        // 檢查是否有任何數值 > 0 (眼神、微笑、姿態、手勢)
        return (n.eyeContactRate > 0) || 
               (n.smileRate > 0) || 
               (n.openPostureRate > 0) ;
    });

    // 修改判斷邏輯：只有在「練習完全結束」且「後端有數據」且「該練習紀錄標記為已啟用非語言偵測」時才顯示
    if (practiceCompleted && 
        nonverbalData && 
        nonverbalData.hasNonverbalData && 
        Array.isArray(nonverbalData.details) && 
        hasValidData){
        // 顯示非語言數據面板
        nonverbalDisplayPanel.style.display = 'block';

        let html = '';

        // 如果有摘要,顯示整體指標卡片
        if (nonverbalData.summary) {
            html += `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; color: white;">
                        <div style="font-size: 14px; opacity: 0.9;">眼神接觸率</div>
                        <div style="font-size: 32px; font-weight: bold; margin-top: 5px;">${nonverbalData.summary.averageEyeContactRate}%</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; border-radius: 10px; color: white;">
                        <div style="font-size: 14px; opacity: 0.9;">微笑率</div>
                        <div style="font-size: 32px; font-weight: bold; margin-top: 5px;">${nonverbalData.summary.averageSmileRate}%</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 20px; border-radius: 10px; color: white;">
                        <div style="font-size: 14px; opacity: 0.9;">開放姿態率</div>
                        <div style="font-size: 32px; font-weight: bold; margin-top: 5px;">${nonverbalData.summary.averageOpenPostureRate}%</div>
                    </div>
                </div>
            `;
        }

        // 顯示每輪數據的雷達圖
        html += `
            <div style="background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h4 style="margin-top: 0;">📈 各輪次表現趨勢</h4>
                <canvas id="nonverbalTrendChart" style="max-height: 300px;"></canvas>
            </div>
        `;

        // 顯示詳細數據表格
        html += `
            <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h4 style="margin-top: 0;">📋 詳細數據</h4>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f5f5f5;">
                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">輪次</th>
                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">內容預覽</th>
                                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">眼神接觸</th>
                                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">微笑</th>
                                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">姿態</th>
                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">品質</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        nonverbalData.details.forEach((d, index) => {
            const eyeRate = d.nonverbalData.eyeContactRate ?? 0;
            const smileRate = d.nonverbalData.smileRate ?? 0;
            const postureRate = d.nonverbalData.openPostureRate ?? 0;

            const getRateBadge = (rate) => {
                if (rate >= 80) return `<span style="background: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${rate}%</span>`;
                if (rate >= 60) return `<span style="background: #ffc107; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${rate}%</span>`;
                if (rate >= 40) return `<span style="background: #fd7e14; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${rate}%</span>`;
                return `<span style="background: #dc3545; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${rate}%</span>`;
            };

            const quality = d.nonverbalData.dataQuality
                ? `${d.nonverbalData.dataQuality.sampleCount} 幀 / ${d.nonverbalData.dataQuality.faceDetectionRate}% 偵測率`
                : '-';

            html += `
                <tr style="border-bottom: 1px solid #eee; ${index % 2 === 0 ? 'background: #fafafa;' : ''}">
                    <td style="padding: 12px;">${d.turnNumber}</td>
                    <td style="padding: 12px; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${d.content}</td>
                    <td style="padding: 12px; text-align: center;">${getRateBadge(eyeRate)}</td>
                    <td style="padding: 12px; text-align: center;">${getRateBadge(smileRate)}</td>
                    <td style="padding: 12px; text-align: center;">${getRateBadge(postureRate)}</td>
                    <td style="padding: 12px; font-size: 12px; color: #666;">${quality}</td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        nonverbalDataContent.innerHTML = html;

        // 繪製趨勢圖表
        setTimeout(() => {
            const canvas = document.getElementById('nonverbalTrendChart');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: nonverbalData.details.map(d => `第${d.turnNumber}輪`),
                        datasets: [
                            {
                                label: '眼神接觸率',
                                data: nonverbalData.details.map(d => d.nonverbalData.eyeContactRate ?? 0),
                                borderColor: '#667eea',
                                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                                tension: 0.4
                            },
                            {
                                label: '微笑率',
                                data: nonverbalData.details.map(d => d.nonverbalData.smileRate ?? 0),
                                borderColor: '#f5576c',
                                backgroundColor: 'rgba(245, 87, 108, 0.1)',
                                tension: 0.4
                            },
                            {
                                label: '開放姿態率',
                                data: nonverbalData.details.map(d => d.nonverbalData.openPostureRate ?? 0),
                                borderColor: '#4facfe',
                                backgroundColor: 'rgba(79, 172, 254, 0.1)',
                                tension: 0.4
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 100,
                                title: {
                                    display: true,
                                    text: '百分比 (%)'
                                }
                            }
                        },
                        plugins: {
                            legend: {
                                display: true,
                                position: 'top'
                            }
                        }
                    }
                });
            }
        }, 100);
    } else {
        // 如果沒有偵測數據，或者該練習根本沒開啟偵測，就隱藏整個區塊
        nonverbalDisplayPanel.style.display = 'none';
        if (nonverbalDataContent) nonverbalDataContent.innerHTML = '';
    }
    
    // 顯示對話歷史
    const dialogueDisplay = document.getElementById('dialogueDisplay');
    
    // 🆕 新增：顯示對話與角色容器
    const dialogueWithAvatar = document.getElementById('dialogueWithAvatar');
    if (dialogueWithAvatar) {
        dialogueWithAvatar.style.display = 'flex'; // 或 'block'，取決於你的布局需求
    }
    
    dialogueDisplay.style.backgroundColor = 'white';
    dialogueDisplay.style.border = '1px solid #ddd';
    dialogueDisplay.style.borderRadius = '10px';
    dialogueDisplay.style.padding = '20px';
    dialogueDisplay.style.marginTop = '20px';
    dialogueDisplay.style.boxShadow = '0px 2px 5px rgba(0, 0, 0, 0.1)';
    
    dialogueDisplay.innerHTML = ''; 
    const displayedDialogues = new Set();

    if (practice.history && Array.isArray(practice.history)) {
        practice.history.forEach((entry) => {
            const dialogueKey = `${entry.role}-${entry.content.substring(0, 50)}`;
            if (displayedDialogues.has(dialogueKey)) return;
            displayedDialogues.add(dialogueKey);
            
            const messageContainer = document.createElement('div');
            messageContainer.className = 'message-container';
            
            const messageHeader = document.createElement('div');
            messageHeader.className = 'message-header';
            messageHeader.innerHTML = `<strong>${entry.role === '家長' ? '👨‍👩‍👧‍👦 家長' : '👨‍🏫 導師'}:</strong>`;
            
            const messageContent = document.createElement('div');
            messageContent.className = 'message-content';
            messageContent.style.marginBottom = '20px';
            messageContent.style.paddingLeft = '20px';
            messageContent.textContent = entry.content;
            
            messageContainer.appendChild(messageHeader);
            messageContainer.appendChild(messageContent);
            dialogueDisplay.appendChild(messageContainer);
        });
    }

    // 重新練習按鈕 - 放在最下面
    const existingRetryContainer = document.querySelector('.retry-button-container');
    if (existingRetryContainer) existingRetryContainer.remove();
    
    const retryButtonContainer = document.createElement('div');
    retryButtonContainer.className = 'retry-button-container';
    retryButtonContainer.style.textAlign = 'center';
    retryButtonContainer.style.marginTop = '30px';
    
    const retryButton = document.createElement('button');
    retryButton.textContent = '重新練習';
    retryButton.className = 'retry-main-btn';
    // 加大按鈕和字體
    retryButton.style.fontSize = '20px';
    retryButton.style.padding = '15px 40px';
    retryButton.style.fontWeight = 'bold';
    retryButton.addEventListener('click', async () => {
        await retryPractice(practice._id, practice.scenario);
    });
    
    retryButtonContainer.appendChild(retryButton);
    
    // 決定放置位置：如果有非語言分析區塊且顯示中，就放在它後面；否則放在分析結果框框後面
    let insertAfterElement;
    if (nonverbalDisplayPanel && nonverbalDisplayPanel.style.display !== 'none') {
        insertAfterElement = nonverbalDisplayPanel;
    } else {
        insertAfterElement = analysisDisplay;
    }
    
    if (insertAfterElement.nextSibling) {
        insertAfterElement.parentNode.insertBefore(retryButtonContainer, insertAfterElement.nextSibling);
    } else {
        insertAfterElement.parentNode.appendChild(retryButtonContainer);
    }
}

// 建立新練習
async function createPractice() {
    const technique = techniqueSelect.value;
    const difficulty = difficultySelect.value;
    // 確保這裡抓到了當前 checkbox 的狀態
    const nonverbalEnabled = document.getElementById('enableNonverbalDetection').checked;

    if (!technique) {
        alert('請先選擇溝通技巧');
        return null;
    }

    try {
                const response = await fetchWithAuth('/api/practice/practices', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                technique, 
                difficulty, 
                isNonverbalEnabled: nonverbalEnabled // 確保這行有傳給後端儲存
            })
          });
          const data = await response.json();
          
          if (data.success && data.practice && data.practice._id) {
            const newPracticeId = data.practice._id;
            currentPracticeId = newPracticeId;
            localStorage.setItem('currentPracticeId', newPracticeId);
            return newPracticeId;
        } else {
            throw new Error(data.message || '建立練習失敗');
        }
    } catch (error) {
        console.error('API 請求失敗:', error);
        alert('API 請求失敗，請稍後重試');
        return null;
    }
}

// 刪除練習
async function deletePractice(practiceId) {
    try {
        const response = await fetchWithAuth(`/api/practice/practices/${practiceId}`, {
            method: 'DELETE',
            headers: {}
        });
        const data = await response.json();

        if (data.success) {
            if (currentPracticeId === practiceId) {
                localStorage.removeItem('currentPracticeId');
                currentPracticeId = null;
            }
            // 不要 reload，重新呼叫 loadPractices 體驗較好，但照舊碼邏輯：
            location.reload(); 
        } else {
            console.error('刪除練習失敗:', data.message);
        }
    } catch (error) {
        console.error('刪除練習時發生錯誤:', error);
    }
}

// 重新練習
async function retryPractice(practiceId, scenario) {
    try {
            const response = await fetchWithAuth(`/api/practice/practices/${practiceId}/retry`, {
        method: 'POST',
        headers: {
                    'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('重新練習請求失敗');
      }
      
      const data = await response.json();
      
      if (data.success && data.practice && data.practice._id) {
        currentPracticeId = data.practice._id;
        localStorage.setItem('currentPracticeId', data.practice._id);
        
        await startDialogue(data.practice._id, data.practice.scenario);
        await loadPractices();
        alert('已創建重新練習！');
      } else {
        throw new Error(data.message || '創建重新練習失敗');
      }
    } catch (error) {
      console.error('重新練習失敗:', error);
      alert('重新練習失敗: ' + error.message);
    }
}

// ==========================================
// 對話與錄音邏輯
// ==========================================

// 開始對話
async function startDialogue(practiceId, specifiedScenario = null) {
    if (!checkAuthStatus()) return;

    const scenarioDisplay = document.getElementById('scenarioDisplay');
    const dialogueDisplay = document.getElementById('dialogueDisplay');
    const taskDisplayEl = document.getElementById('taskDisplay');
    const reminderDisplayEl = document.getElementById('reminderDisplay');
    const actionBtnsEl = document.getElementById('dialogueActionBtns');

    scenarioDisplay.innerHTML = '';
    dialogueDisplay.innerHTML = '';
    if (taskDisplayEl) { taskDisplayEl.innerHTML = ''; taskDisplayEl.style.display = 'none'; }
    if (reminderDisplayEl) { reminderDisplayEl.innerHTML = ''; reminderDisplayEl.style.display = 'none'; }
    if (actionBtnsEl) actionBtnsEl.style.display = 'none';

    enableUserInput();

    const spinner = document.getElementById('loadingSpinner');
    if(spinner) spinner.classList.add('spinner-visible');

    try {
        const technique = techniqueSelect.value;
        const difficulty = difficultySelect.value;
        dialogueCount = 0; 

        if (!technique) throw new Error('請選擇溝通技巧');
        const characterVoice = getSelectedCharacterVoice();

        const response = await fetchWithAuth('/api/dialogue/start-dialogue', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                technique,
                difficulty,
                practiceId,
                specifiedScenario,
                characterVoice 
            }),
        });

        if (!response.ok) {
            let errorMessage = '開始對話失敗';
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (e) {
                console.error('解析錯誤回應失敗:', e);
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'API 回應失敗');
        }

        const initialLimit = difficulty === '簡單' ? 8 : null;
        const initialCount = (typeof data.turnCount === 'number') ? data.turnCount : 0;
        setTurnProgress(initialCount, initialLimit);

        scenarioDisplay.innerHTML = `
            <div class="message-header">📝 情境</div>
            <div class="message-content">${data.scenario || '無法載入情境'}</div>
        `;

        const { task, reminder } = getTaskAndReminder(technique, difficulty);
        const taskDisplay = document.getElementById('taskDisplay');
        const reminderDisplay = document.getElementById('reminderDisplay');
        if (taskDisplay) {
            taskDisplay.innerHTML = `<div class="message-header">老師任務</div><div class="message-content">${task}<br><br>請輸入你作為導師想對家長說的第一句話。</div>`;
            taskDisplay.style.display = '';
        }
        if (reminderDisplay && reminder) {
            reminderDisplay.innerHTML = `<div class="message-header">練習提醒</div><div class="message-content">${reminder}</div>`;
            reminderDisplay.style.display = '';
        }

        dialogueDisplay.innerHTML = '';

        // 顯示對話區塊（含錄音按鈕）
        const dialogueWithAvatar = document.getElementById('dialogueWithAvatar');
        if (dialogueWithAvatar) dialogueWithAvatar.style.display = 'flex';

        // 顯示「結束對話」按鈕
        const actionBtns = document.getElementById('dialogueActionBtns');
        if (actionBtns) actionBtns.style.display = 'flex';

        recordStatus.textContent = difficulty === '挑戰'
            ? '挑戰模式（5分鐘），請輸入你的第一句話。'
            : '基礎模式（建議6輪），請輸入你的第一句話。';

        if (difficulty === '挑戰') {
            totalChallengeExtension = 0;
            startCountdown();
        }

    } catch (error) {
        console.error('開始對話失敗:', error);
        alert(`錯誤：${error.message}`);
        scenarioDisplay.innerHTML = `
            <div class="message error">
                <div class="message-header">❌ 錯誤 請重試</div>
                <div class="message-content">${error.message}</div>
            </div>
        `;
    } finally {
        if(spinner) spinner.classList.remove('spinner-visible');
    }
}

// 結束對話按鈕
const endDialogueBtn = document.getElementById('endDialogueBtn');
if (endDialogueBtn) {
    endDialogueBtn.addEventListener('click', async () => {
        await endDialogue();
    });
}

// 延長30秒按鈕（挑戰模式）
const extendTimeBtn = document.getElementById('extendTimeBtn');
if (extendTimeBtn) {
    extendTimeBtn.addEventListener('click', () => {
        if (totalChallengeExtension >= 60) {
            recordStatus.textContent = '已達本次練習建議上限，建議結束對話並取得分析回饋。';
            extendTimeBtn.style.display = 'none';
            return;
        }
        totalChallengeExtension += 30;
        countdownRemaining = 30;
        extendTimeBtn.style.display = 'none';
        recordStatus.textContent = '已延長30秒，請繼續對話。';
        startCountdown();
    });
}

// 提交文字處理
submitTextBtn.addEventListener('click', async () => {
    const text = textInput.value.trim();
    if (!text) {
        recordStatus.textContent = '請輸入文字內容';
        return;
    }

    if (!currentPracticeId) {
        recordStatus.textContent = '未選擇練習 ID，請先建立或選擇一個練習';
        return;
    }

    try {
        submitTextBtn.disabled = true;
        recordStatus.textContent = '處理中...請稍候';
        await handleSubmission(text);
        textInput.value = '';
        recordStatus.textContent = '文字已提交';
    } catch (error) {
        console.error('文字提交錯誤：', error);
        recordStatus.textContent = '發生錯誤：' + error.message;
    } finally {
        submitTextBtn.disabled = false;
    }
});

// 統一提交處理 (語音/文字)
async function handleSubmission(text) {
    try {
        const difficulty = difficultySelect.value;
        isWaitingForSubmission = false;
        clearTranscriptionPreview();
        recordStatus.textContent = 'AI 分析中...';

        if (!text || text.trim().length === 0) {
            throw new Error('提交的文字內容為空');
        }

        updateDialogueDisplay("老師", text);

        let nonverbalData = null;
        if (isNonverbalEnabled && window.nonverbalAnalysis) {
            try {
                nonverbalData = window.nonverbalAnalysis.getData();
            } catch (error) {
                console.error('獲取非語言數據失敗:', error);
            }
        }

        const characterVoice = getSelectedCharacterVoice();
        console.log('使用角色語音:', characterVoice);

        const response = await fetchWithAuth('/api/dialogue/continue-dialogue', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userResponse: text,
                practiceId: currentPracticeId,
                challengeTimeOver: false,
                inputMethod: document.querySelector('input[name="inputMethod"]:checked').value,
                nonverbalData: nonverbalData,
                characterVoice: getSelectedCharacterVoice()
            })
        });

        if (!response.ok) throw new Error('API 請求失敗');

        const data = await response.json();
        if (!data) throw new Error('無效的回應數據');

        // 更新進度（後端回傳 turnCount/turnLimit）
        if (typeof data.turnCount === 'number' || typeof data.turnLimit !== 'undefined') {
            setTurnProgress(
                typeof data.turnCount === 'number' ? data.turnCount : turnProgress.count,
                typeof data.turnLimit !== 'undefined' ? data.turnLimit : turnProgress.limit
            );
        }

        if (data.completed && data.analysis) {
            // 後端安全上限觸發
            analysisContent.innerHTML = `<pre>${data.analysis}</pre>`;
            disableUserInput();
            await handleDialogueEnd(currentPracticeId, data.analysis);
        } else if (data.response) {
            // 立即顯示文字，背景產生語音
            const parentMsgId = `parent-msg-${Date.now()}`;
            updateDialogueDisplay("家長", data.response, null, parentMsgId);
            const ttsVoice = getSelectedCharacterVoice();
            fetchTtsAndPlay(data.response, ttsVoice, parentMsgId);
            enableUserInput();

            const count = typeof data.turnCount === 'number' ? data.turnCount : turnProgress.count;
            if (difficulty === '簡單') {
                if (count >= 8) {
                    recordStatus.textContent = '已達本次練習建議上限，建議結束對話並取得分析回饋。';
                } else if (count >= 6) {
                    recordStatus.textContent = '已達建議練習輪次。你可以按下「結束對話」取得分析，或再延長 1 輪。';
                } else if (count >= 5) {
                    recordStatus.textContent = '你可以準備統整重點、提出合作方向，並進行收尾。';
                } else {
                    recordStatus.textContent = `請繼續對話。${getTurnProgressText()}`;
                }
            } else {
                recordStatus.textContent = '請繼續對話，或按下「結束對話」取得分析。';
            }
        }

        currentAccumulatedText = '';
        
    } catch (error) {
        console.error('對話提交錯誤:', error);
        recordStatus.textContent = `錯誤：${error.message}`;
        enableUserInput();
    }
}

// 錄音開始
startRecordBtn.addEventListener('click', async () => {
    if (isWaitingForSubmission && submissionTimer) {
        clearTimeout(submissionTimer);
        submissionTimer = null;
    }

    try {
        addRecordingProgressElements();

        if (isNonverbalEnabled && window.nonverbalAnalysis) {
            try {
                if (!nonverbalAnalysisActive) {
                    // 只有勾選時才顯示視窗並啟動分析
                    nonverbalWindow.style.display = 'block';
                    await window.nonverbalAnalysis.start();
                    nonverbalAnalysisActive = true;
                } else {
                    window.nonverbalAnalysis.resetData();
                }
            } catch (error) {
                console.error('非語言分析操作失敗:', error);
                recordStatus.textContent = '警告: 非語言分析失敗,僅記錄語音';
            }
        } else {
            // 沒勾選時確保視窗是隱藏的
            nonverbalWindow.style.display = 'none';
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            try {
                isRecording = false;
                startRecordBtn.disabled = false;
                stopRecordBtn.disabled = true;
                stopRecordingTimer();

                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                recordStatus.textContent = '處理中...請稍候';

                if (!currentPracticeId) {
                    throw new Error('未選擇練習 ID，請先建立或選擇一個練習');
                }

                const formData = new FormData();
                formData.append('audio', audioBlob);
                formData.append('practiceId', currentPracticeId);

                const uploadResponse = await fetchWithAuth('/api/audio/transcribe', {
                    method: 'POST',
                    headers: {},
                    body: formData
                });

                if (!uploadResponse.ok) throw new Error('轉錄 API 請求失敗');

                const data = await uploadResponse.json();
                if (!data.success && data.error) throw new Error(data.error);

                let transcribedText = data.text;
                try {
                    transcribedText = await convertToTraditional(data.text);
                } catch (conversionError) {
                    console.error('簡體轉繁體失敗:', conversionError);
                }

                currentAccumulatedText = `${currentAccumulatedText.trim()} ${transcribedText}`.trim();
                updateTranscriptionPreview(currentAccumulatedText);

                await loadRecordingsHistory(currentPracticeId);

                if (submissionTimer) clearTimeout(submissionTimer);

                let countdown = 5;
                isWaitingForSubmission = true;
                recordStatus.textContent = `已轉錄！若需補充請繼續按下"開始錄音"，AI將再 ${countdown} 秒後回應`;

                submissionTimer = setInterval(async () => {
                    countdown--;
                    recordStatus.textContent = `已轉錄！若需補充請繼續按下"開始錄音"，AI將再 ${countdown} 秒後回應`;

                    if (countdown <= 0) {
                        clearInterval(submissionTimer);
                        submissionTimer = null;
                        if (currentAccumulatedText.trim().length > 0) {
                            await handleSubmission(currentAccumulatedText);
                        }
                        currentAccumulatedText = '';
                        isWaitingForSubmission = false;
                    }
                }, 1000);

            } catch (error) {
                console.error('轉錄錯誤：', error);
                recordStatus.textContent = '發生錯誤：' + error.message;
                isRecording = false;
                startRecordBtn.disabled = false;
                stopRecordBtn.disabled = true;
            } finally {
                if (mediaRecorder && mediaRecorder.stream) {
                    mediaRecorder.stream.getTracks().forEach(track => track.stop());
                }
            }
        };

        mediaRecorder.start();
        isRecording = true;
        startRecordBtn.disabled = true;
        stopRecordBtn.disabled = false;
        recordStatus.textContent = '錄音中...（最多 120 秒）';
        startRecordingTimer();

    } catch (err) {
        console.error('麥克風存取錯誤:', err);
        recordStatus.textContent = '無法存取麥克風：' + err.message;
    }
});

// 錄音停止
stopRecordBtn.addEventListener('click', () => {
    if (!checkAuthStatus()) return;
    
    if (isWaitingForSubmission) {
        clearTimeout(submissionTimer);
    }

    if (mediaRecorder && isRecording) {
        try {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
            isRecording = false;
            startRecordBtn.disabled = false;
            stopRecordBtn.disabled = true;
            recordStatus.textContent = '停止錄音...';
            stopRecordingTimer();

            if (recordingTimer) {
                clearTimeout(recordingTimer);
                recordingTimer = null;
            }
        } catch (error) {
            console.error('停止錄音時發生錯誤:', error);
            recordStatus.textContent = '停止錄音時發生錯誤';
            isRecording = false;
            startRecordBtn.disabled = false;
            stopRecordBtn.disabled = true;
        }
    }
});

// ==========================================
// 輔助功能與 UI 更新
// ==========================================

// 開始練習按鈕監聽
startPracticeBtn.addEventListener('click', async () => {
    try {
        const feedbackList = document.getElementById('feedbackList');
        if(feedbackList) feedbackList.innerHTML = '尚無心得'; 

        clearAnalysis();
        resetCountdown();

        // 隱藏分析結果框（練習開始時）
        const analysisDisplay = document.getElementById('analysisDisplay');
        if (analysisDisplay) {
            analysisDisplay.style.display = 'none';
        }

        // 顯示 record-controls panel（新練習開始時）
        const recordControlsPanel = document.querySelector('.record-controls.panel');
        if (recordControlsPanel) {
            recordControlsPanel.style.display = 'block';
        }

        // 清空上一次練習的非語言分析結果面板
        const nonverbalDisplayPanel = document.getElementById('nonverbalDataDisplay');
        if (nonverbalDisplayPanel) {
            nonverbalDisplayPanel.style.display = 'none';
            const nonverbalDataContent = document.getElementById('nonverbalDataContent');
            if (nonverbalDataContent) {
                nonverbalDataContent.innerHTML = '';
            }
        }

        // 重置非語言分析狀態,確保下次可以正常啟動
        if (isNonverbalEnabled && window.nonverbalAnalysis) {
            if (nonverbalAnalysisActive) {
                try {
                    window.nonverbalAnalysis.stop();
                    console.log('✅ 已停止上一次練習的非語言分析');
                } catch (e) {
                    console.warn('停止非語言分析時出錯:', e);
                }
                nonverbalAnalysisActive = false;
            }
        }

        const difficulty = difficultySelect.value;
        const countdownDisplay = document.getElementById('countdownDisplay');

        if (difficulty === '簡單') {
            if(countdownDisplay) countdownDisplay.style.display = 'none';
        } else if (difficulty === '挑戰') {
            if(countdownDisplay) countdownDisplay.style.display = 'block';
        }

        // 📝 新增：設置選擇的角色
        const characterSelect = document.getElementById('characterSelect');
        if (characterSelect && window.npcAvatarController) {
            const selectedCharacter = characterSelect.value;
            window.npcAvatarController.setCharacter(selectedCharacter);
            console.log('已設置NPC角色為:', selectedCharacter);
        }

        enableUserInput();

        const practiceId = await createPractice();
        if (!practiceId) {
            alert('無法建立練習，請稍後再試');
            return;
        }

        await loadPractices();
        currentPracticeId = practiceId;
        localStorage.setItem('currentPracticeId', practiceId);

        await startDialogue(practiceId);

    } catch (error) {
        console.error('開始練習失敗:', error);
        alert(error.message || '發生錯誤');
    }
});

function updateDialogueDisplay(speaker, message, audioFilePath = null, messageId = null) {
    if (!message || !message.trim()) return;

    const messageDiv = document.createElement('div');
    const speakerType = speaker.toLowerCase() === 'teacher' || speaker === '老師' ? '老師' : '家長';
    messageDiv.className = `message ${speakerType}`;
    if (messageId) messageDiv.id = messageId;

    const icon = speakerType === '老師' ? '👩‍🏫' : '👤';
    const alignment = speakerType === '老師' ? 'right' : 'left';

    let messageContent = `
        <div class="message-header" style="text-align: ${alignment}">
            ${icon} ${speakerType}
        </div>
        <div class="message-content">
            ${message}
            ${audioFilePath ? `
                <button class="play-audio-btn" onclick="playAudio('${audioFilePath}')" title="播放語音">
                    🔊 播放
                </button>
            ` : ''}
        </div>
        <div class="message-time" style="text-align: ${alignment}">
            ${new Date().toLocaleTimeString()}
        </div>
    `;

    messageDiv.innerHTML = messageContent;
    
    // 動態添加樣式 (如果還沒有的話)
    if(!document.getElementById('play-audio-style')) {
        const style = document.createElement('style');
        style.id = 'play-audio-style';
        style.textContent = `
            .play-audio-btn {
                background-color: #e93ae1;
                color: white;
                border: none;
                border-radius: 15px;
                padding: 5px 10px;
                margin-left: 10px;
                cursor: pointer;
                font-size: 0.9em;
                transition: background-color 0.3s;
            }
            .play-audio-btn:hover {
                background-color: #d32f8f;
            }
            .message-content {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
            }
        `;
        document.head.appendChild(style);
    }
    
    dialogueDisplay.appendChild(messageDiv);
    dialogueCount++;
    // messageDiv.scrollIntoView({ behavior: 'smooth' }); // 已停用自動滾動
}

function playAudio(audioFilePath) {
    stopCurrentAudio();
    currentAudioPlayer = new Audio(audioFilePath);
    currentAudioPlayer.play().catch(error => {
        console.error('播放音頻失敗:', error);
    });
}

// 背景產生 TTS，完成後自動播放並更新訊息泡泡的播放按鈕
async function fetchTtsAndPlay(text, voice, messageId) {
    try {
        const res = await fetchWithAuth('/api/dialogue/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice })
        });
        const data = await res.json();
        if (!data.success || !data.audioFilePath) return;

        // 自動播放
        playAudio(data.audioFilePath);

        // 若訊息泡泡存在，補上播放按鈕
        if (messageId) {
            const msgDiv = document.getElementById(messageId);
            if (msgDiv) {
                const contentDiv = msgDiv.querySelector('.message-content');
                if (contentDiv && !contentDiv.querySelector('.play-audio-btn')) {
                    const btn = document.createElement('button');
                    btn.className = 'play-audio-btn';
                    btn.title = '播放語音';
                    btn.textContent = '🔊 播放';
                    btn.onclick = () => playAudio(data.audioFilePath);
                    contentDiv.appendChild(btn);
                }
            }
        }
    } catch (e) {
        console.error('背景 TTS 失敗:', e);
    }
}

function stopCurrentAudio() {
    if (currentAudioPlayer) {
        currentAudioPlayer.pause();
        currentAudioPlayer = null;
    }
}

// 錄音進度條
function addRecordingProgressElements() {
    if (document.getElementById('recordingProgressContainer')) return;

    const progressContainer = document.createElement('div');
    progressContainer.id = 'recordingProgressContainer';
    progressContainer.className = 'recording-progress-container';
    progressContainer.style.display = 'none';
    
    const progressBar = document.createElement('div');
    progressBar.id = 'recordingProgressBar';
    progressBar.className = 'recording-progress-bar';
    
    const timerDisplay = document.createElement('div');
    timerDisplay.id = 'recordingTimerDisplay';
    timerDisplay.className = 'recording-timer-display';
    timerDisplay.textContent = `00:${MAX_RECORDING_TIME}`;
    
    progressContainer.appendChild(progressBar);
    progressContainer.appendChild(timerDisplay);
    
    const recordControls = document.querySelector('.record-controls');
    if (recordControls) {
        recordControls.parentNode.insertBefore(progressContainer, recordControls.nextSibling);
    } else {
        const statusElement = document.getElementById('recordStatus');
        if (statusElement) {
            statusElement.parentNode.insertBefore(progressContainer, statusElement);
        }
    }

    const style = document.createElement('style');
    style.textContent = `
        .recording-progress-container {
            margin: 15px 0;
            background-color: #f5f5f5;
            border-radius: 10px;
            padding: 5px;
            position: relative;
            height: 30px;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .recording-progress-bar {
            height: 100%;
            background-color: #e93ae1;
            border-radius: 7px;
            transition: width 0.3s ease;
            width: 0%;
            position: absolute;
            left: 0;
            top: 0;
        }
        .recording-timer-display {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            font-weight: bold;
            color: black;
            z-index: 10;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
        .recording-active {
            animation: pulse 1.5s infinite;
        }
    `;
    document.head.appendChild(style);
}

function startRecordingTimer() {
    // 先清除任何殘留的錄音計時器，避免舊計時器在背景繼續跑並強制停止新錄音
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
    recordingProgress = 0;
    let remainingTime = MAX_RECORDING_TIME;
    
    const progressContainer = document.getElementById('recordingProgressContainer');
    const progressBar = document.getElementById('recordingProgressBar');
    const timerDisplay = document.getElementById('recordingTimerDisplay');
    
    if (progressContainer && progressBar && timerDisplay) {
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressBar.classList.add('recording-active');
        timerDisplay.textContent = formatTime(remainingTime);
    }
    
    recordingTimer = setInterval(() => {
        remainingTime -= 1;
        recordingProgress = ((MAX_RECORDING_TIME - remainingTime) / MAX_RECORDING_TIME) * 100;
        
        if (progressBar) progressBar.style.width = `${recordingProgress}%`;
        
        if (timerDisplay) {
            timerDisplay.textContent = formatTime(remainingTime);
            timerDisplay.style.color = remainingTime <= 10 ? 'red' : 'black';
        }
        
        if (remainingTime <= 0) {
            if (mediaRecorder && isRecording) {
                stopRecordBtn.click();
            }
            clearInterval(recordingTimer);
            recordingTimer = null;
        }
    }, 1000);
}

function stopRecordingTimer() {
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
    const progressContainer = document.getElementById('recordingProgressContainer');
    const progressBar = document.getElementById('recordingProgressBar');
    if (progressContainer) progressContainer.style.display = 'none';
    if (progressBar) progressBar.classList.remove('recording-active');
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 轉錄預覽
function updateTranscriptionPreview(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message 老師 preview';
    messageDiv.innerHTML = `
        <div class="message-header" style="text-align: right">👩‍🏫 預覽</div>
        <div class="message-content">${text}</div>
        <div class="message-time" style="text-align: right">${new Date().toLocaleTimeString()}</div>
    `;
    
    const previousPreview = dialogueDisplay.querySelector('.message.preview');
    if (previousPreview) previousPreview.remove();
    
    dialogueDisplay.appendChild(messageDiv);
    // messageDiv.scrollIntoView({ behavior: 'smooth' }); // 已停用自動滾動
}

function clearTranscriptionPreview() {
    const preview = dialogueDisplay.querySelector('.message.preview');
    if (preview) preview.remove();
}

function disableUserInput() {
    if (isRecording && mediaRecorder) {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        isRecording = false;
    }
    if(startRecordBtn) startRecordBtn.disabled = true;
    if(stopRecordBtn) stopRecordBtn.disabled = true;
}

function enableUserInput() {
    if(startRecordBtn) startRecordBtn.disabled = false;
    if(stopRecordBtn) stopRecordBtn.disabled = true;
}

// 處理挑戰模式倒數與結束
function startCountdown() {
    const countdownDisplay = document.getElementById('countdownDisplay');
    if(countdownDisplay) countdownDisplay.style.display = 'block';

    challengeTimer = setInterval(() => {
        countdownRemaining -= 1;
        const minutes = Math.floor(countdownRemaining / 60);
        const seconds = countdownRemaining % 60;
        if(countdownDisplay) countdownDisplay.textContent = `倒計時: ${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (countdownRemaining === 30) {
            recordStatus.textContent = '請準備回應家長最後的疑問，並進行收尾。';
        }

        if (countdownRemaining <= 0) {
            clearInterval(challengeTimer);
            challengeTimer = null;
            if(countdownDisplay) countdownDisplay.style.display = 'none';
            handleChallengeTimeUp();
        }
    }, 1000);
}

function stopCountdown() {
    if (challengeTimer) {
        clearInterval(challengeTimer);
        challengeTimer = null;
    }
    countdownRemaining = 300;
}

function resetCountdown() {
    if (challengeTimer) {
        clearInterval(challengeTimer);
        challengeTimer = null;
    }
    countdownRemaining = 300;
    totalChallengeExtension = 0;
    const countdownDisplay = document.getElementById('countdownDisplay');
    if (countdownDisplay) {
        countdownDisplay.textContent = '倒計時: 5:00';
    }
}

// 挑戰模式時間到：顯示選項，不自動分析
function handleChallengeTimeUp() {
    if (totalChallengeExtension >= 60) {
        recordStatus.textContent = '已達本次練習建議上限，建議結束對話並取得分析回饋。';
        const extendBtn = document.getElementById('extendTimeBtn');
        if (extendBtn) extendBtn.style.display = 'none';
    } else {
        recordStatus.textContent = '已達建議練習時間。你可以按下「結束對話」取得分析，或延長30秒。';
        const extendBtn = document.getElementById('extendTimeBtn');
        if (extendBtn) extendBtn.style.display = '';
    }
}



// 手動結束對話並取得分析
async function endDialogue() {
    if (!currentPracticeId) {
        recordStatus.textContent = '未找到練習 ID，請先開始練習。';
        return;
    }

    // 顯示 loading 覆蓋
    showAnalysisLoading(true);
    disableUserInput();
    stopCountdown();
    const extendBtn = document.getElementById('extendTimeBtn');
    if (extendBtn) extendBtn.style.display = 'none';

    if (isNonverbalEnabled && window.nonverbalAnalysis) {
        try {
            window.nonverbalAnalysis.stop();
            nonverbalAnalysisActive = false;
        } catch (e) {
            console.error('停止非語言分析失敗:', e);
        }
    }
    if (nonverbalWindow) nonverbalWindow.style.display = 'none';

    try {
        const response = await fetchWithAuth('/api/dialogue/end-dialogue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ practiceId: currentPracticeId })
        });

        const data = await response.json();
        if (data.analysis) {
            // 分析已存入 DB，重載頁面後由 init 自動顯示
            window.location.reload();
        } else {
            showAnalysisLoading(false);
            recordStatus.textContent = '未獲得分析結果，請稍後再試。';
        }
    } catch (error) {
        console.error('結束對話時發生錯誤:', error);
        showAnalysisLoading(false);
        recordStatus.textContent = '分析失敗，請重試';
        enableUserInput();
    }
}

function showAnalysisLoading(visible) {
    let overlay = document.getElementById('analysisLoadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'analysisLoadingOverlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 9999;
            background: rgba(255,255,255,0.85);
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 20px;
        `;
        overlay.innerHTML = `
            <div style="
                width: 56px; height: 56px; border-radius: 50%;
                border: 6px solid #f0d0ef;
                border-top-color: #e93ae1;
                animation: spin 0.9s linear infinite;
            "></div>
            <p style="font-size: 18px; font-weight: 600; color: #333; margin: 0;">
                正在分析對話，請稍候...
            </p>
            <p style="font-size: 14px; color: #888; margin: 0;">
                分析完成後將自動顯示結果
            </p>
        `;
        if (!document.getElementById('analysisLoadingStyle')) {
            const s = document.createElement('style');
            s.id = 'analysisLoadingStyle';
            s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
            document.head.appendChild(s);
        }
        document.body.appendChild(overlay);
    }
    overlay.style.display = visible ? 'flex' : 'none';
}

// 保留供舊有挑戰模式計時器呼叫（challengeTimeOver 流程）
async function handleChallengeEnd() {
    await endDialogue();
}

function getSelectedCharacterVoice() {
    const characterSelect = document.getElementById('characterSelect');
    if (!characterSelect) {
        return 'nova'; // 默認使用女聲
    }
    
    const selectedCharacter = characterSelect.value;
    
    // 角色與語音的映射
    const voiceMap = {
        'mother': 'nova',   // 媽媽 - 女聲（溫暖）
        'father': 'onyx'    // 爸爸 - 男聲（沉穩）
    };
    
    return voiceMap[selectedCharacter] || 'nova';
}

async function handleDialogueEnd(practiceId, analysis) {
    if (isNonverbalEnabled && window.nonverbalAnalysis) {
        try {
            window.nonverbalAnalysis.stop();
            nonverbalAnalysisActive = false; // 重置狀態
            console.log('✅ 對話結束,已停止非語言分析並重置狀態');
        } catch (error) {
            console.error('停止非語言分析失敗:', error);
        }
    }
    if (nonverbalWindow) nonverbalWindow.style.display = 'none';

    try {
        await fetchWithAuth(`/api/practice/practices/${practiceId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ analysis }),
        });

        await loadPractices();

        const practiceItems = document.querySelectorAll('.practice-item');
        for (const item of practiceItems) {
            if (item.getAttribute('data-practice-id') === practiceId) {
                item.click();
                break;
            }
        }
    } catch (error) {
        console.error('更新練習記錄失敗:', error);
    }
}

function showEndDialogueMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message suggestion';
    messageDiv.innerHTML = `
        <div class="message-header">系統通知</div>
        <div class="message-content">對話結束，請點擊「開始練習」重新開始。</div>
    `;
    dialogueDisplay.appendChild(messageDiv);
    currentAccumulatedText = '';
}

// 溝通技巧介紹
const techniqueIntroductions = {
    "我訊息": `
        <h3>我訊息</h3>
        <p>
            1. 具體描述對方行為：<br>
            2. 說出自己主觀感受：<br>
            3. 表達自己觀點立場：<br>
            4. 提出未來改善作法：<br>
        </p>
    `,
    "三明治溝通法": `
        <h3>三明治溝通法</h3>
        <p>
            1. 第一層麵包（正向回饋）：<br>
            2. 夾心部分（建設性批評或回饋）：<br>
            3. 第二層麵包（再度正向回饋）：<br>
        </p>
    `,
    "綜合溝通技巧": `
        <h3>綜合溝通技巧</h3>
        <p>
            1. 情感表現：主動釋出善意，明顯展現理解與同理，語氣溫和尊重，親師關係正向發展。<br>
            2. 內容回應：回應聚焦問題核心，根據家長語意做出恰當補充與引導建立共識，展現高度情境掌握力。<br>
            3. 清晰表達：語言表達自然順暢，用詞精準恰當，結構明確，易於理解與建立信任。<br>
            4. 溝通技巧：恰當運用「我訊息」、「三明治溝通法」或其他正向溝通技巧，結構自然、效果良好。如無需使用技巧，語氣結構仍具高度專業。<br>
        </p>
    `
};

function selectPracticeByTechnique(technique) {
    const introDiv = document.getElementById('techniqueIntro');
    if(introDiv) {
        introDiv.innerHTML = techniqueIntroductions[technique] || '';
        introDiv.style.display = "block";
        introDiv.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}

// API 錯誤處理檢查
async function fixPracticeRoutes() {
    try {
        const response = await fetchWithAuth('/api/practice/practices', {
            method: 'GET',
            headers: { 
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API 回應檢查:', data);
    } catch (error) {
        console.error('API 檢查失敗:', error);
    }
}

// 日期輔助函數
function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

function isThisWeek(date, today) {
    const firstDayOfWeek = new Date(today);
    const day = today.getDay() || 7;
    firstDayOfWeek.setDate(today.getDate() - day + 1);
    firstDayOfWeek.setHours(0, 0, 0, 0);
    
    const lastDayOfWeek = new Date(firstDayOfWeek);
    lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
    lastDayOfWeek.setHours(23, 59, 59, 999);
    
    return date >= firstDayOfWeek && date <= lastDayOfWeek;
}

// 錄音歷史紀錄
async function loadRecordingsHistory(practiceId) {
    try {
        const response = await fetchWithAuth(`/api/audio/recordings?practiceId=${practiceId}`);

        const data = await response.json();
        const recordingsList = document.getElementById('recordingsList');
        if(!recordingsList) return;

        if (!data.success || !Array.isArray(data.recordings)) {
            recordingsList.innerHTML = '<li class="no-recordings">暫無錄音記錄</li>';
            return;
        }

        recordingsList.innerHTML = data.recordings.map(recording => {
            const audioUrl = recording.path;
            const formattedTime = new Date(recording.timestamp).toLocaleString('zh-TW');
            
            return `
                <li class="recording-item">
                    <div class="recording-time">${formattedTime}</div>
                    <div class="audio-player">
                        <audio controls controlsList="nodownload" crossorigin="anonymous">
                            <source src="${audioUrl}" type="audio/wav">
                            您的瀏覽器不支援音訊播放
                        </audio>
                    </div>
                    <div class="recording-text">${recording.transcription || '無轉錄文字'}</div>
                </li>
            `;
        }).join('');

    } catch (error) {
        console.error('載入錄音歷史失敗:', error);
        const recordingsList = document.getElementById('recordingsList');
        if(recordingsList) recordingsList.innerHTML = '<li class="error-message">載入錄音記錄時發生錯誤</li>';
    }
}

// 心得回饋相關
document.getElementById('submitFeedbackBtn').addEventListener('click', async () => {
    const feedbackInput = document.getElementById('feedbackInput');
    const feedbackText = feedbackInput.value.trim();
    
    if (!feedbackText) {
      alert('心得內容不可為空！');
      return;
    }
    
    const practiceId = localStorage.getItem('currentPracticeId');
    
    try {
            const response = await fetchWithAuth(`/api/practice/${practiceId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment: feedbackText })
      });
    
      const data = await response.json();
      if (data.success) {
        feedbackInput.value = '';
        loadFeedbackList(practiceId);
      } else {
        throw new Error(data.message || '提交心得失敗');
      }
    } catch (error) {
      console.error('提交心得失敗:', error);
      alert('提交心得失敗，請稍後再試。');
    }
});
  
async function loadFeedbackList(practiceId) {
    const feedbackList = document.getElementById('feedbackList');
    if(!feedbackList) return;
    feedbackList.innerHTML = '<p class="no-feedback">載入中...</p>';

    try {
        const response = await fetchWithAuth(`/api/practice/${practiceId}/feedback`);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '載入心得失敗');
        }

        const data = await response.json();
        if (data.success) {
            if (data.feedback.length === 0) {
                feedbackList.innerHTML = '<p class="no-feedback">目前尚無心得紀錄。</p>';
                return;
            }

            feedbackList.innerHTML = data.feedback.map(item => `
                <div class="feedback-item">
                    <div class="feedback-content">${item.comment}</div>
                    <div class="feedback-time">${new Date(item.createdAt).toLocaleString('zh-TW')}</div>
                </div>
            `).join('');
        } else {
            throw new Error(data.message || '載入心得失敗');
        }
    } catch (error) {
        console.error('載入心得失敗:', error);
        feedbackList.innerHTML = '<p class="no-feedback">載入失敗，請稍後重試。</p>';
    }
}

function clearAnalysis() {
    analysisContent.innerHTML = '';
}

// 繁簡轉換
function convertToTraditional(text) {
    return fetch('https://api.zhconvert.org/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text: text,
            converter: 'China-to-Taiwan'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) return data.text;
        throw new Error('轉換失敗');
    });
}

// 清理
window.addEventListener('beforeunload', () => {
    stopCurrentAudio();
});