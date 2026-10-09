"""Reference-aware planning, spatial review and guarded application."""
import copy,hashlib,json,math,re
import asset_analysis as assets
from prompt_review import normalize,references,generation_description,quality,scene_layout
SYSTEM='''你是电影分镜导演。用中文输出 JSON 对象，含 summary, shots, warnings。每个镜头包含 start,end,action,camera,dialogue,sound,expression,startState,endState。时间单位秒，从0连续覆盖指定时长，无重叠间隙。每镜头单一可执行动作，动作和摄影机分开，克制镜头数量。使用已确认的文字素材说明，保持身份服装及场景结构；本次没有图片输入，说明内的不确定内容不得当事实。用户剧本要求的新动作与场景变化可以发生，但必须写明过程，不能把参考图姿势当必须固定的剧情。使用给定本片段的 @Picture N 编号，不发明编号。对白保持实际台词，不放参考标签，无指定台词不要创造。不要旁白。
startState/endState 明确参与者身份、在场景中的相对位置、朝向、彼此距离（不确定时用远/近，不能虚构测量）、姿态、关键物件与服装状态。站位属于场景坐标，屏幕左右只描述此机位中的投影；换机位不等于人物换位。动作明确施动者、目标、接触部位、移动路径与结果。双人互动面对对方而非镜头，除非剧本明确要求。交代背靠背到面对面、站立到倒地等过渡。结合提供的上一段结束状态，避免跳跃或重复上一段。上下镜头连续；单张图不能确认的隐藏空间写 warnings。不要将多步高速复杂格斗塞进一个短镜头。'''
SYSTEM+=' 已确认 sceneLayout 是场景布局硬约束。基准左右只适用于所写基准机位；改变机位须交代摄影机位置和左右投影，不能把展示柜与服务柜台互换。看不到的入口、背面、跨场景通路不得猜测；无法实现的动作写 warnings。每镜头绑定明确场景 Picture；不要混合其他场景参考。封闭玻璃柜不可直接穿过玻璃拿手机，先交代工作人员开柜或提供展示样机。优先采用参考图支持的机位。'
SYSTEM+=' 素材编号是硬约束：性别代词不一致不能更换施动者、受击者或剧情结果，按明确 Picture 编号执行并提示代词歧义。summary 必须由最终 shots 提炼，不得出现另一版结局。未指定背靠背不要增加背靠背；互相挑衅、对峙默认面对对方。攻击目标是对手，特写只改变摄影机位置，不能写成向镜头出拳。每次接触写攻击者、身体部位、目标、接触与结果；远距离到近身必须先靠近。人物设定板的白底、多视图排版和展示布光不是视频背景。衣物变化只按故事指定对象发生，其他角色保持服装。'
REVIEW='''你是分镜连续性审查导演。依据剧本、素材视觉档案、上一段和候选分镜，返回 JSON：summary,shots,warnings。shots 必须包含 start,end,action,camera,dialogue,sound,expression,startState,endState。保留总时长、原台词及故事意图，时间连续。修正：打斗朝镜头而非对手、无转身过程、人物无故换位、视线轴线跳跃、场景布局冲突、过多动作导致无法执行、片段接续跳跃和参考编号混乱。不确定几何不能编造。startState/endState 为清晰中文文本，明确人物的场景位置与朝向及动作结果。已修正项和仍需用户确认的不确定项写 warnings；不要声称必然生成成功。只使用素材档案中给定编号。'''
FIELDS=['action','camera','dialogue','sound','expression','startState','endState']
def canonical_numbers(value):
 if isinstance(value,float) and math.isfinite(value) and value.is_integer():return int(value)
 if isinstance(value,dict):return {k:canonical_numbers(v) for k,v in value.items()}
 if isinstance(value,list):return [canonical_numbers(v) for v in value]
 return value
def text(value):return json.dumps(canonical_numbers(value),ensure_ascii=False,sort_keys=True)
def shot_data(segment):
 rows=[{k:sh.get(k,'') for k in ['start','end',*FIELDS,'professional','dialogueLanguage']} for sh in segment.get('shots',[])]
 for row in rows:row['professional']={k:v for k,v in (row['professional'] or {}).items() if v} if isinstance(row['professional'],dict) else {};row['dialogueLanguage']=row['dialogueLanguage'] or ''
 return rows
