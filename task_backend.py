"""Serial, durable task queue. Pending work needs manual retry after restart."""
import copy,json,threading,time
_INSTANCES={};_GUARD=threading.Lock()
TERMINAL={'done','error','cancelled','interrupted'}
def now():return time.strftime('%Y-%m-%d %H:%M:%S')
def manager(s):
 key=(str(s.DATA),s.TOKEN)
 with _GUARD:
  if key not in _INSTANCES:_INSTANCES[key]=Manager(s)
  return _INSTANCES[key]
def check_cancel(s,ident):
 m=_INSTANCES.get((str(s.DATA),s.TOKEN))
 if m and m.cancelled(ident):raise RuntimeError('任务已取消；不再回收或写入结果')
def stage(s,ident,label):
 m=_INSTANCES.get((str(s.DATA),s.TOKEN))
 if not m:return
 with m.lock:
  row=next((r for r in m.rows if r['id']==ident),None)
  if not row or row.get('stage')==label:return
  at=int(time.time()*1000);history=row.setdefault('stageHistory',[])
  if history and not history[-1].get('endedMs'):history[-1]['endedMs']=at;history[-1]['elapsedSeconds']=round((at-history[-1]['startedMs'])/1000,1)
  history.append({'label':label,'startedMs':at})
  row.update(stage=label,stageStartedMs=at,outputChars=0,thinkingChars=0,chunks=0,firstTokenMs=None,lastChunkMs=None,activity='',requestElapsedSeconds=None,generatedTokens=None,requestStartedMs=None)
  m.write()
def progress(s,ident,**values):
 m=_INSTANCES.get((str(s.DATA),s.TOKEN))
 if not m:return
 with m.lock:
  row=next((r for r in m.rows if r['id']==ident),None)
  if not row:return
  row.update(values)
  if row.get('stageHistory'):row['stageHistory'][-1].update({k:v for k,v in values.items() if k in ['outputChars','thinkingChars','chunks','model','requestElapsedSeconds','generatedTokens','loadSeconds']})
  m.write()
def finish_stage(s,ident):
 m=_INSTANCES.get((str(s.DATA),s.TOKEN))
 if not m:return
 with m.lock:
  row=next((r for r in m.rows if r['id']==ident),None)
  if row and row.get('stageHistory') and not row['stageHistory'][-1].get('endedMs'):
   entry=row['stageHistory'][-1];entry['endedMs']=int(time.time()*1000);entry['elapsedSeconds']=round((entry['endedMs']-entry['startedMs'])/1000,1);m.write()
