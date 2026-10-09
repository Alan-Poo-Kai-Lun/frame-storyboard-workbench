"""Task-scoped model lifetime and streamed, bounded inference."""
import copy,json,threading,time
from contextlib import contextmanager
from urllib.request import Request,urlopen
from urllib.error import HTTPError
LOCAL=threading.local()
THINK_CACHE={}
def limit(cfg):return max(256,min(8192,int(cfg.get('_outputLimit') or cfg.get('maxOutputTokens') or 4096)))
def report(s,run,**values):
 if not run or not run.get('id'):return
 import task_backend as tasks
 tasks.progress(s,run['id'],**values)
def release(s,run):
 cfg=run.get('loaded')
 if cfg and cfg.get('autoUnload',True):
  report(s,run,activity='正在卸载 '+cfg['model'])
  s._unload_model(cfg)
 run['loaded']=None
@contextmanager
def session(s,ident):
 previous=getattr(LOCAL,'run',None);run={'id':ident,'loaded':None};LOCAL.run=run
 try:yield
 finally:
  try:release(s,run)
  except Exception as e:
   if ident:
    import task_backend as tasks
    tasks.manager(s).patch(ident,cleanupError='模型卸载失败：'+str(e))
  finally:LOCAL.run=previous

def thinking_control(s,cfg):
 if cfg.get('thinkingMode')=='off':return False,'请求关闭思考（需模型支持）'
 if cfg.get('thinkingMode')=='low':return 'low','请求低思考等级（需模型支持）'
 if cfg.get('thinkingMode','fast')=='default':return None,'模型默认思考模式'
 key=(cfg.get('endpoint','').rstrip('/'),cfg.get('model',''));cached=THINK_CACHE.get(key)
 if not cached or time.time()-cached[0]>300:
  try:
   info=json.loads(s.request(key[0]+'/api/show',{'model':key[1]},cfg.get('key',''),timeout=5));values=info.get('thinking',{}).get('values',[])
   control=False if False in values else 'low' if 'low' in values else None
   cached=(time.time(),control);THINK_CACHE[key]=cached
  except Exception:cached=(time.time(),None)
 control=cached[1]
 return control,'关闭思考' if control is False else '低思考等级' if control=='low' else '未检测到可调思考模式，沿用模型默认'
def call(s,cfg,messages,json_mode):
 run=getattr(LOCAL,'run',None)
 if cfg.get('provider') not in ['ollama','openai']:raise ValueError('仅支持 Ollama 或 OpenAI Compatible')
 base=cfg.get('endpoint','').rstrip('/');key=cfg.get('key','');budget=limit(cfg);ollama=cfg['provider']=='ollama'
 if run:
  old=run.get('loaded')
  if old and (old['endpoint'].rstrip('/'),old['model'])!=(base,cfg['model']):release(s,run)
  if ollama:run['loaded']=copy.deepcopy(cfg)
 stream=bool(run);body={'model':cfg['model'],'messages':messages,'stream':stream}
 if ollama:
  body['options']={'num_predict':budget}
  control,label=thinking_control(s,cfg)
  if control is not None:body['think']=control
  report(s,run,thinkingControl=label)
  body['keep_alive']='10m' if run else (0 if cfg.get('autoUnload',True) else '5m')
  if json_mode:body['format']='json'
 else:
  body.update(temperature=.5,max_tokens=budget)
  if json_mode:body['response_format']={'type':'json_object'}
 started=time.time();last_write=0;chars=0;thinking=0;chunks=0;first=None;parts=[];done=False
 report(s,run,activity='请求已发送，等待模型加载 / 处理',outputChars=0,thinkingChars=0,chunks=0,model=cfg['model'],requestStartedMs=int(started*1000),lastChunkMs=None,firstTokenMs=None,outputLimit=budget,generatedTokens=None)
 def accept(obj):
  nonlocal chars,thinking,chunks,first,last_write,done
  if obj.get('error'):raise ValueError(str(obj['error']))
  reason='';content='';thought=''
  if ollama:
   msg=obj.get('message',{});content=msg.get('content') or '';thought=msg.get('thinking') or '';done=bool(obj.get('done'));reason=obj.get('done_reason','')
  else:
   choices=obj.get('choices',[])
   if choices:
    choice=choices[0];msg=choice.get('delta') or choice.get('message') or {};content=msg.get('content') or '';thought=msg.get('reasoning_content') or '';reason=choice.get('finish_reason') or '';done=bool(reason)
  if not isinstance(content,str) or not isinstance(thought,str):raise ValueError('AI 流式响应文本格式无效')
  if content or thought:
   at=time.time();first=first or at;chunks+=1;chars+=len(content);thinking+=len(thought);parts.append(content)
   if chars>100000 or thinking>200000:raise ValueError('模型忽略输出上限，已停止超长响应')
   if at-last_write>=.5:
    report(s,run,activity='正在思考' if thought and not content else '正在生成',outputChars=chars,thinkingChars=thinking,chunks=chunks,lastChunkMs=int(at*1000),firstTokenMs=int(first*1000));last_write=at
  if run and run.get('id'):
   import task_backend as tasks
   tasks.check_cancel(s,run['id'])
  if reason in ['length','max_tokens']:raise ValueError('达到输出长度上限，结果未应用；可在连接设置提高上限，或减少镜头与描述长度')
  if done:
   report(s,run,activity='模型输出完成',outputChars=chars,thinkingChars=thinking,chunks=chunks,lastChunkMs=int(time.time()*1000),firstTokenMs=int(first*1000) if first else None,generatedTokens=obj.get('eval_count'),loadSeconds=round(obj.get('load_duration',0)/1e9,2) if ollama else None)
 try:
  headers={'Content-Type':'application/json'}
  if key:headers['Authorization']='Bearer '+key
  with urlopen(Request(base+('/api/chat' if ollama else '/chat/completions'),data=json.dumps(body).encode(),headers=headers),timeout=300) as response:
   ctype=response.headers.get('Content-Type','').lower()
   if not stream or ('application/json' in ctype and 'ndjson' not in ctype):
    obj=json.loads(response.read());accept(obj);done=True
   else:
    for raw in response:
     line=raw.decode('utf-8').strip()
     if not line or line.startswith(':'):continue
     if not ollama:
      if not line.startswith('data:'):continue
      line=line[5:].strip()
      if line=='[DONE]':done=True;break
     accept(json.loads(line))
     if done:break
   if not done:raise ValueError('AI 流式响应中断，未收到完成标记；结果未应用')
 except HTTPError as e:raise ValueError(f'服务返回 HTTP {e.code}: '+e.read().decode(errors='replace')[:400]) from e
 finally:
  report(s,run,requestElapsedSeconds=round(time.time()-started,1))
 return ''.join(parts)
