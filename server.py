#!/usr/bin/env python3
"""Local storyboard workbench. Python 3.10+, no third-party dependencies."""
import base64,copy,hashlib,io,json,math,mimetypes,os,re,secrets,threading,time,uuid,webbrowser,zipfile
import sys
import task_backend as tasks
import studio_backend as studio
import reverse_backend as reverse
import planning_backend as planning
import asset_analysis
import prompt_review
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.request import Request,urlopen
from urllib.error import HTTPError
ROOT=Path(__file__).resolve().parent
DATA=ROOT/'data'; DATA.mkdir(exist_ok=True)
STATE=DATA/'project.json'; CONFIG=DATA/'settings.json'
TOKEN=secrets.token_urlsafe(32)
LOCK=threading.RLock()
COMPUTE_LOCK=threading.RLock()
def uid(): return uuid.uuid4().hex[:12]
def digest(t): return hashlib.sha256(t.encode()).hexdigest()
def parse_shots(prompt,duration):
    pattern=r'\[(\d+(?:\.\d+)?)\s*s?\s*[–—\-~到]\s*(\d+(?:\.\d+)?)\s*s?\]'
    matches=list(re.finditer(pattern,prompt)); shots=[]
    for i,m in enumerate(matches):
        end=matches[i+1].start() if i+1<len(matches) else len(prompt)
        body=prompt[m.end():end]
        if i+1==len(matches):
            stop=re.search(r'(?m)^\s*(?:editing|audio|cinematography|continuity_constraints|negative_constraints|FINAL VISUAL INTENT)\s*:',body)
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
        if key=='dialogueLanguage':value=value.split('。')[0].strip()
        result[key]=value
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
def load_project():
    with LOCK:
        if not STATE.exists(): return None
        p=json.loads(STATE.read_text('utf-8'))
        if not p.get('projectId'): p['projectId']=uid(); save(p)
        return p
def create_project():
    with LOCK:
        if STATE.exists():
            backup=DATA/'backups'; backup.mkdir(exist_ok=True)
            (backup/(time.strftime('%Y%m%d-%H%M%S')+'-'+uid()+'.json')).write_bytes(STATE.read_bytes())
        p=blank_project();save(p);return p
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
        segment['guideFromPrev']=record.get('guideFromPrev',segment['continuity'])
        if 'continuity' in record:segment['continuity']=record['continuity']
        if record.get('shotHistory'):segment['shotHistory']=record['shotHistory']
        for video in segment['videos']:
            path=video.get('path','')
            if path in files:media[path]=base64.b64encode(files[path]).decode()
    shared=json.loads(files.get('shared_params/shared_params.json',b'{}'))
    project={'overviewLayout':side.get('overviewLayout',{}),'storySeparated':side.get('storySeparated',False),'dialogueLanguage':side.get('dialogueLanguage',''),'intent':side.get('intent',{}),'groupAssetsCollapsed':side.get('groupAssetsCollapsed',{}),'nextPictureNumber':side.get('nextPictureNumber',1),'showDeletedAssets':side.get('showDeletedAssets',False),'assetsManaged':side.get('assetsManaged',False),'assetsCollapsed':side.get('assetsCollapsed',False),'version':1,'projectId':uid(),'title':side.get('title','导入的导演项目'),'script':side.get('script',''),'aspect':side.get('aspect',aspect_from_output(pack.get('output',{}))),'fps':timeline.get('frameRate',24),'segments':segs,'assets':side.get('assets') or [{**r,'id':uid(),'name':f'Picture {r.get("index",i)+1}','kind':'人物','path':r.get('imageFile',''),'locked':True} for i,r in enumerate(shared.get('refs',[]))],'media':media,'originalZip':base64.b64encode(blob).decode()}
    project['directorGuide']=guide_settings({'directorGuide':side.get('directorGuide',{})},pack.get('output',{}))
    if not side.get('assetsManaged'):
        for segment in segs:
            for ref in segment.get('refs',[]):
                path=ref.get('imageFile','')
                if (path or ref.get('imageB64')) and not any(a.get('path')==path and a.get('segmentId')==segment['id'] for a in project['assets']):
                    project['assets'].append({**ref,'id':uid(),'name':f'Picture {ref.get("index",len(project["assets"]))+1}','kind':'场景','path':path,'locked':False,'description':'','scope':'segment','segmentId':segment['id']})
    recover_pack_images(project,shared,timeline)
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
    if value is None: return ''
    if not isinstance(value,str) or len(value)>120 or re.search(r'[\x00-\x1f]',value): raise ValueError('对白语言必须是 120 字内的单行名称')
    return value.strip()

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
        silent=language=='无对白'
        for key,label in [('camera','Camera'),('expression','Expression'),('dialogue','Dialogue'),('sound','Sound')]:
            if key=='dialogue' and silent: continue
            if sh.get(key):
                if key=='dialogue':lines.extend(label+': '+line for line in sh[key].splitlines())
                else:lines.append(label+': '+bind_reference_roles(sh[key],s.get('assetReferences',[])))
        if silent: lines.append('Dialogue language: 无对白。No spoken dialogue or narration. Preserve environmental sound effects.')
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

