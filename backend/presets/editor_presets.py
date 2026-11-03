"""Cross-project text shortcuts. Library bindings keep identity, not stale copied notes."""
import hashlib,json,re

FIELDS={'story','segmentPrompt','action','camera','dialogue','sound','expression','startState','endState','description','prompt'}
DEFAULTS=[{'id':'camera-'+str(i),'field':'camera','name':name,'content':name,'shortcut':'','binding':None} for i,name in enumerate(['中景','特写','广角','POV 视角','缓慢推近','绕圈环拍','极速俯冲'])]

def library(s,body=None):
 body=body or {};path=s.DATA/'editor-presets.json'
 with s.LOCK:
  rows=json.loads(path.read_text('utf-8')) if path.exists() else DEFAULTS
  def digest():return hashlib.sha256(json.dumps(rows,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
  revision=digest()
  if body.get('action'):
   if body.get('revision')!=revision:raise ValueError('快捷预设已在其他窗口修改，请刷新后重试')
   action=body['action'];ident=body.get('id','');old=next((r for r in rows if r['id']==ident),None)
   if ident and old is None:raise ValueError('快捷预设已删除，请刷新')
   rows=[dict(r) for r in rows]
   if action=='save':
    item={k:body.get(k,'') for k in ['field','name','content','shortcut']}
    if not isinstance(item['field'],str) or item['field'] not in FIELDS:raise ValueError('快捷预设目标字段无效')
    if any(not isinstance(item[k],str) for k in ['name','content','shortcut']):raise ValueError('快捷预设格式无效')
    item['name']=item['name'].strip()
    if not item['name'] or len(item['name'])>100 or len(item['content'])>12000:raise ValueError('名称必填且不超过100字；内容不超过12000字')
    if item['shortcut'] and not re.fullmatch(r'Alt\+Shift\+[1-9]',item['shortcut']):raise ValueError('快捷键请使用 Alt+Shift+1 至 Alt+Shift+9')
    if item['shortcut'] and any(r['shortcut']==item['shortcut'] and r['id']!=ident for r in rows):raise ValueError('快捷键已被使用，请选择其他快捷键')
    binding=body.get('binding')
    if binding is not None:
     if not isinstance(binding,dict) or binding.get('source') not in ['visual','asset'] or not isinstance(binding.get('id'),str) or not binding['id'] or len(binding['id'])>200:raise ValueError('参考库绑定无效')
     binding={k:binding.get(k,'') for k in ['source','id','category']}
     if not isinstance(binding['category'],str) or len(binding['category'])>100:raise ValueError('参考库分类无效')
    elif not item['content'].strip():raise ValueError('请填写插入内容或绑定参考库条目')
    item.update(id=ident or s.uid(),binding=binding)
    rows=[item if r['id']==ident else r for r in rows] if old else rows+[item]
    if len(rows)>200:raise ValueError('快捷预设最多200项')
   elif action=='delete':rows=[r for r in rows if r['id']!=ident]
   elif action=='move':
    if not old or body.get('direction') not in ['up','down']:raise ValueError('请选择移动的预设与方向')
    indices=[i for i,r in enumerate(rows) if r['field']==old['field']];at=next(j for j,i in enumerate(indices) if rows[i]['id']==ident);target=at+(-1 if body['direction']=='up' else 1)
    if 0<=target<len(indices):a,b=indices[at],indices[target];rows[a],rows[b]=rows[b],rows[a]
   else:raise ValueError('未知快捷预设操作')
   s.DATA.mkdir(parents=True,exist_ok=True);temp=path.with_suffix('.tmp');temp.write_text(json.dumps(rows,ensure_ascii=False,indent=2),'utf-8');temp.replace(path);revision=digest()
  return {'revision':revision,'items':rows}
