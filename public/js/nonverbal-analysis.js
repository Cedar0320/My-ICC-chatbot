// 非語言分析模組
import {
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

// DOM 元素
const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement ? canvasElement.getContext('2d') : null;
const nonverbalWindow = document.getElementById('nonverbalWindow');
const startNonverbalBtn = document.getElementById('startNonverbalBtn');
const stopNonverbalBtn = document.getElementById('stopNonverbalBtn');
const nonverbalStatus = document.getElementById('nonverbalStatus');

// HUD 元素
const elGazeVal = document.getElementById('val-gaze');
const elGazeInd = document.getElementById('ind-gaze');
const elSmileVal = document.getElementById('val-smile');
const elPoseVal = document.getElementById('val-pose');
const elHandVal = document.getElementById('val-hand');
const panelGaze = document.getElementById('hud-gaze');
const panelPose = document.getElementById('hud-pose');

// 全域變數
let isRunning = false;
let holistic;
let camera;
let lastVideoTime = -1;

// 非語言數據收集
let nonverbalData = {
    eyeContact: { good: 0, total: 0 },
    smile: { smiling: 0, total: 0 },
    posture: { open: 0, total: 0 },
    gestures: []
};

// 數據品質追蹤
let dataQualityMetrics = {
    startTime: null,
    endTime: null,
    totalFrames: 0,
    framesWithFaceDetection: 0
};

// 初始化 MediaPipe 模型
async function initNonverbalAnalysis() {
    if (!canvasElement || !videoElement) {
        console.error('Canvas or Video element not found');
        return;
    }

    console.log('開始初始化非語言分析模型...');

    try {
        // 初始化 Holistic
        holistic = new Holistic({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
        });
        holistic.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        holistic.onResults(onHolisticResults);
        console.log('✅ Holistic 模型初始化完成');

        console.log('✅ 非語言分析系統準備就緒');

    } catch (e) {
        console.error('❌ 非語言分析初始化錯誤:', e);
    }
}

// 啟動非語言分析
async function startNonverbalAnalysis() {
    if (isRunning) {
        console.log('非語言分析已在運行中');
        return;
    }

    isRunning = true;
    if (nonverbalWindow) {
        nonverbalWindow.style.display = 'block';
    }

    console.log('開始啟動非語言分析...');

    // 初始化非語言數據
    if (!nonverbalData || !nonverbalData.eyeContact) {
        resetCurrentData();
    }

    // 初始化數據品質追蹤
    dataQualityMetrics.startTime = Date.now();
    dataQualityMetrics.endTime = null;
    dataQualityMetrics.totalFrames = 0;
    dataQualityMetrics.framesWithFaceDetection = 0;

    try {
        console.log('準備啟動 Camera...');
        console.log('Video element:', videoElement);
        console.log('Holistic:', holistic);

        // 如果camera已經存在,先停止它再重新創建
        if (camera) {
            console.log('檢測到現有camera,正在停止...');
            try {
                camera.stop();
            } catch (e) {
                console.warn('停止舊camera時出錯:', e);
            }
            camera = null;
        }

        camera = new Camera(videoElement, {
            onFrame: async () => {
                if (!isRunning) return;

                // 檢查視訊流是否正常
                if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
                    console.warn('視訊尺寸為 0, 等待視訊流...');
                    return;
                }

                await holistic.send({ image: videoElement });
            },
            width: 1280,
            height: 720
        });

        console.log('Camera 物件已創建,準備啟動...');
        await camera.start();
        console.log('✅ 鏡頭已成功啟動!');

        // 等待視訊流準備好
        await new Promise((resolve) => {
            const checkVideo = setInterval(() => {
                if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                    clearInterval(checkVideo);
                    console.log(`✅ 視訊流已就緒: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
                    resolve();
                }
            }, 100);
        });

    } catch (error) {
        console.error('❌ 啟動鏡頭失敗:', error);
        throw error;
    }
}

// 重置當前收集的數據(每次錄音開始時調用)
function resetCurrentData() {
    nonverbalData = {
        eyeContact: { good: 0, total: 0 },
        smile: { smiling: 0, total: 0 },
        posture: { open: 0, total: 0 },
        gestures: []
    };

    // 重置數據品質指標
    dataQualityMetrics = {
        startTime: null,
        endTime: null,
        totalFrames: 0,
        framesWithFaceDetection: 0
    };

    console.log('非語言數據已重置');
}

// 停止非語言分析
function stopNonverbalAnalysis() {
    console.log('停止非語言分析...');
    isRunning = false;

    if (camera) {
        try {
            camera.stop();
            console.log('✅ Camera已停止');
        } catch (e) {
            console.warn('停止camera時出錯:', e);
        }
        camera = null; // 清空camera引用
    }

    if (nonverbalWindow) {
        nonverbalWindow.style.display = 'none';
    }

    // 返回收集的非語言數據
    return getNonverbalSummary();
}

// Holistic 結果處理
function onHolisticResults(results) {
    if (!canvasElement || !canvasCtx) {
        console.error('Canvas 元素不存在');
        return;
    }

    if (!results || !results.image) {
        console.error('沒有收到 Holistic 結果或影像');
        return;
    }

    // 追蹤數據品質
    dataQualityMetrics.totalFrames++;
    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        dataQualityMetrics.framesWithFaceDetection++;
    }

    // 設定 Canvas 尺寸
    const w = videoElement.videoWidth || 1280;
    const h = videoElement.videoHeight || 720;

    if (canvasElement.width !== w || canvasElement.height !== h) {
        canvasElement.width = w;
        canvasElement.height = h;
        console.log(`Canvas 尺寸設定為: ${w}x${h}`);
    }

    // 清空並繪製影像(鏡像翻轉)
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, w, h);
    canvasCtx.translate(w, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, 0, 0, w, h);
    canvasCtx.restore();

    // 1. 臉部分析
    if (results.faceLandmarks) {
        const lm = results.faceLandmarks;

        // 微笑檢測
        const mouthW = dist(lm[61], lm[291]);
        const faceW = dist(lm[234], lm[454]);
        const ratio = faceW > 0 ? mouthW / faceW : 0;

        nonverbalData.smile.total++;
        if (ratio > 0.36) {
            elSmileVal.innerText = `微笑中 (${ratio.toFixed(2)})`;
            elSmileVal.style.color = "#00b894";
            nonverbalData.smile.smiling++;
        } else {
            elSmileVal.innerText = "中性";
            elSmileVal.style.color = "white";
        }

        // 眼神接觸檢測
        const nose = lm[1];
        const leftEar = lm[234];
        const rightEar = lm[454];
        const faceCenterX = (leftEar.x + rightEar.x) / 2;
        const faceWidth = Math.abs(rightEar.x - leftEar.x);
        const relNoseX = (nose.x - faceCenterX) / (faceWidth || 0.1);

        drawPoint(nose, w, h, "#FFD700");

        nonverbalData.eyeContact.total++;
        if (Math.abs(relNoseX) < 0.15) {
            elGazeVal.innerText = "眼神接觸良好";
            elGazeInd.className = "indicator status-good";
            panelGaze.style.borderColor = "rgba(0, 184, 148, 0.5)";
            nonverbalData.eyeContact.good++;
        } else {
            elGazeVal.innerText = relNoseX < -0.15 ? "看右邊 >" : "< 看左邊";
            elGazeInd.className = "indicator status-warn";
            panelGaze.style.borderColor = "rgba(253, 203, 110, 0.5)";
        }
    }

    // 2. 姿態分析
    if (results.poseLandmarks) {
        const lm = results.poseLandmarks;
        nonverbalData.posture.total++;

        if (Math.abs(lm[15].x - lm[16].x) < 0.15) {
            elPoseVal.innerText = "雙手交叉 (防禦)";
            elPoseVal.style.color = "#ff7675";
            panelPose.style.borderColor = "rgba(214, 48, 49, 0.5)";
        } else {
            elPoseVal.innerText = "開放";
            elPoseVal.style.color = "#00b894";
            panelPose.style.borderColor = "rgba(255, 255, 255, 0.1)";
            nonverbalData.posture.open++;
        }
    }
}

// 工具函數
function dist(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function drawPoint(p, w, h, color) {
    const mx = (1 - p.x) * w;
    const my = p.y * h;
    canvasCtx.fillStyle = color;
    canvasCtx.beginPath();
    canvasCtx.arc(mx, my, 6, 0, 2 * Math.PI);
    canvasCtx.fill();
    canvasCtx.strokeStyle = "rgba(255,255,255,0.5)";
    canvasCtx.lineWidth = 2;
    canvasCtx.stroke();
}

// 獲取非語言數據總結
function getNonverbalSummary() {
    // 記錄結束時間
    dataQualityMetrics.endTime = Date.now();

    const eyeContactRate = nonverbalData.eyeContact.total > 0
        ? (nonverbalData.eyeContact.good / nonverbalData.eyeContact.total * 100).toFixed(1)
        : 0;

    const smileRate = nonverbalData.smile.total > 0
        ? (nonverbalData.smile.smiling / nonverbalData.smile.total * 100).toFixed(1)
        : 0;

    const openPostureRate = nonverbalData.posture.total > 0
        ? (nonverbalData.posture.open / nonverbalData.posture.total * 100).toFixed(1)
        : 0;

    // 計算數據品質指標
    const duration = dataQualityMetrics.startTime && dataQualityMetrics.endTime
        ? (dataQualityMetrics.endTime - dataQualityMetrics.startTime) / 1000
        : 0;

    const faceDetectionRate = dataQualityMetrics.totalFrames > 0
        ? (dataQualityMetrics.framesWithFaceDetection / dataQualityMetrics.totalFrames * 100).toFixed(1)
        : 0;

    const summary = {
        eyeContactRate: parseFloat(eyeContactRate),
        smileRate: parseFloat(smileRate),
        openPostureRate: parseFloat(openPostureRate),
        gesturesUsed: 0,
        gesturesList: [],

        // 原始統計數據
        rawData: {
            eyeContact: {
                good: nonverbalData.eyeContact.good,
                total: nonverbalData.eyeContact.total
            },
            smile: {
                smiling: nonverbalData.smile.smiling,
                total: nonverbalData.smile.total
            },
            posture: {
                open: nonverbalData.posture.open,
                total: nonverbalData.posture.total
            }
        },

        // 數據品質指標
        dataQuality: {
            sampleCount: dataQualityMetrics.totalFrames,
            duration: parseFloat(duration.toFixed(2)),
            faceDetectionRate: parseFloat(faceDetectionRate)
        }
    };

    console.log('📊 非語言數據摘要:', summary);

    return summary;
}

// 初始化
if (canvasElement && videoElement) {
    console.log('✅ Canvas 和 Video 元素已找到');
    console.log('Canvas:', canvasElement);
    console.log('Video:', videoElement);

    // 設置初始 Canvas 尺寸
    canvasElement.width = 1280;
    canvasElement.height = 720;
    console.log('初始 Canvas 尺寸:', canvasElement.width, 'x', canvasElement.height);

    initNonverbalAnalysis();
} else {
    console.error('❌ Canvas 或 Video 元素未找到!');
    console.log('Canvas element:', canvasElement);
    console.log('Video element:', videoElement);
}

// 導出函數供 main.js 使用
window.nonverbalAnalysis = {
    start: startNonverbalAnalysis,
    stop: stopNonverbalAnalysis,
    getData: getNonverbalSummary,
    resetData: resetCurrentData,
    isRunning: () => isRunning
};
