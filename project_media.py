"""Keep large base64 media out of project.json.

A project with 200 MB of reference media used to rewrite all 200 MB on every save,
even when only a shot title changed. Media is now stored once per content hash in
``<data>/media/<sha256>.b64`` and project.json only keeps a path -> hash index.
The in-memory project keeps the original ``media`` dict, so nothing above this
module has to change.
"""
import hashlib
import json
import re
from pathlib import Path

FOLDER = 'media'
SAMPLE = 64
_REFERENCE = re.compile(r'[0-9a-f]{64}')
_sigs = {}


def folder(data):
    path = Path(data) / FOLDER
    path.mkdir(parents=True, exist_ok=True)
    return path


def _signature(value):
    """Cheap identity for a base64 blob: length plus both ends."""
    return (len(value), value[:SAMPLE], value[-SAMPLE:])


def attach(payload, data):
    """Fill ``media`` and ``originalZip`` from the content-addressed files."""
    if not isinstance(payload, dict):
        return payload
    zip_digest = payload.pop('originalZipHash', None)
    if isinstance(zip_digest, str) and not payload.get('originalZip'):
        try:
            payload['originalZip'] = (folder(data) / ('original-' + zip_digest + '.b64')).read_text('utf-8')
        except OSError:
            pass
    index = payload.get('mediaIndex')
    inline = payload.get('media') if isinstance(payload.get('media'), dict) else {}
    if isinstance(index, dict):
        target_dir = folder(data)
        media = dict(inline)
        for path, digest in index.items():
            if path in media or not isinstance(digest, str):
                continue
            try:
                media[path] = (target_dir / (digest + '.b64')).read_text('utf-8')
            except OSError:
                continue
        payload['media'] = media
    else:
        payload['media'] = inline
    return payload


def detach(project, data):
    """Write changed media files and return a JSON-ready copy without inline media."""
    media = project.get('media') if isinstance(project.get('media'), dict) else {}
    target_dir = folder(data)
    index = {}
    for path, value in media.items():
        if not isinstance(value, str):
            continue
        # A 64-char hex value that already names a stored file is a reference, not content:
        # copying a node between projects must not re-hash the reference string itself.
        if _REFERENCE.fullmatch(value) and (target_dir / (value + '.b64')).is_file():
            index[path] = value
            continue
        signature = _signature(value)
        cached = _sigs.get(path)
        if cached and cached[0] == signature:
            digest = cached[1]
        else:
            digest = hashlib.sha256(value.encode('utf-8')).hexdigest()
        _sigs[path] = (signature, digest)
        index[path] = digest
        target = target_dir / (digest + '.b64')
        if not target.exists():
            temp = target.with_suffix('.tmp')
            temp.write_text(value, 'utf-8')
            temp.replace(target)
    payload = {key: value for key, value in project.items() if key != 'media'}
    payload['mediaIndex'] = index
    original = project.get('originalZip')
    if isinstance(original, str) and original:
        signature = _signature(original)
        cached = _sigs.get('\0originalZip')
        digest = cached[1] if cached and cached[0] == signature else hashlib.sha256(original.encode('utf-8')).hexdigest()
        _sigs['\0originalZip'] = (signature, digest)
        target = target_dir / ('original-' + digest + '.b64')
        if not target.exists():
            temp = target.with_suffix('.tmp')
            temp.write_text(original, 'utf-8')
            temp.replace(target)
        payload['originalZipHash'] = digest
        payload.pop('originalZip', None)
    return payload


def forget(path=None):
    if path is None:
        _sigs.clear()
    else:
        _sigs.pop(path, None)


def orphans(data, project):
    """Media files that no longer belong to the current project (reported, not deleted)."""
    index = project.get('mediaIndex') if isinstance(project, dict) else None
    keep = {str(v) + '.b64' for v in (index or {}).values()}
    target_dir = Path(data) / FOLDER
    if not target_dir.is_dir():
        return 0
    return sum(1 for item in target_dir.iterdir() if item.is_file() and item.name not in keep)
