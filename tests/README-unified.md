# R2 checks

The supported R2 browser regressions are `test_unified_browser.cjs`, `test_unified_data.cjs`, `test_unified_services.cjs`, `test_unified_engine.cjs`, and `test_unified_persistence.cjs`. Older legacy-view fixtures are retained as historical tests; their renderer expectations do not describe the new unified modes.

Run the Python backend suite with `python -m unittest discover -s tests -p "test_*.py"`. Use a disposable `FRAME_DATA_DIR` for any QA server. Do not point it at an installed program's data.

For browser tests, generate synthetic fixtures with `python tools/create_qa_fixtures.py` (requires ffmpeg), start the source server on port 8830, and install Playwright in a separate test-dependency folder. Set `NODE_PATH` to that folder's `node_modules`. The tests use the installed Edge browser, and default to `http://127.0.0.1:8830`; override `FRAME_QA_URL` if needed. Run these browser files sequentially, because they use the same local project service and system clipboard.

Browser tests create public example projects and synthetic assets. They never send AI requests. They do write/read the operating-system clipboard. The engine test checks viewport culling and navigation with 100 segments and 300 shots; it is not an FPS or memory benchmark.

Build the frontend with `npm ci` in `frontend`, then `node frontend/build.cjs` from the source root, followed by `python tools/finalize_unified.py`. This bundles all browser dependencies locally and refreshes their hashes. Build Windows with `python tools/build_windows.py`, then run `python tools/test_unified_build.py` for the frozen launcher's isolated-profile check.

`tools/package_unified.py` requires the saved QA reports in the source's parent folder and rejects any runtime resource changed after EXE building. It packages a new independent EXE/ZIP only; it does not install, migrate, or publish anything.
