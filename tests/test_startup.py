import copy,json,sys,tempfile,threading,unittest
from pathlib import Path
from urllib.request import Request,urlopen
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import server,asset_analysis

class StartupChecks(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name);self.original=(server.DATA,server.STATE,server.CONFIG)
  server.DATA=self.path/'data';server.DATA.mkdir();server.STATE=server.DATA/'project.json';server.CONFIG=server.DATA/'settings.json'
 def tearDown(self):
  server.DATA,server.STATE,server.CONFIG=self.original;self.tmp.cleanup()
 def test_example_is_ready_without_ai_and_preserves_existing_project(self):
  old=server.create_project(title='原项目');server.save_settings({'ai':{'model':'my-local-model','key':'test-key'},'ui':{'workbenchMode':'professional'}},patch=True)
  first=server.create_project(example=True)
  self.assertEqual(len(first['assets']),2);self.assertEqual(len(first['segments'][0]['shots']),3)
  self.assertTrue(all(asset_analysis.valid(a,first['media']) for a in first['assets']))
  self.assertTrue(first['starterExample']);self.assertNotEqual(first['projectId'],old['projectId'])
  backups=[json.loads(p.read_text()) for p in (server.DATA/'backups').glob('*.json')]
  self.assertTrue(any(p['projectId']==old['projectId'] for p in backups))
  self.assertEqual(server.settings()['ai']['key'],'test-key')
  second=server.create_project(example=True)
  self.assertNotEqual(first['projectId'],second['projectId'])
  self.assertEqual(first['segments'],second['segments'])
 def test_cyber_sample_exports_complete_media_and_storyboard(self):
  import base64,io,zipfile
  p=server.create_project(example=True)
  self.assertEqual(p['title'],'赛博修仙 v5')
  self.assertEqual(len(p['segments']),4)
  self.assertEqual(sum(len(s['shots']) for s in p['segments']),12)
  self.assertEqual(sum(len(s['videos']) for s in p['segments']),1)
  self.assertTrue(all(a['path'] in p['media'] for a in p['assets']))
  p['overviewLayout']['canvas37']['appearance']={'background':'#142536','highlight':'#ff8800','gridSize':48,'pattern':'lines'}
  blob=server.export_pack(p)
  with zipfile.ZipFile(io.BytesIO(blob)) as z:
   for path,value in p['media'].items():self.assertEqual(z.read(path),base64.b64decode(value))
   shared=json.loads(z.read('shared_params/shared_params.json'))
   self.assertEqual(len(shared['refs']),2)
   for ref in shared['refs']:self.assertIn(ref['imageFile'],z.namelist())
  restored=server.readzip(blob)
  self.assertEqual(restored['overviewLayout'],p['overviewLayout'])
  self.assertEqual(restored['media'],p['media'])
  for a,b in zip(p['segments'],restored['segments']):
   for field in ['id','shots','prompt','storyText','videos']:self.assertEqual(a[field],b[field])
 def test_portable_project_retains_media_spatial_states_and_original_pack(self):
  p=server.create_project(example=True);p['segments'][0]['videos']=[{'id':'v1','path':'clip.webm','name':'clip.webm'}];p['media']['clip.webm']='VEVTVA=='
  p['originalZip']='UEFDSw=='
  restored=server.import_project(p)
  self.assertNotEqual(restored['projectId'],p['projectId'])
  for key in ['media','segments','assets','originalZip']:self.assertEqual(restored[key],p[key])
  self.assertTrue(asset_analysis.valid(restored['assets'][0],restored['media']))
 def test_bad_backup_does_not_replace_current_project(self):
  p=server.create_project(title='保留我');bad=copy.deepcopy(p);bad['segments'][0]['duration']='bad'
  with self.assertRaises(ValueError):server.import_project(bad)
  self.assertEqual(server.load_project(),p)
  bad=copy.deepcopy(p);bad['media']['../bad.png']='AA=='
  with self.assertRaises(ValueError):server.import_project(bad)
  bad=copy.deepcopy(p);bad['assets']=[{'id':'a','name':'A','kind':'人物','path':'a.png'}];bad['media']['a.png']='bad base64'
  with self.assertRaises(ValueError):server.import_project(bad)
  self.assertEqual(server.load_project(),p)
 def test_modes_and_connection_settings_survive_patch(self):
  server.save_settings({'ai':{'model':'文字模型','visionModel':'视觉模型','endpoint':'http://127.0.0.1:11434'}},patch=True)
  server.save_settings({'ui':{'workbenchMode':'professional'}},patch=True)
  self.assertEqual(server.settings()['ai']['visionModel'],'视觉模型')
  server.save_settings({'ui':{'workbenchMode':'simple'}},patch=True)
  self.assertEqual(server.settings()['ui']['workbenchMode'],'simple')
 def test_http_home_and_project_routes(self):
  service=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
  # Complete request workers before tearDown restores the module's data paths.
  service.daemon_threads=False
  thread=threading.Thread(target=service.serve_forever,daemon=True);thread.start()
  base='http://127.0.0.1:'+str(service.server_port)
  def post(route,value):
   req=Request(base+'/api/'+route,data=json.dumps(value).encode(),headers={'X-Workbench-Token':server.TOKEN,'Content-Type':'application/json'})
   # The complete example now includes a video and its original portable archive.
   with urlopen(req,timeout=30) as response:return json.load(response)
  try:
   with urlopen(base+'/',timeout=3) as response:self.assertIn(b'startup.js?v=3.13',response.read())
   with urlopen(base+'/api/bootstrap',timeout=3) as response:self.assertEqual(json.load(response)['version'],'V3.13')
   p=post('new-project',{'example':True});self.assertTrue(p['starterExample'])
   restored=post('import-project',{'project':p});self.assertEqual(restored['media'],p['media'])
   self.assertNotEqual(restored['projectId'],p['projectId'])
  finally:service.shutdown();service.server_close();thread.join(timeout=3)

 def test_http_reference_pack_projects_and_layout(self):
  import base64
  service=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler);service.daemon_threads=False;thread=threading.Thread(target=service.serve_forever,daemon=True);thread.start();base='http://127.0.0.1:'+str(service.server_port)
  headers={'X-Workbench-Token':server.TOKEN,'Content-Type':'application/json'}
  def call(route,body=None,raw=False):
   payload=body if isinstance(body,bytes) else json.dumps(body).encode() if body is not None else None
   with urlopen(Request(base+'/api/'+route,data=payload,headers=headers),timeout=30) as response:return response.read() if raw else json.load(response)
  try:
   p=call('new-project',{'example':True});layout={'canvas37':{'positions':{'project':{'x':12,'y':34}}}}
   self.assertTrue(call('canvas-layout',{'projectId':p['projectId'],'layout':layout})['ok']);self.assertEqual(server.load_project()['media'],p['media'])
   image='data:image/png;base64,'+base64.b64encode(b'\x89PNG\r\n\x1a\nTEST').decode()
   call('visual-references',{'category':'size','title':'自定义参考','note':'面部特写','image':image});blob=call('visual-pack-export',raw=True);preview=call('visual-pack-preview',blob);self.assertEqual(preview['count'],1);self.assertEqual(call('visual-pack-apply',{**preview,'mode':'keep'})['skipped'],1)
   self.assertIsNone(call('visual-library-storage')['limit'])
   second=call('new-project',{'title':'第二个项目'});self.assertEqual(len(call('projects')),2);restored=call('project-open',{'projectId':p['projectId'],'currentProjectId':second['projectId']});self.assertEqual(restored['media'],p['media']);self.assertEqual(restored['overviewLayout'],layout)
  finally:service.shutdown();service.server_close();thread.join(3)

if __name__=='__main__':unittest.main()
