import base64,io,json,tempfile,unittest,zipfile
from pathlib import Path
import visual_library as library,reference_packs as packs

PNG=b'\x89PNG\r\n\x1a\nREFERENCE_TEST'
IMAGE='data:image/png;base64,'+base64.b64encode(PNG).decode()
class PackChecks(unittest.TestCase):
 def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.data=Path(self.tmp.name)
 def tearDown(self):self.tmp.cleanup()
 def add(self,title='人物参考',builtin='builtin:size:0'):
  library.update(self.data,{'id':builtin,'builtin':builtin,'category':'size','title':title,'note':'同一人物，特写构图','image':IMAGE})
 def test_export_import_preserves_overrides_media_and_hidden(self):
  self.add();library.update(self.data,{'id':'builtin:size:0','builtin':'builtin:size:0','category':'size','title':'人物参考','note':'同一人物，特写构图','keepMedia':True,'hidden':True})
  blob=packs.export(self.data)
  with tempfile.TemporaryDirectory() as folder:
   target=Path(folder);preview=packs.preview(target,blob);self.assertEqual(library.read(target),[])
   result=packs.apply(target,{**preview,'mode':'keep'});self.assertEqual(result['imported'],1)
   row=library.read(target)[0];self.assertTrue(row['hidden']);self.assertEqual(row['image'],IMAGE)
   self.assertTrue((target/'reference-pack-backups'/result['backup']).is_file())
 def test_keep_replace_and_backup(self):
  self.add('包内参考');blob=packs.export(self.data);self.add('我的参考');preview=packs.preview(self.data,blob)
  result=packs.apply(self.data,{**preview,'mode':'keep'});self.assertEqual(result['skipped'],1);self.assertEqual(library.read(self.data)[0]['title'],'我的参考')
  preview=packs.preview(self.data,blob);result=packs.apply(self.data,{**preview,'mode':'replace'});self.assertEqual(library.read(self.data)[0]['title'],'包内参考')
  previous,_=packs.parse((self.data/'reference-pack-backups'/result['backup']).read_bytes());self.assertEqual(previous[0]['title'],'我的参考')
 def test_stale_preview_rejected_and_cancellable(self):
  self.add();preview=packs.preview(self.data,packs.export(self.data));self.add('新编辑')
  with self.assertRaises(ValueError):packs.apply(self.data,{**preview,'mode':'replace'})
  self.assertEqual(library.read(self.data)[0]['title'],'新编辑');packs.cancel(self.data,preview['token']);self.assertFalse((self.data/'reference-imports'/(preview['token']+'.zip')).exists())
 def test_invalid_pack_leaves_library_untouched(self):
  self.add();before=library.read(self.data);blob=packs.export(self.data)
  with zipfile.ZipFile(io.BytesIO(blob)) as archive:files={n:archive.read(n) for n in archive.namelist()}
  for name,value in [('media/../../bad','bad'),('manifest.json','{}')]:
   out=io.BytesIO()
   with zipfile.ZipFile(out,'w') as archive:
    for n,v in files.items():archive.writestr(n,value if n==name else v)
    if name not in files:archive.writestr(name,value)
   with self.assertRaises(ValueError):packs.preview(self.data,out.getvalue())
   self.assertEqual(library.read(self.data),before)
 def test_shared_media_pack_deduplicated_and_large_image_accepted(self):
  self.add();library.update(self.data,{'category':'size','title':'第二项','note':'中景','image':IMAGE});blob=packs.export(self.data)
  with zipfile.ZipFile(io.BytesIO(blob)) as archive:self.assertEqual(len([n for n in archive.namelist() if n.startswith('media/')]),1)
  bigger='data:image/png;base64,'+base64.b64encode(PNG+b'0'*(21*1024*1024)).decode();self.assertEqual(library.media_type(bigger),'image/png')
  library.update(self.data,{'category':'size','title':'超过旧图片上限','note':'大图','image':bigger})
  rows,media=packs.parse(packs.export(self.data));self.assertEqual(len(rows),3);self.assertEqual(max(map(len,media.values())),len(base64.b64decode(bigger.split(',',1)[1])))
