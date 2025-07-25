# WhatsApp Helper - 简化版本

一个简洁的 WhatsApp Web 助手插件，提供消息翻译功能。

## 功能特性

- 🎯 **悬浮球界面** - 固定在页面右侧的悬浮球
- 📋 **功能菜单** - 点击悬浮球显示功能菜单
- 🔄 **翻译开关** - 一键开启/关闭消息翻译功能
- 📨 **自动翻译** - 使用 Google Translate API 自动翻译消息
- 💾 **翻译缓存** - 本地缓存翻译结果，提高效率

## 文件结构

```
WhatsApp_Helper/
├── manifest.json              # 插件配置文件
├── content.js                 # 主要功能代码
├── styles.css                 # 样式文件
├── modules/
│   ├── Detector.js            # 页面检测模块
│   ├── MessageService.js      # 消息获取服务
│   └── TranslationService.js  # 翻译服务
└── README.md                  # 说明文档
```

## 安装方法

1. 下载所有文件到本地文件夹
2. 打开 Chrome 浏览器，进入 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择包含这些文件的文件夹

## 使用方法

1. 访问 [WhatsApp Web](https://web.whatsapp.com/)
2. 页面右侧会出现绿色的悬浮球
3. 点击悬浮球打开功能菜单
4. 选择需要的功能

## 功能说明

### 翻译功能
- **翻译开关** - 一键开启/关闭消息翻译功能
- 开启时自动翻译新收到的消息
- 关闭时停止翻译并清理已显示的翻译结果

## 开发说明

这是一个简化版本的插件，专注于消息翻译功能。插件采用模块化设计：

- **Detector.js** - 负责页面检测和初始化
- **MessageService.js** - 负责消息监听和获取
- **TranslationService.js** - 负责消息翻译和缓存

插件使用 Google Translate API 进行翻译，支持本地缓存以提高效率。用户可以通过简单的开关控制翻译功能的开启和关闭。

## 技术栈

- **Manifest V3** - Chrome 扩展最新标准
- **原生 JavaScript** - 无外部依赖
- **CSS3** - 现代化样式设计
- **响应式设计** - 支持移动端适配

## 许可证

MIT License 