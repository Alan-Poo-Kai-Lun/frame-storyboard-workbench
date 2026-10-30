"""The POST route table is the first place a request is matched.

A path that stays in both the table and the old if-chain is answered twice, and a
path dropped from both silently becomes "未知操作" at runtime.
"""
import json
import sys
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server


def setUpModule():
    sys.path.insert(0, str(Path(__file__).parent))
    import _tempdata
    _tempdata.start()


def tearDownModule():
    import _tempdata
    _tempdata.stop()


class RouteTableChecks(unittest.TestCase):
    def test_table_is_well_formed(self):
        table = server.POST_ROUTES
        self.assertGreater(len(table), 10)
        for path, handler in table.items():
            self.assertTrue(path.startswith('/api/'), path)
            self.assertTrue(callable(handler), path)

    def test_table_routes_are_not_also_listed_in_the_chain(self):
        source = (ROOT / 'server.py').read_text('utf-8')
        post = source[source.index('def do_POST(self):'):]
        for path in server.POST_ROUTES:
            self.assertNotIn("if route=='" + path + "'", post, path)

    def test_table_route_answers_over_http(self):
        # /api/models sits in the table and rejects non-Ollama settings without a network call.
        service = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        service.daemon_threads = True
        thread = threading.Thread(target=service.serve_forever, daemon=True)
        thread.start()
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        try:
            request = urllib.request.Request(
                'http://127.0.0.1:%d/api/models' % service.server_port, data=b'{}',
                headers={'X-Workbench-Token': server.TOKEN, 'Content-Type': 'application/json'})
            with self.assertRaises(urllib.error.HTTPError) as caught:
                opener.open(request, timeout=10)
            self.assertEqual(caught.exception.code, 400)
            message = json.loads(caught.exception.read() or b'{}').get('error', '')
            self.assertIn('Ollama', message)
            self.assertNotIn('未知操作', message)
        finally:
            service.shutdown()
            service.server_close()
            thread.join(timeout=3)


if __name__ == '__main__':
    unittest.main()
