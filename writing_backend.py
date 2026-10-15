"""Reusable writing rules and guarded whole-story planning; never applies AI output implicitly."""
import copy,json,math,hashlib
from pathlib import Path

BUILTINS=[
 {'id':'fight','name':'动作导演','category':'动作','description':'打斗、追逐与空间连续性','rules':'按预备、发力、接触、结果、反应安排动作因果。明确施动者、受击者、方向、距离、道具数量与起止状态。每镜头有摄影职责，避免无来源位移、无因果闪切，保留故事和对白。'},
 {'id':'slapstick','name':'弹性喜剧','category':'喜剧','description':'接触形变、升级笑点与恢复节拍','rules':'构建铺垫、触发、可见接触或惯性、弹性形变、反应、恢复和余波。笑点逐步升级且有因果，保留人物身份、服装和环境，动作清楚可见，形变可恢复，无血腥伤害细节。'},
 {'id':'expression','name':'抽象表情','category':'表演','description':'情绪驱动的立体表情与全身反应','rules':'按中性状态、情绪触发、全身预备、立体面部与姿态夸张、短暂停留、弹性恢复推进。同步视线、眉眼、脸颊、下颌、颈肩、手势与重心；保持身份可辨识。图形符号只是辅助，不用贴纸脸或单纯镜头放大替代表演。'}]

def digest(value):return hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def library(s,body=None):
 path=s.DATA/'writing-rules.json'
 with s.LOCK:
  rows=json.loads(path.read_text('utf-8')) if path.exists() else []
  revision=digest(rows)
  if body and body.get('action') in ['save','delete']:
   if body.get('revision')!=revision:raise ValueError('技能库已变化，请刷新后再保存')
   ident=str(body.get('id',''))
   if ident in {x['id'] for x in BUILTINS}:raise ValueError('内置技能请另存为自定义版本')
   if body['action']=='save':
    item={k:str(body.get(k,'')).strip() for k in ['name','category','description','rules']}
    if not item['name'] or not item['rules'] or len(item['name'])>100 or len(item['category'])>100 or len(item['description'])>1000 or len(item['rules'])>6000:raise ValueError('请填写名称与规则，规则最多 6000 字')
    item['id']=ident or s.uid();rows=[r for r in rows if r['id']!=item['id']]+[item]
    if len(rows)>50:raise ValueError('自定义技能最多 50 项')
   else:rows=[r for r in rows if r['id']!=ident]
   temp=path.with_suffix('.tmp');temp.write_text(json.dumps(rows,ensure_ascii=False,indent=2),'utf-8');temp.replace(path);revision=digest(rows)
  return {'revision':revision,'items':[{**r,'builtin':True} for r in BUILTINS]+rows}

def selected(s,p,segment=None,ids=None):
 ids=ids if ids is not None else (segment or {}).get('writingRuleIds',p.get('writingRuleIds',[]))
 if not isinstance(ids,list) or len(ids)>5:raise ValueError('最多选择 5 项写作技能')
 items={r['id']:r for r in library(s)['items']}
 if any(i not in items for i in ids):raise ValueError('选中的写作技能已删除，请重新选择')
 return [copy.deepcopy(items[i]) for i in dict.fromkeys(ids)]

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
  cfg=s.settings().get('ai',{})
  if not cfg.get('model') or not cfg.get('endpoint'):raise ValueError('请先配置文本 AI')
  refs=s.scoped_assets(p)
  rules=selected(s,p,ids=body.get('ruleIds',p.get('writingRuleIds',[])))
  snap={'story':story,'count':count,'duration':duration,'signature':signature(p),'rules':rules,'refs':[{'number':a.get('pictureNumber',p['assets'].index(a)+1),'name':a['name'],'description':a.get('description',''),'confirmed':bool(a.get('confirmation'))} for a in refs]}
  row=task_backend.manager(s).add('story',{'projectId':p['projectId'],'title':'整篇剧情规划 · '+p['title']},cfg,snap)
  return {'id':row['id']}

