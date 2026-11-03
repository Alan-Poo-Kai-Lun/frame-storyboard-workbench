# Changelog

[中文](../CHANGELOG.md) · [English guide](README.en.md)

## V3.41.1 · Canvas R15 patch — 2026-11-03

- Segment Agent plans can be previewed and applied only to the selected segment; project plans remain append-only.
- Include neighboring shot/segment spatial states and lock the segment duration. Incomplete timelines request repair within the existing call budget; a five-second result is never silently stretched to fifteen seconds.
- Recover complete prose shot plans for the current segment. Unparsed results show a repair dialog rather than an empty applicable preview.
- Fix the streaming `done` variable scope error; cover Ollama NDJSON, compatible API SSE and whole JSON responses.
- Cancel local waits promptly, attempt to disconnect the current request and discard late output. Remote computation may continue.
- Reduce duplicate context and unnecessary reads; correct scope and call-count labels. No fixed real-model latency is promised.
- Keep the asset inspector attached to stable asset IDs when moving public/group scope; preserve editing, undo and redo without false deletion errors.
- Local validation: 214 backend tests, 17 targeted Agent tests, 30 R15 browser checks, scoped-plan and asset-scope browser checks, and EXE self-test passed. Model tests use local mocks; real-service speed and generation quality remain unverified. Check CI/release status for the concrete commit.

## V3.41 · Canvas R15 — 2026-10-30

Local delivery on October 30; GitHub synchronization on October 31, 2026.

- GitHub verification fixes preserve hovered connections across refreshes and finish pending project saves before saving the latest canvas dimensions.
- Add direct asset context-menu access to description analysis and reverse prompting.
- Open analysis drafts/history from task results and preserve readable reverse results independently of deleted sources.
- Fix duplicate global-note scrollbars; independently resize the Agent input.
- Add a separate final-prompt dialog with highlighting, plain-text copy, editing and saving.
- Improve the reusable library: media viewer, dropped files, pasted images, saved drag order, creation dates and media copying. Agent can reference library text without adding canvas assets.
- Optionally export/restore notes, conversations, planning drafts and saved review records as Markdown/JSON handoff data; exclude credentials and temporary Agent image attachments.
- Add grouped, resizable Markdown canvas notes with local sanitization, duplication, deletion and undo/redo.
- Reorganize the whole-story planner into adjustable settings/story columns with fixed actions and a narrow-window layout.
- Include earlier local AI continuity review: a configured text-model task with identity, landmark, state and change-review views. No claim of rendered-video inspection.
- Public-build synchronization removes a build-machine extraction path from EXEs; `FRAME_BUILD_RUNTIME_TMP` remains available for explicit local builds.

Local validation: 205 backend tests, 59 regression checks, 30 feature checks and EXE self-tests. Mock AI and clipboard stubs do not establish real-model or external-application compatibility. See the exact CI run and Release for publication status.

## V3.40 · Canvas R14 — 2026-10-29

- Group launcher actions by Start, Data and Maintenance; add full-data backup and log access.
- Add Chinese/English launcher switching.
- Fix planning-text scroll position and undo for public/segment reference scope changes.
- Keep finished outputs separate from references and support shot/segment output handoff.
- Add persistent planning drafts/archives, saved-result access and subsequent AI review improvements.

## V3.39 · Canvas R13 — 2026-10-28

- Use the shared `FRAME-Data` directory and retain legacy migration paths.
- Address release packaging/documentation issues and include required screenshots.

## V3.38 · Canvas R12 — 2026-10-28

- Group actual assets by character, scene and props/audio using native parent relationships.
- Synchronize material-to-shot connections with stable reference bindings.
- Restore final-prompt nodes and configurable node dimensions.
- Document the workflow with user-supplied actual screenshots.

For earlier release history, see the preserved [Chinese changelog](../CHANGELOG.md) and versioned documents under `docs/`.
