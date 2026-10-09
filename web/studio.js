const PROFESSIONAL={size:{label:'景别',options:['特写','近景','中景','全景','远景','大远景']},angle:{label:'机位',options:['平视','俯视','仰视','越肩','主观视角']},composition:{label:'构图',options:['三分法','中心构图','对称构图','黄金分割','留白构图']},lighting:{label:'光线',options:['自然光','柔光','侧光','逆光','顶光','电影布光']},palette:{label:'色调',options:['自然色','暖色调','冷色调','高对比度','低饱和度']},movement:{label:'运镜',options:['固定机位','缓慢推进','缓慢拉远','横移','跟拍','摇镜','环绕','升降']},lens:{label:'焦段',options:['广角','标准焦段','中长焦','长焦']},depth:{label:'景深',options:['浅景深','深景深']}};
function professionalText(sh){return Object.entries(PROFESSIONAL).filter(([key])=>sh?.professional?.[key]).map(([key,p])=>p.label+'：'+sh.professional[key]).join('；')}
function renderProfessionalEditor(sh){
 $('professionalFields').innerHTML=Object.entries(PROFESSIONAL).map(([key,p])=>`<label for="pro_${key}"><span class="referenceEntry">${p.label}<button type="button" id="proReference_${key}" title="查看${p.label}图示">图示</button></span><input id="pro_${key}" list="proOptions_${key}" value="${esc(sh?.professional?.[key]||'')}" placeholder="未指定 / 自定义"><datalist id="proOptions_${key}">${p.options.map(t=>`<option value="${esc(t)}">`).join('')}</datalist></label>`).join('');
 $('professionalSummary').textContent=sh?professionalText(sh)||'未指定的参数沿用原提示词。':'选择镜头后设置参数';
 for(const key of Object.keys(PROFESSIONAL))$('proReference_'+key).onclick=()=>safe(()=>openVisualReference(key));
 for(const key of Object.keys(PROFESSIONAL))$('pro_'+key).onchange=()=>safe(async()=>{if(!shot())return;shot().professional||={};shot().professional[key]=$('pro_'+key).value.trim();await edited()});
}
$('creativeIntent').onclick=()=>{ensure();const intent=P.intent||{};modal('创作意图',`<p class="muted">用于 AI 拆镜和图片解析。保留已经确定的剧情、角色及指定台词。</p>${Object.entries({goal:'创作目标',audience:'目标受众',tone:'视频基调',keyMessage:'关键信息'}).map(([key,label])=>`<label>${label}<textarea id="intent_${key}" rows="2">${esc(intent[key]||'')}</textarea></label>`).join('')}`,[{label:'保存',class:'primary',action:async()=>{P.intent=Object.fromEntries(['goal','audience','tone','keyMessage'].map(k=>[k,$('intent_'+k).value.trim()]));changed();await flush();close();toast('创作意图已保存')}}])};
async function analysisModal(single=false){
 ensure();if(!seg().shots.length)throw Error('先添加镜头');const pid=P.projectId,sid=seg().id,ids=single?[shot()?.id]:seg().shots.map(h=>h.id);
 modal(single?'AI 解析当前镜头':'AI 解析本片段镜头',`<p class="notice">解析镜头图片或首尾帧，需要支持图片输入的视觉模型。只有文本能力的模型不能识别图片。解析不会自动覆盖，完成后在任务中心预览并应用。</p><label>视觉模型<input id="analysisModel" list="analysisModels" value="${esc(cfg.ui?.analysisModel||cfg.ai?.model||'')}" placeholder="填写已安装的视觉模型"></label><datalist id="analysisModels"></datalist><label>应用策略<select id="analysisStrategy"><option value="overwrite">覆盖描述与镜头参数</option><option value="append">追加描述，保留已有参数</option><option value="skip">跳过已有动作描述的镜头</option></select></label><small>没有镜头图片或首尾帧的镜头会跳过。保留原时长、台词和素材编号。</small>`,[{label:'加入解析队列',class:'primary',action:async()=>{if(P.projectId!==pid)throw Error('项目已切换');await flush();const r=await api('analyze-shots',{projectId:pid,segmentId:sid,shotIds:ids,model:$('analysisModel').value,strategy:$('analysisStrategy').value});close();toast('已排队 '+r.ids.length+' 个解析任务，跳过 '+r.skipped.length+' 个无图片或已有描述的镜头');openTaskCenter()}}]);
 $('analysisModel').onchange=()=>safe(()=>saveUIPreference('analysisModel',$('analysisModel').value.trim()));
 if(cfg.ai?.provider==='ollama')try{const r=await api('models',cfg.ai);if($('analysisModels'))$('analysisModels').innerHTML=r.models.map(m=>`<option value="${esc(m.name)}">`).join('')}catch(e){toast('模型列表读取失败，可手动填写模型名称：'+e.message)}
}
$('analyzeSegment').onclick=()=>safe(()=>analysisModal());$('analyzeShot').onclick=()=>safe(()=>analysisModal(true));
const TASK_LABELS={waiting:'等待',running:'执行中',done:'完成',error:'失败',cancelled:'取消',interrupted:'服务中断'};
let taskRows=[],tasksPaused=false,taskTimer,taskLoading=false,taskCenterOpen=false,seenImageTasks=new Set(),taskRenderPending=false;
function refreshTaskResults(){
 if(!taskRenderPending||document.activeElement?.matches?.('input,textarea,[contenteditable="true"]'))return;
 taskRenderPending=false;render();
}
document.addEventListener('focusout',()=>setTimeout(refreshTaskResults,0));
function taskProgressText(row){
 const at=row.finishedMs||Date.now(),seconds=row.stageStartedMs?Math.max(0,Math.floor((at-row.stageStartedMs)/1000)):0;
 const generating=row.outputChars||row.thinkingChars;
 const live=row.status==='running'?'本步 '+seconds+' 秒 · '+(row.activity||'正在处理')+(row.requestStartedMs&&!row.firstTokenMs?' · 尚未收到首个输出':''):'';
 const output=generating?'输出 '+(row.outputChars||0)+' 字'+(row.thinkingChars?' · 思考 '+row.thinkingChars+' 字':''):'';
 return [live,output,row.thinkingControl||'',row.generatedTokens?'模型报告 '+row.generatedTokens+' tokens':''].filter(Boolean).join(' · ');
}
function taskTimestamp(row,key){
 const ms=row[key+'Ms'];if(Number.isFinite(ms))return ms;
 const text=row[key+'At'];if(!text)return null;const n=Date.parse(text.replace(' ','T'));return Number.isFinite(n)?n:null;
}
function taskDuration(ms){if(ms==null)return '未记录';const sec=Math.max(0,Math.floor(ms/1000));return sec>=3600?Math.floor(sec/3600)+' 小时 '+Math.floor(sec%3600/60)+' 分 '+sec%60+' 秒':sec>=60?Math.floor(sec/60)+' 分 '+sec%60+' 秒':sec+' 秒'}
function taskTiming(row){
 const created=taskTimestamp(row,'created'),started=taskTimestamp(row,'started'),finished=taskTimestamp(row,'finished');
 const active=['waiting','running'].includes(row.status),end=finished??(active?Date.now():null),origin=created??started;
 const total=origin!=null&&end!=null?end-origin:null,execution=started!=null&&end!=null?end-started:null;
 const format=(key,fallback)=>row[key+'At']||(taskTimestamp(row,key)!=null?new Date(taskTimestamp(row,key)).toLocaleString():fallback);
 return `<div class="taskTiming"><span><b>总耗时</b> ${esc(taskDuration(total))}</span><span><b>执行</b> ${esc(taskDuration(execution))}</span><span><b>开始</b> ${esc(format('started',row.status==='waiting'?'等待执行':'未记录'))}</span><span><b>完成</b> ${esc(format('finished',active?'尚未完成':'未记录'))}</span></div>`;
}
function taskStageHistory(row){return (row.stageHistory||[]).map(step=>'<li>'+esc(step.label)+' · '+(step.elapsedSeconds??Math.max(0,Math.floor(((row.finishedMs||Date.now())-step.startedMs)/1000)))+' 秒'+(step.outputChars?' · 输出 '+step.outputChars+' 字':'')+(step.loadSeconds?' · 模型加载 '+step.loadSeconds+' 秒':'')+'</li>').join('')}
function renderTaskCenter(){
 if(!taskCenterOpen||!$('taskRows'))return;const filter=$('taskFilter').value,rows=taskRows.filter(r=>filter==='all'||filter==='active'&&['waiting','running'].includes(r.status)||r.status===filter);
 $('taskQueueState').textContent=tasksPaused?'队列已暂停；当前任务继续执行':'串行执行 · 同时 1 个任务';$('pauseQueue').textContent=tasksPaused?'继续队列':'暂停队列';
 if($('clearDoneTasks')){$('clearDoneTasks').disabled=!taskRows.some(r=>r.status==='done');$('clearDoneTasks').textContent='清理完成任务 ('+taskRows.filter(r=>r.status==='done').length+')'}
 $('taskRows').innerHTML=rows.slice().reverse().map(r=>`<article class="taskRow"><div class="taskRowHead"><b>${esc(r.title)}</b><span class="taskStatus ${r.status}">${TASK_LABELS[r.status]||esc(r.status)}</span></div><small>${esc(r.projectTitle)} · ${esc(taskLocation(r))} · ${esc(r.createdAt)}</small><p>${esc(r.stage||'')}${r.cancelRequested?'（已请求停止）':''}</p>${taskTiming(r)}<p class="muted">${esc(taskProgressText(r))}</p>${r.stageHistory?.length?`<details><summary>每一步耗时</summary><ul>${taskStageHistory(r)}</ul></details>`:''}${r.cleanupError?`<p class="warning">${esc(r.cleanupError)}</p>`:''}${r.error?'<p class="taskError">'+esc(r.error)+'</p>':''}<div class="row"><button data-task-detail="${esc(r.id)}">查看任务</button>${['planning','analysis','reverse','assets'].includes(r.type)?`<button data-task-jump="${esc(r.id)}">跳转到工作台</button>${r.status==='done'?`<button data-task-result="${esc(r.id)}">查看结果</button>`:''}${['waiting','running'].includes(r.status)?`<button data-task-action="cancel" data-task-id="${esc(r.id)}">${r.status==='waiting'?'取消排队':'停止跟踪'}</button>`:''}${['error','cancelled','interrupted'].includes(r.status)?`<button data-task-action="retry" data-task-id="${esc(r.id)}">${r.type==='planning'&&r.outputSaved?'重新解析已有输出':'重试'}</button>${r.type==='planning'&&r.outputSaved?`<button data-task-action="regenerate" data-task-id="${esc(r.id)}">重新推理</button>`:''}`:''}`:'<small>旧生成模块已移除，记录仅供查阅</small>'}${['done','error','cancelled','interrupted'].includes(r.status)?`<button data-task-action="delete" data-task-id="${esc(r.id)}">删除记录</button>`:''}</div></article>`).join('')||'<p class="muted">没有符合条件的任务。</p>';
}
async function pollTasks(){
 if(!ready||taskLoading)return;taskLoading=true;
 try{
 const r=await api('tasks');taskRows=r.tasks;tasksPaused=r.paused;if(typeof consumePreparationTasks==='function')await consumePreparationTasks(taskRows);if(typeof consumeReverseTasks==='function')consumeReverseTasks(taskRows);if(typeof syncAIStatus==='function')syncAIStatus();$('taskCount').textContent=taskRows.filter(r=>['waiting','running'].includes(r.status)).length;
 const running=taskRows.find(r=>r.status==='running'),waiting=taskRows.filter(r=>r.status==='waiting').length;
 $('jobStatus').textContent=running?'正在执行：'+({analysis:'镜头解析',reverse:'提示词反推',planning:'AI 拆镜 / 调整',assets:'素材视觉分析'}[running.type]||running.type):tasksPaused?'任务队列已暂停':waiting?'等待队列：'+waiting+' 个任务':'任务队列空闲';
 refreshTaskResults();renderTaskCenter();
 }catch(e){if(taskCenterOpen)toast(e.message)}finally{taskLoading=false;clearTimeout(taskTimer);taskTimer=setTimeout(()=>pollTasks(),taskRows.some(r=>r.status==='running')?1500:4000)}
}
function syncStudioPanel(){if(!taskTimer)pollTasks()}
function openTaskCenter(){
 modal('任务中心',`<div class="row taskToolbar"><b id="taskQueueState">串行执行</b><button id="pauseQueue">暂停队列</button><button id="refreshTasks">刷新</button><button id="clearDoneTasks">一键清理完成任务</button><select id="taskFilter"><option value="all">全部任务</option><option value="active">等待 / 执行中</option><option value="done">完成</option><option value="error">失败</option><option value="cancelled">取消</option><option value="interrupted">中断</option></select></div><p class="muted">显示各项目任务。暂停只停止领取后续任务。执行中的远端请求可能继续运行；拆镜和解析结果须预览确认后应用。总耗时含排队等待；执行耗时从开始运行计算。清理完成任务会删除完成记录及其未应用结果，项目素材、已应用分镜和故事历史保留。</p><p id="taskCenterError" class="warning" role="alert" hidden></p><div id="taskRows" class="taskRows"></div>`);taskCenterOpen=true;
 $('clearDoneTasks').onclick=()=>safe(async()=>{await flush();const r=await api('task-action',{action:'clear_done'});taskRows=r.tasks;tasksPaused=r.paused;renderTaskCenter();toast('已清理 '+r.removedCount+' 个完成任务');await pollTasks()});
 $('taskFilter').onchange=renderTaskCenter;$('refreshTasks').onclick=()=>safe(pollTasks);$('pauseQueue').onclick=()=>safe(async()=>{await api('task-action',{action:tasksPaused?'resume':'pause'});await pollTasks()});
 $('taskRows').onclick=e=>safe(async()=>{try{const detail=e.target.closest('[data-task-detail]');if(detail){showTaskDetail(detail.dataset.taskDetail);return}const jump=e.target.closest('[data-task-jump]');if(jump){await jumpToTask(jump.dataset.taskJump);return}const result=e.target.closest('[data-task-result]');if(result){await viewTaskResult(result.dataset.taskResult);return}const button=e.target.closest('[data-task-action]');if(!button)return;await api('task-action',{id:button.dataset.taskId,action:button.dataset.taskAction});await pollTasks()}catch(error){$('taskCenterError').hidden=false;$('taskCenterError').textContent=error.message}});renderTaskCenter();pollTasks();
}

