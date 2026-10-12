/* Canvas gestures stay separate from shared project data and text editing. */
window.createFrameCanvasControls=function(o){
 const {dialog,map}=o,abort=new AbortController(),signal=abort.signal;
 let ids=new Set(),mode='select',space=false,gesture=null,suppress=false,pending=0,history=[],frame=0,lastMove=null;
 const on=(el,type,fn,extra={})=>el.addEventListener(type,fn,{...extra,signal});
 const menu=document.createElement('div');menu.className='canvasContextMenu';menu.hidden=true;dialog.append(menu);
 const box=document.createElement('div');box.className='canvasSelectionBox';box.hidden=true;map.append(box);
 const toolbar=dialog.querySelector('.overviewToolbar');
 const appearanceButton=document.createElement('button');appearanceButton.type='button';appearanceButton.textContent='画布外观';appearanceButton.dataset.canvasAppearance='';toolbar.append(appearanceButton);
 const colors={background:'--canvas-background',node:'--canvas-node-bg',highlight:'--canvas-glow',grid:'--canvas-grid-color'};
 function applyAppearance(){
  const a=o.appearance();for(const[key,css]of Object.entries(colors)){if(/^#[0-9a-f]{6}$/i.test(a[key]||''))dialog.style.setProperty(css,a[key]);else dialog.style.removeProperty(css)}
  if(Number.isFinite(a.gridSize)&&a.gridSize>=8&&a.gridSize<=160)dialog.style.setProperty('--canvas-grid-size',a.gridSize+'px');else dialog.style.removeProperty('--canvas-grid-size');
  dialog.dataset.canvasPattern=['dots','lines','none'].includes(a.pattern)?a.pattern:'dots';
 }
 function appearance(){
  const a=o.appearance(),style=getComputedStyle(map),nodeStyle=getComputedStyle(map.querySelector('.overviewNode.segment')||map);
  const hex=(value,fallback)=>{if(/^#[0-9a-f]{6}$/i.test(value))return value;const rgb=value.match(/^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/);return rgb?'#'+rgb.slice(1,4).map(n=>Number(n).toString(16).padStart(2,'0')).join(''):fallback};
  const defaults={background:hex(style.backgroundColor,'#18222b'),node:hex(nodeStyle.backgroundColor,'#24333e'),highlight:hex(style.getPropertyValue('--canvas-glow').trim(),'#91ddc8'),grid:hex(style.getPropertyValue('--line').trim(),'#364454')};
  modal('画布外观',`<p class="muted">修改立即生效，自动随当前项目保存，也会随导演包导出。</p>${Object.entries({background:'背景颜色',node:'节点颜色',highlight:'高亮颜色',grid:'网格颜色'}).map(([key,label])=>`<label>${label}<input type="color" data-appearance-color="${key}" value="${/^#[0-9a-f]{6}$/i.test(a[key]||'')?a[key]:defaults[key]}"></label>`).join('')}<label>背景样式<select id="canvasPattern"><option value="dots">点阵</option><option value="lines">方格</option><option value="none">纯色</option></select></label><label>格子大小（8–160 px）<input id="canvasGridSize" type="number" min="8" max="160" step="1" value="${Number.isFinite(a.gridSize)&&a.gridSize>=8&&a.gridSize<=160?a.gridSize:28}"></label><p id="canvasAppearanceStatus" role="status"></p>`,[{label:'恢复默认',action:()=>{o.setAppearance({});applyAppearance();close()}},{label:'完成',class:'primary',action:close}]);
  $('canvasPattern').value=['dots','lines','none'].includes(a.pattern)?a.pattern:'dots';
  for(const input of $('modalBody').querySelectorAll('[data-appearance-color]'))input.oninput=()=>{o.setAppearance({...o.appearance(),[input.dataset.appearanceColor]:input.value});applyAppearance()};
  $('canvasPattern').onchange=e=>{o.setAppearance({...o.appearance(),pattern:e.target.value});applyAppearance()};
  $('canvasGridSize').oninput=e=>{const value=e.target.valueAsNumber,valid=Number.isInteger(value)&&value>=8&&value<=160;$('canvasAppearanceStatus').textContent=valid?'':'请输入 8–160 的整数';if(valid){o.setAppearance({...o.appearance(),gridSize:value});applyAppearance()}};
 }
 applyAppearance();on(appearanceButton,'click',()=>safe(async()=>{if(!active()||!await o.save())return;appearance()}));
 const tools=document.createElement('div');tools.className='canvasSelectionTools';tools.innerHTML='<button type="button" data-canvas-tool="select" class="active" title="拖空白框选">↖ 选择</button><button type="button" data-canvas-tool="pan" title="拖空白平移">✥ 平移</button><span class="canvasSelectionCount" aria-live="polite"></span>';toolbar.prepend(tools);
 const groupTools=document.createElement('span');groupTools.className='canvasGroupTools';groupTools.innerHTML='<button type="button" data-group-command="group" title="选中多个节点后建立布局组">编组</button><button type="button" data-group-command="ungroup">解组</button>';toolbar.append(groupTools);
 on(groupTools,'click',e=>{const b=e.target.closest('[data-group-command]');if(b){e.stopPropagation();safe(()=>command(b.dataset.groupCommand))}});
 function groupChange(next,before){o.setGroups(next);record(async()=>{o.setGroups(before);repaint()});repaint()}
 function renderGroups(){
  const graph=map.querySelector('.overviewGraph'),frames=new Map([...graph.querySelectorAll('.canvasGroupFrame')].map(el=>[el.dataset.canvasGroup,el]));
  for(const group of o.groups()){
   const members=group.members.filter(id=>o.nodes().has(id));if(!members.length)continue;frames.delete(group.id);
   const points=members.map(id=>{const p=o.positions().get(id),el=o.nodes().get(id);const cached=gesture?.kind==='nodes'&&gesture.bounds?.find(b=>b.id===id);return {x:p.x,y:p.y,w:cached?cached.w:el.offsetWidth,h:cached?cached.h:el.offsetHeight}});
   const left=Math.min(...points.map(p=>p.x))-16,top=Math.min(...points.map(p=>p.y))-38;
   const existing=[...graph.querySelectorAll('.canvasGroupFrame')].find(el=>el.dataset.canvasGroup===group.id),frame=existing||document.createElement('div');frame.className='canvasGroupFrame';frame.dataset.canvasGroup=group.id;
   Object.assign(frame.style,{left:left+'px',top:top+'px',width:Math.max(...points.map(p=>p.x+p.w))-left+16+'px',height:Math.max(...points.map(p=>p.y+p.h))-top+16+'px'});
   const label=frame.querySelector('.canvasGroupLabel')||document.createElement('span');label.className='canvasGroupLabel';label.textContent=(group.title||'布局组')+' · '+group.members.length;label.title='拖动整组；双击修改组名';label.tabIndex=0;label.setAttribute('role','button');if(!existing){frame.append(label);graph.prepend(frame)}
  }
  for(const frame of frames.values())frame.remove();
 }
 const editing=e=>e.target.closest('input,textarea,select,video,[contenteditable="true"]');
 const active=()=>dialog.open&&!o.busy()&&!document.querySelector('#modal[open],#imageViewer[open]');
 function closeMenu(){menu.hidden=true}
 function repaint(){
  const rows=o.nodes();ids=new Set([...ids].filter(id=>rows.has(id)));
  for(const[id,el]of rows){const value=ids.has(id);if(el.classList.contains('selected')!==value)el.classList.toggle('selected',value);if(el.getAttribute('aria-pressed')!==String(value))el.setAttribute('aria-pressed',String(value))}
  for(const el of rows.values())if(!el.querySelector('.canvasResizeHandle')){const h=document.createElement('span');h.className='canvasResizeHandle';h.title='拖动调整节点大小';h.setAttribute('aria-hidden','true');el.append(h)}
  renderGroups();
  tools.querySelector('.canvasSelectionCount').textContent=ids.size>1?'已选 '+ids.size+' 个':'';
 }
 async function choose(next){if(!active()||!await o.save())return false;ids=new Set(next);if(ids.size===1)await o.select([...ids][0]);else o.multi(ids.size);repaint();return true}
 function setMode(value){mode=value;tools.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.canvasTool===mode));map.classList.toggle('canvasPanTool',mode==='pan'||space)}
 function record(undo){history.push(undo);if(history.length>20)history.shift()}
 async function undo(){if(!await o.save())return;const fn=history.at(-1);if(!fn){toast('没有可撤销的画布操作');return}await fn();history.pop();repaint()}
 const all=()=>choose([...o.nodes().keys()]);
 function help(){modal('总览操作',`<p>先点片段写故事，再点镜头编辑。拖空白框选，按 Shift 可追加选择；拖任一选中节点可一起移动。</p><div class="canvasKeyHelp">${[['Ctrl / ⌘ A','全选当前可见节点'],['Ctrl / ⌘ S','保存当前修改'],['Ctrl / ⌘ Z','撤销移动、缩放、编组或批量删除'],['Ctrl / ⌘ G / Shift G','编组 / 解组'],['拖节点右下角','调整节点大小'],['空格 + 拖动 / 中键','平移画布'],['滚轮','缩放画布'],['Delete','确认后删除镜头 / 片段'],['Esc','关闭菜单 / 取消选择']].map(([key,value])=>`<p><kbd>${esc(key)}</kbd><span>${esc(value)}</span></p>`).join('')}</div><p class="muted">输入框内保留文字编辑快捷键。节点位置只影响总览布局。</p>`,[{label:'知道了',action:close}])}
 async function command(cmd){closeMenu();if(cmd==='group'||cmd==='ungroup'){
   if(!await o.save())return;
   const before=structuredClone(o.groups()),selected=new Set(ids);
   if(cmd==='group'){
    if(ids.size<2){toast('请先框选或按 Shift 选择至少两个节点');return}
    // Merge intersecting groups so a node belongs to exactly one layout group.
    for(const g of before)if(g.members.some(id=>ids.has(id)))g.members.forEach(id=>selected.add(id));
    const next=before.filter(g=>!g.members.some(id=>selected.has(id)));
    next.push({id:crypto.randomUUID(),title:'布局组 '+(next.length+1),members:[...selected]});
    o.persist([...selected].filter(id=>o.positions().has(id)).map(id=>({id,...o.positions().get(id)})));
    groupChange(next,before);toast('已编组；拖动成员可移动整组');
   }else{groupChange(before.filter(g=>!g.members.some(id=>selected.has(id))),before);toast('已解除所选布局组')}
   return;
  }if(cmd==='all')return all();if(cmd==='clear')return choose([]);if(cmd==='help')return help();if(cmd==='undo')return undo();if(cmd==='delete')return o.remove([...ids],record);if(cmd==='fit')return o.fit();if(cmd==='edit'){if(ids.size===1)await o.select([...ids][0]);dialog.querySelector('.overviewDetail input,.overviewDetail textarea')?.focus();return}return o.action(cmd)}
 on(tools,'click',e=>{const b=e.target.closest('[data-canvas-tool]');if(b){e.stopPropagation();setMode(b.dataset.canvasTool)}});
 on(menu,'click',e=>{const b=e.target.closest('[data-menu-command]');if(b){e.stopPropagation();safe(()=>command(b.dataset.menuCommand))}});
 on(dialog,'contextmenu',e=>{if(!map.contains(e.target)||editing(e)||!active())return;e.preventDefault();safe(async()=>{
  const node=e.target.closest('[data-overview-select]');if(node&&!ids.has(node.dataset.overviewSelect)&&!await choose([node.dataset.overviewSelect]))return;
  const d=ids.size===1?o.descriptor([...ids][0]):null;
  const items=node?[['edit','编辑所选节点'],...(d?.kind==='segment'?[['copy-segment','复制整段']]:[]),...(d?.kind==='shot'?[['upload-shot','上传 / 替换镜头图']]:[]),...(d?.kind==='asset'?[['replace-asset','替换素材图片']]:[]),['all','全选可见节点'],['clear','取消选择'],['delete','删除镜头 / 片段']]:[['add-segment','＋ 新建片段'],['add-public-asset','＋ 添加公共素材'],['upload-video','＋ 上传本片段视频'],['all','全选可见节点'],['fit','适应全部'],['undo','撤销画布操作']];
  items.push(['group','将所选节点编组'],['ungroup','解除所选布局组'],['import-pack','导入导演包'],['export-pack','导出导演包'],['confirm-all-assets','人工确认全部素材']);
  menu.innerHTML=`<small>${node?(ids.size>1?'已选 '+ids.size+' 个节点':esc(d?.title||'节点操作')):'画布快捷操作'}</small>`+items.map(([cmd,label])=>`<button type="button" data-menu-command="${cmd}" class="${cmd==='delete'?'danger':''}">${label}</button>`).join('');menu.hidden=false;const r=dialog.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(e.clientX-r.left,(r.width||innerWidth)-220))+'px';menu.style.top=Math.max(8,Math.min(e.clientY-r.top,(r.height||innerHeight)-menu.offsetHeight-10))+'px';
 })});
 on(map,'dblclick',e=>{const label=e.target.closest('.canvasGroupLabel');if(!label||!active())return;const id=label.parentElement.dataset.canvasGroup,group=o.groups().find(g=>g.id===id);if(!group)return;e.preventDefault();e.stopPropagation();safe(async()=>{if(!await o.save())return;modal('修改布局组名称',`<label>组名<input id="canvasGroupName" maxlength="100" value="${esc(group.title||'布局组')}"></label>`,[{label:'取消',action:close},{label:'保存组名',class:'primary',action:()=>{const title=$('canvasGroupName').value.trim();if(!title)throw Error('请输入组名');const before=structuredClone(o.groups());groupChange(before.map(g=>g.id===id?{...g,title}:g),before);close()}}]);$('canvasGroupName').focus()})});
 on(map,'click',e=>{const label=e.target.closest('.canvasGroupLabel');if(!label)return;e.stopPropagation();if(suppress){suppress=false;return}const group=o.groups().find(g=>g.id===label.parentElement.dataset.canvasGroup);if(group)safe(()=>choose(group.members.filter(id=>o.nodes().has(id))))});
 on(map,'keydown',e=>{const label=e.target.closest('.canvasGroupLabel');if(label&&['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();label.click()}});
 on(dialog,'click',e=>{const node=e.target.closest('.overviewNode');if(!node)return;e.stopImmediatePropagation();if(suppress){suppress=false;return}safe(async()=>{const next=new Set(ids),id=node.dataset.overviewSelect;if(e.shiftKey){next.has(id)?next.delete(id):next.add(id)}else{next.clear();next.add(id)}await choose([...next])})},{capture:true});
 on(map,'pointerdown',e=>{
  if(!active()||editing(e)||e.button===2)return;let node=e.target.closest('.overviewNode');const groupLabel=e.target.closest('.canvasGroupLabel'),group=groupLabel&&o.groups().find(g=>g.id===groupLabel.parentElement.dataset.canvasGroup);if(group)node=o.nodes().get(group.members.find(id=>o.nodes().has(id)));if(!node&&e.target.closest('button'))return;
  const pan=e.button===1||space||(!node&&mode==='pan');if(e.button!==0&&!pan)return;e.preventDefault();closeMenu();map.focus();const request=++pending;
  safe(async()=>{if(!await o.save()||request!==pending)return;const r=map.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
   if(pan){gesture={kind:'pan',x,y,view:{...o.view()}};map.classList.add('panning')}
   else if(node&&e.target.closest('.canvasResizeHandle')){const id=node.dataset.overviewSelect;gesture={kind:'resize',id,x,y,before:o.size(id)?{...o.size(id)}:null,w:node.offsetWidth,h:node.offsetHeight,moved:false}}
   else if(node){const id=node.dataset.overviewSelect;if(e.shiftKey){const next=new Set(ids);next.has(id)?next.delete(id):next.add(id);await choose([...next]);suppress=true}else if(!ids.has(id))await choose([id]);if(request!==pending)return;const moving=new Set(ids);for(const g of o.groups())if(g.members.some(id=>moving.has(id)))g.members.forEach(id=>moving.add(id));if(group)await choose(group.members.filter(id=>o.nodes().has(id)));gesture={kind:'nodes',x,y,points:[...moving].map(id=>({id,...(o.positions().get(id)||o.savedPositions()[id])})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),moved:false,captureId:groupLabel?e.pointerId:null}}
   else{gesture={kind:'box',x,y,base:e.shiftKey?[...ids]:[]};box.hidden=false}
   if(gesture){gesture.rect=r;gesture.bounds=[...o.nodes()].map(([id,el])=>({id,w:el.offsetWidth,h:el.offsetHeight}));dialog.classList.add('canvasInteracting')}if(!groupLabel)map.setPointerCapture?.(e.pointerId);
  });
 });
 function applyMove(e){if(!gesture)return;const r=gesture.rect,x=e.clientX-r.left,y=e.clientY-r.top,dx=x-gesture.x,dy=y-gesture.y,v=o.view();
  if(gesture.kind==='pan'){o.pan(gesture.view.x+dx,gesture.view.y+dy);return}
  if(gesture.kind==='resize'){
   if(!gesture.moved&&Math.abs(dx)+Math.abs(dy)<3)return;gesture.moved=true;
   const el=o.nodes().get(gesture.id);gesture.after={w:Math.round(Math.max(100,Math.min(1800,gesture.w+dx/v.z))),h:Math.round(Math.max(70,Math.min(1800,gesture.h+dy/v.z)))};
   el.classList.add('canvasSized');el.style.width=gesture.after.w+'px';el.style.height=gesture.after.h+'px';o.measure();renderGroups();return;
  }
  if(gesture.kind==='nodes'){if(!gesture.moved&&Math.abs(dx)+Math.abs(dy)<5)return;if(!gesture.moved&&gesture.captureId!=null)map.setPointerCapture?.(gesture.captureId);gesture.moved=true;gesture.lastX=dx;gesture.lastY=dy;for(const p of gesture.points){const pos=o.positions().get(p.id),el=o.nodes().get(p.id);if(pos&&el){pos.x=p.x+dx/v.z;pos.y=p.y+dy/v.z;el.style.left=pos.x+'px';el.style.top=pos.y+'px'}}o.draw(new Set(gesture.points.map(p=>p.id)));renderGroups();return}
  const left=Math.min(x,gesture.x),top=Math.min(y,gesture.y),width=Math.abs(dx),height=Math.abs(dy);Object.assign(box.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});
  const hit=gesture.bounds.filter(({id,w,h})=>{const p=o.positions().get(id);if(!p)return false;const nx=p.x*v.z+v.x,ny=p.y*v.z+v.y;return nx<left+width&&nx+w*v.z>left&&ny<top+height&&ny+h*v.z>top}).map(({id})=>id);ids=new Set([...gesture.base,...hit]);repaint();
 }
 on(map,'pointermove',e=>{if(!gesture)return;lastMove={clientX:e.clientX,clientY:e.clientY};if(!frame)frame=requestAnimationFrame(()=>{frame=0;const next=lastMove;lastMove=null;if(next)applyMove(next)})});
 function finish(){if(frame)cancelAnimationFrame(frame);frame=0;if(lastMove)applyMove(lastMove);lastMove=null;dialog.classList.remove('canvasInteracting');pending++;if(gesture?.kind==='nodes'&&gesture.moved){const before=gesture.points.map(p=>({...p})),v=o.view(),dx=(gesture.lastX||0),dy=(gesture.lastY||0),after=gesture.points.map(p=>({id:p.id,x:p.x+dx/v.z,y:p.y+dy/v.z}));o.persist(after);record(async()=>{o.persist(before);o.refresh();toast('已撤销节点移动')});suppress=true}else if(gesture?.kind==='resize'&&gesture.moved){const {id,before,after}=gesture;o.setSize(id,after);record(async()=>{o.setSize(id,before);o.refresh()});suppress=true}else if(gesture?.kind==='box'){o.multi(ids.size);repaint();if(ids.size===1)safe(()=>o.select([...ids][0]))}else if(gesture?.kind==='pan')o.saveView();gesture=null;box.hidden=true;map.classList.remove('panning');setTimeout(()=>suppress=false,0)}
 on(map,'pointerup',finish);on(map,'pointercancel',finish);
 on(document,'pointerdown',e=>{if(!menu.contains(e.target))closeMenu()});
 on(document,'keydown',e=>{
  if(!active())return;if(editing(e)){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();safe(()=>o.save())}return}
  if((e.ctrlKey||e.metaKey)&&['a','s','z','g'].includes(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation();safe(()=>e.key.toLowerCase()==='a'?all():e.key.toLowerCase()==='s'?o.save():e.key.toLowerCase()==='g'?command(e.shiftKey?'ungroup':'group'):undo());return}
  if(e.code==='Space'){e.preventDefault();space=true;setMode(mode)}
  if(e.key==='Delete'){e.preventDefault();safe(()=>command('delete'))}
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(!menu.hidden)closeMenu();else if(ids.size)safe(()=>choose([]));else safe(()=>o.exit())}
  if(e.key==='?'){e.preventDefault();help()}
 },{capture:true});
 on(document,'keyup',e=>{if(e.code==='Space'){space=false;setMode(mode)}});on(window,'blur',()=>{space=false;finish();setMode(mode)});
 return {repaint,select(id){ids=new Set(id?[id]:[]);repaint()},command,help,dispose(){abort.abort();if(frame)cancelAnimationFrame(frame);frame=0;lastMove=null;dialog.classList.remove('canvasInteracting');space=false;gesture=null;menu.remove();box.remove();tools.remove();appearanceButton.remove();groupTools.remove();map.querySelectorAll('.canvasGroupFrame').forEach(el=>el.remove())}};
};
