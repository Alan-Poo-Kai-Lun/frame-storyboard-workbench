"""Project-owned inference results. Task deletion never owns these snapshots."""
import copy,json,hashlib,time

def folder(s,pid):return s.DATA/'saved-plans'/hashlib.sha256(pid.encode()).hexdigest()
def path(s,pid,ident):return folder(s,pid)/(hashlib.sha256(ident.encode()).hexdigest()+'.json')
def write(s,record):
 dest=path(s,record['projectId'],record['id']);dest.parent.mkdir(parents=True,exist_ok=True)
 record['savedAt']=time.time();tmp=dest.with_suffix('.tmp');tmp.write_text(json.dumps(record,ensure_ascii=False),'utf-8');tmp.replace(dest)
def records(s,p):
 rows=copy.deepcopy(p.get('planArchive',{})) if isinstance(p.get('planArchive'),dict) else {}
 for row in rows.values():row['projectId']=p['projectId']
 for file in folder(s,p['projectId']).glob('*.json'):
  value=json.loads(file.read_text('utf-8'))
  if value.get('projectId')==p['projectId']:rows[value['id']]=value
 return rows
def put(s,row,snapshot=None):
 if row.get('type') not in ['agent','story']:return
 with s.LOCK:
  snap=copy.deepcopy(snapshot or {});snap.pop('history',None)
  value={k:copy.deepcopy(row[k]) for k in ['id','projectId','type','status','result','appliedAt','undoneAt','scopeKey','agentThreadId','createdAt'] if k in row}
  value['snapshot']=snap
  oldfile=path(s,row['projectId'],row['id'])
  if oldfile.exists():value={**json.loads(oldfile.read_text('utf-8')),**value}
  write(s,value)
def get(s,ident,p=None):
 p=p or s.load_project()
 if not p:raise ValueError('请先打开项目')
 record=records(s,p).get(ident)
 if not record:raise ValueError('方案快照不存在，请打开原项目')
 return copy.deepcopy(record)
def task(s,ident):
 import task_backend
 m=task_backend.manager(s);row=m.get(ident)
 if row:return row
 try:return {**get(s,ident),'archived':True}
 except ValueError:return None
def update(s,ident,**values):
 record=get(s,ident);record.update(values);write(s,record)
def preserve(s,row):
 import task_backend
 if row.get('type') in ['agent','story']:put(s,row,task_backend.manager(s).input(row) or {})
