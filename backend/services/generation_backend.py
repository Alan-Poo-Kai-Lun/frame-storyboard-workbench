"""Editable Director conditioning, kept separate from generated output records."""
import base64
import copy
import json
import mimetypes
from pathlib import Path

MODES = ('t2v', 'i2v', 'fl2v', 'r2v', 'v2v', 'rv2v', 'mixed')
SEGMENT_MODES = MODES[:4]

def mode_key(value):
    return str(value or '').strip().split(' ',1)[0].lower()
FIELDS = {'image': ('refs', 'imageFile', 'Picture', 9),
          'audio': ('refAudios', 'audioFile', 'Audio', 3),
          'video': ('refVideos', 'videoFile', 'Video', 3)}


def media_type(asset):
    value = asset.get('mediaType')
    if value in FIELDS:
        return value
    mime = mimetypes.guess_type(asset.get('path', ''))[0] or ''
    return mime.split('/')[0] if mime.startswith(('audio/', 'video/')) else 'image'


def imported(project, pack, timeline, shared, files, side):
    mode = mode_key(pack.get('widgets', {}).get('task_type') or pack.get('taskType', 'r2v'))
    project['generation'] = copy.deepcopy(side.get('generation') or {'taskType': mode})
    project['generationManaged'] = bool(side.get('generationManaged'))
    project['sourceVideo'] = copy.deepcopy(side.get('sourceVideo') or timeline.get('video') or {})
    project['sourceVideoClips'] = copy.deepcopy(side.get('sourceVideoClips') or timeline.get('videoClips') or [])
    for name, data in files.items():
        mime = mimetypes.guess_type(name)[0] or ''
        if mime.startswith(('audio/', 'video/')):
            project['media'][name] = base64.b64encode(data).decode()
    for segment, raw in zip(project['segments'], timeline.get('segments', [])):
        record = next((r for r in side.get('segments', []) if r.get('id') == segment['id']), {})
        for key in ('taskType', 'genImage', 'imageFile', 'startImage', 'endImage', 'refAudios', 'refVideos'):
            if key in raw:
                segment[key] = mode_key(raw[key]) if key=='taskType' else copy.deepcopy(raw[key])
        segment['generation'] = copy.deepcopy(record.get('generation') or {})
    if side.get('assetsManaged'):
        return
    for segment, block in [(None, shared or timeline.get('global', {})), *[(s, s) for s in project['segments']]]:
        for kind in ('audio', 'video'):
            refs_key, path_key, label, _ = FIELDS[kind]
            for ref in block.get(refs_key, []):
                path = ref.get(path_key, '')
                if not path:
                    continue
                project['assets'].append({**ref, 'id': 'ref_' + kind + '_' + str(len(project['assets'])),
                    'name': ref.get('fileName') or f'{label} {ref.get("index", 0)+1}',
                    'kind': '声音' if kind == 'audio' else '视频', 'mediaType': kind, 'path': path,
                    'scope': 'segment' if segment else 'public', 'segmentId': segment['id'] if segment else '',
                    'description': '', 'locked': False})


def reference(path, kind='image', index=None):
    result = {FIELDS[kind][1]: path, 'fileName': Path(path).name, 'subfolder': str(Path(path).parent), 'type': 'input'}
    if index is not None:
        result['index'] = index
    return result


