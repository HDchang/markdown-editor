# Markdown HD 开发总结

## 项目概述

Markdown HD 是一个现代化的 Markdown 编辑器，专为中文办公场景设计，支持 WYSIWYG 所见即所得编辑和导出 Word 公文格式。

**GitHub**: https://github.com/HDchang/markdown-editor
**当前版本**: v1.0.0
**许可证**: MIT

## 技术栈

- **Tauri 2.0** - 跨平台桌面应用框架 (Rust backend + WebView)
- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **TipTap** - 基于 ProseMirror 的富文本编辑器
- **docx.js** - Word 文档生成
- **marked** - Markdown → HTML
- **turndown** - HTML → Markdown

## 项目结构

```
markdown-editor/
├── src/                      # 前端 React 代码
│   ├── App.tsx              # 主应用组件
│   ├── App.css              # 主应用样式
│   ├── main.tsx             # 入口文件
│   ├── components/
│   │   ├── Editor.tsx       # TipTap 编辑器组件
│   │   ├── Editor.css       # 编辑器样式
│   │   ├── Sidebar.tsx      # 文件树侧边栏
│   │   └── Sidebar.css      # 侧边栏样式
│   └── utils/
│       ├── exportDocx.ts    # DOCX 导出 (含公文格式)
│       ├── markdown.ts      # Markdown → HTML
│       └── htmlToMarkdown.ts # HTML → Markdown
├── src-tauri/               # Rust 后端
│   ├── src/
│   │   ├── lib.rs           # 命令和逻辑
│   │   └── main.rs          # 入口
│   ├── Cargo.toml          # Rust 依赖
│   ├── tauri.conf.json     # Tauri 配置
│   └── icons/              # 应用图标
├── .github/workflows/
│   └── build.yml           # CI/CD 构建流程
└── package.json            # Node 依赖
```

## 核心功能

### 1. 编辑器 (Editor)
- WYSIWYG 所见即所得 Markdown 编辑
- 标题快捷键: ⌘+1~6
- 格式快捷键: ⌘+B (粗体), ⌘+I (斜体)
- 使用 TipTap + ProseMirror

### 2. 文件管理 (Sidebar)
- 侧边栏文件树导航
- 新建文件: ⌘+N
- 重命名文件
- 切换侧边栏: ⌘+\

### 3. 保存功能
- 手动保存: ⌘+S
- 自动保存 (AutoSave): 开启后 1 秒无操作自动保存
- 关闭时弹窗询问是否保存

### 4. 导出功能
- 普通 DOCX 导出
- 公文格式导出 (GB/T 9704-2012)
  - 方正小标宋简体 标题
  - 仿宋_GB2312 正文
  - 黑体一级标题
  - 楷体二级标题

### 5. 主题
- 浅色/深色/跟随系统
- 下拉菜单切换

## 关键实现细节

### 关闭弹窗处理 (重要!)
在 `src-tauri/src/lib.rs` 中使用 `window.destroy()` 而不是 `window.close()` 来避免无限循环：

```rust
#[tauri::command]
fn close_app<R: tauri::Runtime>(app: tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.destroy();  // 使用 destroy 而非 close
    }
}

// setup 中:
window.on_window_event(move |event| {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window_clone.emit("close-requested", ());
    }
});
```

### 前端状态管理
使用 ref 来获取异步操作中的最新状态：

```typescript
const currentFileRef = useRef(currentFile);
const markdownContentRef = useRef(markdownContent);

useEffect(() => {
    currentFileRef.current = currentFile;
}, [currentFile]);
```

### 公文格式配置 (exportDocx.ts)
```typescript
const DOCUMENT_STYLES = {
  margins: { top: 2098, bottom: 1985, left: 1587, right: 1474 }, // mm 转 twips
  fonts: { title: '方正小标宋简体', body: '仿宋_GB2312', black: '黑体', kai: '楷体' },
  sizes: { title: 44, body: 31 }, // half-points
  lineSpacing: 560, // 28pt = 560 twips
};
```

## 构建与发布

### 本地开发
```bash
cd /Users/haodong/markdown-editor
npm run tauri dev
```

### 本地构建
```bash
npm run tauri build
```

产物位置:
- macOS: `src-tauri/target/release/bundle/dmg/`
- Windows: `src-tauri/target/release/bundle/msi/` 或 `nsis/`

### CI/CD 构建
GitHub Actions 自动构建:
- 推送到 main 分支自动触发
- 构建 macOS (Apple Silicon) + Windows
- 下载 artifact 后手动创建 Release

## 已解决问题

1. **关闭弹窗无限循环**: 使用 `window.destroy()` 强制关闭
2. **关闭时文件未保存**: 使用 ref 获取最新状态
3. **Typora 侵权风险**: 已移除，改用 "WYSIWYG 所见即所得"
4. **GitHub Actions 权限**: 需要 token 添加 workflow scope

## 待完善功能

- [ ] 国际化 (i18n)
- [ ] 打印支持
- [ ] PDF 导出
- [ ] 更多主题选项
- [ ] 插件系统
- [ ] 实时预览分屏模式

## 相关链接

- Tauri: https://tauri.app/
- TipTap: https://tiptap.dev/
- docx.js: https://docx.js.org/
- GB/T 9704-2012: https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=... (公文格式标准)