def previous(s,p,segment):
 i=p['segments'].index(segment)
 if not segment.get('continuity') or i==0:return None
 prev=p['segments'][i-1];active=s.scoped_assets(p,segment);old=s.scoped_assets(p,prev)
 mapping={}
 for a in old:
  origin=a.get('originAssetId') or a['id']
  match=next((b for b in active if b['id']==a['id'] or (b.get('originAssetId') or b['id'])==origin),None)
  mapping[a.get('pictureNumber',p['assets'].index(a)+1)]=active.index(match)+1 if match else None
 def convert(value):
  def repl(m):
   n=int(m[1]);return '@Picture '+str(mapping[n]) if mapping.get(n) else '[上一段未在本组绑定的素材 '+str(n)+']'
  from prompt_review import REF
  return REF.sub(repl,value or '')
 last=prev.get('shots',[])[-1:]
 return {'segmentId':prev['id'],'title':prev['title'],'story':convert(prev.get('storyText','')),'lastShots':[{k:(map_dialogue_speakers(sh.get(k,''),lambda n:mapping[n] if mapping.get(n) else '未绑定素材 '+str(n)) if k=='dialogue' else convert(sh.get(k,''))) if k in FIELDS else sh.get(k,'') for k in ['start','end',*FIELDS]} for sh in prev.get('shots',[])[-3:]],'endState':convert(last[0].get('endState','')) if last else '', 'uncertainty':'以实际已有镜头文本推导承接；未写明的位置不得视为已确认。缺少上一段素材绑定时提示用户。'}
def source_document(s,p,segment):
 # No derived planning metadata: survives application, changes with editable sources.
 return canonical_numbers({'story':segment.get('storyText',p.get('script','')),'duration':segment['duration'],'aspect':p.get('aspect'),'intent':p.get('intent') or {},'dialogueLanguage':p.get('dialogueLanguage') or '', 'continuity':bool(segment.get('continuity')),'shots':shot_data(segment),'previous':previous(s,p,segment),'assets':[{'id':a['id'],'number':a.get('pictureNumber',p['assets'].index(a)+1),'signature':assets.signature(a,p['media'])} for a in s.scoped_assets(p,segment)]})
def source_signature(s,p,segment):return hashlib.sha256(text(source_document(s,p,segment)).encode()).hexdigest()
def legacy_matches(s,p,segment,signature):
 # V2.5/2.6 used JSON numeric representation in the hash. Test the known
 # browser/Python representations, without treating real edits as unchanged.
 import itertools
 doc={'story':segment.get('storyText',p.get('script','')),'duration':segment['duration'],'aspect':p.get('aspect'),'intent':p.get('intent'),'dialogueLanguage':p.get('dialogueLanguage'),'continuity':segment.get('continuity'),'shots':[{k:sh.get(k,'') for k in ['start','end',*FIELDS,'professional','dialogueLanguage']} for sh in segment.get('shots',[])],'previous':previous(s,p,segment),'assets':[{'id':a['id'],'number':a.get('pictureNumber',p['assets'].index(a)+1),'signature':assets.signature(a,p['media']),'facts':a.get('vision',{}).get('facts')} for a in s.scoped_assets(p,segment)]}
 def numbers(value,as_float):
  if isinstance(value,(int,float)) and not isinstance(value,bool):return float(value) if as_float else canonical_numbers(value)
  if isinstance(value,dict):return {k:numbers(v,as_float) for k,v in value.items()}
  if isinstance(value,list):return [numbers(v,as_float) for v in value]
  return value
 for flags in itertools.product([None,False,True],repeat=3):
  candidate=copy.deepcopy(doc)
  for key,flag in zip(['duration','shots','previous'],flags):
   if flag is not None:candidate[key]=numbers(candidate[key],flag)
  if hashlib.sha256(json.dumps(candidate,ensure_ascii=False,sort_keys=True).encode()).hexdigest()==signature:return True
 return False

