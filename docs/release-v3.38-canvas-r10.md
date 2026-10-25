# V3.38 · 画布 R10

## 中文

这一版主要解决三件事：**打开慢、改错回不去、画布没质感。**

> 性能数字沿用此前 R9 单个测试工程的测量，R10 未重复超大视频压力测试，不代表所有设备或工程的耗时。

### 打开快了很多

大工程以前要等八九秒，现在两三秒就能开始编辑。

原因是素材不再塞进项目文件里：以前一个 217MB 的工程，每次保存都要把 200 多 MB 的图片重新写一遍；
现在素材单独存放，项目文件从 227MB 降到 151KB，保存一次从 3.8 秒降到 0.05 秒。

### 改错了可以撤回

`Ctrl+Z` 撤销，`Ctrl+Shift+Z` 重做，覆盖：改文字、删节点、删片段、替换素材、粘贴。最多 30 步。
如果之后又改过内容，会明确提示不能撤销，不会覆盖你的新编辑。

### 画布可以换主题

10 套动态主题，切换是淡入淡出不是硬切：

赛博底片 · 极光深空 · 暗房胶片 · 雨夜霓虹 · 雪原清晨 · 萤火密林 · 熔炉火星 · 水墨留白 · 数据矩阵 · 纯色静默

粒子效果有星尘、浮尘、数据雨、雪、萤火、火花、墨点七种，密度、速度、浓度都能调，也能整个关掉。
底片可以用项目里的图，也可以上传自己的图片或视频——存在**全局底片库**里，所有项目共用，单文件上限 60MB。

### 出问题更好说清楚

顶部「工具 ▾ → 导出诊断包」会生成一个 JSON：版本、数据目录、项目与素材体积、最近 25 条错误、AI 配置（不含密钥）。反馈问题时附上它，比截图快得多。

### 删掉的东西

- 画布上那层半透明项目大字（多余，且关不掉）
- 「启用极光呼吸」那组设置（和主题底片互相叠色，开了没效果还把渐变带偏）
- 「根节点形状」（从来没生效过）

### 下载

- [Windows EXE](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/releases/download/v3.38-canvas-r10/FRAME-Workbench-Windows-x64-v3.38-canvas-r10.exe) — 双击即用，不需要 Python
- [Python 源码 / BAT运行包](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/releases/download/v3.38-canvas-r10/FRAME-Storyboard-Workbench-v3.38-canvas-r10.zip) — 需要 Python

### 升级提醒

新版数据默认在 **EXE 同目录的 `FRAME-Canvas-R10-Data`**。首次启动如果该目录为空，会从同目录或上一级的旧数据复制一次，**旧目录保留、不覆盖**。升级前建议先「保存项目备份」。

### 已知限制

- 撤销只保留本次运行，关掉程序就清空
- 旧工程第一次打开需要一次性建立素材索引，耗时取决于工程与硬盘
- 低配机器上粒子会自动减半
- AI 功能仍是可选的；这一版的自动化测试使用的是本地模拟接口，没有调用真实模型

---

## English

Three things this release fixes: **slow loading, no way back from mistakes, and a flat-looking canvas.**

> Performance figures are earlier R9 measurements on one test project, not a guarantee. R10 has not repeated a large-video stress test.

### Loading is much faster

A large project used to take eight or nine seconds; it now takes two or three.

Media is no longer embedded in the project file. A 217 MB project used to rewrite 200 MB of images on every save; now media lives separately, the project file went from 227 MB to 151 KB, and a save takes 0.05 s instead of 3.8 s.

### Undo covers real editing

`Ctrl+Z` / `Ctrl+Shift+Z`, covering text edits, deleted nodes, deleted segments, replaced media and pastes — up to 30 steps. If content changed afterwards, undo refuses rather than overwriting your newer work.

### The canvas takes themes

Ten animated presets with a crossfade instead of a hard cut:

Cyber Reel · Aurora Deep · Darkroom Film · Neon Rain · Snowfield Dawn · Firefly Forest · Forge Sparks · Ink Wash · Data Matrix · Quiet Solid

Seven particle models (stardust, dust motes, data rain, snow, fireflies, sparks, ink) with adjustable density, speed and strength — or switch them off entirely. Backdrops can come from the project or from your own image/video, stored in a **workbench-wide backdrop library** shared by all projects (60 MB per file).

### Easier to report problems

Tools ▾ → Export diagnostics writes a JSON with version, data folder, project and media size, the last 25 errors and the AI configuration (no keys). Attaching it beats screenshots.

### Removed

- The translucent project title painted over the canvas (redundant, and it could not be turned off)
- The old "aurora breathing" background settings (they stacked on top of the theme backdrop, looked like nothing and shifted the gradient)
- "Root node shape" (never had any effect)

### Downloads

- [Windows EXE](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/releases/download/v3.38-canvas-r10/FRAME-Workbench-Windows-x64-v3.38-canvas-r10.exe) — double-click, no Python
- [Python source / BAT runtime ZIP](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/releases/download/v3.38-canvas-r10/FRAME-Storyboard-Workbench-v3.38-canvas-r10.zip) — needs Python

### Upgrading

Data now lives in **`FRAME-Canvas-R10-Data` next to the EXE**. On first launch, an empty folder is filled by copying from the previous data folder, which is left untouched. Save a project backup before upgrading.

### Known limits

- Undo lasts for the current run only
- An older project builds its media index once on first open (~1.5 s)
- Particles halve themselves on slower machines
- AI stays optional; automated tests in this release used local mock endpoints, not a live model
