"""Compile editable shot data at the H3 output boundary, without model calls."""
import re
import generation_backend as generation
import prompt_review


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
        return roles.get(asset['id'], {'人物':'person','场景':'scene','道具':'product'}.get(asset.get('kind'),'general'))
    subjects = {n: numbers[n] for n in numbers if role(assets[numbers[n]-1]) in ('person', 'product', 'scene')}

    def number(n):
        if n not in numbers:
            raise ValueError(f'{segment["title"]} 引用了缺失或不属于本组的 Picture {n}')
        return numbers[n]

    def prose(text):
        # References in spoken text are intentionally never passed through here.
        def replace(match):
            n = int(match[1]); local = number(n)
            return f'<Subject {subjects[n]}>' if reference_mode and n in subjects else f'<Picture {local}>'
        return re.sub(r'<?@?(?:Picture|Subject)\s*(\d+)>?', replace, str(text or ''), flags=re.I)

    definitions = []
    if reference_mode:
        for n, local in numbers.items():
            asset = assets[local-1]
            label = prompt_review.generation_description(asset)['generation'] or asset.get('name', 'Reference')
            purpose = role(asset)
            if n in subjects:
                constraint = 'Preserve identity and clothing; do not copy presentation-board layout.' if purpose == 'person' else 'Use only its explicitly described appearance or spatial layout.'
                definitions.append(f'<Subject {subjects[n]}> is {label} from <Picture {local}>. {constraint}')
                layout=prompt_review.scene_description(asset)
                if layout:definitions.append('Confirmed layout for this subject: '+layout)
            else:
                definitions.append(f'<Picture {local}> provides {purpose} reference information: {label}. Do not infer a separate character identity from a composite poster.')

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
            if not line: continue
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
                key=('voice','unassigned');spoken=line;identity='Unassigned voice'
            speakers.setdefault(key,len(speakers)+1)
            spoken=re.sub(r'^<d>\[[^\]]+\]\s*|</d>$','',spoken).strip()
            result.append(f'{identity} (S{speakers[key]}) says, <d>[{language or "Unspecified"}] {spoken}</d>')
        return '\n'.join(result)

    detailed=[];sound=[]
    for i,shot in enumerate(shots,1):
        start,end=float(shot['start']),float(shot['end'])
        block=[f'[Shot {i}] [{start:.2f}s–{end:.2f}s]',prose(shot.get('action',''))]
        if shot.get('referenceNumbers') and reference_mode:block.append('Bound references for this shot only: '+', '.join(prose('@Picture '+str(n)) for n in shot['referenceNumbers']))
        professional=server.studio.professional_text(shot) or shot.get('professionalNote','')
        if professional:block.append('Professional: '+prose(professional))
        if shot.get('camera'):block.append('Camera: '+prose(shot['camera']))
        if shot.get('expression'):block.append('Expression: '+prose(shot['expression']))
        if shot.get('startState'):block.append('Spatial start: '+prose(shot['startState']))
        if shot.get('endState'):block.append('Spatial end: '+prose(shot['endState']))
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
    body='\n\n'.join(alignment+detailed+extra)
    audio='\n'.join(sound) or 'Use only explicitly specified diegetic sound; do not invent dialogue.'
    if speakers:audio+='\n'+'\n'.join(f'(S{index}): stable voice for '+(f'reference {number(key[1])}' if key[0]=='asset' else key[1])+'. Keep the same voice across this segment.' for key,index in speakers.items())
    if reference_mode:
        return '\n\n'.join(['subject_definitions:\n'+('\n'.join(definitions) or 'No reference subjects supplied.'),'summary:\n'+summary,'retention_analysis:\nRetain only the explicitly bound references and stated continuity; do not invent assets or unseen spatial details.','detailed_description:\n'+body,'overall_soundscape:\n'+audio,'non_diegetic_music:\n'+music])
    return '\n\n'.join(['integrated_multimodal_description:\n'+body,'overall_soundscape:\n'+audio,'non_diegetic_music:\n'+music])