def application_check(s,body):
 import task_backend as tasks
 m=tasks.manager(s);row=m.get(body.get('id'))
 if not row or row['type']!='planning' or row['status']!='done':raise ValueError('拆镜任务尚未完成')
 result=row['result']
 if not result.get('textOnly'):raise ValueError('升级前任务请重新提交文字拆镜')
 p=s.load_project()
 if not p or p['projectId']!=row['projectId']:raise ValueError('请先打开任务原项目')
 seg=next((v for v in p['segments'] if v['id']==row['segmentId']),None)
 if not seg:raise ValueError('原片段已删除')
 current=source_signature(s,p,seg)
 if float(seg['duration'])!=float(result['duration']):return {'matched':False,'canApply':False,'currentSignature':current,'differences':[f'当前片段时长为 {seg["duration"]} 秒，结果为 {result["duration"]} 秒；请先把片段时长调回结果时长，再应用已有结果。']}
 matched=current==result['sourceSignature'] or (not result.get('sourceDocument') and legacy_matches(s,p,seg,result['sourceSignature']))
 available={a.get('pictureNumber',p['assets'].index(a)+1) for a in s.scoped_assets(p,seg)}
 missing=set(result['refNumbers'])-available
 if missing:return {'matched':False,'canApply':False,'currentSignature':current,'differences':['任务引用的素材不在当前片段中：'+', '.join('Picture '+str(n) for n in sorted(missing))]}
 differences=[];baseline=result.get('sourceDocument')
 if not matched:
  if baseline:
   labels={'story':'本片段剧本','duration':'片段时长','aspect':'画幅','intent':'创作意图','dialogueLanguage':'对白语言','continuity':'文字承接开关','shots':'当前镜头内容','previous':'上一段内容或结束状态','assets':'素材图片、编号或具体说明'}
   now=source_document(s,p,seg)
   differences=[label+'已变化' for key,label in labels.items() if text(baseline.get(key))!=text(now.get(key))]
  if not differences:differences=['旧任务来源已变化，或旧版未保存可比对的来源明细。请对照当前剧本和预览镜头核对。']
 return {'matched':matched,'canApply':True,'currentSignature':current,'differences':differences}
def enqueue(s,body,cached_snapshot=None):
 import task_backend as tasks
 p=s.load_project()
 if not p or p['projectId']!=body.get('projectId'):raise ValueError('项目已切换')
 seg=next((v for v in p['segments'] if v['id']==body.get('segmentId')),None)
 if not seg:raise ValueError('原片段不存在')
 instruction=body.get('instruction','')
 if not isinstance(instruction,str) or not instruction.strip() or len(instruction)>100000:raise ValueError('请填写拆镜要求，最多 100000 字')
 cfg=copy.deepcopy(s.settings().get('ai',{}))
 if not cfg.get('model') or not cfg.get('endpoint'):raise ValueError('请先设置拆镜模型和连接地址')
 duration=float(seg['duration'])
 if not math.isfinite(duration) or duration<=0:raise ValueError('片段时长无效')
 active=s.scoped_assets(p,seg)
 missing=[a.get('name','未命名') for a in active if not assets.valid(a,p.get('media',{}))]
 if missing:raise ValueError('请先确认素材说明：'+'、'.join(missing)+'。可人工确认，或 AI 分析后确认；拆镜不会自动看图。')
 mapping={a.get('pictureNumber',p['assets'].index(a)+1):n for n,a in enumerate(active,1)}
 def convert(value):
  def number(n):
   if n not in mapping:raise ValueError(f'剧本或分镜引用了缺失 / 不属于本组的 Picture {n}')
   return mapping[n]
  return normalize(value,number)
 existing=shot_data(seg)
 for sh in existing:
  for k in FIELDS:
   if k!='dialogue':sh[k]=convert(sh[k])
   else:sh[k]=map_dialogue_speakers(sh[k],lambda n:mapping[n])
 mode=body.get('mode','quick')
 if mode not in ['quick','review']:raise ValueError('未知拆镜模式')
 if mode=='review' and not seg.get('shots'):raise ValueError('请先生成分镜，再选择深度审查')
 snap={'pipelineVersion':25,'smartRepair':bool(body.get('smartRepair')),'mode':mode,'instruction':instruction,'duration':duration,'sourceSignature':source_signature(s,p,seg),'context':{'request':convert(instruction),'story':convert(seg.get('storyText',p.get('script',''))),'aspect':p.get('aspect'),'segmentTitle':seg['title'],'existingShots':existing,'summary':convert(seg.get('planning',{}).get('summary','')),'intent':p.get('intent',{}),'dialogueLanguage':p.get('dialogueLanguage',''),'previousSegment':previous(s,p,seg),'referenceDescriptions':[{'picture':n,'name':a['name'],'kind':a['kind'],'description':convert(generation_description(a)['generation']),'uncertainties':generation_description(a)['uncertainties'],'confirmedBy':a['confirmation']['mode'],'sceneLayout':{k:convert(v) for k,v in scene_layout(a).items()}} for n,a in enumerate(active,1)]},'originalShots':copy.deepcopy(seg.get('shots',[])) if mode=='review' else [],'refNumbers':[a.get('pictureNumber',p['assets'].index(a)+1) for a in active]}
 snap['sourceDocument']=source_document(s,p,seg)
 if cached_snapshot and cached_snapshot.get('modelResponse'):
  if cached_snapshot.get('sourceSignature')!=snap['sourceSignature'] or cached_snapshot.get('mode')!=mode:raise ValueError('来源已变化，不能复用旧输出；请核对后通过 AI 拆镜提交新任务')
  snap['modelResponse']=cached_snapshot['modelResponse']

 m=tasks.manager(s)
 with m.lock:
  if any(r['type']=='planning' and r['projectId']==p['projectId'] and r['segmentId']==seg['id'] and r['status'] in ['waiting','running'] for r in m.rows):raise ValueError('本片段已有拆镜任务，请查看任务进度')
  row=m.add('planning',{'projectId':p['projectId'],'segmentId':seg['id'],'mode':mode,'title':('已有输出重新解析 · ' if snap.get('modelResponse') else '智能修复 · ' if body.get('smartRepair') else ('文字快速拆镜 · ' if mode=='quick' else '深度审查 · '))+seg['title']},cfg,snap)
 return {'id':row['id']}
