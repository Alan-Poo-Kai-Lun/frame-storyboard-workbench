"""Named local appearance profiles, independent of project media and model settings."""
import copy, math, re, uuid
import creative_library as library

COLORS = {'background','node','highlight','grid','titleColor','bodyColor','captionColor','lineColor','arrowColor','cardBackground','cardBorder'}
NUMBERS = {'bgIntensity':(0,30),'titleSize':(10,48),'bodySize':(10,36),'captionSize':(9,28),'gridSize':(8,160),'arrowSpeed':(.1,5)}
CHOICES = {'lineStyle':{'default','pcb','orthogonal','straight','curve','hidden','rounded','bus','dotted'},'lineEffect':{'none','pulse','dual','neon','ants','comet','breathing','grain'},'arrowType':{'chevron2','chevron3','diamond','crosshair','chiseled','pulse','filled','open','dot','none','clapper','fork','jack','radar'},'pattern':{'dots','lines','none'},'imageFit':{'contain','cover'},'projectShape':{'circle','rounded','square','diamond','hexagon','chamfer','film','octagon','pill','badge'}}

def validate(value):
 if not isinstance(value,dict):raise ValueError('配色方案无效')
 result={}
 for key,v in value.items():
  if key in COLORS:
   if not isinstance(v,str) or not re.fullmatch('#[0-9a-fA-F]{6}',v):raise ValueError('颜色格式无效')
  elif key in NUMBERS:
   lo,hi=NUMBERS[key]
   if isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or not lo<=v<=hi:raise ValueError('外观数值超出范围')
  elif key in CHOICES:
   if not isinstance(v,str) or v not in CHOICES[key]:raise ValueError('外观选项无效')
  elif key in {'flow','hierarchy','pins','enableDynamicBg'}:
   if not isinstance(v,bool):raise ValueError('外观开关无效')
  elif key=='themeDynamicBg':
   if not isinstance(v,dict) or set(v)-{'light','dark'}:raise ValueError('动态主题无效')
   for item in v.values():
    if not isinstance(item,dict) or set(item)-{'enableDynamicBg','bgIntensity'}:raise ValueError('动态背景字段无效')
    validate(item)
  elif key=='activeTheme':
   if v not in ['light','dark']:raise ValueError('主题无效')
  elif key=='themeColors':
   if not isinstance(v,dict) or set(v)-{'light','dark'}:raise ValueError('主题配色无效')
   v=copy.deepcopy(v)
   for colors in v.values():
    if not isinstance(colors,dict) or set(colors)-COLORS:raise ValueError('主题颜色无效')
    validate(colors)
  else:raise ValueError('未知外观字段：'+key)
  result[key]=copy.deepcopy(v)
 return result

def builtins():
 import json, runtime_paths
 return [{**r,'builtin':True} for r in json.loads((runtime_paths.resource_dir()/'presets/appearance-presets.json').read_text('utf-8'))['items']]

def listing(data):
 store=library._read(data,'appearance-presets.json',{'revision':'0','items':[]})
 ids={r['id'] for r in store['items']};names={r['name'] for r in store['items']}
 return {**store,'items':[copy.deepcopy(r) for r in builtins() if r['id'] not in ids and r['name'] not in names]+store['items']}


def update(data,body):
 store=library._read(data,'appearance-presets.json',{'revision':'0','items':[]})
 if body.get('revision')!=store['revision']:raise ValueError('配色方案已在其他窗口修改，请刷新后重试')
 key=body.get('id');action=body.get('action','save')
 old=next((r for r in listing(data)['items'] if r['id']==key),None)
 if action=='save':
  if key and not old:raise ValueError('配色方案不存在')
  if not key and len(store['items'])>=100:raise ValueError('最多保存 100 个配色方案')
  row={'id':key or uuid.uuid4().hex,'name':library._text(body.get('name'),'方案名称',80),'appearance':validate(body.get('appearance'))}
  store['items']=[r for r in store['items'] if r['id']!=row['id']]+[row];key=row['id']
 elif action=='delete':
  if not old:raise ValueError('配色方案不存在')
  if old.get('builtin'):raise ValueError('内置方案请另存副本；不能删除内置原件')
  store['items']=[r for r in store['items'] if r['id']!=key]
 else:raise ValueError('未知配色操作')
 store['revision']=uuid.uuid4().hex;library._write(data,'appearance-presets.json',store)
 return {**listing(data),'savedId':key}
