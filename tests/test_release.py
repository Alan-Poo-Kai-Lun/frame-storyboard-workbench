import base64,copy,io,json,sys,tempfile,unittest,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT));sys.path.insert(0,str(ROOT/'tools'))
import server
from check_release import inputs
from build_release import build
from update_workbench import archive_files,install
class ReleaseChecks(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name);self.original=(server.DATA,server.STATE,server.CONFIG)
  server.DATA=self.path/'data';server.DATA.mkdir();server.STATE=server.DATA/'project.json';server.CONFIG=server.DATA/'settings.json'
 def tearDown(self):
  server.DATA,server.STATE,server.CONFIG=self.original;self.tmp.cleanup()
 def test_release_ignores_private_files_and_is_updater_compatible(self):
  package=build(ROOT,self.path/'dist');files=archive_files(package)
  self.assertIn('web/project-overview.js',files);self.assertNotIn('demo/Scene-Reference-Test.mmxpack.zip',files)
  self.assertFalse(any(name.startswith('data/') for name in files))
 def test_update_preserves_project_and_settings(self):
  target=self.path/'installed';target.mkdir();(target/'web').mkdir();(target/'data').mkdir();(target/'server.py').write_text('# old');(target/'web/index.html').write_text('old');(target/'README.md').write_text('FRAME V3.6')
  for name in ['project.json','settings.json']:(target/'data'/name).write_text('PRIVATE_SENTINEL')
  install(build(ROOT,self.path/'dist'),target)
  for name in ['project.json','settings.json']:self.assertEqual((target/'data'/name).read_text(),'PRIVATE_SENTINEL')
  self.assertTrue(list((target/'versions').glob('*.zip')))
 def test_director_pack_retains_canvas_and_segment_clip(self):
  p=server.blank_project();s=p['segments'][0];s.update(prompt='summary:\n单镜头安静空房间。\ntimeline:\n[0s–15s]\n空房间保持安静。\nCamera: 固定机位\n',storyText='空房间保持安静。',shots=[{'id':'shot1','start':0,'end':15,'action':'空房间保持安静。','camera':'固定机位','dialogue':'','expression':'','sound':'环境声','image':'','locks':{}}])
  blob=b'\x1a\x45\xdf\xa3TEST_WEBM_PAYLOAD';path='extra/segment_videos/test.webm';s['videos']=[{'id':'clip1','path':path,'mime':'video/webm','name':'test.webm'}];p['media'][path]=base64.b64encode(blob).decode();p['overviewLayout']={'canvas37':{'positions':{'project':{'x':-100,'y':-200}},'detailWidth':480,'view':{'x':1,'y':2,'z':.7}}}
  packed=server.export_pack(p,force=True)
  with zipfile.ZipFile(io.BytesIO(packed)) as z:self.assertEqual(z.read(path),blob)
  restored=server.readzip(packed)
  self.assertEqual(restored['overviewLayout'],p['overviewLayout']);self.assertEqual(restored['segments'][0]['videos'][0]['id'],'clip1');self.assertEqual(restored['media'][path],p['media'][path])
 def test_archive_rejects_path_traversal(self):
  path=self.path/'bad.zip'
  with zipfile.ZipFile(path,'w') as z:z.writestr('../settings.json','bad')
  with self.assertRaises(ValueError):archive_files(path)
 def test_clean_initial_state(self):
  self.assertIsNone(server.load_project());self.assertEqual(server.settings()['ai']['key'],'');self.assertEqual(server.blank_project()['assets'],[])
if __name__=='__main__':unittest.main()
