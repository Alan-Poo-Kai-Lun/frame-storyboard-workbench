/* Stable segment IDs keep assets, shot selection and video versions together. */
let segmentDrag=null,segmentUndo=null;
const DIALOGUE_LANGUAGES=['中文（普通话）','马来语（Bahasa Melayu）','英语（English）','粤语','福建话','泰米尔语（தமிழ்）','印地语','日语','韩语','印尼语','泰语','混合语言（按台词）','无对白'];
$('dialogueLanguages').innerHTML=DIALOGUE_LANGUAGES.map(v=>`<option value="${esc(v)}">`).join('');
function syncDialogueLanguage(){
 $('projectDialogueLanguage').value=P?.dialogueLanguage||'';
 $('shotDialogueLanguage').value=shot()?.dialogueLanguage||'';
 $('dialogueLanguageStatus').textContent='当前有效语言：'+(shot()?.dialogueLanguage||P?.dialogueLanguage||'未指定 · 按原台词')+(shot()?.dialogueLanguage?'（镜头指定）':'（项目默认）');
}
function renderSegmentList(){
 const rows=P?.segments||[];
 $('segments').innerHTML=rows.map((s,i)=>`<article class="segmentRow ${i===segIndex?'active':''}" data-segment-row="${esc(s.id)}"><button class="segment ${i===segIndex?'active':''}" data-seg="${i}" aria-label="选择${esc(s.title)}"><span class="num">${String(i+1).padStart(2,'0')}</span><span><b>${esc(s.title)}</b><small>${s.duration.toFixed(1)} SEC · ${s.shots.length} 镜头 ${s.continuity?'· 衔接':''}</small></span></button><div class="segmentActions"><button draggable="true" data-segment-drag="${esc(s.id)}" title="拖动排序" aria-label="拖动${esc(s.title)}排序">⠿</button><button data-segment-command="up" data-segment-id="${esc(s.id)}" title="前移" ${i===0?'disabled':''}>↑</button><button data-segment-command="down" data-segment-id="${esc(s.id)}" title="后移" ${i===rows.length-1?'disabled':''}>↓</button><button class="danger" data-segment-command="delete" data-segment-id="${esc(s.id)}" aria-label="删除${esc(s.title)}">删除</button></div></article>`).join('')||'<p class="muted">暂无片段，点击 ＋ 新建片段。</p>';
 $('undoDeleteSegment').hidden=!segmentUndo||segmentUndo.projectId!==P?.projectId;
}
function keepSegmentSelection(id,oldShot){
 const index=P.segments.findIndex(s=>s.id===id);segIndex=index<0?Math.min(segIndex,Math.max(0,P.segments.length-1)):index;
 shotId=seg()?.shots.some(h=>h.id===oldShot)?oldShot:seg()?.shots[0]?.id||'';
 if(P.segments.length)P.segments[0].continuity=false;
}
async function moveSegment(id,targetId,after=false){
 if(!P||id===targetId)return;const source=P.segments.find(s=>s.id===id),target=P.segments.find(s=>s.id===targetId);if(!source||!target)return;
 const selected=seg()?.id,oldShot=shotId;P.segments.splice(P.segments.indexOf(source),1);P.segments.splice(P.segments.indexOf(target)+(after?1:0),0,source);
 keepSegmentSelection(selected,oldShot);changed();render();await flush();toast('已调整片段顺序；素材与版本继续跟随原片段');
}
function deleteSegmentModal(id){
 const source=P?.segments.find(s=>s.id===id);if(!source)return;
 const pid=P.projectId,assets=P.assets.filter(a=>a.scope==='segment'&&a.segmentId===id);
 modal('删除片段 · '+source.title,`<p>将删除「${esc(source.title)}」及 ${source.shots.length} 个镜头，移除 ${assets.length} 张本组素材卡片。</p><p class="notice">公共素材和图片 / 视频文件保留。本段等待或执行中的工作台任务会停止跟踪；ComfyUI 远端任务可能继续生成。可在左侧撤销最近一次删除（本次页面会话内）。</p>`,[{label:'取消',action:close},{label:'删除此片段',class:'danger',action:async()=>{
  if(P?.projectId!==pid)throw Error('项目已切换');await flush();
  const r=await api('tasks'),shotIds=new Set(source.shots.map(h=>h.id));
  for(const row of r.tasks||[])if(row.projectId===pid&&(row.segmentId===id||shotIds.has(row.shotId))&&['waiting','running'].includes(row.status))await api('task-action',{id:row.id,action:'cancel'});
  if(P?.projectId!==pid)throw Error('项目已切换');
  const index=P.segments.findIndex(s=>s.id===id);if(index<0)throw Error('片段已删除');
  segmentUndo={projectId:pid,segment:structuredClone(P.segments[index]),index,assets:P.assets.map((a,i)=>({asset:a,index:i})).filter(x=>x.asset.scope==='segment'&&x.asset.segmentId===id),continuity:P.segments.map(s=>({id:s.id,value:s.continuity}))};
  const selected=seg()?.id,oldShot=shotId;P.segments.splice(index,1);P.assets=P.assets.filter(a=>a.scope!=='segment'||a.segmentId!==id);
  if(P.groupAssetsCollapsed)delete P.groupAssetsCollapsed[id];
  keepSegmentSelection(selected===id?P.segments[Math.min(index,P.segments.length-1)]?.id:selected,oldShot);changed();close();render();await flush();toast('已删除片段；左侧可撤销最近一次删除');
 }}]);
}
$('undoDeleteSegment').onclick=()=>safe(async()=>{
 const backup=segmentUndo;if(!backup||P?.projectId!==backup.projectId)throw Error('没有可撤销的删除');
 if(P.segments.some(s=>s.id===backup.segment.id))throw Error('片段已存在');
 P.segments.splice(Math.min(backup.index,P.segments.length),0,backup.segment);
 for(const x of backup.assets)if(!P.assets.some(a=>a.id===x.asset.id))P.assets.splice(Math.min(x.index,P.assets.length),0,x.asset);
 for(const c of backup.continuity){const s=P.segments.find(s=>s.id===c.id);if(s)s.continuity=c.value}
 segIndex=P.segments.findIndex(s=>s.id===backup.segment.id);shotId=seg().shots[0]?.id||'';segmentUndo=null;changed();render();await flush();toast('已恢复片段与本组素材；取消的任务需手动重新提交');
});
$('segments').onclick=e=>safe(async()=>{
 const cmd=e.target.closest('[data-segment-command]');
 if(cmd){const id=cmd.dataset.segmentId,action=cmd.dataset.segmentCommand;if(action==='delete'){deleteSegmentModal(id);return}const i=P.segments.findIndex(s=>s.id===id),j=i+(action==='up'?-1:1);if(i>=0&&j>=0&&j<P.segments.length)await moveSegment(id,P.segments[j].id,action==='down');return}
 const button=e.target.closest('[data-seg]');if(button){const i=Number(button.dataset.seg);if(!P.segments[i])return;segIndex=i;shotId=seg().shots[0]?.id||'';render()}
});
$('segments').ondragstart=e=>{const handle=e.target.closest('[data-segment-drag]');if(!handle)return;segmentDrag={projectId:P.projectId,id:handle.dataset.segmentDrag};e.dataTransfer.setData('application/x-frame-segment',segmentDrag.id);e.dataTransfer.effectAllowed='move'};
$('segments').ondragover=e=>{if(!segmentDrag||segmentDrag.projectId!==P?.projectId)return;const row=e.target.closest('[data-segment-row]');if(row){e.preventDefault();e.dataTransfer.dropEffect='move';document.querySelectorAll('.segmentRow.dropTarget').forEach(el=>el.classList.remove('dropTarget'));row.classList.add('dropTarget')}};
$('segments').ondragend=()=>{segmentDrag=null;document.querySelectorAll('.segmentRow.dropTarget').forEach(el=>el.classList.remove('dropTarget'))};
$('segments').ondrop=e=>safe(async()=>{
 const row=e.target.closest('[data-segment-row]'),drag=segmentDrag;if(!row||!drag||drag.projectId!==P?.projectId)return;e.preventDefault();segmentDrag=null;
 document.querySelectorAll('.segmentRow.dropTarget').forEach(el=>el.classList.remove('dropTarget'));const bounds=row.getBoundingClientRect();await moveSegment(drag.id,row.dataset.segmentRow,e.clientY>=bounds.top+bounds.height/2);
});
function cleanDialogueLanguage(value){const text=String(value||'').trim();if(text.length>120||/[\r\n\x00-\x1f]/.test(text))throw Error('对白语言请填写 120 字内的单行名称');return text}
$('projectDialogueLanguage').onchange=()=>safe(async()=>{
 if(!ready)return;if(!P)ensure();const project=P,pid=P.projectId,language=cleanDialogueLanguage($('projectDialogueLanguage').value),results=[];
 for(const s of project.segments){const refs=availableAssets(s).map(a=>({index:assetNumber(a),name:a.name,kind:a.kind,description:a.description||''}));results.push([s,(await api('rebuild',{...s,defaultDialogueLanguage:language,assetReferences:refs})).prompt])}
 if(P!==project||P.projectId!==pid)throw Error('项目已切换，语言未应用');P.dialogueLanguage=language;for(const [s,text] of results)s.prompt=text;changed();render();await flush();toast('已保存项目默认对白语言；已有台词保持原文');
});
$('shotDialogueLanguage').onchange=()=>safe(async()=>{if(!shot())return;shot().dialogueLanguage=cleanDialogueLanguage($('shotDialogueLanguage').value);await edited();await flush()});
if(ready){renderSegmentList();syncDialogueLanguage()}
