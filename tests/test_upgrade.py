import base64,copy,io,json,tempfile,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from PIL import Image
import server,writing_backend as writing,project_hub,project_store,creative_library

class UpgradeChecks(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.old=server.DATA,server.STATE,server.CONFIG;server.DATA=Path(self.temp.name);server.STATE=server.DATA/'project.json';server.CONFIG=server.DATA/'settings.json';self.p=server.blank_project();server.save(self.p)
 def tearDown(self):server.DATA,server.STATE,server.CONFIG=self.old;self.temp.cleanup()
 def test_thumbnail_first_shot_preferred_and_cache_reused(self):
  image=Image.new('RGB',(30,20),(70,90,120));data=io.BytesIO();image.save(data,format='PNG');raw=base64.b64encode(data.getvalue()).decode();p=server.load_project();p['segments'][0]['shots']=[{'id':'shot','start':0,'end':15,'image':'first.png'}];p['media']['first.png']=raw;server.save(p)
  row=project_store.listing(server.DATA,server.STATE)[0];self.assertEqual(row['duration'],15);self.assertTrue(row['coverUrl'].startswith('/project-thumbnail/'));file=server.DATA/'project-thumbnails'/row['coverUrl'].rsplit('/',1)[-1];before=file.stat().st_mtime_ns;server.save(p);self.assertEqual(file.stat().st_mtime_ns,before)
  with Image.open(file) as cover:self.assertEqual(cover.size,(480,270))
 def test_duplicate_and_rename_do_not_switch_current_or_share_source(self):
  before=server.load_project();result=project_hub.action(server,{'action':'duplicate','projectId':before['projectId']});self.assertNotEqual(result['id'],before['projectId']);self.assertEqual(server.load_project(),before)
  project_hub.action(server,{'action':'rename','projectId':result['id'],'title':'独立副本'});self.assertEqual(project_hub.read(server.DATA,server.STATE,result['id'])['title'],'独立副本');self.assertEqual(server.load_project(),before)
 def test_custom_category_and_rename_preserve_number_and_media(self):
  p=server.load_project();p['assets']=[{'id':'animal','kind':'动物','name':'猫','scope':'public','path':'cat.png','pictureNumber':7}];p['media']={'cat.png':'YWJj'};server.save(p)
  lib=creative_library.library(server.DATA);lib=creative_library.update_asset(server.DATA,{'action':'category','name':'动物','revision':lib['revision']});creative_library.update_asset(server.DATA,{'title':'猫','note':'猫的参考','category':'动物','kind':'动物','revision':lib['revision']})
  project_hub.rename_category(server,'动物','宠物');out=server.load_project();self.assertEqual(out['assets'][0]['kind'],'宠物');self.assertEqual(out['assets'][0]['pictureNumber'],7);self.assertEqual(out['media'],p['media'])
 def create_plan(self):
  snap={'count':2,'duration':5,'signature':writing.signature(server.load_project()),'refs':[],'rules':[],'story':'两段故事'};result=writing.validate(server,{'segments':[{'title':str(i),'story':'人物站立','shots':[{'start':0,'end':5,'action':'站立','startState':'人物在门口','endState':'人物仍在门口'}]} for i in range(2)]},snap);row={'id':'plan','type':'story','status':'done','projectId':self.p['projectId'],'result':result};manager=SimpleNamespace(get=lambda ident:row,patch=lambda *args,**kwargs:None)
  with patch('task_backend.manager',return_value=manager):return writing.apply(server,{'id':'plan','segments':[{'title':s['title'],'storyText':s['storyText']} for s in result['segments']]})['project']
 def test_restore_missing_preserves_existing_edits_no_model_and_pack_roundtrip(self):
  p=self.create_plan();missing=p['segments'][-1]['id'];kept=p['segments'][-2]['id'];p['segments'][-2]['title']='用户已修改';p['segments'].pop();server.save(p)
  with patch.object(server,'ai_call',side_effect=AssertionError('Restoring must not call AI')):out=writing.restore(server,{'projectId':p['projectId'],'planId':'plan','mode':'missing'})['project']
  self.assertEqual(next(s for s in out['segments'] if s['id']==kept)['title'],'用户已修改');self.assertTrue(any(s['id']==missing for s in out['segments']))
  with self.assertRaises(ValueError):writing.restore(server,{'projectId':p['projectId'],'planId':'plan'})
  imported=server.readzip(server.export_pack(out,force=True));self.assertEqual(imported['storyPlans'],out['storyPlans'])
  result=writing.restore(server,{'projectId':p['projectId'],'planId':'plan','mode':'copy'});self.assertEqual(result['created'],2);self.assertEqual(len({s['id'] for s in result['project']['segments']}),len(result['project']['segments']))
 def test_planner_sends_requested_output_language_separately(self):
  snapshots=[];manager=SimpleNamespace(add=lambda kind,payload,cfg,snap:(snapshots.append(snap) or {'id':'plan'}))
  with patch('task_backend.manager',return_value=manager),patch.object(server,'settings',return_value={'ai':{'model':'test','endpoint':'http://local'}}):writing.enqueue(server,{'projectId':self.p['projectId'],'story':'故事','count':1,'duration':5,'outputLanguage':'ms','dialogueLanguage':'Cantonese'})
  snap=snapshots[0];output={'segments':[{'title':'故事','story':'人物站立','shots':[{'start':0,'end':5,'action':'站立','startState':'门口','endState':'门口','references':[]}]}]}
  with patch.object(server,'ai_call',return_value=json.dumps(output)) as call:result=writing.analyze(server,{},snap,{})
  self.assertIn('Bahasa Melayu',call.call_args.args[1][0]['content']);self.assertEqual(result['segments'][0]['dialogueLanguage'],'Cantonese')

 def test_portrait_cover_is_cropped_without_letterbox_and_video_status_is_real(self):
  import io,base64
  from PIL import Image
  import project_hub
  image=Image.new('RGB',(100,300),(240,40,30));raw=io.BytesIO();image.save(raw,format='PNG')
  p={'assets':[{'path':'portrait.png'}],'segments':[{'duration':5,'shots':[],'videos':[{'path':'present.mp4'},{'path':'missing.mp4'}]}],'media':{'portrait.png':base64.b64encode(raw.getvalue()).decode(),'present.mp4':'test'}}
  row=project_hub.metadata(server.DATA,p);self.assertEqual(row['videos'],1)
  file=server.DATA/'project-thumbnails'/row['coverUrl'].split('/')[-1]
  with Image.open(file) as cover:
   self.assertEqual(cover.size,(480,270))
   for xy in [(0,0),(479,269),(240,135)]:self.assertGreater(cover.getpixel(xy)[0],200)
