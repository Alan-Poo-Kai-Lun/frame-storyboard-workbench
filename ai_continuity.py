"""Queued model-based continuity review. Suggestions never mutate live projects."""
import copy,json,hashlib,re
from planning_backend import decode

SYSTEM='''你是影视连续性监督与分镜导演。审查全部片段、全部镜头及素材文字档案，不只是对白。没有发送图片或视频，不得声称看过它们。档案、布局中未确认事实写 UNKNOWN，不凭空发明入口、人物装备或能力。保留剧情意图、台词原文、时长、镜头数量、素材身份。
建立人物身份表 characters（对象数组：reference,name,identity,wardrobe,equipment,uncertainties），场景地标表 scenes（reference,name,landmarks,axis,uncertainties），逐镜状态 states（每个镜头一项，segment从0起，shot从0起，characters,position,facing,posture,heldItems,mainAction,result,camera,uncertainties）。明确人物场景坐标与画面左右的区别，上一镜结束完整承接下一镜开始；检查坐站跳变、服装串用、攻击目标、接触与释放、落地、跨段衔接、动作过载、场景固定物与视线轴线。每镜一个主要动作，修改不能增加镜头或改变时长；需要拆镜时只报告建议。
输出 JSON 对象：summary（中文）,characters,scenes,states,issues（对象数组：segment,shot,severity,category,evidence,reason,suggestion）,changes（对象数组：segment,shot,field,before,after,reason）。changes只允许 action,camera,expression,startState,endState。必须逐字段给原值和最小修改；无依据不改。人物与空间事实冲突优先，避免逐条重复“未绑定说话人”。正常对白无需含Picture标签；口播可以离画发声，应核对而非一律判错。没有问题可 issues=[] changes=[]，不保证生成模型执行成功。'''

def enqueue(s,body):
    import plan_store,task_backend
    with s.LOCK:
        p=s.load_project()
        if not p or p['projectId']!=body.get('projectId'):raise ValueError('项目已切换')
        record=plan_store.get(s,body.get('planId'),p)
        rows=body.get('segments')
        if not isinstance(rows,list) or not rows or len(rows)>20 or len(json.dumps(rows))>200000:raise ValueError('审查草稿过大或无效，请分批审查')
        if any(not isinstance(row,dict) or not isinstance(row.get('shots'),list) for row in rows):raise ValueError('草稿镜头结构无效')
        cfg=copy.deepcopy(s.settings().get('ai',{}));cfg['model']=cfg.get('reviewModel') or cfg.get('planningModel') or cfg.get('model','')
        if not cfg['model']:raise ValueError('请先配置文字规划模型，AI 审查不会降级为本地规则')
        dossiers=[{k:copy.deepcopy(a[k]) for k in ('id','pictureNumber','name','kind','scope','segmentId','description','sceneLayout','confirmation','vision') if k in a} for a in p.get('assets',[]) if not a.get('deleted')]
        snap={'planId':record['id'],'segments':copy.deepcopy(rows),'assets':dossiers,'intent':copy.deepcopy(p.get('intent')),'script':p.get('script',''),'inputMode':'text-dossiers-only'}
        snap['sourceHash']=hashlib.sha256(json.dumps(rows,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
        row=task_backend.manager(s).add('continuity',{'projectId':p['projectId'],'title':'AI 连续性审查'},cfg,snap)
        return {'id':row['id'],'model':cfg['model'],'inputMode':snap['inputMode']}

def analyze(s,cfg,snapshot,payload):
    import task_backend
    ident=payload.get('_taskId')
    if ident:task_backend.stage(s,ident,'AI 建立人物、地标与逐镜状态并审查')
    raw=snapshot.get('modelResponse')
    if not raw:
        raw=s.ai_call({**cfg,'_outputLimit':cfg.get('reviewOutputTokens') or cfg.get('maxOutputTokens') or 8192},[{'role':'system','content':SYSTEM},{'role':'user','content':json.dumps(snapshot,ensure_ascii=False)}],True)
        if ident:
            m=task_backend.manager(s);saved=copy.deepcopy(snapshot);saved['modelResponse']=raw
            with m.lock:m.store_input(ident,saved);m.patch(ident,outputSaved=True)
    obj=decode(raw)
    for key in ('characters','scenes','states','issues','changes'):
        if not isinstance(obj.get(key),list) or len(obj[key])>500:raise ValueError('AI 审查输出缺少有效 '+key+'；原草稿未修改')
        if any(not isinstance(v,dict) for v in obj[key]):raise ValueError('AI 审查表格格式无效：'+key)
    shots={(i,j):h for i,row in enumerate(snapshot['segments']) for j,h in enumerate(row['shots'])}
    covered=set()
    def target(v):
        i,j=v.get('segment'),v.get('shot')
        if type(i)is not int or type(j)is not int or (i,j)not in shots:raise ValueError('AI 返回不存在的片段或镜头位置')
        return i,j
    for state in obj['states']:
        covered.add(target(state))
        if any(k not in state for k in ('characters','position','facing','posture','heldItems','mainAction','result','camera','uncertainties')):raise ValueError('AI 镜头状态字段不完整；请重试')
    if covered!=set(shots):raise ValueError('AI 未完成全部镜头状态表，请重试或分批审查；未应用任何修改')
    for issue in obj['issues']:target(issue)
    seen=set()
    for change in obj['changes']:
        i,j=target(change);field=change.get('field');key=i,j,field
        if field not in ('action','camera','expression','startState','endState') or key in seen:raise ValueError('AI 建议包含不允许或重复修改的字段')
        seen.add(key)
        if change.get('before')!=shots[i,j].get(field,''):raise ValueError('AI 建议原值不匹配，拒绝应用')
        if not isinstance(change.get('after'),str) or len(change['after'])>20000:raise ValueError('AI 建议字段格式无效')
        allowed=set(re.findall(r'@?<?Picture\s+(\d+)',json.dumps(snapshot,ensure_ascii=False)))|{str(a.get('pictureNumber')) for a in snapshot.get('assets',[]) if a.get('pictureNumber')}
        if set(re.findall(r'@?<?Picture\s+(\d+)',change['after']))-allowed:raise ValueError('AI 建议引入未知素材编号')
    return {**obj,'planId':snapshot['planId'],'sourceHash':snapshot['sourceHash'],'segments':snapshot['segments'],'assets':snapshot['assets'],'model':cfg['model'],'inputMode':'text-dossiers-only','engine':'ai','notice':'实际调用配置的文字模型；依据文字档案，未发送图片或视频。建议须人工确认。'}
