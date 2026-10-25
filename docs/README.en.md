# FRAME · Storyboard Workbench

**Turn a story into a set of shots, then hand the prompts and reference images to a video generation tool.**

Write the story, organise character and location images, plan what happens in each shot and what gets said — optionally with AI help. Basic editing works without any AI connection.

A prompt is the text that describes what is in frame, how things move, and how the shot is framed. FRAME does not generate video itself. Once you generate video elsewhere, you can drop it back into the project to play, annotate and keep.

**Windows · runs locally · V3.38 · Canvas R10**　[中文](../README.md)

## What changed in R10

> The product version is V3.38; "R10" is the tenth iteration of the canvas itself. Together: "V3.38 · Canvas R10".

In one sentence: **projects open much faster, mistakes can be undone, and the canvas can wear a theme.**

- **Opening is far quicker.** A large project used to take eight or nine seconds; it now takes two or three. The project file dropped from hundreds of megabytes to a few hundred kilobytes because media is loaded on demand instead of being embedded.
- **Undo actually covers editing.** Text changes, deleted nodes, deleted segments, replaced media and pastes can all be undone with `Ctrl+Z` and redone with `Ctrl+Shift+Z`.
- **The canvas takes themes.** Ten animated presets with a crossfade instead of a hard switch, plus particles (stardust, snow, fireflies, sparks and more) whose density, speed and strength you can tune — or turn off.
- **Backdrops can be your own image or video.** A workbench-wide backdrop library means every project can reuse the same file without re-uploading.
- **Problems are easier to report.** "Tools ▾ → Export diagnostics" writes a JSON with the version, data folder, project size and recent errors. Attach it when you file an issue.

> Performance figures are single-machine measurements from an earlier test project. R10 retains that media architecture; timings are not guaranteed for every project or machine.

We also removed things that did nothing: the faint project title painted on the canvas, the old "aurora breathing" background settings, and the "root node shape" option that never had any effect. The version number moves from V3.37 to V3.38.

Beta 4 added semantic edge colours with hover focus, fixed single-click switching in the detail drawer, and turned video breakdown into a visual-only side-by-side report. Audio analysis was removed; audio reference playback, binding and export remain. See [the Beta 4 notes](release-v3.37-beta.4.md).

V3.37 added asset name mentions with preview, resizable node details, a persistent fullscreen entry, and two background styles (static dot grid and soft aurora). Air gestures and the duplicate restore entry in the top bar were removed; existing presets and user media are kept. See [the V3.37 notes](release-v3.37-beta.1.md). New EXE, source/BAT ZIP and checksum files are linked below; an existing desktop copy is never overwritten automatically.

## 1. First time here? Which file do I download?

**On Windows, download the EXE. Double-click to start — no Python needed.**

[**Download the Windows EXE**](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/releases/download/v3.38-canvas-r10/FRAME-Workbench-Windows-x64-v3.38-canvas-r10.exe)

The current Windows EXE retains the D: drive temporary-folder policy and needs a writable D: drive. Windows machines without D: have not been validated.

Run it and leave the small launcher window open; your browser opens the workbench. The interface lives in the browser, but the program and your data stay on your machine.

Other downloads: [Python source / BAT runtime ZIP](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/releases/download/v3.38-canvas-r10/FRAME-Storyboard-Workbench-v3.38-canvas-r10.zip) · [release page and checksums](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/releases/tag/v3.38-canvas-r10)

The ZIP runs or updates the Python source and needs Python; it does not include frontend development dependencies or tests. For React frontend development, download the [complete development source](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/archive/refs/tags/v3.38-canvas-r10.zip). If you are starting with the EXE, you do not need it. [Install, update and data migration](install-and-data.md)

## 2. Try it once without configuring AI

1. On the home screen, click the **"Official example"** project ("赛博修仙 v5") and create a copy when prompted.
2. Click a **segment** to read that part of the story, then click a **shot** to see its action, dialogue and prompt.
3. Edit one line of shot action and click away; watch the save status. Nodes can be expanded for details, and the inspector panel edits the same fields.
4. Press `Ctrl+Z` to undo that edit, then `Ctrl+Shift+Z` to bring it back.
5. Click the **"H3 final prompt"** node to read and copy the prompt for that segment.
6. To keep a standalone backup, use **Project pack → Save project backup / handoff**.

That covers the whole loop: read the story → edit a shot → undo → read the prompt → save a backup. The videos in the example are existing files; opening the example never calls a model or renders anything.

![The workbench: shots in the middle, inspector on the right](assets/screenshots/canvas-r10.png)

Screenshot from the isolated V3.38 Canvas R10 official example project; the people and locations are teaching assets. [Screenshot notes](assets/screenshots/README.md)

## 3. Bring your own story and media

Three words to know: a **segment** is a short piece of story (say 15 seconds), a **shot** is one frame inside it, and an **asset** is a reference file — a character, a location, a product.

1. Go back to the home screen, choose **Create project**, and name it.
2. Drag reference images onto empty canvas space to add assets. Click an asset, give it a name, describe what is actually visible, check it, then confirm.
3. Use **+ Add segment** on the canvas to start a piece of story. Select it and write in **Story / script**; type `@` to reference an asset by name.
4. Use **+ Add shot** next to a segment or inside its card to fill in action, dialogue and timing. If AI is configured, you can let it plan the shots first and apply after previewing.

For example: add three assets — customer, barista, café — then write with `@`: "The customer walks into the café, the barista nods, the customer stops at the counter." Then split it into three shots: entering, greeting, replying.

