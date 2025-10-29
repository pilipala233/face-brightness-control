const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// 设置控制台输出编码为 UTF-8
if (process.platform === 'win32') {
  process.stdout.setDefaultEncoding('utf-8');
}

let mainWindow;

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

app.whenReady().then(() => {
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

// IPC 通信：处理亮度控制请求
ipcMain.handle('set-brightness', async (event, level) => {
  try {
    if (process.platform === 'win32') {
      const success = await setBrightnessWindows(level);
      if (success) {
        console.log(`亮度已设置为: ${level}%`);
        return { success: true, level };
      } else {
        return { success: false, error: '设置亮度失败' };
      }
    } else {
      return { success: false, error: '当前平台不支持' };
    }
  } catch (error) {
    console.error('设置亮度失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-brightness', async () => {
  try {
    if (process.platform === 'win32') {
      const level = await getBrightnessWindows();
      return { success: true, level };
    } else {
      return { success: false, error: '当前平台不支持' };
    }
  } catch (error) {
    console.error('获取亮度失败:', error);
    return { success: false, error: error.message };
  }
});
