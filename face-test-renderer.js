const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// 元素
let video;
let canvas;
let ctx;
let stream;
let modelsLoaded = false;
let detectionInterval;
let savedFaces = []; // 存储已知人脸特征

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');

    // 加载模型
    await loadModels();

    // 绑定事件
    document.getElementById('startCamera').addEventListener('click', startCamera);
    document.getElementById('capturePhoto').addEventListener('click', capturePhoto);
    document.getElementById('selectFolder').addEventListener('click', selectSaveFolder);
    document.getElementById('selectAnalyzeFolder').addEventListener('click', selectAnalyzeFolder);
    document.getElementById('analyzeButton').addEventListener('click', analyzeFaces);
    document.getElementById('clearData').addEventListener('click', clearAllData);

    // 加载已保存的人脸数据
    loadSavedFaces();
});

// 加载模型
async function loadModels() {
    try {
        updateStatus('modelStatus', '正在加载人脸检测模型...', 'loading');

        const MODEL_URL = './node_modules/@vladmandic/face-api/model';

        // 加载检测和识别模型
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL) // 关键：人脸识别模型
        ]);

        modelsLoaded = true;
        updateStatus('modelStatus', '✅ 模型加载完成！可以开始使用', 'success');
        console.log('人脸识别模型加载完成');
    } catch (error) {
        console.error('模型加载失败:', error);
        updateStatus('modelStatus', '❌ 模型加载失败: ' + error.message, 'error');
    }
}

// 启动摄像头
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
        });

        video.srcObject = stream;
        video.addEventListener('loadedmetadata', () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        });

        document.getElementById('startCamera').disabled = true;
        document.getElementById('capturePhoto').disabled = false;

        // 开始实时检测
        startLiveDetection();
    } catch (error) {
        console.error('启动摄像头失败:', error);
        alert('无法访问摄像头: ' + error.message);
    }
}

// 实时检测
async function startLiveDetection() {
    if (detectionInterval) clearInterval(detectionInterval);

    detectionInterval = setInterval(async () => {
        if (!modelsLoaded || !video.srcObject) return;

        try {
            // 检测人脸并提取特征
            const detections = await faceapi
                .detectAllFaces(video)
                .withFaceLandmarks()
                .withFaceDescriptors();

            // 显示检测结果
            const liveDetectionDiv = document.getElementById('liveDetection');
            
            if (detections.length === 0) {
                liveDetectionDiv.innerHTML = '<p style="color: #999;">未检测到人脸</p>';
                return;
            }

            // 对比已知人脸
            let html = `<p>检测到 ${detections.length} 张人脸：</p>`;
            
            detections.forEach((detection, index) => {
                const result = recognizeFace(detection.descriptor);
                
                if (result.match) {
                    html += `
                        <div class="detection-item match">
                            <strong>人脸 ${index + 1}:</strong> ✅ 匹配到 "${result.name}"
                            <br>相似度: ${(result.confidence * 100).toFixed(1)}%
                            ${result.remark ? `<br>备注: ${result.remark}` : ''}
                        </div>
                    `;
                } else {
                    html += `
                        <div class="detection-item unknown">
                            <strong>人脸 ${index + 1}:</strong> ⚠️ 未知人脸
                            ${result.bestMatch ? `<br>最接近: ${result.bestMatch.name} (${(result.bestMatch.confidence * 100).toFixed(1)}%)` : ''}
                        </div>
                    `;
                }
            });

            liveDetectionDiv.innerHTML = html;

        } catch (error) {
            console.error('检测出错:', error);
        }
    }, 500); // 每500ms检测一次
}

// 识别人脸（对比已知人脸）
function recognizeFace(descriptor) {
    if (savedFaces.length === 0) {
        return { match: false };
    }

    const matches = savedFaces.map(face => {
        const distance = faceapi.euclideanDistance(face.descriptor, descriptor);
        return {
            name: face.name,
            remark: face.remark,
            isOwner: face.isOwner,
            distance: distance,
            confidence: 1 - distance
        };
    });

    // 排序找最相似的
    matches.sort((a, b) => a.distance - b.distance);
    const bestMatch = matches[0];

    // 阈值：< 0.6 视为匹配
    const threshold = 0.6;

    if (bestMatch.distance < threshold) {
        return {
            match: true,
            name: bestMatch.name,
            remark: bestMatch.remark,
            confidence: bestMatch.confidence
        };
    } else {
        return {
            match: false,
            bestMatch: bestMatch.distance < 0.8 ? bestMatch : null
        };
    }
}

