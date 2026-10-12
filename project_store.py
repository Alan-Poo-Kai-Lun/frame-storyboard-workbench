"""Multiple local projects; current project is written once, archived only on switches."""
import hashlib,json,re,time,math

def _write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_suffix('.tmp');temp.write_text(json.dumps(value,ensure_ascii=False),'utf-8');temp.replace(path)
def _key(value):
    if not isinstance(value,str) or not re.fullmatch('[A-Za-z0-9_-]{1,120}',value):raise ValueError('项目编号无效')
    return hashlib.sha256(value.encode()).hexdigest()
def _meta(p):
    if not isinstance(p,dict) or p.get('version')!=1 or not isinstance(p.get('title'),str) or not isinstance(p.get('segments'),list) or not isinstance(p.get('assets'),list) or not isinstance(p.get('media'),dict):raise ValueError('项目结构无效')
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
    if previous and previous!=p['projectId'] and state.exists():
        folder=data/'projects';folder.mkdir(exist_ok=True);path=folder/(_key(previous)+'.json');temp=path.with_suffix('.tmp');temp.write_bytes(state.read_bytes());temp.replace(path)
def after_save(data,state,p):
    value=index(data,state);rows={r['id']:r for r in value['projects']};rows[p['projectId']]=_meta(p);value.update(current=p['projectId'],projects=list(rows.values()));_write(data/'projects-index.json',value)
def listing(data,state):
    value=index(data,state);rows=[]
    for row in value['projects']:
        is_current=row['id']==value['current'];path=state if is_current else data/'projects'/(_key(row['id'])+'.json')
        rows.append({**row,'current':is_current,'missing':not path.is_file()})
    return sorted(rows,key=lambda r:r['updatedAt'],reverse=True)
def open_project(data,state,key,expected,save):
    value=index(data,state);_key(key)
    if value.get('current')!=expected:raise ValueError('当前项目已变化，请刷新后切换')
    if key==value.get('current'):return json.loads(state.read_text('utf-8'))
    if not any(row['id']==key for row in value['projects']):raise ValueError('项目不存在')
    p=json.loads((data/'projects'/(_key(key)+'.json')).read_text('utf-8'));_meta(p)
    if p.get('projectId')!=key or p.get('version')!=1 or not isinstance(p.get('segments'),list) or not isinstance(p.get('media'),dict):raise ValueError('项目文件损坏，请从备份恢复')
    save(p);return p
def recover(data,state):
    value=index(data,state);known={row['id'] for row in value['projects']};count=0;skipped=0
    for path in sorted((data/'backups').glob('*.json'),key=lambda p:p.stat().st_mtime,reverse=True)[:100]:
        try:
            if path.is_symlink():raise ValueError('Linked backup')
            p=json.loads(path.read_text('utf-8'));key=p.get('projectId');_key(key);_meta(p)
            if key in known:continue
            if p.get('version')!=1 or not isinstance(p.get('segments'),list) or not isinstance(p.get('media'),dict):raise ValueError('Invalid backup')
            folder=data/'projects';folder.mkdir(exist_ok=True);target=folder/(_key(key)+'.json');temp=target.with_suffix('.tmp');temp.write_bytes(path.read_bytes());temp.replace(target);row=_meta(p);row['updatedAt']=time.strftime('%Y-%m-%d %H:%M:%S',time.localtime(path.stat().st_mtime));value['projects'].append(row);known.add(key);count+=1
        except (ValueError,TypeError,OSError,KeyError):skipped+=1
    _write(data/'projects-index.json',value);return {'recovered':count,'skipped':skipped,'projects':listing(data,state)}
