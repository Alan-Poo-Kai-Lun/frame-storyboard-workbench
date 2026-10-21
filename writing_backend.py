"""Reusable writing rules and guarded whole-story planning; never applies AI output implicitly."""
import re,copy,json,math,hashlib
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
 return digest({k:v for k,v in p.items() if k not in ['overviewLayout','updatedAt','savedAt','originalZip','media','planArchive'] }|{'media':{k:hashlib.sha256(v.encode()).hexdigest() for k,v in p.get('media',{}).items()}})

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
  options=planning_options(body,p)
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
  snap.update(options)
  if attachment:snap['plannedAttachment']=attachment
  row=task_backend.manager(s).add('story',{'projectId':p['projectId'],'title':'整篇剧情规划 · '+p['title']},cfg,snap)
  return {'id':row['id']}

def analyze(s,cfg,snapshot,payload):
 system='你是剧情分段导演。只输出 JSON：segments 数组，每项 title,story,language,summary,shots。严格等于指定段数；每段 shots 从0开始首尾连续覆盖指定 duration，每项 start,end,action,camera,expression,dialogue,sound,startState,endState。保留故事明确台词、人物、因果与结局，缺少依据不猜测。只使用提供素材编号的 @Picture N；素材说明不是看图结论。每段时间独立从 0 开始，不使用整篇累计秒数；最后一镜 end 必须等于 duration。提交前逐段检查，不得遗漏结尾时间。语言用 English/Mandarin/Cantonese/Malay 等英文名；未指定语言为空。写作规则仅辅助风格，不得覆盖故事、时长、素材约束或输出结构。片段之间承接上一段结束状态。返回完整结果，不截断。'
 system+=' 每个镜头必须返回 references 数字数组，列出本镜头实际使用的素材编号；有可用素材时必须明确选择，不得仅在开头说已读取。action 中用 @Picture N 引用这些素材。无素材时 references=[]，不得编造编号。general 综合海报仅提供信息，不能自动当人物身份或独立产品图。startState 和 endState 必须非空；不确定写明待确认，不能伪造已确认空间。相邻镜头起点应接上镜终点；只有明确转场时才能改变场景。是否跨段承接由 continuity 控制。'
 system+=' 【画面画幅】'+snapshot.get('aspectRatio','16:9')+'。按真实画幅安排构图，画幅不决定景别或景深。视觉影调：'+snapshot.get('visualToneInstruction',TONES.get(snapshot.get('visualTone','custom'),TONES['custom']))+'。每段镜头数量目标：'+str(DENSITIES.get(snapshot.get('shotDensity','standard'),(2,3)))+'，不得为凑数删减原对白或因果。'
 system+=' 标题、剧情、summary 与镜头 action/camera/expression/sound/startState/endState 使用 '+{'zh':'简体中文','en':'English','ms':'Bahasa Melayu','zh-Hant':'繁體中文'}.get(snapshot.get('outputLanguage','zh'),'简体中文')+'。对白语言要求：'+snapshot.get('dialogueLanguage','Mandarin')+'；保留用户明确指定的原文台词，不把 UI 语言当作输出语言。'
 raw=snapshot.get('modelResponse') or s.ai_call({**cfg,'_outputLimit':16384},[{'role':'system','content':system},{'role':'user','content':json.dumps({k:v for k,v in snapshot.items() if k not in ['plannedAttachment','modelResponse']},ensure_ascii=False)}],True)
 # Persist the complete response before validation, as for segment planning.
 snapshot['modelResponse']=raw
 if payload.get('_taskId'):
  import task_backend
  task_backend.manager(s).store_input(payload['_taskId'],snapshot)
  task_backend.manager(s).patch(payload['_taskId'],outputSaved=True) if hasattr(task_backend.manager(s),'patch') else None
 return recover(s,raw,snapshot)

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
 return {'aspectRatio':snap.get('aspectRatio'),'visualTone':snap.get('visualTone','custom'),'shotDensity':snap.get('shotDensity','standard'),'continuity':snap.get('continuity',True),'guideFromPrev':snap.get('guideFromPrev',False),'referenceRoles':{r['id']:r.get('role','general') for r in snap['refs'] if r.get('id')},'references':copy.deepcopy(snap['refs']),'segments':out,'duration':snap['duration'],'signature':snap['signature'],'ruleIds':[r['id'] for r in snap['rules']],'originalStory':snap['story'],'pendingImage':{'name':snap['plannedAttachment']['name'],'number':snap['plannedAttachment']['number']} if snap.get('plannedAttachment') else None}

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
  created=append_plan(s,p,r,edits,row['id'],(task_backend.manager(s).input(row) or {}) if r.get('pendingImage') else {},legacy_copy)
  s.save(p);task_backend.manager(s).patch(row['id'],appliedAt=__import__('time').strftime('%Y-%m-%d %H:%M:%S'))
  return {'project':p,'created':created}


