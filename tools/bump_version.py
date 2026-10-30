"""Bump the release number in one place.

The served ``?v=`` value is a content fingerprint computed by ``server.py``, so a
rebuilt script is never served under an old URL. This script only keeps the literal
in ``web/index.html`` readable and updates ``version.json``.
"""
import argparse
import datetime
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def plan(version, build):
    version = version.strip().lstrip('vV')
    build = build.strip()
    if not re.fullmatch(r'\d+\.\d+(?:\.\d+)?', version):
        raise ValueError('版本号应形如 3.40 或 3.40.0')
    if not re.fullmatch(r'[rR]\d+', build):
        raise ValueError('构建号应形如 R14')
    build = build.upper()
    release = 'v' + version + '-canvas-' + build.lower()
    return 'V' + version, build, release


def bump(root, version, build, today=None):
    version_name, build_name, release = plan(version, build)
    path = Path(root) / 'version.json'
    payload = json.loads(path.read_text('utf-8'))
    old_release = payload.get('release', '')
    payload.update(version=version_name, build=build_name, release=release,
                   date=today or datetime.date.today().isoformat())
    ordered = {key: payload[key] for key in ['version', 'build', 'date', 'release', 'obsolete_files'] if key in payload}
    ordered.update({key: value for key, value in payload.items() if key not in ordered})
    path.write_text(json.dumps(ordered, ensure_ascii=False, indent=2) + '\n', 'utf-8')

    index = Path(root) / 'web' / 'index.html'
    raw = index.read_text('utf-8')
    old_cache = old_release.removeprefix('v')
    new_cache = release.removeprefix('v')
    if old_cache and old_cache != new_cache and old_cache in raw:
        raw = raw.replace(old_cache, new_cache)
        index.write_text(raw, 'utf-8')
    elif old_cache != new_cache and old_cache not in raw:
        raise ValueError('web/index.html 里找不到旧的缓存键 ' + old_cache + '，请手动核对')
    return {'version': version_name, 'build': build_name, 'release': release,
            'cacheKey': new_cache, 'notes': 'docs/release-' + release + '.md'}


def main():
    parser = argparse.ArgumentParser(description='Bump FRAME version.json and the front-end cache key.')
    parser.add_argument('--version', required=True, help='例如 3.40')
    parser.add_argument('--build', required=True, help='例如 R14')
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--date', default=None, help='默认今天')
    args = parser.parse_args()
    try:
        result = bump(args.root, args.version, args.build, args.date)
    except Exception as error:
        print('版本号未更新：' + str(error), file=sys.stderr)
        return 1
    print('已更新：' + result['version'] + ' / ' + result['build'] + ' → ' + result['release'])
    print('前端缓存键：' + result['cacheKey'])
    notes = Path(args.root) / result['notes']
    if not notes.is_file():
        print('还缺发布说明：' + result['notes'] + '（发布脚本会检查它）')
    print('记得同步 README、CHANGELOG 与 docs/README.en.md 里的版本字样。')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
