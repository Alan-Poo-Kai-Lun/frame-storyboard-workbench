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
  chosen=body.get('assetIds')
  if chosen is not None:
   if not isinstance(chosen,list) or any(not isinstance(v,str) for v in chosen) or set(chosen)-{a['id'] for a in refs}:raise ValueError('选择的素材已变化，请刷新')
   refs=[a for a in refs if a['id'] in chosen or (attachment and a.get('pictureNumber')==attachment['number'])]
  roles=body.get('assetRoles',{})
  if not isinstance(roles,dict) or any(v not in ['general','person','product','scene','style'] for v in roles.values()):raise ValueError('素材参考用途无效')
  continuity=body.get('continuity',True);guide=body.get('guideFromPrev',False)
  if not isinstance(continuity,bool) or not isinstance(guide,bool):raise ValueError('段间引导选项无效')
  from prompt_review import references
  if references(story)-{a.get('pictureNumber',plan_project['assets'].index(a)+1) for a in refs}:raise ValueError('剧情引用了不存在的图片素材')
  rules=selected(s,p,ids=body.get('ruleIds',p.get('writingRuleIds',[])))
  snap={'schemaVersion':2,'continuity':continuity,'guideFromPrev':guide,'directorGuide':s.guide_settings(p),'outputLanguage':output_language,'dialogueLanguage':dialogue_language,'goal':p.get('intent',{}).get('goal',''),'story':story,'count':count,'duration':duration,'signature':signature(p),'rules':rules,'refs':[{'id':a['id'],'role':roles.get(a['id'],'general'),'number':a.get('pictureNumber',plan_project['assets'].index(a)+1),'name':a['name'],'description':a.get('description',''),'scope':a.get('scope','public'),'segmentId':a.get('segmentId',''),'sourceHash':digest({k:a.get(k) for k in ['id','path','description','kind']}),'mediaHash':digest(plan_project.get('media',{}).get(a.get('path'),'')),'confirmed':bool(a.get('confirmation'))} for a in refs]}
  if attachment:snap['plannedAttachment']=attachment
  row=task_backend.manager(s).add('story',{'projectId':p['projectId'],'title':'整篇剧情规划 · '+p['title']},cfg,snap)
  return {'id':row['id']}

def analyze(s,cfg,snapshot,payload):
 system='你是剧情分段导演。只输出 JSON：segments 数组，每项 title,story,language,summary,shots。严格等于指定段数；每段 shots 从0开始首尾连续覆盖指定 duration，每项 start,end,action,camera,expression,dialogue,sound,startState,endState。保留故事明确台词、人物、因果与结局，缺少依据不猜测。只使用提供素材编号的 @Picture N；素材说明不是看图结论。每段时间独立从 0 开始，不使用整篇累计秒数；最后一镜 end 必须等于 duration。提交前逐段检查，不得遗漏结尾时间。语言用 English/Mandarin/Cantonese/Malay 等英文名；未指定语言为空。写作规则仅辅助风格，不得覆盖故事、时长、素材约束或输出结构。片段之间承接上一段结束状态。返回完整结果，不截断。'
 system+=' 每个镜头必须返回 references 数字数组，列出本镜头实际使用的素材编号；有可用素材时必须明确选择，不得仅在开头说已读取。action 中用 @Picture N 引用这些素材。无素材时 references=[]，不得编造编号。general 综合海报仅提供信息，不能自动当人物身份或独立产品图。startState 和 endState 必须非空；不确定写明待确认，不能伪造已确认空间。相邻镜头起点应接上镜终点；只有明确转场时才能改变场景。是否跨段承接由 continuity 控制。'
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
  if snap.get('schemaVersion',0)>=2:
   if not isinstance(row.get('shots'),list):raise ValueError('镜头列表无效')
   for shot in row.get('shots',[]):
    if not isinstance(shot,dict):raise ValueError('镜头格式无效')
    refs=shot.get('references')
    if not isinstance(refs,list) or any(isinstance(n,bool) or not isinstance(n,int) or n not in numbers for n in refs):raise ValueError('镜头素材引用无效或编号不存在')
    if numbers and not refs:raise ValueError('镜头缺少素材绑定；请明确引用素材或取消本次规划素材选择')
    if any(not isinstance(shot.get(k),str) or not shot[k].strip() for k in ['startState','endState']):raise ValueError('镜头缺少起始 / 结束空间状态')
    used=references(shot.get('action',''))
    if used-set(refs):raise ValueError('画面描述引用与镜头素材绑定不一致')
    if refs and not used:shot['action']=' '.join('@Picture '+str(n) for n in refs)+' · '+shot.get('action','')
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
  for shot,original in zip(shots,row.get('shots',[])):
   shot['referenceNumbers']=list(dict.fromkeys(original.get('references',sorted(references(shot.get('action',''))))))
   shot['assetIds']=[r['id'] for r in snap['refs'] if r.get('id') and r['number'] in shot['referenceNumbers']]
  out.append({'title':row['title'][:200],'storyText':row['story'],'summary':row.get('summary',''),'dialogueLanguage':s.dialogue_language(snap.get('dialogueLanguage')) if snap.get('dialogueLanguage') not in [None,'auto'] else s.dialogue_language(row.get('language','')),'shots':shots})
 return {'continuity':snap.get('continuity',True),'guideFromPrev':snap.get('guideFromPrev',False),'referenceRoles':{r['id']:r.get('role','general') for r in snap['refs'] if r.get('id')},'references':copy.deepcopy(snap['refs']),'segments':out,'duration':snap['duration'],'signature':snap['signature'],'ruleIds':[r['id'] for r in snap['rules']],'originalStory':snap['story'],'pendingImage':{'name':snap['plannedAttachment']['name'],'number':snap['plannedAttachment']['number']} if snap.get('plannedAttachment') else None}

