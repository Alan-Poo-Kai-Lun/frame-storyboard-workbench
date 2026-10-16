"""User asset library and reusable layout options, separate from project media."""
import base64,copy,hashlib,json,re,math,time,uuid

LAYOUT_DEFAULT={'mode':'cards','assetPosition':'top','shotColumns':3,'segmentColumns':2,'gap':28,'shotWidth':230,'shotHeight':220,'assetWidth':190,'assetHeight':180,'rolePositions':{},'roleSizes':{}}
BUILTINS=[{'id':'cards-top','name':'卡片 · 素材在上','options':LAYOUT_DEFAULT},
          {'id':'cards-left','name':'卡片 · 侧边素材','options':{**LAYOUT_DEFAULT,'assetPosition':'left','segmentColumns':1}},
          {'id':'free','name':'自由画布','options':{**LAYOUT_DEFAULT,'mode':'free'}}]

def _read(data,name,default):
    path=data/name
    return json.loads(path.read_text('utf-8')) if path.exists() else copy.deepcopy(default)

def _write(data,name,value):
    data.mkdir(parents=True,exist_ok=True);path=data/name;temp=path.with_suffix('.tmp')
    temp.write_text(json.dumps(value,ensure_ascii=False),'utf-8');temp.replace(path)

def _text(value,label,limit,required=True):
    if not isinstance(value,str) or len(value)>limit or required and not value.strip():raise ValueError(label+'不能为空或过长')
    return value.strip()

def layout_options(value):
    if not isinstance(value,dict):raise ValueError('布局选项无效')
    result={**LAYOUT_DEFAULT,**{k:v for k,v in value.items() if k in LAYOUT_DEFAULT}}
    if result['mode'] not in ['cards','free'] or result['assetPosition'] not in ['top','left']:raise ValueError('布局模式无效')
    for k,lo,hi in [('shotColumns',1,8),('segmentColumns',1,4),('gap',12,100),('shotWidth',160,500),('shotHeight',120,500),('assetWidth',120,400),('assetHeight',100,400)]:
        v=result[k]
        if isinstance(v,bool) or not isinstance(v,int) or not lo<=v<=hi:raise ValueError(k+'超出范围')
    for key,fields in [('rolePositions',['x','y']),('roleSizes',['w','h'])]:
        mapping=result[key]
        if not isinstance(mapping,dict) or len(mapping)>500:raise ValueError('布局位置选项无效')
        for role,point in mapping.items():
            if not re.fullmatch(r'(?:asset|shot):\d{1,3}|segment|prompt|output',role) or not isinstance(point,dict):raise ValueError('布局位置编号无效')
            for field in fields:
                v=point.get(field)
                if isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or not (0 if key=='rolePositions' else 80)<=v<=5000:raise ValueError('布局位置或尺寸无效')
    return result

def presets(data):
    store=_read(data,'canvas-presets.json',{'revision':'0','items':[],'defaultId':'cards-top'})
    return {**store,'items':[copy.deepcopy({**row,'builtin':True}) for row in BUILTINS]+store['items']}

def update_preset(data,body):
    if body.get('action')=='validate':return {'options':layout_options(body.get('options'))}
    current=presets(data)
    if body.get('revision')!=current['revision']:raise ValueError('布局方案已在其他窗口修改，请重新打开')
    store={**current,'items':[r for r in current['items'] if not r.get('builtin')]};key=body.get('id');action=body.get('action','save')
    if action=='save':
        if key and not any(r['id']==key for r in store['items']):raise ValueError('内置方案请另存为新方案')
        row={'id':key or uuid.uuid4().hex,'name':_text(body.get('name'),'方案名称',80),'options':layout_options(body.get('options'))}
        store['items']=[r for r in store['items'] if r['id']!=row['id']]+[row];key=row['id']
    elif action=='delete':
        if not any(r['id']==key for r in store['items']):raise ValueError('只能删除自定义方案')
        store['items']=[r for r in store['items'] if r['id']!=key]
        if store['defaultId']==key:store['defaultId']='cards-top'
    elif action=='default':
        if not any(r['id']==key for r in current['items']):raise ValueError('方案不存在')
        store['defaultId']=key
    else:raise ValueError('未知方案操作')
    store['revision']=uuid.uuid4().hex;_write(data,'canvas-presets.json',store)
    return {**presets(data),'savedId':key}

def default_layout(data):
    store=presets(data);row=next((r for r in store['items'] if r['id']==store['defaultId']),store['items'][0])
    return {'mode':row['options']['mode'],'cardOptions':copy.deepcopy(row['options']),'presetName':row['name'],'positions':{}}

def _store(data):return _read(data,'asset-library.json',{'revision':'0','categories':['人物','场景','道具','声音','视频','未分类'],'items':[]})

def library(data):
    store=_store(data);rows=[]
    for row in store['items']:
        item={**row};name=item.pop('mediaFile','')
        item['url']='/asset-library-media/'+name if name else ''
        item['mediaMissing']=bool(name and not (data/'asset-library-media'/name).is_file());rows.append(item)
    return {**store,'items':rows}

MIMES={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm','audio/mpeg':'mp3','audio/mp3':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/ogg':'ogg','audio/flac':'flac','audio/mp4':'m4a'}

