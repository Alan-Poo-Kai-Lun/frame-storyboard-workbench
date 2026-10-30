import base64
import unittest
import theme_backdrops

def setUpModule():
 import sys
 from pathlib import Path
 sys.path.insert(0,str(Path(__file__).parent))
 import _tempdata;_tempdata.start()

def tearDownModule():
 import _tempdata;_tempdata.stop()


PNG = base64.b64encode(bytes.fromhex(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f00050001ff'
    '5f1d5b6b0000000049454e44ae426082')).decode()


class ThemeBackdropChecks(unittest.TestCase):
    def test_upload_list_and_read(self):
        row = theme_backdrops.add(server_data(), {'mime': 'image/png', 'data': PNG})
        self.assertTrue(row['name'].endswith('.png'))
        self.assertEqual(row['type'], 'image')
        names = [item['name'] for item in theme_backdrops.listing(server_data())['items']]
        self.assertIn(row['name'], names)
        raw, mime = theme_backdrops.read(server_data(), row['name'])
        self.assertEqual(mime, 'image/png')
        self.assertEqual(raw, base64.b64decode(PNG))

    def test_same_file_is_stored_once(self):
        first = theme_backdrops.add(server_data(), {'mime': 'image/png', 'data': PNG})
        second = theme_backdrops.add(server_data(), {'mime': 'image/png', 'data': PNG})
        self.assertEqual(first['name'], second['name'])
        self.assertEqual(len(theme_backdrops.listing(server_data())['items']), 1)

    def test_rejects_unknown_type_and_bad_names(self):
        with self.assertRaises(ValueError):
            theme_backdrops.add(server_data(), {'mime': 'text/html', 'data': PNG})
        with self.assertRaises(ValueError):
            theme_backdrops.read(server_data(), '../../project.json')

    def test_remove(self):
        row = theme_backdrops.add(server_data(), {'mime': 'image/png', 'data': PNG})
        theme_backdrops.remove(server_data(), row['name'])
        self.assertEqual(theme_backdrops.listing(server_data())['items'], [])


_DATA = None


def server_data():
    """The backdrop store lives beside the project data; reuse the test data directory."""
    global _DATA
    if _DATA is None:
        import server
        _DATA = server.DATA
    return _DATA


if __name__ == '__main__':
    unittest.main()