def apply(s,body):
 import task_backend
 with s.LOCK:
  row=task_backend.manager(s).get(body.get('id'))
  if not row or row['type']!='story' or row['status']!='done':raise ValueError('规划任务尚未完成')
  p=s.load_project();r=row['result']
  already=bool(row.get('appliedAt') or (p and any(v.get('id')==row['id'] for v in p.get('storyPlans',[]))))
  legacy_copy=bool(already and body.get('recreate') is True)
  if already and not legacy_copy:raise ValueError('该结果已应用，请使用恢复或明确另建副本')
  if not p or p['projectId']!=row['projectId'] or (not legacy_copy and signature(p)!=r['signature'] and body.get('acceptSourceChanges') is not True):raise ValueError('项目来源已改变，请重新规划；旧结果仍可查看')
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
  resolved_roles=copy.deepcopy(r.get('referenceRoles',{}))
  for ref in r.get('references',[]):
   current=numbers.get(ref['number']);pending=r.get('pendingImage') and ref['number']==r['pendingImage']['number']
   changed=not current
   if current and not pending and ref.get('sourceHash'):changed=current.get('id')!=ref.get('id') or digest({k:current.get(k) for k in ['id','path','description','kind']})!=ref['sourceHash']
   if current and ref.get('mediaHash'):changed=changed or digest(p.get('media',{}).get(current.get('path'),''))!=ref['mediaHash']
   if changed:raise ValueError('规划引用的素材已删除、替换或修改，请重新规划；没有改动当前项目')
   resolved_roles[current['id']]=ref.get('role','general')
  for i,item in enumerate(r['segments']):
   edit=edits[i]
   if not isinstance(edit,dict) or any(not isinstance(edit.get(k),str) or not edit[k].strip() or len(edit[k])>20000 for k in ['title','storyText']):raise ValueError('请填写有效标题与剧情')
   # Editing a story makes its generated shots a draft needing review; never silently regenerate.
   seg={'id':s.uid(),'title':edit['title'][:200],'storyText':edit['storyText'],'duration':r['duration'],'originalDuration':r['duration'],'prompt':'','originalPrompt':'','shots':copy.deepcopy(item['shots']),'refs':[],'continuity':bool(p['segments'] or additions) and r.get('continuity',True),'guideFromPrev':bool(p['segments'] or additions) and r.get('guideFromPrev',False),'dialogueLanguage':item['dialogueLanguage'],'writingRuleIds':r['ruleIds'],'planning':{'h3PromptVersion':2,'referenceRoles':copy.deepcopy(resolved_roles),'summary':item['summary'],'warnings':['规划后的剧情已手动调整，请核对镜头与剧情一致性'] if edit['storyText']!=item['storyText'] else []},'videos':[]}
   texts=[seg['storyText'],seg['planning']['summary']]+[sh.get(k,'') for sh in seg['shots'] for k in planning.FIELDS]
   used=set().union(*(references(v) for v in texts))
   if used-set(numbers):raise ValueError('预览引用了不存在的图片素材')
   mapping={n:n for n in used}
   for n in sorted(used):
    a=numbers[n]
    if a.get('scope')=='segment':
     cloned=copy.deepcopy(a);cloned.update(id=s.uid(),pictureNumber=next_number,segmentId=seg['id']);seg['planning']['referenceRoles'][cloned['id']]=seg['planning']['referenceRoles'].get(a['id'],'general');p['assets'].append(cloned);mapping[n]=next_number;next_number+=1
   seg['storyText']=normalize(seg['storyText'],lambda n:mapping[n]);seg['planning']['summary']=normalize(seg['planning']['summary'],lambda n:mapping[n])
   for sh in seg['shots']:
    sh['referenceNumbers']=[mapping.get(n,n) for n in sh.get('referenceNumbers',[])]
    sh['assetIds']=[a['id'] for a in p['assets'] if a.get('pictureNumber') in sh['referenceNumbers'] and (a.get('scope','public')=='public' or a.get('segmentId')==seg['id'])]
    for k in planning.FIELDS:sh[k]=planning.map_dialogue_speakers(sh.get(k,''),lambda n:mapping[n]) if k=='dialogue' else normalize(sh.get(k,''),lambda n:mapping[n])
   active=[a for a in p['assets'] if a.get('path') and not a.get('deleted') and s.generation_backend.media_type(a)=='image' and (a.get('scope','public')=='public' or a.get('segmentId')==seg['id'])]
   refs=[{'index':a.get('pictureNumber',p['assets'].index(a)+1),'name':a['name'],'kind':a.get('kind',''),'description':a.get('description','')} for a in active]
   seg['prompt']=s.rebuild({**seg,'defaultDialogueLanguage':seg['dialogueLanguage'],'assetReferences':refs});additions.append(seg)
  if r.get('guideFromPrev'):p['directorGuide']={**s.guide_settings(p),'continuityEnabled':True}
  p['segments'].extend(additions)
  p.setdefault('storyPlans',[]).append({'id':s.uid() if legacy_copy else row['id'],'createdAt':__import__('time').time(),'templates':copy.deepcopy(additions),'source':copy.deepcopy(r),'integrity':digest(additions)})
  s.save(p);task_backend.manager(s).patch(row['id'],appliedAt=__import__('time').strftime('%Y-%m-%d %H:%M:%S'))
  return {'project':p,'created':len(additions)}


