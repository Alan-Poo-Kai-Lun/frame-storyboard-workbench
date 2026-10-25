import copy,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import server,agent_backend as agent,writing_backend as writing,plan_store,task_backend

TEXT='''方案供核对（2个连续片段，每段15秒）：
【片段1 | 开场Hook · 0–15s】
镜头1（0–5s）：中景起幅，人物拿起产品。摄影机：缓慢推进。台词建议：「每天一条。」
镜头2（5–10s）：画面动作：@Picture 1 产品位于桌上。运镜：固定特写。对白：给身体加一道护盾。
镜头3（10–15s）：画面：人物点头。起始状态：站在桌前。结束状态：仍在桌前。
【片段2 | 信任收尾 · 0–15s】
镜头1（0–5s）：产品保持正面。
镜头2（5–10s）：产品包装微距。
镜头3（10–15s）：人物与产品同框。对白：这是我的选择。
'''

class AgentPlanRecoveryChecks(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.old=server.DATA,server.STATE,server.CONFIG
  server.DATA=Path(self.tmp.name);server.STATE=server.DATA/'project.json';server.CONFIG=server.DATA/'settings.json'
  (server.DATA/'tasks.json').write_text(json.dumps({'paused':True,'tasks':[]}))
  self.p=server.blank_project();server.save(self.p);self.m=task_backend.manager(server)
  self.snap={'target':{'kind':'project'},'signature':writing.signature(self.p),'message':'规划2个连续片段，每段15秒，先给方案供核对','context':agent.project_context(server,self.p),'rules':[],'preserveDialogue':True,'maxCalls':1,'history':[]}
 def tearDown(self):self.m.action({'action':'pause'});server.DATA,server.STATE,server.CONFIG=self.old;self.tmp.cleanup()
 def archived(self,reply=TEXT):
  snap=copy.deepcopy(self.snap);snap['modelResponse']=json.dumps({'reply':reply,'changes':[]},ensure_ascii=False)
  row=self.m.add('agent',{'projectId':self.p['projectId']},{},snap)
  self.m.patch(row['id'],status='done',result={'reply':reply,'target':{'kind':'project'},'changes':[],'signature':snap['signature']})
  plan_store.put(server,self.m.get(row['id']),snap);return row['id']
 def test_text_plan_uses_only_explicit_headings_times_and_labels(self):
  source=agent.story_source({'reply':TEXT},self.snap['message']);self.assertEqual(len(source['segments']),2);self.assertEqual(source['duration'],15)
  a,b=source['segments'][0]['shots'][:2];self.assertEqual((a['start'],a['end']),(0,5));self.assertEqual(a['dialogue'],'「每天一条。」');self.assertEqual(a['camera'],'缓慢推进。');self.assertEqual(a['startState'],'')
  self.assertEqual(b['references'],[1]);self.assertEqual(b['dialogue'],'给身体加一道护盾。');self.assertTrue(source['textRecovered'])
 def test_explicit_structured_data_wins_and_never_falls_back_silently(self):
  self.assertEqual(agent.story_source({'reply':TEXT,'storyPlan':{'segments':[]}}),{'segments':[]})
  with self.assertRaises(ValueError):agent.story_source({'reply':'我建议做两个片段，但没有具体镜头或时间。'})
  with self.assertRaises(ValueError):agent.story_source({'reply':'片段1 开场\n镜头1：没有时间'})
 def test_old_reply_preview_cancel_apply_and_duplicate_guard_without_model(self):
  ident=self.archived();before=server.load_project()['segments'];self.m.action({'action':'clear_done'})
  with patch.object(server,'ai_call',side_effect=AssertionError('preview must not call a model')):
   record=plan_store.endpoint(server,{'projectId':self.p['projectId'],'id':ident});self.assertEqual(len(record['plan']['segments']),2)
   self.assertEqual(server.load_project()['segments'],before);self.assertTrue(record['plan']['warnings'])
   record['plan']['segments'][0]['shots'][0]['dialogue']='用户在预览中修改的原文'
   out=plan_store.endpoint(server,{'action':'apply','projectId':self.p['projectId'],'id':ident,'segments':record['plan']['segments']})
   self.assertEqual(out['created'],2);self.assertEqual(out['project']['segments'][:len(before)],before)
   self.assertEqual(out['project']['segments'][-2]['shots'][0]['dialogue'],'用户在预览中修改的原文')
   self.assertTrue(plan_store.endpoint(server,{'projectId':self.p['projectId'],'id':ident})['appliedAt'])
   with self.assertRaisesRegex(ValueError,'已应用'):plan_store.endpoint(server,{'action':'apply','projectId':self.p['projectId'],'id':ident,'segments':record['plan']['segments']})
 def test_unparseable_old_reply_reports_reason_and_keeps_project(self):
  ident=self.archived('片段1 待讨论\n镜头1 还没有时间范围');before=server.load_project()['segments']
  record=plan_store.endpoint(server,{'projectId':self.p['projectId'],'id':ident});self.assertIsNone(record['plan']);self.assertIn('明确的镜头起止时间',record['notice']);self.assertEqual(server.load_project()['segments'],before)
 def test_existing_raw_reply_can_be_reparsed_and_wrong_project_is_rejected(self):
  ident=self.archived('尚未有方案')
  data=plan_store.endpoint(server,{'action':'reparse','projectId':self.p['projectId'],'id':ident,'raw':TEXT});self.assertEqual(len(data['plan']['segments']),2)
  self.assertEqual(plan_store.get(server,ident)['snapshot']['modelResponse'],TEXT)
  with self.assertRaisesRegex(ValueError,'项目已切换'):plan_store.endpoint(server,{'projectId':'another-project','id':ident})
 def test_future_agent_text_reply_is_recovered_and_prompt_requires_structure(self):
  ident=self.archived();snap=self.m.input(self.m.get(ident));responses=json.dumps({'reply':TEXT,'changes':[]},ensure_ascii=False)
  with patch.object(server,'ai_call',return_value=responses) as call:
   result=agent.analyze(server,{'provider':'openai'},snap,{'_taskId':ident})
  self.assertEqual(len(result['storyPlan']['segments']),2);self.assertTrue(result['storyPlanSource']['textRecovered']);self.assertEqual(call.call_count,1)
  self.assertIn('不能只把镜头写在 reply',call.call_args.args[1][0]['content'])
 def test_node_discussion_cannot_create_project_plan(self):
  snap={**self.snap,'target':{'kind':'segment','segmentId':self.p['segments'][0]['id']}}
  with self.assertRaisesRegex(ValueError,'只有项目对话'):agent.checked_story_plan(server,self.p,snap,agent.story_source(TEXT),recover=True)

if __name__=='__main__':unittest.main()
