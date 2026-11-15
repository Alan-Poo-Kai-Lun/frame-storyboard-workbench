"""Compile editable shot data at the H3 output boundary, without model calls."""
import re
from backend.services import generation_backend as generation
from backend.ai import prompt_review, h3_workflow


def editable_text(text):
    """Read H3 dialogue back into the editable timeline without losing speech."""
    def spoken(match):
        voice,language,words=match.groups()
        voice=voice.strip()
        if voice=='Unassigned voice':voice=''
        elif voice.startswith('Voice '):voice=voice[6:]
        voice=re.sub(r'<Subject (\d+)>',r'<Picture \1>',voice)
        return 'Dialogue: '+(voice+': ' if voice else '')+words+'\nDialogue language: '+language
    text=re.sub(r'^(.*?)\s*\(S\d+\) says, <d>\[([^\]]+)\] (.*?)</d>$',spoken,text,flags=re.M)
    return re.sub(r'(?m)^\s*\[Shot \d+\]\s*$', '',text)


def compile_prompt(server, project, segment):
    assets = [a for a in server.scoped_assets(project, segment) if generation.media_type(a) == 'image']
    numbers = {a.get('pictureNumber', project['assets'].index(a)+1): i+1 for i, a in enumerate(assets)}
    mode = generation.mode_key(project.get('generation', {}).get('taskType') or project.get('defaultPack', {}).get('taskType') or 'r2v')
    if mode == 'mixed':
        mode = generation.mode_key(segment.get('generation', {}).get('taskType') or segment.get('taskType') or 't2v')
    reference_mode = mode in ('r2v', 'rv2v')
    roles = segment.get('planning', {}).get('referenceRoles', {})
    def role(asset):
        use=h3_workflow.presentation(asset,segment)
        if use in ('information','post'):return 'information'
        if use in ('overlay','screen'):return 'product'
        if use=='frame':return 'frame'
        chosen=roles.get(asset['id'])
        # Legacy planners assigned general to every checked reference. A known
        # person/scene/product still provides reusable content, not a frame anchor.
        if chosen and chosen!='general':return chosen
        if chosen=='general' and re.search(r'综合海报|信息图|宣传海报|composite poster',str(asset.get('description','')),re.I):return 'general'
        return {'人物':'person','角色':'person','场景':'scene','道具':'product'}.get(asset.get('kind'),'general')
    subjects = {n: i+1 for i,n in enumerate(n for n in numbers if role(assets[numbers[n]-1]) in ('person','product','scene','style','general'))}

    def number(n):
        if n not in numbers:
            raise ValueError(f'{segment["title"]} 引用了缺失或不属于本组的 Picture {n}')
        return numbers[n]

    def prose(text):
        # References in spoken text are intentionally never passed through here.
        def replace(match):
            n = int(match[1]); local = number(n)
            use=h3_workflow.presentation(assets[local-1],segment)
            if use=='information':return 'the supplied information brief (not an on-set object)'
            if use=='post':return 'the post-production insert (not generated on set)'
            return f'<Subject {subjects[n]}>' if reference_mode and n in subjects else f'<Picture {local}>'
        return re.sub(r'<?@?(?:Picture|Subject)\s*(\d+)>?', replace, str(text or ''), flags=re.I)

    definitions = [];retention=[]
    if reference_mode:
        for n, local in numbers.items():
            asset = assets[local-1]
            label = h3_workflow.brief(asset,segment)
            purpose = role(asset)
            use=h3_workflow.presentation(asset,segment)
            if use in ('information','post'):continue
            if n in subjects:
                constraint = 'Preserve identity and clothing; do not copy presentation-board layout.' if purpose == 'person' else 'Use only its explicitly described appearance or spatial layout.'
                definitions.append(f'<Subject {subjects[n]}> is {label} from <Picture {local}>. {constraint}')
                if use=='overlay':definitions[-1]+=' This is an explicitly selected overlay layer, not a physical screen or another person.'
                if use=='screen':definitions[-1]+=' This content is shown on the explicitly requested physical display; do not invent a display location.'
                appearances=[f'[Shot {i+1}]' for i,h in enumerate(segment.get('shots',[])) if n in h.get('referenceNumbers',[]) or n in prompt_review.references(' '.join(str(h.get(k,'')) for k in ['action','camera','startState','endState','dialogue']))]
                where=', '.join(appearances) or 'shots explicitly using this subject'
                marker=segment.get('planning',{}).get('referenceUsage',{}).get(asset['id'],{}).get('retention','fully_preserved')
                if marker not in h3_workflow.RETENTIONS:marker='fully_preserved'
                scope='identity, facial features and wardrobe' if purpose=='person' else 'the explicitly described visual features and confirmed landmarks'
                retention.append(f'<Subject {subjects[n]}> (appears in {where}): {marker} - preservation applies only to {scope}, not the source image framing; camera and timeline actions follow the shots.')
                layout=prompt_review.scene_description(asset)
                if layout:definitions.append('Confirmed layout for this subject: '+layout)
            else:
                definitions.append(f'<Picture {local}> is the explicitly selected frame or composition anchor: {label}.')
                marker=segment.get('planning',{}).get('referenceUsage',{}).get(asset['id'],{}).get('retention','weak_reference')
                if marker not in h3_workflow.RETENTIONS:marker='weak_reference'
                retention.append(f'<Picture {local}> (frame/composition anchor): {marker} - follow the requested framing, without treating a presentation board as an additional character.')

    settings = segment.get('generation', {})
    def bound(field):
        value = settings.get(field, segment.get(field, {}))
        return value if isinstance(value, str) else (value or {}).get('imageFile', '')

    alignment = []
    duration = float(segment.get('duration', 0))
    shots = segment.get('shots', [])
    if mode == 'i2v' and (bound('genImage') or segment.get('imageFile')):
        alignment.append('For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.')
    if mode == 'fl2v':
        start, end = bound('startImage'), bound('endImage')
        parts = []
        if start: parts.append('<Picture 1> (from [Shot 1]) aligns with the 0.00-second mark')
        if end: parts.append(f'<Picture {2 if start else 1}> (from [Shot {max(1,len(shots))}]) aligns with the {duration:.2f}-second mark')
        if parts: alignment.append('How the reference pictures align with the target video — '+'; '.join(parts)+' of the target video.')
    if not reference_mode:
        # Base modes have endpoint inputs, not a Ref2VA identity reference list.
        # Keep descriptive content but remove misleading numbered reference labels.
        def prose(text):
            def replace(match):
                n=int(match[1]);local=number(n);asset=assets[local-1]
                return prompt_review.generation_description(asset)['generation'] or asset.get('name','Reference')
            return re.sub(r'<?@?(?:Picture|Subject)\s*(\d+)>?', replace, str(text or ''), flags=re.I)

    speakers = {}
    def dialogue(text, language):
        # Speaker IDs follow first vocal appearance, never reference-image order.
        result = []
        for line in str(text or '').splitlines():
            line=line.strip()
            if not line or silent_dialogue(line): continue
            if language=='No dialogue':continue
            match=re.match(r'^(?:@?<?(?:Picture|Subject)\s*(\d+)>?|([^:：\n]{1,40}))\s*[:：]\s*(.+)$',line,re.I)
            if match:
                n=int(match[1]) if match[1] else None
                if n is not None:number(n)
                key=('asset',n) if n else ('voice',match[2].strip())
                spoken=match[3]
                # A composite poster cannot establish a speaker's identity.
                identity=f'<Subject {subjects[n]}>' if reference_mode and n in subjects else ('Voice '+str(match[2] or 'unassigned'))
            else:
                people=[n for n in subjects if role(assets[numbers[n]-1])=='person']
                # Only a single established character, and no narration cue,
                # permits local speaker attribution. Multiple people stay unresolved.
                if len(people)==1 and not re.search(r'旁白|画外音|narrat|voice.over',line,re.I):
                    key=('asset',people[0]);identity=f'<Subject {subjects[people[0]]}>'
                else:key=('voice','unassigned');identity='Unassigned voice'
                spoken=line
            if silent_dialogue(spoken):continue
            speakers.setdefault(key,len(speakers)+1)
            spoken=re.sub(r'^<d>\[[^\]]+\]\s*|</d>$','',spoken).strip()
            result.append(f'{identity} (S{speakers[key]}) says, <d>[{language or "Unspecified"}] {spoken}</d>')
        return '\n'.join(result)

    detailed=[];sound=[]
    for i,shot in enumerate(shots,1):
        start,end=float(shot['start']),float(shot['end'])
        stamp=f'{int(start//60):02d}:{start%60:06.3f}'
        block=[('[Shot 1]' if i==1 else f'[Shot {i}] At {stamp}, the shot cuts.'),prose(shot.get('action',''))]
        # Bindings remain structured project data, not repetitive generation prose.
        professional=server.studio.professional_text(shot) or shot.get('professionalNote','')
        if professional:block.append('Professional: '+prose(professional))
        if shot.get('camera'):block.append('The camera: '+prose(shot['camera']))
        if shot.get('expression'):block.append('The visible performance: '+prose(shot['expression']))
        if shot.get('startState'):block.append('At the beginning of this shot: '+prose(shot['startState']))
        if shot.get('endState'):block.append('By the end of this shot: '+prose(shot['endState']))
        if shot.get('sound'):block.append('Sound: '+prose(shot['sound']))
        lines=dialogue(shot.get('dialogue',''),server.dialogue_language(shot.get('dialogueLanguage') or segment.get('dialogueLanguage') or project.get('dialogueLanguage')))
        if lines:block.append(lines)
        detailed.append('\n'.join(block))
        if shot.get('sound'):sound.append(f'[Shot {i}] '+prose(shot['sound']))
    summary=prose(segment.get('planning',{}).get('summary') or segment.get('title',''))
    # Avoid repeating spoken lines when an old planning summary contains dialogue.
    for shot in shots:
        for line in str(shot.get('dialogue','')).splitlines():
            spoken=re.sub(r'^.*?[:：]\s*','',line).strip()
            if spoken and spoken in summary:summary=prose(segment.get('title',''));break
    def section(name):
        match=re.search(r'(?ims)^'+name+r':[^\S\n]*\n?(.*?)(?=^[a-z_]+:|\Z)',segment.get('prompt',''))
        return match[1].strip() if match else ''
    extra=[name+': '+prose(section(name)) for name in ('editing','cinematography','continuity_constraints','negative_constraints') if section(name)]
    music=section('non_diegetic_music') or 'No additional music specified.'
    body='\n\n'.join(detailed+extra)
    if reference_mode:body='The visual style follows the explicitly selected references.\n'+body
    audio=' '.join(dict.fromkeys(re.sub(r'^\[Shot \d+\]\s*','',x) for x in sound)) or 'Only the explicitly specified ambience and physical sounds; no invented speech.'
    if reference_mode:
        return '\n\n'.join(['subject_definitions:\n'+('\n'.join(definitions) or 'No reference subjects supplied.'),'summary:\n[reference generation] '+summary,'retention_analysis:\n'+('\n'.join(retention) or 'No separately defined reference content.'),'detailed_description:\n'+body,'overall_soundscape:\n'+audio,'non_diegetic_music:\n'+music])
    return ('\n'.join(alignment)+'\n\n' if alignment else '')+'\n\n'.join(['integrated_multimodal_description:\n'+body,'overall_soundscape:\n'+audio,'non_diegetic_music:\n'+music])


