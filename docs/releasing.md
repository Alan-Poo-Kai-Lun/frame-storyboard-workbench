# GitHub 版本与发布管理

## 初次创建

账号：Alan-Poo-Kai-Lun；建议仓库名：frame-storyboard-workbench；可见性：Public。不要自动添加 MIT 许可证。

将仓库源码放在根目录。`.gitignore` 排除个人数据、连接设置和视频；排除规则不代替人工检查，也不会清除曾提交过的历史数据。

若使用 GitHub CLI（需自行安装并登录），在源码目录运行：

```bash
git init -b main
git add .
git commit -m "Prepare FRAME V3.7 public beta"
gh auth login
gh repo create frame-storyboard-workbench --public --source=. --remote=origin --push
```

也可以先在 GitHub 网页创建公开仓库，再由协作工具上传本包中的源码。

## 打包

```bash
python -m unittest discover -s tests -v
python tools/check_release.py
python tools/build_release.py
```

`dist/` 生成干净的安装 ZIP 和 SHA256SUMS.txt。发布包不包含测试、CI、Git 历史和用户数据，但包含安装说明与权利声明。

本次版本 tag 为 `v3.8-beta.1`、标题为 `FRAME V3.8 Beta 1`。不要把安装 ZIP 提交进源码；在 GitHub Releases 手动上传 ZIP 和 SHA256SUMS.txt，勾选 Pre-release。发布前在 Windows 新目录测试安装，并在旧目录测试更新。

后续发布从真实源码提交打 tag；每个 Release 对应一个版本。不要修改已发布 tag 来覆盖旧版。回退前备份 data/，旧程序不保证读取新版本数据。

## CI

仓库工作流运行静态发布检查和本地结构测试，并生成可下载的安装包 Artifact。它不会自动创建 Release、改成公开仓库或上传个人数据。每次推送后应检查 GitHub Actions 结果；本地通过不代表远端 CI 已通过。

GitHub Actions 权限设为 contents: read。打包产物仅用于本次提交核对，正式下载使用 Releases。

## 后续发布待核对

- 实际复用的第三方代码及许可证；NOTICE.md 记录来源核对范围。
- 自有/获授权示例媒体及真实 UI 截图，目前只提供流程示意。
- Windows 安装/更新、主流浏览器、Ollama 及目标 H3 导演台的实机兼容。
- 明确公开与商用授权选择；当前 LICENSE 保留权利。

官方操作参考：
- https://cli.github.com/manual/gh_repo_create
- https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github
- https://docs.github.com/en/actions/tutorials/build-and-test-code/python


前端交互检查使用开发依赖，不加入安装包：

```bash
npm install --prefix /tmp/frame-ui-check jsdom@26.1.0 --ignore-scripts --no-audit --no-fund
NODE_PATH=/tmp/frame-ui-check/node_modules node tests/test_startup_ui.cjs
```


## Windows 与自动发布

`.github/workflows/release-windows.yml` 在 main 的版本或构建文件更新后运行 Windows x64 构建、自检及 Beta 发布。仅该 job 使用 contents: write，PR 不发布。版本号取自 `version.json.release`，发布说明为 `docs/release-<tag>.md`。已公开版本不会被覆盖；后续更新必须增加 release 标签。

构建依赖 PyInstaller 6.22.3，不加入源码安装包。发布 EXE、专用源码更新 ZIP 与 SHA256SUMS。若构建、自检或上传失败，查看 Actions；没有通过完整流程时不宣称已发布。