// 拍照
async function capturePhoto() {
    if (!modelsLoaded) {
        alert('模型尚未加载完成');
        return;
    }

    const savePath = document.getElementById('savePath').value;
    if (!savePath) {
        alert('请先选择保存文件夹');
        return;
    }

    try {
        // 检测人脸
        const detection = await faceapi
            .detectSingleFace(video)
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            alert('未检测到人脸，请调整位置后重试');
            return;
        }

        // 截取图片
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

        // 生成文件名
        const timestamp = new Date().getTime();
        const fileName = `face_${timestamp}.jpg`;
        const filePath = path.join(savePath, fileName);

        // 保存文件
        await fs.writeFile(filePath, base64Data, 'base64');

        updateStatus('captureStatus', `✅ 照片已保存: ${fileName}`, 'success');
        
        setTimeout(() => {
            document.getElementById('captureStatus').innerHTML = '';
        }, 3000);

    } catch (error) {
        console.error('拍照失败:', error);
        updateStatus('captureStatus', '❌ 拍照失败: ' + error.message, 'error');
    }
}

// 选择保存文件夹
async function selectSaveFolder() {
    const result = await ipcRenderer.invoke('select-directory');
    if (result) {
        document.getElementById('savePath').value = result;
    }
}

// 选择分析文件夹
async function selectAnalyzeFolder() {
    const result = await ipcRenderer.invoke('select-directory');
    if (result) {
        document.getElementById('analyzeFolder').value = result;
        document.getElementById('analyzeButton').disabled = false;
    }
}

// 分析人脸
async function analyzeFaces() {
    const folderPath = document.getElementById('analyzeFolder').value;
    if (!folderPath) {
        alert('请先选择文件夹');
        return;
    }

    if (!modelsLoaded) {
        alert('模型尚未加载完成');
        return;
    }

    const isOwner = document.getElementById('isOwner').checked;
    const remark = document.getElementById('remarkText').value.trim();

    try {
        updateStatus('analyzeStatus', '🔄 正在分析图片...', 'loading');

        // 读取文件夹中的图片
        const files = await fs.readdir(folderPath);
        const imageFiles = files.filter(file => 
            /\.(jpg|jpeg|png|gif|bmp)$/i.test(file)
        );

        if (imageFiles.length === 0) {
            updateStatus('analyzeStatus', '⚠️ 未找到图片文件', 'error');
            return;
        }

        let successCount = 0;
        let failCount = 0;

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
                    // 保存特征
                    const faceData = {
                        id: Date.now() + Math.random(),
                        name: fileName,
                        descriptor: Array.from(detection.descriptor), // 转为数组以便存储
                        isOwner: isOwner,
                        remark: remark || '',
                        filePath: filePath,
                        timestamp: new Date().toISOString()
                    };

                    savedFaces.push(faceData);
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

        // 保存到本地
        saveFacesToStorage();
        updateFacesList();

        updateStatus('analyzeStatus', 
            `✅ 分析完成！成功: ${successCount} 张，失败: ${failCount} 张`, 
            'success'
        );

        // 清空表单
        document.getElementById('isOwner').checked = false;
        document.getElementById('remarkText').value = '';

    } catch (error) {
        console.error('分析失败:', error);
        updateStatus('analyzeStatus', '❌ 分析失败: ' + error.message, 'error');
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

// 保存人脸数据到本地存储
function saveFacesToStorage() {
    try {
        localStorage.setItem('savedFaces', JSON.stringify(savedFaces));
    } catch (error) {
        console.error('保存数据失败:', error);
    }
}

// 从本地存储加载人脸数据
function loadSavedFaces() {
    try {
        const data = localStorage.getItem('savedFaces');
        if (data) {
            savedFaces = JSON.parse(data);
            updateFacesList();
        }
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

// 更新人脸列表显示
function updateFacesList() {
    const listDiv = document.getElementById('facesList');
    
    if (savedFaces.length === 0) {
        listDiv.innerHTML = '<p style="color: #999; padding: 20px; text-align: center;">暂无数据</p>';
        return;
    }

    let html = '';
    savedFaces.forEach((face, index) => {
        const className = face.isOwner ? 'face-item owner' : 'face-item';
        const badge = face.isOwner ? 
            '<span class="badge owner">本人</span>' : 
            '<span class="badge other">其他</span>';

        html += `
            <div class="${className}">
                <h4>
                    ${badge}
                    ${face.name}
                </h4>
                <p>📁 ${face.filePath}</p>
                ${face.remark ? `<p>💬 ${face.remark}</p>` : ''}
                <p style="font-size: 0.8em; color: #999;">
                    添加时间: ${new Date(face.timestamp).toLocaleString()}
                </p>
            </div>
        `;
    });

    listDiv.innerHTML = html;
}

// 清空所有数据
function clearAllData() {
    if (!confirm('确定要清空所有已保存的人脸数据吗？此操作不可恢复！')) {
        return;
    }

    savedFaces = [];
    localStorage.removeItem('savedFaces');
    updateFacesList();
    
    document.getElementById('liveDetection').innerHTML = '<p style="color: #999;">数据已清空</p>';
    
    alert('✅ 数据已清空');
}

// 更新状态显示
function updateStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.innerHTML = message;
    element.className = `status ${type}`;
}

// 清理
window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    if (detectionInterval) {
        clearInterval(detectionInterval);
    }
});