def silent_dialogue(text):
    return bool(re.fullmatch(r"[\s（(\[【]*?(?:无(?:台词|对白|对话|声)|没有(?:台词|对白)|静音|环境音|no (?:dialogue|speech)|silence|ambient (?:sound|only))(?:[，,、/\s]+(?:环境音|环境声|静音|无台词|ambient sound))*[\s）)\]】。.]*",str(text),re.I))

def reference_map(server,project,segment):
    assets=[a for a in server.scoped_assets(project,segment) if generation.media_type(a)=='image']
    roles=segment.get('planning',{}).get('referenceRoles',{});result=[];subject=0
    mode=generation.mode_key(project.get('generation',{}).get('taskType') or project.get('defaultPack',{}).get('taskType') or 'r2v')
    if mode=='mixed':mode=generation.mode_key(segment.get('generation',{}).get('taskType') or segment.get('taskType') or 't2v')
    for i,a in enumerate(assets,1):
        result.append({'label':f'Picture {i}','assetId':a['id']})
        use=h3_workflow.presentation(a,segment)
        if use in ('information','post','frame'):continue
        role=roles.get(a['id'])
        if use in ('overlay','screen'):role='product'
        if role=='general' and re.search(r'综合海报|信息图|宣传海报|composite poster',str(a.get('description','')),re.I):role='information'
        if not role or role=='general':role={'人物':'person','角色':'person','场景':'scene','道具':'product'}.get(a.get('kind'),'general')
        if mode in ('r2v','rv2v') and role in ('person','product','scene','style','general'):
            subject+=1;result.append({'label':f'Subject {subject}','assetId':a['id']})
    for kind,label in [('audio','Audio'),('video','Video')]:
        result.extend({'label':f'{label} {i}','assetId':a['id']} for i,a in enumerate([v for v in server.scoped_assets(project,segment) if generation.media_type(v)==kind],1))
    return result

