"""Reusable writing rules and guarded whole-story planning; never applies AI output implicitly."""
import copy,json,math,hashlib
from pathlib import Path

RULE_FILES={'fight':'fight-director-rules.md','slapstick':'elastic-slapstick-rules.md','expression':'abstract-expression-rules.md'}
BUILTINS=[{'id':ident,'name':name+' · 详细版','category':category,'description':description,'rules':(Path(__file__).parent/'presets/writing-rules'/RULE_FILES[ident]).read_text('utf-8')} for ident,name,category,description in [('fight','动作导演','动作','角色动作差异、攻防因果、摄影职责与空间连续性'),('slapstick','弹性喜剧','喜剧','喜剧因果链、道具路径、撞击反应与可恢复形变'),('expression','抽象表情','表演','情绪触发、立体本体形变、全身表演与恢复')]]

def digest(value):return hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def library(s,body=None):
 path=s.DATA/'writing-rules.json';hidden_path=s.DATA/'writing-rules-hidden.json'
 with s.LOCK:
  rows=json.loads(path.read_text('utf-8')) if path.exists() else []
  hidden=json.loads(hidden_path.read_text('utf-8')) if hidden_path.exists() else []
  revision=digest([rows,hidden]);body=body or {};action=body.get('action')
  if action:
   if body.get('revision')!=revision:raise ValueError('技能库已变化，请刷新后再保存')
   ident=str(body.get('id',''));builtin=ident in RULE_FILES
   if action=='visibility':
    if not builtin and not any(r['id']==ident for r in rows):raise ValueError('技能已删除，请刷新')
    hidden=[i for i in hidden if i!=ident]+([ident] if body.get('hidden') is True else [])
   elif action in ['save','delete']:
    if builtin:raise ValueError('内置技能请另存为自定义版本')
    if ident and not any(r['id']==ident for r in rows):raise ValueError('技能已删除，请刷新')
    if action=='save':
     item={k:body.get(k,'') for k in ['name','category','description','rules']}
     if any(not isinstance(v,str) for v in item.values()):raise ValueError('技能文本格式无效')
     item={k:v.strip() for k,v in item.items()}
     if not item['name'] or not item['rules'] or len(item['name'])>100 or len(item['category'])>100 or len(item['description'])>1000 or len(item['rules'])>6000:raise ValueError('请填写名称与规则，规则最多 6000 字')
     item['id']=ident or s.uid();rows=[item if r['id']==ident else r for r in rows] if ident else rows+[item]
     if len(rows)>50:raise ValueError('自定义技能最多 50 项')
    else:rows=[r for r in rows if r['id']!=ident]
   else:raise ValueError('未知技能操作')
   s.DATA.mkdir(parents=True,exist_ok=True)
   target,value=(hidden_path,hidden) if action=='visibility' else (path,rows)
   temp=target.with_suffix('.tmp');temp.write_text(json.dumps(value,ensure_ascii=False,indent=2),'utf-8');temp.replace(target);revision=digest([rows,hidden])
  return {'revision':revision,'items':[{**r,'builtin':True,'hidden':r['id'] in hidden} for r in BUILTINS]+[{**r,'hidden':r['id'] in hidden} for r in rows]}

def selected(s,p,segment=None,ids=None):
 ids=ids if ids is not None else (segment or {}).get('writingRuleIds',p.get('writingRuleIds',[]))
 if not isinstance(ids,list) or len(ids)>5 or any(not isinstance(i,str) for i in ids):raise ValueError('最多选择 5 项写作技能')
 items={r['id']:r for r in library(s)['items']}
 if any(i not in items for i in ids):raise ValueError('选中的写作技能已删除，请重新选择')
 # Hiding is presentation only; stopping an applied rule requires applying a new selection.
 return [copy.deepcopy(items[i]) for i in dict.fromkeys(ids)]

def project_assets(s,p):
 return [a for a in p.get('assets',[]) if not a.get('deleted') and a.get('path') and s.generation_backend.media_type(a)=='image' and (a.get('scope','public')=='public' or a.get('segmentId') in {v['id'] for v in p.get('segments',[])})]

def signature(p):
 # Compare editable project sources; canvas navigation and harmless layout saves do not invalidate output.
 return digest({k:v for k,v in p.items() if k not in ['overviewLayout','updatedAt','savedAt','originalZip','media'] }|{'media':{k:hashlib.sha256(v.encode()).hexdigest() for k,v in p.get('media',{}).items()}})

