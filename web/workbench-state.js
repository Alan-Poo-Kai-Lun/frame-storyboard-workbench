/* Visible planning progress, durable choices and segment-owned story history. */
let storyEditOwner='',storyTimer,currentPlanningId='',connectionRestored=false;
function currentStory(){return seg()?.storyText??P?.script??''}
function initSegmentStories(){
 if(!P||P.storySeparated)return;
 for(const s of P.segments){s.storyText=s.storyText??(s.id===seg()?.id?P.script||'':'');s.storyHistory=s.storyHistory||[]}
 P.storySeparated=true;changed();
}
function recordStory(segment,reason='编辑保存',text=segment?.storyText??''){
 if(!segment||!String(text).trim())return;
 segment.storyHistory=segment.storyHistory||[];if(segment.storyHistory.at(-1)?.text===text)return;
 segment.storyHistory.push({id:newId(),createdAt:new Date().toISOString(),reason,text});segment.storyHistory=segment.storyHistory.slice(-100);changed();
}
function syncWorkbenchState(){
 if(!connectionRestored){$('connection').textContent=cfg.ai?.model?'已读取 AI 设置 · '+cfg.ai.model:'请首次配置 AI 连接';connectionRestored=true}
 initSegmentStories();if(!P)return;
 if(seg()){seg().storyText=seg().storyText??'';if(P.script!==seg().storyText){P.script=seg().storyText;changed()}$('script').value=workspaceText(seg().storyText,true)}
 $('storyHistory').textContent='本片段故事历史 ('+(seg()?.storyHistory?.length||0)+')';
 $('segmentListBody').hidden=!!cfg.ui?.segmentsCollapsed;$('toggleSegments').textContent=(cfg.ui?.segmentsCollapsed?'展开':'折叠')+' ('+(P.segments.length||0)+')';
 syncAIStatus();if(typeof refreshMentionEditors==='function')refreshMentionEditors();
}
async function saveUIPreference(key,value){await api('settings-patch',{ui:{[key]:value}});cfg.ui={...cfg.ui,[key]:value}}
$('toggleSegments').onclick=()=>safe(async()=>{await saveUIPreference('segmentsCollapsed',!cfg.ui?.segmentsCollapsed);syncWorkbenchState()});
$('storyHistory').onclick=()=>{ensure();initSegmentStories();recordStory(seg(),'查看历史前');showStoryHistory(seg().id)};
$('script').oninput=()=>{
 ensure();initSegmentStories();const owner=seg(),pid=P.projectId;
 if(storyEditOwner!==pid+':'+owner.id){recordStory(owner,'编辑前');storyEditOwner=pid+':'+owner.id}
 owner.storyText=storedWorkspaceText($('script').value);P.script=owner.storyText;changed();
 clearTimeout(storyTimer);storyTimer=setTimeout(()=>{if(P?.projectId===pid&&P.segments.includes(owner)){recordStory(owner,'编辑保存');$('storyHistory').textContent='本片段故事历史 ('+(seg()?.storyHistory?.length||0)+')'}},1500);
};
$('script').onchange=()=>{if(seg()){recordStory(seg(),'编辑保存');storyEditOwner=''}};
function showStoryHistory(segmentId){
 const owner=P.segments.find(s=>s.id===segmentId);if(!owner)return;const pid=P.projectId;const history=(owner.storyHistory||[]).slice().reverse();
 modal('故事历史 · '+owner.title,`<p class="notice">每个片段分别记录原文；编辑保存和 AI 拆镜前自动留档，最多保留最近 100 版。旧版只有全局故事，升级前未记录的内容无法补回。</p><p id="storyHistoryError" class="warning" hidden></p><div>${history.map((v,i)=>`<details ${i===0?'open':''}><summary>${esc(new Date(v.createdAt).toLocaleString())} · ${esc(v.reason)}</summary><textarea rows="7" readonly>${esc(workspaceText(v.text,true))}</textarea><div class="row"><button data-story-copy="${esc(v.id)}">复制原文</button><button data-story-restore="${esc(v.id)}">恢复到本片段</button></div></details>`).join('')||'<p class="muted">暂无历史；填写故事后会自动记录。</p>'}</div>`,[{label:'关闭',action:close}]);
 $('modalBody').onclick=async e=>{try{const copy=e.target.closest('[data-story-copy]'),restore=e.target.closest('[data-story-restore]');if(!copy&&!restore)return;if(P?.projectId!==pid||!P.segments.includes(owner))throw Error('项目或原片段已切换');const v=owner.storyHistory.find(v=>v.id===(copy?.dataset.storyCopy||restore?.dataset.storyRestore));if(!v)throw Error('历史版本不存在');if(copy){await navigator.clipboard.writeText(workspaceText(v.text,true));toast('已复制故事原文');return}recordStory(owner,'恢复前');owner.storyText=v.text;recordStory(owner,'恢复历史');if(seg()?.id===owner.id)P.script=v.text;changed();await flush();close();render();toast('已恢复本片段故事；现有分镜保持不变')}catch(e){$('storyHistoryError').hidden=false;$('storyHistoryError').textContent=e.message}};
}
function syncAIStatus(){
 const rows=typeof taskRows==='undefined'?[]:taskRows;
 const active=rows.find(r=>r.type==='planning'&&r.projectId===P?.projectId&&r.segmentId===seg()?.id&&['waiting','running'].includes(r.status));
 const latest=active||rows.filter(r=>r.type==='planning'&&r.projectId===P?.projectId&&r.segmentId===seg()?.id).at(-1);currentPlanningId=latest?.id||'';
 $('aiSplit').disabled=$('aiEdit').disabled=!!active;$('aiSplit').textContent=active?'拆镜进行中…':'AI 拆镜';$('aiProgress').hidden=!active;$('viewPlanning').hidden=!latest;
 if(!latest){$('aiStatus').textContent='AI 拆镜尚未提交';return}
 const elapsed=latest.startedMs?Math.max(0,Math.floor(((latest.finishedMs||Date.now())-latest.startedMs)/1000)):0;
 $('aiStatus').textContent=(latest.status==='waiting'?(tasksPaused?'已排队 · 队列暂停，请在任务中心继续队列':'已排队 · 等待前面的任务'):latest.status==='running'?(latest.stage||'AI 正在运行')+' · 总计 '+elapsed+' 秒 · '+taskProgressText(latest):latest.status==='done'?'文字分镜完成 · 预览后应用':(TASK_LABELS[latest.status]||latest.status)+'：'+(latest.error||latest.stage||''));
}
$('viewPlanning').onclick=()=>{const row=taskRows.find(r=>r.id===currentPlanningId);if(row?.status==='done')viewPlanningTask(row.id);else if(row)showTaskDetail(row.id)};
function viewPlanningTask(id){
 const row=taskRows.find(r=>r.id===id);if(!row?.result)return;const shots=row.result.shots,refs=row.result.refNumbers||[];let reviewedSourceSignature='';taskCenterOpen=false;
 modal('AI 分镜预览 · '+row.title,`<p class="notice">来自 ${esc(taskLocation(row))}。应用将替换原片段分镜并重新组装 H3 提示词；旧提示词会留档，不会自动生成图片。故事原文保留在片段历史。</p>${row.result.dossiers?.length?`<p class="notice">已准备 ${row.result.dossiers.length} 张素材说明。</p>`:''}<p class="notice">${row.result.smartRepair?'智能修复结果（应用前核对）':row.result.mode==='review'?'可选深度审查结果':'一次文字生成，未运行深度审查'}；本任务不读取图片。</p><p class="notice">${esc(row.result.summary||'')}</p>${(row.result.warnings||[]).map(w=>`<p class="warning">${esc(w)}</p>`).join('')}<p id="planningError" class="warning" hidden></p><div class="previewShots">${shots.map((sh,i)=>`<article><b>SHOT ${i+1} / ${sh.start}–${sh.end}s</b>${esc(sh.action)}<div class="muted">${esc(sh.camera)}</div><p>${esc(sh.dialogue||'')}</p><details><summary>起止空间状态</summary><p>起始：${esc(sh.startState||'未记录')}</p><p>结束：${esc(sh.endState||'未记录')}</p></details></article>`).join('')}</div>`,[{label:'返回任务中心',action:openTaskCenter},{label:row.result.issues?.some(i=>i.severity==='error')?'保存草稿后修复':'应用分镜',class:'primary',action:async()=>{try{
  await flush();const check=await api('planning-application-check',{id});if(check.canApply===false)throw Error((check.differences||[]).join('；'));if(check.matched===false&&reviewedSourceSignature!==check.currentSignature){reviewedSourceSignature=check.currentSignature;$('planningError').hidden=false;$('planningError').textContent='来源变化：'+(check.differences||[]).join('；')+'。请对照当前剧本核对下方结果。再次点击“核对后应用已有结果”会替换当前分镜；剧本、素材和视频保持当前内容，旧镜头可撤销恢复，无需重新推理。';$('modalActions').children[$('modalActions').children.length-1].textContent='核对后应用已有结果';return}const result=await api('apply-planning',{id,...(check.matched===false?{reviewedSourceSignature}: {})});P=result.project;dirty=false;segIndex=P.segments.findIndex(v=>v.id===row.segmentId);shotId=seg().shots[0]?.id||'';close();render();toast(result.message)
 }catch(e){$('planningError').hidden=false;$('planningError').textContent=e.message}}}]);
}
$('unloadAllAI').onclick=()=>safe(async()=>{
 const button=$('unloadAllAI');button.disabled=true;$('modelUnloadStatus').textContent='正在暂停队列；等待当前操作结束后卸载 Ollama 模型…';
 try{const r=await api('unload-all',{});tasksPaused=true;$('modelUnloadStatus').textContent=r.message;await pollTasks()}catch(e){$('modelUnloadStatus').textContent='卸载失败：'+e.message+'；请检查 Ollama 服务和队列状态'}finally{button.disabled=false}
});
if(ready)syncWorkbenchState();
