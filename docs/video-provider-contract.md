# Seedance 2.5 / MiniMax H3 视频接口预留

状态：仅开发者接口，无付费服务接入、无密钥配置入口、无生成按钮。
`video_provider_contract.py` 不会自动发送任何网络请求，也不由现有模型聊天设置启用。

## 接入点

- `make_request(project, segment_id, model, prompt, ...)` 建立版本1统一请求，保留项目/片段/可选镜头 ID、提示词、时长、画幅和素材引用，以及 firstFrame、lastFrame、continuity、providerOptions。
- `VideoProvider.validate(request)`：实现者须依据所选服务商当前文档验证模型模式、时长、格式、参考媒体数量等，不默认两个模型的参数一致。
- `submit(request, idempotency_key=...)`：提交后返回 taskId/status。必须先持久化任务键及请求摘要；超时先查询，不盲目重复扣费。
- `query(task_id)`：恢复任务状态。将 taskId 和状态保存至现有任务中心是后续真实接入时的工作，本版未接入任务调度 UI。
- `result(task_id)`：服务端下载成片，返回 taskId、bytes、mime 和可选 title。短期下载 URL 不能当永久本地成品路径。
- 可选 `cancel(task_id)`：只有供应商实际支持时提供；取消本地跟踪不等于远端停止计费。
- `attach_result(project, request, result)`：返回项目副本，把文件及关联记录放进 `segments[].videos`，原资产区不变。调用者须在现有 LOCK 内重读最新项目，按事务保存、更新 UI，避免覆盖并发编辑。目标已删除/项目变化时拒绝写入。单文件沿用50MB限制。

## 模拟验证（不联网）

```python
from pathlib import Path
from video_provider_contract import make_request, MockVideoProvider, attach_result
request = make_request(project, segment_id, 'minimax-h3', compiled_prompt)
provider = MockVideoProvider(Path('local-fixture.webm').read_bytes())
task = provider.submit(request, idempotency_key='local-test-request-1')
assert provider.query(task['taskId'])['status'] == 'completed'
updated = attach_result(project, request, provider.result(task['taskId']))
# 保存 updated 仍须由工作台原有事务完成；此示例没有写入磁盘。
```

## 实现时必须处理

API Key 仅后端持有，绝不写入导演包、审查包、请求快照或浏览器日志。素材路径是本地逻辑路径，适配器负责上传并保持稳定 ID 与模型标签映射；不要把本地路径直接当远程 URL。首尾帧/尾部视频能力按服务商验证，未支持时明确拒绝或由用户选择仅文字承接，不能静默忽略。生成费用确认、任务持久化、重试恢复、并发与速率限制需要真实接入时落实。本版仅提供并验证接口契约与本地模拟，不声称支持付费生成。
