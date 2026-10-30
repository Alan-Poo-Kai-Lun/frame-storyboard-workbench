# V3.39 · 画布 R13

R13 只修发行阻断问题，不改画布、素材、镜头、导演包的任何数据格式。R12 工程可直接打开。

## 临时目录不再写死 D 盘

冻结版此前把临时目录固定为开发机上的 `D:\Codex\FRAME\FRAME-Canvas-R12\temp`，并且在模块导入时无条件创建。没有 D 盘的机器会在导入阶段抛 `FileNotFoundError`，启动器连错误对话框都来不及显示。CI 两条流水线都覆盖不到：ubuntu 上该分支直接返回，Windows runner 自带 D 盘。

现在依次尝试 `FRAME_TEMP_DIR` → 程序目录 `temp/` → 系统临时目录，每一步都先建目录再写探针文件，失败就继续回落，任何一步都不再让启动失败。

## 数据目录固定为 FRAME-Data

此前每轮发布改一次 `DATA_FOLDER`，用户首次启动要把整个数据目录 `copytree` 一份，长期使用会堆出多份重复的工程和媒体。

现在只有一个稳定目录 `FRAME-Data`：

- 新安装：直接使用 EXE 同目录的 `FRAME-Data`。
- 升级：EXE 旁边已有的 `FRAME-Canvas-R12-Data` 等旧目录**原地沿用**，不复制、不改名、不删除，用户不会看到第二份数据。
- 旧数据在别的版本文件夹里：仍按原逻辑复制一次到 `FRAME-Data`，原目录保留。
- 新增 `schema.json` 记录 `schemaVersion`，后续版本可在原地做字段迁移，不必再整包复制。

## 发布包补齐说明截图

README 引用了 5 张实际界面截图（工作台总览、素材分组、镜头编辑、最终提示词、任务中心），但 `release-manifest.json` 里一张都没有，打出的 ZIP 里是 5 个破图，而校验仍然通过。

现在 5 张图已进清单，`tools/check_release.py` 增加一条：任何 Markdown 引用的 `docs/assets/screenshots/*` 必须同时在发布清单里，否则直接失败。

## 画布布局按最近使用淘汰

`layout.json` 上限 60，淘汰时删的是"最早创建"的项目，而不是"最久没打开"的项目：字典赋值不会改变键的顺序，所以天天在改的老项目反而先被删，打开后卡片全部回到默认布局，没有任何提示。

现在写入前先移除再插入（LRU），上限提到 200（单项目布局约 10KB）。超过上限时被淘汰的是真正最久没动过的那个。

## 存储与清理

`project_media.orphans()` 从 R9 起就只有定义没有调用点，删项目、换素材之后 `media/` 里的文件只增不减。

现在画布「工具 ▾ → 存储与清理」会统计：媒体目录文件数与体积、未被引用的文件数与体积、回收站占用。清理把文件移到 `media/.trash/<时间戳>/`，保留 7 天，超期在下次清理时删除。

判定口径是**所有**项目文件（`project.json` + `projects/*.json`，含回收站项目）的 `mediaIndex` 与 `originalZipHash` 的并集。任何一个项目文件读不出来就整体停止，不会按猜测删除。

## 关闭页面先落盘

`beforeunload` 原来只弹确认框，不保存；自动保存是 600ms 防抖，改完立刻关标签页会丢掉最后一次编辑。

现在 `visibilitychange → hidden`、`pagehide`、`beforeunload` 都会先触发保存；页面已隐藏时请求带 `keepalive`，超过浏览器 64KB 上限则回退为普通请求。画布卡片里还没失焦的输入会在同一时刻提交（`commitAll`）。

## 实测反馈的四处修复

**整体剧情文字重影。** 该输入框是「透明 textarea + 镜像层」的双层编辑器，整个字段套在 `<label>` 里，点任意位置都会把焦点交给那个透明 textarea，镜像层随之切到 canonical 模式。此时在 textarea 里全选，`::selection` 会把本应透明的文字重新画出来，与镜像层叠在一起——所以只在长文本、需要滚动和全选时看得见。现在输入层不再接受指针和焦点，点击直接落到镜像层，重影消失。

**规划输入可回看。** 提交后原文一直保存在 `task-inputs/<任务id>.json` 与方案存档里，只是没有入口。现在任务详情有「本次输入的剧情」折叠块和「复制剧情」按钮；重开规划弹窗会自动带回上次剧情，并提示来源时间。

