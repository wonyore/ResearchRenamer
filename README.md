# ResearchRenamer

<div align="center">
  <h1>ResearchRenamer</h1>
  <p>科研成果文件智能编号与命名系统</p>
  <p>
    <img src="https://img.shields.io/badge/React-18-blue" alt="React 18">
    <img src="https://img.shields.io/badge/TypeScript-5.0-blue" alt="TypeScript">
    <img src="https://img.shields.io/badge/Vite-5.0-green" alt="Vite">
    <img src="https://img.shields.io/badge/TailwindCSS-3.0-cyan" alt="TailwindCSS">
  </p>
</div>

## 项目简介

ResearchRenamer 是一款专门为科研人员设计的文件管理工具，用于批量重命名和编号科研成果文件（如论文、报告、图片等）。该软件能够根据文件的发布日期或现有编号进行智能排序和重命名，支持多种编号格式，帮助科研人员更有效地管理和组织研究成果。

## 核心功能

- 📁 **批量文件上传**：支持 PDF、DOCX、JPG、PNG 等多种格式
- 📅 **智能日期排序**：自动提取文件日期，支持手动调整
- 🔢 **灵活编号模式**：顺序编号和偏移编号两种模式
- 📝 **多种编号格式**：方括号、点号、下划线、连字符、自定义前缀
- 📄 **PDF 元数据提取**：智能解析 PDF 文档标题、作者、年份
- 🖱️ **拖拽排序**：支持手动拖拽调整文件顺序
- 📦 **一键导出**：打包重命名文件为 ZIP 格式

## 技术栈

- **前端框架**：React 18 + TypeScript
- **构建工具**：Vite 5
- **样式方案**：Tailwind CSS 3
- **UI 组件**：Lucide React 图标库
- **PDF 处理**：pdfjs-dist
- **文件打包**：JSZip

## 快速开始

### 环境要求

- Node.js 16.0.0 或更高版本
- npm 8.0.0 或更高版本

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd ResearchRenamer
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

4. **访问应用**
   浏览器自动打开 http://localhost:3000

### 构建生产版本

```bash
npm run build
```

构建产物将生成在 `dist` 目录。

## 项目结构

```
ResearchRenamer/
├── components/          # React 组件
│   ├── FileTable.tsx   # 文件列表表格
│   ├── Toolbar.tsx     # 工具栏配置面板
│   └── IconComponents.tsx  # 图标组件
├── utils/              # 工具函数
│   └── fileUtils.ts    # 文件处理核心逻辑
├── App.tsx             # 主应用组件
├── index.tsx           # 应用入口
├── types.ts            # TypeScript 类型定义
├── index.html          # HTML 模板
├── index.css           # 全局样式
├── vite.config.ts      # Vite 配置
├── tailwind.config.js  # Tailwind CSS 配置
└── package.json        # 项目依赖
```

## 使用说明

详细使用说明请参考 [doc.md](./doc.md) 文件。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