def diagnostics(project,segment,text):
    issues=[]
    if re.search(r'[\u3400-\u9fff]',re.sub(r'<d>[\s\S]*?</d>','',text)):
        issues.append('描述正文仍含中文；使用“生成英文 H3”并确认英文副本后，查看、复制与导出将统一使用英文。对白原文保持不变。')
    for i,h in enumerate(segment.get('shots',[]),1):
        if silent_dialogue(h.get('dialogue','')):issues.append(f'镜头 {i} 的无台词说明已排除，不作为朗读内容。')
        duration=float(h.get('end',0))-float(h.get('start',0));line=str(h.get('dialogue',''))
        if duration>0 and len(re.findall(r'[\u3400-\u9fff]',line))/duration>5:issues.append(f'镜头 {i} 对白密度偏高，请试听确认时长；未自动删改台词。')
        if i>1:
            prev=segment['shots'][i-2]
            if abs(float(prev.get('end',0))-float(h.get('start',0)))>.01:issues.append(f'镜头 {i} 与上一镜头时间不连续，请核对。')
    for warning in language_warnings(project,segment):issues.append(warning)
    for a in project.get('assets',[]):
        if a.get('deleted'):continue
        n=a.get('pictureNumber');used=[i for i,h in enumerate(segment.get('shots',[]),1) if n in prompt_review.references(str(h.get('action','')))]
        if used and h3_workflow.presentation(a,segment) in ('information','post'):
            issues.append('镜头 '+','.join(map(str,used))+' 引用了“'+a.get('name','素材')+'”的信息／后期参考；请在生成设置确认呈现方式，不会自动把它变成现场屏幕或复制海报人物。')
    if 'Unassigned voice' in text:issues.append('存在未确认说话人，请明确绑定人物或标记旁白。')
    return issues


def language_warnings(project,segment):
    warnings=[]
    for i,h in enumerate(segment.get('shots',[]),1):
        lang=h.get('dialogueLanguage') or segment.get('dialogueLanguage') or project.get('dialogueLanguage','')
        text=str(h.get('dialogue','')).lower()
        words=set(re.findall(r"[a-z]+",text));malay=words & {'jangan','anda','dengan','yang','untuk','semua','sekarang','telefon','pautan','mereka','kepada','boleh','tutup','ditutup','semakin','hati','keselamatan','akaun','dapat','ini','satu','jadi'}
        if len(malay)>=3 and str(lang).lower() in ('mandarin','中文','中文 - mandarin','普通话','chinese'):
            warnings.append(f'镜头 {i}：对白疑似马来语，但标签为 {lang}。请在生成设置确认 Malay；未自动翻译台词或修改语言。')
    return warnings