def append_plan(s,p,r,edits,plan_id,snapshot,copy_plan=False):
 """Append a validated plan on an in-memory project; caller owns the save gate."""
 from prompt_review import references,normalize
 import planning_backend as planning
 if r.get('pendingImage') and not copy_plan:
  import agent_backend as agent
  image=snapshot.get('plannedAttachment')
  if not image:raise ValueError('规划附图已丢失，请重新规划')
  asset,_=agent.add_attachment(s,p,image)
  if asset['pictureNumber']!=image['number']:raise ValueError('素材编号已变化，请重新规划')
 additions=[];source_assets=project_assets(s,p);numbers={a.get('pictureNumber',p['assets'].index(a)+1):a for a in source_assets};next_number=max([a.get('pictureNumber',i+1) for i,a in enumerate(p.get('assets',[]))]+[0])+1
 resolved_roles=copy.deepcopy(r.get('referenceRoles',{}))
 used_bindings={n for seg in r['segments'] for h in seg.get('shots',[]) for n in h.get('referenceNumbers',[])}
 for ref in r.get('references',[]):
  if ref['number'] not in used_bindings:continue
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
  seg={'id':s.uid(),'title':edit['title'][:200],'storyText':edit['storyText'],'duration':item.get('duration',r['duration']),'originalDuration':item.get('duration',r['duration']),'prompt':'','originalPrompt':'','shots':copy.deepcopy(item['shots']),'refs':[],'continuity':bool(p['segments'] or additions) and r.get('continuity',True),'guideFromPrev':bool(p['segments'] or additions) and r.get('guideFromPrev',False),'dialogueLanguage':item['dialogueLanguage'],'writingRuleIds':r['ruleIds'],'planning':{'h3PromptVersion':2,'visualTone':r.get('visualTone','custom'),'shotDensity':r.get('shotDensity','standard'),'referenceRoles':copy.deepcopy(resolved_roles),'summary':item['summary'],'warnings':[w['message'] for w in r.get('warnings',[]) if isinstance(w,dict) and w.get('segment')==i]+(['规划后的剧情已手动调整，请核对镜头与剧情一致性'] if edit['storyText']!=item['storyText'] else [])},'videos':[]}
  texts=[seg['storyText'],seg['planning']['summary']]+[sh.get(k,'') for sh in seg['shots'] for k in planning.FIELDS if k!='dialogue']
  used=set().union(*(references(v) for v in texts))|{n for h in seg['shots'] for n in h.get('referenceNumbers',[])}
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
   for k in planning.FIELDS:sh[k]=planning.map_dialogue_speakers(sh.get(k,''),lambda n:mapping.get(n,n)) if k=='dialogue' else normalize(sh.get(k,''),lambda n:mapping[n])
  active=[a for a in p['assets'] if a.get('pictureNumber') in set(mapping.values()) and a.get('path') and not a.get('deleted') and s.generation_backend.media_type(a)=='image' and (a.get('scope','public')=='public' or a.get('segmentId')==seg['id'])]
  refs=[{'index':a.get('pictureNumber',p['assets'].index(a)+1),'name':a['name'],'kind':a.get('kind',''),'description':a.get('description','')} for a in active]
  seg['prompt']=s.rebuild({**seg,'defaultDialogueLanguage':seg['dialogueLanguage'],'assetReferences':refs});additions.append(seg)
 if r.get('guideFromPrev'):p['directorGuide']={**s.guide_settings(p),'continuityEnabled':True}
 p['segments'].extend(additions)
 p.setdefault('storyPlans',[]).append({'id':s.uid() if copy_plan else plan_id,'createdAt':__import__('time').time(),'templates':copy.deepcopy(additions),'source':copy.deepcopy(r),'integrity':digest(additions)})
 return len(additions)


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


