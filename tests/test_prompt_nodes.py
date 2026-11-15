import copy,json,unittest
from unittest.mock import patch
import server
import test_plan_archive as fixture
from backend.ai import prompt_nodes as n

class PromptNodeChecks(unittest.TestCase):
 def setUp(self):
  self.f=fixture.PlanArchiveChecks();self.f.setUp();self.addCleanup(self.f.tearDown)
  p=server.load_project();s=p['segments'][0];s.update(dialogueLanguage='Malay',shots=[{'id':'s1','start':0,'end':5,'action':'Person waves','camera':'Fixed medium shot','dialogue':'Hai semua!','startState':'Hand down','endState':'Hand raised'}],duration=5)
  p['segments'].append({**copy.deepcopy(s),'id':'next','shots':[{'id':'s2','start':0,'end':5,'action':'Wait','startState':'Hand raised','endState':'Hand down'}]})
  server.save(p);self.body={'projectId':p['projectId'],'segmentId':s['id'],'nodeId':'h3'};server.CONFIG.write_text(json.dumps({'ai':{'provider':'openai','endpoint':'http://127.0.0.1:9','model':'mock'}}))
 def output(self,snap):return {'summary':'A person waves.','assets':[{'id':a['id'],'description':'Reference appearance'} for a in snap['assets']],'shots':[{'id':h['id'],**{k:'A person waves.' for k in n.FIELDS}} for h in snap['segment']['shots']],'checks':['Verify previous ending.']}
 def generate(self,key='h3'):
  body={**self.body,'nodeId':key};q=n.enqueue(server,body);row=self.f.m.get(q['id']);snap=self.f.m.input(row)
  with patch.object(server,'ai_call',return_value=json.dumps(self.output(snap))) as call:self.f.m.execute_locked(row)
  call.assert_called_once();row=self.f.m.get(q['id']);self.assertEqual(row['status'],'done',row.get('error'));return body,row,snap
 def test_actual_queue_preserves_source_and_inserts_exact_dialogue(self):
  before=server.load_project();body,row,snap=self.generate();self.assertEqual(server.load_project(),before);self.assertEqual(snap['nextStart']['startState'],'Hand raised');self.assertIn('[Malay] Hai semua!',row['result']['prompt'])
  meta=n.info(server,body);p=n.save(server,{**body,'taskId':row['id'],'revision':meta['revision']})['project'];self.assertEqual(p['segments'][0]['shots'],before['segments'][0]['shots']);self.assertFalse(n.info(server,body)['stale'])
 def test_independent_outputs_history_and_adjacent_staleness(self):
  body,row,_=self.generate();n.save(server,{**body,'taskId':row['id'],'revision':n.info(server,body)['revision']});meta=n.info(server,body)
  n.save(server,{**body,'prompt':'manual','revision':meta['revision']});self.assertEqual(len(n.info(server,body)['state']['history']),1)
  seed,srow,_=self.generate('seedance');n.save(server,{**seed,'taskId':srow['id'],'revision':n.info(server,seed)['revision']});self.assertEqual(n.info(server,body)['state']['prompt'],'manual');self.assertFalse(n.info(server,body)['stale'])
  p=server.load_project();p['segments'][1]['shots'][0]['startState']='Moved';server.save(p);self.assertTrue(n.info(server,body)['stale']);self.assertTrue(n.info(server,seed)['stale'])
 def test_task_result_cannot_overwrite_concurrent_edit(self):
  body,row,_=self.generate();meta=n.info(server,body);n.save(server,{**body,'prompt':'keep edit','revision':meta['revision']})
  with self.assertRaisesRegex(ValueError,'已改变'):n.save(server,{**body,'taskId':row['id'],'revision':n.info(server,body)['revision']})
 def test_skill_is_text_only_and_dependencies_required(self):
  with self.assertRaises(ValueError):n.clean_files([{'name':'SKILL.md','text':'read `references/a.md`'}])
  with self.assertRaises(ValueError):n.clean_files([{'name':'../SKILL.md','text':'bad'}])
  with self.assertRaises(ValueError):n.clean_files([{'name':'SKILL.md','text':'ok'},{'name':'run.py','text':'execute'}])
  doc=n.import_template(server,{**self.body,'name':'My format','files':[{'name':'SKILL.md','text':'read `references/a.md`'},{'name':'a.md','text':'Only text'}]});key=doc['nodeId'];self.assertIn('references/a.md',doc['project']['promptTemplates'][0]['files']);self.assertEqual(n.info(server,{**self.body,'nodeId':key})['name'],'My format')
 def test_rejects_locked_field_changes_and_incomplete_output(self):
  q=n.enqueue(server,self.body);snap=self.f.m.input(self.f.m.get(q['id']));out=self.output(snap);out['shots'][0]['dialogue']='changed'
  with patch.object(server,'ai_call',return_value=out):
   with self.assertRaisesRegex(ValueError,'受限字段'):n.analyze(server,{'model':'mock'},snap,self.body)
 def test_package_roundtrip_preserves_templates_and_outputs(self):
  n.import_template(server,{**self.body,'name':'My format','files':[{'name':'SKILL.md','text':'My text format'}]});body,row,_=self.generate();p=n.save(server,{**body,'taskId':row['id'],'revision':n.info(server,body)['revision']})['project']
  restored=server.readzip(server.export_pack(p,force=True));self.assertEqual(n.source(server,restored,restored['segments'][0],'h3')[2],p['segments'][0]['promptNodes']['h3']['sourceHash']);self.assertEqual(restored['promptTemplates'],p['promptTemplates']);self.assertEqual(restored['segments'][0]['promptNodes'],p['segments'][0]['promptNodes'])
 def test_timing_must_cover_segment(self):
  p=server.load_project();p['segments'][0]['duration']=15;server.save(p)
  with self.assertRaisesRegex(ValueError,'完整'):n.enqueue(server,self.body)
 def test_unknown_reference_and_custom_dialogue_loss_rejected(self):
  q=n.enqueue(server,self.body);snap=self.f.m.input(self.f.m.get(q['id']));out=self.output(snap);out['shots'][0]['action']='Picture 999 enters.'
  with patch.object(server,'ai_call',return_value=out):
   with self.assertRaisesRegex(ValueError,'未绑定'):n.analyze(server,{'model':'mock'},snap,self.body)
  snap['nodeId']='custom-test';out=self.output(snap);out['customPrompt']='No original dialogue'
  with patch.object(server,'ai_call',return_value=out):
   with self.assertRaisesRegex(ValueError,'对白'):n.analyze(server,{'model':'mock'},snap,self.body)
 def test_confirmed_h3_is_exported_and_stale_result_is_blocked(self):
  body,row,_=self.generate();p=n.save(server,{**body,'taskId':row['id'],'revision':n.info(server,body)['revision']})['project'];self.assertEqual(p['segments'][0]['promptOutputSource'],'original');p=n.choose_output(server,{**body,'source':'h3'})['project'];self.assertEqual(server.scoped_prompt(p,p['segments'][0]),row['result']['prompt'])
  p['segments'][1]['shots'][0]['startState']='different'
  with self.assertRaisesRegex(ValueError,'过期'):server.scoped_prompt(p,p['segments'][0])



 def test_empty_manual_result_is_rejected(self):
  meta=n.info(server,self.body)
  with self.assertRaisesRegex(ValueError,'不能为空'):n.save(server,{**self.body,'revision':meta['revision'],'prompt':'  '})
 def test_public_task_has_converter_node_id(self):
  body,row,snap=self.generate('seedance')
  public=next(r for r in self.f.m.public()['tasks'] if r['id']==row['id'])
  self.assertEqual(public['nodeId'],'seedance')
  self.assertNotIn('payload',public);self.assertNotIn('config',public)

 def test_sparse_number_uses_stable_id_and_schema(self):
  p=server.load_project();a={'id':'active-image','name':'Active image','kind':'人物','path':'media/test.png','mediaType':'image','scope':'public','pictureNumber':7,'description':'A person'};p['assets'].append(a);server.save(p)
  body={**self.body,'nodeId':'seedance'};q=n.enqueue(server,body);snap=self.f.m.input(self.f.m.get(q['id']));out=self.output(snap);out['shots'][0]['action']='[[asset:'+a['id']+']] waves.'
  with patch.object(server,'ai_call',return_value=out) as call:self.f.m.execute_locked(self.f.m.get(q['id']))
  row=self.f.m.get(q['id']);self.assertEqual(row['status'],'done',row.get('error'));self.assertIn('@Image1 waves.',row['result']['prompt']);self.assertNotIn('@Image7',row['result']['prompt'])
  self.assertIn('_jsonSchema',call.call_args.args[0]);self.assertEqual(call.call_args.args[0]['_jsonSchema']['properties']['shots']['items']['properties']['action']['maxLength'],1600)
 def test_rejected_output_retained_with_field_location(self):
  q=n.enqueue(server,self.body);snap=self.f.m.input(self.f.m.get(q['id']));out=self.output(snap);out['shots'][0]['camera']=['invalid array']
  with patch.object(server,'ai_call',return_value=out):self.f.m.execute_locked(self.f.m.get(q['id']))
  row=self.f.m.get(q['id']);self.assertEqual(row['status'],'error');self.assertIn('camera',row['error']);self.assertEqual(row['rejectedOutput'],out);self.assertFalse(server.load_project()['segments'][0].get('promptNodes'))
 def test_deleted_assets_excluded_and_current_map_contiguous(self):
  p=server.load_project();a={'id':'active-image','name':'Active image','kind':'人物','path':'media/test.png','mediaType':'image','scope':'public','pictureNumber':7,'description':'A person'};p['assets'].append(a);deleted=copy.deepcopy(a);deleted.update(id='deleted',deleted=True,pictureNumber=1);p['assets'].append(deleted);server.save(p)
  meta=n.info(server,self.body);self.assertNotIn('deleted',[a['assetId'] for a in meta['referenceMap']]);self.assertEqual(meta['referenceMap'][0]['original'],7);self.assertEqual(meta['referenceMap'][0]['output'],1)

