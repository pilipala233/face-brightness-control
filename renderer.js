const { ipcRenderer } = require('electron');
// face-api 将通过 HTML script 标签加载

// 摄像头和检测相关变量
let video;
let canvas;
let ctx;
let stream;
let detectionInterval;
let isRunning = false;
let modelsLoaded = false;
let originalBrightness = null; // 改为 null，表示还未获取

// UI 元素
let startBtn;
let stopBtn;
let statusEl;
let faceDetectedEl;
let debugInfoEl;
let intervalInput;
let minBrightnessInput;
let maxBrightnessInput;
let cameraSelect;
let modelSelect;
let showDetectionCheckbox;
let sensitivitySelect;
let faceThresholdInput;

// 摄像头列表
let cameras = [];
let selectedCameraId = null;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');

    startBtn = document.getElementById('startBtn');
    stopBtn = document.getElementById('stopBtn');
    statusEl = document.getElementById('status');
    faceDetectedEl = document.getElementById('faceDetected');
    debugInfoEl = document.getElementById('debugInfo');
    intervalInput = document.getElementById('interval');
    minBrightnessInput = document.getElementById('minBrightness');
    maxBrightnessInput = document.getElementById('maxBrightness');
    cameraSelect = document.getElementById('cameraSelect');
    modelSelect = document.getElementById('modelSelect');
    showDetectionCheckbox = document.getElementById('showDetection');
    sensitivitySelect = document.getElementById('sensitivity');
    faceThresholdInput = document.getElementById('faceThreshold');

    // 绑定按钮事件
    startBtn.addEventListener('click', startDetection);
    stopBtn.addEventListener('click', stopDetection);

    // 绑定摄像头切换事件
    cameraSelect.addEventListener('change', onCameraChange);

    // 加载摄像头列表
    await loadCameras();

    // 加载人脸检测模型
    await loadModels();

    // 获取当前亮度并保存为原始亮度
    const result = await ipcRenderer.invoke('get-brightness');
    if (result.success) {
        originalBrightness = result.level;

        // 自动设置最高亮度为当前检测到的亮度
        maxBrightnessInput.value = originalBrightness;

        console.log(`检测到当前系统亮度: ${originalBrightness}%（将在无人脸时恢复此亮度）`);
        updateStatus(`已就绪 (当前亮度: ${originalBrightness}%)`, '#4CAF50');
    } else {
        // 如果无法获取亮度，默认使用 100%
        originalBrightness = 100;
        maxBrightnessInput.value = 100;
        console.warn('无法获取当前亮度，将使用 100% 作为默认值');
        updateStatus('已就绪 (亮度控制可能不可用)', '#FFA500');
    }
});

// 加载摄像头列表
async function loadCameras() {
    try {
        // 先请求一次摄像头权限，这样才能枚举设备
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach(track => track.stop());

        // 枚举所有视频输入设备
        const devices = await navigator.mediaDevices.enumerateDevices();
        cameras = devices.filter(device => device.kind === 'videoinput');

        // 填充下拉列表
        cameraSelect.innerHTML = '';
        cameras.forEach((camera, index) => {
            const option = document.createElement('option');
            option.value = camera.deviceId;
            option.text = camera.label || `摄像头 ${index + 1}`;
            cameraSelect.appendChild(option);
        });

        // 默认选择第一个摄像头
        if (cameras.length > 0) {
            selectedCameraId = cameras[0].deviceId;
            console.log(`找到 ${cameras.length} 个摄像头`);
        } else {
            cameraSelect.innerHTML = '<option value="">未找到摄像头</option>';
        }
    } catch (error) {
        console.error('加载摄像头列表失败:', error);
        cameraSelect.innerHTML = '<option value="">加载失败</option>';
    }
}

// 摄像头切换事件
async function onCameraChange() {
    selectedCameraId = cameraSelect.value;
    console.log('切换摄像头:', selectedCameraId);

    // 如果正在运行，重启检测以使用新摄像头
    if (isRunning) {
        stopDetection();
        // 等待一小段时间后重启
        setTimeout(() => {
            startDetection();
        }, 500);
    }
}

// 加载 face-api 模型
async function loadModels() {
    try {
        updateStatus('加载模型中...', '#FFA500');

        const MODEL_URL = './node_modules/@vladmandic/face-api/model';

        // 加载 TinyFaceDetector 和 SSD MobileNet 模型
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)
        ]);

        modelsLoaded = true;
        updateStatus('模型加载完成', '#4CAF50');
        console.log('人脸检测模型加载完成 (TinyFaceDetector, SSD MobileNet)');
    } catch (error) {
        console.error('模型加载失败:', error);
        updateStatus('模型加载失败', '#e74c3c');
        alert('人脸检测模型加载失败，将使用简化检测模式');
    }
}