def smart_repair(s,body):
 p=s.load_project()
 if not p or p.get('projectId')!=body.get('projectId'):raise ValueError('项目已切换，请刷新')
 seg=next((v for v in p['segments'] if v['id']==body.get('segmentId')),None)
 if not seg:raise ValueError('片段不存在')
 issues=quality(s,p,seg)
 if not issues:raise ValueError('本片段没有待修复的检查项')
 if not seg.get('shots'):raise ValueError('本片段没有镜头，请先拆镜')
 instruction='智能修复当前导出检查。以用户故事原文和明确 Picture 编号为最高依据，只修冲突摘要、动作和起止状态；保留镜头数量、时间、对白、音效、素材、视频和故事原文。没有明确依据时保留原内容并列出待人工确认问题，不猜测角色对象或空间位置。摘要必须与修复后的时间线一致。检查项：\n'+'\n'.join(i['message'] for i in issues)
 return enqueue(s,{**body,'mode':'review','instruction':instruction,'smartRepair':True})

def decode(raw):
 obj=json.loads(re.sub(r'^```(?:json)?\s*|\s*```$','',raw.strip()))
 if not isinstance(obj,dict):raise ValueError('AI 未返回分镜对象')
 return obj
def dialogue_text(value,depth=0):
 """Accept explicit dialogue structures, retaining line order and speakers."""
 if depth>8:raise ValueError('对白结构嵌套过深')
 if value is None:return ''
 if isinstance(value,str):return value
 if isinstance(value,list):return '\n'.join(v for v in (dialogue_text(item,depth+1) for item in value) if v)
 if isinstance(value,dict):
  content_keys=['text','content','line','utterance','dialogue','台词','对白']
  speaker_keys=['speaker','character','role','subject','name','who','说话人','角色']
  content=next((k for k in content_keys if k in value),None)
  if content:
   provided=[value[k] for k in content_keys if k in value]
   if any(v!=provided[0] for v in provided[1:]):raise ValueError('对白存在冲突的台词字段，请核对；原始输出已保存')
   extra=set(value)-set(content_keys+speaker_keys+['emotion','tone','language','情绪','语气','语言'])
   if extra:raise ValueError('对白包含未知字段：'+','.join(sorted(extra)))
   line=dialogue_text(value[content],depth+1)
   speaker=next((value[k] for k in speaker_keys if value.get(k) is not None),'')
   if not isinstance(speaker,(str,int)) or isinstance(speaker,bool):raise ValueError('对白说话人格式无效')
   speaker=str(speaker).strip()
   match=re.fullmatch(r'(?:@?<?(?:Picture|Subject)\s*)?(\d+)>?',speaker,re.I)
   if match:speaker='<Picture '+match[1]+'>'
   tone=value.get('tone') or value.get('emotion') or value.get('语气') or value.get('情绪')
   if tone and not isinstance(tone,str):raise ValueError('对白语气必须是文本')
   return ((speaker+('（'+tone+'）' if tone else '')+': ') if speaker else ('（'+tone+'）' if tone else ''))+line if line else ''
  if not value:return ''
  if all(re.fullmatch(r'@?<?(?:Picture|Subject)\s*\d+>?',str(k),re.I) for k in value):return '\n'.join(dialogue_text({'speaker':k,'text':v},depth+1) for k,v in value.items())
 raise ValueError('对白格式无法识别；应为文字、对白数组或 speaker/text 对象，原始输出已保存，可重新解析')