class PromptRecoveryChecks(unittest.TestCase):
 setUp=PromptNodeChecks.setUp
 output=PromptNodeChecks.output
 generate=PromptNodeChecks.generate
 def test_fenced_json_is_accepted_without_rewriting_content(self):
  q=n.enqueue(server,self.body);row=self.f.m.get(q['id']);snap=self.f.m.input(row)
  with patch.object(server,'ai_call',return_value='```json\n'+json.dumps(self.output(snap))+'\n```'):self.f.m.execute_locked(row)
  row=self.f.m.get(q['id']);self.assertEqual(row['status'],'done',row.get('error'))
 def test_original_prompt_still_available_with_stale_adapter(self):
  body,row,_=self.generate();p=n.save(server,{**body,'taskId':row['id'],'revision':n.info(server,body)['revision']})['project']
  p=n.choose_output(server,{**body,'source':'h3'})['project']
  p['segments'][1]['shots'][0]['startState']='Changed neighbor'
  with self.assertRaisesRegex(ValueError,'过期'):server.scoped_prompt(p,p['segments'][0])
  self.assertIn('Hai semua!',server.original_scoped_prompt(p,p['segments'][0]))
 def test_seedance_summary_remaps_sparse_number(self):
  p=server.load_project();p['assets']=[{'id':'p7','name':'Person','kind':'人物','pictureNumber':7,'path':'a.png','scope':'public'}];server.save(p)
  q=n.enqueue(server,{**self.body,'nodeId':'seedance'});snap=self.f.m.input(self.f.m.get(q['id']));out=self.output(snap);out['summary']='[[asset:p7]] waves.'
  with patch.object(server,'ai_call',return_value=out):self.f.m.execute_locked(self.f.m.get(q['id']))
  row=self.f.m.get(q['id']);self.assertEqual(row['status'],'done',row.get('error'));self.assertIn('@Image1 waves.',row['result']['prompt']);self.assertNotIn('<Picture 7>',row['result']['prompt'])

 def test_original_export_choice_roundtrip_keeps_adapters(self):
  body,row,_=self.generate();p=n.save(server,{**body,'taskId':row['id'],'revision':n.info(server,body)['revision']})['project']
  self.assertEqual(server.scoped_prompt(p,p['segments'][0]),server.original_scoped_prompt(p,p['segments'][0]))
  p=n.choose_output(server,{**body,'source':'original'})['project'];restored=server.readzip(server.export_pack(p,force=True))
  self.assertEqual(restored['segments'][0]['promptOutputSource'],'original');self.assertEqual(restored['segments'][0]['promptNodes'],p['segments'][0]['promptNodes'])