def export(files, project, pack, timeline, scoped_assets):
    """Apply only explicitly managed fields; legacy packs retain their source timeline."""
    managed = project.get('generationManaged')
    if not (managed or project.get('assetsManaged')):
        return
    mode = mode_key(project.get('generation', {}).get('taskType') or pack.get('widgets', {}).get('task_type') or pack.get('taskType', 'r2v'))
    if mode not in MODES:
        raise ValueError('不支持的项目生成模式：' + str(mode))
    deleted={a['path']:a.get('name','素材') for a in project.get('assets',[]) if a.get('deleted') and a.get('path') and not any(not b.get('deleted') and b.get('path')==a['path'] for b in project.get('assets',[]))}
    for segment in project['segments']:
        g=segment.get('generation',{})
        task=mode_key(g.get('taskType') or segment.get('taskType') or 't2v') if mode=='mixed' else mode
        fields=('genImage',) if task=='i2v' else ('startImage','endImage') if task=='fl2v' else ()
        for field in fields:
            legacy=segment.get(field,{})
            path=g.get(field) if field in g else legacy.get('imageFile') if isinstance(legacy,dict) else legacy
            if field=='genImage' and not path:path=segment.get('imageFile')
            if isinstance(path,str) and path in deleted:raise ValueError(segment['title']+' 的输入仍绑定已删除素材 '+deleted[path]+'，请恢复或重新指定')
    if mode in ('v2v','rv2v') and project.get('sourceVideo',{}).get('videoFile') in deleted:raise ValueError('源视频素材已删除，请恢复或重新指定')
    if managed:
        pack['taskType'] = mode
        pack.setdefault('widgets', {})['task_type'] = mode
        timeline.setdefault('global', {})['taskType'] = mode
        timeline['editMode'] = 'segment'
        # Cached workspaces must not silently restore an older mode or old media.
        timeline['batchWorkspaces'] = {}
    shared = json.loads(files.get('shared_params/shared_params.json', b'{}'))
    if project.get('assetsManaged'):
        for kind, (key, _, _, limit) in FIELDS.items():
            public = [a for a in scoped_assets(project) if media_type(a) == kind]
            if len(public) > limit:
                raise ValueError(f'公共 {kind} 参考最多 {limit} 个')
            shared[key] = [reference(a['path'], kind, i) for i, a in enumerate(public)]
            for source, target in zip(project['segments'], timeline['segments']):
                active = [a for a in scoped_assets(project, source) if media_type(a) == kind]
                if len(active) > limit:
                    raise ValueError(f'{source["title"]} 的公共 + 本组 {kind} 参考最多 {limit} 个')
                target[key] = [reference(a['path'], kind, i) for i, a in enumerate(active) if a.get('scope') == 'segment']
        shared['commonEnabled'] = True
        timeline.setdefault('global', {}).update(copy.deepcopy(shared))
    if managed and mode in ('v2v', 'rv2v'):
        source = project.get('sourceVideo') or {}
        path = source.get('videoFile', '')
        if not path or not project.get('media', {}).get(path):
            raise ValueError('V2V / RV2V 需要指定源视频；片段成片记录不会自动作为源视频')
        timeline['video'] = copy.deepcopy(source)
        timeline['videoClips'] = copy.deepcopy(project.get('sourceVideoClips') or [source])
        if source.get('duration') and sum(s['duration'] for s in project['segments'])>float(source['duration'])+.05:
            raise ValueError('片段总时长超过源视频，请调整片段时长或更换源视频')
        timeline['timelineMode'] = 'video'
    elif managed:
        timeline['timelineMode'] = 'fl2v' if mode=='fl2v' else 'prompt_batch'
    for i, (source, target) in enumerate(zip(project['segments'], timeline['segments'])):
        if managed:
            if mode in ('v2v', 'rv2v'):
                # Source timelines use exact ranges, without prompt-batch padding frames.
                frames = max(1, round(source['duration'] * project.get('fps', 24)))
                target.update(start=sum(s['length'] for s in timeline['segments'][:i]),
                              length=frames, frameCount=frames)
            settings = source.get('generation') or {}
            task = mode_key(settings.get('taskType') or source.get('taskType') or 't2v') if mode == 'mixed' else mode
            if mode == 'mixed' and task not in SEGMENT_MODES:
                raise ValueError(f'{source["title"]} 的 MIXED 本段模式必须是 T2V / I2V / FL2V / R2V')
            target['taskType'] = task
            for field in ('genImage', 'startImage', 'endImage'):
                path = settings.get(field)
                if isinstance(path, str) and path:
                    if not project.get('media', {}).get(path):
                        raise ValueError(f'{source["title"]} 缺少 {field} 图片')
                    if media_type({'path': path}) != 'image':
                        raise ValueError('首尾帧只能选择图片')
                    target[field] = reference(path)
                elif field in settings:
                    target.pop(field, None)
                    if field == 'genImage':
                        target.pop('imageFile', None)
            if task == 'i2v' and not (target.get('genImage', {}).get('imageFile') or target.get('imageFile')):
                raise ValueError(source['title'] + ' 的 I2V 需要输入图片')
            if task == 'fl2v' and not any(target.get(k, {}).get('imageFile') for k in ('startImage', 'endImage')):
                raise ValueError(source['title'] + ' 的 FL2V 至少需要首帧或尾帧')
        path = source.get('groupPath', f'asset_groups/{i+1:02d}/group.json')
        files[path] = json.dumps(target, ensure_ascii=False, indent=2).encode()
    if managed and mode in ('v2v', 'rv2v'):
        timeline['totalFrames'] = sum(s['length'] for s in timeline['segments'])
    if not managed:
        workspace = next((v for k,v in timeline.get('batchWorkspaces', {}).items() if mode_key(k)==mode),None)
        if workspace is not None:
            workspace['segments'] = copy.deepcopy(timeline['segments'])
            workspace.setdefault('globalCommon', {}).update(copy.deepcopy(shared))
    files['shared_params/shared_params.json'] = json.dumps(shared, ensure_ascii=False, indent=2).encode()
    files['timeline.json'] = json.dumps(timeline, ensure_ascii=False, indent=2).encode()
    files['pack.json'] = json.dumps(pack, ensure_ascii=False, indent=2).encode()

