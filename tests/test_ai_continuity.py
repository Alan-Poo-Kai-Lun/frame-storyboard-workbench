import copy,json,unittest
from unittest.mock import patch
import server,plan_store,ai_continuity
import test_plan_archive as archive

class AIReviewChecks(unittest.TestCase):
 def setUp(self):
  self.fixture=archive.PlanArchiveChecks();self.fixture.setUp();self.addCleanup(self.fixture.tearDown)
  self.row,_=self.fixture.archived();self.segments=plan_store.get(server,self.row['id'])['result']['segments']
  server.CONFIG.write_text(json.dumps({'ai':{'provider':'openai','endpoint':'http://127.0.0.1:9','model':'mock-review','key':'secret'}}))
 def result(self):
  return {'summary':'审查完成','characters':[],'scenes':[],'states':[{'segment':i,'shot':j,'characters':'人物','position':'门口','facing':'柜台','posture':'站立','heldItems':'无','mainAction':h['action'],'result':'停下','camera':'固定','uncertainties':'UNKNOWN'} for i,s in enumerate(self.segments) for j,h in enumerate(s['shots'])],'issues':[],'changes':[{'segment':0,'shot':0,'field':'startState','before':self.segments[0]['shots'][0]['startState'],'after':'门口，面向柜台','reason':'明确朝向'}]}
 def test_queue_calls_actual_model_function_and_preserves_project(self):
  before=server.load_project();queued=ai_continuity.enqueue(server,{'projectId':before['projectId'],'planId':self.row['id'],'segments':self.segments});row=self.fixture.m.get(queued['id'])
  with patch.object(server,'ai_call',return_value=json.dumps(self.result(),ensure_ascii=False)) as call:self.fixture.m.execute_locked(row)
  call.assert_called_once();done=self.fixture.m.get(row['id']);self.assertEqual(done['status'],'done');self.assertEqual(done['result']['engine'],'ai');self.assertEqual(server.load_project(),before);self.assertNotIn('secret',json.dumps(done['result']));self.assertEqual(done['result']['changes'][0]['before'],self.segments[0]['shots'][0]['startState'])
 def test_invalid_model_patch_is_rejected_not_silently_applied(self):
  obj=self.result();obj['changes'][0]['field']='dialogue';snap={'segments':self.segments,'planId':self.row['id'],'sourceHash':'x','assets':[]}
  with patch.object(server,'ai_call',return_value=json.dumps(obj)):
   with self.assertRaises(ValueError):ai_continuity.analyze(server,{'model':'mock'},snap,{})
 def test_missing_model_and_incomplete_states_fail_without_rule_fallback(self):
  server.CONFIG.write_text(json.dumps({'ai':{}}))
  with self.assertRaises(ValueError):ai_continuity.enqueue(server,{'projectId':self.fixture.p['projectId'],'planId':self.row['id'],'segments':self.segments})
  obj=self.result();obj['states']=[]
  with patch.object(server,'ai_call',return_value=json.dumps(obj)):
   with self.assertRaises(ValueError):ai_continuity.analyze(server,{'model':'mock'},{'segments':self.segments,'planId':self.row['id'],'sourceHash':'x','assets':[]},{})
