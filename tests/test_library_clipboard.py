import struct,unittest
from library_clipboard import payload

class ClipboardPayloadChecks(unittest.TestCase):
 def test_unicode_windows_file_drop_format(self):
  p='D:\\Codex\\素材\\声音.wav';raw=payload(p)
  self.assertEqual(struct.unpack('<IiiII',raw[:20]),(20,0,0,0,1))
  self.assertEqual(raw[20:].decode('utf-16-le'),p+'\0\0')
