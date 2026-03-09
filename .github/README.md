# GitHub Actions 构建说明

## 自动构建

每次推送到 `main` 分支时，会自动在 Ubuntu 上构建：
- x86_64 Linux 版本
- ARM64 (aarch64) Linux 版本

## 使用方法

1. **推送代码到 GitHub**
   ```bash
   git add .
   git commit -m "Add GitHub Actions"
   git remote add origin https://github.com/你的用户名/markdown-editor.git
   git push -u origin main
   ```

2. **查看构建状态**
   - 进入 GitHub 仓库页面
   - 点击 Actions 标签
   - 查看构建进度

3. **下载构建产物**
   - 构建完成后，点击对应的 workflow run
   - 下载 `linux-binaries` artifact

## 本地测试 Linux 构建

如果你想在本地测试 Linux 构建，需要安装 Linux 兼容环境：

```bash
# 安装 Linux 模拟器 (WINE)
brew install --cask wine

# 或者使用 Docker
docker run -it ubuntu:22.04
```

## 麒麟系统构建

在麒麟系统上直接编译更简单：

```bash
cd src-tauri
cargo build --release
```

产物位置：`src-tauri/target/release/markdown-hd`
