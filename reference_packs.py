"""Portable reference libraries. Preview is read-only; commit is atomic and backed up."""
import base64,hashlib,io,json,re,time,uuid,zipfile
import visual_library as library
EXT={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm'}
def revision(data):
    return hashlib.sha256(json.dumps(library._records(data),sort_keys=True,ensure_ascii=False).encode()).hexdigest()
def export(data):
    rows=library._records(data);manifest={'format':'frame-visual-references','version':1,'entries':[]};media={}
    for row in rows:
        item={k:row[k] for k in ['id','category','title','note','builtin','hidden'] if k in row}
        if row.get('mediaFile'):
            path=data/'reference-media'/row['mediaFile']
            if not path.is_file():raise ValueError('参考媒体缺失：'+row['title']+'，请替换或恢复后导出')
            raw=path.read_bytes();name='media/'+hashlib.sha256(raw).hexdigest()+'.'+EXT[row['mime']]
            media[name]=raw;item.update(media=name,mime=row['mime'])
        manifest['entries'].append(item)
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w',zipfile.ZIP_STORED) as archive:
        archive.writestr('manifest.json',json.dumps(manifest,ensure_ascii=False));
        for name,raw in media.items():archive.writestr(name,raw)
    return out.getvalue()
def parse(blob):
    with zipfile.ZipFile(io.BytesIO(blob)) as archive:
        files=archive.infolist();names=[f.filename for f in files]
        if len(files)>1000 or len(names)!=len(set(names)) or 'manifest.json' not in names:raise ValueError('整合包目录无效或重复')
        for f in files:
            if (f.external_attr>>16)&0o170000==0o120000 or f.flag_bits&1:raise ValueError('不支持链接或加密文件')
            if f.filename!='manifest.json' and not re.fullmatch(r'media/[a-f0-9]{64}\.(png|jpg|webp|gif|mp4|webm)',f.filename):raise ValueError('整合包含非法路径')
        if archive.getinfo('manifest.json').file_size>2*1024*1024:raise ValueError('清单过大')
        manifest=json.loads(archive.read('manifest.json'))
        if not isinstance(manifest,dict) or manifest.get('format')!='frame-visual-references' or manifest.get('version')!=1:raise ValueError('不是 FRAME 视觉参考整合包')
        entries=manifest.get('entries');ids=set();rows=[];media={}
        if not isinstance(entries,list) or len(entries)>350:raise ValueError('参考条目数量无效')
        for entry in entries:
            if not isinstance(entry,dict):raise ValueError('条目无效')
            item={k:entry[k] for k in ['id','category','title','note','builtin','hidden'] if k in entry};key=item.get('id');category=item.get('category')
            if not isinstance(key,str) or not re.fullmatch(r'[A-Za-z0-9_:-]{1,120}',key) or key in ids or category not in library.CATEGORIES:raise ValueError('参考编号 / 分类无效或重复')
            ids.add(key)
            if item.get('builtin'):
                match=re.fullmatch(r'builtin:([a-z]+):(\d+)',item['builtin'])
                if not match or match[1]!=category or int(match[2])>=library.COUNTS[category] or key!=item['builtin']:raise ValueError('内置参考编号无效')
            elif key.startswith('builtin:'):raise ValueError('内置条目标记缺失')
            for field,limit in [('title',80),('note',3000)]:
                if not isinstance(item.get(field),str) or not item[field].strip() or len(item[field])>limit:raise ValueError('参考名称 / 说明无效')
                item[field]=item[field].strip()
            if 'hidden' in item:item['hidden']=item['hidden'] is True
            name=entry.get('media');mime=entry.get('mime')
            if name:
                if mime not in EXT or not re.fullmatch(r'media/[a-f0-9]{64}\.'+EXT[mime],str(name)) or name not in names:raise ValueError('参考媒体路径 / 格式无效')
                if name not in media:
                    raw=archive.read(name)
                    if hashlib.sha256(raw).hexdigest()!=name.split('/')[1].split('.')[0]:raise ValueError('参考媒体校验失败')
                    library.media_type('data:'+mime+';base64,'+base64.b64encode(raw).decode());media[name]=raw
                item.update(mime=mime,mediaFile=name.split('/')[1].split('.')[0]+'.bin')
            elif mime:raise ValueError('媒体文件缺失')
            rows.append(item)
        if set(names)!={'manifest.json',*media}:raise ValueError('整合包含未引用的文件')
        if sum(not r.get('builtin') for r in rows)>200:raise ValueError('自定义参考最多 200 条')
        return rows,media

def preview(data,blob):
    rows,media=parse(blob);current={r['id']:r for r in library._records(data)};folder=data/'reference-imports';folder.mkdir(parents=True,exist_ok=True)
    for path in folder.glob('*.zip'):
        if time.time()-path.stat().st_mtime>3600:path.unlink()
    if len(list(folder.glob('*.zip')))>=3:raise ValueError('已有三个待导入包，请完成或取消后再导入')
    token=uuid.uuid4().hex;(folder/(token+'.zip')).write_bytes(blob)
    return {'token':token,'revision':revision(data),'count':len(rows),'conflicts':sum(r['id'] in current for r in rows),'bytes':sum(map(len,media.values())),'entries':[{'title':r['title'],'category':r['category'],'conflict':r['id'] in current,'media':bool(r.get('mediaFile'))} for r in rows]}
def cancel(data,token):
    if not isinstance(token,str) or not re.fullmatch('[a-f0-9]{32}',token):raise ValueError('导入预览无效')
    (data/'reference-imports'/(token+'.zip')).unlink(missing_ok=True)
def apply(data,body):
    token=body.get('token');mode=body.get('mode')
    if not isinstance(token,str) or not re.fullmatch('[a-f0-9]{32}',token) or mode not in ['keep','replace']:raise ValueError('导入选项无效')
    path=data/'reference-imports'/(token+'.zip')
    if not path.is_file():raise ValueError('导入预览已过期，请重新选择整合包')
    if body.get('revision')!=revision(data):raise ValueError('参考库在预览后已修改，请重新预览，避免覆盖新内容')
    incoming,media=parse(path.read_bytes());current=library._records(data);existing={r['id']:r for r in current};skipped=0
    for row in incoming:
        if row['id'] in existing and mode=='keep':skipped+=1;continue
        existing[row['id']]=row
    result=list(existing.values())
    if sum(not r.get('builtin') for r in result)>200:raise ValueError('合并后自定义参考超过 200 条')
    raw_by_hash={name.split('/')[1].split('.')[0]+'.bin':raw for name,raw in media.items()};used={r.get('mediaFile') for r in result if r.get('mediaFile')}
    # Backup includes original media so future cleanup cannot invalidate it.
    backup=data/'reference-pack-backups';backup.mkdir(parents=True,exist_ok=True);backup_name=time.strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:8]+'.frame-refs.zip';(backup/backup_name).write_bytes(export(data))
    folder=data/'reference-media';folder.mkdir(exist_ok=True)
    for name in used:
        if name in raw_by_hash and not (folder/name).exists():(folder/name).write_bytes(raw_by_hash[name])
    library._write(data,result);cancel(data,token)
    return {'rows':library.read(data,public=True),'imported':len(incoming)-skipped,'skipped':skipped,'backup':backup_name}
