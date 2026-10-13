import base64,copy,json,sys,tempfile,unittest,zipfile,io
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import creative_library as lib,server

class CreativeLibraryChecks(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.data=Path(self.tmp.name);self.original=(server.DATA,server.STATE,server.CONFIG)
  server.DATA=self.data;server.STATE=self.data/'project.json';server.CONFIG=self.data/'settings.json'
 def tearDown(self):server.DATA,server.STATE,server.CONFIG=self.original;self.tmp.cleanup()
 def update(self,**body):return lib.update_asset(self.data,{'revision':lib.library(self.data)['revision'],**body})
 def test_media_types_revision_categories_and_reversible_deletion(self):
  blobs=[('image/png',b'\x89PNG\r\n\x1a\nTEST','人物'),('audio/wav',b'RIFF1234WAVEtest','声音'),('video/mp4',b'1234ftypisomTEST','视频')]
  for i,(mime,raw,kind) in enumerate(blobs):self.update(title='素材'+str(i),note='内容说明',category='自定义',kind=kind,media='data:'+mime+';base64,'+base64.b64encode(raw).decode())
  state=lib.library(self.data);self.assertEqual(len(state['items']),3);self.assertTrue(all('base64' not in r['url'] for r in state['items']))
  row=state['items'][0];self.assertEqual(lib.media_file(self.data,row['url'].split('/')[-1])[0],blobs[0][1])
  with self.assertRaises(ValueError):lib.update_asset(self.data,{'revision':'stale','action':'delete','id':row['id']})
  self.update(action='favorite',id=row['id']);self.update(action='category',name='自定义',newName='赛博设定')
  self.assertTrue(lib.library(self.data)['items'][0]['favorite']);self.assertTrue(all(r['category']=='赛博设定' for r in lib.library(self.data)['items']))
  self.update(action='category',name='赛博设定',remove=True);self.update(action='delete',id=row['id']);self.assertTrue(lib.library(self.data)['items'][0]['deleted'])
  self.update(action='restore',id=row['id']);self.assertFalse(lib.library(self.data)['items'][0]['deleted']);self.assertEqual(lib.library(self.data)['items'][0]['category'],'未分类')
  self.assertEqual(lib.library(self.data),lib.library(self.data),'Reloads use durable metadata')
 def test_apply_copies_real_media_and_pack_roundtrip(self):
  p=json.loads((ROOT/'presets/starter-project.json').read_text('utf-8'));server.save(p)
  source=next(iter(p['media'].values()));state=self.update(title='主角副本',note='蓝色制服',category='角色',kind='人物',media='data:image/png;base64,'+source);row=state['items'][0]
  result=lib.apply_asset(server,{'id':row['id'],'projectId':p['projectId'],'scope':'segment','segmentId':p['segments'][0]['id']});a=result['project']['assets'][-1]
  self.assertEqual(a['scope'],'segment');self.assertEqual(a['segmentId'],p['segments'][0]['id']);self.assertEqual(result['project']['media'][a['path']],source)
  self.update(action='delete',id=row['id']);current=server.load_project();self.assertEqual(current['media'][a['path']],source)
  blob=server.export_pack(current,force=True)
  restored=server.readzip(blob);copied=next(x for x in restored['assets'] if x.get('librarySourceId')==row['id'])
  self.assertEqual(restored['media'][copied['path']],source)
  with zipfile.ZipFile(io.BytesIO(blob)) as z:self.assertEqual(z.read(copied['path']),base64.b64decode(source))
 def test_invalid_media_paths_and_stale_project_are_rejected(self):
  for media in ['data:image/png;base64,VEVTVA==','data:text/html;base64,VEVTVA==']:
   with self.assertRaises(ValueError):self.update(title='坏文件',category='人物',kind='人物',media=media)
  with self.assertRaises(ValueError):lib.media_file(self.data,'../../project.json')
  state=self.update(title='文字设定',note='先记录人物背景',category='设定',kind='人物');row=state['items'][0]
  p=server.create_project(title='项目')
  with self.assertRaises(ValueError):lib.apply_asset(server,{'id':row['id'],'projectId':'stale'})
  with self.assertRaises(ValueError):lib.apply_asset(server,{'id':row['id'],'projectId':p['projectId']})
 def test_layout_presets_defaults_and_validation(self):
  store=lib.presets(self.data);opts={**lib.LAYOUT_DEFAULT,'shotColumns':2,'rolePositions':{'shot:0':{'x':300,'y':250}},'roleSizes':{'shot:0':{'w':260,'h':200}}}
  store=lib.update_preset(self.data,{'revision':store['revision'],'name':'我的双列卡片','options':opts});key=store['savedId']
  store=lib.update_preset(self.data,{'revision':store['revision'],'action':'default','id':key});p=server.create_project(title='新项目')
  self.assertEqual(p['overviewLayout']['canvas37']['cardOptions'],opts);self.assertEqual(len(p['segments'][0]['shots']),1)
  lib.update_preset(self.data,{'revision':store['revision'],'action':'default','id':'free'});q=server.create_project(title='自由项目');self.assertEqual(q['overviewLayout']['canvas37']['mode'],'free');self.assertEqual(q['segments'][0]['shots'],[])
  self.assertEqual(server.load_project()['projectId'],q['projectId']);self.assertEqual(p['overviewLayout']['canvas37']['cardOptions'],opts)
  with self.assertRaises(ValueError):lib.update_preset(self.data,{'revision':'stale','name':'覆盖','options':opts})
  for bad in [{**opts,'gap':-1},{**opts,'shotColumns':True},{**opts,'rolePositions':{'project-id':{'x':0,'y':0}}},{**opts,'roleSizes':{'shot:0':{'w':float('nan'),'h':200}}}]:
   with self.assertRaises(ValueError):lib.layout_options(bad)
  store=lib.presets(self.data);lib.update_preset(self.data,{'revision':store['revision'],'action':'delete','id':key});self.assertEqual(server.load_project()['projectId'],q['projectId'])

if __name__=='__main__':unittest.main()