def scoped_prompt(project, segment):
    if project.get('dialogueLanguage') or any(sh.get('dialogueLanguage') for sh in segment.get('shots',[])):
        segment={**segment,'prompt':rebuild({**segment,'defaultDialogueLanguage':project.get('dialogueLanguage','')})}
    if not project.get('assetsManaged'): return segment['prompt']
    assets=project.get('assets',[]);active=scoped_assets(project,segment)
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

def portable_pack_media(files, project):
    """Use paths recognized by H3's import prefix rewrite, keeping JSON mirrors in sync."""
    source={**files}
    for name,b64 in project.get('media',{}).items():
        if Path(name).is_absolute() or '..' in Path(name).parts: raise ValueError('素材路径无效')
        source[name]=base64.b64decode(b64)
    mapping={}
    if project.get('assetsManaged'):
        public=scoped_assets(project)
        entries=[(a,'shared_params',i) for i,a in enumerate(public)]
        for n,segment in enumerate(project['segments']):
            active=scoped_assets(project,segment)
            if len(active)>9: raise ValueError(f'{segment["title"]} 的公共 + 本组参考图片最多 9 张，请减少素材后导出')
            folder=str(Path(segment.get('groupPath',f'asset_groups/{n+1:02d}/group.json')).parent)
            entries.extend((a,folder,i) for i,a in enumerate(active) if a.get('scope')=='segment')
        for a,folder,i in entries:
            name=a['path'];ext=Path(name).suffix.lower()
            if ext=='.jpeg': ext='.jpg'
            if ext not in {'.png','.jpg','.webp','.bmp','.gif','.tif','.tiff'}: raise ValueError('不支持的参考图片格式：'+a.get('name',name))
            if name not in source: raise ValueError('缺少素材图片：'+a.get('name',name)+'。请替换该素材后重新导出')
            mapping.setdefault(name,f'{folder}/Picture{i+1}{ext}')
    for name in project.get('media',{}):
        if name not in mapping and (not name.startswith(H3_MEDIA_PREFIXES) or not re.fullmatch(r'[A-Za-z0-9_./]+',name)):
            ext=Path(name).suffix.lower()
            if ext=='.jpeg': ext='.jpg'
            mapping[name]='extra/media_'+hashlib.sha256(name.encode()).hexdigest()[:16]+ext
    for name,target in mapping.items(): files[target]=source[name]
    for name in project.get('media',{}):
        if name not in mapping: files[name]=source[name]
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
        refs=[{'index':i,'imageFile':a['path'],'fileName':Path(a['path']).name,'type':'input','subfolder':str(Path(a['path']).parent),'imageB64':''} for i,a in enumerate(p.get('assets',[])) if a.get('path')]
        shared={'commonEnabled':True,'prompt':'','refs':refs,'refAudios':[],'refVideos':[]}; files['shared_params/shared_params.json']=json.dumps(shared).encode(); tl['global'].update(shared); files['timeline.json']=json.dumps(tl,ensure_ascii=False,indent=2).encode()
    shared=json.loads(files['shared_params/shared_params.json'])
    existing=shared.get('refs',[])
    for asset in p.get('assets',[]):
        if asset.get('kind')=='人物' and asset.get('path') and not any(r.get('imageFile')==asset['path'] for r in existing):
            name=asset['path']; index=max([r.get('index',-1) for r in existing]+[-1])+1
            existing.append({'index':index,'imageFile':name,'fileName':Path(name).name,'type':'input','subfolder':str(Path(name).parent),'imageB64':''})
    if p.get('assetsManaged'):
        def ref(a,i): return {'index':i,'imageFile':a['path'],'fileName':Path(a['path']).name,'type':'input','subfolder':str(Path(a['path']).parent),'imageB64':''}
        public=scoped_assets(p)
        if len(public)>9: raise ValueError('H3 公共参考图片最多 9 张')
        existing=[ref(a,i) for i,a in enumerate(public)]
        shared['commonEnabled']=True
        tl.setdefault('global',{})['commonEnabled']=True
        if workspace is not None: workspace.setdefault('globalCommon',{})['commonEnabled']=True
        for n,s in enumerate(p['segments']):
            active=scoped_assets(p,s)
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
    side={k:p.get(k) for k in ['version','title','script','aspect','assets','assetsManaged','assetsCollapsed','nextPictureNumber','showDeletedAssets','groupAssetsCollapsed','intent','dialogueLanguage','storySeparated','directorGuide','overviewLayout']}
    side['directorGuide']=guide_settings(p,pack.get('output',{}))
    side['segments']=[{**{k:s[k] for k in ['id','title','shots','storyText','storyHistory','videos','planning','promptHistory','continuity','guideFromPrev','shotHistory'] if k in s},'workingPrompt':s['prompt'],'promptHash':digest(output[i]['prompt'])} for i,s in enumerate(p['segments'])]
    files['storyboard.json']=json.dumps(side,ensure_ascii=False,indent=2).encode()
    # Remove previously bundled manual clips; export only current segment records.
    for name in list(files):
        if name.startswith('extra/segment_videos/'):del files[name]
    active={v.get('path') for s in p['segments'] for v in s.get('videos',[])}
    p={**p,'media':{k:v for k,v in p.get('media',{}).items() if not k.startswith('extra/segment_videos/') or k in active}}
    for path in active:
        if not p['media'].get(path):raise ValueError('片段视频文件缺失：'+str(path))
    files.pop('extra/forced-export-report.json',None)
    files.pop('extra/forced_export_report.json',None)
    if force:
        report={'forced':True,'exportedAt':time.strftime('%Y-%m-%d %H:%M:%S'),'projectId':p['projectId'],'notice':'用户选择保留现有内容，跳过提示词冲突检查；结构和媒体检查仍执行。','segments':[{'id':seg['id'],'title':seg['title'],'issues':prompt_review.quality(sys.modules[__name__],p,seg)} for seg in p['segments']]}
        files['extra/forced_export_report.json']=json.dumps(report,ensure_ascii=False,indent=2).encode()
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
def save(p):
    temp=STATE.with_suffix('.tmp'); temp.write_text(json.dumps(p,ensure_ascii=False),'utf-8'); temp.replace(STATE)
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
        raw=json.dumps(data,ensure_ascii=False).encode() if mime=='application/json' else data
        self.send_response(code);
        if inline:self.send_header('Content-Disposition','inline')
        self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(raw)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(raw)
    def valid(self):
        host=self.headers.get('Host','').split(':')[0]
        return host in ['127.0.0.1','localhost'] and self.headers.get('X-Workbench-Token')==TOKEN
    def do_GET(self):
        try:
            route=self.path.split('?')[0]
            if route=='/api/bootstrap':
                if self.headers.get('Sec-Fetch-Site') not in [None,'same-origin','none']: raise ValueError('跨站请求已拒绝')
                return self.respond({'token':TOKEN,'version':json.loads((ROOT/'version.json').read_text('utf-8')).get('version','')})
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
            if route.startswith('/api/') and not self.valid(): return self.respond({'error':'请求验证失败'},403)
            if route=='/api/project': return self.respond(load_project())
            if route=='/api/settings': return self.respond(settings())
            if route=='/api/visual-references':
                import visual_library
                with LOCK:return self.respond(visual_library.read(DATA,public=True))
            if route=='/api/reverse-templates':return self.respond(reverse.templates(sys.modules[__name__]))
            if route=='/api/tasks':return self.respond(tasks.manager(sys.modules[__name__]).public())
            if route=='/api/export': return self.respond(export_pack(json.loads(STATE.read_text('utf-8'))),mime='application/zip')
            path=ROOT/'web'/('index.html' if route=='/' else route.lstrip('/'))
            if not path.resolve().is_relative_to((ROOT/'web').resolve()): return self.respond({'error':'无效路径'},403)
            return self.respond(path.read_bytes(),mime=mimetypes.guess_type(str(path))[0] or 'application/octet-stream')
        except Exception as e: self.respond({'error':str(e)},400)
    def do_POST(self):
        if not self.valid(): return self.respond({'error':'请求验证失败'},403)
        try:
            size=int(self.headers.get('Content-Length',0))
            if size>550*1024*1024: raise ValueError('文件超过上传上限')
            raw=self.rfile.read(size); route=self.path.split('?')[0]
            if route=='/api/import':
                p=readzip(raw)
                with LOCK: save(p)
                return self.respond(p)
            body=json.loads(raw or b'{}')
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
            if route=='/api/compiled-prompt':
                p=load_project()
                if not p or p.get('projectId')!=body.get('projectId'):raise ValueError('项目已切换，请刷新')
                segment=next((v for v in p['segments'] if v['id']==body.get('segmentId')),None)
                if segment is None:raise ValueError('片段不存在')
                return self.respond({'prompt':scoped_prompt(p,segment),'warnings':prompt_review.warnings(sys.modules[__name__],p,segment),'issues':prompt_review.quality(sys.modules[__name__],p,segment)})
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
            if route=='/api/new-project': return self.respond(create_project())
            if route=='/api/unload': return self.respond(unload_model(body))
            if route=='/api/unload-all': return self.respond(unload_all_models(sys.modules[__name__]))
            if route=='/api/analyze-assets':return self.respond(asset_analysis.enqueue(sys.modules[__name__],body))
            if route=='/api/apply-assets':return self.respond(asset_analysis.apply(sys.modules[__name__],body))
            if route=='/api/confirm-asset':return self.respond(asset_analysis.confirm(sys.modules[__name__],body))
            if route=='/api/edit-asset-analysis':return self.respond(asset_analysis.edit(sys.modules[__name__],body))
            if route=='/api/apply-planning':return self.respond(planning.apply(sys.modules[__name__],body))
            if route=='/api/planning-application-check':return self.respond(planning.application_check(sys.modules[__name__],body))
            if route=='/api/director-guide':
                p=load_project()
                if not p or p.get('projectId')!=body.get('projectId'):raise ValueError('项目已切换')
                return self.respond(guide_settings(p))
            if route=='/api/asset-analysis-status':
                p=load_project()
                if not p or p['projectId']!=body.get('projectId'):raise ValueError('项目已切换')
                return self.respond({'assets':[asset_analysis.status(a,p['media']) for a in p['assets'] if not a.get('deleted')]})
            if route=='/api/plan-shots': return self.respond(planning.enqueue(sys.modules[__name__],body))
            if route=='/api/settings-patch': return self.respond(save_settings(body,patch=True))
            if route=='/api/models': return self.respond({'models':list_models(body)})
            if route=='/api/project':
                with LOCK:
                    current=load_project()
                    if current and current.get('projectId')!=body.get('projectId'): return self.respond({'error':'当前项目已切换，请刷新页面，旧修改未覆盖新项目'},409)
                    # Background analysis drafts are server-owned: stale autosaves cannot erase them.
                    for a in body.get('assets',[]):
                        original=next((v for v in (current or {}).get('assets',[]) if v['id']==a['id']),None)
                        draft=original.get('analysisDraft') if original else None
                        if draft and draft.get('signature')==asset_analysis.signature(a,body.get('media',{})):a['analysisDraft']=copy.deepcopy(draft)
                        else:a.pop('analysisDraft',None)
                    save(body)
                return self.respond({'ok':True})
            if route=='/api/settings': return self.respond(save_settings(body))
            if route=='/api/rebuild': return self.respond({'prompt':rebuild(body)})
            if route=='/api/test':
                cfg=body; provider=cfg.get('provider')
                text=ai_call(cfg,[{'role':'user','content':'Reply with OK only.'}]); return self.respond({'message':'AI 连接成功：'+text[:120]})
            raise ValueError('未知操作')
        except Exception as e: self.respond({'error':str(e)},400)
if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8787);parser.add_argument('--no-browser',action='store_true');args=parser.parse_args()
    from update_workbench import retire_old_modules
    try:
        archived=retire_old_modules(ROOT)
        if archived:print('旧生成模块已归档：'+archived,flush=True)
    except Exception as e:print('旧模块清理未完成（项目数据保留）：'+str(e),flush=True)
    server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    print(f'分镜工作台: http://127.0.0.1:{args.port}  (Ctrl+C 关闭)',flush=True)
    if not args.no_browser: threading.Timer(.7,lambda:webbrowser.open(f'http://127.0.0.1:{args.port}')).start()
    server.serve_forever()