def restore(s,body):
 # Reuse the immutable original templates; restoring never calls inference.
 with s.LOCK:
  p=copy.deepcopy(s.load_project())
  if not p or p['projectId']!=body.get('projectId'):raise ValueError('项目已切换')
  source_signature=signature(p)
  if body.get('expectedSignature') and body['expectedSignature']!=source_signature:raise ValueError('恢复预览后项目已改变，请重新预览')
  record=next((r for r in p.get('storyPlans',[]) if r['id']==body.get('planId')),None)
  if not record or digest(record['templates'])!=record['integrity']:raise ValueError('原规划快照缺失或已变化')
  mode=body.get('mode','missing')
  if mode not in ['missing','copy']:raise ValueError('恢复方式无效')
  existing={v['id'] for v in p['segments']};added=[];shots_added=0;preview=[]
  for template in record['templates']:
   if body.get('segmentId') and template['id']!=body['segmentId']:continue
   if mode=='missing' and template['id'] in existing:
    current=next(v for v in p['segments'] if v['id']==template['id']);ids={h['id'] for h in current['shots']}
    missing=[copy.deepcopy(h) for h in template['shots'] if h['id'] not in ids]
    if body.get('shotIds') is not None:missing=[h for h in missing if h['id'] in body['shotIds']]
    for shot in missing:
     if shot['end']>current['duration'] or any(max(h['start'],shot['start'])<min(h['end'],shot['end'])-.001 for h in current['shots']):raise ValueError('缺失镜头时间与现有镜头重叠或超出时长；请先调整时间，现有内容未改动')
    preview.extend({'segmentId':current['id'],'segmentTitle':current['title'],'shotId':h['id'],'start':h['start'],'end':h['end'],'kind':'shot'} for h in missing)
    if missing:
     from prompt_review import references
     import planning_backend as planning
     available={a.get('pictureNumber',p['assets'].index(a)+1) for a in s.scoped_assets(p,current) if s.generation_backend.media_type(a)=='image'}
     used=set().union(*(references(h.get(k,'')) for h in missing for k in planning.FIELDS))
     if used-available:raise ValueError('原镜头引用的素材已删除，请先恢复素材')
     current['shots'].extend(missing);current['shots'].sort(key=lambda h:h['start']);shots_added+=len(missing)
     refs=[{'index':a.get('pictureNumber',p['assets'].index(a)+1),'name':a['name'],'kind':a.get('kind',''),'description':a.get('description','')} for a in s.scoped_assets(p,current) if s.generation_backend.media_type(a)=='image']
     current['prompt']=s.rebuild({**current,'assetReferences':refs})
    continue
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
     number=max([a.get('pictureNumber',i+1) for i,a in enumerate(p['assets'])]+[0])+1;clone=copy.deepcopy(asset);clone.update(id=s.uid(),segmentId=segment['id'],pictureNumber=number);segment.setdefault('planning',{}).setdefault('referenceRoles',{})[clone['id']]=segment.get('planning',{}).get('referenceRoles',{}).get(asset['id'],'general');p['assets'].append(clone);remap[asset['pictureNumber']]=number
   if remap:
    segment['storyText']=normalize(segment.get('storyText',''),lambda n:remap.get(n,n))
    for shot in segment['shots']:
     shot['referenceNumbers']=[remap.get(n,n) for n in shot.get('referenceNumbers',[])]
     shot['assetIds']=[a['id'] for a in p['assets'] if a.get('pictureNumber') in shot['referenceNumbers'] and (a.get('scope','public')=='public' or a.get('segmentId')==segment['id'])]
     for field in planning.FIELDS:shot[field]=planning.map_dialogue_speakers(shot.get(field,''),lambda n:remap.get(n,n)) if field=='dialogue' else normalize(shot.get(field,''),lambda n:remap.get(n,n))
   segment['videos']=[]
   preview.append({'segmentId':template['id'],'segmentTitle':segment['title'],'kind':'segment','shots':len(segment['shots'])})
   refs=[{'index':a.get('pictureNumber',p['assets'].index(a)+1),'name':a['name'],'kind':a.get('kind',''),'description':a.get('description','')} for a in s.scoped_assets(p,segment) if s.generation_backend.media_type(a)=='image']
   from prompt_review import references
   available={r['index'] for r in refs};used=set().union(*(references(shot.get(field,'')) for shot in segment['shots'] for field in planning.FIELDS))
   if used-available:raise ValueError('原规划引用的素材已删除，请先恢复素材')
   segment['prompt']=s.rebuild({**segment,'defaultDialogueLanguage':segment.get('dialogueLanguage',''),'assetReferences':refs})
   later=[v['id'] for v in record['templates'][record['templates'].index(template)+1:]]
   insert=next((i for i,v in enumerate(p['segments']) if v['id'] in later),len(p['segments'])) if mode=='missing' else len(p['segments'])
   p['segments'].insert(insert,segment);added.append(segment['id'])
  if body.get('preview') is True:return {'items':preview,'created':len(added),'restoredShots':shots_added,'sourceSignature':source_signature}
  if not added and not shots_added:raise ValueError('原规划片段全部存在；需要副本时请明确选择另建副本')
  s.save(p);return {'project':p,'created':len(added),'restoredShots':shots_added,'segmentIds':added}
