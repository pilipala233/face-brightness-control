# Face Brightness Control

基于 Electron 的人脸检测自动亮度控制应用

## 功能

- 实时摄像头人脸检测
- 检测到人脸时自动降低屏幕亮度
- 可调节检测间隔和最低亮度
- 简洁的图形界面

## 技术栈

- Electron
- 原生 HTML/CSS/JavaScript
- OpenCV（待集成）
- Node.js 亮度控制模块（待集成）

## 开发计划

- [x] 基础 Electron 项目结构
- [x] UI 界面设计
- [ ] 集成 OpenCV 人脸检测
- [ ] 实现屏幕亮度控制
- [ ] 添加系统托盘功能
- [ ] 添加开机自启动选项

## 安装

```bash
npm install
```

## 运行

```bash
npm start
```

## 待办

1. 集成 opencv4nodejs 或使用其他人脸检测方案
2. 实现跨平台的屏幕亮度控制
3. 优化性能和电池消耗
