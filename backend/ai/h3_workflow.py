"""Explicit H3 generation settings and stale-safe application of reviewed edits."""
import copy,json,hashlib,re,time
PRESENTATIONS={'reference','information','overlay','post','screen','frame'}
RETENTIONS={'fully_preserved','partially_preserved','attribute_transfer','weak_reference'}
FIELDS={'action','camera','expression','startState','endState','dialogueLanguage'}

def fingerprint(value):return hashlib.sha256(json.dumps(value,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
def target(s,body):
 p=s.load_project()
 if not p or p['projectId']!=body.get('projectId'):raise ValueError('项目已切换')
 seg=next((v for v in p['segments'] if v['id']==body.get('segmentId')),None)
 if not seg:raise ValueError('原片段已删除')
 return p,seg

def snapshot(s,p,seg):
 i=p['segments'].index(seg)
 return {'segment':copy.deepcopy(seg),'assets':copy.deepcopy(s.scoped_assets(p,seg)),
 'projectLanguage':p.get('dialogueLanguage',''),'previousEnd':copy.deepcopy(p['segments'][i-1]['shots'][-1]) if i and p['segments'][i-1]['shots'] else None,
 'nextStart':copy.deepcopy(p['segments'][i+1]['shots'][0]) if i+1<len(p['segments']) and p['segments'][i+1]['shots'] else None}

def presentation(asset,segment):
 value=segment.get('planning',{}).get('referenceUsage',{}).get(asset['id'],{}).get('presentation')
 if value in PRESENTATIONS:return value
 roles=segment.get('planning',{}).get('referenceRoles',{})
 if roles.get(asset['id'])=='general' and re.search(r'信息图|综合海报|宣传海报|composite poster',str(asset.get('description','')),re.I):return 'information'
 return 'reference' if asset.get('kind') in ('人物','角色','场景','道具') or roles.get(asset['id']) in ('person','scene','product','style') else 'information'

def brief(asset,segment):
 from backend.ai import prompt_review
 usage=segment.get('planning',{}).get('referenceUsage',{}).get(asset['id'],{})
 if usage.get('generationDescription','').strip():return usage['generationDescription'].strip()
 # Prefer preservation facts over photographic setup and presentation-board layout.
 source=prompt_review.generation_description(asset)['generation']
 person=asset.get('kind') in ('人物','角色');budget=280 if person else 360
 clauses=re.split(r'[；;\n]+',source)
 if person:clauses=[c for c in clauses if not re.search(r'人物素材图|右侧展示|正面.*侧面.*背面|全身站姿|未见明显发丝',c)]
 result=[];size=0
 for c in clauses:
  c=c.strip()
  if not c:continue
  if len(c)>budget:continue # Never cut a negation or a reference token in half.
  if size+len(c)>budget:continue
  result.append(c);size+=len(c)+1
 return '；'.join(result) or asset.get('name','Reference')

def settings(s,body):
 with s.LOCK:
  p,seg=target(s,body);snap=snapshot(s,p,seg)
  if body.get('action')!='save':
   return {'sourceHash':fingerprint(snap),'dialogueLanguage':seg.get('dialogueLanguage') or p.get('dialogueLanguage',''),'shots':[{'id':h['id'],'start':h['start'],'end':h['end'],'dialogueLanguage':h.get('dialogueLanguage','')} for h in seg['shots']],
   'assets':[{'id':a['id'],'name':a.get('name',''),'kind':a.get('kind',''),'presentation':presentation(a,seg),'generationDescription':brief(a,seg),'retention':seg.get('planning',{}).get('referenceUsage',{}).get(a['id'],{}).get('retention','fully_preserved')} for a in snap['assets'] if s.generation_backend.media_type(a)=='image']}
  if fingerprint(snap)!=body.get('sourceHash'):raise ValueError('镜头或素材已变化，请重新打开设置；没有保存修改')
  active={a['id'] for a in snap['assets']};usage=body.get('referenceUsage')
  if not isinstance(usage,dict) or set(usage)-active:raise ValueError('素材用途不属于当前片段')
  for v in usage.values():
   if not isinstance(v,dict) or v.get('presentation') not in PRESENTATIONS or v.get('retention') not in RETENTIONS:raise ValueError('素材用途或保留等级无效')
   if not isinstance(v.get('generationDescription'),str) or len(v['generationDescription'])>1500:raise ValueError('生成说明限 1500 字；完整档案保留在素材区')
  lang=body.get('dialogueLanguage','')
  if not isinstance(lang,str) or '\n' in lang or len(lang)>120:raise ValueError('对白语言无效')
  seg.setdefault('planning',{})['referenceUsage']=copy.deepcopy(usage);seg['dialogueLanguage']=s.dialogue_language(lang)
  for row in body.get('shotLanguages',[]):
   h=next((h for h in seg['shots'] if h['id']==row.get('id')),None);value=row.get('language','')
   if not h or not isinstance(value,str) or '\n' in value or len(value)>120:raise ValueError('镜头语言设置无效')
   h['dialogueLanguage']=s.dialogue_language(value)
  seg['promptExportLanguage']='original' # Retain old copies, but never display an obsolete translation.
  s.save(p);return {'project':p}

def apply_review(s,body):
 from backend.services import task_backend
 with s.LOCK:
  p,seg=target(s,body);row=task_backend.manager(s).get(body.get('id'))
  if not row or row['status']!='done' or row['type']!='continuity' or row['projectId']!=p['projectId']:raise ValueError('AI 审查尚未完成或不属于本项目')
  result=row['result']
  if result.get('segmentId')!=seg['id'] or result.get('liveHash')!=fingerprint(snapshot(s,p,seg)):raise ValueError('审查后镜头、素材或相邻状态已改变，请重新审查；没有应用修改')
  changes=body.get('changes')
  if not isinstance(changes,list) or not changes or len(changes)>500:raise ValueError('请选择修改建议')
  allowed={(v['segment'],v['shot'],v['field']):v for v in result['changes']};seen=set()
  for c in changes:
   key=(c.get('segment'),c.get('shot'),c.get('field'))
   if key not in allowed or key in seen or c.get('before')!=allowed[key]['before']:raise ValueError('修改不属于本次审查')
   seen.add(key);field=c['field'];after=c.get('after');h=seg['shots'][c['shot']]
   if field not in FIELDS or h.get(field,'')!=c['before'] or not isinstance(after,str) or len(after)>20000:raise ValueError('字段内容已变化或无效')
   if field=='dialogueLanguage' and ('\n' in after or len(after)>120):raise ValueError('对白语言无效')
   refs={str(a.get('pictureNumber')) for a in s.scoped_assets(p,seg)}
   if set(re.findall(r'<?@?Picture\s+(\d+)',after,re.I))-refs:raise ValueError('建议包含未知素材')
  seg.setdefault('shotHistory',[]).append({'savedAt':time.strftime('%Y-%m-%d %H:%M:%S'),'reason':'应用 AI 连续性审查前','duration':seg['duration'],'planning':copy.deepcopy(seg.get('planning')),'shots':copy.deepcopy(seg['shots']),'prompt':seg.get('prompt','')})
  seg['shotHistory']=seg['shotHistory'][-100:]
  for c in changes:seg['shots'][c['shot']][c['field']]=c['after']
  seg.setdefault('planning',{})['h3Review']={'taskId':row['id'],'sourceHash':result['sourceHash'],'appliedAt':time.strftime('%Y-%m-%d %H:%M:%S'),'changes':copy.deepcopy(changes)}
  seg['promptExportLanguage']='original' # Retain old copies, but never display an obsolete translation.
  s.save(p);return {'project':p}
