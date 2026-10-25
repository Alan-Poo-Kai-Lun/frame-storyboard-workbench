"""Run the canvas regression checks against a throw-away data directory.

    python tests/browser/run_all.py

Starts the local server on a free port, creates the bundled example project, then
runs every check in checks.py in a real Chromium. Nothing touches the user's data.
"""
import asyncio
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import checks  # noqa: E402


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def wait_ready(base, timeout=60):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(base + '/api/bootstrap', timeout=2) as response:
                return json.load(response)
        except Exception:
            time.sleep(0.4)
    raise RuntimeError('server did not start: ' + base)


def make_example(base, token):
    request = urllib.request.Request(base + '/api/new-project', data=b'{"example":true}',
                                     headers={'X-Workbench-Token': token, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.load(response)


async def main(external=None):
    from playwright.async_api import async_playwright

    if external:
        return await run_checks(external, None)

    port = free_port()
    base = f'http://127.0.0.1:{port}'
    work = Path(tempfile.mkdtemp(prefix='frame-browser-'))
    env = {**os.environ, 'FRAME_DATA_DIR': str(work), 'TEMP': str(work / 'tmp'), 'TMP': str(work / 'tmp')}
    (work / 'tmp').mkdir(parents=True, exist_ok=True)
    server = subprocess.Popen([sys.executable, 'server.py', '--port', str(port), '--no-browser'],
                              cwd=str(ROOT), env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        boot = wait_ready(base)
        make_example(base, boot['token'])
        return await run_checks(base, server)
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()


async def run_checks(base, server):
    from playwright.async_api import async_playwright

    failures = []
    passed = 0

    def report(name, ok, detail=''):
        nonlocal passed
        if ok:
            passed += 1
        else:
            failures.append(f'{name} | {detail}')
        print(('PASS ' if ok else 'FAIL ') + name + (f' | {detail}' if detail else ''))

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(args=['--window-size=1600,1000'])
        page = await browser.new_page(viewport={'width': 1600, 'height': 1000})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        for check in checks.CHECKS:
            try:
                await check(page, base, report)()
            except Exception as error:  # a broken check must not stop the rest
                failures.append(f'{check.__name__} crashed | {error}')
                print(f'FAIL {check.__name__} crashed | {error}')
        report('无页面错误', not errors, errors[-2:])
        await browser.close()

    total = passed + len(failures)
    print(f'SUMMARY {passed} / {total}')
    if failures:
        print('FAILURES:')
        for row in failures:
            print(' -', row)
        return 1
    return 0


if __name__ == '__main__':
    target = None
    if '--url' in sys.argv:
        target = sys.argv[sys.argv.index('--url') + 1]
    sys.exit(asyncio.run(main(target)))
