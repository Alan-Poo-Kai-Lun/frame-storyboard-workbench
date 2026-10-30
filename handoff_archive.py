"""Portable project-owned notes, conversations and planning archives. No credentials."""
import copy,json,time

PRIVATE={'key','apikey','api_key','authorization','password','token','config','cfg','settings','endpoint','attachment','image','modelresponse'}
def clean(value):
 if isinstance(value,dict):return {k:clean(v) for k,v in value.items() if k.lower() not in PRIVATE and not k.lower().endswith('apikey')}
 if isinstance(value,list):return [clean(v) for v in value]
 return value

def export(s,p,files):
 import agent_backend,plan_store,task_backend
 pid=p['projectId'];prior=p.get('handoff',{})
 chats=agent_backend.read_chats(s).get(pid,prior.get('conversations',{}))
 threads=agent_backend.read_threads(s).get(pid,prior.get('threads',{}))
 records=plan_store.records(s,p);options=p.get('handoffOptions',{})
 reviews={r['id']:{k:copy.deepcopy(r[k]) for k in ['id','type','status','result','title','createdAt','appliedAt'] if k in r} for r in task_backend.manager(s).snapshot() if r.get('projectId')==pid and r.get('type')=='continuity'}
 # Durable archives include model output, draft and application records, never request config.
 value={'version':1,'exportedAt':time.strftime('%Y-%m-%d %H:%M:%S'),'sourceProjectId':pid,
        'conversations':clean(chats) if options.get('agent',True) else {},'threads':clean(threads) if options.get('agent',True) else {},'plans':clean(records) if options.get('planning',True) else {},'reviews':clean(reviews) if options.get('planning',True) else {},
        'notes':copy.deepcopy(p.get('notes') or []) if options.get('notes',True) else [],
        'canvasNotes':copy.deepcopy(p.get('overviewLayout',{}).get('unifiedFlow',{}).get('notes',[])) if options.get('notes',True) else []}
 if len(json.dumps(value,ensure_ascii=False))>12_000_000:raise ValueError('交接记录超过 12MB，请先整理历史记录')
 files['handoff/records.json']=json.dumps(value,ensure_ascii=False,indent=2).encode('utf-8')
 side=json.loads(files['storyboard.json']);side['handoff']=value;side['planArchive']=value['plans'];side.pop('handoffOptions',None)
 if options.get('notes') is False:
  side['notes']=[]
  for key in ['unifiedFlow','reactFlowA']:
   if isinstance(side.get('overviewLayout',{}).get(key),dict):side['overviewLayout'][key]['notes']=[]
 if options.get('planning') is False:side['storyPlans']=[]
 files['storyboard.json']=json.dumps(side,ensure_ascii=False,indent=2).encode('utf-8')
 lines=['# '+p.get('title','项目')+' · 创作交接','', '保留过程记录不保证模型再次生成相同结果。API 密钥及连接配置不包含在包中。','', '## 项目笔记']
 lines.extend(n.get('text','') for n in value['notes'] if isinstance(n,dict))
 lines+=['','## 画布笔记']
 for n in value['canvasNotes']:lines+=['### '+n.get('title','笔记'),n.get('text','')]
 lines+=['','## Agent 对话']
 for ident,messages in value['conversations'].items():
  lines+=['### '+value['threads'].get(ident,{}).get('title',ident)]
  for message in messages:lines+=['**'+str(message.get('role',''))+'** · '+str(message.get('timestamp',message.get('at',''))),str(message.get('content','')),'']
 lines+=['## 规划与审查记录','完整参数、原输出、草稿、应用状态见 records.json。']
 for ident,record in value['plans'].items():lines+=['### '+str(record.get('title',ident)),'```json',json.dumps(record,ensure_ascii=False,indent=2),'```']
 files['handoff/README.md']='\n'.join(lines).encode('utf-8')

def restore(s,p):
 value=p.get('handoff');pid=p.get('projectId')
 if not isinstance(value,dict) or value.get('version')!=1 or not pid:return
 if value.get('restoredProjectId')==pid:return
 import agent_backend,plan_store
 # Merge into a newly imported project only; never replace a current project's chats.
 conversations=value.get('conversations',{});threads=value.get('threads',{});plans=value.get('plans',{})
 if not all(isinstance(v,dict) for v in [conversations,threads,plans]):raise ValueError('交接记录结构无效')
 for messages in conversations.values():
  if not isinstance(messages,list) or any(not isinstance(m,dict) or m.get('role') not in ['user','assistant','system'] or not isinstance(m.get('content',''),str) for m in messages):raise ValueError('交接对话记录无效')
 for topic in threads.values():
  if not isinstance(topic,dict) or not isinstance(topic.get('target'),dict):raise ValueError('交接话题记录无效')
 if len(json.dumps(value))>16_000_000:raise ValueError('交接记录过大')
 path=s.DATA/'agent-conversations.json';doc=agent_backend.read_chats(s)
 if pid not in doc:
  doc[pid]=clean(copy.deepcopy(conversations));path.parent.mkdir(parents=True,exist_ok=True)
  temp=path.with_suffix('.tmp');temp.write_text(json.dumps(doc,ensure_ascii=False),'utf-8');temp.replace(path)
 topics=agent_backend.read_threads(s)
 if pid not in topics:topics[pid]=clean(copy.deepcopy(threads));agent_backend.write_threads(s,topics)
 archive=p.setdefault('planArchive',{})
 for ident,record in clean(plans).items():
  if isinstance(record,dict):record['projectId']=pid;archive.setdefault(ident,record)
 value['restoredProjectId']=pid