def analyze(s,cfg,snapshot,payload):
 system='你是剧情分段导演。只输出 JSON：segments 数组，每项 title,story,language,summary,shots。严格等于指定段数；每段 shots 从0开始首尾连续覆盖指定 duration，每项 start,end,action,camera,expression,dialogue,sound,startState,endState。保留故事明确台词、人物、因果与结局，缺少依据不猜测。只使用提供素材编号的 @Picture N；素材说明不是看图结论。语言用 English/Mandarin/Cantonese/Malay 等英文名；未指定语言为空。写作规则仅辅助风格，不得覆盖故事、时长、素材约束或输出结构。片段之间承接上一段结束状态。返回完整结果，不截断。'
 raw=s.ai_call({**cfg,'_outputLimit':16384},[{'role':'system','content':system},{'role':'user','content':json.dumps(snapshot,ensure_ascii=False)}],True)
 return validate(s,json.loads(raw),snapshot)

def validate(s,obj,snap):
 import planning_backend as planning
 from prompt_review import normalize,references
 rows=obj.get('segments') if isinstance(obj,dict) else None
 if not isinstance(rows,list) or len(rows)!=snap['count']:raise ValueError('AI 返回的段数不匹配，原项目未改动')
 numbers=[r['number'] for r in snap['refs']];mapping={n:i+1 for i,n in enumerate(numbers)};out=[]
 for row in rows:
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
  shots=planning.validate(s,candidate,{'duration':snap['duration'],'refNumbers':numbers})
  for h in shots:
   for k in planning.FIELDS:h[k]=planning.map_dialogue_speakers(h[k],lambda n:numbers[n-1]) if k=='dialogue' else normalize(h[k],lambda n:numbers[n-1])
  out.append({'title':row['title'][:200],'storyText':row['story'],'summary':row.get('summary',''),'dialogueLanguage':s.dialogue_language(row.get('language','')),'shots':shots})
 return {'segments':out,'duration':snap['duration'],'signature':snap['signature'],'ruleIds':[r['id'] for r in snap['rules']],'originalStory':snap['story']}

def apply(s,body):
 import task_backend
 with s.LOCK:
  row=task_backend.manager(s).get(body.get('id'))
  if not row or row['type']!='story' or row['status']!='done':raise ValueError('规划任务尚未完成')
  if row.get('appliedAt'):raise ValueError('该结果已应用，不能重复创建')
  p=s.load_project();r=row['result']
  if not p or p['projectId']!=row['projectId'] or signature(p)!=r['signature']:raise ValueError('项目来源已改变，请重新规划；旧结果仍可查看')
  edits=body.get('segments',[])
  if len(edits)!=len(r['segments']):raise ValueError('预览段数不匹配')
  additions=[]
  for i,item in enumerate(r['segments']):
   edit=edits[i]
   if not isinstance(edit,dict) or any(not isinstance(edit.get(k),str) or not edit[k].strip() or len(edit[k])>20000 for k in ['title','storyText']):raise ValueError('请填写有效标题与剧情')
   # Editing a story makes its generated shots a draft needing review; never silently regenerate.
   seg={'id':s.uid(),'title':edit['title'][:200],'storyText':edit['storyText'],'duration':r['duration'],'originalDuration':r['duration'],'prompt':'','originalPrompt':'','shots':copy.deepcopy(item['shots']),'refs':[],'continuity':bool(p['segments'] or additions),'guideFromPrev':False,'dialogueLanguage':item['dialogueLanguage'],'writingRuleIds':r['ruleIds'],'planning':{'summary':item['summary'],'warnings':['规划后的剧情已手动调整，请核对镜头与剧情一致性'] if edit['storyText']!=item['storyText'] else []},'videos':[]}
   seg['prompt']=s.rebuild({**seg,'defaultDialogueLanguage':seg['dialogueLanguage']});additions.append(seg)
  p['segments'].extend(additions);s.save(p);task_backend.manager(s).patch(row['id'],appliedAt=__import__('time').strftime('%Y-%m-%d %H:%M:%S'))
  return {'project':p,'created':len(additions)}
