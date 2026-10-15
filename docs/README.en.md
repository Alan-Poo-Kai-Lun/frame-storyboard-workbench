# FRAME Storyboard Workbench

A local planning workspace for assets, scripts, shot lists, H3 prompts and manually uploaded clip records.

**V3.24 Beta 1. Publicly visible source. All rights reserved.** No open-source permission is granted at this time.

[Download Windows EXE — no Python required](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/releases/download/v3.24-beta.1/FRAME-Workbench-Windows-x64-v3.24-beta.1.exe) · [All releases](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/releases)

[Chinese step-by-step tutorial](quick-start.md) · [Troubleshooting](faq.md) · [Importable sample pack](../presets/starter-project.mmxpack.zip)

The Chinese README includes actual V3.24 floating-editor and preset-management screenshots. The built-in Cyber Cultivation v5 sample includes two reference images, four segments, twelve shots and one existing video. Opening it needs no AI connection and backs up the current project. Director-pack export retains the media and storyboard.

## V3.24 updates

Drag and resize a floating editor for segments, shots, assets and final prompts, or dock it to the Inspector. Previous/next controls and Ctrl+Left/Right switch shots with save-failure protection.

Create, rename, edit, order and remove text presets, assign Alt+Shift+1–9 within the matching field, and bind visual-reference or asset-library entries. Insertion reads the latest library text without adding media. Check reference-number meaning against the current segment. Collapsible sections retain live drafts and remember their state; collapsed output checks keep a warning count.

This public version also includes whole-story AI planning with preview-before-append, reusable writing rules, detailed prompt syntax colors, six root-node shapes and nested context menus from V3.21–V3.23. It does not directly execute Codex skills or add a ComfyUI queue bridge. Local checks passed: 57 backend tests, 20 DOM integration groups and an isolated Windows EXE self-test. Real AI output quality and GPU rendering were not tested in this update.

![V3.24 text presets](assets/screenshots/editor-presets-v3.24.jpg)

## V3.20 updates

Fixed stale imported media overwriting replaced reference images during Director Pack export. Output warnings can request AI repair with a before/after comparison and explicit application; previous shots and prompts remain recoverable. The Inspector can collapse and expand from its edge, with the state saved per project. AI workflow validation uses a mock model; review real suggestions before applying.

## V3.19 updates

Chinese / English interface switching works across canvas and detailed editing. On-demand AI translation keeps the original prompt plus Chinese and English copies; choose the Director Pack export language explicitly. Timeline tokens, reference identifiers and spoken lines remain unchanged. Stale copies require translation again. Translation workflow tests use a mock model; review real translations before exporting.

Output warnings are highlighted, manual prompt guidance is available, and segment cards can collapse and move as a group.

## Export target

Director packs target **AI Mixer / AIMixer’s [ComfyUI MiniMax H3 Director](https://github.com/AIMixer/ComfyUI_MiniMaxH3_Director)**. Import the `.mmxpack.zip` using the director node’s pack-import control, not ComfyUI’s general workflow importer. Install the plugin, its workflow and model dependencies separately. `formatVersion: 1` is the pack schema version, not the plugin version; pack import has been checked with the actual target importer; GPU generation has not been validated. See [integration and compatibility](h3-director-compatibility.md). FRAME is a separate project and does not bundle the upstream plugin or model weights.

## Run

**Windows users:** download the EXE above, run it and keep the launcher open. The workbench opens in your browser. Try the built-in sample first; AI setup is optional.

**Source users:** install Python 3.10+. No third-party Python package is required.

On Windows, run `Start-Windows.bat`; alternatively:

```bash
python3 server.py
```

Open http://127.0.0.1:8787, create a project. Configure a model service only when you want AI assistance. Ollama defaults to http://127.0.0.1:11434. Image analysis requires a vision-capable model. Confirmed asset descriptions can be reused for text-only shot planning.

![Actual V3.16 director canvas](assets/screenshots/director-canvas-v3.16.png)

**Beta 2 fixes interrupted typing:** focused text fields and IME composition no longer trigger autosave. Changes save when you leave text editing or switch nodes; manual saves preserve the caret and selection. [Fix notes](release-v3.16-beta.2.md).

## New in V3.16

- Persistent Segment / Assets / Settings inspector, with automatic saving and visible status.
- Drop image, audio or video files on blank canvas to add shared references, on shot / segment cards to add segment references, or on an asset card to replace it with a file of the same media type. Output cards receive existing video records.
- Inline T2V / I2V / FL2V / R2V selection per segment; changing a segment uses MIXED and preserves other segments' modes. V2V / RV2V projects use explicit source video configuration.
- Direct media playback, resizable images, font and color controls, PCB lines, HUD terminals and optional flow effects.
- Asset deletion with an impact preview and restore, grouped toolbar actions and clearer output placeholders.

[V3.16 release notes](release-v3.16-beta.1.md) · [Settings screenshot](assets/screenshots/canvas-settings-v3.16.png)

## Features

Director canvas with fullscreen, unbounded node dragging, pan/zoom and resizable inspector; shared and segment assets; shot editing and history; custom visual references; AI task queue and saved failed outputs; segment continuity; H3 Director Pack v1 import/export; uploaded video records bundled in the pack.

Images and videos are generated externally. The workbench does not generate, edit or concatenate final videos. Playback depends on browser codec support.

## Data and updates

Keep the complete `data/` directory private and backed up. Settings may contain API keys. Model requests go to the configured service; a cloud endpoint is not offline.

To update on Windows, close the browser and server, drag the release ZIP onto `Update-Windows.bat` in the existing installation, restart and hard refresh. Old program copies are archived in `versions/`.

See the [Chinese README](../README.md), [release guide](releasing.md), [LICENSE](../LICENSE) and [NOTICE](../NOTICE.md).


## First-run flow in V3.16

The home screen offers Try example, Create project, Import project, and Continue for an existing local project. The built-in Cyber Cultivation v5 project needs no AI to open. Simple mode follows Story → Assets → Shots; Professional mode exposes the full editor. Canvas appearance controls save background, node, highlight and grid colors, background pattern and grid size with the project. Reference-library media and reference packs have no file-size or total-capacity cap; available memory and disk still apply. AI tools prompt for Ollama or a compatible API only when needed. Save / handoff can download a complete `.frame.json` project backup without H3. H3 director-pack export still requires the separate AI Mixer ComfyUI node, workflow, and models.


## V3.18

Segment cards group reference assets, shots, prompts and output records. Save named layout presets and choose the default for new projects. The independent creator asset library supports editable names, notes, categories, favorites and image/audio/video previews; adding a reference copies its media into the project. Both libraries and Task Center are directly accessible from the canvas. Existing layouts remain unchanged until explicitly switched.
