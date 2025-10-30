const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs').promises;
// face-api 将通过 HTML script 标签加载

// 摄像头和检测相关变量
let video;
let canvas;
let ctx;
let stream;
let detectionInterval;
let isRunning = false;
let modelsLoaded = false;
let recognitionModelsLoaded = false;
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
let detectionActionSelect;

// 摄像头列表
let cameras = [];
let selectedCameraId = null;

// 高级功能：人脸识别相关
let faceDatabase = {
    owner: [],       // 本人
    trusted: [],     // 可信任
    untrusted: []    // 不可信任
};
let recognitionMode = 'none'; // none, exclude-owner, exclude-trusted, untrusted-only
let recognitionThreshold = 0.5; // 识别阈值（默认0.5，比之前的0.6更严格）

// 通知相关
let lastNotificationTime = 0;
const NOTIFICATION_COOLDOWN = 5000; // 通知冷却时间：5秒（避免过于频繁）

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
    detectionActionSelect = document.getElementById('detectionAction');

    // 绑定按钮事件
    startBtn.addEventListener('click', startDetection);
    stopBtn.addEventListener('click', stopDetection);

    // 绑定摄像头切换事件
    cameraSelect.addEventListener('change', onCameraChange);

    // 绑定检测方式切换事件
    detectionActionSelect.addEventListener('change', onDetectionActionChange);

    // 绑定通知内容输入事件（自动保存）
    const notificationTextInput = document.getElementById('notificationText');
    notificationTextInput.addEventListener('input', () => {
        localStorage.setItem('notificationText', notificationTextInput.value);
    });

    // 加载保存的通知内容
    const savedNotificationText = localStorage.getItem('notificationText');
    if (savedNotificationText) {
        notificationTextInput.value = savedNotificationText;
    }

    // 初始化通知内容输入框显示状态
    onDetectionActionChange();

    // 绑定高级功能事件
    document.getElementById('selectOwnerBtn').addEventListener('click', () => selectFaceFolder('owner'));
    document.getElementById('selectTrustedBtn').addEventListener('click', () => selectFaceFolder('trusted'));
    document.getElementById('selectUntrustedBtn').addEventListener('click', () => selectFaceFolder('untrusted'));
    
    document.getElementById('analyzeOwnerBtn').addEventListener('click', () => analyzeFaces('owner'));
    document.getElementById('analyzeTrustedBtn').addEventListener('click', () => analyzeFaces('trusted'));
    document.getElementById('analyzeUntrustedBtn').addEventListener('click', () => analyzeFaces('untrusted'));
    
    document.getElementById('clearOwnerBtn').addEventListener('click', () => clearCategoryFaces('owner'));
    document.getElementById('clearTrustedBtn').addEventListener('click', () => clearCategoryFaces('trusted'));
    document.getElementById('clearUntrustedBtn').addEventListener('click', () => clearCategoryFaces('untrusted'));
    
    document.getElementById('clearAllFacesBtn').addEventListener('click', clearAllFaces);
    document.getElementById('viewFacesBtn').addEventListener('click', viewFaces);

    // 绑定模式切换事件
    document.querySelectorAll('input[name="mode"]').forEach(radio => {
        radio.addEventListener('change', onModeChange);
    });

    // 绑定阈值滑动条事件
    const thresholdSlider = document.getElementById('recognitionThreshold');
    thresholdSlider.addEventListener('input', onThresholdChange);
    // 初始化显示
    updateThresholdDisplay(recognitionThreshold);

    // 加载摄像头列表
    await loadCameras();

    // 加载人脸检测模型
    await loadModels();

    // 加载已保存的人脸数据
    loadFaceDatabase();

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

        // 加载检测模型和识别模型
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);

        modelsLoaded = true;
        recognitionModelsLoaded = true;
        updateStatus('模型加载完成（含识别模型）', '#4CAF50');
        console.log('人脸检测和识别模型加载完成');
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
        let shouldReduce = false;

        if (modelsLoaded && video.readyState === 4) {
            // 获取当前灵敏度设置
            const scoreThreshold = parseFloat(sensitivitySelect.value);

            // 获取选择的模型
            const selectedModel = modelSelect.value;

            let detections;

            // 根据选择的模型进行检测（如果需要识别，同时提取特征）
            if (recognitionMode !== 'none' && recognitionModelsLoaded) {
                // 高级模式：需要人脸识别
                if (selectedModel === 'tiny') {
                    detections = await faceapi.detectAllFaces(
                        video,
                        new faceapi.TinyFaceDetectorOptions({
                            inputSize: 416,
                            scoreThreshold: scoreThreshold
                        })
                    ).withFaceLandmarks().withFaceDescriptors();
                } else if (selectedModel === 'ssd') {
                    detections = await faceapi.detectAllFaces(
                        video,
                        new faceapi.SsdMobilenetv1Options({
                            minConfidence: scoreThreshold
                        })
                    ).withFaceLandmarks().withFaceDescriptors();
                }
            } else {
                // 基本模式：只需要检测
                if (selectedModel === 'tiny') {
                    detections = await faceapi.detectAllFaces(
                        video,
                        new faceapi.TinyFaceDetectorOptions({
                            inputSize: 416,
                            scoreThreshold: scoreThreshold
                        })
                    );
                } else if (selectedModel === 'ssd') {
                    detections = await faceapi.detectAllFaces(
                        video,
                        new faceapi.SsdMobilenetv1Options({
                            minConfidence: scoreThreshold
                        })
                    );
                }
            }

            const faceCount = detections ? detections.length : 0;

            // 根据模式决定是否降低亮度
            if (recognitionMode !== 'none' && recognitionModelsLoaded && faceCount > 0) {
                // 高级模式：进行人脸识别
                const recognitionResults = detections.map(d => recognizeFace(d.descriptor));
                const decision = shouldReduceBrightness(recognitionResults);
                shouldReduce = decision;

                // 显示调试信息
                const categoryNames = { owner: '本人', trusted: '可信任', untrusted: '不可信任' };
                const identities = recognitionResults.map((r, i) => {
                    if (r.matched) {
                        const icons = { owner: '👤', trusted: '✅', untrusted: '⚠️' };
                        const name = categoryNames[r.category];
                        return `${icons[r.category]}${name}(${(r.confidence * 100).toFixed(0)}%)`;
                    } else {
                        return '❓未知';
                    }
                }).join(', ');
                
                debugInfoEl.textContent = `${faceCount}张人脸: ${identities}`;
            } else {
                // 基本模式：使用人脸数量阈值
                const faceThreshold = parseInt(faceThresholdInput.value) || 2;
                shouldReduce = faceCount >= faceThreshold;

                // 显示调试信息
                if (faceCount > 0) {
                    const faceInfo = detections.map((d, i) => {
                        const score = (d.score * 100).toFixed(0);
                        return `人脸${i+1}(${score}%)`;
                    }).join(', ');
                    debugInfoEl.textContent = `${faceCount}张人脸: ${faceInfo}`;
                } else {
                    debugInfoEl.textContent = `未检测到人脸`;
                }
            }

            // 只在需要显示检测框时才绘制
            if (showDetectionCheckbox.checked) {
                // 清空 canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                if (faceCount > 0) {
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
            shouldReduce = simulateFaceDetection();
        }

        // 根据设置的处理方式执行操作
        const action = detectionActionSelect.value;
        
        if (shouldReduce) {
            faceDetectedEl.textContent = '检测到窥屏';
            faceDetectedEl.style.color = '#e74c3c';

            // 根据选择的处理方式执行
            if (action === 'brightness' || action === 'both') {
                // 调低屏幕亮度到最低亮度
                const minBrightness = parseInt(minBrightnessInput.value);
                await setBrightness(minBrightness);
            }
            
            if (action === 'notification' || action === 'both') {
                // 获取自定义通知内容
                const customText = document.getElementById('notificationText').value.trim();
                const notificationBody = customText || '检测到异常活动';
                
                // 发送系统通知
                sendNotification('提醒', notificationBody);
            }
        } else {
            faceDetectedEl.textContent = '无人脸';
            faceDetectedEl.style.color = '#4CAF50';

            // 恢复屏幕亮度到用户设定的最高亮度
            if (action === 'brightness' || action === 'both') {
                const maxBrightness = parseInt(maxBrightnessInput.value);
                await setBrightness(maxBrightness);
            }
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

// 发送系统通知
function sendNotification(title, body) {
    // 检查是否在冷却时间内
    const now = Date.now();
    if (now - lastNotificationTime < NOTIFICATION_COOLDOWN) {
        return;
    }
    
    // 检查通知支持
    if (!('Notification' in window)) {
        console.error('系统不支持通知功能');
        return;
    }
    
    if (Notification.permission === 'granted') {
        // 已授权，直接发送
        showNotification(title, body);
    } else if (Notification.permission === 'denied') {
        // 已拒绝
        console.warn('通知权限已被拒绝，请在系统设置中允许通知');
    } else {
        // 未授权，请求权限
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showNotification(title, body);
            }
        });
    }
}

