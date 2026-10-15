import copy,json,tempfile,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import server,writing_backend as writing
class WritingChecks(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.old=(server.DATA,server.STATE,server.CONFIG);server.DATA=Path(self.temp.name);server.STATE=server.DATA/'project.json';server.CONFIG=server.DATA/'settings.json';self.p=server.blank_project();server.save(self.p)
 def tearDown(self):
  server.DATA,server.STATE,server.CONFIG=self.old;self.temp.cleanup()
 def snapshot(self):
  return {'count':2,'duration':5,'signature':writing.signature(server.load_project()),'refs':[],'rules':[],'story':'两段故事'}
 def output(self):
  return {'segments':[{'title':'第一段','story':'人物走到门口','summary':'走近门口','language':'中文','shots':[{'start':0,'end':5,'action':'人物走到门口','camera':'固定','startState':'人物在路边','endState':'人物在门口','dialogue':'你好'}]},{'title':'第二段','story':'人物回头','language':'粤语','shots':[{'start':0,'end':5,'action':'人物回头','startState':'人物在门口','endState':'人物回头看路边'}]}]}
 def test_rule_revision_and_selection(self):
  lib=writing.library(server);self.assertEqual(len(lib['items']),3)
  r=writing.library(server,{'action':'save','revision':lib['revision'],'name':'自定义','rules':'保持故事因果','category':'测试'});self.assertEqual(len(r['items']),4)
  with self.assertRaises(ValueError):writing.library(server,{'action':'delete','revision':lib['revision'],'id':r['items'][-1]['id']})
  self.assertEqual(writing.selected(server,self.p,ids=[r['items'][-1]['id']])[0]['name'],'自定义')
  with self.assertRaises(ValueError):writing.selected(server,self.p,ids=['missing'])
 def test_validate_and_append_no_overwrite_or_double_apply(self):
  snap=self.snapshot();result=writing.validate(server,self.output(),snap);self.assertEqual(result['segments'][0]['dialogueLanguage'],'Mandarin')
  row={'id':'t','type':'story','status':'done','projectId':self.p['projectId'],'result':result};manager=SimpleNamespace(get=lambda i:row,patch=lambda i,**kw:row.update(kw));before=server.load_project();edits=[{'title':s['title'],'storyText':s['storyText']} for s in result['segments']]
  with patch('task_backend.manager',return_value=manager):
   out=writing.apply(server,{'id':'t','segments':edits});self.assertEqual(out['created'],2);self.assertEqual(out['project']['segments'][:len(before['segments'])],before['segments']);self.assertEqual(out['project']['media'],before['media'])
   with self.assertRaises(ValueError):writing.apply(server,{'id':'t','segments':edits})
  restored=server.readzip(server.export_pack(out['project'],force=True));self.assertEqual(restored['segments'][-1]['dialogueLanguage'],'Cantonese')
 def test_reject_invalid_model_and_stale_project(self):
  snap=self.snapshot()
  for change in ['count','time','reference']:
   obj=self.output()
   if change=='count':obj['segments'].pop()
   if change=='time':obj['segments'][0]['shots'][0]['end']=6
   if change=='reference':obj['segments'][0]['shots'][0]['action']='@Picture 99 走近'
   with self.assertRaises(ValueError):writing.validate(server,obj,snap)
  row={'id':'t','type':'story','status':'done','projectId':self.p['projectId'],'result':writing.validate(server,self.output(),snap)};p=server.load_project();p['segments'][0]['storyText']='新故事';server.save(p)
  with patch('task_backend.manager',return_value=SimpleNamespace(get=lambda i:row)):
   with self.assertRaises(ValueError):writing.apply(server,{'id':'t','segments':[]})
  self.assertEqual(server.load_project()['segments'][0]['storyText'],'新故事')
 def test_segment_language_overrides_project_and_shot_overrides_segment(self):
  p=server.load_project();p['dialogueLanguage']='粤语';s=p['segments'][0];s['dialogueLanguage']='英语';s['prompt']='timeline:\n[0s-15s]\n你好';s['shots']=[{'id':'h','start':0,'end':15,'action':'站立','dialogue':'你好','sound':'风声'}]
  self.assertIn('Dialogue language: English',server.original_scoped_prompt(p,s));s['shots'][0]['dialogueLanguage']='马来语';self.assertIn('Dialogue language: Malay',server.original_scoped_prompt(p,s));self.assertIn('你好',server.original_scoped_prompt(p,s))
