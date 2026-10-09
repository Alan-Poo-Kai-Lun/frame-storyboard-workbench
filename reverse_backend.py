"""Editable reverse-prompt templates and queued visual analysis of images/video samples."""
import base64,copy,json,math,re

def templates(s):
 path=s.DATA/'reverse-templates.json'
 if not path.exists():path=s.ROOT/'presets/reverse-prompt-defaults.json'
 return json.loads(path.read_text('utf-8'))

def update_template(s,body):
 with s.LOCK:
  rows=templates(s);ident=str(body.get('id') or s.uid())
  if not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}',ident):raise ValueError('模板编号无效')
  if body.get('operation')=='delete':
   if ident not in rows:raise ValueError('模板不存在')
   del rows[ident]
  else:
   name=str(body.get('name','')).strip();prompt=str(body.get('prompt','')).strip();kind=body.get('type','image')
   if not 1<=len(name)<=80 or not 1<=len(prompt)<=20000:raise ValueError('请填写模板名称与提示词（名称最多 80 字、提示词最多 20000 字）')
   if kind not in ['image','video']:raise ValueError('模板类型无效')
   if ident not in rows and len(rows)>=100:raise ValueError('最多保存 100 个反推模板')
   rows[ident]={'name':name,'type':kind,'prompt':prompt}
  path=s.DATA/'reverse-templates.json';tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(rows,ensure_ascii=False,indent=2),'utf-8');tmp.replace(path)
  return {'id':ident,'templates':rows}

def enqueue(s,body):
 import task_backend as tasks
 p=s.load_project()
 if not p or p['projectId']!=body.get('projectId'):raise ValueError('项目已切换，请重新提交')
 kind=body.get('mediaType');frames=body.get('frames',[]);duration=body.get('duration',0)
 if kind not in ['image','video']:raise ValueError('请选择图片或视频')
 if not isinstance(frames,list) or not 1<=len(frames)<=(1 if kind=='image' else 32):raise ValueError('图片需要 1 张，视频需要 1–32 张采样帧')
 if not isinstance(duration,(int,float)) or not math.isfinite(duration) or kind=='video' and not 0<duration<=600:raise ValueError('视频时长需在 0–600 秒内，长视频请分段')
 validated=[];previous=-1
 for im in frames:
  if not isinstance(im,dict):raise ValueError('采样图片格式无效')
  mime=im.get('mime','image/jpeg');b64=im.get('b64','');at=im.get('time',0)
  if mime not in ['image/png','image/jpeg','image/webp'] or not isinstance(b64,str) or len(b64)>8*1024*1024:raise ValueError('采样图格式无效或过大')
  try:data=base64.b64decode(b64,validate=True)
  except Exception:raise ValueError('采样图片编码无效')
  valid=data.startswith(b'\x89PNG\r\n\x1a\n') if mime=='image/png' else data.startswith(b'\xff\xd8') if mime=='image/jpeg' else data.startswith(b'RIFF') and data[8:12]==b'WEBP'
  if not valid:raise ValueError('采样内容不是对应格式的图片')
  if not isinstance(at,(int,float)) or not math.isfinite(at) or at<0 or at<previous or kind=='video' and at>duration:raise ValueError('采样时间轴无效')
  previous=at;validated.append({'mime':mime,'b64':b64,'time':float(at)})
 prompt=str(body.get('prompt','')).strip()
 if not 1<=len(prompt)<=20000:raise ValueError('请选择或填写反推模板')
 cfg=copy.deepcopy(s.settings().get('ai',{}));cfg['model']=str(body.get('model') or cfg.get('model','')).strip()
 if not cfg['model']:raise ValueError('请选择支持图片输入的视觉模型')
 snap={'mediaType':kind,'name':str(body.get('name','参考素材'))[:160],'frames':validated,'duration':duration,'prompt':prompt,'extra':str(body.get('extra',''))[:6000],'audioNotes':str(body.get('audioNotes',''))[:6000]}
 row=tasks.manager(s).add('reverse',{'projectId':p['projectId'],'title':('视频' if kind=='video' else '图片')+'提示词反推 · '+snap['name']},cfg,snap)
 return {'id':row['id']}

def analyze(s,cfg,snapshot,payload):
 guard='本次已经提供待分析素材，请直接输出分析结果，不要回复准备就绪或要求再次上传。仅描述可见信息，不要把模板中的示例当作画面事实。'
 if snapshot['mediaType']=='video':
  guard+='输入为视频按时间顺序的采样帧，不是完整视频和音轨。时间轴依据提供的采样时刻与总时长，切点和运动如无法确认须标注近似/待确认。音频未直接读取：如无用户提供的音频记录，表格音频栏与音频风格必须写“未分析音轨，待人工核对”，禁止编造 BGM、音效与对白；如有音频记录，仅引用用户提供的记录并注明来源。'
 else:guard+='图片无法确认真实动作过程、声音或拍摄焦段，无法确定的信息不要写成已知事实。'
 metadata={'素材':snapshot['name'],'类型':snapshot['mediaType'],'视频总时长秒':snapshot['duration'],'采样时刻秒':[f['time'] for f in snapshot['frames']],'补充要求':snapshot['extra'],'用户提供的音频记录':snapshot['audioNotes']}
 text=json.dumps(metadata,ensure_ascii=False)
 if cfg.get('provider')=='ollama':user={'role':'user','content':text,'images':[im['b64'] for im in snapshot['frames']]}
 else:
  content=[{'type':'text','text':text}]
  for im in snapshot['frames']:content.append({'type':'image_url','image_url':{'url':'data:'+im['mime']+';base64,'+im['b64']}})
  user={'role':'user','content':content}
 raw=s.ai_call(cfg,[{'role':'system','content':snapshot['prompt']+'\n\n本次执行说明：\n'+guard},user],False)
 if not isinstance(raw,str) or not raw.strip():raise ValueError('视觉模型没有返回反推结果')
 return {'text':raw.strip()[:60000],'mediaType':snapshot['mediaType'],'name':snapshot['name'],'duration':snapshot['duration'],'frameTimes':[im['time'] for im in snapshot['frames']],'audioStatus':'用户提供记录，未直接读取音轨' if snapshot['audioNotes'] else '未分析音轨，待人工核对'}