function taskLocation(row){
 if(row.projectId!==P?.projectId)return '其他项目：'+(row.projectTitle||'未命名项目');
 const segment=P.segments.find(s=>s.id===row.segmentId),h=segment?.shots.find(h=>h.id===row.shotId);
 return segment?segment.title+(row.shotId?(h?' · 镜头 '+String(segment.shots.indexOf(h)+1).padStart(2,'0'):' · 原镜头已删除'):' · 片段任务'):'原片段已删除或未记录位置';
}
async function jumpToTask(id){
 const row=taskRows.find(r=>r.id===id);if(!row)throw Error('任务记录不存在');
 if(!['planning','analysis','reverse','assets'].includes(row.type))throw Error('该生成模块已移除，旧任务记录保留');
 if(row.projectId!==P?.projectId)throw Error('请先打开任务原项目“'+(row.projectTitle||'未命名项目')+'”，再跳转；当前项目保持不变');
 const index=P.segments.findIndex(s=>s.id===row.segmentId);if(index<0)throw Error('原片段已删除或未记录位置，仍可查看任务详情与保留的结果');
 const target=P.segments[index],h=target.shots.find(h=>h.id===row.shotId);if(row.shotId&&!h)throw Error('原镜头已删除，仍可查看任务详情与保留的结果');
 await flush();if(row.projectId!==P?.projectId||!P.segments.includes(target))throw Error('项目或片段已改变，请重试');
 segIndex=P.segments.indexOf(target);shotId=h?.id||target.shots[0]?.id||'';close();render();
 if(row.type==='assets'&&row.status==='done'){viewAssetTask(id);return}
 if(row.type==='planning'&&row.status==='done'){viewPlanningTask(id);return}
 const panel=row.type==='reverse'?'reversePanel':'boardPanel';if($(panel)){$(panel).open=true;$(panel).scrollIntoView?.({behavior:'smooth',block:'start'})}
 if(row.type==='reverse'&&row.status==='done')viewReverseTask(id);
 toast('已定位：'+taskLocation(row));
}
function showTaskDetail(id){
 const row=taskRows.find(r=>r.id===id);if(!row)return;taskCenterOpen=false;
 modal('任务详情 · '+row.title,`<p><b>${esc(TASK_LABELS[row.status]||row.status)}</b> · ${esc(taskLocation(row))}</p><p>${esc(row.stage||'')}</p>${taskTiming(row)}<p class="muted">${esc(taskProgressText(row))}</p><ul>${taskStageHistory(row)}</ul>${row.cleanupError?`<p class="warning">${esc(row.cleanupError)}</p>`:''}${row.error?'<p class="warning">'+esc(row.error)+'</p>':''}${row.outputSaved?'<p class="notice">模型完整输出已保存。若来源未变，任务中心“重新解析已有输出”不会再次调用模型。</p>':''}<p class="muted">创建：${esc(row.createdAt)}${row.startedAt?' · 开始：'+esc(row.startedAt):''}${row.finishedAt?' · 结束：'+esc(row.finishedAt):''}</p><p id="taskDetailError" class="warning" role="alert" hidden></p><small>跳转会定位原片段 / 镜头；不会重试任务、覆盖提示词或提交新任务。</small>`,[
  {label:'返回任务中心',action:openTaskCenter},
  ...(['planning','analysis','reverse','assets'].includes(row.type)&&row.status==='done'&&row.result?[{label:'查看结果',action:async()=>{try{await viewTaskResult(id)}catch(e){$('taskDetailError').hidden=false;$('taskDetailError').textContent=e.message}}}]:[]),
  {label:'跳转到工作台',class:'primary',action:async()=>{try{await jumpToTask(id)}catch(e){$('taskDetailError').hidden=false;$('taskDetailError').textContent=e.message}}}
 ]);
}
async function viewTaskResult(id){const row=taskRows.find(r=>r.id===id);if(!row?.result)return;if(row.type==='assets')viewAssetTask(id);else if(row.type==='planning')viewPlanningTask(id);else if(row.type==='analysis')showAnalysis(id);else if(row.type==='reverse'){await jumpToTask(id)}else throw Error('该生成模块已移除，旧任务记录保留')}
function showAnalysis(id){
 const row=taskRows.find(r=>r.id===id),result=row?.result;if(!result)return;
 modal('解析预览 · '+row.title,`${row.projectId===P?.projectId?'<div class="framePreview">'+(result.sourceImages||[]).map(imgTag).join('')+'</div>':''}<p class="notice">只分析图片中可见的内容。实际运镜、声音和精确焦段可能无法由静态图确认。应用后保留已有 @Picture 绑定；图片已替换时需重新解析。</p>${['action','camera','expression','sound'].map(k=>`<label>${{action:'动作描述',camera:'摄影机',expression:'表情',sound:'声音'}[k]}<p class="analysisText">${esc(result[k]||'未判断')}</p></label>`).join('')}<p>专业参数：${esc(professionalText(result))||'未判断'}</p><p class="warning">不确定项：${esc(result.uncertainties||'模型未列出，仍需检查')}</p><label>应用方式<select id="applyAnalysisStrategy"><option value="overwrite">覆盖描述与参数</option><option value="append">追加描述，保留已有参数</option><option value="skip">已有描述则跳过</option></select></label>`,[{label:'返回任务中心',action:openTaskCenter},{label:'应用到原镜头',class:'primary',action:async()=>{if(P.projectId!==row.projectId)throw Error('先打开原项目再应用');await flush();const r=await api('apply-analysis',{id,strategy:$('applyAnalysisStrategy').value});P=r.project;render();toast(r.message);openTaskCenter()}}]);$('applyAnalysisStrategy').value=row.strategy||'overwrite';taskCenterOpen=false;
}
$('taskCenter').onclick=openTaskCenter;
const originalStudioClose=close;close=function(){taskCenterOpen=false;originalStudioClose()};$('closeModal').onclick=close;
syncStudioPanel();