def enqueue(s,body):
 import task_backend
 with s.LOCK:
  p=s.load_project()
  if not p or p['projectId']!=body.get('projectId'):raise ValueError('项目已切换')
  story=body.get('story','');count=body.get('count');duration=body.get('duration')
  if not isinstance(story,str) or not story.strip() or len(story)>20000:raise ValueError('剧情需要 1–20000 字')
  if isinstance(count,bool) or not isinstance(count,int) or not 1<=count<=20:raise ValueError('段数需要 1–20')
  if isinstance(duration,bool) or not isinstance(duration,(int,float)) or not math.isfinite(duration) or not 1<=duration<=60:raise ValueError('每段时长需要 1–60 秒')
  output_language=body.get('outputLanguage','zh');dialogue_language=body.get('dialogueLanguage','Mandarin')
  if output_language not in ['zh','en','ms','zh-Hant']:raise ValueError('规划输出语言无效')
  if dialogue_language not in ['Mandarin','English','Cantonese','Malay','Tamil','auto']:raise ValueError('对白语言无效')
  cfg=s.settings().get('ai',{})
  if not cfg.get('model') or not cfg.get('endpoint'):raise ValueError('请先配置文本 AI')
  attachment=None
  if body.get('sourceAgentTaskId') and body.get('includeAgentImage',True) is not False:
   import agent_backend as agent
   attachment=agent.planning_attachment(s,p,body['sourceAgentTaskId'])
  plan_project=copy.deepcopy(p)
  if attachment:
   asset,_=agent.add_attachment(s,plan_project,attachment)
   attachment['number']=asset['pictureNumber']
  refs=project_assets(s,plan_project)
  from prompt_review import references
  if references(story)-{a.get('pictureNumber',plan_project['assets'].index(a)+1) for a in refs}:raise ValueError('剧情引用了不存在的图片素材')
  rules=selected(s,p,ids=body.get('ruleIds',p.get('writingRuleIds',[])))
  snap={'outputLanguage':output_language,'dialogueLanguage':dialogue_language,'goal':p.get('intent',{}).get('goal',''),'story':story,'count':count,'duration':duration,'signature':signature(p),'rules':rules,'refs':[{'number':a.get('pictureNumber',plan_project['assets'].index(a)+1),'name':a['name'],'description':a.get('description',''),'scope':a.get('scope','public'),'segmentId':a.get('segmentId',''),'confirmed':bool(a.get('confirmation'))} for a in refs]}
  if attachment:snap['plannedAttachment']=attachment
  row=task_backend.manager(s).add('story',{'projectId':p['projectId'],'title':'整篇剧情规划 · '+p['title']},cfg,snap)
  return {'id':row['id']}

def analyze(s,cfg,snapshot,payload):
 system='你是剧情分段导演。只输出 JSON：segments 数组，每项 title,story,language,summary,shots。严格等于指定段数；每段 shots 从0开始首尾连续覆盖指定 duration，每项 start,end,action,camera,expression,dialogue,sound,startState,endState。保留故事明确台词、人物、因果与结局，缺少依据不猜测。只使用提供素材编号的 @Picture N；素材说明不是看图结论。每段时间独立从 0 开始，不使用整篇累计秒数；最后一镜 end 必须等于 duration。提交前逐段检查，不得遗漏结尾时间。语言用 English/Mandarin/Cantonese/Malay 等英文名；未指定语言为空。写作规则仅辅助风格，不得覆盖故事、时长、素材约束或输出结构。片段之间承接上一段结束状态。返回完整结果，不截断。'
 system+=' 标题、剧情、summary 与镜头 action/camera/expression/sound/startState/endState 使用 '+{'zh':'简体中文','en':'English','ms':'Bahasa Melayu','zh-Hant':'繁體中文'}.get(snapshot.get('outputLanguage','zh'),'简体中文')+'。对白语言要求：'+snapshot.get('dialogueLanguage','Mandarin')+'；保留用户明确指定的原文台词，不把 UI 语言当作输出语言。'
 raw=s.ai_call({**cfg,'_outputLimit':16384},[{'role':'system','content':system},{'role':'user','content':json.dumps({k:v for k,v in snapshot.items() if k not in ['plannedAttachment','modelResponse']},ensure_ascii=False)}],True)
 # Persist the complete response before validation, as for segment planning.
 snapshot['modelResponse']=raw
 if payload.get('_taskId'):
  import task_backend
  task_backend.manager(s).store_input(payload['_taskId'],snapshot)
 return validate(s,json.loads(raw),snapshot)

