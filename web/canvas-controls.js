/* Canvas gestures stay separate from shared project data and text editing. */
window.createFrameCanvasControls=function(o){
 const {dialog,map}=o,abort=new AbortController(),signal=abort.signal;
 let ids=new Set(),mode='select',space=false,gesture=null,suppress=false,pending=0,history=[],frame=0,lastMove=null;
 const on=(el,type,fn,extra={})=>el.addEventListener(type,fn,{...extra,signal});
 const menu=document.createElement('div');menu.className='canvasContextMenu';menu.hidden=true;dialog.append(menu);
 const box=document.createElement('div');box.className='canvasSelectionBox';box.hidden=true;map.append(box);
 const toolbar=dialog.querySelector('.overviewToolbar');
 const tools=document.createElement('div');tools.className='canvasSelectionTools';tools.innerHTML='<button type="button" data-canvas-tool="select" class="active" title="拖空白框选">↖ 选择</button><button type="button" data-canvas-tool="pan" title="拖空白平移">✥ 平移</button><span class="canvasSelectionCount" aria-live="polite"></span>';toolbar.prepend(tools);
 const editing=e=>e.target.closest('input,textarea,select,video,[contenteditable="true"]');
 const active=()=>dialog.open&&!o.busy()&&!document.querySelector('#modal[open],#imageViewer[open]');
 function closeMenu(){menu.hidden=true}
 function repaint(){
  const rows=o.nodes();ids=new Set([...ids].filter(id=>rows.has(id)));
  for(const[id,el]of rows){const value=ids.has(id);if(el.classList.contains('selected')!==value)el.classList.toggle('selected',value);if(el.getAttribute('aria-pressed')!==String(value))el.setAttribute('aria-pressed',String(value))}
  tools.querySelector('.canvasSelectionCount').textContent=ids.size>1?'已选 '+ids.size+' 个':'';
 }
 async function choose(next){if(!active()||!await o.save())return false;ids=new Set(next);if(ids.size===1)await o.select([...ids][0]);else o.multi(ids.size);repaint();return true}
 function setMode(value){mode=value;tools.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.canvasTool===mode));map.classList.toggle('canvasPanTool',mode==='pan'||space)}
 function record(undo){history.push(undo);if(history.length>20)history.shift()}
 async function undo(){if(!await o.save())return;const fn=history.at(-1);if(!fn){toast('没有可撤销的画布操作');return}await fn();history.pop();repaint()}
 const all=()=>choose([...o.nodes().keys()]);
 function help(){modal('总览操作',`<p>先点片段写故事，再点镜头编辑。拖空白框选，按 Shift 可追加选择；拖任一选中节点可一起移动。</p><div class="canvasKeyHelp">${[['Ctrl / ⌘ A','全选当前可见节点'],['Ctrl / ⌘ S','保存当前修改'],['Ctrl / ⌘ Z','撤销画布移动或批量删除'],['空格 + 拖动 / 中键','平移画布'],['滚轮','缩放画布'],['Delete','确认后删除镜头 / 片段'],['Esc','关闭菜单 / 取消选择']].map(([key,value])=>`<p><kbd>${esc(key)}</kbd><span>${esc(value)}</span></p>`).join('')}</div><p class="muted">输入框内保留文字编辑快捷键。节点位置只影响总览布局。</p>`,[{label:'知道了',action:close}])}
 async function command(cmd){closeMenu();if(cmd==='all')return all();if(cmd==='clear')return choose([]);if(cmd==='help')return help();if(cmd==='undo')return undo();if(cmd==='delete')return o.remove([...ids],record);if(cmd==='fit')return o.fit();if(cmd==='edit'){if(ids.size===1)await o.select([...ids][0]);dialog.querySelector('.overviewDetail input,.overviewDetail textarea')?.focus();return}return o.action(cmd)}
 on(tools,'click',e=>{const b=e.target.closest('[data-canvas-tool]');if(b){e.stopPropagation();setMode(b.dataset.canvasTool)}});
 on(menu,'click',e=>{const b=e.target.closest('[data-menu-command]');if(b){e.stopPropagation();safe(()=>command(b.dataset.menuCommand))}});
 on(dialog,'contextmenu',e=>{if(!map.contains(e.target)||editing(e)||!active())return;e.preventDefault();safe(async()=>{
  const node=e.target.closest('[data-overview-select]');if(node&&!ids.has(node.dataset.overviewSelect)&&!await choose([node.dataset.overviewSelect]))return;
  const d=ids.size===1?o.descriptor([...ids][0]):null;
  const items=node?[['edit','编辑所选节点'],...(d?.kind==='segment'?[['copy-segment','复制整段']]:[]),...(d?.kind==='shot'?[['upload-shot','上传 / 替换镜头图']]:[]),...(d?.kind==='asset'?[['replace-asset','替换素材图片']]:[]),['all','全选可见节点'],['clear','取消选择'],['delete','删除镜头 / 片段']]:[['add-segment','＋ 新建片段'],['add-public-asset','＋ 添加公共素材'],['upload-video','＋ 上传本片段视频'],['all','全选可见节点'],['fit','适应全部'],['undo','撤销画布操作']];
  menu.innerHTML=`<small>${node?(ids.size>1?'已选 '+ids.size+' 个节点':esc(d?.title||'节点操作')):'画布快捷操作'}</small>`+items.map(([cmd,label])=>`<button type="button" data-menu-command="${cmd}" class="${cmd==='delete'?'danger':''}">${label}</button>`).join('');menu.hidden=false;const r=dialog.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(e.clientX-r.left,(r.width||innerWidth)-220))+'px';menu.style.top=Math.max(8,Math.min(e.clientY-r.top,(r.height||innerHeight)-menu.offsetHeight-10))+'px';
 })});
 on(dialog,'click',e=>{const node=e.target.closest('.overviewNode');if(!node)return;e.stopImmediatePropagation();if(suppress){suppress=false;return}safe(async()=>{const next=new Set(ids),id=node.dataset.overviewSelect;if(e.shiftKey){next.has(id)?next.delete(id):next.add(id)}else{next.clear();next.add(id)}await choose([...next])})},{capture:true});
 on(map,'pointerdown',e=>{
  if(!active()||editing(e)||e.button===2)return;const node=e.target.closest('.overviewNode');if(!node&&e.target.closest('button'))return;
  const pan=e.button===1||space||(!node&&mode==='pan');if(e.button!==0&&!pan)return;e.preventDefault();closeMenu();map.focus();const request=++pending;
  safe(async()=>{if(!await o.save()||request!==pending)return;const r=map.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
   if(pan){gesture={kind:'pan',x,y,view:{...o.view()}};map.classList.add('panning')}
   else if(node){const id=node.dataset.overviewSelect;if(e.shiftKey){const next=new Set(ids);next.has(id)?next.delete(id):next.add(id);await choose([...next]);suppress=true}else if(!ids.has(id))await choose([id]);if(request!==pending)return;gesture={kind:'nodes',x,y,points:[...ids].filter(id=>o.positions().has(id)).map(id=>({id,...o.positions().get(id)})),moved:false}}
   else{gesture={kind:'box',x,y,base:e.shiftKey?[...ids]:[]};box.hidden=false}
   if(gesture){gesture.rect=r;gesture.bounds=[...o.nodes()].map(([id,el])=>({id,w:el.offsetWidth,h:el.offsetHeight}));dialog.classList.add('canvasInteracting')}map.setPointerCapture?.(e.pointerId);
  });
 });
 function applyMove(e){if(!gesture)return;const r=gesture.rect,x=e.clientX-r.left,y=e.clientY-r.top,dx=x-gesture.x,dy=y-gesture.y,v=o.view();
  if(gesture.kind==='pan'){o.pan(gesture.view.x+dx,gesture.view.y+dy);return}
  if(gesture.kind==='nodes'){if(!gesture.moved&&Math.abs(dx)+Math.abs(dy)<5)return;gesture.moved=true;for(const p of gesture.points){const pos=o.positions().get(p.id),el=o.nodes().get(p.id);if(pos&&el){pos.x=p.x+dx/v.z;pos.y=p.y+dy/v.z;el.style.left=pos.x+'px';el.style.top=pos.y+'px'}}o.draw(new Set(gesture.points.map(p=>p.id)));return}
  const left=Math.min(x,gesture.x),top=Math.min(y,gesture.y),width=Math.abs(dx),height=Math.abs(dy);Object.assign(box.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});
  const hit=gesture.bounds.filter(({id,w,h})=>{const p=o.positions().get(id);if(!p)return false;const nx=p.x*v.z+v.x,ny=p.y*v.z+v.y;return nx<left+width&&nx+w*v.z>left&&ny<top+height&&ny+h*v.z>top}).map(({id})=>id);ids=new Set([...gesture.base,...hit]);repaint();
 }
 on(map,'pointermove',e=>{if(!gesture)return;lastMove={clientX:e.clientX,clientY:e.clientY};if(!frame)frame=requestAnimationFrame(()=>{frame=0;const next=lastMove;lastMove=null;if(next)applyMove(next)})});
 function finish(){if(frame)cancelAnimationFrame(frame);frame=0;if(lastMove)applyMove(lastMove);lastMove=null;dialog.classList.remove('canvasInteracting');pending++;if(gesture?.kind==='nodes'&&gesture.moved){const before=gesture.points.map(p=>({...p})),after=gesture.points.map(p=>({id:p.id,...o.positions().get(p.id)}));o.persist(after);record(async()=>{o.persist(before);o.refresh();toast('已撤销节点移动')});suppress=true}else if(gesture?.kind==='box'){o.multi(ids.size);repaint();if(ids.size===1)safe(()=>o.select([...ids][0]))}else if(gesture?.kind==='pan')o.saveView();gesture=null;box.hidden=true;map.classList.remove('panning');setTimeout(()=>suppress=false,0)}
 on(map,'pointerup',finish);on(map,'pointercancel',finish);
 on(document,'pointerdown',e=>{if(!menu.contains(e.target))closeMenu()});
 on(document,'keydown',e=>{
  if(!active())return;if(editing(e)){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();safe(()=>o.save())}return}
  if((e.ctrlKey||e.metaKey)&&['a','s','z'].includes(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation();safe(()=>e.key.toLowerCase()==='a'?all():e.key.toLowerCase()==='s'?o.save():undo());return}
  if(e.code==='Space'){e.preventDefault();space=true;setMode(mode)}
  if(e.key==='Delete'){e.preventDefault();safe(()=>command('delete'))}
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(!menu.hidden)closeMenu();else if(ids.size)safe(()=>choose([]));else safe(()=>o.exit())}
  if(e.key==='?'){e.preventDefault();help()}
 },{capture:true});
 on(document,'keyup',e=>{if(e.code==='Space'){space=false;setMode(mode)}});on(window,'blur',()=>{space=false;finish();setMode(mode)});
 return {repaint,select(id){ids=new Set(id?[id]:[]);repaint()},command,help,dispose(){abort.abort();if(frame)cancelAnimationFrame(frame);frame=0;lastMove=null;dialog.classList.remove('canvasInteracting');space=false;gesture=null;menu.remove();box.remove();tools.remove()}};
};
