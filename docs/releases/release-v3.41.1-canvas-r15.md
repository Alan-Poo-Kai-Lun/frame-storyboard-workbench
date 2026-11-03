# FRAME V3.41.1 · Canvas R15 patch

## V3.41.1 · Canvas R15 补修 — 2026-11-03

- 片段 Agent 支持预览并只应用到当前片段；项目 Agent 新方案仍追加，不覆盖其他片段。
- 请求提供镜头及相邻片段的起止空间状态，明确锁定当前片段时长；时间线不完整时在原调用上限内要求补全，不自动把 5 秒拉伸成 15 秒。
- 完整文字分镜可按当前片段解析；解析失败仅显示修复入口，不再显示空的可应用预览。
- 修复流式读取的 `done` 作用域错误，覆盖 Ollama NDJSON、兼容 API SSE 和整包 JSON。
- 取消及时结束本地等待、尝试断开当前连接并丢弃迟到输出；不保证远端服务立即停止计算。
- 减少重复上下文和不必要的读取调用，修正任务范围与调用次数显示；不承诺真实模型固定响应速度。
- 公共/本组素材切换后使用稳定素材 ID 跟随右侧编辑器，修复误报删除和阻止后续保存；支持归属切换的撤销、重做。
- 本地验证：214 项后端测试、17 项 Agent 针对性测试、30 项 R15 浏览器回归、片段预览应用与素材归属专项浏览器测试及 EXE 自检通过。模型测试均为本地模拟，真实服务速度与生成质量未验证。GitHub CI 与发布状态请以对应提交为准。

## V3.41.1 · Canvas R15 patch — 2026-11-03

- Segment Agent plans can be previewed and applied only to the selected segment; project plans remain append-only.
- Include neighboring shot/segment spatial states and lock the segment duration. Incomplete timelines request repair within the existing call budget; a five-second result is never silently stretched to fifteen seconds.
- Recover complete prose shot plans for the current segment. Unparsed results show a repair dialog rather than an empty applicable preview.
- Fix the streaming `done` variable scope error; cover Ollama NDJSON, compatible API SSE and whole JSON responses.
- Cancel local waits promptly, attempt to disconnect the current request and discard late output. Remote computation may continue.
- Reduce duplicate context and unnecessary reads; correct scope and call-count labels. No fixed real-model latency is promised.
- Keep the asset inspector attached to stable asset IDs when moving public/group scope; preserve editing, undo and redo without false deletion errors.
- Local validation: 214 backend tests, 17 targeted Agent tests, 30 R15 browser checks, scoped-plan and asset-scope browser checks, and EXE self-test passed. Model tests use local mocks; real-service speed and generation quality remain unverified. Check CI/release status for the concrete commit.

源码与 Windows EXE 由本提交的 Windows 工作流检查并构建。不要把私人项目、媒体或连接设置上传仓库。
Source and Windows EXE are checked and built by the workflow for this commit. User projects, media and connection settings are excluded.
