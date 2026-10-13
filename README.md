# FRAME · 分镜工作台

**把故事、参考素材、分镜和成片记录，整理在同一张导演画布里。**

Windows · 本地运行 · V3.18 Beta 1 · 基础分镜无需 AI

### [⬇ 下载 Windows 版（EXE，无需 Python）](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/releases/download/v3.18-beta.1/FRAME-Workbench-Windows-x64-v3.18-beta.1.exe)

[所有版本与更新包](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/releases) · [新手教程](docs/quick-start.md) · [常见问题](docs/faq.md) · [English](docs/README.en.md)

![FRAME V3.18 实际界面：片段卡片画布](docs/assets/screenshots/director-cards-v3.18.jpg)

## 三步开始

1. **双击 EXE**，保持启动器运行，浏览器会打开工作台。
2. **点击「体验示例项目」**，直接查看「赛博修仙 v5」的 2 张参考图、4 个片段、12 个镜头和 1 条已有视频。
3. **点片段写故事，点镜头编辑**；准备好后保存项目备份，或导出导演包交给 ComfyUI H3 导演台。

无需先安装 Ollama 或配置 API。AI 分析素材、拆镜和审查可以之后再设置。

## V3.18 有什么变化

- **片段卡片模式**：素材、横排镜头、最终提示词和成片按片段集中排列；新建卡片片段默认一个镜头，保留自由画布模式。
- **保存自己的布局**：调整素材位置、列数、间距与尺寸，捕获手动排列；保存多个命名方案，选择新项目默认布局。已有项目不会自动重排。
- **独立素材库**：自定义名称、内容说明和分类；搜索、收藏及删除恢复，预览图片、视频和音频，再加入公共或本段参考。项目使用媒体副本。
- **入口更直观**：首页 / 示例、素材库、视觉参考库与任务中心固定在画布左上。
- **保留写作体验**：文字编辑时不自动保存打断输入；空提示词可保存并从故事 AI 拆镜，本机项目支持删除、清空与回收站恢复。

<details>
<summary>查看素材库与布局方案实际截图</summary>

![V3.18 独立素材库：图片、音频、视频及文字说明](docs/assets/screenshots/asset-library-v3.18.jpg)

![V3.18 可保存多个命名布局并设置新项目默认](docs/assets/screenshots/layout-options-v3.18.jpg)

截图来自隔离测试环境，库内展示测试条目；安装包不携带这些测试条目或私人素材库。未调用生成模型。详见 [V3.18 更新说明](docs/release-v3.18-beta.1.md)。

</details>

## 导演包如何接到 ComfyUI

支持 T2V、I2V、FL2V、R2V、V2V、RV2V 与 MIXED 项目；MIXED 可为每段选择 T2V / I2V / FL2V / R2V。按模式明确指定参考素材、首尾帧或源视频，导出时检查必需输入。

在 **[AIMixer / ComfyUI MiniMax H3 Director](https://github.com/AIMixer/ComfyUI_MiniMaxH3_Director)** 节点内点击「导入导演包」，选择 `.mmxpack.zip`。插件、工作流和模型需要另行准备。已核对七种模式的包结构与目标导入器读取；实际生成效果仍需在你的模型环境验证，见 [对接说明](docs/h3-director-compatibility.md)。

FRAME 负责规划、编辑与记录；图片和视频在外部工具生成，再放回对应片段。项目与设置保存在本机；使用云模型时，请求发送到你配置的服务。

## 使用与维护

| 你想做什么 | 从这里开始 |
|---|---|
| 跟着做第一个项目 | [新手图文教程](docs/quick-start.md) |
| 更新、迁移或备份数据 | [安装、更新与数据](docs/install-and-data.md) |
| 了解完整功能和历史更新 | [功能说明](docs/workbench-guide.md) · [更新记录](CHANGELOG.md) |
| 遇到问题 | [常见问题](docs/faq.md) · [提交问题](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/issues/new/choose) |

<details>
<summary>开发、源码与授权</summary>

源码运行需要 Python 3.10+，见 [安装说明](docs/install-and-data.md#源码启动)。开发检查：

```bash
python -m unittest discover -s tests -v
python tools/check_release.py
python tools/build_release.py
```

[发布管理](docs/releasing.md) · [贡献说明](CONTRIBUTING.md) · [安全反馈](SECURITY.md)

当前源码公开可见，采用 **All rights reserved**，授权以 [LICENSE](LICENSE) 为准。素材与第三方来源见 [NOTICE](NOTICE.md)。

</details>
