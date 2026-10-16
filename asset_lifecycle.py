"""Project assets outlive story segments. `episodes` is accepted as an input alias."""
import copy

def normalize(project,previous=None):
 if not isinstance(project,dict):return project
 if 'segments' not in project:project['segments']=project.pop('episodes',[])
 elif 'episodes' in project:
  if project['episodes']!=project['segments']:raise ValueError('episodes 与 segments 内容不一致')
  project.pop('episodes')
 assets=project.setdefault('assets',[]);segments=project['segments']
 if not isinstance(assets,list) or not isinstance(segments,list):raise ValueError('项目素材与片段必须为列表')
 # Migrate legacy nested records; reference bindings (refs) remain bindings only.
 for segment in segments:
  for item in segment.pop('assets',[]):
   existing=next((a for a in assets if a.get('id')==item.get('id')),None)
   if existing is not None:
    if existing.get('path')!=item.get('path'):raise ValueError('素材 ID 冲突，未覆盖原素材')
    continue
   asset=copy.deepcopy(item);asset.setdefault('scope','segment');asset.setdefault('segmentId',segment['id']);assets.append(asset)
 owners={seg['id'] for seg in segments}
 if isinstance(previous,dict) and previous.get('projectId')==project.get('projectId'):
  removed={seg['id'] for seg in previous.get('segments',[])}-owners
  for asset in previous.get('assets',[]):
   if asset.get('scope')=='segment' and asset.get('segmentId') in removed and not any(a.get('id')==asset.get('id') for a in assets):
    assets.append(copy.deepcopy(asset));path=asset.get('path')
    if path in previous.get('media',{}):project.setdefault('media',{}).setdefault(path,previous['media'][path])
 for asset in assets:
  if asset.get('scope')=='segment' and asset.get('segmentId') not in owners:
   asset['formerSegmentId']=asset.get('segmentId','');asset['scope']='public';asset['segmentId']=''
 return project
