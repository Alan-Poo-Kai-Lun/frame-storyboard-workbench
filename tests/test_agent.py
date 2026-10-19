import copy,json,tempfile,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import server,agent_backend as agent,writing_backend as writing

class AgentChecks(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.old=server.DATA,server.STATE,server.CONFIG
  server.DATA=Path(self.temp.name);server.STATE=server.DATA/'project.json';server.CONFIG=server.DATA/'settings.json'
  self.p=server.blank_project();seg=self.p['segments'][0];seg['shots']=[{'id':'shot','start':0,'end':15,'action':'站在门口','camera':'固定','expression':'平静','dialogue':'你好','sound':'风声','startState':'门口','endState':'门口','image':'keep.png'}];self.p['media']={'keep.png':'YWJj'};server.save(self.p)
  self.target={'kind':'shot','segmentId':seg['id'],'shotId':'shot'}
  self.snap={'target':self.target,'signature':writing.signature(server.load_project()),'preserveDialogue':True,'context':agent.project_context(server,self.p),'message':'改善动作，保留对白','history':[],'rules':[],'image':None,'attachment':None,'addToLibrary':False,'maxCalls':3}
  self.row={'id':'agent','type':'agent','status':'done','projectId':self.p['projectId']};self.saved={}
  self.manager=SimpleNamespace(get=lambda i:copy.deepcopy(self.row),input=lambda r:copy.deepcopy(self.saved or self.snap),store_input=lambda i,v:self.store(v),patch=lambda i,**v:self.row.update(v))
 def store(self,v):self.saved=copy.deepcopy(v)
 def tearDown(self):server.DATA,server.STATE,server.CONFIG=self.old;self.temp.cleanup()
 def proposal(self):return [{'target':self.target,'fields':{'action':'抬头看向门外'}}]
 def test_scope_and_dialogue_protection(self):
  self.assertEqual(agent.checked_changes(server,self.p,self.snap,self.proposal())[0]['before']['action'],'站在门口')
  for change in [{'target':{'kind':'project'},'fields':{'title':'越权'}},{'target':self.target,'fields':{'dialogue':'新台词'}},{'target':self.target,'fields':{'end':12}},{'target':self.target,'fields':{'action':'@Picture 99'}}]:
   with self.assertRaises(ValueError):agent.checked_changes(server,self.p,self.snap,[change])
 def test_tool_loop_and_history_scopes(self):
  responses=[json.dumps({'tool':'read_project','args':{}}),json.dumps({'reply':'动作修改建议','changes':self.proposal()},ensure_ascii=False)]
  with patch('task_backend.manager',return_value=self.manager),patch.object(server,'ai_call',side_effect=responses) as call:
   result=agent.analyze(server,{'provider':'openai'},self.snap,{'_taskId':'agent'})
  self.assertEqual(result['calls'],2);self.assertEqual(result['trace'][0]['tool'],'read_project');self.assertIn('工具执行结果',call.call_args.args[1][-1]['content'])
  info=agent.info(server,{'projectId':self.p['projectId'],'target':self.target});self.assertEqual(info['messages'][0]['content'],'动作修改建议')
  self.assertEqual(agent.info(server,{'projectId':self.p['projectId'],'target':{'kind':'project'}})['messages'],[])
 def test_apply_undo_preserves_media_and_checks_stale(self):
  self.row['result']={'signature':self.snap['signature'],'changes':agent.checked_changes(server,self.p,self.snap,self.proposal())}
  with patch('task_backend.manager',return_value=self.manager):
   updated=agent.apply(server,{'id':'agent'})['project'];self.assertEqual(updated['segments'][0]['shots'][0]['action'],'抬头看向门外');self.assertEqual(updated['segments'][0]['shots'][0]['image'],'keep.png');self.assertEqual(updated['media'],self.p['media'])
   with self.assertRaises(ValueError):agent.apply(server,{'id':'agent'})
   restored=agent.undo(server,{'id':'agent'})['project'];self.assertEqual(restored['segments'],self.p['segments']);self.assertEqual(restored['media'],self.p['media'])
 def test_stale_result_cannot_overwrite_edits(self):
  self.row['result']={'signature':self.snap['signature'],'changes':agent.checked_changes(server,self.p,self.snap,self.proposal())};p=server.load_project();p['title']='用户的新标题';server.save(p)
  with patch('task_backend.manager',return_value=self.manager):
   with self.assertRaises(ValueError):agent.apply(server,{'id':'agent'})
  self.assertEqual(server.load_project()['title'],'用户的新标题')
 def test_unknown_tool_and_call_ceiling(self):
  with patch('task_backend.manager',return_value=self.manager),patch.object(server,'ai_call',return_value=json.dumps({'tool':'shell','args':{}})):
   with self.assertRaisesRegex(ValueError,'未授权'):agent.analyze(server,{},self.snap,{'_taskId':'agent'})
  self.snap['maxCalls']=1
  with patch('task_backend.manager',return_value=self.manager),patch.object(server,'ai_call',return_value=json.dumps({'tool':'read_project'})) as call:
   with self.assertRaisesRegex(ValueError,'次数上限'):agent.analyze(server,{},self.snap,{'_taskId':'agent'})
   self.assertEqual(call.call_count,1)
 def test_image_type_and_private_discussion(self):
  with self.assertRaises(ValueError):agent.picture({'data':'data:image/png;base64,YWJj'})
  raw='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lV4AAAAASUVORK5CYII='
  image=agent.picture({'data':'data:image/png;base64,'+raw,'name':'reference.png'});self.snap['attachment']=image;self.snap['addToLibrary']=True;self.saved=copy.deepcopy(self.snap);self.row['result']={'signature':self.snap['signature'],'changes':[]}
  with patch('task_backend.manager',return_value=self.manager):
   out=agent.apply(server,{'id':'agent'})['project'];self.assertEqual(len(out['assets']),1);self.assertIn(out['assets'][0]['path'],out['media']);restored=agent.undo(server,{'id':'agent'})['project'];self.assertEqual(restored['assets'],self.p['assets']);self.assertEqual(restored['media'],self.p['media'])
 def test_images_use_vision_model_envelope(self):
  self.snap['image']={'b64':'test','mime':'image/png'}
  for provider in ['openai','ollama']:
   with patch('task_backend.manager',return_value=self.manager),patch.object(server,'ai_call',return_value=json.dumps({'reply':'图片有待确认','changes':[]})) as call:
    agent.analyze(server,{'provider':provider},self.snap,{'_taskId':'agent'})
   messages=call.call_args.args[1];user=messages[1]
   self.assertTrue(user.get('images') if provider=='ollama' else user['content'][1]['type']=='image_url')

 def test_topics_are_isolated_renamed_and_recoverable(self):
  pid=self.p['projectId'];body={'projectId':pid,'target':self.target}
  legacy=agent.info(server,body)['threadId'];agent.store_chat(server,pid,legacy,{'role':'user','content':'旧话题'})
  other=agent.thread_action(server,{**body,'action':'create'})['threadId'];agent.store_chat(server,pid,other,{'role':'user','content':'新话题'})
  self.assertEqual(agent.info(server,{**body,'threadId':other})['messages'][0]['content'],'新话题')
  self.assertEqual(agent.info(server,body)['messages'][0]['content'],'旧话题')
  agent.thread_action(server,{**body,'action':'rename','threadId':other,'title':'另一个方案'})
  self.manager.snapshot=lambda:[]
  with patch('task_backend.manager',return_value=self.manager):agent.thread_action(server,{**body,'action':'delete','threadId':other})
  self.assertTrue(agent.info(server,{**body,'threadId':other})['deleted'])
  with self.assertRaises(ValueError):agent.conversation(server,self.p,self.target,other)
  agent.thread_action(server,{**body,'action':'restore','threadId':other})
  info=agent.info(server,{**body,'threadId':other});self.assertFalse(info['deleted']);self.assertEqual(info['messages'][0]['content'],'新话题');self.assertEqual(next(t for t in info['threads'] if t['id']==other)['title'],'另一个方案')
  with self.assertRaises(ValueError):agent.info(server,{**body,'target':{'kind':'project'},'threadId':other})
 def test_deleted_target_history_is_readable_but_cannot_send(self):
  pid=self.p['projectId'];body={'projectId':pid,'target':self.target};key=agent.info(server,body)['threadId'];agent.store_chat(server,pid,key,{'role':'assistant','content':'原节点方案'})
  p=server.load_project();p['segments']=[];server.save(p)
  info=agent.info(server,body);self.assertFalse(info['targetExists']);self.assertEqual(info['messages'][0]['content'],'原节点方案')
  with self.assertRaisesRegex(ValueError,'已不存在'):agent.enqueue(server,{**body,'message':'改动作'})
 def test_topic_delete_cancels_only_its_own_pending_tasks(self):
  body={'projectId':self.p['projectId'],'target':{'kind':'project'}};key=agent.info(server,body)['threadId'];cancelled=[]
  rows=[{'id':'own','type':'agent','projectId':self.p['projectId'],'scopeKey':key,'status':'running'},{'id':'other','type':'agent','projectId':'another','scopeKey':key,'status':'waiting'}]
  with patch('task_backend.manager',return_value=SimpleNamespace(snapshot=lambda:rows,action=lambda v:cancelled.append(v))):agent.thread_action(server,{**body,'action':'delete','threadId':key})
  self.assertEqual(cancelled,[{'id':'own','action':'cancel'}])
 def test_plan_carries_attachment_only_on_explicit_confirmation(self):
  image=agent.picture({'name':'产品.png','data':'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lV4AAAAASUVORK5CYII='})
  source={'id':'source','type':'agent','status':'done','projectId':self.p['projectId']};stored={'attachment':image};snaps=[]
  manager=SimpleNamespace(get=lambda ident:source,input=lambda row:stored,add=lambda kind,payload,cfg,snap:(snaps.append(copy.deepcopy(snap)) or {'id':'planned'}))
  with patch('task_backend.manager',return_value=manager),patch.object(server,'settings',return_value={'ai':{'model':'test','endpoint':'http://local'}}):writing.enqueue(server,{'projectId':self.p['projectId'],'story':'展示产品','count':1,'duration':5,'sourceAgentTaskId':'source'})
  snap=snaps[0];self.assertEqual(server.load_project()['assets'],[]);self.assertEqual(snap['refs'][0]['number'],1)
  result=writing.validate(server,{'segments':[{'title':'产品展示','story':'@Picture 1 在桌上','shots':[{'start':0,'end':5,'action':'@Picture 1 保持正面','references':[1],'camera':'缓慢推近','startState':'产品在桌上','endState':'产品仍在桌上'}]}]},snap)
  story={'id':'planned','type':'story','status':'done','projectId':self.p['projectId'],'result':result};manager.get=lambda ident:story;manager.input=lambda row:snap;manager.patch=lambda *args,**kw:None
  with patch('task_backend.manager',return_value=manager):out=writing.apply(server,{'id':'planned','segments':[{'title':'产品展示','storyText':'@Picture 1 在桌上'}]})['project']
  self.assertEqual(len(out['assets']),1);self.assertEqual(out['media'][out['assets'][0]['path']],image['b64'])
  roundtrip=server.readzip(server.export_pack(out,force=True));self.assertTrue(any(v==image['b64'] for v in roundtrip['media'].values()))
  self.assertEqual(len(roundtrip['assets']),1)
 def test_attachment_deduplication_reuses_number(self):
  image={'name':'产品.png','mime':'image/png','b64':'unique'};p=copy.deepcopy(self.p)
  a,created=agent.add_attachment(server,p,image);b,created_again=agent.add_attachment(server,p,image)
  self.assertTrue(created);self.assertFalse(created_again);self.assertEqual(a['id'],b['id']);self.assertEqual(len(p['assets']),1)

 def test_send_context_only_reads_selected_topic(self):
  body={'projectId':self.p['projectId'],'target':self.target};old=agent.info(server,body)['threadId'];new=agent.thread_action(server,{**body,'action':'create'})['threadId']
  agent.store_chat(server,self.p['projectId'],old,{'role':'user','content':'不应泄漏的旧话题'});agent.store_chat(server,self.p['projectId'],new,{'role':'user','content':'当前话题背景'})
  snaps=[];manager=SimpleNamespace(snapshot=lambda:[],add=lambda kind,payload,cfg,snap:(snaps.append(copy.deepcopy(snap)) or {'id':'new-task'}),patch=lambda *args,**kw:None)
  with patch('task_backend.manager',return_value=manager),patch.object(server,'settings',return_value={'ai':{'model':'test','endpoint':'http://local'}}):agent.enqueue(server,{**body,'threadId':new,'message':'继续当前话题'})
  self.assertEqual(snaps[0]['history'],[{'role':'user','content':'当前话题背景'}]);self.assertEqual(snaps[0]['threadId'],new)
 def test_planning_attachment_opt_out_and_project_guard(self):
  snaps=[];manager=SimpleNamespace(add=lambda kind,payload,cfg,snap:(snaps.append(copy.deepcopy(snap)) or {'id':'t'}),get=lambda ident:{'type':'agent','status':'done','projectId':'other-project'})
  with patch('task_backend.manager',return_value=manager),patch.object(server,'settings',return_value={'ai':{'model':'test','endpoint':'http://local'}}):
   writing.enqueue(server,{'projectId':self.p['projectId'],'story':'仅文字方案','count':1,'duration':5,'sourceAgentTaskId':'source','includeAgentImage':False})
   self.assertNotIn('plannedAttachment',snaps[0])
   with self.assertRaisesRegex(ValueError,'当前项目'):writing.enqueue(server,{'projectId':self.p['projectId'],'story':'方案','count':1,'duration':5,'sourceAgentTaskId':'source'})
  self.assertEqual(server.load_project()['assets'],[])