def validate(s,obj,snap):
 import planning_backend as planning
 from prompt_review import normalize,references
 rows=obj.get('segments') if isinstance(obj,dict) else None
 if not isinstance(rows,list) or len(rows)!=snap['count']:raise ValueError('AI 返回的段数不匹配，原项目未改动')
 numbers=[r['number'] for r in snap['refs']];mapping={n:i+1 for i,n in enumerate(numbers)};out=[]
 for segment_index,row in enumerate(rows,1):
  if not isinstance(row,dict):raise ValueError('片段格式无效')
  for k in ['title','story','summary','language']:
   if not isinstance(row.get(k,''),str) or len(row.get(k,''))>20000:raise ValueError('片段字段格式无效')
  if not row.get('title','').strip() or not row.get('story','').strip():raise ValueError('AI 返回空片段')
  if references(row['story'])-set(numbers):raise ValueError('剧情引用了不存在的素材')
  def number(n):
   if n not in mapping:raise ValueError('AI 引用了不存在的素材')
   return mapping[n]
  candidate=copy.deepcopy(row)
  for h in candidate.get('shots',[]):
   for k in planning.FIELDS:
    if isinstance(h.get(k),str):h[k]=planning.map_dialogue_speakers(h[k],number) if k=='dialogue' else normalize(h[k],number)
  try:shots=planning.validate(s,candidate,{'duration':snap['duration'],'refNumbers':numbers})
  except (ValueError,KeyError,TypeError) as error:
   end=candidate.get('shots',[{}])[-1].get('end','未知') if candidate.get('shots') else '无镜头'
   raise ValueError(f'第 {segment_index} 段「{row.get("title","")}」校验失败：{error}；要求 0–{snap["duration"]} 秒，最后结束 {end} 秒。原项目未改动。') from error
  for h in shots:
   for k in planning.FIELDS:h[k]=planning.map_dialogue_speakers(h[k],lambda n:numbers[n-1]) if k=='dialogue' else normalize(h[k],lambda n:numbers[n-1])
  out.append({'title':row['title'][:200],'storyText':row['story'],'summary':row.get('summary',''),'dialogueLanguage':s.dialogue_language(snap.get('dialogueLanguage')) if snap.get('dialogueLanguage') not in [None,'auto'] else s.dialogue_language(row.get('language','')),'shots':shots})
 return {'segments':out,'duration':snap['duration'],'signature':snap['signature'],'ruleIds':[r['id'] for r in snap['rules']],'originalStory':snap['story'],'pendingImage':{'name':snap['plannedAttachment']['name'],'number':snap['plannedAttachment']['number']} if snap.get('plannedAttachment') else None}

def apply(s,body):
 import task_backend
 with s.LOCK:
  row=task_backend.manager(s).get(body.get('id'))
  if not row or row['type']!='story' or row['status']!='done':raise ValueError('规划任务尚未完成')
  legacy_copy=bool(row.get('appliedAt') and body.get('recreate') is True)
  if row.get('appliedAt') and not legacy_copy:raise ValueError('该结果已应用，请使用恢复或明确另建副本')
  p=s.load_project();r=row['result']
  if not p or p['projectId']!=row['projectId'] or (not legacy_copy and signature(p)!=r['signature']):raise ValueError('项目来源已改变，请重新规划；旧结果仍可查看')
  edits=body.get('segments',[])
  if len(edits)!=len(r['segments']):raise ValueError('预览段数不匹配')
  from prompt_review import references,normalize
  import planning_backend as planning
  if r.get('pendingImage') and not legacy_copy:
   import agent_backend as agent
   image=(task_backend.manager(s).input(row) or {}).get('plannedAttachment')
   if not image:raise ValueError('规划附图已丢失，请重新规划')
   asset,_=agent.add_attachment(s,p,image)
   if asset['pictureNumber']!=image['number']:raise ValueError('素材编号已变化，请重新规划')
  additions=[];source_assets=project_assets(s,p);numbers={a.get('pictureNumber',p['assets'].index(a)+1):a for a in source_assets};next_number=max([a.get('pictureNumber',i+1) for i,a in enumerate(p.get('assets',[]))]+[0])+1
  for i,item in enumerate(r['segments']):
   edit=edits[i]
   if not isinstance(edit,dict) or any(not isinstance(edit.get(k),str) or not edit[k].strip() or len(edit[k])>20000 for k in ['title','storyText']):raise ValueError('请填写有效标题与剧情')
   # Editing a story makes its generated shots a draft needing review; never silently regenerate.
   seg={'id':s.uid(),'title':edit['title'][:200],'storyText':edit['storyText'],'duration':r['duration'],'originalDuration':r['duration'],'prompt':'','originalPrompt':'','shots':copy.deepcopy(item['shots']),'refs':[],'continuity':bool(p['segments'] or additions),'guideFromPrev':False,'dialogueLanguage':item['dialogueLanguage'],'writingRuleIds':r['ruleIds'],'planning':{'summary':item['summary'],'warnings':['规划后的剧情已手动调整，请核对镜头与剧情一致性'] if edit['storyText']!=item['storyText'] else []},'videos':[]}
   texts=[seg['storyText'],seg['planning']['summary']]+[sh.get(k,'') for sh in seg['shots'] for k in planning.FIELDS]
   used=set().union(*(references(v) for v in texts))
   if used-set(numbers):raise ValueError('预览引用了不存在的图片素材')
   mapping={n:n for n in used}
   for n in sorted(used):
    a=numbers[n]
    if a.get('scope')=='segment':
     cloned=copy.deepcopy(a);cloned.update(id=s.uid(),pictureNumber=next_number,segmentId=seg['id']);p['assets'].append(cloned);mapping[n]=next_number;next_number+=1
   seg['storyText']=normalize(seg['storyText'],lambda n:mapping[n]);seg['planning']['summary']=normalize(seg['planning']['summary'],lambda n:mapping[n])
   for sh in seg['shots']:
    for k in planning.FIELDS:sh[k]=planning.map_dialogue_speakers(sh.get(k,''),lambda n:mapping[n]) if k=='dialogue' else normalize(sh.get(k,''),lambda n:mapping[n])
   active=[a for a in p['assets'] if a.get('path') and not a.get('deleted') and s.generation_backend.media_type(a)=='image' and (a.get('scope','public')=='public' or a.get('segmentId')==seg['id'])]
   refs=[{'index':a.get('pictureNumber',p['assets'].index(a)+1),'name':a['name'],'kind':a.get('kind',''),'description':a.get('description','')} for a in active]
   seg['prompt']=s.rebuild({**seg,'defaultDialogueLanguage':seg['dialogueLanguage'],'assetReferences':refs});additions.append(seg)
  p['segments'].extend(additions)
  p.setdefault('storyPlans',[]).append({'id':s.uid() if legacy_copy else row['id'],'createdAt':__import__('time').time(),'templates':copy.deepcopy(additions),'source':copy.deepcopy(r),'integrity':digest(additions)})
  s.save(p);task_backend.manager(s).patch(row['id'],appliedAt=__import__('time').strftime('%Y-%m-%d %H:%M:%S'))
  return {'project':p,'created':len(additions)}