def map_dialogue_speakers(value,number):
 # Only explicit speaker headings; never rewrite words inside spoken lines.
 return re.sub(r'^<Picture\s+(\d+)>(?=(?:（[^\n]*）)?\s*:)',lambda m:'<Picture '+str(number(int(m[1])))+'>',value,flags=re.M)

def validate(s,obj,snapshot):
 shots=obj.get('shots',[])
 if not isinstance(shots,list) or not 1<=len(shots)<=40:raise ValueError('AI 没有返回有效镜头（1–40个）')
 previous_end=0;clean=[];allowed=set(range(1,len(snapshot.get('refNumbers',[]))+1))
 for sh in shots:
  if not isinstance(sh,dict):raise ValueError('AI 镜头格式无效')
  start=float(sh['start']);end=float(sh['end'])
  if not math.isfinite(start) or not math.isfinite(end) or abs(start-previous_end)>.05 or end<=start or end>snapshot['duration']+.05:raise ValueError('AI 时间线不连续或超出时长，请重试')
  start=previous_end
  if abs(end-snapshot['duration'])<=.05:end=snapshot['duration']
  if end<=start:raise ValueError('镜头校正后时长无效')
  fields={}
  for k in FIELDS:
   value=sh.get(k,'')
   if k=='dialogue':value=dialogue_text(value)
   elif value is None:value=''
   if not isinstance(value,str):raise ValueError('分镜字段必须是文本：'+k)
   if len(value)>20000:raise ValueError('分镜字段超过长度上限：'+k+'；原始输出已保存')
   fields[k]=value if k=='dialogue' else normalize(value)
   if k=='dialogue':
    def checked(n):
     if n not in allowed:raise ValueError('对白说话人引用了不存在的素材编号')
     return n
    map_dialogue_speakers(fields[k],checked)
   if k!='dialogue' and references(fields[k])-allowed:raise ValueError('AI 引用了不存在的素材编号，请重试')
  if not fields['action'].strip():raise ValueError('AI 返回了空动作描述，请重新拆镜')
  if not fields['startState'].strip() or not fields['endState'].strip():raise ValueError('AI 未写明镜头起止空间状态，请重新拆镜')
  clean.append({**fields,'id':s.uid(),'start':start,'end':end,'image':'','firstFrame':'','lastFrame':'','locks':{'identity':True,'costume':False,'scene':True,'prop':False}});previous_end=end
 if abs(previous_end-snapshot['duration'])>.05:raise ValueError('AI 镜头未覆盖完整片段，请重试')
 return clean

