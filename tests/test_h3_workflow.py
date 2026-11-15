import copy,json,unittest
from unittest.mock import patch
import server
import test_plan_archive as fixture
from backend.ai import h3_workflow as w,ai_continuity as ai,h3_compiler as h3

class H3WorkflowChecks(unittest.TestCase):
 def setUp(self):
  self.f=fixture.PlanArchiveChecks();self.f.setUp();self.addCleanup(self.f.tearDown)
  p=server.load_project();s=p['segments'][0];s['dialogueLanguage']='Mandarin';s['shots']=[{'id':'review-shot','start':0,'end':15}];s['shots'][0].update(action='女销售正面说话',dialogue='Jangan buka pautan yang mereka hantar kepada anda.',dialogueLanguage='Mandarin',startState='食指竖起',endState='手掌打开')
  p['assetsManaged']=True;p['assets']=[{'id':'poster','pictureNumber':6,'name':'安全信息图','kind':'未分类','description':'竖版信息图；'+'无关版式；'*150,'path':'assets/info.png','scope':'public'}];p['media']['assets/info.png']='aW1hZ2U='
  server.save(p);self.p=server.load_project();self.s=self.p['segments'][0];self.body={'projectId':p['projectId'],'segmentId':s['id']}
  server.CONFIG.write_text(json.dumps({'ai':{'provider':'openai','endpoint':'http://127.0.0.1:9','model':'mock-review'}}))
 def review(self):
  q=ai.enqueue(server,self.body);row=self.f.m.get(q['id']);snap=self.f.m.input(row)
  state={k:'UNKNOWN' for k in ('position','facing','posture','heldItems','result')}
  out={'summary':'需要核对语言和手势','characters':[],'scenes':[],'states':[dict(segment=0,shot=i,characters='女销售',position='门口',facing='摄影机',posture='站立',heldItems='无',mainAction=h['action'],result='停下',camera='固定',uncertainties='UNKNOWN',startState=state,endState=state) for i,h in enumerate(snap['segments'][0]['shots'])],
  'issues':[{'segment':0,'shot':0,'category':'对白语言','evidence':self.s['shots'][0]['dialogue'],'reason':'马来语错误标记','suggestion':'核对 Malay'}],
  'changes':[{'segment':0,'shot':0,'field':'dialogueLanguage','before':'Mandarin','after':'Malay','reason':'只修改语言标签'}]}
  with patch.object(server,'ai_call',return_value=json.dumps(out)) as call:self.f.m.execute_locked(row)
  call.assert_called_once();done=self.f.m.get(q['id']);self.assertEqual(done['status'],'done',done.get('error'));return done,snap
 def test_live_review_and_selected_apply_preserve_dialogue_timing_media(self):
  before=server.load_project();row,snap=self.review();self.assertEqual(server.load_project(),before);self.assertIn('adjacentStates',snap)
  p=w.apply_review(server,{**self.body,'id':row['id'],'changes':row['result']['changes']})['project'];h=p['segments'][0]['shots'][0]
  self.assertEqual(h['dialogueLanguage'],'Malay');self.assertEqual(h['dialogue'],before['segments'][0]['shots'][0]['dialogue']);self.assertEqual(h['start'],0);self.assertEqual(h['end'],15);self.assertEqual(p['media'],before['media']);self.assertTrue(p['segments'][0]['shotHistory']);self.assertFalse(h3.language_warnings(p,p['segments'][0]))
 def test_stale_review_is_never_applied(self):
  row,_=self.review();p=server.load_project();p['assets'][0]['description']='changed';server.save(p)
  with self.assertRaisesRegex(ValueError,'已改变'):w.apply_review(server,{**self.body,'id':row['id'],'changes':row['result']['changes']})
  self.assertEqual(server.load_project()['segments'][0]['shots'][0]['dialogueLanguage'],'Mandarin')
 def test_info_only_omits_long_dossier_and_overlay_is_explicit(self):
  text=h3.compile_prompt(server,self.p,self.s);self.assertNotIn('无关版式',text);self.assertNotIn('<Subject 1> is',text)
  self.s.setdefault('planning',{})['referenceUsage']={'poster':{'presentation':'overlay','generationDescription':'安全风险图标','retention':'partially_preserved'}}
  text=h3.compile_prompt(server,self.p,self.s);self.assertIn('explicitly selected overlay layer',text);self.assertIn('partially_preserved',text);self.assertNotIn('无关版式',text)
 def test_language_warning_is_not_an_automatic_rewrite(self):
  before=copy.deepcopy(self.s);self.assertTrue(h3.language_warnings(self.p,self.s));self.assertEqual(self.s,before)
 def test_settings_stale_and_invalid_changes_leave_original(self):
  data=w.settings(server,self.body);before=server.load_project()
  with self.assertRaises(ValueError):w.settings(server,{**self.body,'action':'save','sourceHash':'bad','referenceUsage':{}})
  with self.assertRaises(ValueError):w.settings(server,{**self.body,'action':'save','sourceHash':data['sourceHash'],'referenceUsage':{'missing':{}}})
  self.assertEqual(server.load_project(),before)
 def test_settings_and_review_metadata_survive_director_package(self):
  data=w.settings(server,self.body);a=data['assets'][0];usage={a['id']:{'presentation':'post','generationDescription':'后期信息卡','retention':'weak_reference'}}
  p=w.settings(server,{**self.body,'action':'save','sourceHash':data['sourceHash'],'referenceUsage':usage,'dialogueLanguage':'Malay','shotLanguages':[{'id':self.s['shots'][0]['id'],'language':'Malay'}]})['project']
  restored=server.readzip(server.export_pack(p,force=True));self.assertEqual(restored['segments'][0]['planning']['referenceUsage'],usage);self.assertEqual(restored['segments'][0]['shots'][0]['dialogueLanguage'],'Malay')
  self.assertEqual(restored['assets'][0]['description'],self.p['assets'][0]['description'])

