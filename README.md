# Markdown HD

<img src="https://raw.githubusercontent.com/HDchang/markdown-editor/main/src-tauri/icons/icon.png" width="128" height="128" alt="Markdown HD Logo">

Markdown HD 是一个现代化的 Markdown 编辑器，支持实时预览、导出为 Word 公文格式，专为中文办公场景设计。

## 功能特性

- **即时预览** - WYSIWYG 所见即所得 Markdown 编辑器
- **文件管理** - 侧边栏文件树导航，支持新建、打开、重命名 Markdown 文件
- **公文导出** - 支持导出 GB/T 9704-2012 中文公文格式 (Word .docx)
- **多种主题** - 支持浅色/深色/跟随系统主题
- **自动保存** - 开启自动保存后，编辑内容自动保存
- **键盘快捷键**
  - `⌘+1~6` 设置标题级别
  - `⌘+B` 粗体
  - `⌘+I` 斜体
  - `⌘+S` 保存
  - `⌘+N` 新建文件
  - `⌘+\` 切换侧边栏

## 下载安装

### macOS

下载 DMG 安装包：[Markdown HD.dmg](./releases/latest)

### Linux

请从源码编译：

```bash
# 安装依赖 (Ubuntu/Debian)
sudo apt-get install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

# 克隆项目
git clone https://github.com/HDchang/markdown-editor.git
cd markdown-editor

# 编译
cd src-tauri
cargo build --release

# 产物位于: src-tauri/target/release/markdown-hd
```

### Windows / 麒麟系统

请从源码编译。

## 技术栈

- [Tauri 2.0](https://tauri.app/) - 跨平台桌面应用框架
- [React 19](https://react.dev/) - UI 框架
- [TipTap](https://tiptap.dev/) - 基于 ProseMirror 的富文本编辑器
- [docx.js](https://docx.js.org/) - Word 文档生成

## 开源协议

MIT License

---

欢迎贡献代码！请提交 Pull Request 或报告问题。