DENSITIES={'standard':(2,3),'compact':(3,4),'long':(1,2)}
TONES={'commercial':'商业广告 · 干净明亮自然光','cyberpunk':'赛博朋克 · 冷蓝霓虹对撞','film':'电影质感 · 高反差暗调胶片','anime':'日系动漫 · 清新通透高明度','custom':'自定义描述，沿用剧情原文'}
def planning_options(body,p):
 aspect=body.get('aspectRatio',p.get('aspect') or '9:16');tone=body.get('visualTone','custom');density=body.get('shotDensity','standard')
 if aspect not in p_aspects():raise ValueError('规划画幅无效')
 if tone not in TONES or density not in DENSITIES:raise ValueError('规划影调或镜头密度无效')
 return {'aspectRatio':aspect,'visualTone':tone,'shotDensity':density,'visualToneInstruction':TONES[tone]}
def p_aspects():
 import server
 return server.ASPECTS

def decode_plan(raw):
 import planning_backend
 return planning_backend.decode(raw)

def normalize_plan_structure(result,infer=False):
 result=copy.deepcopy(result);kept=[];notes=[]
 for row in result.get('segments',[]):
  if not row.get('shots') and re.search(r'收尾|结尾说明|本段为',str(row.get('title',''))):
   notes.append({'message':'已将无镜头的收尾说明移出片段列表，原始输出仍保留'});continue
  if infer and row.get('shots'):
   ends=[h.get('end') for h in row['shots'] if isinstance(h.get('end'),(int,float)) and not isinstance(h.get('end'),bool)]
   requested=re.search(r'(?:每段|各|每个片段)\s*(\d+(?:\.\d+)?)\s*秒',result.get('originalStory',''))
   target=float(requested[1]) if requested and 1<=float(requested[1])<=60 else max(ends) if ends else None
   if target and row.get('duration',result.get('duration'))!=target:
    row['duration']=target;notes.append({'message':'片段时长已按明确要求或已有镜头结束时间修复，未拉伸镜头'})
  kept.append(row)
 result['segments']=kept;result.setdefault('warnings',[]).extend(notes);return result


def recover(s,raw,snap):
 """Always keep model output available; only strict validation grants apply permission."""
 try:obj=decode_plan(raw) if isinstance(raw,str) else copy.deepcopy(raw)
 except (ValueError,TypeError) as error:
  return {'segments':[],'duration':snap.get('duration',15),'signature':snap.get('signature',''),'warnings':[{'message':'输出解析失败，可编辑原始输出后重新解析：'+str(error)}],'blockingIssues':[str(error)],'originalStory':snap.get('story','')}
 try:
  result=validate(s,copy.deepcopy(obj),snap);result['warnings']=[];result['blockingIssues']=[]
 except (ValueError,TypeError,KeyError,OverflowError) as error:
  rows=obj.get('segments',[]) if isinstance(obj,dict) else [];out=[]
  for row in rows[:20] if isinstance(rows,list) else []:
   if not isinstance(row,dict):continue
   shots=[]
   for h in row.get('shots',[])[:40] if isinstance(row.get('shots'),list) else []:
    if not isinstance(h,dict):continue
    sh={k:copy.deepcopy(h.get(k,'')) for k in ['start','end',*__import__('planning_backend').FIELDS]}
    try:sh['dialogue']=__import__('planning_backend').dialogue_text(sh['dialogue'])
    except ValueError:sh['dialogue']=str(sh['dialogue'])
    sh['professional']=copy.deepcopy(h.get('professional',{}));sh['dialogueLanguage']=h.get('dialogueLanguage','');sh['referenceNumbers']=copy.deepcopy(h.get('references',h.get('referenceNumbers',[])));sh['id']=s.uid();shots.append(sh)
   out.append({'title':str(row.get('title','待核对片段')),'storyText':str(row.get('story',row.get('storyText',''))),'summary':str(row.get('summary','')),'duration':row.get('duration',snap.get('duration',15)),'dialogueLanguage':str(row.get('language',snap.get('dialogueLanguage','auto'))),'shots':shots})
  result={'segments':out,'duration':snap.get('duration',15),'signature':snap.get('signature',''),'references':copy.deepcopy(snap.get('refs',[])),'referenceRoles':{r['id']:r.get('role','general') for r in snap.get('refs',[]) if r.get('id')},'ruleIds':[r['id'] for r in snap.get('rules',[])],'originalStory':snap.get('story',''),'continuity':snap.get('continuity',True),'guideFromPrev':snap.get('guideFromPrev',False),'pendingImage':{'name':snap['plannedAttachment']['name'],'number':snap['plannedAttachment']['number']} if snap.get('plannedAttachment') else None,'aspectRatio':snap.get('aspectRatio'),'visualTone':snap.get('visualTone','custom'),'shotDensity':snap.get('shotDensity','standard'),'warnings':[{'message':str(error)}],'blockingIssues':[str(error)]}
 for i,segment in enumerate(result['segments']):
  segment.setdefault('duration',result['duration']);lo,hi=DENSITIES.get(snap.get('shotDensity','standard'),(2,3))
  if 'shotDensity' in snap and not lo<=len(segment.get('shots',[]))<=hi:result['warnings'].append({'segment':i,'message':'镜头数量不在本次密度目标内，请核对节奏'})
  for j,h in enumerate(segment.get('shots',[])):
   from prompt_review import references
   refs=h.get('referenceNumbers',[]);used=references(h.get('action','')) if isinstance(h.get('action'),str) else set()
   if not isinstance(refs,list) or used-set(n for n in refs if isinstance(n,int)):
    result['warnings'].append({'segment':i,'shot':j,'message':'引用需确认：画面描述与素材绑定不一致，未自动替换素材'})
 return normalize_plan_structure(result,infer=snap.get('inferAgentDuration',False))

