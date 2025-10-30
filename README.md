# Face Brightness Control

基于 Electron 的智能人脸检测自动亮度控制应用，再也不用害怕笔记本架高后被身后的同事窥屏了，同时也间接解决了老板从背后出现却没人提醒你的烦恼

## ✨ 功能特性

- 🎥 **实时人脸检测**：使用 face-api.js 进行实时摄像头人脸检测
- 💡 **智能亮度控制**：检测到指定数量人脸时自动降低屏幕亮度
- 🔔 **系统通知提醒**：支持系统通知、亮度调节或两者组合，可自定义通知内容
- 🧠 **人脸识别**：支持学习识别本人、可信任、不可信任三类人群
- 🎯 **人脸数量阈值**：可自定义触发亮度调节的人脸数量（默认≥2人）
- 🔧 **多模型支持**：支持 TinyFaceDetector（快速）和 SSD MobileNet（准确）
- ⚙️ **灵活配置**：可调节检测间隔、灵敏度、亮度范围、识别阈值等参数
- 🖼️ **可视化检测**：实时显示检测到的人脸框和置信度
- 📸 **照片采集工具**：内置工具快速采集多角度人脸照片
- 🖥️ **跨平台支持**：支持 Windows 和 macOS
- 📦 **绿色便携**：无需安装额外依赖，开箱即用

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

**注意：** 项目已配置淘宝镜像源（`.npmrc`），国内用户安装速度更快。

### 运行开发版

```bash
npm start   # 或 npm run dev
```

**跨平台自动适配**：
- Windows: 自动设置 UTF-8 编码，避免中文乱码
- macOS/Linux: 直接启动

### 打包应用

```bash
# 跨平台打包（推荐）
npm run build       # 自动根据当前平台打包

# 指定平台打包
npm run build:win   # 打包 Windows 版本（x64 便携版 exe）
npm run build:mac   # 打包 macOS 版本（.app）

# 其他
npm run build:dir   # 打包为目录（测试用，不压缩）
```

打包后的文件位于 `dist/` 目录：
- Windows: `人脸亮度控制-1.0.0-portable.exe`
- macOS: 
  - `人脸亮度控制-1.0.0-universal.dmg` (推荐分发)
  - `人脸亮度控制-1.0.0-universal-mac.zip` (备选)
  - 支持 Intel 和 Apple Silicon Mac

## 🖥️ 平台支持

| 平台 | 状态 | 亮度控制方案 | 说明 |
|------|------|--------------|------|
| **Windows 10/11** | ✅ 完全支持 | PowerShell + WMI | 笔记本内置屏幕 |
| **macOS (Apple Silicon)** | ✅ 已测试 | DisplayServices 框架 | M系列 Mac |
| **macOS (Intel)** | ⚠️ 未测试 | DisplayServices 框架 | 理论支持，需用户反馈 |
| **Linux** | ⚪ 暂不支持 | - | 计划中 |

## 💻 技术栈

- **框架**: Electron 39.x
- **人脸检测**: @vladmandic/face-api 1.7.x
- **亮度控制**: 
  - Windows: PowerShell + WMI
  - macOS: DisplayServices 私有框架（原生）
- **跨平台脚本**: run-script-os
- **打包工具**: electron-builder

## 📖 使用说明

### 基本流程

1. 启动应用后，允许摄像头权限
2. 应用自动加载人脸检测模型
3. 点击"启动检测"开始实时检测
4. 当检测到的人脸数量达到阈值时，自动降低亮度
5. 人脸消失后，自动恢复原始亮度

### 参数设置

#### 基本设置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 检测模型 | SSD MobileNet | 更准确但稍慢，可选 TinyFaceDetector（快速） |
| 检测间隔 | 500ms | 检测频率，值越小越频繁（更耗电） |
| 检测灵敏度 | 0.5（低） | 近距离检测，可调整为高/中/低 |
| 最低亮度 | 10% | 检测到人脸时的目标亮度 |
| 最高亮度 | 自动检测 | 无人脸时的亮度（启动时自动获取当前亮度） |
| 人脸数量阈值 | 2 | 触发亮度降低所需的最小人脸数量 |
| 处理方式 | 仅调节亮度 | 可选：仅调节亮度 / 仅系统通知 / 两者组合 |
| 通知内容 | 检测到异常活动 | 自定义通知文本，自动保存 |

#### 高级设置（人脸识别）

| 功能 | 说明 |
|------|------|
| 人脸分类 | 可学习识别本人、可信任、不可信任三类人群 |
| 识别阈值 | 可调节识别严格度（0.3-0.7），默认0.5 |
| 识别模式 | 不启用 / 除本人外 / 除本人及可信任外 / 仅针对不可信目标 |
| 照片采集 | 菜单 → 工具 → 人脸照片采集工具（Ctrl+T / Cmd+T） |

### 典型使用场景

**场景1：防止他人偷看屏幕（基本模式）**
- 设置人脸阈值为 2
- 处理方式：仅调节亮度
- 当只有你自己时（1张人脸）：保持正常亮度
- 当有人靠近（≥2张人脸）：自动降低亮度保护隐私

**场景2：通知提醒（隐蔽模式）**
- 处理方式：仅系统通知
- 通知内容：自定义为"有新消息"等
- 检测到有人靠近时收到通知，但不改变亮度
- 适合不想打扰工作但需要提醒的场景

**场景3：高级识别（精准模式）**
1. 使用照片采集工具（Ctrl+T / Cmd+T）拍摄5-10张自己的照片
2. 在高级设置中学习分析"本人"类别
3. 识别模式选择"除本人外"
4. 只有检测到非本人才触发（更精准）

