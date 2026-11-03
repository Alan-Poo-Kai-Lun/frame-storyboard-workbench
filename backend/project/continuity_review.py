"""Conservative local review of a planning draft; never edits project or calls AI."""
import copy,re

FIELDS=('action','camera','expression','dialogue','sound','startState','endState')
def refs(text):return {int(n) for n in re.findall(r'@?<?Picture\s+(\d+)',str(text),re.I)}

def actor_states(text):
    out={}
    for m in re.finditer(r'@?<?Picture\s+(\d+)>?([^@<>]*?)(?=@?<?Picture\s+\d+|$)',str(text),re.I):
        part=m[2];state='seated' if re.search('坐在|坐于|坐姿|落座|坐着',part) else 'standing' if re.search('站立|站在|已起身|已经起身',part) else None
        if state:out[int(m[1])]=state
    return out

def review(segments,references,assets=()):
    rows=copy.deepcopy(segments);issues=[];allowed={int(a['number']) for a in references if isinstance(a.get('number'),int)}
    descriptions={int(a.get('pictureNumber',i+1)):str(a.get('description','')) for i,a in enumerate(assets)}
    def add(si,hi,code,message,field,suggestion=None,previous=None):
        h=rows[si]['shots'][hi];issues.append({'id':f'{si}:{hi}:{code}:{field}','segment':si,'shot':hi,'segmentId':rows[si].get('id'),'shotId':h.get('id'),'code':code,'severity':'warning','message':message,'field':field,'before':copy.deepcopy(h.get(field,[] if field=='referenceNumbers' else '')),'suggestion':suggestion,'previous':previous})
    prev=None
    for si,seg in enumerate(rows):
        for hi,h in enumerate(seg.get('shots',[])):
            action=str(h.get('action',''));start=str(h.get('startState',''));end=str(h.get('endState',''));camera=str(h.get('camera',''))
            used=set().union(*(refs(h.get(k,'')) for k in FIELDS));bound=set(h.get('referenceNumbers') or [])
            missing=used-bound
            if missing:add(si,hi,'binding','正文或空间状态提到未绑定素材，请核对目标、说话人及离画人物。','referenceNumbers',sorted(bound|(missing&allowed)))
            unknown=used-allowed
            if unknown:add(si,hi,'unknown_reference','引用不在当前素材表：'+','.join(map(str,sorted(unknown))),'action')
            if not start.strip():add(si,hi,'missing_start','缺少起始位置、朝向和姿态。','startState',prev.get('endState','') if prev and prev.get('endState') else None)
            if not end.strip():add(si,hi,'missing_end','缺少结束位置、姿态或动作结果。','endState')
            if prev:
                before=actor_states(prev.get('endState',''));after=actor_states(start)
                for actor in before.keys()&after.keys():
                    if before[actor]!=after[actor]:add(si,hi,'pose_jump',f'Picture {actor} 的坐／站状态与上一镜不同；需核对过渡，不能直接覆盖。','startState',previous=prev.get('endState',''));break
                omitted=refs(prev.get('endState',''))-refs(start)
                if omitted and before:add(si,hi,'state_loss','起始状态可能遗漏上一镜人物姿态或位置；请核对离画人物。','startState',previous=prev.get('endState',''))
            if re.search('从沙发.*起身|从座椅.*起身|从椅.*起身',action) and re.search('已起身|已经起身|站立',start):add(si,hi,'internal_pose','起始已站立，动作又要求从座位起身。','startState')
            if re.search('接触前|即将命中',start) and prev and re.search('踢击.*完成|收回.*腿|踢击.*结束',str(prev.get('endState',''))):add(si,hi,'action_rewind','上一镜已完成踢击，本镜回到接触前，可能时间倒退。','startState',previous=prev.get('endState',''))
            if re.search('放下.*手|放开',action) and prev and re.search('挡.*踢|接住.*脚',str(prev.get('action',''))) and not re.search('收.*腿|落地|落脚',action+start+end):add(si,hi,'contact_release','解除挡击后未交代攻击者收腿、支撑脚或落地。','endState')
            if sum(bool(re.search(x,action)) for x in ['瞬移|瞬间移动','连续|连击|两记','碰撞|对撞','起身','退去|后退|拉开'])>=2:add(si,hi,'action_load','同镜存在多阶段复杂动作，建议拆镜或减少动作；不自动改时长。','action')
            if re.search('左侧|右侧',action+start+end) and re.search('环绕|正反打|反打|90|越.*肩',camera):add(si,hi,'axis','画面左右与换机位混用：请明确场景地标和摄影机所在轴线侧。','camera')
            dialogue=str(h.get('dialogue',''))
            if dialogue.strip() and not refs(dialogue):add(si,hi,'speaker','对白未显式绑定 Picture 说话人，请确认说话者。','dialogue')
            for m in re.finditer(r'@?<?Picture\s+(\d+)>?([^。\n]*)',action,re.I):
                for token in ['露指战术手套','凤凰纹样','高马尾','V字形胸饰']:
                    own=descriptions.get(int(m[1]),'')
                    if token in m[2] and token not in own and any(token in d for n,d in descriptions.items() if n!=int(m[1])):
                        add(si,hi,'identity_mix',f'疑似将其他人物的“{token}”写给 Picture {m[1]}，请对照参考图。','action');break
            prev=h
    return {'version':1,'engine':'local-rules','notice':'本地规则审查，不调用模型；疑似项须人工核对，不代表完整语义审查、真实视频验收或生成保证。','issues':issues}
