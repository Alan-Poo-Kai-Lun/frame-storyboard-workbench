/* V4 navigation is the existing live tree; no copied project state. */
window.frameV4=(()=>{
 function navigation(panel,dialog){
  if(panel.dataset.v4)return;panel.dataset.v4='true';
  const workspace=dialog.querySelector('.overviewWorkspace'),home=panel.parentElement;
  const bar=document.createElement('header');bar.className='v4NavHandle';bar.innerHTML='<strong>片段 / 镜头导航</strong><button type="button">浮动</button>';
  panel.prepend(bar);const grip=document.createElement('div');grip.className='v4NavGrip';grip.setAttribute('role','separator');grip.setAttribute('aria-label','调整片段导航高度');panel.append(grip);
  let floating=false;let height=Number(localStorage.getItem('frame.v4.navHeight'))||260;panel.style.height=height+'px';
  bar.querySelector('button').onclick=()=>{floating=!floating;panel.classList.toggle('v4NavFloating',floating);if(floating){workspace.append(panel);Object.assign(panel.style,{left:'30px',top:'60px',width:'330px',height:height+'px'})}else{home.prepend(panel);panel.style.cssText='height:'+height+'px';}bar.querySelector('button').textContent=floating?'停靠':'浮动'};
  bar.onpointerdown=e=>{if(!floating||e.target.closest('button'))return;const x=e.clientX,y=e.clientY,left=panel.offsetLeft,top=panel.offsetTop;bar.setPointerCapture(e.pointerId);bar.onpointermove=v=>{panel.style.left=Math.max(0,Math.min(workspace.clientWidth-100,left+v.clientX-x))+'px';panel.style.top=Math.max(0,Math.min(workspace.clientHeight-50,top+v.clientY-y))+'px'};bar.onpointerup=bar.onpointercancel=()=>bar.onpointermove=null;e.preventDefault()};
  grip.onpointerdown=e=>{const y=e.clientY,h=panel.offsetHeight;grip.setPointerCapture(e.pointerId);grip.onpointermove=v=>{height=Math.max(140,Math.min(workspace.clientHeight-100,h+v.clientY-y));panel.style.height=height+'px'};grip.onpointerup=grip.onpointercancel=()=>{grip.onpointermove=null;localStorage.setItem('frame.v4.navHeight',height)};e.preventDefault()};
 }
 async function storyboard(){
  await flush();if(!P)return;const pid=P.projectId;
  const rows=P.segments.flatMap((s,i)=>s.shots.map((h,j)=>`<tr><td>${i+1}.${j+1}<br>${h.start}–${h.end}s</td><td>${h.image?imgTag(h.image):'分镜图待生成'}</td><td>${esc(h.camera||'未设置')}</td><td>${esc(h.action||'')}</td><td>${esc(h.startState||'未设置')}<hr>${esc(h.endState||'未设置')}</td><td>${esc(h.dialogue||'无对白')}</td><td><button data-v4-shot="${esc(s.id+':'+h.id)}">编辑镜头</button><button data-v4-prompt="${esc(s.id)}">最终提示词</button></td></tr>`)).join('');
  modal('分镜表 · 与画布共用项目数据',`<div class="v4Storyboard"><table><thead><tr><th>镜号 / 时间</th><th>画面</th><th>摄影机</th><th>画面动作</th><th>起始 → 结束空间状态</th><th>对白</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>`,[{label:'关闭',action:close}]);
  $('modalBody').onclick=e=>safe(async()=>{if(P.projectId!==pid)throw Error('项目已切换');const prompt=e.target.closest('[data-v4-prompt]');if(prompt)return frameR15.openPrompt(prompt.dataset.v4Prompt);const b=e.target.closest('[data-v4-shot]');if(!b)return;const [sid,hid]=b.dataset.v4Shot.split(':'),s=P.segments.find(s=>s.id===sid),h=s.shots.find(h=>h.id===hid),fields=['action','camera','dialogue','startState','endState'],labels=['画面动作','摄影机','角色对白','起始空间状态','结束空间状态'],expected=Object.fromEntries(fields.map(k=>[k,h[k]||'']));
   modal('编辑镜头 · '+h.start+'–'+h.end+' 秒',fields.map((k,i)=>`<label>${labels[i]}<textarea data-v4-field="${k}" rows="3">${esc(h[k]||'')}</textarea></label>`).join(''),[{label:'返回分镜表',action:storyboard},{label:'保存修改',class:'primary',action:async()=>{if(P.projectId!==pid)throw Error('项目已切换');const updates=Object.fromEntries([...document.querySelectorAll('[data-v4-field]')].map(el=>[el.dataset.v4Field,el.value]));await frameFlowHost.edit('h:'+sid+':'+hid,updates,expected);await storyboard()}}]);
  });
 }
 return {navigation,storyboard};
})();