PATCH_REVIEW='逐项核对已确认 sceneLayout；不要只追加泛泛保持一致。若画面换机位需交代投影变化，固定物件不搬位。无依据的入口和取物路径必须修正或标记不确定。你是分镜审查导演。依据已确认的素材说明、剧本和当前分镜，只输出 JSON 对象：summary（根据修正后镜头同步整理的简短摘要）,warnings（文本数组）, patches（数组）。只指出空间、动作对象或承接问题，并对确需修改的镜头给出局部修改。每项包含 shotIndex（从1开始）,action,camera,expression,startState,endState 中需要修改的字段。不得改变时间线、台词、镜头数量或故事意图；不要重写完整分镜，不确定内容列入 warnings。严格按剧本 Picture 编号保持施动者和受击者；摘要与时间线同一结局，修复朝镜头出拳和距离跳变，不把设定板背景用作视频环境。旧镜头缺少起止状态时必须补齐。无修改则 patches=[]。'
def analyze(s,cfg,snapshot,payload):
 import task_backend as tasks
 ident=payload.get('_taskId')
 if snapshot.get('pipelineVersion')!=25:raise ValueError('这是升级前的多步骤任务，请确认素材说明后重新提交文字拆镜')
 def stage(label):
  if ident:tasks.check_cancel(s,ident);tasks.stage(s,ident,label)
 p=s.load_project();seg=next((v for v in p.get('segments',[]) if v['id']==payload.get('segmentId')),None) if p and p['projectId']==payload.get('projectId') else None
 if not seg or (source_signature(s,p,seg)!=snapshot['sourceSignature'] and not (not snapshot.get('sourceDocument') and legacy_matches(s,p,seg,snapshot['sourceSignature']))):raise ValueError('剧本、素材说明或上一段已改变，请重新提交')
 context=copy.deepcopy(snapshot['context']);context.update(duration=snapshot['duration'],request=context.get('request',snapshot['instruction']))
 for item in context.get('referenceDescriptions',[]):
  projection=generation_description(item)
  item['description']=projection['generation']
  item['uncertainties']=item.get('uncertainties') or projection['uncertainties']
 review=snapshot['mode']=='review'
 stage(('智能修复 · 保留时间和对白，只调整冲突内容' if snapshot.get('smartRepair') else '文字深度审查 · 只返回问题与局部修改') if review else '已确认素材说明 · 一次文字拆镜（不读取图片）')
 callcfg={**cfg,'_outputLimit':int(cfg.get('reviewOutputTokens' if review else 'planningOutputTokens') or cfg.get('maxOutputTokens') or 4096)}
 def model_response(system):
  raw=snapshot.get('modelResponse')
  if raw:
   stage('重新解析已保存的模型输出 · 不调用模型')
   if ident:tasks.manager(s).patch(ident,outputSaved=True)
  else:
   raw=s.ai_call(callcfg,[{'role':'system','content':system},{'role':'user','content':text(context)}],True)
   snapshot['modelResponse']=raw
   if ident:
    m=tasks.manager(s)
    with m.lock:m.store_input(ident,snapshot);m.patch(ident,outputSaved=True)
  return decode(raw)
 if review:
  obj=model_response(PATCH_REVIEW)
  patches=obj.get('patches',[])
  if not isinstance(patches,list) or len(patches)>len(context['existingShots']):raise ValueError('审查修改项格式无效')
  candidate={'shots':copy.deepcopy(context['existingShots'])};seen=set()
  for patch in patches:
   if not isinstance(patch,dict) or not isinstance(patch.get('shotIndex'),int) or not 1<=patch['shotIndex']<=len(candidate['shots']) or patch['shotIndex'] in seen:raise ValueError('审查镜头编号无效')
   seen.add(patch['shotIndex'])
   if set(patch)-{'shotIndex','action','camera','expression','startState','endState'}:raise ValueError('审查不能修改台词或时间线')
   for k,v in patch.items():
    if k!='shotIndex':candidate['shots'][patch['shotIndex']-1][k]=v
  obj={**obj,'shots':candidate['shots'],'summary':obj.get('summary',context.get('summary',''))}
 else:
  obj=model_response(SYSTEM+' 所有分镜字段必须是字符串；dialogue 为含说话人和原台词的文本，无对白用空字符串，不输出对白对象或数组。保持说明准确、简洁；每镜头起止状态各一到两句话。一次完成空间连续性检查，不输出长篇解释。')
 stage('程序检查时间线、素材编号与起止状态')
 summary=obj.get('summary','')
 if not isinstance(summary,str):raise ValueError('摘要必须是文本；原始输出已保存')
 if len(summary)>10000:raise ValueError('摘要超过长度上限；原始输出已保存')
 summary=normalize(summary)
 if references(summary)-set(range(1,len(snapshot['refNumbers'])+1)):raise ValueError('摘要引用了不存在的素材编号；原始输出已保存')
 obj['summary']=summary
 shots=validate(s,obj,snapshot)
 if review:
  for i,sh in enumerate(shots):shots[i]={**snapshot['originalShots'][i],**{k:sh[k] for k in ['start','end',*FIELDS]}}
 warnings=obj.get('warnings',[])
 if not isinstance(warnings,list):warnings=[str(warnings)]
 # Candidate uses local numbers. Check before converting it back to stable
 # project numbers; keep failed quality checks visible instead of discarding
 # a long-running successful inference and forcing the user to retry.
 local=copy.deepcopy(p);local_seg=next(v for v in local['segments'] if v['id']==seg['id'])
 for n,a in enumerate(s.scoped_assets(local,local_seg),1):a['pictureNumber']=n
 local_seg['shots']=shots;local_seg['planning']={'summary':str(obj.get('summary',''))}
 local_seg['storyText']=context['story']
 issues=quality(s,local,local_seg)
 warnings.extend(('需修复：' if i['severity']=='error' else '需核对：')+i['message'] for i in issues)
 if not snapshot['refNumbers']:warnings.append('本片段没有参考素材，按纯文字规划')
 return {'shots':shots,'summary':str(obj.get('summary',''))[:10000],'warnings':[str(w)[:4000] for w in warnings[:40]],'issues':issues,'refNumbers':snapshot['refNumbers'],'duration':snapshot['duration'],'sourceSignature':snapshot['sourceSignature'],'sourceDocument':snapshot.get('sourceDocument'),'smartRepair':bool(snapshot.get('smartRepair')),'textOnly':True,'reviewed':review,'mode':snapshot['mode']}