def endpoint(s,body):
 import writing_backend as writing
 with s.LOCK:
  p=s.load_project()
  if not p or p['projectId']!=body.get('projectId'):raise ValueError('项目已切换')
  action=body.get('action','get');ident=body.get('id')
  if action=='list':return {'items':[{'id':r['id'],'type':r['type'],'createdAt':r.get('createdAt'),'appliedAt':r.get('appliedAt'),'title':r.get('result',{}).get('reply','整篇规划')[:100]} for r in records(s,p).values() if r.get('type')=='story' or r.get('result',{}).get('storyPlan') or r.get('result',{}).get('planError')]}
  try:record=get(s,ident,p)
  except ValueError:
   row=task(s,ident)
   if not row or row['projectId']!=p['projectId']:raise ValueError('原方案不属于当前项目')
   preserve(s,row);record=get(s,ident,p)
  guide_input=body.get('guideSettings')
  guide=s.guide_settings({**p,'directorGuide':{**s.guide_settings(p),**(record.get('guideSettings') or {}),**(guide_input if isinstance(guide_input,dict) else {})}})
  applied_plan=next((v for v in p.get('storyPlans',[]) if v.get('id')==ident),None)
  target_ids={v['id'] for v in applied_plan.get('templates',[])} if applied_plan else set()
  if applied_plan and guide_input is None:guide=s.guide_settings(p)
  guide_targets=[{'id':v['id'],'title':v['title'],'guideFromPrev':bool(v.get('guideFromPrev')),'hasPrevious':i>0} for i,v in enumerate(p['segments']) if v['id'] in target_ids]
  if action=='guide':
   if not applied_plan:raise ValueError('方案尚未应用，请使用确认应用')
   rows=body.get('segmentGuides',[])
   if not isinstance(rows,list) or any(not isinstance(v,dict) or v.get('id') not in target_ids or not isinstance(v.get('guideFromPrev'),bool) for v in rows):raise ValueError('逐段引导目标无效')
   flags={v['id']:v['guideFromPrev'] for v in rows}
   for i,v in enumerate(p['segments']):
    if v['id'] in flags:v['guideFromPrev']=i>0 and flags[v['id']]
   p['directorGuide']=guide;s.save(p);record['guideSettings']=guide;write(s,record)
   return {'project':p}
  result=record.get('result',{})
  if record['type']=='agent' and not result.get('storyPlan') and action=='get':
   import agent_backend
   try:
    source=agent_backend.story_source(result.get('storyPlanSource') or result,record['snapshot'].get('message',''))
    recovered=agent_backend.checked_story_plan(s,p,record['snapshot'],source,recover=True)
    result.update(storyPlan=recovered,storyPlanSource=source);result.pop('planError',None)
    record['result']=result;write(s,record)
   except (ValueError,KeyError,TypeError,OverflowError) as error:result['planError']='分镜方案尚不能解析：'+str(error)
  plan=result.get('storyPlan') if record['type']=='agent' else result
  if action=='reparse':
   raw=body.get('raw',record['snapshot'].get('modelResponse',''))
   if not isinstance(raw,str) or len(raw)>2_000_000:raise ValueError('原始输出格式或长度无效')
   snap=record['snapshot']
   if record['type']=='agent':
    import agent_backend
    source=agent_backend.story_source(raw,snap.get('message',''))
    plan=agent_backend.checked_story_plan(s,p,snap,source,recover=True)
    result['storyPlan']=plan;result['storyPlanSource']=source;result.pop('planError',None)
   else:plan=writing.recover(s,raw,snap);result=plan
   record['result']=result;record['snapshot']['modelResponse']=raw;record.pop('draft',None);write(s,record)
  if action=='draft':
   draft=body.get('segments')
   if not isinstance(draft,list) or len(json.dumps(draft))>2_000_000:raise ValueError('预览草稿无效')
   record['draft']=copy.deepcopy(draft);record['guideSettings']=guide;write(s,record)
  if plan:
   plan=writing.normalize_plan_structure(plan,infer=record['type']=='agent' and not record.get('draft'))
   live=writing.refresh_plan_references(s,p,plan)
   if body.get('segments') is not None:
    candidate=writing.refresh_plan_references(s,p,{**plan,'segments':body['segments']});body={**body,'segments':candidate['segments']}
   plan=live
   if action=='get':
    try:plan['warnings']=writing.validate_edits(s,plan,record.get('draft') or plan['segments'])['warnings']+[w for w in plan.get('warnings',[]) if isinstance(w,dict) and '说明移出' in w.get('message','')]
    except ValueError as error:plan['warnings']=[{'message':str(error)}]
  if action=='validate':
   if not plan or not plan.get('segments'):raise ValueError('结果尚未解析，请先重新解析已有输出')
   checked=writing.validate_edits(s,plan,body.get('segments',[]));return {'plan':checked,'warnings':checked.get('warnings',[])}
  if action=='apply':
   if record.get('appliedAt') or any(v.get('id')==ident for v in p.get('storyPlans',[])):raise ValueError('方案已应用，请使用原规划恢复，不要重复创建')
   if not plan or not plan.get('segments'):raise ValueError('结果尚未解析，请先重新解析已有输出')
   source_changed=writing.signature(p)!=plan['signature']
   checked=writing.validate_edits(s,plan,body.get('segments',[]))
   if source_changed:checked.setdefault('warnings',[]).append({'message':'项目来源已变化；已使用当前素材追加新片段，未覆盖已有节点'})
   aspect=checked.get('aspectRatio')
   if aspect and p.get('aspect')!=aspect:
    if body.get('acceptAspectChange') is True:p['aspect']=aspect
    else:checked.setdefault('warnings',[]).append({'message':'保留当前项目画幅，未覆盖为方案画幅'})
   count=writing.append_plan(s,p,checked,checked['segments'],ident,record['snapshot'])
   p['directorGuide']=guide;record['guideSettings']=guide
   s.save(p);record['appliedAt']=time.time();record['appliedVia']='plan-preview';record.pop('draft',None);write(s,record)
   import task_backend
   task_backend.manager(s).patch(ident,appliedAt=record['appliedAt'],appliedVia='plan-preview')
   return {'project':s.load_project(),'created':count,'warnings':checked.get('warnings',[])}
  return {'id':ident,'projectId':p['projectId'],'plan':plan,'draft':writing.refresh_plan_references(s,p,{**(result.get('storyPlan') or {} if record['type']=='agent' else result),'segments':record['draft']})['segments'] if record.get('draft') else None,'appliedAt':record.get('appliedAt'),'guideSettings':guide,'guideTargets':guide_targets,'raw':record.get('snapshot',{}).get('modelResponse','') or result.get('reply',''),'reply':result.get('reply',''),'notice':result.get('planError','')}
