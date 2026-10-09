# 来源与分发范围

本仓库由 Alan 的 FRAME V3.7 本地安装包整理。原安装包未附外部许可证清单；无法仅凭源码静态检查保证所有历史代码的来源。因此，公开分发前仍需核对实际复用的代码或资源及其许可证。

程序的 Python 运行依赖为标准库，前端为仓库内的 HTML/CSS/JavaScript，不随包分发 Ollama、AI 模型、ComfyUI 或第三方节点。

曾讨论过的参考项目包括：
- https://github.com/BroderQi/Storyboard
- https://github.com/luoluo-121/neural-creator-dashboard

以上仅作为设计参考的核对线索，不声明复用了其代码，也不声明其许可证适用于本项目。若发现具体复用，应逐项记录文件、来源和必要声明，不能以本项目的保留权利声明覆盖第三方许可证。

不随本仓库分发的内容：原内部店面与独立人物测试图、内部导演包、客户资料、个人连接设置、生成视频与用户自定义视觉参考。

文档新增的例外：`docs/assets/screenshots/director-canvas-historical.png` 是维护者先前提供的历史界面截图，含演示项目文字与虚构角色、飞剑缩略图，不含连接密钥。它用于说明画布操作，不作为新版界面或模型质量承诺。`docs/examples/cafe-demo.mmxpack.zip` 为本次手工构造、经程序导出并回读验证的教学示例，含三张自绘示意 PNG 与人工编写的镜头；不含真实人物、店面、AI 输出或视频。

`docs/assets/workflow.svg` 是为本仓库绘制的流程示意；不是工作台截图，也不包含用户素材。

## 导演包目标接收端

工作台导演包的目标接收端为 AI 搅拌手（AIMixer）的 [ComfyUI_MiniMaxH3_Director](https://github.com/AIMixer/ComfyUI_MiniMaxH3_Director)。FRAME 是独立的策划工具，引用名称是为了说明对接对象，不表示获得作者认证或联合发布；本仓库不分发其插件、工作流或模型。第三方许可分别适用，本项目的权利保留声明不覆盖它们。
