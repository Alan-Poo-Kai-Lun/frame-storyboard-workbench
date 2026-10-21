import copy,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import server,task_backend,writing_backend as writing,agent_backend as agent,plan_store

class PlanArchiveChecks(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.old=server.DATA,server.STATE,server.CONFIG
  server.DATA=Path(self.tmp.name);server.STATE=server.DATA/'project.json';server.CONFIG=server.DATA/'settings.json'
  server.DATA.joinpath('tasks.json').write_text(json.dumps({'paused':True,'tasks':[]}))
  self.p=server.blank_project();server.save(self.p);self.m=task_backend.manager(server)
 def tearDown(self):
  self.m.action({'action':'pause'});server.DATA,server.STATE,server.CONFIG=self.old;self.tmp.cleanup()
 def snap(self):return {'schemaVersion':2,'count':2,'duration':5,'signature':writing.signature(server.load_project()),'refs':[],'rules':[],'story':'两个连续片段','dialogueLanguage':'Mandarin','continuity':True,'guideFromPrev':False,'aspectRatio':'16:9'}
 def source(self):return {'segments':[{'title':str(i),'story':'人物走近','summary':'走近','language':'Mandarin','shots':[{'start':0,'end':5,'action':'人物走近','camera':'固定','dialogue':'你好','startState':'门口','endState':'柜台前','references':[]}]} for i in range(2)]}
 def archived(self,kind='story'):
  snap=self.snap();result=writing.recover(server,self.source(),snap)
  if kind=='agent':result={'reply':'分镜方案','target':{'kind':'project'},'changes':[],'storyPlan':result,'signature':snap['signature']};snap.update(target={'kind':'project'},context={'assets':[]})
  row=self.m.add(kind,{'projectId':self.p['projectId']},{},snap);self.m.patch(row['id'],status='done',result=result)
  plan_store.put(server,self.m.get(row['id']),snap)
  return self.m.get(row['id']),snap
 def test_clear_task_preserves_message_plan_and_apply_without_model(self):
  row,snap=self.archived('agent');target={'kind':'project'};thread=agent.conversation(server,self.p,target)
  agent.store_chat(server,self.p['projectId'],thread['id'],{'role':'assistant','content':'分镜方案','taskId':row['id']})
  self.m.action({'action':'clear_done'});self.assertIsNone(self.m.get(row['id']))
  message=agent.info(server,{'projectId':self.p['projectId'],'target':target})['messages'][0]
  self.assertEqual(len(message['result']['storyPlan']['segments']),2)
  data=plan_store.endpoint(server,{'projectId':self.p['projectId'],'id':row['id']});edits=data['plan']['segments'];edits[0]['shots'][0]['dialogue']='原文对白保留'
  with patch.object(server,'ai_call',side_effect=AssertionError('no inference')):
   out=plan_store.endpoint(server,{'action':'apply','projectId':self.p['projectId'],'id':row['id'],'segments':edits})
  self.assertEqual(plan_store.get(server,row['id'])['appliedVia'],'plan-preview');self.assertEqual(out['created'],2);self.assertEqual(out['project']['segments'][-2]['shots'][0]['dialogue'],'原文对白保留')
  with self.assertRaisesRegex(ValueError,'已应用'):plan_store.endpoint(server,{'action':'apply','projectId':self.p['projectId'],'id':row['id'],'segments':edits})
 def test_stale_client_save_and_task_delete_do_not_erase_archive(self):
  row,snap=self.archived();stale=copy.deepcopy(self.p);self.m.action({'action':'delete','id':row['id']});server.save(stale)
  self.assertIn(row['id'],server.load_project()['planArchive']);self.assertEqual(plan_store.get(server,row['id'])['snapshot'],snap)
  plan_store.endpoint(server,{'action':'draft','projectId':self.p['projectId'],'id':row['id'],'segments':[{'title':'未应用草稿'}]})
  self.assertEqual(plan_store.endpoint(server,{'projectId':self.p['projectId'],'id':row['id']})['draft'][0]['title'],'未应用草稿')
 def test_unknown_reference_is_recoverable_but_never_guessed(self):
  snap=self.snap();source=self.source();source['segments'][0]['shots'][0].update(action='@Picture 99 走近',references=[99])
  result=writing.recover(server,source,snap)
  self.assertEqual(result['segments'][0]['shots'][0]['referenceNumbers'],[99]);self.assertIn('Picture 99',result['segments'][0]['shots'][0]['action']);self.assertTrue(result['blockingIssues'])
  checked=writing.validate_edits(server,result,result['segments']);self.assertTrue(checked['warnings']);self.assertEqual(checked['segments'][0]['shots'][0]['referenceNumbers'],[]);self.assertNotIn('@Picture 99',checked['segments'][0]['shots'][0]['action'])
  result['segments'][0]['shots'][0].update(action='人物走近',referenceNumbers=[])
  self.assertFalse(writing.validate_edits(server,result,result['segments'])['blockingIssues'])
 def test_cached_output_reparse_never_calls_model(self):
  snap=self.snap();snap['modelResponse']=json.dumps(self.source())
  with patch.object(server,'ai_call',side_effect=AssertionError('no inference')):result=writing.analyze(server,{},snap,{})
  self.assertEqual(len(result['segments']),2)
 def test_malformed_output_can_be_reparsed_from_archive(self):
  snap=self.snap();snap['modelResponse']='{invalid';result=writing.recover(server,snap['modelResponse'],snap)
  row=self.m.add('story',{'projectId':self.p['projectId']},{},snap);self.m.patch(row['id'],status='done',result=result);self.m.action({'action':'clear_done'})
  plan_store.endpoint(server,{'action':'draft','projectId':self.p['projectId'],'id':row['id'],'segments':[{'title':'stale invalid draft'}]})
  with patch.object(server,'ai_call',side_effect=AssertionError('no inference')):
   data=plan_store.endpoint(server,{'action':'reparse','projectId':self.p['projectId'],'id':row['id'],'raw':json.dumps(self.source())})
  self.assertEqual(len(data['plan']['segments']),2);self.assertIsNone(data['draft'])
 def test_duration_order_changes_and_source_guard(self):
  row,_=self.archived();self.m.action({'action':'clear_done'});result=plan_store.get(server,row['id'])['result'];edits=list(reversed(result['segments']));edits[0]['duration']=7;edits[0]['shots'][0]['end']=7
  checked=writing.validate_edits(server,result,edits);self.assertEqual(checked['segments'][0]['duration'],7)
  p=server.load_project();p['title']='修改后工程';server.save(p)
  out=plan_store.endpoint(server,{'action':'apply','projectId':p['projectId'],'id':row['id'],'segments':edits,'acceptSourceChanges':True})
  self.assertEqual(out['project']['segments'][-2]['title'],'1');self.assertEqual(out['project']['segments'][-2]['duration'],7)
 def test_cross_project_guard_and_explicit_aspect_change(self):
  row,_=self.archived();self.m.action({'action':'clear_done'});record=plan_store.get(server,row['id']);record['result']['aspectRatio']='9:16';plan_store.write(server,record);edits=record['result']['segments']
  kept=plan_store.endpoint(server,{'action':'apply','projectId':self.p['projectId'],'id':row['id'],'segments':edits});self.assertEqual(kept['project']['aspect'],self.p['aspect']);self.assertTrue(kept['warnings'])
  row,_=self.archived();record=plan_store.get(server,row['id']);record['result']['aspectRatio']='9:16';plan_store.write(server,record);edits=record['result']['segments']
  out=plan_store.endpoint(server,{'action':'apply','projectId':self.p['projectId'],'id':row['id'],'segments':edits,'acceptAspectChange':True});self.assertEqual(out['project']['aspect'],'9:16')
  server.save(server.blank_project())
  with self.assertRaises(ValueError):plan_store.endpoint(server,{'projectId':self.p['projectId'],'id':row['id']})
 def test_options_and_density_reach_model_snapshot(self):
  server.save_settings({'ai':{'provider':'ollama','endpoint':'http://localhost:11434','model':'test'}})
  row=writing.enqueue(server,{'projectId':self.p['projectId'],'story':'两个片段','count':2,'duration':5,'aspectRatio':'21:9','visualTone':'film','shotDensity':'long'})
  snap=self.m.input(self.m.get(row['id']));self.assertEqual(snap['aspectRatio'],'21:9');self.assertEqual(snap['shotDensity'],'long')
  with patch.object(server,'ai_call',return_value=json.dumps(self.source())) as model:writing.analyze(server,{},snap,{})
  self.assertIn('21:9',model.call_args.args[1][0]['content']);self.assertIn('高反差',json.loads(model.call_args.args[1][1]['content'])['visualToneInstruction'])

 def test_worker_archives_result_before_task_cleanup(self):
  snap=self.snap();snap['modelResponse']=json.dumps(self.source());snap['target']={'kind':'project'}
  row=self.m.add('story',{'projectId':self.p['projectId']},{},snap)
  with patch.object(server,'ai_call',side_effect=AssertionError('no inference')):self.m.execute_locked(row)
  self.assertEqual(self.m.get(row['id'])['status'],'done')
  self.assertIn(row['id'],server.load_project()['planArchive'])
  self.assertEqual(len(plan_store.get(server,row['id'])['result']['segments']),2)
 def test_archive_attachment_survives_cleanup_without_director_pack_leak(self):
  row,snap=self.archived('agent');snap['attachment']=agent.picture({'name':'private.png','data':'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lV4AAAAASUVORK5CYII='})
  self.m.store_input(row['id'],snap);self.m.action({'action':'clear_done'})
  image=agent.planning_attachment(server,server.load_project(),row['id'])
  self.assertEqual(image['name'],'private.png')
  import io,zipfile
  data=server.export_pack(server.load_project(),force=True)
  with zipfile.ZipFile(io.BytesIO(data)) as archive:
   side=json.loads(archive.read('storyboard.json'))
   self.assertNotIn('planArchive',side);self.assertNotIn('private.png',archive.namelist())
 def test_local_archive_overrides_stale_imported_applied_flag(self):
  row,_=self.archived();self.m.action({'action':'clear_done'});p=server.load_project();record=plan_store.get(server,row['id']);record['appliedAt']=123;plan_store.write(server,record)
  server.save(p);self.assertEqual(server.load_project()['planArchive'][row['id']]['appliedAt'],123)

 def test_warnings_apply_without_reinference_and_keep_original(self):
  row,_=self.archived();record=plan_store.get(server,row['id']);record['result']['segments'][0]['shots'][0].update(startState='',endState='',referenceNumbers=[]);record['result']['warnings']=[{'message':'旧警告'}];plan_store.write(server,record)
  with patch.object(server,'ai_call',side_effect=AssertionError('no model')):
   out=plan_store.endpoint(server,{'action':'apply','projectId':self.p['projectId'],'id':row['id'],'segments':record['result']['segments']})
  self.assertEqual(out['created'],2);self.assertTrue(out['warnings']);self.assertEqual(out['project']['segments'][-2]['shots'][0]['dialogue'],'你好')
 def test_exact_image_reimport_refreshes_binding_but_different_image_never_guessed(self):
  p=server.load_project();p['assets']=[{'id':'old','name':'店员','pictureNumber':5,'kind':'人物','scope':'public','path':'reference.png'}];p['media']={'reference.png':'same-image-bytes'};server.save(p)
  row,_=self.archived();record=plan_store.get(server,row['id']);old=server.load_project();ref={'id':'old','name':'店员','number':5,'sourceHash':writing.digest({k:old['assets'][0].get(k) for k in ['id','path','description','kind']}),'mediaHash':writing.digest('same-image-bytes')};record['result']['references']=[ref];record['result']['segments'][0]['shots'][0].update(action='@Picture 5 走近',referenceNumbers=[5]);plan_store.write(server,record)
  p=server.load_project();p['assets'][0]['deleted']=True;p['assets'].append({'id':'new','name':'店员','pictureNumber':7,'kind':'人物','scope':'public','path':'new.png'});p['media']['new.png']='same-image-bytes';server.save(p)
  live=plan_store.endpoint(server,{'projectId':p['projectId'],'id':row['id']})['plan'];self.assertEqual(live['segments'][0]['shots'][0]['referenceNumbers'],[7]);self.assertEqual(live['references'][0]['id'],'new')
  p['media']['new.png']='different-image';server.save(p);live=plan_store.endpoint(server,{'projectId':p['projectId'],'id':row['id']})['plan'];self.assertTrue(live['missingReferences']);self.assertEqual(live['segments'][0]['shots'][0]['referenceNumbers'],[5])
  edits=copy.deepcopy(live['segments']);edits[0]['shots'][0]['referenceNumbers']=[7]
  with patch.object(server,'ai_call',side_effect=AssertionError('no model')):out=plan_store.endpoint(server,{'action':'apply','projectId':p['projectId'],'id':row['id'],'segments':edits})
  self.assertEqual(out['project']['segments'][-2]['shots'][0]['assetIds'],['new']);self.assertTrue(out['warnings'])
 def test_empty_closing_note_and_agent_duration_repair(self):
  plan={'duration':30,'segments':[{'title':'第一段','duration':30,'shots':[{'start':0,'end':10}]},{'title':'本段为第3段收尾','duration':30,'shots':[]}]}
  fixed=writing.normalize_plan_structure(plan,True);self.assertEqual(len(fixed['segments']),1);self.assertEqual(fixed['segments'][0]['duration'],10);self.assertEqual(len(plan['segments']),2)