**Mentioning an `@` asset does not mean the AI has looked at the image.** Image analysis runs separately and needs confirmation. When you write the description yourself, the AI plans from your words. [Full tutorial for your first project](quick-start.md)

The canvas is for arranging relationships freely; **Card mode** is for reading one segment at a time. Both edit the same project.

## 4. Making the canvas yours

Open the **inspector → Settings**. The first block is **Dynamic theme**:

| I want to | Do this |
|---|---|
| Change the overall mood | Pick one of the ten presets (Cyber Reel, Aurora Deep, Darkroom Film…); switching crossfades |
| Use my own image or video as a backdrop | *Backdrop & atmosphere* → choose from the backdrop list, or **Choose image / video from disk** |
| Fewer particles, or none at all | Adjust particle density, speed and strength; pick "None" to remove them |
| Stop the background fighting my content | Adjust **backdrop dim** and **vignette** |
| No animation whatsoever | Tick **Advanced appearance → Reduce motion** |

Uploaded backdrops live in the **workbench-wide backdrop library**, so every project can reuse them; each file is capped at 60 MB and is not bundled into exports. Theme parameters are saved with the project. Uploaded backdrop files are not exported; copy the workbench backdrop library or select the files again when moving to another machine.

## 5. Connecting a model (only when you want AI help)

Writing the story, adding shots, organising assets and saving a project never need a model. AI shot splitting, image analysis and project chat do.

Open **gear → AI connection** on the home screen and choose one:

| Option | What you need |
|---|---|
| Local Ollama | Ollama running, the model installed, and the exact model name selected |
| OpenAI-compatible API | The provider's endpoint, model name and API key; billing follows the provider |

Text planning needs a text model; analysing images needs a vision-capable model. Test the connection before using the features.

AI jobs appear in the **Task centre**. **A finished job still needs to be reviewed and applied** before it touches your project. With cloud endpoints, requests and related content are sent to the provider you configured. [Configuration and troubleshooting](faq.md#模型与拆镜)

## 6. Saving the project, or handing it to a video tool

| Your goal | Use this |
|---|---|
| Keep editing later, or back up | Project pack → Save project backup / handoff, which writes a `.frame.json`; import it from the home screen later |
| Copy text into an external video tool | Copy the prompt from a shot or the final-prompt node, and prepare assets for that tool |
| Hand it to the ComfyUI H3 director | **Export director pack** at the top, review, then download `.mmxpack.zip` |
| Keep generated video | Drag the video into the segment's **finished video** node, play it, add notes |

**A director pack is not a video, and not a generic ComfyUI workflow.** The receiving side is currently [AIMixer's MiniMax H3 Director](https://github.com/AIMixer/ComfyUI_MiniMaxH3_Director): install its plugin, workflow and models separately, then use **Import director pack** inside the director. [Compatibility notes](h3-director-compatibility.md)

If you have not set up the H3 director yet, just save a project backup. Exporting and importing the pack is manual today; there is no one-click ComfyUI render from inside the workbench.

## More, when you need it

- **Project management**: search, grid/list, rename, duplicate and trash on the home screen; single click selects, double click opens.
- **Assets and references**: type `@` to pick an asset by name, hover to preview, copy images, paste into the library, duplicate.
- **Undo and redo**: `Ctrl+Z` / `Ctrl+Shift+Z` covering edits, deletes, replacements and pastes, up to 30 steps.
- **AI assistance**: whole-story planning, per-segment shot splitting, writing skills, project and node chat — always preview before applying.
- **Recovering deletions**: saved plans can restore missing segments and shots.
- **Appearance**: day/night themes, 12 built-in presets, custom colours; glow, spotlight, junction pads and glass can be switched off, with reduced-motion support.

The workbench now uses one canvas / card-flow editor; the separate "detailed edit" page is gone. [Full changelog](../CHANGELOG.md)

## Problems, backups and data

- **Won't open, port in use, or black media**: see [FAQ](faq.md). Do not delete the data folder first.
- **Something went wrong?** Use **Tools ▾ → Export diagnostics** and attach the JSON — it is far easier to act on than a screenshot.
- **Updating the EXE**: back up your data, quit the old launcher, run the new EXE. The new build keeps data in **`FRAME-Canvas-R10-Data` next to the EXE**; an empty data directory can copy adjacent R9 data on first launch. For other versions, use the launcher migration option or import a project backup. Old directories are preserved.
- **Source updates and migration**: [Install, update and data](install-and-data.md). A source copy keeps its data in `data/` next to the program.
- **Reporting**: [open an issue](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/issues/new/choose) with version, steps and what happened. Never attach API keys or private projects.

<details>
<summary>Developers: running from source, tests, licensing</summary>

Running from source needs Python 3.10+:

```bash
python -m pip install Pillow==12.3.0
python server.py
```

`python server.py` uses `http://127.0.0.1:8845`; `Start-Windows.bat` uses **8828**. The EXE launcher uses **8848** and opens the browser. The `--port` argument overrides the port.

```bash
python -m unittest discover -s tests -v
python tools/check_release.py
```

Canvas sources live in `frontend/`; after changing them run `node frontend/build.cjs` to produce `web/vendor/reactflow-a/app.js`, then refresh the hashes in `vendor-manifest.json`.

[Release management](releasing.md) · [Contributing](../CONTRIBUTING.md) · [Security](../SECURITY.md)

The source is public but **all rights reserved**; see [LICENSE](../LICENSE) for the actual terms, and [NOTICE](../NOTICE.md) for provenance and dependencies. Test records and historical screenshots document behaviour, not a guarantee of model output quality or compatibility with every machine.

</details>