**项目 Agent 用上写作技能。** 服务端本来就把项目写作技能读进了快照，但只作为数据塞进用户消息，系统提示词里没有说明。现在会以「只影响文字风格，不覆盖工具调用与素材约束」的方式写进提示词；面板也显示当前技能并可一键选择。

**批量调整卡片尺寸。** 选中多个卡片后，尺寸面板显示「已选 N 个节点 · 按比例同步」，改动按同一比例作用到全部选中项，片段与镜头混选一起变，撤销一次还原。

## 缓存键改为文件指纹

上一轮把带 `?v=` 的静态资源设成一年 `immutable`，本意是让浏览器别再重下 500KB 的 React Flow；但版本号是手写的，改了六个 JS 却忘了换，浏览器就一直拿旧文件——表现是"明明改了，界面还是老样子"。

现在服务端在输出 `index.html` 时，把所有 `?v=` 重写成 `web/` 目录的内容指纹（脚本与样式的相对路径 + 体积 + 修改时间）。任何一个 JS/CSS 变了，指纹就变，URL 就变，浏览器必然重新拉取；没变时仍然是一年 `immutable`，缓存收益不变。首页本身改成 `no-cache`，保证每次都能拿到新指纹。

`tools/bump_version.py` 仍然会同步 `index.html` 里的字面值（便于阅读），但已经不再是发版必须步骤。

## 工程清理

- `version.json` 里的 `features` 有 258 条、全项目零引用，每次发版还要手工追加。已删除，更新日志只保留 `CHANGELOG.md` 一处，并修好被拆散的标题层级（`# 更新日志` 原本掉在第 43 行）。
- 静态资源原本用 `?v=` 版本化，却统一发 `Cache-Control: no-store`，等于每次刷新都重下 500KB 的 React Flow。现在带 `?v=` 的请求返回一年 immutable，首页与接口仍是 `no-store`。
- 新增 `tools/bump_version.py`：一条命令改完 `version.json` 与 `index.html` 里 52 处缓存键，漏改会被启动器自检拦住。
- `do_POST` 里 22 条单行路由改成 `POST_ROUTES` 表分发，新增 `tests/test_routes.py` 检查表内路由没有被重复写回 if 链。
- 新增 `requirements.txt`；`frontend/build.cjs` 现在自己写 `vendor-manifest.json` 的哈希，不用手工改。
- 测试不再写入源码 `data/` 目录（8 个模块 + 项目媒体模块补了模块级隔离）；`tests/README-unified.md` 按实际存在的文件重写，删掉指向已不存在的 `test_unified_*.cjs` 的说明。
- 启动器自检不再硬编码「2 素材 / 4 段 / 12 镜头」，改为从 `presets/starter-project.mmxpack.zip` 推导。

## 文档

- 发布校验新增一条：当前文档（不含历史 `docs/release-*.md`）不得再出现 `8787` 或 `%LOCALAPPDATA%\FRAME\Workbench`，否则 `check_release.py` 直接失败。


- README 与 CHANGELOG 同步到仓库版本，删掉「本次为本地 R12，未更新 GitHub」的过期说明。
- `docs/faq.md`、`docs/install-and-data.md`、`docs/workbench-guide.md` 的数据路径改为 `FRAME-Data`，端口由过期的 8787 改为实际的 8845 / 8828 / 8852。

## 验证边界

`tools/check_release.py` 通过（196 项）；Python 全量 `unittest discover` 189 项通过。

浏览器回归在 Edge 通道跑完 55 项（含 R12 的 53 项）。顺带修掉一个真问题：`tests/r12-browser.cjs` 把版本号写死成 `v3.38-canvas-r12`，每次发版都会失败，现在改为读 `version.json`。

冻结版验证：`tools/build_windows.py` 构建的 EXE 通过 `tools/test_windows_build.py` 自检（Tk、资源、HTTP、示例工程、写作技能）。另外单独验证了两条 R13 的关键路径：

- 把 `FRAME_TEMP_DIR` 指向不存在的 `Z://no-such-drive//temp`，EXE 仍能启动，临时目录回落到程序目录 `temp/`。
- 把 EXE 放进一个只有 `FRAME-Canvas-R12-Data` 的目录运行：数据原地沿用，没有生成 `FRAME-Data`，`schema.json` 写进旧目录。

**无 D 盘的实机环境仍未验证**——本机有 D 盘，上面两条是用不存在的盘符模拟同一条失败路径。AI 相关检查仍使用本地模拟接口，不代表真实模型效果。
