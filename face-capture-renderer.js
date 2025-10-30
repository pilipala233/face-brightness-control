const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// 元素
let video;
let canvas;
let ctx;
let stream;
let cameras = [];
let photoCount = 0;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');

    // 绑定事件
    document.getElementById('startCamera').addEventListener('click', startCamera);
    document.getElementById('capturePhoto').addEventListener('click', capturePhoto);
    document.getElementById('selectFolder').addEventListener('click', selectSaveFolder);
    document.getElementById('resetCounter').addEventListener('click', resetCounter);
    document.getElementById('cameraSelect').addEventListener('change', onCameraChange);

    // 加载摄像头列表
    await loadCameraList();

    // 从localStorage恢复计数
    const savedCount = localStorage.getItem('photoCount');
    if (savedCount) {
        photoCount = parseInt(savedCount);
        updateCounter();
    }
});

// 加载摄像头列表
async function loadCameraList() {
    try {
        // 先请求权限
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach(track => track.stop());

        // 获取所有设备
        const devices = await navigator.mediaDevices.enumerateDevices();
        cameras = devices.filter(device => device.kind === 'videoinput');

        const select = document.getElementById('cameraSelect');
        select.innerHTML = '';

        if (cameras.length === 0) {
            select.innerHTML = '<option value="">未检测到摄像头</option>';
            document.getElementById('startCamera').disabled = true;
            return;
        }

        // 添加选项
        cameras.forEach((camera, index) => {
            const option = document.createElement('option');
            option.value = camera.deviceId;
            option.text = camera.label || `摄像头 ${index + 1}`;
            select.appendChild(option);
        });

        console.log(`找到 ${cameras.length} 个摄像头设备`);
    } catch (error) {
        console.error('获取摄像头列表失败:', error);
        const select = document.getElementById('cameraSelect');
        select.innerHTML = '<option value="">获取摄像头失败</option>';
        updateStatus('❌ 无法访问摄像头，请检查权限', 'error');
    }
}

// 摄像头切换事件
async function onCameraChange() {
    // 如果摄像头正在运行，重新启动
    if (stream) {
        await stopCamera();
        await startCamera();
    }
}

// 停止摄像头
async function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    video.srcObject = null;
}

// 启动摄像头
async function startCamera() {
    try {
        const select = document.getElementById('cameraSelect');
        const deviceId = select.value;

        if (!deviceId) {
            alert('请先选择摄像头');
            return;
        }

        // 停止当前摄像头
        await stopCamera();

        // 启动选定的摄像头
        const constraints = {
            video: {
                deviceId: { exact: deviceId },
                width: 640,
                height: 480
            }
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);

        video.srcObject = stream;
        video.addEventListener('loadedmetadata', () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        });

        document.getElementById('startCamera').textContent = '✅ 摄像头已启动';
        document.getElementById('startCamera').disabled = true;
        document.getElementById('capturePhoto').disabled = false;

        updateStatus('✅ 摄像头已启动，可以开始拍照', 'success');

    } catch (error) {
        console.error('启动摄像头失败:', error);
        updateStatus('❌ 无法访问摄像头: ' + error.message, 'error');
    }
}

// 拍照
async function capturePhoto() {
    const savePath = document.getElementById('savePath').value;
    if (!savePath) {
        alert('请先选择保存文件夹');
        return;
    }

    try {
        // 截取图片
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

        // 生成文件名
        const timestamp = new Date().getTime();
        const fileName = `face_${timestamp}.jpg`;
        const filePath = path.join(savePath, fileName);

        // 保存文件
        await fs.writeFile(filePath, base64Data, 'base64');

        // 增加计数
        photoCount++;
        updateCounter();
        saveCounter();

        updateStatus(`✅ 照片已保存: ${fileName}`, 'success');

        // 3秒后清除状态
        setTimeout(() => {
            document.getElementById('captureStatus').innerHTML = '';
        }, 3000);

    } catch (error) {
        console.error('拍照失败:', error);
        updateStatus('❌ 拍照失败: ' + error.message, 'error');
    }
}

// 选择保存文件夹
async function selectSaveFolder() {
    const result = await ipcRenderer.invoke('select-directory');
    if (result) {
        document.getElementById('savePath').value = result;
        updateStatus('✅ 已选择保存文件夹', 'success');
        setTimeout(() => {
            document.getElementById('captureStatus').innerHTML = '';
        }, 2000);
    }
}

// 重置计数器
function resetCounter() {
    if (photoCount === 0) {
        alert('计数器已经是0');
        return;
    }

    if (confirm(`确定要重置拍照计数器吗？\n当前计数: ${photoCount}`)) {
        photoCount = 0;
        updateCounter();
        saveCounter();
        updateStatus('✅ 计数器已重置', 'info');
        setTimeout(() => {
            document.getElementById('captureStatus').innerHTML = '';
        }, 2000);
    }
}

// 更新计数器显示
function updateCounter() {
    document.getElementById('photoCount').textContent = photoCount;
}

// 保存计数器到localStorage
function saveCounter() {
    localStorage.setItem('photoCount', photoCount.toString());
}

// 更新状态显示
function updateStatus(message, type) {
    const statusEl = document.getElementById('captureStatus');
    statusEl.innerHTML = message;
    statusEl.className = `status ${type}`;
}

// 清理
window.addEventListener('beforeunload', () => {
    stopCamera();
});

// 添加键盘快捷键
document.addEventListener('keydown', (event) => {
    // 空格键拍照
    if (event.code === 'Space' && !document.getElementById('capturePhoto').disabled) {
        event.preventDefault();
        capturePhoto();
    }
});

