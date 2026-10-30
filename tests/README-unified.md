# 测试说明

本文件描述当前实际存在的测试。历史上这里写的是 `test_unified_*.cjs` 五个文件，那些文件已经不存在了。

## Python 后端

```bash
python -m unittest discover -s tests -p "test_*.py"
```

33 个模块，约 190 项，覆盖项目存储、媒体索引、规划、写作技能、Agent、导入导出与发布校验。

- 每个模块在 `setUpModule()`（或 `setUp()`）里把 `server.DATA` 指到临时目录，跑完自动恢复；也可以整体用 `FRAME_DATA_DIR` 指定一个一次性目录。
- **不要指向已安装程序的数据目录。** 测试会写入 `project.json`、`media/` 与 `layout.json`。
- `import server` 本身会在源码目录下创建空的 `data/`（程序正常行为，已被 `.gitignore` 忽略），除此之外不应留下任何文件。

## 浏览器回归

```bash
python tools/test_browser.py
```

只跑一个文件：`tests/r12-browser.cjs`。

- 依赖 `ffmpeg`（合成测试视频）、Playwright 与 chromium，以及指向 Playwright 的 `NODE_PATH`。
- 脚本会自己起一个隔离服务：随机端口、临时数据目录、本地模拟模型，不需要手动开服务。
- 设置 `FRAME_QA_EXE` 可以改成验证打包后的 EXE，而不是源码服务。
- 结果写到 `dist/browser-checks.json`，失败会直接抛出断言。
- 这套检查会写系统剪贴板，不要和其他浏览器测试并行跑。

## 其余 `.cjs` 文件

`tests/` 下另有 30 多个 `test_*.cjs`，是 R2–R11 期间留下的手工用例，**不在 CI 里执行**，其中的界面断言描述的是当时的界面。保留它们是当历史参考，不要当成回归保障。

## 前端类型检查与构建

```bash
cd frontend
npm ci
npm run typecheck    # 只覆盖 asset-groups.js 与 node-geometry.js
node build.cjs       # 生成 web/vendor/reactflow-a/ 并刷新 vendor-manifest.json
```

`typecheck` 不是全量 TypeScript 检查：主界面是动态 JSX，靠生产构建和浏览器回归兜底。`build.cjs` 现在会自己写 `vendor-manifest.json` 的哈希，不需要手工改。

## 版本号

```bash
python tools/bump_version.py --version 3.40 --build R14
```

会同时更新 `version.json`（`version` / `build` / `release` / `date`）和 `web/index.html` 里 52 处 `?v=` 缓存键。漏改任意一处，启动器自检会拒绝启动。发布前还需要补 `docs/release-<tag>.md`，`publish_release.py` 会检查它。

## Windows 打包

```bash
python -m pip install pyinstaller==6.22.3
python tools/build_windows.py
python tools/test_windows_build.py
```

`test_windows_build.py` 会在隔离配置目录里跑一次冻结版自检（窗口、资源、HTTP、示例工程、写作技能基线）。
