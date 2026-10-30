# FRAME · AI 分镜导演工作台

**把素材、剧情、镜头、笔记和最终提示词放在同一张可编辑画布上。**

FRAME 用于 AI 短视频、广告与故事分镜的前期规划和交接：整理人物、场景与音视频参考，规划片段，逐镜编辑动作、摄影机、对白和起止空间状态，再把提示词与导演包交给外部生成工具。

**Windows · 本地工作台 · V3.41 / R15**　[English](docs/README.en.md) · [版本下载](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/releases) · [使用说明](docs/quick-start.md) · [更新日志](CHANGELOG.md)

> 仓库源码与已发布 EXE 分开确认，下载请认准 Releases 的具体标签。更新 GitHub 不会替换电脑上的程序。FRAME 本身不生成图片或视频；AI 功能使用你配置的模型服务，云端调用可能产生费用。

## 工作流程

![实际工作台：左侧片段导航与 Agent、中间素材和镜头、右侧属性面板](docs/assets/screenshots/workbench-overview.png)

卡片模式与画布模式共用一个 React Flow 内核和同一份项目数据。左侧浏览片段与镜头，中间组织创作流程，右侧编辑选中节点。

上图为用户提供的 2026-10-26 实际截图，部分按钮位置已调整，不是 R15 的完整界面。下方 R15 截图来自独立测试项目。[截图来源与版本](docs/assets/screenshots/README.md)

### 1. 整理素材，确认说明

公共参考与本组参考分开管理。人物、场景、道具与声音可放入分组框，整体移动或折叠。卡片可编辑名称与说明、查看或替换文件；音视频支持卡片内播放、暂停与拖动进度。

右键素材 → **AI 与对话 → AI 分析说明 / 反推提示词**。分析任务“查看结果”直接打开 AI 草稿与说明历史，核对后再确认；反推结果独立保存，原素材删除后仍可读取尚未清理的任务结果。

素材库支持媒体查看、文件拖入、图片粘贴、拖动排序和添加日期。旧条目没有日期时明确标注。Agent 可以 `@` 素材库文字说明，无须先加入画布；这**不会自动发送库内媒体给视觉模型**。用于生成时仍需加入项目并正确绑定。

图片复制使用 PNG 剪贴板；Windows 音视频复制使用系统文件剪贴板。外部能否粘贴取决于接收软件。

### 2. 规划故事，逐镜核对

![R15：左侧设置、右侧大剧情区、底部固定操作](docs/assets/screenshots/planner-r15.png)

桌面端整篇剧情规划采用左右分栏，可拖动栏宽；窄窗口上下排列。Agent 输入区可单独拖动调整高度。

每段设置故事、时长和生成模式，展开后编辑每镜头的动作、摄影机、对白、语言、时间及起止空间状态。自动对齐整理镜头，节点尺寸和布局支持保存、撤销。

规划预览中的 **AI 连续性审查** 调用已配置文字模型，展示人物身份、场景地标、逐镜状态、问题与修改对比。选中建议先修改草稿，确认应用才写入画布。输入是剧情与素材文字档案，**不等于观看或验收真实视频**。本地规则检查与 AI 审查是两个功能。

### 3. 用笔记记录创作要求

空白画布右键 → **更多编辑 → 新建 Markdown 笔记**。支持多张笔记、改名、编辑/预览、拖动和尺寸调整；拖入分组后真正归属该框，随框移动和折叠，也可移出。支持复制副本、删除和撤销重做。项目全局笔记继续保留，正文只保留一个可见滚动区域。

Markdown 使用本地打包的 Marked 与 DOMPurify，支持常用排版和表格，不加载远程嵌入媒体。

### 4. 检查最终提示词与成品

每段最后一个镜头后连接 **H3 最终提示词**。点“查看 / 编辑”打开独立弹窗，提供字段高亮、纯文本复制、阅读和编辑。保存沿用原有时间线解析；取消不修改项目。

视频在外部工具生成后，可导入对应镜头或片段成品区进行播放、备注和对比。成品与参考素材独立。

### 5. 保存与交接

导出导演包时可选择附带：

- 项目笔记、画布笔记与位置归属；
- Agent 对话和已保存的方案应用状态；
- 剧情规划输入、参数、草稿及保存的审查记录。

`handoff/README.md` 方便阅读，`handoff/records.json` 保存结构化记录；导入后恢复项目记录。API 密钥、连接配置和临时 Agent 附图不随这些记录导出。保留过程能帮助理解与复现工作流程，不能保证模型再次生成完全相同的结果。

任务中心显示状态、分步耗时和结果入口。暂停队列只停止领取后续任务；停止跟踪不保证远端请求立即终止。主动清理后，未另存的任务结果不保证可恢复。

## 安装与更新

1. 从 [Releases](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/releases) 下载对应标签的 Windows EXE 或 ZIP。
2. 先备份数据并**退出旧启动器**，只关闭网页不会停止服务。
3. 把新 EXE 放到原数据目录旁，或在启动器选择原数据目录。默认目录为 `FRAME-Data`，旧版目录按现有迁移机制沿用。
4. 保持启动器运行，先试手动编辑，需要 AI 时再配置模型。

界面中英切换不翻译项目内容。不要上传 `FRAME-Data`、私有素材或模型密钥。[安装与数据](docs/install-and-data.md) · [English quick start](docs/quick-start.en.md)

## 开发与验证

```bash
python -m pip install -r requirements.txt
python server.py
# http://127.0.0.1:8845

npm ci --prefix frontend
npm run build --prefix frontend
npm run typecheck --prefix frontend
python tools/check_release.py
python -m unittest discover -s tests -v
```

前端构建会同步更新本地 bundle、许可和校验值。`typecheck` 严格检查分组和几何 JS/JSDoc 模块；动态 JSX 由生产构建和浏览器回归覆盖，不宣称全量 TypeScript 检查。

R15 本地交付记录：205 项后端测试、59 项回归检查、30 项专项检查与 EXE 自检通过。AI 使用本地模拟模型，图片剪贴板使用替身验证；不等于真实模型质量、视频连续性或所有外部粘贴目标已验证。GitHub Actions 和公开 EXE 状态请分别查看对应运行与 Release 标签。

[R15 中英文发布说明](docs/release-v3.41-canvas-r15.md) · [English changelog](docs/CHANGELOG.en.md) · [发布流程](docs/releasing.md)

源码公开不等于开放许可。使用与分发条款以 [LICENSE](LICENSE) 为准，依赖与来源见 [NOTICE](NOTICE.md)。
