import copy,json,tempfile,threading,time,unittest
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from unittest.mock import patch
import server;from backend.services import agent_backend as agent;from backend.services import writing_backend as writing;from backend.project import plan_store;from backend.services import task_backend

class ScopedAgentChecks(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.old=server.DATA,server.STATE,server.CONFIG
  server.DATA=Path(self.tmp.name);server.STATE=server.DATA/'project.json';server.CONFIG=server.DATA/'settings.json'
  (server.DATA/'tasks.json').write_text(json.dumps({'paused':True,'tasks':[]}))
  self.p=server.blank_project();self.p['segments'].append(copy.deepcopy(self.p['segments'][0]));self.p['segments'][1]['id']=server.uid()
  self.p['segments'][0]['shots']=[{'id':server.uid(),'start':0,'end':15,'action':'站立','dialogue':'','startState':'','endState':''}];server.save(self.p);self.m=task_backend.manager(server);self.target={'kind':'segment','segmentId':self.p['segments'][0]['id']}
  self.snap={'target':self.target,'signature':writing.signature(self.p),'message':'为当前片段规划镜头','context':agent.project_context(server,self.p),'rules':[],'preserveDialogue':True,'maxCalls':1,'history':[]}
  self.source={'duration':15,'segments':[{'title':'局部分镜','story':'走向门口','shots':[{'start':0,'end':7,'action':'走向门口','camera':'固定中景','startState':'站在椅旁','endState':'到达门口','references':[]},{'start':7,'end':15,'action':'在门口停下','camera':'固定中景','startState':'到达门口','endState':'面向室内停下','references':[]}]}]}
 def tearDown(self):
  server.DATA,server.STATE,server.CONFIG=self.old;self.tmp.cleanup()
 def test_segment_preview_applies_only_current_segment(self):
  plan=agent.checked_story_plan(server,self.p,self.snap,self.source)
  row=self.m.add('agent',{'projectId':self.p['projectId'],'segmentId':self.target['segmentId']},{},self.snap)
  result={'reply':'局部方案','changes':[],'signature':self.snap['signature'],'target':self.target,'storyPlan':plan,'storyPlanSource':self.source}
  self.m.patch(row['id'],status='done',result=result);plan_store.put(server,self.m.get(row['id']),self.snap)
  before=copy.deepcopy(server.load_project());preview=plan_store.endpoint(server,{'projectId':self.p['projectId'],'id':row['id']})
  self.assertEqual(server.load_project(),before);self.assertEqual(preview['plan']['applyTarget'],self.target)
  out=plan_store.endpoint(server,{'action':'apply','projectId':self.p['projectId'],'id':row['id'],'segments':preview['plan']['segments']})
  self.assertEqual(out['created'],0);self.assertEqual(out['updatedSegmentId'],self.target['segmentId'])
  self.assertEqual(len(out['project']['segments']),2);self.assertEqual(out['project']['segments'][1],before['segments'][1])
  self.assertEqual(len(out['project']['segments'][0]['shots']),2);self.assertTrue(out['project']['segments'][0]['prompt'])
  with self.assertRaises(ValueError):plan_store.endpoint(server,{'action':'apply','projectId':self.p['projectId'],'id':row['id'],'segments':preview['plan']['segments']})
 def test_scoped_plan_rejects_other_segments_duration_and_changed_project(self):
  for source in [{**self.source,'segments':self.source['segments']*2},{**self.source,'duration':10}]:
   with self.assertRaises(ValueError):agent.checked_story_plan(server,self.p,self.snap,source)
 def test_first_call_contains_spatial_states_without_media(self):
  self.snap['context']['segments'][0]['shots'][0].update(startState='左侧站立，右手持剑',endState='门口面向北',image='PRIVATE_BASE64_SENTINEL')
  captured=[]
  def call(cfg,messages,mode):
   captured.extend(messages);return json.dumps({'reply':'先核对空间','changes':[]})
  with patch.object(server,'ai_call',side_effect=call):agent.analyze(server,{},self.snap,{'_taskId':'context-test'})
  payload=json.loads(captured[1]['content']);self.assertEqual(payload['continuityContext']['currentSegment']['shots'][0]['endState'],'门口面向北')
  self.assertNotIn('PRIVATE_BASE64_SENTINEL',json.dumps(captured));self.assertIn('15 秒',captured[2]['content'])
 def test_partial_five_seconds_cannot_shorten_segment(self):
  source=copy.deepcopy(self.source);source['segments'][0]['shots']=source['segments'][0]['shots'][:1];source['segments'][0]['shots'][0]['end']=5
  with self.assertRaisesRegex(ValueError,'只覆盖到 5'):agent.checked_story_plan(server,self.p,self.snap,source,recover=True)
 def test_segment_prose_without_segment_heading_uses_locked_duration(self):
  text='**镜头1（0–5s）**：画面：向门口走。\n**镜头2（5–15s）**：画面：在门口停下。'
  source=agent.scoped_story_source({'reply':text},self.snap)
  plan=agent.checked_story_plan(server,self.p,self.snap,source,recover=True)
  self.assertEqual(plan['duration'],15);self.assertEqual(plan['segments'][0]['duration'],15);self.assertEqual(plan['segments'][0]['shots'][-1]['end'],15)
 def test_incomplete_response_repaired_within_call_budget(self):
  self.snap['maxCalls']=2;responses=[json.dumps({'reply':'镜头1（0–5s）：画面：走向门口','changes':[]}),json.dumps({'reply':'完整15秒方案','changes':[],'storyPlan':self.source})]
  with patch.object(server,'ai_call',side_effect=responses) as call:
   result=agent.analyze(server,{},self.snap,{'_taskId':'repair-test'})
  self.assertEqual(call.call_count,2);self.assertEqual(result['storyPlan']['segments'][0]['duration'],15)
 def test_neighbor_and_cross_segment_context(self):
  rows=self.snap['context']['segments'];rows[0]['shots'][-1]['endState']='塔顶持剑'
  ctx=agent.continuity_context(self.snap['context'],{'kind':'segment','segmentId':rows[1]['id']})
  self.assertEqual(ctx['previousSegmentEnd']['endState'],'塔顶持剑')

class CancellationChecks(unittest.TestCase):
 def test_stop_before_headers_and_during_stream(self):
  for streaming in [False,True]:
   with self.subTest(streaming=streaming):self.exercise(streaming)
 def exercise(self,streaming):
  tmp=tempfile.TemporaryDirectory();old=server.DATA,server.STATE,server.CONFIG
  server.DATA=Path(tmp.name);server.STATE=server.DATA/'project.json';server.CONFIG=server.DATA/'settings.json'
  (server.DATA/'tasks.json').write_text(json.dumps({'paused':True,'tasks':[]}));p=server.blank_project();server.save(p)
  entered=threading.Event();release=threading.Event();errors=[]
  class Handler(BaseHTTPRequestHandler):
   def log_message(self,*args):pass
   def do_POST(self):
    self.rfile.read(int(self.headers['Content-Length']))
    if streaming:
     self.send_response(200);self.send_header('Content-Type','text/event-stream');self.end_headers()
     self.wfile.write(b'data: {"choices":[{"delta":{"content":"a"}}]}\n\n');self.wfile.flush()
    entered.set();release.wait(5)
  http=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=http.serve_forever,daemon=True).start()
  m=task_backend.manager(server);cfg={'provider':'openai','endpoint':f'http://127.0.0.1:{http.server_port}','model':'mock','autoUnload':False}
  row=m.add('agent',{'projectId':p['projectId']},cfg,{});m.patch(row['id'],status='running')
  def inference():
   try:
    with server.ai_session(row['id']):server.ai_call(cfg,[{'role':'user','content':'hello'}],True)
   except Exception as e:errors.append(str(e))
  worker=threading.Thread(target=inference,daemon=True)
  try:
   worker.start();self.assertTrue(entered.wait(2));start=time.monotonic();m.action({'action':'cancel','id':row['id']})
   worker.join(2);
   self.assertFalse(worker.is_alive());self.assertLess(time.monotonic()-start,2)
   self.assertEqual(m.get(row['id'])['status'],'cancelled');self.assertTrue(errors)
   m.patch(row['id'],status='done',result={'late':'discard'});self.assertEqual(m.get(row['id'])['status'],'cancelled')
  finally:
   release.set();worker.join(3);http.shutdown();http.server_close();server.DATA,server.STATE,server.CONFIG=old;tmp.cleanup()

if __name__=='__main__':unittest.main()