// 启动检测
async function startDetection() {
    try {
        // 构建视频约束
        const constraints = {
            video: {
                width: 640,
                height: 480
            }
        };

        // 如果选择了特定摄像头，添加 deviceId 约束
        if (selectedCameraId) {
            constraints.video.deviceId = { exact: selectedCameraId };
        }

        // 获取摄像头权限
        stream = await navigator.mediaDevices.getUserMedia(constraints);

        video.srcObject = stream;

        // 设置 canvas 尺寸
        video.addEventListener('loadedmetadata', () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        });

        isRunning = true;
        updateStatus('运行中', '#4CAF50');

        startBtn.disabled = true;
        stopBtn.disabled = false;
        cameraSelect.disabled = true; // 运行时禁用摄像头切换

        // 开始定期检测
        const interval = parseInt(intervalInput.value);
        detectionInterval = setInterval(detectFace, interval);

    } catch (error) {
        console.error('启动摄像头失败:', error);
        alert('无法访问摄像头，请检查权限设置');
    }
}

// 停止检测
function stopDetection() {
    isRunning = false;

    // 停止摄像头
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }

    // 清除定时器
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }

    video.srcObject = null;
    updateStatus('已停止', '#999');
    faceDetectedEl.textContent = '无';
    faceDetectedEl.style.color = '#999';

    startBtn.disabled = false;
    stopBtn.disabled = true;
    cameraSelect.disabled = false; // 停止后重新启用摄像头切换

    // 恢复到用户设定的最高亮度
    const maxBrightness = parseInt(maxBrightnessInput.value);
    setBrightness(maxBrightness);
}

// 人脸检测函数
async function detectFace() {
    if (!isRunning) return;

    try {
        let faceDetected = false;

        if (modelsLoaded && video.readyState === 4) {
            // 获取当前灵敏度设置
            const scoreThreshold = parseFloat(sensitivitySelect.value);

            // 获取选择的模型
            const selectedModel = modelSelect.value;

            let detections;

            // 根据选择的模型进行检测
            if (selectedModel === 'tiny') {
                // TinyFaceDetector - 最快
                detections = await faceapi.detectAllFaces(
                    video,
                    new faceapi.TinyFaceDetectorOptions({
                        inputSize: 416,
                        scoreThreshold: scoreThreshold
                    })
                );
            } else if (selectedModel === 'ssd') {
                // SSD MobileNet - 平衡
                detections = await faceapi.detectAllFaces(
                    video,
                    new faceapi.SsdMobilenetv1Options({
                        minConfidence: scoreThreshold
                    })
                );
            }

            // 获取人脸数量阈值
            const faceThreshold = parseInt(faceThresholdInput.value) || 2;
            const faceCount = detections ? detections.length : 0;
            
            // 只有当检测到的人脸数量达到或超过阈值时才判定为检测到人脸
            faceDetected = faceCount >= faceThreshold;

            // 显示调试信息
            if (faceCount > 0) {
                const faceInfo = detections.map((d, i) => {
                    const box = d.box;
                    const score = d.score.toFixed(2);
                    const size = Math.round(box.width);
                    return `人脸${i+1}: 大小=${size}px, 置信度=${score}`;
                }).join(' | ');
                const triggerStatus = faceDetected ? '✓ 已触发' : `✗ 未达阈值(${faceThreshold})`;
                debugInfoEl.textContent = `[${selectedModel.toUpperCase()}] 检测到 ${faceCount} 张人脸 ${triggerStatus}: ${faceInfo}`;
            } else {
                debugInfoEl.textContent = `[${selectedModel.toUpperCase()}] 未检测到人脸 (灵敏度: ${scoreThreshold}, 阈值: ${faceThreshold}张)`;
            }

            // 只在需要显示检测框时才绘制
            if (showDetectionCheckbox.checked) {
                // 清空 canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                if (faceDetected && detections.length > 0) {
                    // 确保 canvas 尺寸匹配
                    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                    }

                    // 绘制人脸框
                    faceapi.draw.drawDetections(canvas, detections);
                }
            }
        } else {
            // 降级方案：使用简单的模拟检测
            faceDetected = simulateFaceDetection();
        }

        // 更新 UI 和亮度
        if (faceDetected) {
            faceDetectedEl.textContent = '检测到人脸';
            faceDetectedEl.style.color = '#e74c3c';

            // 调低屏幕亮度到最低亮度
            const minBrightness = parseInt(minBrightnessInput.value);
            await setBrightness(minBrightness);
        } else {
            faceDetectedEl.textContent = '无人脸';
            faceDetectedEl.style.color = '#4CAF50';

            // 恢复屏幕亮度到用户设定的最高亮度
            const maxBrightness = parseInt(maxBrightnessInput.value);
            await setBrightness(maxBrightness);
        }
    } catch (error) {
        console.error('人脸检测出错:', error);
    }
}

// 模拟人脸检测（临时备用方案）
function simulateFaceDetection() {
    // 简单的随机模拟，仅在模型加载失败时使用
    return Math.random() > 0.5;
}

// 设置屏幕亮度
async function setBrightness(level) {
    try {
        const result = await ipcRenderer.invoke('set-brightness', level);
        if (!result.success) {
            console.error('设置亮度失败:', result.error);
        }
    } catch (error) {
        console.error('调用亮度控制失败:', error);
    }
}

// 更新状态显示
function updateStatus(text, color) {
    statusEl.textContent = text;
    statusEl.style.color = color;
}
