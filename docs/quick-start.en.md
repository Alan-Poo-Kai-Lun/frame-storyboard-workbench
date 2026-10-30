# Quick start · R15

[Home](README.en.md) · [中文](quick-start.md) · [Changelog](CHANGELOG.en.md)

## Start or update

Download the matching EXE or ZIP from [Releases](https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/releases). Back up data and exit the old launcher before starting the new one. Place the EXE beside your existing `FRAME-Data`, or select your data directory in the launcher. Legacy directories use the existing migration mechanism. Keep the launcher running; closing the browser does not stop the service.

For source, install `requirements.txt` and run `python server.py`; the default URL is `http://127.0.0.1:8845`. The Windows BAT defaults to port 8828 and the EXE to 8852. Override with `--port` if needed. Do not run multiple versions on the same port.

## Create a project

1. Create a project or import a saved director package/project backup. Try manual editing first; AI is optional.
2. Add public or segment-specific references and descriptions. An asset's AI context menu opens analysis or reverse prompting; review task results and confirm descriptions before using them.
3. Add story segments, set duration, expand shots and edit action, camera, dialogue, language and spatial start/end states.
4. Use auto-alignment, drag/resize nodes, or adjust their dimensions in Settings. Undo with `Ctrl+Z`; redo with `Ctrl+Shift+Z`.
5. Right-click empty canvas → More editing → New Markdown note. A note placed into a frame moves and collapses with it. Keep global requirements in the separate project note.
6. Open the H3 final prompt after the last shot in its highlighted dialog. Copy it to an external generation tool, then import generated videos into shot/segment output areas for comparison.

## Configure AI

Configure Ollama or a compatible endpoint. Text planning uses a text model; image analysis needs a vision model. Requests go to your configured service; cloud charges are set by the provider.

- Whole-story planner: settings left, story editor right; preview before applying.
- Continuity review: start AI review from the planning preview and inspect identities, landmarks, per-shot states and change comparisons. Only selected suggestions reach the draft; final confirmation applies the draft to the canvas.
- Agent: drag the separator above its input to change height. `@` project assets or library text; a mention does not establish that an image/video/audio file was actually sent.
- Library: Add reference creates a project copy; Send to Agent starts a discussion without automatically binding a generation reference on the canvas.

## Library and clipboard

Click media to preview it, drop files, or paste images on library whitespace. Drag cards to reorder them. Select a card and press `Ctrl+C`: images use PNG; Windows audio/video uses a file-drop clipboard format. Receiving applications must support that format. Copy/paste inside text fields still operates on text.

## Save and hand off

Back up data before updates or tests. Director-package export can optionally include notes, Agent conversations, planning drafts and saved reviews. Read `handoff/README.md`; structured records are in `handoff/records.json` and are restored during import.

Credentials, connection settings and temporary Agent image attachments are excluded from these records. Export is not a backup of the complete machine/model environment and cannot guarantee identical regenerated video. Never upload private data directories to the public repository.
