// onboarding.js - 允許用戶交互的高亮區域
document.addEventListener('DOMContentLoaded', function() {
    // 檢查是否已完成教學
    const tutorialCompleted = localStorage.getItem('tutorialCompleted') === 'true';
    if (tutorialCompleted) {
      return; // 如果已完成，不顯示教學
    }
    
    // 定義教學步驟
    const steps = [
      {
        target: "techniqueSelect", // 我訊息下拉選單的ID
        title: "第一步",
        content: "選擇「溝通技巧」",
        position: "bottom"
      },
      {
        target: "difficultySelect", // 基礎模式下拉選單的ID
        title: "第二步",
        content: "選擇「基礎或挑戰模式」",
        position: "bottom"
      },
      {
        target: "startPracticeBtn", // 開始練習按鈕的ID
        title: "第三步",
        content: "點此創建新練習",
        position: "bottom"
      }
    ];
    
    let currentStep = 0;
    
    // 創建教學UI
    function createTutorialUI() {
      // 添加CSS樣式
      const style = document.createElement('style');
      style.textContent = `
        .tutorial-mask {
          position: fixed;
          background-color: rgba(0, 0, 0, 0.7);
          z-index: 9999;
          pointer-events: auto;
        }
        
        .tutorial-highlight {
          position: absolute;
          border: 4px solid #e93ae1;
          border-radius: 8px;
          z-index: 10001;
          background-color: transparent;
          animation: pulse 1.5s infinite;
          pointer-events: none; /* 非常重要: 允許點擊穿透高亮框 */
        }
        
        .tutorial-tooltip {
          position: absolute;
          background-color: white;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
          z-index: 10002;
          max-width: 300px;
        }
        
        .tutorial-tooltip h3 {
          margin: 0 0 8px 0;
          color: #e93ae1;
          font-size: 18px;
          font-weight: bold;
        }
        
        .tutorial-tooltip p {
          margin: 0 0 16px 0;
          font-size: 14px;
        }
        
        .tutorial-buttons {
          display: flex;
          justify-content: space-between;
        }
        
        .tutorial-button {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .tutorial-button-next {
          background-color: #e93ae1;
          color: white;
        }
        
        .tutorial-button-prev, .tutorial-button-skip {
          background-color: #666;
          color: white;
        }
        
        .tutorial-button-prev:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }
        
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(233, 58, 225, 0.7);
          }
          70% {
            box-shadow: 0 0 0 5px rgba(233, 58, 225, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(233, 58, 225, 0);
          }
        }
      `;
      document.head.appendChild(style);
      
      // 創建四個遮罩部分
      const topMask = document.createElement('div');
      topMask.className = 'tutorial-mask';
      
      const bottomMask = document.createElement('div');
      bottomMask.className = 'tutorial-mask';
      
      const leftMask = document.createElement('div');
      leftMask.className = 'tutorial-mask';
      
      const rightMask = document.createElement('div');
      rightMask.className = 'tutorial-mask';
      
      document.body.appendChild(topMask);
      document.body.appendChild(bottomMask);
      document.body.appendChild(leftMask);
      document.body.appendChild(rightMask);
      
      // 創建高亮框
      const highlight = document.createElement('div');
      highlight.className = 'tutorial-highlight';
      document.body.appendChild(highlight);
      
      // 創建提示框
      const tooltip = document.createElement('div');
      tooltip.className = 'tutorial-tooltip';
      document.body.appendChild(tooltip);
      
      return { 
        masks: { top: topMask, bottom: bottomMask, left: leftMask, right: rightMask },
        highlight,
        tooltip
      };
    }
    
    // 更新教學UI到當前步驟
    function updateTutorialUI(ui, step) {
      const { masks, highlight, tooltip } = ui;
      const targetEl = document.getElementById(steps[step].target);
      
      if (!targetEl) {
        console.error(`目標元素 ${steps[step].target} 未找到`);
        return;
      }
      
      // 獲取目標元素位置和尺寸
      const rect = targetEl.getBoundingClientRect();
      
      // 調整四個遮罩以創建中間的"窗口"
      // 頂部遮罩
      masks.top.style.top = '0';
      masks.top.style.left = '0';
      masks.top.style.right = '0';
      masks.top.style.bottom = (window.innerHeight - rect.top) + 'px';
      
      // 底部遮罩
      masks.bottom.style.top = rect.bottom + 'px';
      masks.bottom.style.left = '0';
      masks.bottom.style.right = '0';
      masks.bottom.style.bottom = '0';
      
      // 左側遮罩
      masks.left.style.top = rect.top + 'px';
      masks.left.style.left = '0';
      masks.left.style.width = rect.left + 'px';
      masks.left.style.height = rect.height + 'px';
      
      // 右側遮罩
      masks.right.style.top = rect.top + 'px';
      masks.right.style.left = rect.right + 'px';
      masks.right.style.right = '0';
      masks.right.style.height = rect.height + 'px';
      
      // 設置高亮框
      highlight.style.top = `${rect.top - 5}px`;
      highlight.style.left = `${rect.left - 5}px`;
      highlight.style.width = `${rect.width + 10}px`;
      highlight.style.height = `${rect.height + 10}px`;
      
      // 設置提示框內容和位置
      tooltip.innerHTML = `
        <h3>${steps[step].title}</h3>
        <p>${steps[step].content}</p>
        <div class="tutorial-buttons">
          <button class="tutorial-button tutorial-button-prev" 
                  ${step === 0 ? 'disabled' : ''}>上一步</button>
          <button class="tutorial-button tutorial-button-skip">跳過</button>
          <button class="tutorial-button tutorial-button-next">
            ${step === steps.length - 1 ? '完成' : '下一步'}
          </button>
        </div>
      `;
      
      // 設置提示框位置
      tooltip.style.top = `${rect.bottom + 10}px`;
      tooltip.style.left = `${rect.left + rect.width/2 - 150}px`;
      
      // 添加按鈕事件監聽器
      const prevBtn = tooltip.querySelector('.tutorial-button-prev');
      const skipBtn = tooltip.querySelector('.tutorial-button-skip');
      const nextBtn = tooltip.querySelector('.tutorial-button-next');
      
      // 移除舊的事件監聽器
      const newPrevBtn = prevBtn.cloneNode(true);
      const newSkipBtn = skipBtn.cloneNode(true);
      const newNextBtn = nextBtn.cloneNode(true);
      
      prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
      skipBtn.parentNode.replaceChild(newSkipBtn, skipBtn);
      nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
      
      // 添加新的事件監聽器
      newPrevBtn.addEventListener('click', prevStep);
      newSkipBtn.addEventListener('click', skipTutorial);
      newNextBtn.addEventListener('click', nextStep);
    }
    
    // 創建並顯示教學UI
    const ui = createTutorialUI();
    updateTutorialUI(ui, currentStep);
    
    // 下一步
    function nextStep() {
      if (currentStep < steps.length - 1) {
        currentStep++;
        updateTutorialUI(ui, currentStep);
      } else {
        completeTutorial();
      }
    }
    
    // 上一步
    function prevStep() {
      if (currentStep > 0) {
        currentStep--;
        updateTutorialUI(ui, currentStep);
      }
    }
    
    // 跳過教學
    function skipTutorial() {
      completeTutorial();
    }
    
    // 完成教學
    function completeTutorial() {
      // 移除教學UI
      document.body.removeChild(ui.masks.top);
      document.body.removeChild(ui.masks.bottom);
      document.body.removeChild(ui.masks.left);
      document.body.removeChild(ui.masks.right);
      document.body.removeChild(ui.highlight);
      document.body.removeChild(ui.tooltip);
      
      // 記錄已完成教學
      localStorage.setItem('tutorialCompleted', 'true');
    }
    
    // 監聽元素點擊，看是否需要進入下一步
    document.addEventListener('click', function(e) {
      // 檢查是否點擊了當前高亮元素
      const targetEl = document.getElementById(steps[currentStep].target);
      if (targetEl && targetEl.contains(e.target)) {
        // 如果用戶點擊了目標元素本身，可以選擇自動進入下一步
        // nextStep(); // 取消注釋如果你希望點擊目標元素後自動進入下一步
      }
    });
    
    // 處理窗口大小變化
    window.addEventListener('resize', function() {
      updateTutorialUI(ui, currentStep);
    });
  });