def refresh_plan_references(s,p,result):
 """Match stable IDs first, then unique identical bytes; never guess a replacement."""
 from prompt_review import normalize
 result=copy.deepcopy(result);live=project_assets(s,p);old=result.get('references',[]);mapping={};missing=[]
 for ref in old:
  match=next((a for a in live if a['id']==ref.get('id')),None)
  if not match and ref.get('mediaHash'):
   matches=[a for a in live if digest(p.get('media',{}).get(a.get('path'),''))==ref['mediaHash']]
   if len(matches)==1:match=matches[0]
  if match:mapping[ref['number']]=match.get('pictureNumber',p['assets'].index(match)+1)
  else:missing.append({**ref,'missing':True})
 for seg in result.get('segments',[]):
  for k in ['storyText','summary']:seg[k]=normalize(seg.get(k,''),lambda n:mapping.get(n,n))
  for h in seg.get('shots',[]):
   for k in __import__('planning_backend').FIELDS:
    if k!='dialogue' and isinstance(h.get(k),str):h[k]=normalize(h[k],lambda n:mapping.get(n,n))
   h['referenceNumbers']=[mapping.get(n,n) for n in h.get('referenceNumbers',[]) if isinstance(n,int)]
 result['references']=[{'id':a['id'],'number':a.get('pictureNumber',p['assets'].index(a)+1),'name':a['name'],'kind':a.get('kind',''),'role':'general','sourceHash':digest({k:a.get(k) for k in ['id','path','description','kind']}),'mediaHash':digest(p.get('media',{}).get(a.get('path'),''))} for a in live]
 if result.get('pendingImage'):
  pending=next((r for r in old if r.get('number')==result['pendingImage']['number']),None)
  if pending and not any(r['number']==pending['number'] for r in result['references']):result['references'].append(pending)
 result['missingReferences']=missing;result['referenceRemap']=mapping
 return result


