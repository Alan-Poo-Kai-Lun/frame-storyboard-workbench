"""Global backdrop store: a theme backdrop belongs to the workbench, not to one project."""
import base64
import hashlib
import re
from pathlib import Path

FOLDER = 'theme-backdrops'
MIMES = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm'}
VIDEO = {'mp4', 'webm'}
LIMIT = 60 * 1024 * 1024


def folder(data):
    path = Path(data) / FOLDER
    path.mkdir(parents=True, exist_ok=True)
    return path


def listing(data):
    rows = []
    for path in sorted(folder(data).iterdir()):
        if not path.is_file():
            continue
        ext = path.suffix.lstrip('.').lower()
        if ext not in MIMES.values():
            continue
        rows.append({'name': path.name, 'url': '/api/theme-backdrop/' + path.name,
                     'type': 'video' if ext in VIDEO else 'image',
                     'sizeMB': round(path.stat().st_size / 1048576, 2)})
    return {'items': rows}


def add(data, body):
    mime = str(body.get('mime') or '')
    ext = MIMES.get(mime)
    if not ext:
        raise ValueError('只支持 PNG / JPG / WebP / GIF / MP4 / WebM')
    raw = base64.b64decode(str(body.get('data') or ''), validate=False)
    if not raw:
        raise ValueError('底片文件为空')
    if len(raw) > LIMIT:
        raise ValueError('底片文件超过 60MB')
    digest = hashlib.sha256(raw).hexdigest()[:32]
    name = digest + '.' + ext
    target = folder(data) / name
    if not target.is_file():
        target.write_bytes(raw)
    return {'name': name, 'url': '/api/theme-backdrop/' + name, 'type': 'video' if ext in VIDEO else 'image',
            'sizeMB': round(len(raw) / 1048576, 2)}


def read(data, name):
    if not re.fullmatch(r'[a-f0-9]{32}\.(png|jpg|webp|gif|mp4|webm)', name):
        raise ValueError('底片地址无效')
    path = folder(data) / name
    if not path.is_file():
        raise ValueError('底片不存在')
    ext = name.rsplit('.', 1)[-1]
    mime = next(key for key, value in MIMES.items() if value == ext)
    return path.read_bytes(), mime


def remove(data, name):
    if not re.fullmatch(r'[a-f0-9]{32}\.(png|jpg|webp|gif|mp4|webm)', name):
        raise ValueError('底片地址无效')
    path = folder(data) / name
    if path.is_file():
        path.unlink()
    return {'ok': True}
