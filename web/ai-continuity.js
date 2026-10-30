/* Dedicated model review workspace. One primary scroll container; no nested planning form. */
(function(){
 const labels={summary:'审查摘要',characters:'人物身份表',scenes:'场景地标表',states:'逐镜状态表',changes:'修改对比'};
 const columns={characters:{reference:'素材引用',name:'人物',identity:'身份特征',wardrobe:'服装',equipment:'装备／持物',uncertainties:'待确认'},scenes:{reference:'素材引用',name:'场景',landmarks:'固定地标',axis:'机位与轴线',uncertainties:'待确认'},states:{segment:'片段',shot:'镜头',characters:'人物',position:'位置',facing:'朝向',posture:'姿态',heldItems:'持物',mainAction:'主要动作',result:'动作结果',camera:'摄影机',uncertainties:'待确认'}};
 const text=v=>typeof v==='object'?JSON.stringify(v,null,2):String(v??'UNKNOWN');
 function workspace(options={}){
  const dialog=document.createElement('dialog');dialog.className='aiReviewWorkspace';dialog.innerHTML='<header><h2>AI 连续性审查</h2><button data-ai-close>关闭</button></header><p data-ai-status role="status"></p><nav data-ai-tabs></nav><main data-ai-body></main><footer><button data-ai-start>开始 AI 审查</button><button data-ai-export disabled>导出审查结果</button><button data-ai-apply disabled>应用勾选建议到草稿</button></footer>';
  document.body.append(dialog);dialog.showModal();const q=s=>dialog.querySelector(s);let result=null,tab='summary',timer=0,closed=false,taskId='',active=0;const selected=new Set(),drafts=new Map();
  const status=t=>q('[data-ai-status]').textContent=t;
  function tabs(){q('[data-ai-tabs]').innerHTML=Object.entries(labels).map(([k,v])=>`<button data-ai-tab="${k}" aria-pressed="${tab===k}">${v}</button>`).join('')}
  function draw(){tabs();const body=q('[data-ai-body]');body.scrollTop=0;
   if(!result){body.innerHTML='<p>AI 将读取完整规划、人物说明、场景地标与布局，建立逐镜状态并给出局部修改建议。</p><p>使用已配置的文字审查／规划模型。仅发送文字档案，不发送图片或视频；未知信息须保留待确认。不会自动改动画布或原规划。</p>';return}
   if(tab==='summary'){body.innerHTML=`<p>${esc(result.summary||'AI 未提供摘要')}</p>${result.issues.map(v=>`<article><strong>片段 ${v.segment+1} · 镜头 ${v.shot+1} · ${esc(v.category||'连续性')}</strong><p>证据：${esc(text(v.evidence))}</p><p>原因：${esc(text(v.reason))}</p><p>建议：${esc(text(v.suggestion))}</p></article>`).join('')||'<p>AI 未列出问题，仍需核对实际成片。</p>'}`;return}
   if(columns[tab]){const cols=columns[tab];body.innerHTML=`<table><thead><tr>${Object.values(cols).map(v=>`<th scope="col">${v}</th>`).join('')}</tr></thead><tbody>${result[tab].map(v=>`<tr>${Object.keys(cols).map(k=>`<td>${esc(text(['segment','shot'].includes(k)?v[k]+1:v[k]))}</td>`).join('')}</tr>`).join('')}</tbody></table>${result[tab].length?'':'<p>AI 未建立此表；请核对是否存在对应素材档案。</p>'}`;return}
   const v=result.changes[active];body.innerHTML=`<div class="aiReviewChanges"><aside>${result.changes.map((v,i)=>`<label><input type="checkbox" data-ai-pick="${i}" ${selected.has(i)?'checked':''}><button data-ai-change="${i}" aria-pressed="${i===active}">片段 ${v.segment+1} · 镜头 ${v.shot+1} · ${esc(({action:'画面动作',camera:'摄影机',expression:'表情',startState:'起始状态',endState:'结束状态'})[v.field])}</button></label>`).join('')}</aside><section>${v?`<h3>片段 ${v.segment+1} · 镜头 ${v.shot+1}</h3><p>${esc(v.reason||'请核对建议')}</p><h4>原文</h4><pre>${esc(v.before)}</pre><label>AI 建议（可编辑）<textarea data-ai-after rows="10">${esc(drafts.get(active)??v.after)}</textarea></label><p>仅勾选的字段会写入草稿，原台词、时长、素材 ID 和成品不变。</p>`:'<p>AI 没有提出字段修改。</p>'}</section></div>`;
  }
  function accept(value){result=value;status('模型：'+value.model+' · 文字档案审查，未读取图片／视频 · '+value.changes.length+' 项修改建议');q('[data-ai-export]').disabled=false;q('[data-ai-apply]').disabled=!options.onApply;draw()}
  async function poll(){if(closed)return;try{const rows=await api('tasks'),row=rows.tasks.find(r=>r.id===taskId);if(!row)throw Error('审查任务记录已清理');status('模型：'+(row.model||options.model||'已配置模型')+' · '+(row.stage||row.status));if(row.status==='done'){accept(row.result);return}if(['error','cancelled','interrupted'].includes(row.status))throw Error(row.error||'审查未完成；没有应用修改');timer=setTimeout(poll,1500)}catch(e){status('AI 审查失败：'+e.message+'。不会以本地规则替代 AI 结果。');q('[data-ai-start]').disabled=false}}
  q('[data-ai-start]').onclick=async()=>{q('[data-ai-start]').disabled=true;try{const row=await api('ai-continuity',{projectId:options.projectId,planId:options.planId,segments:options.segments});taskId=row.id;options.model=row.model;await poll()}catch(e){status('无法启动 AI 审查：'+e.message);q('[data-ai-start]').disabled=false}};
  q('[data-ai-tabs]').onclick=e=>{const b=e.target.closest('[data-ai-tab]');if(b){tab=b.dataset.aiTab;draw()}};
  q('[data-ai-body]').oninput=e=>{if(e.target.matches('[data-ai-after]'))drafts.set(active,e.target.value)};
  q('[data-ai-body]').onchange=e=>{if(e.target.dataset.aiPick!==undefined){const i=+e.target.dataset.aiPick;if(e.target.checked)selected.add(i);else selected.delete(i)}};
  q('[data-ai-body]').onclick=e=>{const b=e.target.closest('[data-ai-change]');if(b){active=+b.dataset.aiChange;draw()}};
  q('[data-ai-apply]').onclick=async()=>{if(!selected.size){status('请在修改对比中勾选建议');return}try{const changes=[...selected].map(i=>({...result.changes[i],after:drafts.get(i)??result.changes[i].after}));if(changes.some(v=>v.after.length>20000))throw Error('修改内容过长');await options.onApply(changes);status('已应用 '+changes.length+' 项到预览草稿；关闭本工作区可返回核对。');q('[data-ai-apply]').disabled=true}catch(e){status('未应用：'+e.message)}};
  q('[data-ai-export]').onclick=()=>{const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='FRAME-AI-Continuity-Review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  q('[data-ai-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{closed=true;clearTimeout(timer);dialog.remove()},{once:true});
  status('尚未调用模型 · 点击开始后加入现有任务队列，可能产生接口费用');draw();if(options.result){q('[data-ai-start]').hidden=true;accept(options.result)}
 }
 window.openAIContinuityReview=workspace;window.openAIReviewResult=result=>workspace({result});
})();
