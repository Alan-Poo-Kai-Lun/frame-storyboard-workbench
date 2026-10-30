"""Multiple local projects; current project is written once, archived only on switches."""
import copy,hashlib,json,re,time,math
from pathlib import Path
import project_media

def payload_has_media(p):
    """Accept inline media and the content-addressed mediaIndex form."""
    return isinstance(p,dict) and (isinstance(p.get('media'),dict) or isinstance(p.get('mediaIndex'),dict))
def read_project(path,data):
    import project_layout
    return project_layout.apply(project_media.attach(json.loads(Path(path).read_text('utf-8')),data),data)

def _write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_suffix('.tmp');temp.write_text(json.dumps(value,ensure_ascii=False),'utf-8');temp.replace(path)
def _key(value):
    if not isinstance(value,str) or not re.fullmatch('[A-Za-z0-9_-]{1,120}',value):raise ValueError('项目编号无效')
    return hashlib.sha256(value.encode()).hexdigest()
def _meta(p):
    if not isinstance(p,dict) or p.get('version')!=1 or not isinstance(p.get('title'),str) or not isinstance(p.get('segments'),list) or not isinstance(p.get('assets'),list) or not payload_has_media(p):raise ValueError('项目结构无效')
    for segment in p['segments']:
        if not isinstance(segment,dict) or not isinstance(segment.get('id'),str) or not isinstance(segment.get('title'),str) or not isinstance(segment.get('shots'),list):raise ValueError('片段结构无效')
        duration=segment.get('duration')
        if not isinstance(duration,(int,float)) or not math.isfinite(duration) or duration<=0:raise ValueError('片段时间无效')
        for shot in segment['shots']:
            if not isinstance(shot,dict) or not isinstance(shot.get('id'),str):raise ValueError('镜头结构无效')
            for field in ['start','end']:
                if not isinstance(shot.get(field),(int,float)) or not math.isfinite(shot[field]):raise ValueError('镜头时间无效')
    _key(p.get('projectId'));return {'id':p['projectId'],'title':str(p.get('title','未命名项目'))[:200],'segments':len(p.get('segments',[])),'shots':sum(len(s.get('shots',[])) for s in p.get('segments',[])),'assets':len(p.get('assets',[])),'updatedAt':time.strftime('%Y-%m-%d %H:%M:%S')}
def index(data,state):
    path=data/'projects-index.json'
    if path.exists():return json.loads(path.read_text('utf-8'))
    value={'version':1,'current':'','projects':[]}
    if state.exists():
        p=json.loads(state.read_text('utf-8'))
        if p.get('projectId'):value['current']=p['projectId'];value['projects']=[_meta(p)]
    _write(path,value);return value
def before_save(data,state,p):
    _key(p.get('projectId'));value=index(data,state);previous=value.get('current')
    if any(row['id']==p['projectId'] for row in value.get('trash',[])):raise ValueError('项目已删除，请从回收站恢复后再编辑')
    if previous and previous!=p['projectId'] and state.exists():
        folder=data/'projects';folder.mkdir(exist_ok=True);path=folder/(_key(previous)+'.json');temp=path.with_suffix('.tmp');temp.write_bytes(state.read_bytes());temp.replace(path)
def after_save(data,state,p):
    value=index(data,state)
    # A save that was already in flight when the user deleted this project must not
    # resurrect it: delete_projects moves the row to trash and clears current, so a
    # late after_save would otherwise push the row straight back into projects.
    if any(row['id']==p['projectId'] for row in value.get('trash',[])):return
    rows={r['id']:r for r in value['projects']};from project_hub import metadata
    rows[p['projectId']]={**_meta(p),**metadata(data,p)};value.update(current=p['projectId'],projects=list(rows.values()));_write(data/'projects-index.json',value)
def listing(data,state):
    value=index(data,state);rows=[];dirty=False
    for row in value['projects']:
        is_current=row['id']==value['current'];path=state if is_current else data/'projects'/(_key(row['id'])+'.json')
        if ('coverUrl' not in row or 'videos' not in row) and path.is_file():
            try:
                from project_hub import metadata
                enriched=metadata(data,read_project(path,data));enriched.pop('updatedMs',None);row.update(enriched);dirty=True
            except (ValueError,OSError):pass
        rows.append({**row,'current':is_current,'missing':not path.is_file()})
    if dirty:
        # Remember the derived fields: reading every media file on each home render
        # is what made the home screen slow for large projects.
        try:_write(data/'projects-index.json',value)
        except OSError:pass
    return sorted(rows,key=lambda r:r['updatedAt'],reverse=True)
