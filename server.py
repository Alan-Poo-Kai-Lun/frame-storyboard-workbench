#!/usr/bin/env python3
"""Local storyboard workbench. Python 3.10+, no third-party dependencies."""
import base64,collections,copy,hashlib,io,json,math,mimetypes,os,re,secrets,threading,time,uuid,webbrowser,zipfile
import sys
import generation_backend
import task_backend as tasks
import studio_backend as studio
import reverse_backend as reverse
import planning_backend as planning
import asset_analysis
import prompt_review
import theme_backdrops
from pathlib import Path,PurePosixPath
from http.server import ThreadingHTTPServer as _ThreadingHTTPServer,BaseHTTPRequestHandler

class ThreadingHTTPServer(_ThreadingHTTPServer):
    # Chromium preconnects while loading the workbench's local scripts.
    # Python 3.13's backlog of 5 can refuse a burst on Windows.
    request_queue_size=64
from urllib.parse import parse_qs,urlparse
from urllib.request import Request,urlopen
from urllib.error import HTTPError
import runtime_paths
runtime_paths.configure_temp()
ROOT=runtime_paths.resource_dir()
DATA=runtime_paths.data_dir(); DATA.mkdir(parents=True,exist_ok=True)
STATE=DATA/'project.json'; CONFIG=DATA/'settings.json'
LAYOUT=DATA/'layout.json'
TOKEN=secrets.token_urlsafe(32)
LOCK=threading.RLock()
COMPUTE_LOCK=threading.RLock()
_CACHE={'stamp':None,'project':None}
def uid(): return uuid.uuid4().hex[:12]
def digest(t): return hashlib.sha256(t.encode()).hexdigest()
def parse_shots(prompt,duration):
    import h3_compiler
    prompt=h3_compiler.editable_text(prompt)
    pattern=r'\[(\d+(?:\.\d+)?)\s*s?\s*[–—\-~到]\s*(\d+(?:\.\d+)?)\s*s?\]'
    matches=list(re.finditer(pattern,prompt)); shots=[]
    for i,m in enumerate(matches):
        end=matches[i+1].start() if i+1<len(matches) else len(prompt)
        body=prompt[m.end():end]
        if i+1==len(matches):
            stop=re.search(r'(?m)^\s*(?:overall_soundscape|non_diegetic_music|editing|audio|cinematography|continuity_constraints|negative_constraints|FINAL VISUAL INTENT)\s*:',body)
            if stop: body=body[:stop.start()]
        fields=parse_shot_fields(body)
        shots.append({'id':uid(),'start':float(m[1]),'end':float(m[2]),**fields,'image':'','firstFrame':'','lastFrame':'','locks':{'identity':True,'costume':False,'scene':True,'prop':False}})
    return shots or [{'id':uid(),'start':0,'end':duration,'action':prompt,'camera':'','dialogue':'','sound':'','expression':'','image':'','firstFrame':'','lastFrame':'','locks':{'identity':True,'costume':False,'scene':True,'prop':False}}]
def parse_shot_fields(body):
    labels={'Camera':'camera','Expression':'expression','Dialogue':'dialogue','Sound':'sound','Spatial start':'startState','Spatial end':'endState','Dialogue language':'dialogueLanguage','Professional':'professionalNote'}
    matches=list(re.finditer(r'(?im)^\s*('+ '|'.join(re.escape(k) for k in labels)+r')\s*:\s*',body))
    result={k:'' for k in ['action','camera','dialogue','sound','expression','startState','endState']}
    result['action']=body[:matches[0].start()].strip() if matches else body.strip()
    for i,m in enumerate(matches):
        key=next(v for k,v in labels.items() if k.lower()==m[1].lower());value=body[m.end():matches[i+1].start() if i+1<len(matches) else len(body)].strip()
        if key=='dialogueLanguage':value=re.split(r'[\r\n]',value.split('。')[0])[0].strip()[:120]
        result[key]=(result[key]+'\n'+value) if key=='dialogue' and result[key] else value
    return result
ASPECTS=['1:1','2:3','3:4','3:5','4:5','5:7','5:8','7:9','9:16','9:19','9:21','9:32','3:2','4:3','5:3','5:4','7:5','8:5','9:7','16:9','19:9','21:9','32:9']
def aspect_from_output(out):
    match=re.match(r'(\d+:\d+)',str(out.get('aspectRatio','16:9')))
    return match[1] if match else '16:9'
def aspect_dimensions(aspect,long_edge=1024,multiple=32):
    if aspect not in ASPECTS: raise ValueError('不支持的画幅')
    w,h=map(int,aspect.split(':')); scale=long_edge/max(w,h)
    return max(multiple,round(w*scale/multiple)*multiple),max(multiple,round(h*scale/multiple)*multiple)
def blank_project():
    return {'version':1,'projectId':uid(),'title':'新导演项目','script':'','aspect':'16:9','fps':24,'segments':[{'id':uid(),'title':'片段 01','duration':15,'originalDuration':15,'prompt':'','originalPrompt':'','shots':[],'refs':[],'continuity':False}],'assets':[],'media':{},'originalZip':''}
GUIDE_DEFAULTS={'continuityEnabled':True,'continuityOverlapFrames':5,'continuityMode':'guide','continuityRedraw':.65,'continuityKeepTail':False}
def guide_settings(p,output=None):
    if output is None and p.get('originalZip'):
        with zipfile.ZipFile(io.BytesIO(base64.b64decode(p['originalZip']))) as z:output=json.loads(z.read('pack.json')).get('output',{})
    values={**GUIDE_DEFAULTS,**{k:v for k,v in (output or {}).items() if k in GUIDE_DEFAULTS},**{k:v for k,v in (p.get('directorGuide') or {}).items() if k in GUIDE_DEFAULTS}}
    if not isinstance(values['continuityEnabled'],bool) or not isinstance(values['continuityKeepTail'],bool):raise ValueError('段间引导开关格式无效')
    overlap=values['continuityOverlapFrames'];redraw=values['continuityRedraw']
    if isinstance(overlap,bool) or not isinstance(overlap,int) or not 0<=overlap<=120:raise ValueError('段间引导重叠帧数应为 0–120 的整数')
    if isinstance(redraw,bool) or not isinstance(redraw,(int,float)) or not math.isfinite(redraw) or not 0<=redraw<=1:raise ValueError('段间引导重绘强度应为 0–1')
    if not isinstance(values['continuityMode'],str) or not values['continuityMode']:raise ValueError('段间引导模式无效')
    return values
def archive_shots(segment,reason):
    if not segment.get('shots') and not segment.get('prompt'):return
    entry={'savedAt':time.strftime('%Y-%m-%d %H:%M:%S'),'reason':reason,'duration':segment['duration'],'shots':copy.deepcopy(segment.get('shots',[])),'prompt':segment.get('prompt',''),'planning':copy.deepcopy(segment.get('planning'))}
    segment['shotHistory']=(segment.get('shotHistory',[])+[entry])[-5:]
def _state_stamp():
    try:
        info=STATE.stat();return (info.st_mtime_ns,info.st_size)
    except OSError:return None
def _remember(p):
    # Cache an independent copy: callers keep mutating the object they were given,
    # and a read must never see a half-applied edit. Media strings are shared.
    snapshot=copy.deepcopy(p)
    import project_layout
    project_layout.apply(snapshot,DATA)
    _CACHE['stamp']=_state_stamp();_CACHE['project']=snapshot
def write_layout(project_id,layout):
    import project_layout
    project_layout.write(DATA,project_id,layout)
DIAG={'errors':collections.deque(maxlen=25),'slow':collections.deque(maxlen=15)}

def note_error(route,message):
    try:DIAG['errors'].append({'at':time.strftime('%Y-%m-%d %H:%M:%S'),'route':str(route)[:120],'error':str(message)[:400]})
    except Exception:pass

def diagnostics():
    """A single file the user can send when something goes wrong."""
    project=load_project() if STATE.exists() else None
    media_folder=DATA/'media'
    media_files=[item for item in media_folder.iterdir() if item.is_file()] if media_folder.is_dir() else []
    def size_of(path):
        try:return path.stat().st_size
        except OSError:return 0
    settings_value=settings()
    ai={key:value for key,value in (settings_value.get('ai') or {}).items() if key in ('provider','model','endpoint')}
    version=json.loads((ROOT/'version.json').read_text('utf-8'))
    return {
        'generatedAt':time.strftime('%Y-%m-%d %H:%M:%S'),
        'release':version.get('release'),'version':version.get('version'),
        'runtime':'exe' if getattr(sys,'frozen',False) else 'source',
        'python':sys.version.split()[0],'platform':sys.platform,
        'dataDirectory':str(DATA),'port':None,
        'project':None if not project else {
            'id':project.get('projectId'),'title':project.get('title'),
            'segments':len(project.get('segments') or []),
            'shots':sum(len(s.get('shots') or []) for s in project.get('segments') or []),
            'assets':len([a for a in project.get('assets') or [] if not a.get('deleted')]),
            'mediaEntries':len(project.get('media') or {}),
            'stateBytes':size_of(STATE),'layoutBytes':size_of(DATA/'layout.json'),
            'projectFileMB':round(size_of(STATE)/1048576,2)
        },
        'media':{'files':len(media_files),'totalMB':round(sum(size_of(item) for item in media_files)/1048576,2)},
        'ai':ai,'recentErrors':list(DIAG['errors']),'recentSlow':list(DIAG['slow'])
    }

def decoded_size(path):
    size=path.stat().st_size
    if size<=0:return 0
    with open(path,'rb') as handle:
        handle.seek(max(0,size-4));tail=handle.read()
    return size//4*3-tail.count(b'=')

