# FRAME V3.41.2 · R15 repository organization

## V3.41.2 · R15 目录整理 — 2026-11-03

- 将 33 个后端模块按 AI、服务、项目资产、预设与通用工具分入 `backend/`，统一修正静态与动态导入。
- 历史版本说明归档到 `docs/releases/`；Windows 启动器源码移到 `tools/windows_launcher.py`。
- 保留 `server.py`、启动批处理及公共文档在根目录；修正资源根目录与写作技能预设加载路径。
- 同步源码更新器、更新批处理、发布清单、EXE 隐藏导入及 CI 路径。继续使用原项目格式、导演包格式、API 与用户数据目录。
- 新更新器备份涵盖 `backend/` 与文档；旧版更新器仍能接受新版 ZIP，旧根模块由新版启动流程备份后退役。

## V3.41.2 · R15 repository organization — 2026-11-03

- Organize 33 backend modules into `backend/ai`, `services`, `project`, `presets` and `utils`, updating static and dynamic imports.
- Archive historical notes under `docs/releases/` and move the Windows launcher source to `tools/windows_launcher.py`.
- Keep `server.py`, batch entry points and general documentation at the root. Correct resource-root and bundled writing-skill paths.
- Update the source updater, manifests, EXE hidden imports and CI paths. Project/director-package formats, APIs and user-data locations remain unchanged.
- Updater backups include backend packages and documentation. Older updaters can accept the new ZIP; the new startup archives retired flat modules.

本次为目录与导入重构，不更改用户数据格式。源码与 Windows EXE 由对应提交的检查流程验证后发布。
This reorganizes code and imports; it does not migrate user project formats. Check the workflow for this exact commit before treating an EXE as published.

本地验证：218 项后端测试（含旧更新器兼容与资源定位）、前端编译/类型检查、59 项画布及 30 项 R15 浏览器检查、Windows EXE 自检通过。云端发布状态以 GitHub Actions 为准。
Local checks: 218 backend tests including flat-updater compatibility and resource paths, frontend build/typecheck, 59 canvas and 30 R15 browser checks, and Windows EXE self-test passed. See GitHub Actions for publication status.
