"""Reference normalization and visible diagnostics, not a claim of model-level guarantees."""
import re
REF=re.compile(r'@?<?@?Picture[ \t]*(\d+)(?![0-9A-Za-z_])(?:[ \t]*>)?',re.I)
def references(text):return {int(m[1]) for m in REF.finditer(text or '')}
def normalize(text,mapper=None,label='Picture'):
 def replace(m):
  n=int(m[1]);n=mapper(n) if mapper else n
  return f'<{label} {n}>'
 return REF.sub(replace,text or '')

# The editable dossier remains authoritative. Never recover obsolete vision facts
# after a user has edited it. Projection is local and does not make an AI request.
DOSSIER_LABELS={
 '人物 / 主体外观':'appearance','主体外观':'appearance','服装与材质':'costume',
 '场景布局与空间关系':'layout','固定物件与地面':'landmarks','光线与配色':'lighting',
 '需要保持的可见细节':'preserve','不确定项':'uncertainties'}
DISPLAY=re.compile(r'三视图|多视图|多角度展示|角色设定图|全身照|面部(?:及肩颈)?特写|正面特写|纯?白(?:色)?(?:底|背景)|存白色背景|影棚|棚拍|展示布光|产品.{0,4}展示|从左至右依次|左侧约.?1/3|左侧为头部|人物均垂直站立|双手垂直于身体两侧|双脚自然分开|站姿挺拔|眼神直视前方|无明显阴影|地面.{0,5}阴影')
SCENE_KEYS={'view':'基准视角','left':'基准画面左侧','right':'基准画面右侧','center':'中央 / 通路','background':'画面纵深 / 背景','access':'物件接触与取用条件','unknown':'未确认空间'}
def scene_layout(asset):
 value=asset.get('sceneLayout')
 if asset.get('kind')!='场景' or not isinstance(value,dict) or value.get('confirmed') is not True:return {}
 return {k:v.strip() for k in SCENE_KEYS if isinstance((v:=value.get(k)),str) and v.strip()}
def scene_description(asset):
 value=scene_layout(asset)
 return '\n'.join(SCENE_KEYS[k]+'：'+v for k,v in value.items())

def generation_description(asset):
 description=str(asset.get('description','')).strip();description=re.sub(r'\s*('+ '|'.join(re.escape(k) for k in DOSSIER_LABELS)+r')\s*[:：]',r'\n\1：',description);sections={};current='notes'
 for line in description.splitlines():
  found=re.match(r'^\s*('+ '|'.join(re.escape(k) for k in DOSSIER_LABELS)+r')\s*[:：]\s*(.*)',line)
  if found:current=DOSSIER_LABELS[found[1]];line=found[2]
  sections[current]=sections.get(current,'')+' '+line
 person=asset.get('kind')=='人物';excluded=[];pieces=[]
 allowed={'appearance','costume','preserve','notes'} if person else set(sections)-{'uncertainties'}
 for key,value in sections.items():
  if key not in allowed:
   if value.strip():excluded.append(key)
   continue
  # Clause filtering prevents "白色衬衫，纯白背景" from deleting the shirt.
  for clause in re.split(r'[。；;\n，,]+',value):
   clause=clause.strip()
   if not clause:continue
   if person and DISPLAY.search(clause):excluded.append(clause);continue
   if not person and (re.search(r'这是一张|该场景无主要人物|背景为纯白|全身三视图|图片.{0,15}(?:旋转|横置|竖置)|实际(?:上方|下方)|顺时针.{0,8}(?:度|旋转)|逆时针.{0,8}(?:度|旋转)',clause) or (scene_layout(asset) and (key=='layout' or re.search(r'左[侧边方]|右[侧边方]',clause)))):excluded.append(clause);continue
   if clause not in pieces:pieces.append(clause)
 # Retain complete clauses rather than slicing a negation or a reference label.
 selected=[];length=0
 for clause in pieces:
  if length+len(clause)>1000:excluded.append('超出生成说明预算的后续细节');break
  selected.append(clause);length+=len(clause)+1
 return {'generation':'；'.join(selected),'uncertainties':sections.get('uncertainties','').strip(),
         'excluded':excluded,'hasContent':bool(selected)}

