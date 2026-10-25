"""Home metadata and project actions, without switching the active project."""
import base64,copy,hashlib,io,json,re,time,uuid
import project_store as store

def thumbnail(data,p):
    paths=[h.get(k) for s in p.get('segments',[]) for h in s.get('shots',[]) for k in ['image','firstFrame','lastFrame']]
    paths += [a.get('path') for a in p.get('assets',[]) if not a.get('deleted')]
    for path in paths:
        content=p.get('media',{}).get(path)
        if not content or not str(path).lower().endswith(('.png','.jpg','.jpeg','.webp','.gif')):continue
        name=hashlib.sha256(('cover-v2:'+content).encode()).hexdigest()+'.jpg';target=data/'project-thumbnails'/name
        if not target.exists():
            try:
                from PIL import Image,ImageOps
                raw=base64.b64decode(content,validate=True)
                with Image.open(io.BytesIO(raw)) as image:
                    image=ImageOps.exif_transpose(image)
                    canvas=ImageOps.fit(image.convert('RGB'),(480,270),method=Image.Resampling.LANCZOS,centering=(.5,.5))
                    target.parent.mkdir(parents=True,exist_ok=True);temp=target.with_suffix('.tmp');canvas.save(temp,format='JPEG',quality=78);temp.replace(target)
            except Exception:continue
        return '/project-thumbnail/'+name
    return ''

def metadata(data,p):
    return {'videos':sum(1 for s in p.get('segments',[]) for v in s.get('videos',[]) if isinstance(v,dict) and v.get('path') in p.get('media',{})), 'duration':sum(s.get('duration',0) for s in p.get('segments',[])), 'coverUrl':thumbnail(data,p),'updatedMs':int(time.time()*1000),'starterExample':bool(p.get('starterExample'))}

def read(data,state,key):
    index=store.index(data,state);store._key(key)
    if not any(r['id']==key for r in index['projects']):raise ValueError('项目不存在')
    path=state if index.get('current')==key else data/'projects'/(store._key(key)+'.json')
    if path.is_symlink():raise ValueError('项目路径无效')
    p=store.read_project(path,data);store._meta(p)
    if p['projectId']!=key:raise ValueError('项目编号不一致')
    return p

def action(s,body):
    p=read(s.DATA,s.STATE,body.get('projectId'));kind=body.get('action')
    if kind=='rename':
        title=body.get('title')
        if not isinstance(title,str) or not title.strip() or len(title)>200:raise ValueError('请输入有效项目名称')
        p['title']=title.strip()
    elif kind=='duplicate':
        p=copy.deepcopy(p);p['projectId']=uuid.uuid4().hex;p['title']+=' · 副本';p.pop('starterExample',None)
    else:raise ValueError('未知项目操作')
    index=store.index(s.DATA,s.STATE)
    if kind=='rename' and index.get('current')==p['projectId']:s.save(p)
    else:
        import project_media
        path=s.DATA/'projects'/(store._key(p['projectId'])+'.json');store._write(path,project_media.detach(p,s.DATA))
        row={**store._meta(p),**metadata(s.DATA,p)};index['projects']=[r for r in index['projects'] if r['id']!=p['projectId']]+[row];store._write(s.DATA/'projects-index.json',index)
    return {'id':p['projectId'],'projects':store.listing(s.DATA,s.STATE),'project':p if index.get('current')==p['projectId'] else None}


def rename_category(s,name,replacement):
    index=store.index(s.DATA,s.STATE)
    for row in index['projects']:
        try:p=read(s.DATA,s.STATE,row['id'])
        except (OSError,ValueError):continue
        changed=False
        for asset in p['assets']:
            if asset.get('kind')==name:asset['kind']=replacement;asset.pop('confirmation',None);changed=True
        if not changed:continue
        if row['id']==index.get('current'):s.save(p)
        else:store._write(s.DATA/'projects'/(store._key(row['id'])+'.json'),p)
