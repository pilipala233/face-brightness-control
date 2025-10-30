const { app, BrowserWindow, ipcMain, systemPreferences, dialog, Menu, Notification } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// 设置控制台输出编码为 UTF-8
if (process.platform === 'win32') {
  process.stdout.setDefaultEncoding('utf-8');
}

let mainWindow;

// macOS 辅助功能权限检查
async function checkAndRequestAccessibility() {
  if (process.platform !== 'darwin') return true;
  
  const trusted = systemPreferences.isTrustedAccessibilityClient(true);
  
  if (!trusted) {
    console.log('⚠️  需要辅助功能权限才能控制亮度');
    console.log('请在系统设置中授予权限：');
    console.log('系统设置 -> 隐私与安全性 -> 辅助功能');
    
    // 打开系统设置
    exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"');
  } else {
    console.log('✓ 已获得辅助功能权限');
  }
  
  return trusted;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('index.html');

  // 仅在开发模式下打开调试工具
  if (!app.isPackaged || process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // macOS 上检查辅助功能权限
  if (process.platform === 'darwin') {
    await checkAndRequestAccessibility();
  }
  
  // 创建菜单
  createMenu();
  
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Windows 亮度控制函数（使用 PowerShell + WMI，不依赖已弃用的 wmic）
async function setBrightnessWindows(level) {
  try {
    const brightness = Math.max(0, Math.min(100, parseInt(level)));
    const command = `powershell -NoProfile -Command "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, ${brightness})"`;
    
    await execAsync(command, {
      windowsHide: true,
      timeout: 5000,
      env: {
        ...process.env,
        PATH: `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0;${process.env.PATH}`
      }
    });
    return true;
  } catch (error) {
    console.error('设置亮度失败:', error.message);
    return false;
  }
}

async function getBrightnessWindows() {
  try {
    const command = `powershell -NoProfile -Command "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness).CurrentBrightness"`;
    
    const { stdout } = await execAsync(command, {
      windowsHide: true,
      timeout: 5000,
      env: {
        ...process.env,
        PATH: `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0;${process.env.PATH}`
      }
    });
    return parseInt(stdout.trim());
  } catch (error) {
    console.error('获取亮度失败:', error.message);
    return 100;
  }
}

// macOS 亮度控制函数（使用 DisplayServices 私有框架）
async function setBrightnessMac(level) {
  try {
    const brightnessValue = Math.max(0, Math.min(100, parseInt(level)));
    
    console.log(`[macOS] 尝试设置亮度: ${brightnessValue}%`);
    
    // 打包后的路径处理
    const binPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'brightness-final')
      : path.join(__dirname, 'brightness-final');
    
    console.log(`[macOS] 二进制路径: ${binPath}`);
    
    const { stdout, stderr } = await execAsync(`"${binPath}" set ${brightnessValue}`, {
      timeout: 5000
    });
    
    if (stdout.includes('SUCCESS')) {
      console.log(`[macOS] ✓ 亮度设置成功`);
      return true;
    } else {
      console.error(`[macOS] 设置失败:`, stdout, stderr);
      return false;
    }
  } catch (error) {
    console.error('设置 macOS 亮度失败:', error.message);
    return false;
  }
}

async function getBrightnessMac() {
  try {
    // 打包后的路径处理
    const binPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'brightness-final')
      : path.join(__dirname, 'brightness-final');
    
    const { stdout } = await execAsync(`"${binPath}" get`, {
      timeout: 5000
    });
    
    const percentage = parseInt(stdout.trim()) || 100;
    console.log(`[macOS] 当前亮度: ${percentage}%`);
    return percentage;
  } catch (error) {
    console.error('获取 macOS 亮度失败:', error.message);
    return 100;
  }
}

// IPC 通信：处理亮度控制请求
ipcMain.handle('set-brightness', async (event, level) => {
  try {
    let success = false;
    
    if (process.platform === 'win32') {
      success = await setBrightnessWindows(level);
    } else if (process.platform === 'darwin') {
      success = await setBrightnessMac(level);
    } else {
      return { success: false, error: '当前平台不支持（仅支持 Windows 和 macOS）' };
    }
    
    if (success) {
      console.log(`亮度已设置为: ${level}%`);
      return { success: true, level };
    } else {
      return { success: false, error: '设置亮度失败' };
    }
  } catch (error) {
    console.error('设置亮度失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-brightness', async () => {
  try {
    let level;
    
    if (process.platform === 'win32') {
      level = await getBrightnessWindows();
    } else if (process.platform === 'darwin') {
      level = await getBrightnessMac();
    } else {
      return { success: false, error: '当前平台不支持（仅支持 Windows 和 macOS）' };
    }
    
    return { success: true, level };
  } catch (error) {
    console.error('获取亮度失败:', error);
    return { success: false, error: error.message };
  }
});

// 文件夹选择对话框
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePaths[0];
});

// 显示系统通知
ipcMain.handle('show-notification', async (event, { title, body }) => {
  try {
    // 检查通知是否被支持
    if (!Notification.isSupported()) {
      return { success: false, error: '系统不支持通知' };
    }
    
    // 创建通知
    const notification = new Notification({
      title: title,
      body: body,
      silent: false,
      timeoutType: 'default'
    });
    
    // 点击通知时聚焦主窗口
    notification.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
    
    // 显示通知
    notification.show();
    
    return { success: true };
    
  } catch (error) {
    console.error('显示通知失败:', error);
    return { success: false, error: error.message };
  }
});

// 创建照片采集窗口
function createCaptureWindow() {
  const captureWindow = new BrowserWindow({
    width: 900,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  captureWindow.loadFile('face-capture.html');
  
  // 开发模式下打开调试工具
  if (!app.isPackaged || process.argv.includes('--dev')) {
    captureWindow.webContents.openDevTools();
  }
}

// 创建测试窗口（保留用于开发测试）
function createTestWindow() {
  const testWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  testWindow.loadFile('face-test.html');
  
  // 开发模式下打开调试工具
  if (!app.isPackaged || process.argv.includes('--dev')) {
    testWindow.webContents.openDevTools();
  }
}

// 创建菜单
function createMenu() {
  const template = [
    // macOS 第一个菜单是应用名称
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [
        { role: 'about', label: '关于' },
        { type: 'separator' },
        { role: 'services', label: '服务' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    }] : []),
    {
      label: '工具',
      submenu: [
        {
          label: '人脸照片采集工具',
          accelerator: process.platform === 'darwin' ? 'Cmd+T' : 'Ctrl+T',
          click: () => {
            createCaptureWindow();
          }
        },
        // 开发模式下显示测试工具
        ...(!app.isPackaged || process.argv.includes('--dev') ? [
          { type: 'separator' },
          {
            label: '人脸识别测试工具（开发用）',
            accelerator: process.platform === 'darwin' ? 'Cmd+Shift+T' : 'Ctrl+Shift+T',
            click: () => {
              createTestWindow();
            }
          }
        ] : [])
      ]
    },
    // Windows 上添加"文件"菜单
    ...(process.platform !== 'darwin' ? [{
      label: '文件',
      submenu: [
        { role: 'quit', label: '退出' }
      ]
    }] : [])
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
