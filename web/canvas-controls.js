/* Canvas gestures stay separate from shared project data and text editing. */
window.createFrameCanvasControls=function(o){
 const {dialog,map}=o,abort=new AbortController(),signal=abort.signal;
 let ids=new Set(),mode='select',space=false,gesture=null,suppress=false,pending=0,history=[],frame=0,lastMove=null;
 const on=(el,type,fn,extra={})=>el.addEventListener(type,fn,{...extra,signal});
 const menu=document.createElement('div');menu.className='canvasContextMenu';menu.hidden=true;dialog.append(menu);
 const box=document.createElement('div');box.className='canvasSelectionBox';box.hidden=true;map.append(box);
 const toolbar=dialog.querySelector('.overviewToolbar');
 const appearanceButton=document.createElement('button');appearanceButton.type='button';appearanceButton.textContent='画布外观';appearanceButton.dataset.canvasAppearance='';
 const colors={background:'--canvas-background',node:'--canvas-node-bg',highlight:'--canvas-glow',grid:'--canvas-grid-color',titleColor:'--canvas-title-color',bodyColor:'--canvas-body-color',captionColor:'--canvas-caption-color',lineColor:'--canvas-line-color',arrowColor:'--canvas-arrow-color'};
 function applyAppearance(){
  const a=o.appearance();dialog.dataset.projectShape=['circle','rounded','square','diamond','hexagon','chamfer'].includes(a.projectShape)?a.projectShape:'circle';for(const[key,css]of Object.entries(colors)){if(/^#[0-9a-f]{6}$/i.test(a[key]||''))dialog.style.setProperty(css,a[key]);else dialog.style.removeProperty(css)}
  if(Number.isFinite(a.gridSize)&&a.gridSize>=8&&a.gridSize<=160)dialog.style.setProperty('--canvas-grid-size',a.gridSize+'px');else dialog.style.removeProperty('--canvas-grid-size');
  for(const[key,min,max,defaultValue]of [['titleSize',10,48,16],['bodySize',10,36,15],['captionSize',9,28,12]]){const value=Number(a[key]);dialog.style.setProperty('--canvas-'+key.replace('Size','-size'),(Number.isFinite(value)&&value>=min&&value<=max?value:defaultValue)+'px')}
  dialog.style.setProperty('--canvas-flow-duration',(6/Math.max(.1,Math.min(5,Number(a.arrowSpeed)||1)))+'s');dialog.dataset.canvasLineStyle=['default','orthogonal','straight','curve','pcb','hidden'].includes(a.lineStyle)?a.lineStyle:'pcb';dialog.dataset.canvasFlow=a.flow===false?'off':'on';dialog.dataset.canvasArrow=a.arrowType||'chevron2';dialog.dataset.canvasImageFit=a.imageFit==='cover'?'cover':'contain';
  dialog.dataset.canvasPattern=['dots','lines','none'].includes(a.pattern)?a.pattern:'dots';
 }
 function appearance(){
  const panel=o.settings();panel.innerHTML=frameCanvasSettings(o.appearance(),o.selectedAsset());
  const update=()=>{applyAppearance();o.measure()};
  panel.oninput=e=>{const input=e.target,key=input.dataset.appearanceColor||input.dataset.appearanceNumber;if(!key)return;const value=input.type==='color'?input.value:input.valueAsNumber;if(input.type!=='color'&&(!Number.isFinite(value)||value<Number(input.min)||value>Number(input.max)))return;o.setAppearance({...o.appearance(),[key]:value});panel.querySelector('[data-value="'+key+'"]')?.replaceChildren(document.createTextNode(String(value)+(key==='arrowSpeed'?'×':' px')));update()};
  panel.onchange=e=>{const key=e.target.dataset.appearanceSelect||e.target.dataset.appearanceCheck;if(!key)return;o.setAppearance({...o.appearance(),[key]:e.target.type==='checkbox'?e.target.checked:e.target.value});update()};
  panel.onclick=e=>{if(e.target.closest('[data-reset-appearance]')){o.setAppearance({});applyAppearance();appearance()}};
  for(const input of panel.querySelectorAll('[data-asset-size]'))input.oninput=()=>{const asset=o.selectedAsset();if(!asset)return;const el=o.nodes().get(asset.id),size={w:el.offsetWidth,h:el.offsetHeight};size[input.dataset.assetSize]=input.valueAsNumber;o.setSize(asset.id,size);el.style.width=size.w+'px';el.style.height=size.h+'px';el.classList.add('canvasSized');panel.querySelector('[data-size-value="'+input.dataset.assetSize+'"]').textContent=input.value+' px';o.measure();repaint()};
 }
 applyAppearance();on(appearanceButton,'click',()=>safe(async()=>{if(!active()||!await o.save())return;appearance()}));
 const tools=document.createElement('div');tools.className='canvasSelectionTools';tools.innerHTML='<button type="button" data-canvas-tool="select" class="active" title="拖空白框选">↖ 选择</button><button type="button" data-canvas-tool="pan" title="拖空白平移">✥ 平移</button><span class="canvasSelectionCount" aria-live="polite"></span>';toolbar.prepend(tools);
 const groupTools=document.createElement('span');groupTools.className='canvasGroupTools';groupTools.innerHTML='<button type="button" data-group-command="group" title="选中多个节点后建立布局组">编组</button><button type="button" data-group-command="ungroup">解组</button>';
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
 const editing=e=>e.target.closest('input,textarea,select,video,audio,[contenteditable="true"]');
 const active=()=>dialog.open&&!o.busy()&&!document.querySelector('#modal[open],#imageViewer[open]');
 function closeMenu(){menu.hidden=true;menu.querySelectorAll('[data-submenu]').forEach(p=>p.hidden=true);menu.querySelectorAll('[data-submenu-open]').forEach(b=>b.setAttribute('aria-expanded','false'))}
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
 function openSubmenu(button){const key=button.dataset.submenuOpen;menu.querySelectorAll('[data-submenu]').forEach(p=>p.hidden=p.dataset.submenu!==key);menu.querySelectorAll('[data-submenu-open]').forEach(b=>b.setAttribute('aria-expanded',String(b===button)));const panel=menu.querySelector('[data-submenu="'+key+'"]');if(!panel)return;panel.hidden=false;const row=button.getBoundingClientRect(),bounds=dialog.getBoundingClientRect(),width=panel.offsetWidth||220,height=panel.offsetHeight||200;const left=row.right+width<bounds.right-8?row.right:row.left-width;const origin=menu.getBoundingClientRect();panel.style.left=Math.max(bounds.left+8,left)-origin.left+'px';panel.style.top=Math.max(bounds.top+8,Math.min(row.top,bounds.bottom-height-8))-origin.top+'px';}
 on(menu,'pointerover',e=>{const b=e.target.closest('[data-submenu-open]');if(b)openSubmenu(b)});
 on(menu,'click',e=>{const b=e.target.closest('[data-submenu-open]');if(b){e.stopPropagation();openSubmenu(b)}});
 on(menu,'keydown',e=>{const b=e.target.closest('[data-submenu-open]');if(b&&e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();openSubmenu(b);menu.querySelector('[data-submenu="'+b.dataset.submenuOpen+'"] button')?.focus()}if(e.key==='ArrowLeft'&&e.target.closest('[data-submenu]')){e.preventDefault();e.stopPropagation();const key=e.target.closest('[data-submenu]').dataset.submenu;menu.querySelector('[data-submenu-open="'+key+'"]')?.focus();menu.querySelector('[data-submenu="'+key+'"]').hidden=true;menu.querySelector('[data-submenu-open="'+key+'"]').setAttribute('aria-expanded','false')}});
 on(menu,'click',e=>{const b=e.target.closest('[data-menu-command]');if(b){e.stopPropagation();safe(()=>command(b.dataset.menuCommand))}});
 on(dialog,'contextmenu',e=>{if(!map.contains(e.target)||editing(e)||!active())return;e.preventDefault();safe(async()=>{
  const node=e.target.closest('[data-overview-select]');if(node&&!ids.has(node.dataset.overviewSelect)&&!await choose([node.dataset.overviewSelect]))return;
  const d=ids.size===1?o.descriptor([...ids][0]):null;
  const groups=[['编辑与生成',[]],['展开与视图',[]],['管理与导出',[]],['危险操作',[]]];
  const edit=groups[0][1],view=groups[1][1],manage=groups[2][1],danger=groups[3][1];
  if(node){edit.push(['edit','编辑所选节点']);if(d?.kind==='segment')edit.push(['plan','AI 拆镜','primary'],['copy-segment','复制整段']);if(d?.kind==='asset')edit.push(['analyze-asset','AI 分析','primary'],['replace-asset','替换素材']);if(d?.kind==='shot')edit.push(['upload-shot','上传 / 替换镜头图']);if(ids.size>1){manage.push(['group','将所选节点编组']);if(o.groups().some(g=>g.members.some(id=>ids.has(id))))manage.push(['ungroup','解除所选布局组'])}if([...ids].some(id=>['segment','shot','asset'].includes(o.descriptor(id)?.kind)))danger.push(['delete',d?.kind==='asset'?'删除素材':'删除所选镜头 / 片段 / 素材','danger']);}
  else edit.push(['add-segment','＋ 新建片段'],['add-public-asset','＋ 添加公共素材'],['upload-video','＋ 上传本片段视频']);
  view.push(['all','全选可见节点'],['clear','取消选择'],['fit','适应全部'],['undo','撤销画布操作']);manage.push(['import-pack','导入导演包'],['export-pack','导出导演包'],['confirm-all-assets','人工确认全部素材']);
  const keys={all:'Ctrl+A',clear:'Esc',delete:'Delete',undo:'Ctrl+Z',group:'Ctrl+G',ungroup:'Ctrl+Shift+G'};
  const button=([cmd,label,style])=>`<button type="button" data-menu-command="${cmd}" class="${style||''}"><span>${label}</span>${keys[cmd]?'<kbd>'+keys[cmd]+'</kbd>':''}</button>`;
  const direct=edit.filter(item=>item[0]==='edit'||item[2]==='primary'),extra=edit.filter(item=>!direct.includes(item));
  const menus=[['edit','更多编辑',extra],['view','视图与选择',view],['layout','布局与编组',manage.filter(x=>['group','ungroup'].includes(x[0]))],['manage','管理与导出',manage.filter(x=>!['group','ungroup'].includes(x[0]))]];
  menu.innerHTML=`<small>${node?(ids.size>1?'已选 '+ids.size+' 个节点':esc(d?.title||'节点操作')):'画布快捷操作'}</small>`+direct.map(button).join('')+menus.filter(([, ,items])=>items.length).map(([key,label,items])=>`<div class="contextBranch"><button type="button" data-submenu-open="${key}" aria-expanded="false" aria-haspopup="menu">${label}<span aria-hidden="true">›</span></button><div class="contextSubmenu" data-submenu="${key}" role="menu" hidden>${items.map(button).join('')}</div></div>`).join('')+(danger.length?'<div class="contextDanger">'+danger.map(button).join('')+'</div>':'');menu.hidden=false;const r=dialog.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(e.clientX-r.left,(r.width||innerWidth)-220))+'px';menu.style.top=Math.max(8,Math.min(e.clientY-r.top,(r.height||innerHeight)-menu.offsetHeight-10))+'px';
 })});
 on(map,'dblclick',e=>{const label=e.target.closest('.canvasGroupLabel');if(!label||!active())return;const id=label.parentElement.dataset.canvasGroup,group=o.groups().find(g=>g.id===id);if(!group)return;e.preventDefault();e.stopPropagation();safe(async()=>{if(!await o.save())return;modal('修改布局组名称',`<label>组名<input id="canvasGroupName" maxlength="100" value="${esc(group.title||'布局组')}"></label>`,[{label:'取消',action:close},{label:'保存组名',class:'primary',action:()=>{const title=$('canvasGroupName').value.trim();if(!title)throw Error('请输入组名');const before=structuredClone(o.groups());groupChange(before.map(g=>g.id===id?{...g,title}:g),before);close()}}]);$('canvasGroupName').focus()})});
 on(map,'click',e=>{const label=e.target.closest('.canvasGroupLabel');if(!label)return;e.stopPropagation();if(suppress){suppress=false;return}const group=o.groups().find(g=>g.id===label.parentElement.dataset.canvasGroup);if(group)safe(()=>choose(group.members.filter(id=>o.nodes().has(id))))});
 on(map,'keydown',e=>{const label=e.target.closest('.canvasGroupLabel');if(label&&['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();label.click()}});
 on(dialog,'click',e=>{const node=e.target.closest('.overviewNode');if(!node||editing(e))return;e.stopImmediatePropagation();if(suppress){suppress=false;return}safe(async()=>{const next=new Set(ids),id=node.dataset.overviewSelect;if(e.shiftKey){next.has(id)?next.delete(id):next.add(id)}else{next.clear();next.add(id)}await choose([...next])})},{capture:true});
 on(map,'pointerdown',e=>{
  if(!active()||editing(e)||e.button===2)return;let node=e.target.closest('.overviewNode');const groupLabel=e.target.closest('.canvasGroupLabel'),group=groupLabel&&o.groups().find(g=>g.id===groupLabel.parentElement.dataset.canvasGroup);if(group)node=o.nodes().get(group.members.find(id=>o.nodes().has(id)));const cardLabel=e.target.closest('[data-card-drag]'),card=cardLabel&&!e.target.closest('[data-card-toggle]')&&o.cardInfo?.(cardLabel.dataset.cardDrag);if(!node&&!card&&e.target.closest('button'))return;
  const pan=e.button===1||space||(!node&&mode==='pan');if(e.button!==0&&!pan)return;e.preventDefault();closeMenu();map.focus();const request=++pending;
  safe(async()=>{if(!await o.save()||request!==pending)return;const r=map.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
   if(pan){gesture={kind:'pan',x,y,view:{...o.view()}};map.classList.add('panning')}
   else if(card){gesture={kind:'card',id:cardLabel.dataset.cardDrag,x,y,before:card,moved:false}}
   else if(node&&e.target.closest('.canvasResizeHandle')){const id=node.dataset.overviewSelect;gesture={kind:'resize',id,x,y,before:o.size(id)?{...o.size(id)}:null,w:node.offsetWidth,h:node.offsetHeight,moved:false}}
   else if(node){const id=node.dataset.overviewSelect;if(e.shiftKey){const next=new Set(ids);next.has(id)?next.delete(id):next.add(id);await choose([...next]);suppress=true}else if(!ids.has(id))await choose([id]);if(request!==pending)return;const moving=new Set(ids);for(const g of o.groups())if(g.members.some(id=>moving.has(id)))g.members.forEach(id=>moving.add(id));if(group)await choose(group.members.filter(id=>o.nodes().has(id)));gesture={kind:'nodes',x,y,points:[...moving].map(id=>({id,...(o.positions().get(id)||o.savedPositions()[id])})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),moved:false,captureId:groupLabel?e.pointerId:null}}
   else{gesture={kind:'box',x,y,base:e.shiftKey?[...ids]:[]};box.hidden=false}
   if(gesture){gesture.rect=r;gesture.bounds=[...o.nodes()].map(([id,el])=>({id,w:el.offsetWidth,h:el.offsetHeight}));dialog.classList.add('canvasInteracting')}if(!groupLabel)map.setPointerCapture?.(e.pointerId);
  });
 });
 function applyMove(e){if(!gesture)return;const r=gesture.rect,x=e.clientX-r.left,y=e.clientY-r.top,dx=x-gesture.x,dy=y-gesture.y,v=o.view();
  if(gesture.kind==='pan'){o.pan(gesture.view.x+dx,gesture.view.y+dy);return}
  if(gesture.kind==='card'){if(Math.abs(dx)+Math.abs(dy)<5&&!gesture.moved)return;gesture.moved=true;gesture.after={origin:{x:gesture.before.origin.x+dx/v.z,y:gesture.before.origin.y+dy/v.z},points:gesture.before.points.map(p=>({id:p.id,x:p.x+dx/v.z,y:p.y+dy/v.z}))};o.moveCard(gesture.id,gesture.after.origin,gesture.after.points);return}
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
 function finish(){if(frame)cancelAnimationFrame(frame);frame=0;if(lastMove)applyMove(lastMove);lastMove=null;dialog.classList.remove('canvasInteracting');pending++;if(gesture?.kind==='card'&&gesture.moved){const {id,before,after}=gesture;o.moveCard(id,after.origin,after.points,true);record(async()=>{o.moveCard(id,before.origin,before.points,true);o.refresh()});suppress=true}else if(gesture?.kind==='nodes'&&gesture.moved){const before=gesture.points.map(p=>({...p})),v=o.view(),dx=(gesture.lastX||0),dy=(gesture.lastY||0),after=gesture.points.map(p=>({id:p.id,x:p.x+dx/v.z,y:p.y+dy/v.z}));o.persist(after);record(async()=>{o.persist(before);o.refresh();toast('已撤销节点移动')});suppress=true}else if(gesture?.kind==='resize'&&gesture.moved){const {id,before,after}=gesture;o.setSize(id,after);record(async()=>{o.setSize(id,before);o.refresh()});suppress=true}else if(gesture?.kind==='box'){o.multi(ids.size);repaint();if(ids.size===1)safe(()=>o.select([...ids][0]))}else if(gesture?.kind==='pan')o.saveView();gesture=null;box.hidden=true;map.classList.remove('panning');setTimeout(()=>suppress=false,0)}
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
 on(map,'keydown',e=>{const label=e.target.closest('[data-card-drag]');if(!label||e.target.closest('[data-card-toggle]')||!active()||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();safe(async()=>{if(!await o.save())return;const id=label.dataset.cardDrag,before=o.cardInfo(id);if(!before)return;const step=e.shiftKey?50:10,dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;o.moveCard(id,{x:before.origin.x+dx,y:before.origin.y+dy},before.points.map(p=>({id:p.id,x:p.x+dx,y:p.y+dy})),true);record(async()=>{o.moveCard(id,before.origin,before.points,true);o.refresh()})})});
 on(document,'keyup',e=>{if(e.code==='Space'){space=false;setMode(mode)}});on(window,'blur',()=>{space=false;finish();setMode(mode)});
 return {repaint,appearance,applyAppearance,selectedIds:()=>[...ids],select(id){ids=new Set(id?[id]:[]);repaint()},command,help,dispose(){abort.abort();if(frame)cancelAnimationFrame(frame);frame=0;lastMove=null;dialog.classList.remove('canvasInteracting');space=false;gesture=null;menu.remove();box.remove();tools.remove();appearanceButton.remove();groupTools.remove();map.querySelectorAll('.canvasGroupFrame').forEach(el=>el.remove())}};
};