def apply(s,body):
 import task_backend as tasks
 m=tasks.manager(s);row=m.get(body.get('id'))
 if not row or row['type']!='planning' or row['status']!='done':raise ValueError('拆镜任务尚未完成')
 result=row['result']
 if not result.get('textOnly'):raise ValueError('升级前任务请重新提交文字拆镜')
 with s.LOCK:
  p=s.load_project()
  if not p or p['projectId']!=row['projectId']:raise ValueError('请先打开任务原项目')
  seg=next((v for v in p['segments'] if v['id']==row['segmentId']),None)
  if not seg:raise ValueError('原片段已删除')
  check=application_check(s,body)
  if not check['canApply']:raise ValueError('；'.join(check['differences']))
  if not check['matched'] and body.get('reviewedSourceSignature')!=check['currentSignature']:raise ValueError('来源已改变，旧结果未应用。请先核对变化，再应用已有结果；无需重新拆镜')
  s.archive_shots(seg,'应用 AI 分镜前')
  shots=copy.deepcopy(result['shots']);numbers=result['refNumbers']
  for sh in shots:
   for k in FIELDS:
    if k!='dialogue':sh[k]=normalize(sh[k],lambda n:numbers[n-1])
    else:sh[k]=map_dialogue_speakers(sh[k],lambda n:numbers[n-1])
  if seg.get('prompt'):
   seg['promptHistory']=(seg.get('promptHistory',[])+[{'text':seg['prompt'],'savedAt':__import__('time').strftime('%Y-%m-%d %H:%M:%S'),'reason':'应用素材分析与连续性审查前'}])[-20:]
  seg['prompt']=''
  seg['shots']=shots;seg['planning']={'summary':normalize(result['summary'],lambda n:numbers[n-1]),'warnings':result['warnings'],'mode':result['mode'],'reviewedAt':__import__('time').strftime('%Y-%m-%d %H:%M:%S')}
  refs=[{'index':a.get('pictureNumber',p['assets'].index(a)+1),'name':a['name'],'kind':a['kind'],'description':a.get('description','')} for a in s.scoped_assets(p,seg)]
  seg['prompt']=s.rebuild({**seg,'defaultDialogueLanguage':p.get('dialogueLanguage',''),'assetReferences':refs})
  seg['planning']['sourceSignature']=source_signature(s,p,seg);s.save(p)
 m.patch(row['id'],appliedAt=__import__('time').strftime('%Y-%m-%d %H:%M:%S'))
 blocked=any(i['severity']=='error' for i in quality(s,p,seg))
 return {'project':p,'message':'分镜已保存为待修复草稿；请处理输出检查问题后导出' if blocked else '文字分镜已应用；素材说明保留，不重复看图'}