# Project labels are model-facing identifiers; H3 slot numbers are resolved per segment.
def project_assets(project):
    owners={s['id'] for s in project.get('segments',[])}
    return [a for a in project.get('assets',[]) if not a.get('deleted') and a.get('path') and (a.get('scope','public')!='segment' or a.get('segmentId') in owners)]


def project_label(project,asset):
    kind=media_type(asset)
    number=asset.get('pictureNumber',project.get('assets',[]).index(asset)+1) if kind=='image' else [a for a in project_assets(project) if media_type(a)==kind].index(asset)+1
    return FIELDS[kind][2]+' '+str(number)


def attach_plan_media(project,result,raw,message):
    import re
    assets=[a for a in project_assets(project) if media_type(a)!='image']
    chosen=[a['id'] for a in assets if (a.get('name') and a['name'] in message) or re.search(r'(?<!\w)@?'+re.escape(project_label(project,a))+r'(?!\d)',message,re.I)]
    result['mediaReferences']=media_inventory(project)
    valid={a['id'] for a in assets}
    raw_rows=[v for v in raw.get('segments',[]) if isinstance(v,dict) and v.get('shots')]
    for row,source in zip(result.get('segments',[]),raw_rows):
        for shot,original in zip(row.get('shots',[]),source.get('shots',[])):
            ids=original.get('mediaAssetIds',[])
            if not isinstance(ids,list):ids=[]
            # An explicit user reference applies even when the model omits its binding.
            shot['mediaAssetIds']=list(dict.fromkeys([v for v in ids if isinstance(v,str) and v in valid]+chosen))
            for a in assets:
                if a['id'] in shot['mediaAssetIds']:
                    shot['sound']=(shot.get('sound','')+'\n' if shot.get('sound') else '')+'参考 <'+project_label(project,a)+'>（'+a.get('name','')+'）'
    return result


def bind_plan_media(project,segment,uid):
    """Resolve stable media IDs to current local H3 slots, preserving original dialogue."""
    import re
    by_id={a['id']:a for a in project_assets(project) if media_type(a)!='image'}
    cloned={}
    for shot in segment.get('shots',[]):
        bound=[]
        for ident in shot.get('mediaAssetIds',[]):
            a=by_id.get(ident)
            if not a or not project.get('media',{}).get(a['path']):
                segment.setdefault('planning',{}).setdefault('warnings',[]).append('音视频参考已失效，未猜测替换：'+str(ident));continue
            if a.get('scope')=='segment' and a.get('segmentId')!=segment['id']:
                if ident not in cloned:
                    item=copy.deepcopy(a);item.update(id=uid(),segmentId=segment['id'],pictureNumber=max([x.get('pictureNumber',i+1) for i,x in enumerate(project['assets'])]+[0])+1);project['assets'].append(item);cloned[ident]=item
                a=cloned[ident]
            bound.append(a)
        shot['mediaAssetIds']=[a['id'] for a in bound]
        shot['assetIds']=list(dict.fromkeys(shot.get('assetIds',[])+shot['mediaAssetIds']))
        labels={};slot_by_id={}
        for a in bound:
            kind=media_type(a);active=[x for x in project.get('assets',[]) if not x.get('deleted') and x.get('path') and media_type(x)==kind and (x.get('scope','public')!='segment' or x.get('segmentId')==segment['id'])]
            active.sort(key=lambda x:x.get('scope')=='segment')
            label=FIELDS[kind][2]+' '+str(active.index(a)+1)
            original=next((x for x in by_id.values() if x['id']==a['id'] or cloned.get(x['id']) is a),a)
            labels[project_label(project,original).lower()]=label;slot_by_id[a['id']]=label
        shot['sound']=re.sub(r'<?@?(Audio|Video)\s+(\d+)>?',lambda m:'<'+labels.get((m[1]+' '+m[2]).lower(),m[1]+' '+m[2])+'>',shot.get('sound',''),flags=re.I)
        for a in bound:
            label=slot_by_id[a['id']]
            if not re.search(r'\b'+re.escape(label)+r'\b',shot['sound'],re.I):shot['sound']+=(('\n' if shot['sound'] else '')+'参考 <'+label+'>（'+a.get('name',media_type(a))+'）')


def media_inventory(project):
    return [{'id':a['id'],'name':a.get('name',''),'mediaType':media_type(a),'referenceLabel':project_label(project,a),'available':bool(project.get('media',{}).get(a['path']))} for a in project_assets(project) if media_type(a)!='image']
