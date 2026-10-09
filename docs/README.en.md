# FRAME Storyboard Workbench

A local planning workspace for assets, scripts, shot lists, H3 prompts and manually uploaded clip records.

**V3.7 Beta. Publicly visible source. All rights reserved.** No open-source permission is granted at this time.

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
