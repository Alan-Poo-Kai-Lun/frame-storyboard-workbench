# FRAME Storyboard Workbench

A local planning workspace for assets, scripts, shot lists, H3 prompts and manually uploaded clip records.

**V3.7 Beta. Publicly visible source. All rights reserved.** No open-source permission is granted at this time.

[Chinese step-by-step tutorial](quick-start.md) · [Troubleshooting](faq.md) · [Importable demo pack](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/blob/main/docs/examples/cafe-demo.mmxpack.zip)

The README screenshot is a real historical canvas view supplied by the maintainer, not a current V3.7 fullscreen screenshot. The cafe example uses drawn diagrams and hand-written shots; it contains no model output or generated video. Back up your active project before importing it.

## Export target

Director packs target **AI Mixer / AIMixer’s [ComfyUI MiniMax H3 Director](https://github.com/AIMixer/ComfyUI_MiniMaxH3_Director)**. Import the `.mmxpack.zip` using the director node’s pack-import control, not ComfyUI’s general workflow importer. Install the plugin, its workflow and model dependencies separately. `formatVersion: 1` is the pack schema version, not the plugin version; no exact external plugin revision has been certified. See [integration and compatibility](h3-director-compatibility.md). FRAME is a separate project and does not bundle the upstream plugin or model weights.

## Run

Install Python 3.10+. No third-party Python package is required.

On Windows, run `Start-Windows.bat`; alternatively:

```bash
python3 server.py
```

Open http://127.0.0.1:8787, create a project and configure your model service. Ollama defaults to http://127.0.0.1:11434. Image analysis requires a vision-capable model. Confirmed asset descriptions can be reused for text-only shot planning.

## Features

Director canvas with fullscreen, unbounded node dragging, pan/zoom and resizable inspector; shared and segment assets; shot editing and history; custom visual references; AI task queue and saved failed outputs; segment continuity; H3 Director Pack v1 import/export; uploaded video records bundled in the pack.

Images and videos are generated externally. The workbench does not generate, edit or concatenate final videos. Playback depends on browser codec support.

## Data and updates

Keep the complete `data/` directory private and backed up. Settings may contain API keys. Model requests go to the configured service; a cloud endpoint is not offline.

To update on Windows, close the browser and server, drag the release ZIP onto `Update-Windows.bat` in the existing installation, restart and hard refresh. Old program copies are archived in `versions/`.

See the [Chinese README](../README.md), [release guide](releasing.md), [LICENSE](../LICENSE) and [NOTICE](../NOTICE.md).