class Manager:
 def __init__(self,s):
  self.s=s;self.lock=threading.RLock();self.event=threading.Event();self.path=s.DATA/'tasks.json';self.paused=False
  doc=json.loads(self.path.read_text('utf-8')) if self.path.exists() else {};self.rows=doc.get('tasks',[]);self.paused=bool(doc.get('paused',False))
  for row in self.rows:
   if row.get('snapshot') is not None:
    self.store_input(row['id'],row.pop('snapshot'))
   if row['status'] in ['waiting','running']:
    row.update(status='interrupted',error='服务重启，未自动重投；可查看历史结果，再决定重试',finishedAt=now(),finishedMs=int(time.time()*1000))
    if row.get('stageHistory') and not row['stageHistory'][-1].get('endedMs'):
     step=row['stageHistory'][-1];step['endedMs']=row['finishedMs'];step['elapsedSeconds']=round((step['endedMs']-step['startedMs'])/1000,1)
  for row in self.rows:
   if row['type'] not in ['planning','analysis','reverse','assets'] and row['status'] not in TERMINAL:row.update(status='cancelled',error='精简版已移除该任务功能，旧记录保留',finishedAt=now())
  self.write();threading.Thread(target=self.worker,daemon=True).start()
 def store_input(self,ident,value):
  folder=self.s.DATA/'task-inputs';folder.mkdir(parents=True,exist_ok=True)
  path=folder/(ident+'.json');tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False),'utf-8');tmp.replace(path)
 def input(self,row):
  if row.get('snapshot') is not None:return copy.deepcopy(row['snapshot'])
  path=self.s.DATA/'task-inputs'/(row['id']+'.json')
  return json.loads(path.read_text('utf-8')) if path.exists() else None
 def write(self):
  self.path.parent.mkdir(parents=True,exist_ok=True);tmp=self.path.with_suffix('.tmp');tmp.write_text(json.dumps({'paused':self.paused,'tasks':self.rows},ensure_ascii=False),'utf-8');tmp.replace(self.path)
 def snapshot(self):
  with self.lock:return copy.deepcopy(self.rows)
 def get(self,ident):
  with self.lock:return copy.deepcopy(next((r for r in self.rows if r['id']==ident),None))
 def cancelled(self,ident):
  with self.lock:return any(r['id']==ident and (r['status']=='cancelled' or r.get('cancelRequested')) for r in self.rows)
 def patch(self,ident,**values):
  with self.lock:
   row=next((r for r in self.rows if r['id']==ident),None)
   if row and any(row.get(k)!=v for k,v in values.items()):row.update(values);self.write()
 def add(self,kind,payload,cfg=None,snapshot=None,ident=None):
  p=self.s.load_project()
  if not p or p['projectId']!=payload.get('projectId'):raise ValueError('项目已切换，任务未提交')
  if kind not in ['planning','analysis','reverse','assets']:raise ValueError('精简版仅支持拆镜、镜头解析和提示词反推')
  with self.lock:
   if sum(r['status'] not in TERMINAL for r in self.rows)>=100:raise ValueError('最多排队 100 个任务')
   row={'id':ident or self.s.uid(),'type':kind,'status':'waiting','projectId':p['projectId'],'projectTitle':p['title'],'segmentId':payload.get('segmentId',''),'shotId':payload.get('shotId',''),'title':payload.get('title') or payload.get('name') or {'analysis':'AI 镜头解析','reverse':'提示词反推','planning':'AI 拆镜 / 调整','assets':'素材视觉分析'}[kind],'createdAt':now(),'createdMs':int(time.time()*1000),'stage':'等待本机队列','payload':copy.deepcopy(payload),'config':copy.deepcopy(cfg or {})}
   if kind=='analysis':row['strategy']=payload.get('strategy','overwrite')
   if snapshot is not None:self.store_input(row['id'],snapshot)
   self.rows.append(row);self.write();self.event.set();return copy.deepcopy(row)
 def public(self):
  with self.lock:return {'tasks':copy.deepcopy([{k:v for k,v in row.items() if k not in ['config','payload','snapshot']} for row in self.rows]),'paused':self.paused,'concurrency':1}
 def action(self,body):
  action=body.get('action');ident=body.get('id')
  if action=='clear_done':
   with self.lock:
    removed=[r['id'] for r in self.rows if r['status']=='done']
    self.rows=[r for r in self.rows if r['status']!='done'];self.write()
    for ident in removed:
     if not ident or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_' for c in ident):continue
     for folder,ext in [('task-inputs','.json'),('task-images','.bin')]:
      (self.s.DATA/folder/(ident+ext)).unlink(missing_ok=True)
    return {**self.public(),'removedCount':len(removed)}
  if action in ['retry','regenerate']:

   row=self.get(ident)
   if not row or row['status'] not in ['error','cancelled','interrupted']:raise ValueError('只有失败、取消或中断任务可以重试')
   snapshot=self.input(row)
   if action=='regenerate' and row['type']!='planning':raise ValueError('重新推理仅用于分镜任务')
   if row['type']=='planning':
    import planning_backend
    planning_backend.enqueue(self.s,{**row['payload'],'smartRepair':bool((snapshot or {}).get('smartRepair')),'instruction':(snapshot or {}).get('instruction','重新生成分镜'),'mode':(snapshot or {}).get('mode','quick')},cached_snapshot=snapshot if action=='retry' and (snapshot or {}).get('modelResponse') else None)
   elif row['type']=='assets':
    import asset_analysis
    asset_analysis.enqueue(self.s,{**row['payload'],'force':False})
   else:self.add(row['type'],row['payload'],row['config'],snapshot)
   return self.public()
  with self.lock:
   if action in ['pause','resume']:
    self.paused=action=='pause';self.write();self.event.set();return self.public()
   row=next((r for r in self.rows if r['id']==ident),None)
   if not row:raise ValueError('任务不存在')
   if action=='cancel':
    if row['status']=='waiting':
     row.update(status='cancelled',stage='已取消排队',finishedAt=now(),finishedMs=int(time.time()*1000))
    elif row['status']=='running':row.update(cancelRequested=True,stage='正在停止跟踪；远端请求可能继续运行')
   elif action=='delete':
    if row['status'] not in TERMINAL:raise ValueError('请先取消或等任务结束')
    self.rows.remove(row)
   else:raise ValueError('未知任务操作')
   self.write();self.event.set()
  if action=='delete':
   for folder,ext in [('task-inputs','.json'),('task-images','.bin')]:
    (self.s.DATA/folder/(ident+ext)).unlink(missing_ok=True)
  return self.public()
 def worker(self):
  while True:
   self.event.wait();self.event.clear()
   while True:
    with self.lock:
     row=next((r for r in self.rows if r['status']=='waiting'),None) if not self.paused else None
     if row is None:break
     row.update(status='running',stage='准备执行',startedAt=now(),startedMs=int(time.time()*1000));self.write();task=copy.deepcopy(row)
    self.execute(task)
 def execute(self,row):
  stage(self.s,row['id'],'等待当前 AI 操作结束')
  with self.s.COMPUTE_LOCK:self.execute_locked(row)
 def execute_locked(self,row):
  s=self.s;ident=row['id'];payload=row['payload']
  try:
   with s.ai_session(ident):
    check_cancel(s,ident);p=s.load_project()
    if not p or p['projectId']!=row['projectId']:raise ValueError('项目已切换；旧任务不写入新项目')
    if payload.get('segmentId') and not any(seg['id']==payload['segmentId'] for seg in p['segments']):raise ValueError('原片段已删除，任务未执行')
    if payload.get('shotId') and not any(h['id']==payload['shotId'] for seg in p['segments'] for h in seg['shots']):raise ValueError('原镜头已删除，任务未执行')
    if row['type']=='planning':
     import planning_backend as planning
     result=planning.analyze(s,row['config'],self.input(row),{**payload,'_taskId':ident})
    elif row['type']=='assets':
     import asset_analysis
     result=asset_analysis.analyze(s,row['config'],self.input(row),{**payload,'_taskId':ident})
    elif row['type']=='reverse':
     import reverse_backend as reverse
     stage(s,ident,'视觉模型反推提示词');result=reverse.analyze(s,row['config'],self.input(row),payload)
    else:
     import studio_backend as studio
     stage(s,ident,'视觉模型解析中');result=studio.analyze(s,row['config'],self.input(row),payload)
   finish_stage(s,ident)
   check_cancel(s,ident);self.patch(ident,status='done',result=result,stage='已完成，结果可查看',finishedAt=now(),finishedMs=int(time.time()*1000))
  except Exception as e:
   finish_stage(s,ident)
   cancelled=self.cancelled(ident);self.patch(ident,status='cancelled' if cancelled else 'error',error=str(e),stage='已取消跟踪' if cancelled else '执行失败',finishedAt=now(),finishedMs=int(time.time()*1000))
