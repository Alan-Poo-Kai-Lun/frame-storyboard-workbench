"""Shot parameters and vision analysis, with explicit user-reviewed application."""
import copy,json,mimetypes,re
FIELDS={'size':'景别','angle':'机位','composition':'构图','lighting':'光线','palette':'色调','movement':'运镜','lens':'焦段','depth':'景深','environment':'环境与氛围','style':'画面风格 / 材质','aspect':'画幅比例','motion':'快门与速度感'}
REFERENCE=re.compile(r'(?:@|<)Picture\s+(\d+)\b>?',re.I)
def image_paths(shot):
 return list(dict.fromkeys(x for x in [shot.get('firstFrame') or shot.get('image'),shot.get('lastFrame')] if x))
def keep_references(old,value):
 present={m[1] for m in REFERENCE.finditer(value)}
 refs=list(dict.fromkeys('@Picture '+m[1] for m in REFERENCE.finditer(old) if m[1] not in present))
 return ('参考绑定：'+'、'.join(refs)+'。\n' if refs else '')+value
def professional_text(shot):
 return '；'.join(label+'：'+str(shot.get('professional',{}).get(key,'')) for key,label in FIELDS.items() if shot.get('professional',{}).get(key))
def enqueue_analysis(s,body):
 import task_backend as tasks
 p=s.load_project()
 if not p or p['projectId']!=body.get('projectId'):raise ValueError('项目已切换')
 segment=next((v for v in p['segments'] if v['id']==body.get('segmentId')),None)
 if not segment:raise ValueError('片段不存在')
 cfg=copy.deepcopy(s.settings().get('ai',{}));cfg['model']=body.get('model') or cfg.get('model','')
 if not cfg['model']:raise ValueError('请先选择支持图片的视觉模型')
 mode=body.get('strategy','overwrite')
 if mode not in ['overwrite','append','skip']:raise ValueError('未知解析策略')
 ids=body.get('shotIds') or [h['id'] for h in segment['shots']];rows=[];skipped=[]
 for sh in segment['shots']:
  if sh['id'] not in ids:continue
  if mode=='skip' and sh.get('action'):skipped.append(sh['id']);continue
  paths=image_paths(sh)
  if not paths or any(x not in p['media'] for x in paths):skipped.append(sh['id']);continue
  snap={'shot':copy.deepcopy(sh),'images':[{'path':x,'b64':p['media'][x]} for x in paths],'intent':p.get('intent',{}),'aspect':p.get('aspect'),'segmentTitle':segment['title']}
  payload={'projectId':p['projectId'],'segmentId':segment['id'],'shotId':sh['id'],'strategy':mode,'title':segment['title']+' · 镜头 '+str(segment['shots'].index(sh)+1)+' 解析'}
  rows.append(tasks.manager(s).add('analysis',payload,cfg,snap)['id'])
 return {'ids':rows,'skipped':skipped}
def analyze(s,cfg,snapshot,payload):
 prompt='分析所提供的镜头图片，顺序为首帧/镜头图、可选尾帧。只输出 JSON，字段 action,camera,expression,sound,professional,uncertainties。professional 可包含 size,angle,composition,lighting,palette,movement,lens,depth。只描述可见事实；单张图不能断言实际动作、运镜或精确焦段，不确定内容写入 uncertainties；不要推断台词或听不到的声音，sound 留空。不要把角色设定板误当成真实连续镜头。结合创作意图但不得捏造画面。'
 text=json.dumps({'intent':snapshot.get('intent'),'aspect':snapshot.get('aspect'),'duration':snapshot['shot']['end']-snapshot['shot']['start']},ensure_ascii=False)
 if cfg.get('provider')=='ollama':user={'role':'user','content':text,'images':[i['b64'] for i in snapshot['images']]}
 else:
  content=[{'type':'text','text':text}]
  for im in snapshot['images']:content.append({'type':'image_url','image_url':{'url':'data:'+(mimetypes.guess_type(im['path'])[0] or 'image/png')+';base64,'+im['b64']}})
  user={'role':'user','content':content}
 raw=s.ai_call(cfg,[{'role':'system','content':prompt},user],True);obj=json.loads(re.sub(r'^```(?:json)?\s*|\s*```$','',raw.strip()))
 if not isinstance(obj,dict):raise ValueError('解析没有返回 JSON 对象')
 def clean(value,limit=6000):
  if value is None:return ''
  if not isinstance(value,str):raise ValueError('解析描述必须是文本，请重试')
  return REFERENCE.sub('',value).strip()[:limit]
 uncertainty=obj.get('uncertainties','')
 if isinstance(uncertainty,list):uncertainty='；'.join(str(v) for v in uncertainty)
 result={k:clean(obj.get(k,'')) for k in ['action','camera','expression']};result.update(sound='',uncertainties=clean(uncertainty));pro=obj.get('professional',{}) or {}
 if not isinstance(pro,dict):raise ValueError('镜头参数格式错误')
 result['professional']={k:clean(pro[k],120) for k in FIELDS if k in pro};result['sourceImages']=[i['path'] for i in snapshot['images']];return result
def apply_analysis(s,body):
 import task_backend as tasks
 manager=tasks.manager(s);row=manager.get(body.get('id'))
 if not row or row['type']!='analysis' or row['status']!='done':raise ValueError('解析任务尚未完成')
 with s.LOCK:
  p=s.load_project()
  if p['projectId']!=row['projectId']:raise ValueError('项目已切换')
  segment=next((v for v in p['segments'] if v['id']==row['segmentId']),None);sh=next((h for h in segment['shots'] if h['id']==row['shotId']),None) if segment else None
  if not sh:raise ValueError('原镜头已删除')
  snapshot=manager.input(row) or {};images=snapshot.get('images',[])
  if images and (image_paths(sh)!=[im['path'] for im in images] or any(p.get('media',{}).get(im['path'])!=im['b64'] for im in images)):raise ValueError('镜头图片已替换，请重新解析，旧结果未应用')
  strategy=body.get('strategy') or row['payload']['strategy'];result=row['result']
  if strategy not in ['overwrite','append','skip']:raise ValueError('未知应用策略')
  if strategy=='skip' and sh.get('action'):return {'project':p,'message':'镜头已有描述，已跳过'}
  for k in ['action','camera','expression']:
   value=result.get(k,'')
   if not value:continue
   sh[k]=((sh.get(k,'')+'\n'+value).strip() if strategy=='append' and value not in sh.get(k,'') else keep_references(sh.get(k,''),value) if strategy!='append' else sh.get(k,''))
  sh.setdefault('professional',{}).update({k:v for k,v in result['professional'].items() if v and (strategy!='append' or not sh['professional'].get(k))})
  refs=[{'index':a.get('pictureNumber',p['assets'].index(a)+1),'name':a['name'],'kind':a['kind'],'description':a.get('description','')} for a in s.scoped_assets(p,segment)]
  segment['prompt']=s.rebuild({**segment,'defaultDialogueLanguage':p.get('dialogueLanguage',''),'assetReferences':refs});s.save(p)
 manager.patch(row['id'],appliedAt=__import__('time').strftime('%Y-%m-%d %H:%M:%S'))
 return {'project':p,'message':'解析已应用；时间、台词和图片引用保留'}
