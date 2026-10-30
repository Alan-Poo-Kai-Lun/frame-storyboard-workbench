> 当前：V3.41 / R15，EXE 默认端口 8852，默认数据目录 FRAME-Data。旧版目录按现有迁移机制沿用。以下标有历史版本的内容不代表当前默认值。

# 安装、更新与数据

[返回首页](../README.md) · [新手入门](quick-start.md) · [常见问题](faq.md)

## Windows 启动（推荐）

从 [版本下载页](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/releases) 下载 `FRAME-Workbench-Windows-x64-版本号.exe`，双击并保持小启动器运行。浏览器会打开工作台，无需 Python。

## 源码启动

安装 Python 3.10+，完整解压源码，Windows 双击 `Start-Windows.bat`；其他系统运行 `python3 server.py`，访问 `http://127.0.0.1:8845`（`Start-Windows.bat` 使用 8828）。项目封面缩略图使用 Pillow，请先运行 `python -m pip install -r requirements.txt`；EXE 已包含此依赖。

## 更新与数据

- 在工作台点击 **检查更新**，查看已发布版本和 EXE / 源码更新 ZIP 下载入口。
- EXE：退出旧启动器，再运行新版。项目、素材、视觉参考、任务和连接设置默认保存在 EXE 同目录的 `FRAME-Data`，各 EXE 版本共用，不在程序临时目录内。旧版留下的 `FRAME-Canvas-Rn-Data` 会原地沿用，不产生第二份数据。
- 源码：下载 Releases 中专门的 `FRAME-Storyboard-Workbench-版本号.zip`，关闭服务器，拖到原目录的 `Update-Windows.bat`，再启动并按 Ctrl+F5。原 `data/` 保留，旧程序备份放在 `versions/`。
- 从源码转 EXE：先关闭源码版，把 EXE 放入原目录再首次启动。目标用户数据为空时复制旧 `data/`；原目录保留。已有 EXE 数据时使用项目备份导入。
- 更新检查是手动操作，不会上传项目、素材或模型密钥，也不会静默安装。Beta 更新通过版本列表提供。

详见 [本次修复说明](release-v3.16-beta.2.md)与 [Windows EXE 数据迁移说明](release-v3.9-beta.1.md)。源码版端口占用时可使用 `--port 8788`；`--no-browser` 关闭自动打开浏览器。

### Ollama 配置

先在自己电脑启动 Ollama，并安装所需模型。默认服务地址为 `http://127.0.0.1:11434`。纯文字拆镜选择文字模型；分析图片必须选择支持图片输入的视觉模型。模型推理速度取决于模型、量化、显存与输出长度。

## 数据与模型服务

- EXE 的项目与设置默认保存在 EXE 同目录的 `FRAME-Data`；源码版默认保存在程序目录的 `data/`。完整备份对应目录。
- 设置可能含 API Key，请勿将数据目录上传到 GitHub。
- 模型请求会发送到你配置的服务；使用云接口时并非完全离线。
- 源码更新请使用 Release 的专用更新 ZIP，GitHub「Code → Download ZIP」不适用于 `Update-Windows.bat`。

## 兼容性与已知限制

- 目标接收端：**AI 搅拌手 / AIMixer 的 H3 导演台**；格式 `minimax-h3-director-pack` / `formatVersion: 1`。这只是包格式版本，不是插件版本。未固定实测的插件版本，不能承诺所有新版 / 分支兼容。
- Windows 启动脚本优先；其他系统的 Python 启动方式尚需更多实机测试。
- 本地测试通过不代表所有显卡、浏览器、模型或视频编码都能兼容。
- 视频播放依赖浏览器支持的编码；视频可明确导入镜头或片段成品区，不自动识别镜头归属。
- 单视频上限 50MB，项目视频合计上限 150MB，导演包解压资源上限约 400MB。
- 当前不提供图片 / 视频生成、视频剪辑合并或云托管服务。
- IDM 等浏览器插件可能拦截本地媒体；可在插件中排除 localhost。

