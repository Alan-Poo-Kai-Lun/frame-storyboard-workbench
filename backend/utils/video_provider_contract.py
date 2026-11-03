"""Provider extension seam only. No HTTP route, credentials or paid API calls."""
import base64,copy,hashlib,math
from typing import Protocol

MODELS=('minimax-h3','seedance-2.5')

class VideoProvider(Protocol):
    def validate(self,request:dict)->None: ...
    def submit(self,request:dict,*,idempotency_key:str)->dict: ...
    def query(self,task_id:str)->dict: ...
    def result(self,task_id:str)->dict: ...
    # Optional cancel(task_id): provider must explicitly declare support.

def make_request(project,segment_id,model,prompt,*,shot_id=None,first_frame=None,last_frame=None,continuity=None,provider_options=None):
    if model not in MODELS:raise ValueError('Unsupported model adapter')
    seg=next((s for s in project.get('segments',[]) if s['id']==segment_id),None)
    if not seg:raise ValueError('Segment no longer exists')
    if shot_id and not any(h['id']==shot_id for h in seg.get('shots',[])):raise ValueError('Shot no longer exists')
    if not isinstance(prompt,str) or not prompt.strip():raise ValueError('Prompt is required')
    duration=seg.get('duration');
    if not isinstance(duration,(int,float)) or not math.isfinite(duration) or duration<=0:raise ValueError('Invalid duration')
    # Native providers decide limits and upload formats; never assume H3 and Seedance are wire-compatible.
    media=[]
    for a in project.get('assets',[]):
        if not a.get('deleted') and (a.get('scope')!='segment' or a.get('segmentId')==segment_id):
            media.append({k:copy.deepcopy(a[k]) for k in ('id','pictureNumber','name','kind','mediaType','path') if k in a})
    return {'version':1,'model':model,'projectId':project['projectId'],'segmentId':segment_id,'shotId':shot_id,'prompt':prompt,'duration':duration,'aspectRatio':project.get('aspect'),'references':media,'firstFrame':first_frame,'lastFrame':last_frame,'continuity':copy.deepcopy(continuity),'providerOptions':copy.deepcopy(provider_options or {})}

def attach_result(project,request,result):
    """Return a new project with a downloaded result in videos; caller owns transaction/save."""
    if project.get('projectId')!=request['projectId']:raise ValueError('Project changed')
    seg=next((s for s in project.get('segments',[]) if s['id']==request['segmentId']),None)
    if not seg or request.get('shotId') and not any(h['id']==request['shotId'] for h in seg.get('shots',[])):raise ValueError('Result target no longer exists')
    task=str(result.get('taskId',''))
    if not task:raise ValueError('Remote task ID required')
    ident='provider-'+hashlib.sha256((request['model']+':'+task).encode()).hexdigest()[:24]
    if any(v.get('id')==ident for s in project['segments'] for v in s.get('videos',[])):return copy.deepcopy(project)
    data=result.get('bytes');mime=result.get('mime')
    if not isinstance(data,bytes) or not data or len(data)>50*1048576:raise ValueError('Invalid result file size')
    if mime=='video/mp4' and data[4:8]==b'ftyp':ext='mp4'
    elif mime=='video/webm' and data[:4]==b'\x1aE\xdf\xa3':ext='webm'
    else:raise ValueError('Unsupported video file header')
    out=copy.deepcopy(project);target=next(s for s in out['segments'] if s['id']==seg['id']);path='extra/segment_videos/'+ident+'.'+ext
    out.setdefault('media',{})[path]=base64.b64encode(data).decode()
    target.setdefault('videos',[]).append({'id':ident,'path':path,'mime':mime,'name':ident+'.'+ext,'title':result.get('title') or request['model'],'note':'','size':len(data),'shotId':request.get('shotId') or '', 'provider':request['model'],'remoteTaskId':task})
    return out

class UnconfiguredProvider:
    """Future implementers replace this adapter; cannot accidentally submit a charge."""
    def validate(self,request):raise RuntimeError('Video provider is not configured; no request submitted')
    def submit(self,request,*,idempotency_key):self.validate(request)
    def query(self,task_id):self.validate({})
    def result(self,task_id):self.validate({})

class MockVideoProvider:
    """Explicit test double using caller-supplied real video bytes; never network I/O."""
    def __init__(self,video_bytes,mime='video/webm'):self.video_bytes=video_bytes;self.mime=mime;self.tasks={}
    def validate(self,request):
        if request.get('model') not in MODELS or not request.get('prompt'):raise ValueError('Invalid mock request')
    def submit(self,request,*,idempotency_key):
        self.validate(request)
        if not idempotency_key:raise ValueError('Idempotency key required')
        ident=hashlib.sha256(idempotency_key.encode()).hexdigest()[:24];self.tasks.setdefault(ident,copy.deepcopy(request));return {'taskId':ident,'status':'queued'}
    def query(self,task_id):
        if task_id not in self.tasks:raise ValueError('Unknown task')
        return {'taskId':task_id,'status':'completed'}
    def result(self,task_id):self.query(task_id);return {'taskId':task_id,'bytes':self.video_bytes,'mime':self.mime}
