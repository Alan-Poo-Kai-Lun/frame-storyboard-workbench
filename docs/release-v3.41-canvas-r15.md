# V3.41 · Canvas R15

2026-10-30 本地交付；2026-10-31 同步 GitHub。源码、CI 和已发布二进制的状态分别确认。

[中文说明](../README.md) · [English guide](README.en.md) · [English changelog](CHANGELOG.en.md)

## 中文

- **素材右键**：直接进入 AI 分析说明与提示词反推，反推自动选择当前图片。
- **任务结果**：素材分析打开 AI 草稿/说明历史，批量结果可逐张查看；反推结果不依赖仍存在的原素材。
- **项目笔记**：修复重复纵向滚动条，保留正文编辑与窗口缩放。
- **最终提示词**：独立弹窗支持高亮阅读、纯文本复制、编辑与保存，沿用时间线解析和撤销。
- **Agent 输入区**：独立拖动调整高度并记住设置，停靠布局保留可见的操作入口。
- **素材库**：媒体查看、拖入文件、图片粘贴、排序保存、添加日期及实际媒体复制。Agent 可引用库内文字说明，不自动添加画布素材、不冒充已看图或听音频。
- **导演包交接**：可选携带项目/画布笔记、Agent 对话、剧情规划草稿与审查记录；提供 Markdown 与 JSON，导入恢复。密钥、连接配置和临时 Agent 附图不随交接记录导出。
- **画布笔记**：多张 Markdown 笔记，支持尺寸、预览、复制副本、删除、撤销重做，以及真实父子分组和随动折叠。Markdown 本地解析并清理 HTML。
- **剧情规划布局**：左设置、右剧情，可调整栏宽；窄窗口上下排列，底部操作固定。

包含此前本地 R13/R14 的数据目录、启动器、规划输入、素材用途撤销、成品区与 AI 审查补修。[R13](release-v3.39-canvas-r13.md) · [R14](release-v3.40-canvas-r14.md)

### 使用与验证

退出旧启动器后再运行新版，保留原数据目录和备份。不要只关闭网页。EXE 与源码 ZIP 以本页附件实际存在的文件为准。

本地 R15 交付记录：205 项后端测试、59 项回归检查、30 项专项检查、生产构建、有限范围类型检查和 EXE 自检通过。AI 使用模拟模型、图片剪贴板使用替身；外部粘贴、真实模型与生成视频效果仍需实际验收。AI 审查只读文字档案，不等于观看视频。

本次 GitHub 同步还调整公开 EXE 的构建参数：不再把构建机的绝对临时目录固化到发布文件；本地构建可通过 `FRAME_BUILD_RUNTIME_TMP` 指定位置。已有本地 EXE 和桌面程序不被替换。

## English

- **Asset context menu:** analyze descriptions or reverse prompts directly; reverse-prompt input selects the clicked image.
- **Task results:** analysis opens the draft/history dialog, including per-item access for batches; saved reverse results do not require the original asset to remain present.
- **Global notes:** one visible vertical scrolling editor, with window resizing preserved.
- **Final prompts:** a separate highlighted dialog supports reading, plain-text copying, editing and saving through the existing timeline parser and undo path.
- **Agent input:** independently resize and remember the input height; docked layouts retain access to actions.
- **Reusable library:** media viewing, dropped files, pasted images, saved ordering, creation dates and actual media copying. Agent can reference library text without adding a canvas asset or claiming to have seen/heard media.
- **Director-package handoff:** optionally include notes, conversations, planning drafts and saved reviews as Markdown/JSON and restore them on import. Credentials, connection settings and temporary Agent image attachments are excluded from these records.
- **Canvas notes:** multiple Markdown nodes with resizing, preview, duplication, deletion, undo/redo and real parent-group movement/collapse. Markdown is parsed and sanitized locally.
- **Planner layout:** resizable settings/story columns, stacked sections on small windows, and fixed bottom actions.

Includes earlier local R13/R14 fixes for data directories, launcher UX, planning input, undoable scope changes, output areas and AI review.

### Usage and validation

Exit the old launcher before starting the new version; keep your existing data directory and backups. Closing only the browser does not stop the service. Available public binaries and ZIPs are the actual attached release assets.

The R15 local delivery passed 205 backend tests, 59 regressions, 30 feature checks, production compilation, scoped type checks and EXE self-tests. AI used a mock model and the image clipboard used a stub. Real providers, rendered video results and external paste targets still require acceptance testing. AI review reads text dossiers, not video pixels.

This GitHub synchronization also removes the build machine's absolute extraction directory from public EXEs. Local builders may explicitly set `FRAME_BUILD_RUNTIME_TMP`. Existing local EXEs and desktop installations remain untouched.
