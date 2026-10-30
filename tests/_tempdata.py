"""Point the server at a throwaway data directory for one test module.

Several test modules used to run against ``<source>/data``: whatever they saved
landed in the working copy. Under ``FRAME_DATA_DIR`` that never showed up, so the
leak only appeared when the suite was run the way the README describes.
"""
import tempfile
from pathlib import Path

_state = {}


def start():
    import server
    _state['old'] = (server.DATA, server.STATE, server.CONFIG)
    _state['tmp'] = tempfile.TemporaryDirectory()
    server.DATA = Path(_state['tmp'].name)
    server.STATE = server.DATA / 'project.json'
    server.CONFIG = server.DATA / 'settings.json'


def stop():
    import server
    server.DATA, server.STATE, server.CONFIG = _state.pop('old')
    _state.pop('tmp').cleanup()
