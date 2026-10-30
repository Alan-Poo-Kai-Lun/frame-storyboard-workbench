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
import shutil
import time
from pathlib import Path

FOLDER = 'media'
TRASH = '.trash'
TRASH_KEEP_DAYS = 7
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


def referenced(data, state):
    """Media digests that at least one stored project still points at.

    Every project file counts, including ones sitting in the trash: a restored
    project has to find its media again. The old helper only looked at the open
    project, which would have deleted another project's material.
    """
    keep = set()
    paths = []
    state = Path(state) if state else None
    if state and state.is_file():
        paths.append(state)
    folder = Path(data) / 'projects'
    if folder.is_dir():
        paths.extend(sorted(folder.glob('*.json')))
    for path in paths:
        try:
            payload = json.loads(path.read_text('utf-8'))
        except (OSError, ValueError):
            # Guessing here would delete somebody's material, so stop instead.
            raise ValueError('项目文件无法读取，已停止清理：' + path.name)
        if not isinstance(payload, dict):
            continue
        index = payload.get('mediaIndex') if isinstance(payload.get('mediaIndex'), dict) else {}
        keep.update(value for value in index.values() if isinstance(value, str) and _REFERENCE.fullmatch(value))
        original = payload.get('originalZipHash')
        if isinstance(original, str) and _REFERENCE.fullmatch(original):
            keep.add('original-' + original)
        # A project saved before media was split out still carries the bytes inline.
        inline = payload.get('media') if isinstance(payload.get('media'), dict) else {}
        for value in inline.values():
            if isinstance(value, str) and not _REFERENCE.fullmatch(value):
                keep.add(hashlib.sha256(value.encode('utf-8')).hexdigest())
    return keep


def storage_report(data, state):
    """How much of the media folder nothing points at any more."""
    folder = Path(data) / FOLDER
    files = [item for item in folder.iterdir() if item.is_file()] if folder.is_dir() else []
    keep = referenced(data, state)
    orphans = [item for item in files if item.stem not in keep and not item.name.startswith('.')]
    trash = folder / TRASH
    trashed = [item for item in trash.rglob('*.b64') if item.is_file()] if trash.is_dir() else []
    return {'files': len(files), 'bytes': sum(_size(item) for item in files),
            'orphans': len(orphans), 'orphanBytes': sum(_size(item) for item in orphans),
            'orphanNames': [item.name for item in orphans],
            'trash': len(trashed), 'trashBytes': sum(_size(item) for item in trashed),
            'trashKeepDays': TRASH_KEEP_DAYS}


def purge_orphans(data, state, now=None):
    """Move unreferenced media into a dated trash folder; never delete outright."""
    report = storage_report(data, state)
    folder = Path(data) / FOLDER
    target = folder / TRASH / time.strftime('%Y%m%d-%H%M%S')
    moved = []
    freed = 0
    for name in report['orphanNames']:
        source = folder / name
        try:
            size = _size(source)
            target.mkdir(parents=True, exist_ok=True)
            source.replace(target / name)
        except OSError:
            continue
        moved.append(name)
        freed += size
    if moved:
        (target / 'manifest.json').write_text(json.dumps(
            {'movedAt': time.strftime('%Y-%m-%d %H:%M:%S'), 'files': moved}, ensure_ascii=False), 'utf-8')
    prune_trash(data, now)
    return {'moved': len(moved), 'bytes': freed, 'report': storage_report(data, state)}


def prune_trash(data, now=None):
    """Drop trash folders older than the keep window."""
    folder = Path(data) / FOLDER / TRASH
    if not folder.is_dir():
        return 0
    limit = (now if now is not None else time.time()) - TRASH_KEEP_DAYS * 86400
    removed = 0
    for entry in folder.iterdir():
        try:
            if entry.is_dir() and entry.stat().st_mtime < limit:
                shutil.rmtree(entry)
                removed += 1
        except OSError:
            pass
    return removed


def _size(path):
    try:
        return path.stat().st_size
    except OSError:
        return 0