def canonical(value,active):
 value=re.sub(r'<Subject\s+(\d+)>',r'<Picture \1>',value or '',flags=re.I)
 value=normalize(value)
 # Names are only aliases when unambiguous, and never rewrite dialogue.
 for a in sorted(active,key=lambda a:len(a.get('name','')),reverse=True):
  name=a.get('name','')
  if len(name)>=2 and sum(b.get('name')==name for b in active)==1:
   value=value.replace(name,'<Picture '+str(a['pictureNumber'])+'>')
 return value

def outcome_targets(value):
 """Recognize explicit consequences only; this is not general semantic proof."""
 result={'impact':set(),'costume':set()}
 ref=r'<Picture\s+(\d+)>'
 for clause in re.split(r'[。；;\n]',value):
  for m in re.finditer(ref+r'((?:(?!<Picture).){0,160})',clause):
   n=int(m[1]);tail=m[2]
   if re.search(r'被\s*$',clause[:m.start()]):continue # agent, not passive patient
   if re.search(r'被(?:踢|击|打|撞)|(?:重重)?撞(?:向|到|上)|身体.{0,8}撞',tail):result['impact'].add(n)
   if re.search(r'(?:上衣|衣服|战术服|服装|上半身).{0,80}(?:烧|碳化|爆裂|毁)|露出.{0,20}内衣',tail):result['costume'].add(n)
  for m in re.finditer(ref+r'(?:(?!<Picture).){0,90}被\s*'+ref+r'.{0,30}(?:踢|击|打)',clause):result['impact'].add(int(m[1]))
  for m in re.finditer(r'(?:烧焦|烧毁|烧掉)(?:了)?\s*'+ref,clause):result['costume'].add(int(m[1]))
 return result

def quality(s,p,segment):
 """Deterministic checks with explicit severity and location. No silent rewrites."""
 active=s.scoped_assets(p,segment);issues=[]
 def add(code,message,level='warning',shot=None):
  item={'code':code,'severity':level,'message':message}
  if shot is not None:item['shotIndex']=shot
  if item not in issues:issues.append(item)
 story=canonical(segment.get('storyText',p.get('script','')),active)
 summary=canonical(segment.get('planning',{}).get('summary',''),active)
 shots=segment.get('shots',[])
 full='\n'.join(canonical(sh.get('action',''),active)+' '+canonical(sh.get('endState',''),active) for sh in shots)
 expected=outcome_targets(story);overview=outcome_targets(summary);actual=outcome_targets(full)
 for event,label in [('impact','受击 / 撞笼对象'),('costume','服装变化对象')]:
  if expected[event] and overview[event] and expected[event].isdisjoint(overview[event]):
   add('story_target','摘要的'+label+'与剧本指定的 Picture 编号冲突。','error')
  if expected[event] and actual[event] and expected[event].isdisjoint(actual[event]):
   add('story_target','分镜的'+label+'与剧本指定的 Picture 编号冲突。','error')
  if overview[event] and actual[event] and overview[event].isdisjoint(actual[event]):
   add('summary_target','摘要与时间线的'+label+'相反，请统一。','error')
 if '背靠背' not in story and '背对背' not in story and re.search('背靠背|背对背',full):
  add('invented_staging','分镜增加了剧本未指定的背靠背站位，请核对；面对面剧情应删除这一改写。')
 for n,sh in enumerate(shots,1):
  action=sh.get('action','');camera=sh.get('camera','');start=sh.get('startState','')
  if re.search(r'出拳|拳头|拳锋|踢|攻击',action) and re.search(r'直逼镜头|朝(?:向)?镜头|对着镜头|向镜头(?:挥|出|打|踢)',action) and not re.search(r'直逼镜头|朝(?:向)?镜头|对着镜头|主观镜头|第一人称|POV',story,re.I):
   add('camera_target',f'镜头 {n} 把攻击目标写成摄影机，剧本未要求此效果；请明确对手和接触目标。','error',n)
  if n>1:
   end=shots[n-2].get('endState','')
   if re.search(r'数米|几米|拉开距离|相距.{0,3}米',end) and re.search(r'近身|距离极近|额头相抵',start) and not re.search(r'靠近|冲向|冲往|逼近|追上|接近|向前|扑向|冲刺',action):
    add('distance_jump',f'镜头 {n-1} 已拉开距离，镜头 {n} 直接近身，缺少接近过程。','error',n)
  if re.search(r'拳腿交织|连续交换打击|连珠炮|极限.{0,4}格斗',action):
   add('dense_combat',f'镜头 {n} 使用概括性高速格斗，请改成明确的攻击—防守—结果，减少连续动作。','warning',n)
  if not start.strip() or not sh.get('endState','').strip():add('missing_state',f'镜头 {n} 缺少起止空间状态。','warning',n)
 for a in active:
  layout=scene_layout(a)
  if not layout or ('<Picture '+str(a['pictureNumber'])+'>') not in story:continue
  import asset_analysis as prepared
  if not prepared.valid(a,p.get('media',{})):
   add('scene_layout_unconfirmed','场景布局或图片已变化，请重新确认素材说明。');continue
  for n,sh in enumerate(shots,1):
   value='。'.join(sh.get(k,'') for k in ['action','startState','endState'])
   for side,opposite in [('left','右'),('right','左')]:
    for landmark in re.split(r'[；;、\n]',layout.get(side,'')):
     landmark=landmark.strip()
     if not landmark or len(landmark)>30:continue
     pattern=opposite+r'(?:侧|边|方)[^。；;，,与和及左右（）()\n]{0,8}'+re.escape(landmark)+'|'+re.escape(landmark)+r'[^。；;，,与和及左右（）()\n]{0,8}(?:位于|在)'+opposite+r'(?:侧|边|方)'
     if re.search(pattern,value):
      same=bool(re.search('基准|参考图机位|同参考图|固定机位',sh.get('camera',''))) and not re.search('反打|反向|对向|绕|换机位',sh.get('camera',''))
      add('scene_layout_conflict',f'镜头 {n} 的“{landmark}”左右描述与场景基准冲突；换机位需说明投影变化，固定物件不能搬位。','error' if same else 'warning',n)
 if p.get('assetsManaged'):
  for a in active:
   projected=generation_description(a)
   if not projected['hasContent']:add('empty_description','素材“'+a.get('name','未命名')+'”筛除展示信息后没有可用于生成的说明，请补充外观 / 场景特征。','error')
 if p['segments'].index(segment)>0 and not segment.get('continuity'):
  add('independent_segment','此片段为独立生成，不继承上一段；连续剧情请开启“承接上一段”。')
 return issues

