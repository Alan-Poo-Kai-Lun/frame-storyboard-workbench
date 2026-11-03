# FRAME V3.9 Beta 1 · Windows EXE 与更新入口

普通用户优先下载 **FRAME-Workbench-Windows-x64-v3.9-beta.1.exe**。这是 Windows 10/11 x64 免安装版，无需 Python；AI 模型、Ollama 和 ComfyUI 不随程序分发。

## 第一次使用

1. 双击 EXE。启动器自动打开浏览器中的工作台。
2. 首页点击「体验示例项目」即可开始，不需连接模型。
3. 保持小启动器运行；关闭时点击「退出」。浏览器页面可单独关闭或重新打开。

程序未使用商业代码签名证书；请通过本仓库 Releases 下载，`SHA256SUMS.txt` 提供文件校验值。本程序的权利保留声明与第三方 Python/Tcl/Tk/PyInstaller 许可分别适用，依赖许可文本随 EXE 内置。

## 已有用户如何更新

- **EXE 用户**：在工作台点「检查更新」，下载新版；退出旧启动器，再运行新版 EXE。程序不会静默安装或覆盖正在运行的文件。
- **源码用户**：下载 `FRAME-Storyboard-Workbench-v3.9-beta.1.zip`；关闭旧服务器，把 ZIP 拖到原目录的 `Update-Windows.bat`，再启动并按 Ctrl+F5。

此版本为 Beta，Releases 页面显示为预发布；工作台检查更新会包含 Beta 版本。

## 数据保留与旧版迁移

EXE 的项目、素材、任务、视觉参考和连接设置默认存放在：

```text
%LOCALAPPDATA%\FRAME\Workbench\data
```

不同 EXE 版本共用此用户目录。更新程序不会替换该目录。启动器可点击「打开数据目录」。

从源码版转到 EXE：先关闭旧服务器，将 EXE 放进原工作台目录，再首次启动。若用户数据目录为空，会复制原目录的 `data/`，原文件保持不变。若已在其他位置启动 EXE 并创建数据，请用首页导入 `.frame.json` 项目备份；不要把旧目录直接覆盖到已有用户数据。

源码版继续使用安装目录的 `data/`。`FRAME_DATA_DIR` 环境变量可显式指定数据目录，仅供需要独立数据位置的用户。

## 验证

- 结构、项目升级保留、数据迁移及版本解析检查。
- DOM 交互检查，包括手动检查更新与下载链接。
- Windows x64 构建后，在独立临时数据目录运行 EXE 自检：Tk 启动、内置资源、本机 HTTP 服务、示例项目。
- Windows 构建及自检成功后，工作流才发布 EXE、源码更新 ZIP 和 SHA256SUMS。

自动自检不代表已覆盖所有用户电脑、杀毒软件、真实 AI 服务或 H3 导演台环境；问题可在 Issues 反馈。
