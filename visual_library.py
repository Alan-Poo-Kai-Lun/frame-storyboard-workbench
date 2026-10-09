"""Persistent visual reference overrides and user references, including GIF/video."""
import base64,json,re,uuid,hashlib
COUNTS={'size':8,'angle':9,'composition':8,'lighting':12,'palette':8,'movement':12,'lens':6,'depth':2,'action':20,'expression':13,'environment':7,'style':5,'aspect':4,'motion':3}
CATEGORIES=set(COUNTS)
def _write(data,records):
    data.mkdir(parents=True,exist_ok=True)
    path=data/'visual-references.json';temp=path.with_suffix('.tmp')
    temp.write_text(json.dumps(records,ensure_ascii=False),'utf-8');temp.replace(path)
def _store_media(data,item,value):
    mime=media_type(value)
    item['mime']=mime;item.pop('image',None);item.pop('mediaFile',None)
    if value:
        raw=base64.b64decode(value.split(',',1)[1],validate=True)
        folder=data/'reference-media';folder.mkdir(parents=True,exist_ok=True)
        name=hashlib.sha256(raw).hexdigest()+'.bin'
        path=folder/name
        if not path.exists():path.write_bytes(raw)
        item['mediaFile']=name
def _records(data):
    path=data/'visual-references.json'
    rows=json.loads(path.read_text('utf-8')) if path.exists() else []
    migrated=False
    for row in rows:
        if 'image' in row:
            _store_media(data,row,row.get('image',''));migrated=True
    if migrated:
        backup=data/'visual-references-before-media-migration.json'
        if not backup.exists():backup.write_bytes(path.read_bytes())
        _write(data,rows)
    return rows
def read(data,public=False):
    rows=_records(data)
    for row in rows:
        name=row.get('mediaFile')
        if public and name:row['mediaMissing']=not (data/'reference-media'/name).is_file()
        row['image']=('/reference-media/'+name.rsplit('.',1)[0]+{'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','image/gif':'.gif','video/mp4':'.mp4','video/webm':'.webm'}.get(row.get('mime'),'.bin') if public else 'data:'+row['mime']+';base64,'+base64.b64encode((data/'reference-media'/name).read_bytes()).decode()) if name else ''
        row.pop('mediaFile',None)
    return rows
def media_type(value):
    if not isinstance(value,str):raise ValueError('参考媒体格式无效')
    if not value:return ''
    match=re.fullmatch(r'data:(image/(?:png|jpeg|webp|gif)|video/(?:mp4|webm));base64,([A-Za-z0-9+/=]+)',value)
    if not match:raise ValueError('支持 PNG / JPG / WebP / GIF / MP4 / WebM')
    mime=match[1];limit=20 if mime.startswith('video/') else 10 if mime=='image/gif' else 5
    if len(match[2])>limit*1024*1024*4//3+8:raise ValueError('参考媒体超过上限：'+str(limit)+'MB')
    raw=base64.b64decode(match[2],validate=True)
    if len(raw)>limit*1024*1024:raise ValueError('参考媒体超过上限：'+str(limit)+'MB')
    signatures={'image/png':raw.startswith(b'\x89PNG\r\n\x1a\n'),'image/jpeg':raw.startswith(b'\xff\xd8\xff'),'image/webp':raw.startswith(b'RIFF') and raw[8:12]==b'WEBP','image/gif':raw[:6] in (b'GIF87a',b'GIF89a'),'video/mp4':len(raw)>=12 and raw[4:8]==b'ftyp','video/webm':raw.startswith(b'\x1a\x45\xdf\xa3')}
    if not signatures[mime]:raise ValueError('参考媒体内容与格式不符')
    return mime
def update(data,body,public=False):
    records=_records(data);key=body.get('id');builtin=body.get('builtin','')
    if body.get('action')=='delete':
        records=[row for row in records if row['id']!=key]
    else:
        item={field:body.get(field,'') for field in ['category','title','note','image']}
        category=item['category']
        if category not in CATEGORIES:raise ValueError('未知参考分类')
        if builtin:
            match=re.fullmatch(r'builtin:([a-z]+):(\d+)',builtin)
            if not match or match[1]!=category or int(match[2])>=COUNTS[category]:raise ValueError('内置参考编号无效')
            if key and key!=builtin:raise ValueError('内置参考编号不一致')
            key=builtin;item['builtin']=builtin;item['hidden']=body.get('hidden') is True
        elif key and any(row.get('builtin') for row in records if row['id']==key):raise ValueError('不能改变内置参考编号')
        for field,limit in [('title',80),('note',3000)]:
            if not isinstance(item[field],str) or not item[field].strip() or len(item[field])>limit:raise ValueError('参考名称 / 描述不能为空或过长')
            item[field]=item[field].strip()
        previous=next((r for r in records if r['id']==key),{})
        if body.get('keepMedia') is True:
            item.pop('image',None)
            for field in ['mime','mediaFile']:
                if field in previous:item[field]=previous[field]
        else:_store_media(data,item,item['image'])
        if key and not builtin and not any(row['id']==key for row in records):raise ValueError('参考已删除，请重新打开')
        item['id']=key or uuid.uuid4().hex
        found=any(row['id']==key for row in records)
        records=[item if row['id']==key else row for row in records] if found else records+[item]
        if sum(not row.get('builtin') for row in records)>200:raise ValueError('自定义参考最多 200 条')
        if sum((data/'reference-media'/r['mediaFile']).stat().st_size for r in records if r.get('mediaFile'))>100*1024*1024:raise ValueError('参考媒体总上限约 100MB，请删除不需要的媒体后添加')
    _write(data,records)
    folder=data/'reference-media'
    used={row.get('mediaFile') for row in records}
    if folder.exists():
        for path in folder.glob('*.bin'):
            if path.name not in used:path.unlink()
    return read(data,public=public)