// 显示通知（使用Electron IPC）
async function showNotification(title, body) {
    try {
        // 尝试使用Electron原生通知
        const result = await ipcRenderer.invoke('show-notification', { title, body });
        
        // 更新最后通知时间
        lastNotificationTime = Date.now();
        
        if (!result.success) {
            // 降级到Web Notification API
            const notification = new Notification(title, {
                body: body,
                silent: false,
                requireInteraction: false,
                tag: 'peeping-detection'
            });
            
            // 点击通知时聚焦窗口
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        }
    } catch (error) {
        console.error('发送通知失败:', error);
    }
}

// 检测方式切换事件
function onDetectionActionChange() {
    const action = detectionActionSelect.value;
    const notificationTextGroup = document.getElementById('notificationTextGroup');
    
    // 只有选择了通知相关的模式才显示通知内容输入框
    if (action === 'notification' || action === 'both') {
        notificationTextGroup.style.display = 'block';
    } else {
        notificationTextGroup.style.display = 'none';
    }
}

// 更新状态显示
function updateStatus(text, color) {
    statusEl.textContent = text;
    statusEl.style.color = color;
}

// ==================== 高级功能：人脸识别 ====================

// 选择文件夹
async function selectFaceFolder(category) {
    const result = await ipcRenderer.invoke('select-directory');
    if (result) {
        document.getElementById(`${category}Path`).value = result;
        document.getElementById(`analyze${capitalize(category)}Btn`).disabled = false;
    }
}