def read_b64_range(path,start,end):
    """Serve a byte range of a base64 file without decoding the whole thing."""
    size=path.stat().st_size
    first=start//3*4
    last=min(size,(end//3+1)*4)
    with open(path,'rb') as handle:
        handle.seek(first);chunk=handle.read(max(0,last-first))
    data=base64.b64decode(chunk)
    offset=start-first//4*3
    return data[offset:offset+(end-start+1)]

def public_project(p):
    """Ship the project without its media bytes: the browser asks for them by path."""
    import project_media
    media=p.get('media') if isinstance(p.get('media'),dict) else {}
    index=p.get('mediaIndex') if isinstance(p.get('mediaIndex'),dict) else {}
    if len(index)<len(media):
        index=project_media.detach(p,DATA).get('mediaIndex') or {}
    return {**{key:value for key,value in p.items() if key not in ('media','mediaIndex','originalZip','originalZipHash')},
            'media':{path:index[path] for path in media if path in index}}

def load_project():
    with LOCK:
        if not STATE.exists(): return None
        stamp=_state_stamp()
        p=_CACHE['project'] if (_CACHE['project'] is not None and _CACHE['stamp']==stamp) else None
        if p is None:
            import asset_lifecycle,project_media,project_layout
            payload=json.loads(STATE.read_text('utf-8'))
            # A project written before media was split out still carries the bytes inline.
            legacy=bool(payload.get('media'))
            p=project_layout.apply(asset_lifecycle.normalize(project_media.attach(payload,DATA)),DATA)
            if not isinstance(p.get('mediaIndex'),dict) or len(p['mediaIndex'])<len(p.get('media') or {}):
                # First load of a project saved before media was split out: index it now so
                # /api/media can serve the files without another pass over the payload.
                p['mediaIndex']=project_media.detach(p,DATA).get('mediaIndex') or {}
            if not p.get('projectId'): p['projectId']=uid(); save(p)
            elif repair_dialogue_languages(p) or legacy: save(p)
            _remember(p)
        # Plan archives live in their own folder and change without touching the project file.
        import plan_store
        archive=plan_store.records(sys.modules[__name__],p)
        if archive:p['planArchive']=archive
        else:p.pop('planArchive',None)
        # Read the small layout sidecar without invalidating the media cache.
        import project_layout
        return project_layout.apply(copy.deepcopy(p),DATA)
def backup_project():
    if STATE.exists():
        backup=DATA/'backups'; backup.mkdir(exist_ok=True)
        (backup/(time.strftime('%Y%m%d-%H%M%S')+'-'+uid()+'.json')).write_bytes(STATE.read_bytes())

def create_project(example=False,title=''):
    with LOCK:
        if not isinstance(example,bool) or not isinstance(title,str):raise ValueError('新项目参数无效')
        p=blank_project()
        if example:
            p=readzip((ROOT/'presets/starter-project.mmxpack.zip').read_bytes())
            p['starterExample']=True
            # Fit the example to the visitor's window rather than the author's viewport.
            p.get('overviewLayout',{}).get('canvas37',{}).pop('view',None)
            # IDs belong to this fresh project. Preserve cross-references and canvas keys.
            for asset in p['assets']:
                asset['id']=uid()
                asset['confirmation']={'signature':asset_analysis.signature(asset,p['media']),'mode':'manual','confirmedAt':time.strftime('%Y-%m-%d %H:%M:%S'),'source':asset_analysis.source(asset)}
        elif title.strip():p['title']=title.strip()[:200]
        if not example:
            import creative_library
            layout=creative_library.default_layout(DATA);p['overviewLayout']={'canvas37':layout}
            if layout['mode']=='cards':
                p['segments'][0]['shots']=[{'id':uid(),'start':0,'end':3,'action':'','camera':'','dialogue':'','sound':'','expression':'','image':'','locks':{}}]
        backup_project();save(p);return p

def import_project(p):
    """Read the portable FRAME JSON backup before replacing the current project."""
    if not isinstance(p,dict) or p.get('version')!=1:raise ValueError('项目备份格式无效')
    import asset_lifecycle
    p=asset_lifecycle.normalize(copy.deepcopy(p))
    repair_dialogue_languages(p)
    if not isinstance(p.get('title'),str) or not isinstance(p.get('script'),str) or not isinstance(p.get('aspect'),str):raise ValueError('项目基础字段无效')
    segments=p.get('segments');assets=p.get('assets');media=p.get('media')
    if not isinstance(segments,list) or len(segments)>500 or not isinstance(assets,list) or len(assets)>2000 or not isinstance(media,dict):raise ValueError('项目片段、素材或媒体格式无效')
    if isinstance(p.get('fps'),bool) or not isinstance(p.get('fps'),(int,float)) or not math.isfinite(p['fps']) or not 1<=p['fps']<=120:raise ValueError('项目帧率无效')
    ids=set()
    def identity(obj):
        if not isinstance(obj,dict) or not isinstance(obj.get('id'),str) or not obj['id'] or obj['id'] in ids:raise ValueError('项目条目编号缺失或重复')
        ids.add(obj['id'])
    for segment in segments:
        identity(segment)
        if not isinstance(segment.get('title'),str) or not isinstance(segment.get('shots'),list) or len(segment['shots'])>2000 or not isinstance(segment.get('refs',[]),list):raise ValueError('片段格式无效')
        duration=segment.get('duration')
        if isinstance(duration,bool) or not isinstance(duration,(int,float)) or not math.isfinite(duration) or not 0<duration<=600:raise ValueError('片段时长无效')
        for shot in segment['shots']:
            identity(shot)
            for key in ['start','end']:
                n=shot.get(key)
                if isinstance(n,bool) or not isinstance(n,(int,float)) or not math.isfinite(n) or n<0:raise ValueError('镜头时间无效')
            if shot['end']<=shot['start']:raise ValueError('镜头结束时间应晚于开始时间')
            for key in ['action','camera','expression','dialogue','sound']:
                if not isinstance(shot.get(key,''),str):raise ValueError('镜头描述格式无效')
            shot.setdefault('locks',{})
    for asset in assets:
        identity(asset)
        if not all(isinstance(asset.get(key),str) for key in ['name','kind','path']):raise ValueError('素材字段无效')
    for name,value in media.items():
        if not isinstance(name,str) or not isinstance(value,str) or name.startswith('/') or '..' in PurePosixPath(name).parts or '\\' in name or ':' in name:raise ValueError('媒体路径或内容无效')
        try:base64.b64decode(value,validate=True)
        except Exception:raise ValueError('媒体内容损坏')
    if not isinstance(p.get('originalZip',''),str):raise ValueError('原导演包字段无效')
    p['projectId']=uid()
    with LOCK:backup_project();save(p)
    return p
def list_models(cfg):
    if cfg.get('provider')!='ollama': raise ValueError('自动检测目前支持 Ollama')
    base=cfg.get('endpoint','').strip().rstrip('/')
    result=json.loads(request(base+'/api/tags',key=cfg.get('key',''),timeout=10))
    return [{'name':m.get('name') or m.get('model'),'size':m.get('size',0),'details':m.get('details',{})} for m in result.get('models',[]) if m.get('name') or m.get('model')]

def readzip(blob):
    z=zipfile.ZipFile(io.BytesIO(blob)); infos=z.infolist()
    if len(infos)>3000 or sum(i.file_size for i in infos)>400*1024*1024: raise ValueError('导演包过大（解压上限 400MB）')
    files={}
    for i in infos:
        p=Path(i.filename)
        if p.is_absolute() or '..' in p.parts: raise ValueError('导演包包含不安全路径')
        if not i.is_dir(): files[i.filename]=z.read(i)
    if 'pack.json' not in files or 'timeline.json' not in files: raise ValueError('缺少 pack.json 或 timeline.json')
    pack=json.loads(files['pack.json']); timeline=json.loads(files['timeline.json'])
    if pack.get('format')!='minimax-h3-director-pack' or pack.get('formatVersion')!=1: raise ValueError('仅支持已验证的 H3 Director Pack v1 格式')
    side=json.loads(files.get('storyboard.json',b'{}'))
    segs=[]
    groups=sorted(k for k in files if re.match(r'^asset_groups/[^/]+/group.json$',k))
    for n,raw in enumerate(timeline.get('segments',[])):
        gp=next((path for path in groups if json.loads(files[path]).get('id')==raw.get('id')),None) or (groups[n] if n<len(groups) else f'asset_groups/{n+1:02d}/group.json')
        group=json.loads(files.get(gp,b'{}')); g={**raw,**group}
        prompt=g.get('prompt',''); duration=float(g.get('durationSec',g.get('length',120)/timeline.get('frameRate',24)))
        saved=next((s for s in side.get('segments',[]) if s.get('id')==g.get('id') and s.get('promptHash')==digest(prompt)),None)
        if saved and 'workingPrompt' in saved: prompt=saved['workingPrompt']
        title=re.search(r'(第[一二三四五六七八九十]+世[｜|].+)',prompt)
        segs.append({'id':g.get('id',uid()),'title':saved.get('title') if saved else (title[1].strip('。') if title else f'片段 {n+1:02d}'),'duration':duration,'originalDuration':duration,'prompt':prompt,'originalPrompt':prompt,**({'storyText':saved.get('storyText',''),'storyHistory':saved.get('storyHistory',[])} if saved and 'storyText' in saved else {}),'shots':saved['shots'] if saved else parse_shots(prompt,duration),'continuity':g.get('continuityFromPrev',False),'groupPath':gp,'refs':g.get('refs',[])})
    media={k:base64.b64encode(v).decode() for k,v in files.items() if Path(k).suffix.lower() in {'.png','.jpg','.jpeg','.webp','.bmp','.gif','.tif','.tiff','.avif','.jfif'} or (mimetypes.guess_type(k)[0] or '').startswith('image/')}
    media.update(side.get('media',{}))
    for segment in segs:
        record=next((s for s in side.get('segments',[]) if s.get('id')==segment['id']),{})
        segment['videos']=record.get('videos',[])
        if record.get('planning'):segment['planning']=record['planning']
        if record.get('promptHistory'):segment['promptHistory']=record['promptHistory']
        for key in ['promptTranslations','promptExportLanguage','dialogueLanguage','writingRuleIds']:
            if key in record:segment[key]=record[key]
        segment['guideFromPrev']=record.get('guideFromPrev',segment['continuity'])
        if 'continuity' in record:segment['continuity']=record['continuity']
        if record.get('shotHistory'):segment['shotHistory']=record['shotHistory']
        for video in segment['videos']:
            path=video.get('path','')
            if path in files:media[path]=base64.b64encode(files[path]).decode()
    shared=json.loads(files.get('shared_params/shared_params.json',b'{}'))
    project={'overviewLayout':side.get('overviewLayout',{}),'storySeparated':side.get('storySeparated',False),'dialogueLanguage':side.get('dialogueLanguage',''),'writingRuleIds':side.get('writingRuleIds',[]),'planArchive':side.get('planArchive',{}),'planningOptions':side.get('planningOptions',{}),'storyPlans':side.get('storyPlans',[]),'intent':side.get('intent',{}),'groupAssetsCollapsed':side.get('groupAssetsCollapsed',{}),'nextPictureNumber':side.get('nextPictureNumber',1),'showDeletedAssets':side.get('showDeletedAssets',False),'assetsManaged':side.get('assetsManaged',False),'assetsCollapsed':side.get('assetsCollapsed',False),'version':1,'projectId':uid(),'title':side.get('title','导入的导演项目'),'script':side.get('script',''),'aspect':side.get('aspect',aspect_from_output(pack.get('output',{}))),'fps':timeline.get('frameRate',24),'segments':segs,'assets':side.get('assets') or [{**r,'id':uid(),'name':f'Picture {r.get("index",i)+1}','kind':'人物','path':r.get('imageFile',''),'locked':True} for i,r in enumerate(shared.get('refs',[]))],'media':media,'originalZip':base64.b64encode(blob).decode()}
    project['directorGuide']=guide_settings({'directorGuide':side.get('directorGuide',{})},pack.get('output',{}))
    if not side.get('assetsManaged'):
        for segment in segs:
            for ref in segment.get('refs',[]):
                path=ref.get('imageFile','')
                if (path or ref.get('imageB64')) and not any(a.get('path')==path and a.get('segmentId')==segment['id'] for a in project['assets']):
                    project['assets'].append({**ref,'id':uid(),'name':f'Picture {ref.get("index",len(project["assets"]))+1}','kind':'场景','path':path,'locked':False,'description':'','scope':'segment','segmentId':segment['id']})
    recover_pack_images(project,shared,timeline)
    generation_backend.imported(project,pack,timeline,shared,files,side)
    return project
def recover_pack_images(project, shared, timeline):
    """Resolve archived image paths without guessing between duplicate filenames."""
    media=project['media']
    def norm(value): return str(value or '').replace('\\','/').strip().removeprefix('./')
    def resolve(item, folder=''):
        raw=norm(item.get('path') or item.get('imageFile') or item.get('image_file'))
        name=norm(item.get('fileName')); sub=norm(item.get('subfolder'))
        candidates=[raw, '/'.join(x for x in [sub,name] if x), '/'.join(x for x in [folder,name or raw] if x)]
        for candidate in candidates:
            if not candidate: continue
            if candidate in media:return candidate
            exact=[k for k in media if norm(k).casefold()==candidate.casefold()]
            if len(exact)==1:return exact[0]
            suffix=[k for k in media if candidate.casefold().endswith('/'+norm(k).casefold())]
            if len(suffix)==1:return suffix[0]
        basename=Path(raw or name).name.casefold()
        matches=[k for k in media if Path(norm(k)).name.casefold()==basename] if basename else []
        if len(matches)==1:return matches[0]
        encoded=item.get('imageB64') or item.get('image_b64') or ''
        if encoded:
            try:
                payload=encoded.split(',',1)[1] if encoded.startswith('data:') else encoded
                if len(payload)>42*1024*1024:return raw
                data=base64.b64decode(payload,validate=True)
                ext='.png' if data.startswith(b'\x89PNG\r\n\x1a\n') else '.jpg' if data.startswith(b'\xff\xd8\xff') else '.webp' if data[:4]==b'RIFF' and data[8:12]==b'WEBP' else ''
                if ext:
                    path='extra/imported_'+hashlib.sha256(data).hexdigest()[:20]+ext
                    media[path]=base64.b64encode(data).decode();return path
            except (ValueError,TypeError):pass
        return raw
    refs=shared.get('refs') or timeline.get('global',{}).get('refs') or []
    original_to_resolved={}
    for r in refs:
        old=r.get('imageFile') or r.get('image_file','');path=resolve(r,'shared_params')
        if path:
            r['imageFile']=path
            if old:original_to_resolved[old]=path
    for seg in project['segments']:
        for r in seg.get('refs',[]):
            old=r.get('imageFile') or r.get('image_file','');path=resolve(r,str(Path(seg['groupPath']).parent))
            if path:
                r['imageFile']=path
                if old:original_to_resolved[old]=path
        for sh in seg['shots']:
            for key in ['image','firstFrame','lastFrame']:
                if sh.get(key):sh[key]=resolve({'path':sh[key]})
    for a in project['assets']:
        old=a.get('path','');a['path']=original_to_resolved.get(old) or resolve(a)
    # Some packs keep shared references only in timeline.global.
    if not project['assetsManaged']:
        for i,r in enumerate(refs):
            path=r.get('imageFile','')
            if path and not any(a['path']==path and a.get('scope','public')=='public' for a in project['assets']):
                project['assets'].insert(i,{'id':uid(),'name':f'Picture {r.get("index",i)+1}','kind':'人物','path':path,'scope':'public','locked':True})
    project['importWarnings']=[a.get('name',a.get('path','')) for a in project['assets'] if not a.get('deleted') and a.get('path') not in media]

def restore_pack_images(project):
    if not project.get('originalZip'):raise ValueError('当前项目没有原始导演包，请直接拖图替换缺失素材')
    original=readzip(base64.b64decode(project['originalZip']))
    before=sum(bool(project['media'].get(a.get('path'))) for a in project['assets'] if not a.get('deleted'))
    for path,data in original['media'].items():project['media'].setdefault(path,data)
    recover_pack_images(project,{}, {})
    after=sum(bool(project['media'].get(a.get('path'))) for a in project['assets'] if not a.get('deleted'))
    return max(0,after-before)

def prompt_for(s):
    return s['prompt']
def bind_reference_roles(text, assets):
    """Bind only unique descriptive roles; leave dialogue and existing tags intact."""
    aliases={}
    for i,a in enumerate(assets):
        n=a.get('pictureNumber',a.get('index',i+1))
        description=str(a.get('description','')).strip()
        labels=[description] if 2<=len(description)<=40 else []
        if a.get('kind')=='人物':
            labels+=re.findall(r'[男女]?(?:销售|顾客|店员|老板|主角|医生|护士|警察|将军|侠客)',description)
        for label in labels:aliases.setdefault(label,set()).add(n)
    unique={k:next(iter(v)) for k,v in aliases.items() if len(v)==1}
    if not unique:return text
    terms='|'.join(re.escape(k) for k in sorted(unique,key=len,reverse=True))
    pattern=r'<[^>]+>(?:中的(?:'+terms+r')|（[^）]*）)?|'+terms
    return re.sub(pattern,lambda m:m[0] if m[0].startswith('<') else f'<Picture {unique[m[0]]}>中的{m[0]}',str(text))

def normalize_prompt_sections(text):
    # Preserve nonempty section contents; collapse repeated empty headings.
    return re.sub(r'(?im)^(summary|timeline):\s*(?:\1:\s*)+',lambda m:m[1]+':\n\n',text)

def dialogue_language(value):
    """Return a single-line language name; legacy prompts may carry extra lines."""
    if value is None: return ''
    if not isinstance(value,str): value=str(value)
    value=re.split(r'[\r\n]',value)[0]
    value=''.join(' ' if ord(ch)<32 else ch for ch in value).strip()
    if len(value)>120: value=value[:120].strip()
    names={'中文':'Mandarin','中文（普通话）':'Mandarin','普通话':'Mandarin','英语':'English','英语（English）':'English','英文':'English','粤语':'Cantonese','广东话':'Cantonese','马来文':'Malay','马来语':'Malay','马来语（Bahasa Melayu）':'Malay','泰米尔语（தமிழ்）':'Tamil','印地语':'Hindi','混合语言（按台词）':'Mixed languages (as written)','日语':'Japanese','韩语':'Korean','泰语':'Thai','印尼语':'Indonesian','福建话':'Hokkien','法语':'French','德语':'German','西班牙语':'Spanish','无对白':'No dialogue'}
    return names.get(value,value)

def repair_dialogue_languages(project):
    """Normalise stored language fields so one bad import cannot block every save."""
    changed=False
    for segment in project.get('segments') or []:
        if not isinstance(segment,dict): continue
        if 'dialogueLanguage' in segment:
            fixed=dialogue_language(segment.get('dialogueLanguage'))
            if fixed!=segment.get('dialogueLanguage'): segment['dialogueLanguage']=fixed; changed=True
        for shot in segment.get('shots') or []:
            if not isinstance(shot,dict): continue
            if 'dialogueLanguage' in shot:
                fixed=dialogue_language(shot.get('dialogueLanguage'))
                if fixed!=shot.get('dialogueLanguage'): shot['dialogueLanguage']=fixed; changed=True
    return changed


def rebuild(s):
    old=s['prompt']; matches=list(re.finditer(r'\[(\d+(?:\.\d+)?)\s*s?\s*[–—\-~到]\s*(\d+(?:\.\d+)?)\s*s?\]',old))
    prefix=old[:matches[0].start()] if matches else old
    prefix=normalize_prompt_sections(prefix)
    if s.get('planning',{}).get('summary'):
        summary=s['planning']['summary']
        prefix=re.sub(r'(?ims)^summary:.*?(?=^[a-z_]+:|\Z)','',prefix)
        prefix='summary:\n'+summary+'\n\n'+prefix
    if not re.search(r'(?im)^summary:',prefix):prefix+='\nsummary:\n\n'
    if not re.search(r'(?im)^timeline:',prefix):prefix+='\ntimeline:\n\n'
    suffix=''
    if matches:
        tail=old[matches[-1].end():]; stop=re.search(r'(?m)^\s*(?:editing|audio|cinematography|continuity_constraints|negative_constraints|FINAL VISUAL INTENT)\s*:',tail)
        if stop: suffix=tail[stop.start():]
    blocks=[]
    for sh in s['shots']:
        lines=[f'[{sh["start"]:.2f}s–{sh["end"]:.2f}s]',bind_reference_roles(sh.get('action',''),s.get('assetReferences',[]))]
        language=dialogue_language(sh.get('dialogueLanguage') or s.get('defaultDialogueLanguage'))
        silent=language=='No dialogue'
        for key,label in [('camera','Camera'),('expression','Expression'),('dialogue','Dialogue'),('sound','Sound')]:
            if key=='dialogue' and silent: continue
            if sh.get(key):
                if key=='dialogue':lines.extend(label+': '+line for line in sh[key].splitlines())
                else:lines.append(label+': '+bind_reference_roles(sh[key],s.get('assetReferences',[])))
        if silent: lines.append('Dialogue language: No dialogue。No spoken dialogue or narration. Preserve environmental sound effects.')
        elif language:
            instruction='Use the specified language for spoken dialogue. Preserve the exact written lines; do not translate or invent new lines.' if sh.get('dialogue') else 'No spoken lines are specified. Do not invent dialogue or narration.'
            lines.append('Dialogue language: '+language+'。'+instruction)
        for key,label in [('startState','Spatial start'),('endState','Spatial end')]:
            if sh.get(key):lines.append(label+': '+sh[key])
        if studio.professional_text(sh):lines.append('Professional: '+studio.professional_text(sh))
        elif sh.get('professionalNote'):lines.append('Professional: '+sh['professionalNote'])
        blocks.append('\n\n'.join(lines))
    if 'assetReferences' in s:
        prefix=re.sub(r'(?ms)^asset_references:\n.*?^end_asset_references\n*','',prefix)
        refs='\n'.join(f'Picture {a["index"]}: {a["name"]} / {a["kind"]} / {a.get("description", "")}' for a in s['assetReferences'])
        if refs: prefix='asset_references:\n'+refs+'\nend_asset_references\n\n'+prefix
    return prefix+'\n\n'.join(blocks)+'\n\n'+suffix

H3_MEDIA_PREFIXES=('shared_params/','asset_groups/','source_video/','extra/')
def scoped_assets(project, segment=None):
    assets=[a for a in project.get('assets',[]) if a.get('path') and not a.get('deleted')]
    owners={s['id'] for s in project.get('segments',[])}
    for a in assets:
        if a.get('scope','public') not in ['public','segment'] or (a.get('scope')=='segment' and a.get('segmentId') not in owners): raise ValueError('素材归属无效：'+a.get('name',a['path']))
    public=[a for a in assets if a.get('scope','public')=='public']
    local=[a for a in assets if a.get('scope')=='segment' and segment and a.get('segmentId')==segment['id']]
    return public+local

def legacy_scoped_prompt(project, segment):
    for asset in project.get('assets',[]):
        if not asset.get('deleted') or generation_backend.media_type(asset)=='image':continue
        for scope in asset.get('deletedReferenceScopes',[]):
            if scope.get('segmentId')==segment['id'] and re.search(r'(?<!\w)'+re.escape(scope.get('label',''))+r'\b',segment.get('prompt',''),re.I):
                raise ValueError(segment['title']+' 仍引用已删除素材 '+asset.get('name','')+'，请恢复素材或移除该引用')
    if segment.get('dialogueLanguage') or project.get('dialogueLanguage') or any(sh.get('dialogueLanguage') for sh in segment.get('shots',[])):
        segment={**segment,'prompt':rebuild({**segment,'defaultDialogueLanguage':segment.get('dialogueLanguage',project.get('dialogueLanguage',''))})}
    if not project.get('assetsManaged'): return segment['prompt']
    assets=project.get('assets',[]);active=[a for a in scoped_assets(project,segment) if generation_backend.media_type(a)=='image']
    indices={a.get('pictureNumber',assets.index(a)+1):i+1 for i,a in enumerate(active)}
    def replace(m):
        n=int(m.group(2))
        if n not in indices: raise ValueError(f'{segment["title"]} 引用了缺失或不属于本组的 Picture {n}，请调整素材用途或修改提示词')
        return m.group(1)+str(indices[n])
    text=re.sub(r'(?ms)^asset_references:\n.*?^end_asset_references\n*','',segment['prompt'])
    text=normalize_prompt_sections(text)
    # Only bind ordinary prose, preserving existing references and spoken dialogue.
    text='\n'.join(line if re.match(r'\s*Dialogue:',line,re.I) else bind_reference_roles(line,[{**a,'pictureNumber':a.get('pictureNumber',assets.index(a)+1)} for a in active]) for line in text.split('\n'))
    def number(n):
        if n not in indices:raise ValueError(f'{segment["title"]} 引用了缺失或不属于本组的 Picture {n}')
        return indices[n]
    def dialogue_heading(line):
        return re.sub(r'^(\s*Dialogue:\s*)<Picture\s+(\d+)>(?=(?:（[^\n]*）)?\s*:)',lambda m:m[1]+'<Subject '+str(number(int(m[2])))+'>',line,flags=re.I)
    text='\n'.join(dialogue_heading(line) if re.match(r'\s*Dialogue:',line,re.I) else prompt_review.normalize(line,number) for line in text.split('\n'))
    if active:
        # Managed references are compiled fresh even when an imported prompt
        # contains an old generated definition. Keep the complete dossier on
        # the asset; it is never a direct video-generation instruction.
        text=re.sub(r'(?ims)^subject_definitions:\s*.*?(?=^(?:summary|timeline|editing|audio|cinematography|continuity_constraints|negative_constraints):|\Z)','',text)
        definitions=[]
        costume_change=bool(re.search(r'烧(?:焦|毁|掉)|碳化|换衣|脱(?:下|掉)|撕(?:裂|破)|衣.{0,6}(?:破|毁)',segment.get('storyText','')+' '+ ' '.join(sh.get('action','') for sh in segment.get('shots',[]))))
        for i,a in enumerate(active):
            label=prompt_review.generation_description(a)['generation'] or (a.get('kind','参考素材')+'参考，素材名称：'+a.get('name','未命名'))
            constraint=('保持身份、脸部、发型与体型一致；起始服装来自参考，后续只按时间线发生明确的服装变化。' if costume_change else '保持身份、脸部、发型、服装与体型一致。') if a.get('kind')=='人物' else '保持参考图中的布局、外观、材质与配色。'
            definitions.append(f'<Subject {i+1}> is {label} from <Picture {i+1}>. {constraint}')
            layout=prompt_review.scene_description(a)
            if layout:definitions.append(f'<Subject {i+1}> 场景基准（仅适用该参考视角，换机位不得移动固定物件）：\n'+layout)
        text='\n'.join(line if re.match(r'\s*Dialogue:',line,re.I) else prompt_review.normalize(line,label='Subject') for line in text.split('\n'))
        guide='参考用途：人物图片仅约束人物身份与服装，不沿用设定板的背景、排版或展示站姿；每镜头仅使用其明确绑定的场景，不混合其他参考场景。视频环境由场景参考与已确认布局决定。未显示的入口和通路不自行补造。'
        text='subject_definitions:\n'+'\n'.join(definitions)+'\n'+guide+'\n\n'+text
    return text

def original_scoped_prompt(project, segment):
    legacy=legacy_scoped_prompt(project,segment)  # Retain missing/deleted-reference validation.
    if not (project.get('assetsManaged') or project.get('generationManaged') or segment.get('planning',{}).get('h3PromptVersion')==2):return legacy
    import h3_compiler
    return h3_compiler.compile_prompt(sys.modules[__name__],project,segment)

def scoped_prompt(project, segment):
    source=original_scoped_prompt(project,segment);lang=segment.get('promptExportLanguage','original')
    if lang=='original':return source
    versions=segment.get('promptTranslations',{})
    if lang not in ['zh','en'] or versions.get('sourceHash')!=digest(source) or not versions.get(lang):raise ValueError('提示词翻译已过期，请重新翻译或切回原文后导出')
    return versions[lang]

def portable_pack_media(files, project):
    """Use paths recognized by H3's import prefix rewrite, keeping JSON mirrors in sync."""
    source={**files}
    for name,b64 in project.get('media',{}).items():
        if Path(name).is_absolute() or '..' in Path(name).parts: raise ValueError('素材路径无效')
        source[name]=base64.b64decode(b64)
    mapping={}
    if project.get('assetsManaged'):
        public=scoped_assets(project)
        entries=[(a,'shared_params',i) for kind in generation_backend.FIELDS for i,a in enumerate(x for x in public if generation_backend.media_type(x)==kind)]
        for n,segment in enumerate(project['segments']):
            active=scoped_assets(project,segment)
            for kind, (_, _, _, limit) in generation_backend.FIELDS.items():
                if sum(generation_backend.media_type(a)==kind for a in active)>limit: raise ValueError(f'{segment["title"]} 的 {kind} 参考超出 {limit} 个')
            folder=str(Path(segment.get('groupPath',f'asset_groups/{n+1:02d}/group.json')).parent)
            entries.extend((a,folder,i) for kind in generation_backend.FIELDS for i,a in enumerate(x for x in active if generation_backend.media_type(x)==kind) if a.get('scope')=='segment')
        for a,folder,i in entries:
            name=a['path'];ext=Path(name).suffix.lower()
            if ext=='.jpeg': ext='.jpg'
            kind=generation_backend.media_type(a)
            allowed={'image':{'.png','.jpg','.webp','.bmp','.gif','.tif','.tiff'},'audio':{'.wav','.mp3','.flac','.ogg','.m4a','.aac'},'video':{'.mp4','.webm','.mov','.mkv'}}
            if ext not in allowed[kind]: raise ValueError('不支持的参考素材格式：'+a.get('name',name))
            if name not in source: raise ValueError('缺少参考素材文件：'+a.get('name',name)+'。请替换该素材后重新导出')
            mapping.setdefault(name,f'{folder}/Picture{i+1}{ext}' if kind=='image' else f'{folder}/{generation_backend.FIELDS[kind][2]}{i+1}{ext}')
    for name in project.get('media',{}):
        if name not in mapping and (not name.startswith(H3_MEDIA_PREFIXES) or not re.fullmatch(r'[A-Za-z0-9_./]+',name)):
            ext=Path(name).suffix.lower()
            if ext=='.jpeg': ext='.jpg'
            mapping[name]='extra/media_'+hashlib.sha256(name.encode()).hexdigest()[:16]+ext
    # Current references own their destinations; stale imported media must never overwrite them.
    targets=set(mapping.values())
    for name,target in mapping.items(): files[target]=source[name]
    for name in project.get('media',{}):
        if name not in mapping and name not in targets: files[name]=source[name]
    media_keys=('imageFile','image_file','audioFile','audio_file','videoFile','video_file','previewImageFile','preview_image_file','pairedAudioFile','paired_audio_file')
    def rewrite(value):
        if isinstance(value,list): return [rewrite(v) for v in value]
        if isinstance(value,str): return mapping.get(value,value)
        if not isinstance(value,dict): return value
        result={k:rewrite(v) for k,v in value.items()}
        for key in media_keys:
            if value.get(key) in mapping:
                target=result[key];result.update(fileName=Path(target).name,subfolder=str(Path(target).parent),type='input')
            name=result.get(key)
            if name and name.startswith(H3_MEDIA_PREFIXES) and name not in files:
                raise ValueError('导演包缺少引用资源：'+name)
        return result
    for name in list(files):
        if name.endswith('.json'):
            try: obj=json.loads(files[name])
            except (ValueError,UnicodeDecodeError):continue
            files[name]=json.dumps(rewrite(obj),ensure_ascii=False,indent=2).encode()

def canonicalize_pack_paths(files):
    """Match Director's strict archive path alphabet; rewrite JSON references together."""
    mapping={}
    for name in files:
        normalized=name.replace('\\','/')
        if normalized.startswith('/') or '..' in normalized.split('/'):
            raise ValueError('导演包包含不安全路径：'+name)
        if not re.fullmatch(r'[A-Za-z0-9_./]+',normalized):
            ext=Path(normalized).suffix.lower()
            if not re.fullmatch(r'\.[A-Za-z0-9]+',ext):ext='.bin'
            normalized='extra/file_'+hashlib.sha256(normalized.encode()).hexdigest()[:20]+ext
        mapping[name]=normalized
    def rewrite(value):
        if isinstance(value,str):return mapping.get(value,value)
        if isinstance(value,list):return [rewrite(v) for v in value]
        if not isinstance(value,dict):return value
        result={k:rewrite(v) for k,v in value.items()}
        for key in ('imageFile','image_file','audioFile','audio_file','videoFile','video_file','previewImageFile','preview_image_file','pairedAudioFile','paired_audio_file'):
            target=result.get(key)
            if target and target in mapping.values():
                result.update(fileName=target.rsplit('/',1)[-1],subfolder=target.rsplit('/',1)[0] if '/' in target else '',type='input')
        return result
    canonical={}
    for name,data in files.items():
        target=mapping[name]
        if target.endswith('.json'):
            try:data=json.dumps(rewrite(json.loads(data)),ensure_ascii=False,indent=2).encode()
            except (ValueError,UnicodeDecodeError):pass
        if target in canonical and canonical[target]!=data:
            raise ValueError('导演包路径重复且内容不同：'+target)
        canonical[target]=data
    files.clear();files.update(canonical)

def export_pack(p,force=False):
    if not force: prompt_review.enforce(sys.modules[__name__],p)
    files={}
    if p.get('originalZip'):
        z=zipfile.ZipFile(io.BytesIO(base64.b64decode(p['originalZip']))); files={i.filename:z.read(i) for i in z.infolist() if not i.is_dir()}
    pack=json.loads(files.get('pack.json',b'{"format":"minimax-h3-director-pack","formatVersion":1,"taskType":"r2v","widgets":{}}'))
    tl=json.loads(files.get('timeline.json',b'{"version":5,"editMode":"segment","timelineMode":"prompt_batch","global":{},"segments":[],"batchWorkspaces":{}}'))
    if not p.get('originalZip'):
        template=json.loads((ROOT/'presets'/'director-pack-template.json').read_text('utf-8'))
        pack=template['pack'];tl=template['timeline']
        tl['segments']=[]; tl['batchWorkspaces']={}; tl['global']={'prompt':'','refs':[],'commonEnabled':True}; tl['videoClips']=[]; tl['video']={'fileName':'','videoFile':'','frames':[],'frameMap':[]}; tl['runSelection']=[]
    oldaspect=aspect_from_output(pack.get('output',{}))
    pack.setdefault('output',{}).update(guide_settings(p,pack.get('output',{})))
    if p.get('aspect','16:9')!=oldaspect:
        out=pack.setdefault('output',{}); width,height=aspect_dimensions(p['aspect'],int(out.get('longEdge',960)),int(out.get('multiple',32)))
        out.update(width=width,height=height,aspectRatio=p['aspect'])
        tl.update(width=width,height=height,output=copy.deepcopy(out))
    fps=p.get('fps',24); cursor=0; output=[]
    for n,s in enumerate(p['segments']):
        if s['duration']<=0: raise ValueError('片段时长必须大于 0')
        for sh in s['shots']:
            if not (0<=sh['start']<sh['end']<=s['duration']+.001): raise ValueError('镜头时间超出片段，请先调整')
        gp=s.get('groupPath',f'asset_groups/{n+1:02d}/group.json')
        original=next((g for g in tl.get('segments',[]) if g.get('id')==s['id']),{})
        group=json.loads(files.get(gp,files.get(s.get('sourceGroupPath',''),b'{}'))); merged={**original,**group}
        changed=s['duration']!=s.get('originalDuration')
        offset=int(merged.get('frameCount',round(s['duration']*fps)+2))-round(s.get('originalDuration',s['duration'])*fps)
        frames=round(s['duration']*fps)+offset if changed else int(merged.get('frameCount',round(s['duration']*fps)+2))
        merged.update(id=s['id'],prompt=scoped_prompt(p,s),durationSec=s['duration'],frameCount=frames,length=frames,start=cursor,continuityFromPrev=bool(n>0 and pack['output']['continuityEnabled'] and s.get('guideFromPrev',s.get('continuity',False))),refs=s.get('refs',[]))
        for key in ['negativePrompt','taskType']: merged.setdefault(key,'')
        for key in ['refAudios','refVideos','loras']: merged.setdefault(key,[])
        files[gp]=json.dumps(merged,ensure_ascii=False,indent=2).encode(); output.append(merged); cursor+=frames
    tl.update(segments=output,totalFrames=cursor,frameRate=fps,output=copy.deepcopy(pack.get('output',{})))
    mode=pack.get('taskType','r2v'); workspace=tl.get('batchWorkspaces',{}).get(mode)
    if workspace is not None:
        if isinstance(workspace.get('output'),dict):workspace['output'].update(guide_settings(p,pack.get('output',{})))
        existing=workspace.get('segments',[]); synced=[]
        for seg in output:
            previous=next((g for g in existing if g.get('id')==seg['id']),{})
            synced.append({**previous,**seg})
        workspace['segments']=synced; workspace['runSelection']=list(range(len(output)))
    tl['runSelection']=list(range(len(output)))
    # Generated keyframes are handed to H3 in its existing image-reference shape.
    for n, segment in enumerate(p['segments']):
        for field, shotkey, pick in [('startImage','firstFrame',0),('endImage','lastFrame',-1)]:
            candidates=[sh[shotkey] for sh in segment['shots'] if sh.get(shotkey)]
            if candidates:
                name=candidates[pick]
                ref={'imageFile':name,'fileName':Path(name).name,'subfolder':str(Path(name).parent),'type':'input','imageB64':''}
                output[n][field]=ref
                gp=segment.get('groupPath',f'asset_groups/{n+1:02d}/group.json')
                files[gp]=json.dumps(output[n],ensure_ascii=False,indent=2).encode()
                if workspace is not None: workspace['segments'][n][field]=ref
    files['pack.json']=json.dumps(pack,ensure_ascii=False,indent=2).encode()
    files['timeline.json']=json.dumps(tl,ensure_ascii=False,indent=2).encode()
    if 'shared_params/shared_params.json' not in files:
        refs=[{'index':i,'imageFile':a['path'],'fileName':Path(a['path']).name,'type':'input','subfolder':str(Path(a['path']).parent),'imageB64':''} for i,a in enumerate(p.get('assets',[])) if a.get('path') and generation_backend.media_type(a)=='image']
        shared={'commonEnabled':True,'prompt':'','refs':refs,'refAudios':[],'refVideos':[]}; files['shared_params/shared_params.json']=json.dumps(shared).encode(); tl['global'].update(shared); files['timeline.json']=json.dumps(tl,ensure_ascii=False,indent=2).encode()
    shared=json.loads(files['shared_params/shared_params.json'])
    existing=shared.get('refs',[])
    for asset in p.get('assets',[]):
        if asset.get('kind')=='人物' and generation_backend.media_type(asset)=='image' and asset.get('path') and not any(r.get('imageFile')==asset['path'] for r in existing):
            name=asset['path']; index=max([r.get('index',-1) for r in existing]+[-1])+1
            existing.append({'index':index,'imageFile':name,'fileName':Path(name).name,'type':'input','subfolder':str(Path(name).parent),'imageB64':''})
    if p.get('assetsManaged'):
        def ref(a,i): return {'index':i,'imageFile':a['path'],'fileName':Path(a['path']).name,'type':'input','subfolder':str(Path(a['path']).parent),'imageB64':''}
        public=[a for a in scoped_assets(p) if generation_backend.media_type(a)=='image']
        if len(public)>9: raise ValueError('H3 公共参考图片最多 9 张')
        existing=[ref(a,i) for i,a in enumerate(public)]
        shared['commonEnabled']=True
        tl.setdefault('global',{})['commonEnabled']=True
        if workspace is not None: workspace.setdefault('globalCommon',{})['commonEnabled']=True
        for n,s in enumerate(p['segments']):
            active=[a for a in scoped_assets(p,s) if generation_backend.media_type(a)=='image']
            if len(active)>9: raise ValueError(f'{s["title"]} 的公共 + 本组参考图片最多 9 张')
            output[n]['refs']=[ref(a,i) for i,a in enumerate(active) if a.get('scope')=='segment']
            gp=s.get('groupPath',f'asset_groups/{n+1:02d}/group.json')
            files[gp]=json.dumps(output[n],ensure_ascii=False,indent=2).encode()
            if workspace is not None: workspace['segments'][n].update(refs=copy.deepcopy(output[n]['refs']),prompt=output[n]['prompt'])
    shared['refs']=existing
    files['shared_params/shared_params.json']=json.dumps(shared,ensure_ascii=False,indent=2).encode()
    tl.setdefault('global',{})['refs']=copy.deepcopy(existing)
    if workspace is not None: workspace.setdefault('globalCommon',{})['refs']=copy.deepcopy(existing)
    files['timeline.json']=json.dumps(tl,ensure_ascii=False,indent=2).encode()
    generation_backend.export(files,p,pack,tl,scoped_assets)
    side={k:p.get(k) for k in ['generation','generationManaged','sourceVideo','sourceVideoClips','version','title','script','aspect','assets','assetsManaged','assetsCollapsed','nextPictureNumber','showDeletedAssets','groupAssetsCollapsed','intent','writingRuleIds','dialogueLanguage','storySeparated','directorGuide','overviewLayout','storyPlans','planningOptions']}
    side['directorGuide']=guide_settings(p,pack.get('output',{}))
    side['segments']=[{**{k:s[k] for k in ['generation','id','title','shots','storyText','storyHistory','videos','planning','promptHistory','continuity','guideFromPrev','shotHistory','dialogueLanguage','writingRuleIds','promptTranslations','promptExportLanguage'] if k in s},'workingPrompt':s['prompt'],'promptHash':digest(output[i]['prompt'])} for i,s in enumerate(p['segments'])]
    files['storyboard.json']=json.dumps(side,ensure_ascii=False,indent=2).encode()
    # Remove previously bundled manual clips; export only current segment records.
    for name in list(files):
        if name.startswith('extra/segment_videos/'):del files[name]
    active={v.get('path') for s in p['segments'] for v in s.get('videos',[])}
    active.update(a['path'] for a in p.get('assets',[]) if a.get('path') and not a.get('deleted'))
    if p.get('sourceVideo',{}).get('videoFile'):active.add(p['sourceVideo']['videoFile'])
    active.update(v['videoFile'] for v in p.get('sourceVideoClips',[]) if v.get('videoFile'))
    p={**p,'media':{k:v for k,v in p.get('media',{}).items() if not k.startswith('extra/segment_videos/') or k in active}}
    for path in active:
        if not p['media'].get(path):raise ValueError('参考素材或成片文件缺失：'+str(path))
    files.pop('extra/forced-export-report.json',None)
    files.pop('extra/forced_export_report.json',None)
    if force:
        report={'forced':True,'exportedAt':time.strftime('%Y-%m-%d %H:%M:%S'),'projectId':p['projectId'],'notice':'用户选择保留现有内容，跳过提示词冲突检查；结构和媒体检查仍执行。','segments':[{'id':seg['id'],'title':seg['title'],'issues':prompt_review.quality(sys.modules[__name__],p,seg)} for seg in p['segments']]}
        files['extra/forced_export_report.json']=json.dumps(report,ensure_ascii=False,indent=2).encode()
    inventory={'notice':'公共参考在接收端公共参数中；本组空槽位不表示公共音频或视频未导出。音视频是参考条件，不是片段成片。','public':{key:copy.deepcopy(tl.get('global',{}).get(key,[])) for key in ['refs','refAudios','refVideos']},'segments':[{'title':s['title'],**{key:copy.deepcopy(target.get(key,[])) for key in ['refs','refAudios','refVideos']}} for s,target in zip(p['segments'],tl['segments'])]}
    files['extra/reference_inventory.json']=json.dumps(inventory,ensure_ascii=False,indent=2).encode()
    portable_pack_media(files,p)
    if sum(len(v) for v in files.values())>400*1024*1024:raise ValueError('导演包素材超过 400MB，请减少视频或压缩后再导出')
    canonicalize_pack_paths(files)
    buf=io.BytesIO()
    with zipfile.ZipFile(buf,'w',zipfile.ZIP_DEFLATED) as z:
        for name,data in files.items(): z.writestr(name,data)
    return buf.getvalue()
def request(url,body=None,key='',method=None,content_type='application/json',timeout=90):
    if not url.startswith(('http://','https://')): raise ValueError('Endpoint 必须使用 http:// 或 https://')
    headers={'Content-Type':content_type}
    if key: headers['Authorization']='Bearer '+key
    data=json.dumps(body).encode() if isinstance(body,(dict,list)) else body
    try:
        with urlopen(Request(url,data=data,headers=headers,method=method),timeout=timeout) as r: return r.read()
    except HTTPError as e: raise ValueError(f'服务返回 HTTP {e.code}: '+e.read().decode(errors='replace')[:400])
def ai_call(cfg,messages,json_mode=False):
    with COMPUTE_LOCK:return _ai_call(cfg,messages,json_mode)
def ai_session(ident):
    import ai_runtime
    return ai_runtime.session(sys.modules[__name__],ident)
def _ai_call(cfg,messages,json_mode=False):
    import ai_runtime
    return ai_runtime.call(sys.modules[__name__],cfg,messages,json_mode)
def unload_model(cfg):
    with COMPUTE_LOCK:return _unload_model(cfg)
def _unload_model(cfg):
    if cfg.get('provider')!='ollama': raise ValueError('手动卸载目前仅支持 Ollama')
    model=cfg.get('model','').strip()
    if not model: raise ValueError('请先选择需要卸载的模型')
    result=json.loads(request(cfg['endpoint'].rstrip('/')+'/api/generate',{'model':model,'keep_alive':0,'stream':False},cfg.get('key',''),timeout=60))
    if result.get('error'): raise ValueError(result['error'])
    return {'message':'已请求 Ollama 卸载 '+model+'（释放内存，不删除模型文件）'}
def merge_project_delta(current,body):
    """Reuse durable media for metadata saves; never trust client filesystem paths."""
    if not current or not isinstance(body,dict):raise ValueError('项目不存在，请重新打开')
    project=body.get('project');patch=body.get('media')
    if not isinstance(project,dict) or project.get('projectId')!=current.get('projectId'):raise ValueError('项目已切换，修改未覆盖新项目')
    if 'media' in project or 'originalZip' in project or not isinstance(patch,dict):raise ValueError('增量保存格式无效')
    put=patch.get('put',{});remove=patch.get('remove',[])
    if not isinstance(put,dict) or not isinstance(remove,list):raise ValueError('媒体变更格式无效')
    for key in [*put,*remove]:
        if not isinstance(key,str) or not key or key.startswith(('/', '\\')) or '..' in key or ':' in key:raise ValueError('媒体路径无效')
    if any(not isinstance(value,str) for value in put.values()):raise ValueError('媒体内容无效')
    media={**current.get('media',{}),**put}
    for key in remove:media.pop(key,None)
    original=body.get('originalZip',current.get('originalZip',''))
    if not isinstance(original,str):raise ValueError('原始导演包格式无效')
    return {**project,'media':media,'originalZip':original}

def save(p,previous=None):
    import project_store
    with LOCK:
        import asset_lifecycle,project_media
        if previous is None:
            cached=_CACHE['project']
            if cached is not None and _CACHE['stamp']==_state_stamp():previous=cached
            elif STATE.exists():previous=project_media.attach(json.loads(STATE.read_text('utf-8')),DATA)
            else:previous=None
        import plan_store
        archive=plan_store.records(sys.modules[__name__],p)
        if archive:p['planArchive']=archive
        asset_lifecycle.normalize(p,previous)
        project_store.before_save(DATA,STATE,p)
        payload=project_media.detach(p,DATA)
        p['mediaIndex']=payload['mediaIndex']
        temp=STATE.with_suffix('.tmp');temp.write_text(json.dumps(payload,ensure_ascii=False),'utf-8');temp.replace(STATE)
        project_store.after_save(DATA,STATE,p)
        write_layout(p.get('projectId',''),p.get('overviewLayout') or {})
        _remember(p)
def settings(): return json.loads(CONFIG.read_text('utf-8')) if CONFIG.exists() else {'ai':{'provider':'ollama','endpoint':'http://127.0.0.1:11434','model':'','key':''}}
def save_settings(body,patch=False):
    if not isinstance(body,dict): raise ValueError('连接设置格式无效')
    with LOCK:
        value=settings() if patch else copy.deepcopy(body)
        if patch:
            for key,section in body.items():
                if key not in ['ai','image','video','ui'] or not isinstance(section,dict): raise ValueError('设置分区无效')
                value[key]={**value.get(key,{}),**copy.deepcopy(section)}
        CONFIG.parent.mkdir(parents=True,exist_ok=True)
        tmp=CONFIG.with_suffix('.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False,indent=2),'utf-8');tmp.replace(CONFIG)
    return {'ok':True}
def unload_all_models(s):
    cfg=s.settings().get('ai',{})
    if cfg.get('provider')!='ollama': raise ValueError('一键卸载目前用于连接设置中的 Ollama 服务')
    m=tasks.manager(s);m.action({'action':'pause'})
    with COMPUTE_LOCK:
        base=cfg.get('endpoint','').rstrip('/');key=cfg.get('key','')
        loaded=json.loads(request(base+'/api/ps',key=key,timeout=15)).get('models',[])
        names=list(dict.fromkeys(v.get('name') or v.get('model') for v in loaded if v.get('name') or v.get('model')));failures=[];unloaded=[]
        for name in names:
            try:
                _unload_model({**cfg,'model':name});unloaded.append(name)
            except Exception as e: failures.append(name+': '+str(e))
        remaining=json.loads(request(base+'/api/ps',key=key,timeout=15)).get('models',[])
        message=('已卸载 '+str(len(unloaded))+' 个 Ollama 模型' if names else 'Ollama 当前没有已加载模型')+'；队列已暂停，点击任务中心继续队列可恢复'
        if remaining: message+='；仍有 '+str(len(remaining))+' 个模型加载中，请检查其他 Ollama 使用程序'
        if failures: message+='；卸载失败：'+'；'.join(failures)
        return {'message':message,'unloaded':unloaded,'remaining':[v.get('name') or v.get('model') for v in remaining],'errors':failures,'paused':True}

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def respond(self,data,code=200,mime='application/json',inline=False):
        if mime=='application/json' and isinstance(data,dict) and data.get('projectId') and isinstance(data.get('media'),dict):
            data=public_project(data)
        raw=json.dumps(data,ensure_ascii=False).encode() if mime=='application/json' else data
        self.send_response(code);
        if inline:self.send_header('Content-Disposition','inline')
        self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(raw)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(raw)
    def send_media(self,project_id,path,wanted):
        """Stream one media file, honouring Range so video seeking works."""
        project=load_project()
        if not project or project.get('projectId')!=project_id:raise ValueError('项目已切换，请刷新后重试')
        index=project.get('mediaIndex') if isinstance(project.get('mediaIndex'),dict) else {}
        digest=index.get(path)
        if not digest:raise ValueError('素材文件不存在')
        if wanted and wanted!=digest:raise ValueError('素材已更新，请刷新后重试')
        source=DATA/'media'/(digest+'.b64')
        if not source.is_file():raise ValueError('素材文件缺失，请重新导入')
        total=decoded_size(source)
        start,end=0,max(0,total-1);partial=False
        header=(self.headers.get('Range') or '').strip()
        match=re.fullmatch(r'bytes=(\d*)-(\d*)',header) if header else None
        if match and total:
            if match.group(1):start=int(match.group(1));end=int(match.group(2)) if match.group(2) else total-1
            else:start=max(0,total-int(match.group(2) or 0));end=total-1
            start=max(0,min(start,total-1));end=max(start,min(end,total-1));partial=True
        body=read_b64_range(source,start,end) if total else b''
        self.send_response(206 if partial else 200)
        self.send_header('Content-Type',mimetypes.guess_type(path)[0] or 'application/octet-stream')
        self.send_header('Accept-Ranges','bytes')
        self.send_header('Content-Length',str(len(body)))
        self.send_header('ETag','"'+digest+'"')
        self.send_header('Cache-Control','private, max-age=31536000, immutable')
        if partial:self.send_header('Content-Range','bytes %d-%d/%d'%(start,end,total))
        self.end_headers();self.wfile.write(body)
    def valid(self):
        host=self.headers.get('Host','').split(':')[0]
        return host in ['127.0.0.1','localhost'] and self.headers.get('X-Workbench-Token')==TOKEN
    def do_GET(self):
        try:
            route=self.path.split('?')[0]
            if route=='/api/bootstrap':
                if self.headers.get('Sec-Fetch-Site') not in [None,'same-origin','none']: raise ValueError('跨站请求已拒绝')
                version=json.loads((ROOT/'version.json').read_text('utf-8'))
                return self.respond({'token':TOKEN,'version':version.get('version',''),'release':version.get('release',''),'appId':'frame-storyboard-workbench','runtimeMode':'exe' if getattr(sys,'frozen',False) else 'source','dataDirectory':str(DATA)})
            if route=='/api/diagnostics': return self.respond(diagnostics())
            if route=='/api/theme-backdrops': return self.respond(theme_backdrops.listing(DATA))
            if route.startswith('/api/theme-backdrop/'):
                if self.headers.get('Sec-Fetch-Site') not in [None,'same-origin','none']:raise ValueError('跨站请求已拒绝')
                raw,mime=theme_backdrops.read(DATA,route.rsplit('/',1)[-1])
                return self.respond(raw,200,mime)
            if route=='/api/media':
                query=parse_qs(urlparse(self.path).query)
                if self.headers.get('Sec-Fetch-Site') not in [None,'same-origin','none']:raise ValueError('跨站请求已拒绝')
                return self.send_media((query.get('p') or [''])[0],(query.get('path') or [''])[0],(query.get('h') or [''])[0])
            if route.startswith('/reference-media/'):
                name=route.rsplit('/',1)[-1]
                if not re.fullmatch(r'[a-f0-9]{64}\.(?:bin|png|jpg|webp|gif|mp4|webm)',name):raise ValueError('参考媒体路径无效')
                if self.headers.get('Sec-Fetch-Site') not in [None,'same-origin','none']:raise ValueError('跨站请求已拒绝')
                name=name.rsplit('.',1)[0]+'.bin'
                import visual_library
                with LOCK:
                    rows=visual_library._records(DATA)
                    row=next((r for r in rows if r.get('mediaFile')==name),None)
                    if not row:raise ValueError('参考媒体不存在')
                    raw=(DATA/'reference-media'/name).read_bytes()
                return self.respond(raw,mime=row['mime'],inline=True)
            if route=='/example-thumbnail':
                import project_hub
                with LOCK:
                    example=readzip((ROOT/'presets/starter-project.mmxpack.zip').read_bytes());url=project_hub.thumbnail(DATA,example)
                    if not url:raise ValueError('示例封面不可用')
                    return self.respond((DATA/'project-thumbnails'/url.rsplit('/',1)[-1]).read_bytes(),mime='image/jpeg',inline=True)
            if route.startswith('/project-thumbnail/'):
                name=route.removeprefix('/project-thumbnail/')
                if not re.fullmatch(r'[a-f0-9]{64}\.jpg',name):raise ValueError('缩略图地址无效')
                path=DATA/'project-thumbnails'/name
                if path.is_symlink():raise ValueError('缩略图路径无效')
                return self.respond(path.read_bytes(),mime='image/jpeg',inline=True)
            if route.startswith('/asset-library-media/'):
                import creative_library
                with LOCK:raw,mime=creative_library.media_file(DATA,route.removeprefix('/asset-library-media/'))
                return self.respond(raw,mime=mime,inline=True)
            if route.startswith('/api/') and not self.valid(): return self.respond({'error':'请求验证失败'},403)
            if route=='/api/appearance-presets':
                import appearance_presets
                with LOCK:return self.respond(appearance_presets.listing(DATA))
            if route in ['/api/asset-library','/api/layout-presets']:
                import creative_library
                with LOCK:return self.respond(creative_library.library(DATA) if route.endswith('asset-library') else creative_library.presets(DATA))
            if route in ['/api/projects','/api/projects-trash']:
                import project_store
                with LOCK:return self.respond(project_store.trash_listing(DATA,STATE) if route.endswith('trash') else project_store.listing(DATA,STATE))
            if route=='/api/project':
                with LOCK:project=load_project()
                return self.respond(project)
            if route=='/api/settings': return self.respond(settings())
            if route=='/api/check-updates':
                import update_check
                current=json.loads((ROOT/'version.json').read_text('utf-8')).get('release','v3.9-beta.1')
                return self.respond(update_check.check(current))
            if route=='/api/visual-library-storage':
                import visual_library
                with LOCK:
                    rows=visual_library._records(DATA);used={r['mediaFile'] for r in rows if r.get('mediaFile')};size=sum((DATA/'reference-media'/name).stat().st_size for name in used if (DATA/'reference-media'/name).is_file())
                    return self.respond({'used':size,'limit':None})
            if route=='/api/visual-pack-export':
                import reference_packs
                with LOCK:return self.respond(reference_packs.export(DATA),mime='application/zip')
            if route=='/api/visual-references':
                import visual_library
                with LOCK:return self.respond(visual_library.read(DATA,public=True))
            if route=='/api/reverse-templates':return self.respond(reverse.templates(sys.modules[__name__]))
            if route=='/api/tasks':return self.respond(tasks.manager(sys.modules[__name__]).public())
            if route=='/api/export':
                with LOCK:project=load_project()
                if not project:raise ValueError('请先打开项目')
                return self.respond(export_pack(project),mime='application/zip')
            path=ROOT/'web'/('index.html' if route=='/' else route.lstrip('/'))
            if not path.resolve().is_relative_to((ROOT/'web').resolve()): return self.respond({'error':'无效路径'},403)
            return self.respond(path.read_bytes(),mime=mimetypes.guess_type(str(path))[0] or 'application/octet-stream')
        except Exception as e: note_error(self.path,str(e));self.respond({'error':str(e)},400)
    def do_POST(self):
        if not self.valid(): return self.respond({'error':'请求验证失败'},403)
        try:
            size=int(self.headers.get('Content-Length',0));route=self.path.split('?')[0]
            if route=='/api/theme-backdrops':
                body=json.loads(self.rfile.read(size) or b'{}')
                return self.respond(theme_backdrops.add(DATA,body))
            if size<0:raise ValueError('请求长度无效')
            if route not in {'/api/visual-references','/api/visual-pack-preview'} and size>550*1024*1024: raise ValueError('文件超过上传上限')
            raw=self.rfile.read(size)
            if route=='/api/import':
                p=readzip(raw)
                with LOCK: save(p)
                return self.respond(p)
            if route=='/api/visual-pack-preview':
                import reference_packs
                with LOCK:return self.respond(reference_packs.preview(DATA,raw))
            body=json.loads(raw or b'{}')
            if route=='/api/appearance-presets':
                import appearance_presets
                with LOCK:return self.respond(appearance_presets.update(DATA,body))
            if route in ['/api/asset-library','/api/asset-library-apply','/api/layout-presets']:
                import creative_library
                with LOCK:
                    if route.endswith('apply'):return self.respond(creative_library.apply_asset(sys.modules[__name__],body))
                    if route.endswith('asset-library'):
                        result=creative_library.update_asset(DATA,body)
                        if body.get('action')=='category':
                            import project_hub
                            project_hub.rename_category(sys.modules[__name__],body['name'],'未分类' if body.get('remove') else body.get('newName') or body['name'])
                        return self.respond(result)
                    return self.respond(creative_library.update_preset(DATA,body))
            if route=='/api/canvas-layout':
                with LOCK:
                    p=load_project();layout=body.get('layout')
                    if not p or p['projectId']!=body.get('projectId'):raise ValueError('项目已切换，布局未覆盖新项目')
                    if not isinstance(layout,dict) or len(json.dumps(layout))>1024*1024:raise ValueError('布局无效或过大')
                    # Dragging a card is the most frequent write; keep it to the small layout file
                    # instead of rewriting the whole project.
                    p['overviewLayout']=layout;write_layout(p['projectId'],layout);return self.respond({'ok':True})
            if route in ['/api/project-action','/api/project-download']:
                import project_hub
                with LOCK:
                    if route.endswith('project-action'):return self.respond(project_hub.action(sys.modules[__name__],body))
                    project=project_hub.read(DATA,STATE,body.get('projectId'));return self.respond(export_pack(project,force=body.get('force') is True),mime='application/zip')
            if route in ['/api/project-open','/api/projects-recover','/api/projects-delete','/api/project-restore']:
                import project_store
                with LOCK:
                    if route.endswith('recover'):return self.respond(project_store.recover(DATA,STATE))
                    if route.endswith('delete'):
                        result=project_store.delete_projects(DATA,STATE,body.get('projectIds'),body.get('currentProjectId'),body.get('all',False))
                        tasks.cancel_projects(sys.modules[__name__],body['projectIds'])
                        return self.respond(result)
                    if route.endswith('restore'):return self.respond(project_store.restore_project(DATA,STATE,body.get('projectId'),body.get('currentProjectId')))
                    return self.respond(project_store.open_project(DATA,STATE,body.get('projectId'),body.get('currentProjectId'),save))
            if route in ['/api/visual-pack-apply','/api/visual-pack-cancel']:
                import reference_packs
                with LOCK:
                    if route.endswith('cancel'):
                        reference_packs.cancel(DATA,body.get('token'));return self.respond({'ok':True})
                    return self.respond(reference_packs.apply(DATA,body))
            if route=='/api/visual-reference-media':
                import visual_library
                with LOCK:
                    row=next((r for r in visual_library._records(DATA) if r['id']==body.get('id')),None)
                    if not row or not row.get('mediaFile'):raise ValueError('该条目没有参考媒体')
                    path=DATA/'reference-media'/row['mediaFile']
                    if not path.is_file():raise ValueError('找不到参考媒体文件，请从原工作台 data 目录恢复')
                    return self.respond({'image':'data:'+row['mime']+';base64,'+base64.b64encode(path.read_bytes()).decode()})
            if route=='/api/visual-references':
                import visual_library
                with LOCK:return self.respond(visual_library.update(DATA,body,public=True))
            if route=='/api/reverse-templates':return self.respond(reverse.update_template(sys.modules[__name__],body))
            if route=='/api/reverse-prompt':return self.respond(reverse.enqueue(sys.modules[__name__],body))
            if route=='/api/task-action':return self.respond(tasks.manager(sys.modules[__name__]).action(body))
            if route=='/api/analyze-shots':return self.respond(studio.enqueue_analysis(sys.modules[__name__],body))
            if route=='/api/apply-analysis':return self.respond(studio.apply_analysis(sys.modules[__name__],body))
            if route=='/api/repair-pack-images':
                with LOCK:
                    p=load_project()
                    if not p or p.get('projectId')!=body.get('projectId'):raise ValueError('项目已切换，请刷新后再修复')
                    count=restore_pack_images(p);save(p)
                return self.respond({'project':p,'recovered':count})
            if route=='/api/editor-presets':
                import editor_presets
                return self.respond(editor_presets.library(sys.modules[__name__],body))
            if route in ['/api/agent-threads','/api/agent-info','/api/agent-send','/api/agent-apply','/api/agent-undo']:
                import agent_backend as agent
                action={'/api/agent-threads':agent.thread_action,'/api/agent-info':agent.info,'/api/agent-send':agent.enqueue,'/api/agent-apply':agent.apply,'/api/agent-undo':agent.undo}[route]
                return self.respond(action(sys.modules[__name__],body))
            if route=='/api/plan-record':
                import plan_store
                return self.respond(plan_store.endpoint(sys.modules[__name__],body))
            if route in ['/api/writing-rules','/api/story-plan','/api/story-restore','/api/story-apply']:
                import writing_backend as writing
                action={'/api/writing-rules':writing.library,'/api/story-plan':writing.enqueue,'/api/story-restore':writing.restore,'/api/story-apply':writing.apply}[route]
                return self.respond(action(sys.modules[__name__],body))
            if route in ['/api/prompt-translate','/api/prompt-translations','/api/prompt-translation-save','/api/prompt-export-language']:
                import prompt_translation as translation
                action={'/api/prompt-translate':translation.enqueue,'/api/prompt-translations':translation.info,'/api/prompt-translation-save':translation.save_result,'/api/prompt-export-language':translation.choose}[route]
                return self.respond(action(sys.modules[__name__],body))
            if route=='/api/compiled-prompt':
                p=load_project()
                if not p or p.get('projectId')!=body.get('projectId'):raise ValueError('项目已切换，请刷新')
                segment=next((v for v in p['segments'] if v['id']==body.get('segmentId')),None)
                if segment is None:raise ValueError('片段不存在')
                return self.respond({'prompt':original_scoped_prompt(p,segment),'warnings':prompt_review.warnings(sys.modules[__name__],p,segment),'issues':prompt_review.quality(sys.modules[__name__],p,segment)})
            if route=='/api/export-force':
                with LOCK:
                    p=load_project()
                    if not p or p.get('projectId')!=body.get('projectId'):raise ValueError('项目已切换，请刷新')
                    if body.get('acknowledgeConflicts') is not True:raise ValueError('请确认保留未解决的提示词冲突')
                    data=export_pack(p,force=True)
                return self.respond(data,mime='application/zip')
            if route=='/api/smart-repair':return self.respond(planning.smart_repair(sys.modules[__name__],body))
            if route=='/api/prompt-quality':
                p=load_project()
                if not p or p.get('projectId')!=body.get('projectId'):raise ValueError('项目已切换，请刷新')
                return self.respond({'segments':[{'id':seg['id'],'title':seg['title'],'issues':prompt_review.quality(sys.modules[__name__],p,seg)} for seg in p['segments']]})
            if route=='/api/new-project': return self.respond(create_project(body.get('example',False),body.get('title','')))
            if route=='/api/import-project': return self.respond(import_project(body.get('project')))
            if route=='/api/unload': return self.respond(unload_model(body))
            if route=='/api/unload-all': return self.respond(unload_all_models(sys.modules[__name__]))
            if route=='/api/analyze-assets':return self.respond(asset_analysis.enqueue(sys.modules[__name__],body))
            if route=='/api/apply-assets':return self.respond(asset_analysis.apply(sys.modules[__name__],body))
            if route=='/api/confirm-assets':return self.respond(asset_analysis.confirm_all(sys.modules[__name__],body))
            if route=='/api/confirm-asset':return self.respond(asset_analysis.confirm(sys.modules[__name__],body))
            if route=='/api/edit-asset-analysis':return self.respond(asset_analysis.edit(sys.modules[__name__],body))
            if route=='/api/apply-planning':return self.respond(planning.apply(sys.modules[__name__],body))
            if route=='/api/planning-application-check':return self.respond(planning.application_check(sys.modules[__name__],body))
            if route=='/api/director-guide':
                p=load_project()
                if not p or p.get('projectId')!=body.get('projectId'):raise ValueError('项目已切换')
                return self.respond(guide_settings(p))
            if route in ['/api/analyze-media','/api/media-analysis-status','/api/edit-media-analysis']:
                import media_analysis
                if route=='/api/analyze-media':return self.respond(media_analysis.enqueue(sys.modules[__name__],body))
                if route=='/api/edit-media-analysis':return self.respond(media_analysis.update(sys.modules[__name__],body))
                p=load_project()
                if not p or p['projectId']!=body.get('projectId'):raise ValueError('项目已切换')
                a=next((v for v in p['assets'] if v['id']==body.get('assetId') and not v.get('deleted')),None)
                if not a:raise ValueError('素材已删除')
                return self.respond({'result':media_analysis.current(a,p['media']),'stale':bool(a.get('mediaAnalysis') and not media_analysis.current(a,p['media']))})
            if route=='/api/asset-analysis-status':
                p=load_project()
                if not p or p['projectId']!=body.get('projectId'):raise ValueError('项目已切换')
                return self.respond({'assets':[asset_analysis.status(a,p['media']) for a in p['assets'] if not a.get('deleted')]})
            if route=='/api/plan-shots': return self.respond(planning.enqueue(sys.modules[__name__],body))
            if route=='/api/settings-patch': return self.respond(save_settings(body,patch=True))
            if route=='/api/models': return self.respond({'models':list_models(body)})
            if route in ['/api/project','/api/project-delta']:
                with LOCK:
                    current=load_project()
                    if route=='/api/project-delta':
                        body=merge_project_delta(current,body)
                    if current and current.get('projectId')!=body.get('projectId'): return self.respond({'error':'当前项目已切换，请刷新页面，旧修改未覆盖新项目'},409)
                    # Background analysis drafts are server-owned: stale autosaves cannot erase them.
                    for a in body.get('assets',[]):
                        original=next((v for v in (current or {}).get('assets',[]) if v['id']==a['id']),None)
                        draft=original.get('analysisDraft') if original else None
                        if draft and draft.get('signature')==asset_analysis.signature(a,body.get('media',{})):a['analysisDraft']=copy.deepcopy(draft)
                        else:a.pop('analysisDraft',None)
                        import media_analysis
                        analysis=media_analysis.current(original,body.get('media',{})) if original and original.get('path')==a.get('path') else None
                        if analysis:a['mediaAnalysis']=copy.deepcopy(analysis)
                        else:a.pop('mediaAnalysis',None)
                    save(body,previous=current)
                return self.respond({'ok':True})
            if route=='/api/settings': return self.respond(save_settings(body))
            if route=='/api/rebuild': return self.respond({'prompt':rebuild(body)})
            if route=='/api/test':
                cfg=body; provider=cfg.get('provider')
                text=ai_call(cfg,[{'role':'user','content':'Reply with OK only.'}]); return self.respond({'message':'AI 连接成功：'+text[:120]})
            raise ValueError('未知操作')
        except Exception as e: note_error(self.path,str(e));self.respond({'error':str(e)},400)
if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8845);parser.add_argument('--no-browser',action='store_true');args=parser.parse_args()
    from update_workbench import retire_old_modules
    try:
        archived=retire_old_modules(ROOT)
        if archived:print('旧生成模块已归档：'+archived,flush=True)
    except Exception as e:print('旧模块清理未完成（项目数据保留）：'+str(e),flush=True)
    server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    print(f'分镜工作台: http://127.0.0.1:{args.port}  (Ctrl+C 关闭)',flush=True)
    if not args.no_browser: threading.Timer(.7,lambda:webbrowser.open(f'http://127.0.0.1:{args.port}')).start()
    server.serve_forever()
