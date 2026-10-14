"""On-demand prompt translation. Structural tokens and spoken dialogue never reach the model."""
import copy,json,re,time
PROTECTED=re.compile(r'<d>[\s\S]*?</d>|</?[^>\n]+>|@?\b(?:Picture|Subject|Audio|Video)\s*\d+\b|\[[^\]\n]*\]|\b\d+(?:\.\d+)?\b',re.I)
HEAD=re.compile(r'^\s*(?:[a-z_]+|Camera|Expression|Dialogue|Sound|Spatial start|Spatial end|Dialogue language|Professional):\s*$',re.I)

def parts(text):
    chunks=[];jobs=[]
    # Preserve multiline spoken blocks, line endings, protocol headers and dialogue instructions.
    for block in re.split(r'(<d>[\s\S]*?</d>)',text,flags=re.I):
        if re.fullmatch(r'<d>[\s\S]*?</d>',block,re.I):chunks.append(block);continue
        for line in block.splitlines(keepends=True):
            if HEAD.match(line.strip()) or re.match(r'^\s*Dialogue(?: language)?:',line,re.I):chunks.append(line);continue
            field=re.match(r'^(\s*(?:Camera|Expression|Sound|Spatial start|Spatial end|Professional):\s*)',line,re.I)
            if field:chunks.append(field[0]);line=line[len(field[0]):]
            at=0
            for token in PROTECTED.finditer(line):
                add(line[at:token.start()],chunks,jobs);chunks.append(token[0]);at=token.end()
            add(line[at:],chunks,jobs)
    return chunks,jobs

def add(value,chunks,jobs):
    match=re.match(r'^(\s*)(.*?)(\s*)$',value,re.S)
    if not match or not re.search(r'[A-Za-z\u3400-\u9fff]',match[2]):chunks.append(value);return
    chunks.extend([match[1],len(jobs),match[3]]);jobs.append(match[2])

def analyze(s,cfg,snapshot,payload):
    source=snapshot['original'];chunks,jobs=parts(source)
    if not jobs:raise ValueError('提示词没有需要翻译的文字')
    system='Translate video prompt prose into Simplified Chinese and English. Return JSON with zh and en arrays, one translated string per input fragment in the same order. Fragments are separated to protect protocol tokens. Preserve meaning, identities, action ownership, negation and continuity. Do not invent content. Do not add markdown, new lines, numbers, reference tokens or protocol headers. Never translate or invent dialogue. Return all fragments, never truncate.'
    output=s._ai_call({**cfg,'_outputLimit':8192},[{'role':'system','content':system},{'role':'user','content':json.dumps({'fragments':jobs},ensure_ascii=False)}],True)
    if isinstance(output,str):
        try:output=json.loads(output)
        except ValueError:raise ValueError('翻译未返回有效 JSON，原文未修改')
    versions={}
    for lang in ['zh','en']:
        values=output.get(lang) if isinstance(output,dict) else None
        if not isinstance(values,list) or len(values)!=len(jobs):raise ValueError('翻译片段不完整，原文未修改')
        for i,value in enumerate(values):
            if not isinstance(value,str) or not value.strip() or len(value)>max(2000,len(jobs[i])*12) or '\n' in value or '\r' in value or PROTECTED.search(value) or HEAD.match(value):raise ValueError('翻译改变了结构或包含无效内容，原文未修改')
        versions[lang]=''.join(values[c] if isinstance(c,int) else c for c in chunks)
    return {'original':source,'sourceHash':s.digest(source),**versions,'createdAt':time.strftime('%Y-%m-%d %H:%M:%S'),'model':cfg['model']}

def enqueue(s,body):
    with s.LOCK:
        p=s.load_project();seg=segment(p,body);source=s.original_scoped_prompt(p,seg)
        if not source.strip():raise ValueError('请先准备最终提示词')
        if len(source)>20000:raise ValueError('提示词过长，请缩短本段描述后翻译')
        cfg=s.settings().get('ai',{})
        if not cfg.get('model'):raise ValueError('请先设置文字模型')
        import task_backend
        row=task_backend.manager(s).add('translation',{'projectId':p['projectId'],'segmentId':seg['id'],'title':'提示词双语翻译 · '+seg['title']},cfg,{'original':source})
        return {'id':row['id']}

def segment(p,body):
    if not p or p['projectId']!=body.get('projectId'):raise ValueError('项目已切换')
    seg=next((x for x in p['segments'] if x['id']==body.get('segmentId')),None)
    if not seg:raise ValueError('原片段已删除')
    return seg

def info(s,body):
    with s.LOCK:
        p=s.load_project();seg=segment(p,body);source=s.original_scoped_prompt(p,seg);result=seg.get('promptTranslations')
        return {'original':source,'versions':result,'stale':bool(result and result.get('sourceHash')!=s.digest(source)),'exportLanguage':seg.get('promptExportLanguage','original')}

def save_result(s,body):
    import task_backend
    with s.LOCK:
        p=s.load_project();seg=segment(p,body);row=task_backend.manager(s).get(body.get('id'))
        if not row or row['type']!='translation' or row['status']!='done' or row['projectId']!=p['projectId'] or row['segmentId']!=seg['id']:raise ValueError('翻译任务不属于当前片段或尚未完成')
        result=row['result'];source=s.original_scoped_prompt(p,seg)
        if result['sourceHash']!=s.digest(source):raise ValueError('原文或素材已改变，请重新翻译；已有内容未覆盖')
        seg['promptTranslations']=copy.deepcopy(result);seg['promptExportLanguage']='original';s.save(p);return {'project':p}

def choose(s,body):
    with s.LOCK:
        p=s.load_project();seg=segment(p,body);lang=body.get('language')
        if lang not in ['original','zh','en']:raise ValueError('提示词语言无效')
        if lang!='original':
            result=seg.get('promptTranslations',{})
            if result.get('sourceHash')!=s.digest(s.original_scoped_prompt(p,seg)) or not result.get(lang):raise ValueError('翻译不存在或已过期，请重新翻译')
        seg['promptExportLanguage']=lang;s.save(p);return {'project':p}
