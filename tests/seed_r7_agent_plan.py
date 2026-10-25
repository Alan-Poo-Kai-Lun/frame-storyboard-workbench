"""Seed a synthetic old Agent reply in an explicitly isolated QA directory."""
import copy,json,os,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import server,agent_backend as agent,writing_backend as writing,task_backend,plan_store
from test_r7_agent_plan import TEXT
assert os.environ.get('FRAME_DATA_DIR') and server.DATA.name.startswith('qa-') and str(server.DATA).startswith('D:\\Codex\\FRAME\\FRAME-Canvas-R7'),server.DATA
assert not server.STATE.exists(),'Refusing to overwrite an existing QA project'
server.DATA.mkdir(parents=True,exist_ok=True)
(server.DATA/'tasks.json').write_text(json.dumps({'paused':True,'tasks':[]}),'utf-8')
p=server.blank_project();p['title']='R7 旧文字方案复现';server.save(p)
thread=agent.conversation(server,p,{'kind':'project'})
snap={'target':{'kind':'project'},'signature':writing.signature(p),'message':'规划2个连续片段，每段15秒，先给方案供核对','context':agent.project_context(server,p),'rules':[],'preserveDialogue':True,'maxCalls':1,'history':[],'threadId':thread['id'],'modelResponse':json.dumps({'reply':TEXT,'changes':[]},ensure_ascii=False)}
m=task_backend.manager(server);row=m.add('agent',{'projectId':p['projectId']},{},snap)
m.patch(row['id'],status='done',agentThreadId=thread['id'],scopeKey=thread['id'],result={'reply':TEXT,'changes':[],'target':{'kind':'project'},'signature':snap['signature']})
plan_store.put(server,m.get(row['id']),snap)
agent.store_chat(server,p['projectId'],thread['id'],{'role':'assistant','content':TEXT,'taskId':row['id']})
print('Seeded synthetic old reply:',server.DATA)
