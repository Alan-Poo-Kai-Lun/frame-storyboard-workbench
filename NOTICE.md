# 分发内容与第三方组件说明

FRAME 的代码授权以 [LICENSE](LICENSE) 为准。本声明区分程序、示例素材、外部对接工具及实际打包依赖，不构成全部代码或素材均为原创的保证。

## 程序与来源记录

本仓库最初由维护者的 FRAME V3.7 本地安装包整理，后续修改由 Git 历史记录。2026-10-18 对当前源码、依赖、资源清单及仓库历史的检查，未发现复用此前讨论的两个参考项目代码或资源的证据；该检查不等同于完整源码相似性审计，也无法追溯导入仓库之前的全部来源。

因此不再将仅讨论过的项目列为第三方代码来源。若后续确认具体复用，应按实际文件、资源、来源和许可补充记录。

前端使用仓库内的 HTML/CSS/JavaScript；Python 程序使用标准库，并通过 Pillow 处理项目封面缩略图。

## 示例与文档素材

- `presets/starter-project.mmxpack.zip`：维护者提供并纳入公开分发的「赛博修仙 v5」示例，包含人物参考图、飞剑参考图及一条已有视频。这些是随包示例，不是当前软件现场生成的结果；本声明不额外确认素材的原创归属或授予超出实际权利范围的许可。
- `presets/starter-project.json`：咖啡店入门示例的文字与分镜结构。
- `docs/examples/cafe-demo.mmxpack.zip`：教学导演包，含三张为教学绘制的示意图和人工编写的镜头。
- `docs/assets/screenshots/`：实际程序界面及示例内容截图；新版截图来源见[截图说明](docs/assets/screenshots/README.md)，旧版文件保留作历史记录。
- `docs/assets/workflow.svg`：本仓库制作的流程示意图。
- `presets/appearance-presets.json`：经维护者确认公开分发的 12 套外观名称及参数，不包含本机项目、连接设置或密钥。

发布包按 `release-manifest.json` 收录程序与明确列出的资源，不包含用户 `data/`、私人素材库、客户资料、连接设置或模型密钥。上述公开示例及文档截图属于明确收录的例外。

## 外部工具兼容性

导演包的目标接收端为 AIMixer 的 [ComfyUI MiniMax H3 Director](https://github.com/AIMixer/ComfyUI_MiniMaxH3_Director)。引用名称用于说明文件对接对象，不表示认证、合作或联合发布。FRAME 不随包分发其插件、工作流或模型，也不随包分发 Ollama、ComfyUI 或 AI 模型权重。

## Windows EXE 与第三方依赖

Windows EXE 使用 PyInstaller 打包 Python、Tkinter/Tcl/Tk 和 Pillow。它们及所带运行组件的许可分别适用，FRAME 的权利保留声明不覆盖第三方组件。

当前构建脚本从构建环境收录 Python、PyInstaller、Tcl/Tk 的许可文本，以及 Pillow 发行包提供的许可文件，放入 EXE 的 `third-party-notices/`。实际依赖版本以对应发布物的构建记录为准；源码中的说明或构建修正不会改变已发布的旧安装包。

- [Python 许可与所含组件声明](https://docs.python.org/3/license.html)
- [PyInstaller 许可与 bootloader 分发例外](https://github.com/pyinstaller/pyinstaller/blob/develop/COPYING.txt)
- [Tcl/Tk 许可](https://www.tcl-lang.org/software/tcltk/license.html)
- [Pillow 许可](https://github.com/python-pillow/Pillow/blob/main/LICENSE)