def open_project(data,state,key,expected,save):
    value=index(data,state);_key(key)
    if value.get('current')!=expected:raise ValueError('当前项目已变化，请刷新后切换')
    if key==value.get('current'):return read_project(state,data)
    if not any(row['id']==key for row in value['projects']):raise ValueError('项目不存在')
    p=read_project(data/'projects'/(_key(key)+'.json'),data);_meta(p)
    if p.get('projectId')!=key or p.get('version')!=1 or not isinstance(p.get('segments'),list) or not isinstance(p.get('media'),dict):raise ValueError('项目文件损坏，请从备份恢复')
    save(p);return p
def recover(data,state):
    value=index(data,state);known={row['id'] for row in value['projects']+value.get('trash',[])};count=0;skipped=0
    for path in sorted((data/'backups').glob('*.json'),key=lambda p:p.stat().st_mtime,reverse=True)[:100]:
        try:
            if path.is_symlink():raise ValueError('Linked backup')
            p=json.loads(path.read_text('utf-8'));key=p.get('projectId');_key(key);_meta(p)
            if key in known:continue
            if p.get('version')!=1 or not isinstance(p.get('segments'),list) or not payload_has_media(p):raise ValueError('Invalid backup')
            folder=data/'projects';folder.mkdir(exist_ok=True);target=folder/(_key(key)+'.json');temp=target.with_suffix('.tmp');temp.write_bytes(path.read_bytes());temp.replace(target);row=_meta(p);row['updatedAt']=time.strftime('%Y-%m-%d %H:%M:%S',time.localtime(path.stat().st_mtime));value['projects'].append(row);known.add(key);count+=1
        except (ValueError,TypeError,OSError,KeyError):skipped+=1
    _write(data/'projects-index.json',value);return {'recovered':count,'skipped':skipped,'projects':listing(data,state)}

def trash_listing(data,state):
    return sorted(index(data,state).get('trash',[]),key=lambda row:row['deletedAt'],reverse=True)

def delete_projects(data,state,keys,expected,all_projects=False):
    value=index(data,state)
    if value.get('current')!=expected:raise ValueError('当前项目已变化，请刷新后删除')
    if not isinstance(keys,list) or not keys:raise ValueError('请选择要删除的项目')
    for key in keys:_key(key)
    if len(keys)!=len(set(keys)):raise ValueError('项目编号重复')
    known={row['id'] for row in value['projects']}
    if not set(keys)<=known:raise ValueError('项目列表已变化，请刷新后删除')
    if not isinstance(all_projects,bool) or all_projects and set(keys)!=known:raise ValueError('项目列表已变化，请重新核对清空范围')
    current_deleted=value.get('current') in keys
    if current_deleted and state.exists():
        target=data/'projects'/(_key(value['current'])+'.json');target.parent.mkdir(parents=True,exist_ok=True)
        temp=target.with_suffix('.tmp');temp.write_bytes(state.read_bytes());temp.replace(target)
    updated=copy.deepcopy(value);updated.setdefault('trash',[])
    updated['trash'].extend({**row,'deletedAt':time.strftime('%Y-%m-%d %H:%M:%S')} for row in value['projects'] if row['id'] in keys)
    updated['projects']=[row for row in value['projects'] if row['id'] not in keys]
    if current_deleted:updated['current']=''
    _write(data/'projects-index.json',updated)
    try:
        if current_deleted:state.unlink(missing_ok=True)
    except OSError:
        _write(data/'projects-index.json',value);raise
    return {'deleted':len(keys),'currentDeleted':current_deleted,'projects':listing(data,state)}

def restore_project(data,state,key,expected):
    value=index(data,state);_key(key)
    if value.get('current')!=expected:raise ValueError('当前项目已变化，请刷新后恢复')
    row=next((r for r in value.get('trash',[]) if r['id']==key),None)
    if not row:raise ValueError('项目不在回收站')
    path=data/'projects'/(_key(key)+'.json')
    if not path.is_file() or path.is_symlink():raise ValueError('原项目文件缺失，请从项目备份恢复')
    p=json.loads(path.read_text('utf-8'));meta=_meta(p)
    if meta['id']!=key:raise ValueError('项目文件编号不匹配')
    value['projects'].append(meta);value['trash']=[r for r in value['trash'] if r['id']!=key]
    _write(data/'projects-index.json',value);return {'restored':key,'projects':listing(data,state)}