// 分析人脸
async function analyzeFaces(category) {
    const folderPath = document.getElementById(`${category}Path`).value;
    if (!folderPath) {
        alert('请先选择文件夹');
        return;
    }

    if (!recognitionModelsLoaded) {
        alert('人脸识别模型尚未加载完成');
        return;
    }

    const statusEl = document.getElementById(`${category}Status`);
    
    try {
        updateCategoryStatus(statusEl, '正在分析图片...', 'loading');

        // 读取文件夹中的图片
        const files = await fs.readdir(folderPath);
        const imageFiles = files.filter(file => 
            /\.(jpg|jpeg|png|gif|bmp)$/i.test(file)
        );

        if (imageFiles.length === 0) {
            updateCategoryStatus(statusEl, '未找到图片文件', 'error');
            return;
        }

        let successCount = 0;
        let failCount = 0;
        const newFaces = [];

        for (const fileName of imageFiles) {
            const filePath = path.join(folderPath, fileName);
            
            try {
                // 读取图片
                const imageBuffer = await fs.readFile(filePath);
                const base64 = imageBuffer.toString('base64');
                const dataUrl = `data:image/jpeg;base64,${base64}`;

                // 创建图片元素
                const img = await loadImage(dataUrl);

                // 检测人脸并提取特征
                const detection = await faceapi
                    .detectSingleFace(img)
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (detection) {
                    newFaces.push({
                        id: Date.now() + Math.random(),
                        name: fileName,
                        descriptor: Array.from(detection.descriptor),
                        filePath: filePath,
                        timestamp: new Date().toISOString()
                    });
                    successCount++;
                } else {
                    failCount++;
                    console.log(`未在 ${fileName} 中检测到人脸`);
                }

            } catch (error) {
                console.error(`处理 ${fileName} 失败:`, error);
                failCount++;
            }
        }

        // 保存到数据库
        faceDatabase[category].push(...newFaces);
        saveFaceDatabase();

        updateCategoryStatus(statusEl, 
            `✅ 分析完成！成功: ${successCount} 张，失败: ${failCount} 张`, 
            'success'
        );

        console.log(`${category} 类别新增 ${successCount} 张人脸`);

    } catch (error) {
        console.error('分析失败:', error);
        updateCategoryStatus(statusEl, '❌ 分析失败: ' + error.message, 'error');
    }
}