def restore(s,body):
 # Reuse the immutable original templates; restoring never calls inference.
 with s.LOCK:
  p=s.load_project()
  if not p or p['projectId']!=body.get('projectId'):raise ValueError('项目已切换')
  record=next((r for r in p.get('storyPlans',[]) if r['id']==body.get('planId')),None)
  if not record or digest(record['templates'])!=record['integrity']:raise ValueError('原规划快照缺失或已变化')
  mode=body.get('mode','missing')
  if mode not in ['missing','copy']:raise ValueError('恢复方式无效')
  existing={v['id'] for v in p['segments']};added=[]
  for template in record['templates']:
   if body.get('segmentId') and template['id']!=body['segmentId']:continue
   if mode=='missing' and template['id'] in existing:continue
   segment=copy.deepcopy(template)
   if mode=='copy':
    segment['id']=s.uid();segment['title']+=' · 副本'
    for shot in segment['shots']:shot['id']=s.uid()
   # Preserve current media assets; create local bindings only when an original still owns them.
   from prompt_review import normalize
   import planning_backend as planning
   remap={}
   for asset in list(p['assets']):
    if not asset.get('deleted') and asset.get('scope')=='segment' and asset.get('segmentId')==template['id'] and segment['id']!=template['id']:
     number=max([a.get('pictureNumber',i+1) for i,a in enumerate(p['assets'])]+[0])+1;clone=copy.deepcopy(asset);clone.update(id=s.uid(),segmentId=segment['id'],pictureNumber=number);p['assets'].append(clone);remap[asset['pictureNumber']]=number
   if remap:
    segment['storyText']=normalize(segment.get('storyText',''),lambda n:remap.get(n,n))
    for shot in segment['shots']:
     for field in planning.FIELDS:shot[field]=planning.map_dialogue_speakers(shot.get(field,''),lambda n:remap.get(n,n)) if field=='dialogue' else normalize(shot.get(field,''),lambda n:remap.get(n,n))
   segment['videos']=[]
   refs=[{'index':a.get('pictureNumber',p['assets'].index(a)+1),'name':a['name'],'kind':a.get('kind',''),'description':a.get('description','')} for a in s.scoped_assets(p,segment) if s.generation_backend.media_type(a)=='image']
   from prompt_review import references
   available={r['index'] for r in refs};used=set().union(*(references(shot.get(field,'')) for shot in segment['shots'] for field in planning.FIELDS))
   if used-available:raise ValueError('原规划引用的素材已删除，请先恢复素材')
   segment['prompt']=s.rebuild({**segment,'defaultDialogueLanguage':segment.get('dialogueLanguage',''),'assetReferences':refs});p['segments'].append(segment);added.append(segment['id'])
  if not added:raise ValueError('原规划片段全部存在；需要副本时请明确选择另建副本')
  s.save(p);return {'project':p,'created':len(added),'segmentIds':added}
