# Face Brightness Control

基于 Electron 的智能人脸检测自动亮度控制应用

## ✨ 功能特性

- 🎥 **实时人脸检测**：使用 face-api.js 进行实时摄像头人脸检测
- 💡 **智能亮度控制**：检测到指定数量人脸时自动降低屏幕亮度
- 🎯 **人脸数量阈值**：可自定义触发亮度调节的人脸数量（默认≥2人）
- 🔧 **多模型支持**：支持 TinyFaceDetector（快速）和 SSD MobileNet（准确）
- ⚙️ **灵活配置**：可调节检测间隔、灵敏度、亮度范围等参数
- 🖼️ **可视化检测**：实时显示检测到的人脸框和置信度
- 📦 **绿色便携**：打包为单文件 exe，无需安装

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 运行开发版

```bash
npm start
```

### 打包应用

```bash
npm run build
```

打包后的便携版 exe 文件位于 `dist/` 目录。

## 💻 技术栈

- **框架**: Electron 39.x
- **人脸检测**: @vladmandic/face-api 1.7.x
- **亮度控制**: PowerShell + WMI（原生支持，无需第三方库）
- **打包工具**: electron-builder

## 📖 使用说明

### 基本流程

1. 启动应用后，允许摄像头权限
2. 应用自动加载人脸检测模型
3. 点击"启动检测"开始实时检测
4. 当检测到的人脸数量达到阈值时，自动降低亮度
5. 人脸消失后，自动恢复原始亮度

### 参数设置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 检测模型 | SSD MobileNet | 更准确但稍慢，可选 TinyFaceDetector（快速） |
| 检测间隔 | 500ms | 检测频率，值越小越频繁（更耗电） |
| 检测灵敏度 | 0.5（低） | 近距离检测，可调整为高/中/低 |
| 最低亮度 | 10% | 检测到人脸时的目标亮度 |
| 最高亮度 | 自动检测 | 无人脸时的亮度（启动时自动获取当前亮度） |
| 人脸数量阈值 | 2 | 触发亮度降低所需的最小人脸数量 |

### 典型使用场景

**场景：防止他人偷看屏幕**
- 设置人脸阈值为 2
- 当只有你自己时（1张人脸）：保持正常亮度
- 当有人靠近（≥2张人脸）：自动降低亮度保护隐私

## 🔧 技术亮点

### 亮度控制实现

本项目**不使用**已弃用的 `wmic` 命令，而是直接调用 **PowerShell + WMI** API：

```javascript
// 获取亮度
powershell -Command "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness).CurrentBrightness"

// 设置亮度
powershell -Command "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, 50)"
```

优势：
- ✅ 无需第三方依赖
- ✅ 打包后正常工作
- ✅ 不依赖已弃用的 wmic
- ✅ 兼容 Windows 10/11

### 人脸检测模型

- **TinyFaceDetector**: 轻量快速，适合低配置设备
- **SSD MobileNet**: 准确度高，推荐使用（默认）
- 模型文件已包含在 `@vladmandic/face-api` npm 包中

## ⚠️ 注意事项

### 系统要求

- **操作系统**: Windows 10/11
- **摄像头**: 需要可用的摄像头设备
- **权限**: 首次运行需要授予摄像头权限

### 亮度控制限制

- ✅ **笔记本内置屏幕**: 完全支持
- ❌ **外接显示器**: 大多数不支持软件控制（硬件限制）
- ⚠️ **某些显示器**: 需要支持 DDC/CI 协议

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
├── brightnessController.js  # 亮度控制模块（备用）
├── package.json             # 项目配置
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
- 打包格式: 便携版 exe（绿色免安装）
- 目标平台: Windows x64

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