def enforce(s,p):
 errors=[seg['title']+'：'+i['message'] for seg in p['segments'] for i in quality(s,p,seg) if i['severity']=='error']
 if errors:raise ValueError('导出检查未通过：\n'+'\n'.join(errors[:12])+'\n请在 H3 Prompt 检查中定位并修改；不需要重新分析素材。')
def warnings(s,p,segment):
 import asset_analysis as assets
 notes=[];active=s.scoped_assets(p,segment)
 for a in active:
  if not assets.valid(a,p.get('media',{})):notes.append('素材说明未确认或确认已失效：'+a.get('name','未命名'))
 if not segment.get('planning'):notes.append('本片段尚未生成文字分镜；旧提示词不会自动修正')
 else:
  import planning_backend as planning
  if segment['planning'].get('sourceSignature')!=planning.source_signature(s,p,segment):notes.append('来源已修改：规则检查按当前内容运行；旧 AI 提醒仅供参考，可手动核对或选择深度审查。')
  notes.extend('上次拆镜提醒：'+str(x) for x in segment['planning'].get('warnings',[]))
 previous=0
 for n,sh in enumerate(segment.get('shots',[]),1):
  if sh.get('end',0)<=sh.get('start',0) or (previous is not None and abs(sh['start']-previous)>.05):notes.append(f'镜头 {n} 时间线无效或不连续')
  previous=sh.get('end',0)
  action=sh.get('action','');camera=sh.get('camera','')
  if re.search('出拳|踢|攻击|格挡',action) and re.search('朝(?:向)?镜头|对着镜头|直视镜头',action+' '+camera):notes.append(f'镜头 {n} 包含朝镜头的打斗 / 视线，请核实目标是否应为对手')
  if n>1 and not sh.get('startState'):notes.append(f'镜头 {n} 没有明确的起始站位与朝向')
 if segment.get('shots') and abs(previous-segment['duration'])>.05:notes.append('镜头时间线未覆盖完整片段')
 if not segment.get('shots'):notes.append('本片段没有分镜')
 notes.extend(('需修复：' if i['severity']=='error' else '需核对：')+i['message'] for i in quality(s,p,segment))
 return list(dict.fromkeys(str(x) for x in notes))