def _media(data,value):
    if not isinstance(value,str):raise ValueError('素材媒体格式无效')
    match=re.fullmatch(r'data:([^;,]+);base64,([A-Za-z0-9+/=]+)',value)
    if not match or match[1] not in MIMES:raise ValueError('支持 PNG / JPG / WebP / GIF、MP4 / WebM 和常用音频格式')
    mime=match[1];raw=base64.b64decode(match[2],validate=True)
    valid={'png':raw.startswith(b'\x89PNG\r\n\x1a\n'),'jpg':raw.startswith(b'\xff\xd8\xff'),'webp':raw[:4]==b'RIFF' and raw[8:12]==b'WEBP','gif':raw[:6] in [b'GIF87a',b'GIF89a'],'mp4':raw[4:8]==b'ftyp','webm':raw[:4]==b'\x1a\x45\xdf\xa3','mp3':raw[:3]==b'ID3' or len(raw)>1 and raw[0]==255 and raw[1]&224==224,'wav':raw[:4]==b'RIFF' and raw[8:12]==b'WAVE','ogg':raw[:4]==b'OggS','flac':raw[:4]==b'fLaC','m4a':raw[4:8]==b'ftyp'}
    ext=MIMES[mime]
    if not valid[ext]:raise ValueError('素材内容与文件类型不符')
    name=hashlib.sha256(raw).hexdigest()+'.'+ext;folder=data/'asset-library-media';folder.mkdir(parents=True,exist_ok=True)
    path=folder/name
    if not path.exists():path.write_bytes(raw)
    return {'mediaFile':name,'mime':mime,'mediaType':mime.split('/')[0]}

def update_asset(data,body):
    store=_store(data)
    if body.get('revision')!=store['revision']:raise ValueError('素材库已在其他窗口修改，请刷新后重试')
    key=body.get('id');old=next((r for r in store['items'] if r['id']==key),None);action=body.get('action','save')
    if action=='category':
        name=_text(body.get('name'),'分类名称',60);replacement=_text(body.get('newName',name),'分类名称',60)
        if body.get('remove'):replacement='未分类'
        store['categories']=[r for r in store['categories'] if r!=name]
        if replacement not in store['categories']:store['categories'].append(replacement)
        for row in store['items']:
            if row['category']==name:row['category']=replacement
            if row.get('kind')==name:row['kind']=replacement
    elif action in ['delete','restore','favorite']:
        if not old:raise ValueError('素材已不存在')
        if action=='favorite':old['favorite']=not old.get('favorite',False)
        else:old['deleted']=action=='delete'
    elif action=='save':
        if key and not old:raise ValueError('素材已不存在')
        row={**(old or {}),'id':key or uuid.uuid4().hex,'title':_text(body.get('title'),'素材名称',100),'note':_text(body.get('note',''),'素材说明',10000,False),'category':_text(body.get('category','未分类'),'分类',60),'kind':body.get('kind','人物'),'updatedAt':time.strftime('%Y-%m-%d %H:%M:%S')}
        row['kind']=_text(row['kind'],'素材分类',60)
        if body.get('media'):row.update(_media(data,body['media']))
        if body.get('removeMedia'):
            for field in ['mediaFile','mime','mediaType']:row.pop(field,None)
        if not row.get('mediaFile') and not row['note']:raise ValueError('请添加素材文件或填写内容说明')
        if row['category'] not in store['categories']:store['categories'].append(row['category'])
        store['items']=[r for r in store['items'] if r['id']!=row['id']]+[row]
    else:raise ValueError('未知素材操作')
    store['revision']=uuid.uuid4().hex;_write(data,'asset-library.json',store);return library(data)

def media_file(data,name):
    if not re.fullmatch(r'[a-f0-9]{64}\.(png|jpg|webp|gif|mp4|webm|mp3|wav|ogg|flac|m4a)',name):raise ValueError('素材媒体地址无效')
    row=next((r for r in _store(data)['items'] if r.get('mediaFile')==name),None)
    if not row:raise ValueError('素材媒体不存在')
    path=data/'asset-library-media'/name
    if path.is_symlink():raise ValueError('素材媒体路径无效')
    return path.read_bytes(),row['mime']

def apply_asset(s,body):
    p=s.load_project()
    if not p or p['projectId']!=body.get('projectId'):raise ValueError('项目已切换，素材未加入')
    row=next((r for r in _store(s.DATA)['items'] if r['id']==body.get('id') and not r.get('deleted')),None)
    if not row or not row.get('mediaFile'):raise ValueError('请先为该素材添加媒体文件')
    scope=body.get('scope','public');sid=body.get('segmentId','')
    if scope not in ['public','segment'] or scope=='segment' and not any(v['id']==sid for v in p['segments']):raise ValueError('素材归属无效')
    raw,mime=media_file(s.DATA,row['mediaFile']);ident=s.uid();path='extra/library_assets/'+ident+'.'+row['mediaFile'].split('.')[-1]
    number=max([int(a.get('pictureNumber',0)) for a in p['assets']]+[int(p.get('nextPictureNumber',1))-1])+1
    asset={'id':ident,'name':row['title'],'description':row['note'],'kind':row.get('category',row['kind']),'mediaType':row['mediaType'],'path':path,'scope':scope,'segmentId':sid if scope=='segment' else '','pictureNumber':number,'librarySourceId':row['id']}
    p['media'][path]=base64.b64encode(raw).decode();p['assets'].append(asset);p['nextPictureNumber']=number+1;p['assetsManaged']=True;s.save(p)
    return {'project':p,'assetId':ident}