## 🔧 技术亮点

### 亮度控制实现

#### Windows
本项目**不使用**已弃用的 `wmic` 命令，而是直接调用 **PowerShell + WMI** API：

```powershell
# 获取亮度
powershell -Command "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness).CurrentBrightness"

# 设置亮度
powershell -Command "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, 50)"
```

优势：
- ✅ 无需第三方依赖
- ✅ 打包后正常工作
- ✅ 不依赖已弃用的 wmic
- ✅ 兼容 Windows 10/11

#### macOS
使用 **DisplayServices 私有框架**，通过编译的 Objective-C 二进制程序控制亮度：

```objectivec
// 动态加载 DisplayServices 框架
void* handle = dlopen("/System/Library/PrivateFrameworks/DisplayServices.framework/DisplayServices", RTLD_LAZY);

// 调用亮度控制函数
DisplayServicesSetBrightness(display, brightness);
DisplayServicesGetBrightness(display, &brightness);
```

优势：
- ✅ 无需用户安装任何依赖
- ✅ 直接控制 MacBook 内置屏幕
- ✅ 打包后正常工作
- ✅ 不需要辅助功能权限

### 人脸检测模型

- **TinyFaceDetector**: 轻量快速，适合低配置设备
- **SSD MobileNet**: 准确度高，推荐使用（默认）
- 模型文件已包含在 `@vladmandic/face-api` npm 包中

## ⚠️ 注意事项

### 系统要求

- **操作系统**: 
  - Windows 10/11
  - macOS 10.15 (Catalina) 或更高版本
- **摄像头**: 需要可用的摄像头设备
- **权限**: 首次运行需要授予摄像头权限

### 系统通知设置

如需使用通知功能，需确保系统通知已启用：

**Windows 10/11：**
1. 打开 `设置` → `系统` → `通知`
2. 确保 `获取来自应用和其他发送者的通知` 已打开
3. 关闭 `勿扰助手` / `专注助手`
4. 在应用列表中找到本应用，确保通知开关打开

**macOS：**
1. 打开 `系统偏好设置` → `通知与专注模式`
2. 在左侧应用列表找到本应用
3. 确保通知样式选择 `横幅` 或 `提醒`
4. 关闭 `勿扰模式`

**提示：** 可自定义通知内容（如"有新消息"），避免直接提示窥屏引起尴尬

#### macOS 架构支持
- ✅ **Apple Silicon (M系列)**: 已测试，完全支持
- ⚠️ **Intel (x86_64)**: 理论支持，**未在真机测试**
  - Universal 二进制包含 Intel 支持
  - 如遇问题请提 Issue 反馈

### 亮度控制限制

#### Windows
- ✅ **笔记本内置屏幕**: 完全支持
- ❌ **外接显示器**: 大多数不支持软件控制（硬件限制）
- ⚠️ **某些显示器**: 需要支持 DDC/CI 协议

#### macOS
- ✅ **MacBook 内置屏幕**: 完全支持
- ❌ **外接显示器**: 不支持（技术限制）
- ✅ **无需额外权限**: 使用系统框架，不需要辅助功能权限
- ⚠️ **首次运行**: 可能提示"来自未识别的开发者"
  - 解决方法：系统设置 -> 隐私与安全性 -> 仍要打开

### 性能优化建议

- 使用 TinyFaceDetector 模型可提升性能
- 增加检测间隔（如 1000ms）可降低 CPU 占用
- 关闭"显示人脸检测框"可提升性能

## 📁 项目结构

```
face-brightness-control/
├── main.js                  # Electron 主进程
├── renderer.js              # 渲染进程（人脸检测逻辑）
├── index.html               # 主界面
├── styles.css               # 样式文件
├── brightness-final         # macOS 亮度控制二进制
├── brightness-final.m       # macOS 亮度控制源码
├── package.json             # 项目配置
├── .npmrc                   # npm 镜像配置（淘宝源）
├── README.md                # 项目说明
└── USAGE.md                 # 详细使用文档
```

## 🛠️ 开发

### 开发模式

```bash
npm start        # 启动应用（自动打开开发者工具）
npm run dev      # 同上
```

### 打包配置

打包配置位于 `package.json` 的 `build` 字段：

- 输出目录: `dist/`
- 打包命令:
  - `npm run build` - 自动根据当前平台打包
  - `npm run build:win` - 打包 Windows x64 便携版
  - `npm run build:mac` - 打包 macOS 通用版（支持 Intel 和 Apple Silicon）
- 打包格式: 
  - Windows: 便携版 exe（绿色免安装）
  - macOS: .app 应用包

### 重新编译 macOS 亮度控制程序

如果需要修改 macOS 亮度控制逻辑，可以重新编译：

```bash
cd /path/to/project
clang -o brightness-final brightness-final.m -framework Foundation -framework CoreGraphics
```

### 调试技巧

开发模式下会自动打开 F12 开发者工具，可以：
- 查看人脸检测的调试信息
- 监控性能和内存占用
- 调试 IPC 通信

## 📄 许可证

ISC

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📮 联系方式

- GitHub: [@pilipala233](https://github.com/pilipala233)
- 项目地址: https://github.com/pilipala233/face-brightness-control

## 🙏 致谢

- [Electron](https://www.electronjs.org/) - 跨平台桌面应用框架
- [@vladmandic/face-api](https://github.com/vladmandic/face-api) - 人脸检测库
- [electron-builder](https://www.electron.build/) - Electron 打包工具