def validate_edits(s,result,edits):
 """Content warnings never gate append. Reject only unusable structure/timing."""
 from prompt_review import references,normalize
 import planning_backend as planning
 if not isinstance(edits,list) or not 1<=len(edits)<=20:raise ValueError('请选择 1–20 个有效片段')
 out=[];warnings=[];available={r['number']:r for r in result.get('references',[]) if not r.get('missing')}
 def warn(i,j,message):warnings.append({'segment':i,'shot':j,'message':message})
 for i,edit in enumerate(edits):
  if not isinstance(edit,dict):raise ValueError('片段草稿格式无效')
  duration=edit.get('duration',result.get('duration',15))
  if isinstance(duration,bool) or not isinstance(duration,(int,float)) or not math.isfinite(duration) or not 1<=duration<=60:raise ValueError(f'第 {i+1} 段时长须为 1–60 秒')
  rows=edit.get('shots',[])
  if not isinstance(rows,list) or len(rows)>40:raise ValueError(f'第 {i+1} 段镜头列表无效')
  if not rows:warn(i,None,'空片段已跳过，未创建零镜头占位片段');continue
  clean=[];previous=0
  for j,h in enumerate(rows):
   if not isinstance(h,dict):raise ValueError(f'第 {i+1} 段镜头格式无效')
   try:start=float(h['start']);end=float(h['end'])
   except (ValueError,KeyError,TypeError):raise ValueError(f'第 {i+1} 段第 {j+1} 镜头时间不是有效数字')
   if not math.isfinite(start+end) or start<0 or end<=start or end>duration+.05:raise ValueError(f'第 {i+1} 段第 {j+1} 镜头时间须在 0–{duration} 秒内且结束晚于开始')
   if abs(start-previous)>.05:warn(i,j,'镜头时间存在空隙或重叠，已保留编辑值，请核对')
   previous=end;shot=copy.deepcopy(h);shot.update(id=h.get('id') or s.uid(),start=start,end=end)
   for k in planning.FIELDS:
    v=h.get(k,'');v=planning.dialogue_text(v) if k=='dialogue' else '' if v is None else v
    if not isinstance(v,str) or len(v)>20000:raise ValueError(f'第 {i+1} 段第 {j+1} 镜头字段 {k} 格式或长度无效')
    shot[k]=v
   if references(shot['dialogue'])-set(available):warn(i,j,'对白含历史素材编号，已保留原话；说话人关联请在画布核对')
   selected=h.get('referenceNumbers',h.get('references',[]))
   if not isinstance(selected,list):selected=[];warn(i,j,'素材绑定格式无效，已保留为未绑定镜头')
   used=references(shot['action']);refs=set(n for n in selected if isinstance(n,int) and not isinstance(n,bool))|used
   unknown=refs-set(available)
   if unknown:warn(i,j,'素材已失效：'+', '.join('Picture '+str(n) for n in sorted(unknown))+'；未猜测替换，已解除失效绑定')
   for k in planning.FIELDS:
    if k!='dialogue':shot[k]=normalize(shot[k],lambda n:n if n in available else '[缺失素材 '+str(n)+']') if references(shot[k])<=set(available) else re.sub(r'@?Picture\s+(\d+)',lambda m:m[0] if int(m[1]) in available else '[缺失素材 '+m[1]+']',shot[k])
   shot['referenceNumbers']=sorted(refs&set(available));
   if shot['referenceNumbers'] and not (used&set(available)) and shot['action'].strip():shot['action']=' '.join('@Picture '+str(n) for n in shot['referenceNumbers'])+' · '+shot['action']
   shot['assetIds']=[available[n]['id'] for n in shot['referenceNumbers'] if available[n].get('id')]
   if available and not shot['referenceNumbers']:warn(i,j,'未绑定素材；按当前文字应用，可在画布补选')
   if not shot['startState'].strip() or not shot['endState'].strip():warn(i,j,'起始 / 结束空间状态未填写，已保留为空')
   if not shot['action'].strip():warn(i,j,'画面动作未填写，已保留为空')
   clean.append(shot)
  if abs(previous-duration)>.05:warn(i,None,'镜头尚未覆盖片段全部时长，未擅自拉伸')
  segment=copy.deepcopy(edit);segment.update(title=str(edit.get('title') or f'片段 {i+1}')[:200],storyText=str(edit.get('storyText') or '待补充剧情'),summary=str(edit.get('summary') or ''),duration=duration,dialogueLanguage=str(edit.get('dialogueLanguage') or 'auto'),shots=clean)
  for k in ['storyText','summary']:segment[k]=re.sub(r'@?Picture\s+(\d+)',lambda m:m[0] if int(m[1]) in available else '[缺失素材 '+m[1]+']',segment[k])
  out.append(segment)
 if not out:raise ValueError('没有可应用的镜头，请先添加镜头；草稿已保留')
 return {**copy.deepcopy(result),'segments':out,'warnings':warnings,'blockingIssues':[]}