// 加载图片
function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = dataUrl;
    });
}

// 保存人脸数据库
function saveFaceDatabase() {
    try {
        localStorage.setItem('faceDatabase', JSON.stringify(faceDatabase));
        console.log('人脸数据库已保存');
    } catch (error) {
        console.error('保存数据失败:', error);
    }
}

// 加载人脸数据库
function loadFaceDatabase() {
    try {
        const data = localStorage.getItem('faceDatabase');
        if (data) {
            faceDatabase = JSON.parse(data);
            console.log(`人脸数据库已加载: 本人=${faceDatabase.owner.length}, 可信任=${faceDatabase.trusted.length}, 不可信任=${faceDatabase.untrusted.length}`);
        }
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

// 清空单个类别的人脸数据
function clearCategoryFaces(category) {
    const categoryNames = {
        owner: '本人',
        trusted: '可信任',
        untrusted: '不可信任'
    };
    
    const count = faceDatabase[category].length;
    
    if (count === 0) {
        alert(`${categoryNames[category]}类别当前没有数据`);
        return;
    }
    
    if (!confirm(`确定要清空"${categoryNames[category]}"的所有数据吗？\n当前有 ${count} 张人脸\n此操作不可恢复！`)) {
        return;
    }

    faceDatabase[category] = [];
    saveFaceDatabase();
    
    // 清空状态显示
    document.getElementById(`${category}Status`).innerHTML = '';

    alert(`✅ 已清空"${categoryNames[category]}"的数据 (${count} 张)`);
    console.log(`已清空 ${category} 类别，删除了 ${count} 张人脸`);
}

// 清空所有人脸数据
function clearAllFaces() {
    const total = faceDatabase.owner.length + faceDatabase.trusted.length + faceDatabase.untrusted.length;
    
    if (total === 0) {
        alert('当前没有任何人脸数据');
        return;
    }
    
    if (!confirm(`确定要清空所有已保存的人脸数据吗？\n• 本人: ${faceDatabase.owner.length} 张\n• 可信任: ${faceDatabase.trusted.length} 张\n• 不可信任: ${faceDatabase.untrusted.length} 张\n\n总计: ${total} 张\n\n此操作不可恢复！`)) {
        return;
    }

    faceDatabase = {
        owner: [],
        trusted: [],
        untrusted: []
    };
    localStorage.removeItem('faceDatabase');
    
    // 清空状态
    ['owner', 'trusted', 'untrusted'].forEach(category => {
        document.getElementById(`${category}Status`).innerHTML = '';
    });

    alert(`✅ 所有人脸数据已清空 (共 ${total} 张)`);
    console.log('人脸数据库已清空');
}

// 查看已存储人脸
function viewFaces() {
    const total = faceDatabase.owner.length + faceDatabase.trusted.length + faceDatabase.untrusted.length;
    
    if (total === 0) {
        alert('当前没有存储任何人脸数据');
        return;
    }

    const message = `
已存储的人脸数据：
• 本人: ${faceDatabase.owner.length} 张
• 可信任: ${faceDatabase.trusted.length} 张
• 不可信任: ${faceDatabase.untrusted.length} 张

总计: ${total} 张人脸
    `.trim();

    alert(message);
}

// 模式切换事件
function onModeChange(event) {
    recognitionMode = event.target.value;
    console.log('识别模式切换为:', recognitionMode);

    const thresholdHint = document.getElementById('thresholdHint');
    
    if (recognitionMode === 'none') {
        // 使用基本设置
        thresholdHint.textContent = '≥此数量的人脸才降低亮度（默认2: 你+其他人）';
        thresholdHint.style.color = '#888';
        faceThresholdInput.disabled = false;
    } else {
        // 使用高级模式，阈值失效
        thresholdHint.textContent = '⚠️ 当前使用高级识别模式，此阈值已失效';
        thresholdHint.style.color = '#e74c3c';
        faceThresholdInput.disabled = true;
    }
}

// 识别人脸（对比已知人脸）
function recognizeFace(descriptor) {
    // 使用全局阈值变量（可通过滑动条调节）
    let bestMatch = null;
    let bestDistance = Infinity;
    let bestCategory = null;

    // 遍历所有类别
    ['owner', 'trusted', 'untrusted'].forEach(category => {
        faceDatabase[category].forEach(face => {
            const distance = faceapi.euclideanDistance(face.descriptor, descriptor);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestMatch = face;
                bestCategory = category;
            }
        });
    });

    if (bestDistance < recognitionThreshold) {
        return {
            matched: true,
            category: bestCategory,
            confidence: 1 - bestDistance,
            name: bestMatch.name
        };
    } else {
        return {
            matched: false,
            category: 'unknown'
        };
    }
}

// 判断是否应该降低亮度（根据模式）
function shouldReduceBrightness(recognitionResults) {
    const mode = recognitionMode;

    // 模式：不启用（使用基本设置）
    if (mode === 'none') {
        return null; // 返回null表示使用基本逻辑
    }

    // 模式：除本人外
    if (mode === 'exclude-owner') {
        // 只要检测到非本人，就降低亮度
        const hasNonOwner = recognitionResults.some(r => 
            !r.matched || (r.matched && r.category !== 'owner')
        );
        return hasNonOwner;
    }

    // 模式：除本人及可信任外
    if (mode === 'exclude-trusted') {
        // 检测到不可信任或未知人脸，降低亮度
        const hasUntrusted = recognitionResults.some(r => 
            !r.matched || (r.matched && r.category === 'untrusted')
        );
        return hasUntrusted;
    }

    // 模式：仅针对不可信目标
    if (mode === 'untrusted-only') {
        // 只有检测到已标记的不可信任者才降低亮度
        const hasKnownUntrusted = recognitionResults.some(r => 
            r.matched && r.category === 'untrusted'
        );
        return hasKnownUntrusted;
    }

    return null;
}

// 更新类别状态
function updateCategoryStatus(element, message, type) {
    element.innerHTML = message;
    element.className = `category-status ${type}`;
}

// 阈值滑动条变化事件
function onThresholdChange(event) {
    recognitionThreshold = parseFloat(event.target.value);
    updateThresholdDisplay(recognitionThreshold);
    console.log('识别阈值更新为:', recognitionThreshold);
}

// 更新阈值显示
function updateThresholdDisplay(threshold) {
    const confidence = Math.round((1 - threshold) * 100);
    document.getElementById('thresholdValue').textContent = threshold.toFixed(2);
    document.getElementById('confidenceValue').textContent = confidence + '%';
}

// 首字母大写
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
