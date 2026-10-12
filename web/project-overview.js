/* Project relationships are derived from export scopes and explicit continuity flags. */
(()=>{
 let owner='',selected='',query='',observer=null,nodes=new Map(),edges=[],data=new Map(),focus='',collapsed=false,animated=true,view={x:40,y:40,z:1},positions=new Map(),uploadTarget='',busy=false,editDirty=false,editBusy=false,sourceStamp='',internalRender=false,detailRevision=0,syncQueued=false,assetUpload=null;
 const dialog=document.createElement('dialog');dialog.id='overviewDialog';dialog.className='overviewDialog';document.body.append(dialog);
 function graphData(project){
  const list=[{id:'project',kind:'project',item:project,title:project.title||'未命名项目',hint:project.segments.length+' 个片段'}],links=[];const assets=(project.assets||[]).filter(a=>!a.deleted);
  for(const a of assets)list.push({id:'a:'+a.id,kind:'asset',item:a,title:a.name||'未命名素材',hint:(a.scope==='segment'?'本组':'公共')+' · '+a.kind});
  for(const [i,s] of project.segments.entries()){
   const sid='s:'+s.id,pid='p:'+s.id,refs=availableAssets(s);links.push({a:'project',b:sid,kind:'project'});for(const [j,h] of s.shots.entries()){const id='h:'+s.id+':'+h.id;list.push({id,kind:'shot',item:h,segment:s,title:'镜头 '+(j+1),hint:h.start+'–'+h.end+' 秒 · '+(h.camera||'机位未设置')});links.push({a:sid,b:id,kind:'shot'});}
   list.push({id:sid,kind:'segment',item:s,title:s.title,hint:s.duration+' 秒 · '+s.shots.length+' 镜头',refs});list.push({id:pid,kind:'prompt',item:s,title:'H3 最终提示词',hint:s.title+' · '+(s.promptHistory?.length||0)+' 条历史',refs});links.push({a:sid,b:pid,kind:'prompt'});
   for(const a of refs)links.push({a:'a:'+a.id,b:sid,kind:'reference'});
   if(i>0&&s.continuity)links.push({a:'s:'+project.segments[i-1].id,b:sid,kind:'text'});
   if(i>0&&(project.directorGuide?.continuityEnabled??true)&&(s.guideFromPrev??s.continuity))links.push({a:'s:'+project.segments[i-1].id,b:sid,kind:'videoGuide'});
   list.push({id:'o:'+s.id,kind:'output',item:s,title:'本片段成片',hint:(s.videos||[]).length+' 个视频版本 · 点击上传'});for(const h of s.shots)links.push({a:'h:'+s.id+':'+h.id,b:'o:'+s.id,kind:'output'});if(!s.shots.length)links.push({a:sid,b:'o:'+s.id,kind:'output'});for(const v of s.videos||[]){const id='v:'+s.id+':'+v.id;list.push({id,kind:'video',item:v,segment:s,title:v.title||v.name||'视频成品',hint:s.title});links.push({a:'o:'+s.id,b:id,kind:'video'});}
  }
  return {list,links};
 }
 // Expose only the pure topology builder for checks and future project migrations.
 window.frameOverviewGraph=graphData;
 const overviewText=(text,s)=>String(text||'').replace(/(<)?(@?Picture\s+)(\d+)(>)?/gi,(full,open,prefix,n,end)=>{const active=availableAssets(s),original=assetByNumber(Number(n));const i=active.indexOf(original);return i<0?'[缺失引用：'+n+']':(open||'')+prefix+(i+1)+(end||'')});
 const q=selector=>dialog.querySelector(selector),goButton=(id,title)=>`<button data-overview-select="${esc(id)}">${esc(title)}</button>`;
 function draw(){const svg=q('.overviewEdges');if(!svg)return;svg.innerHTML=edges.filter(e=>nodes.has(e.a)&&nodes.has(e.b)&&(e.kind!=='reference'||e.b==='s:'+focus)).map(e=>{const a=nodes.get(e.a),b=nodes.get(e.b),ap=positions.get(e.a),bp=positions.get(e.b),vertical=['text','videoGuide'].includes(e.kind);let x1=ap.x+a.offsetWidth,y1=ap.y+a.offsetHeight/2,x2=bp.x,y2=bp.y+b.offsetHeight/2;
 if(vertical){x1=ap.x+a.offsetWidth/2;y1=ap.y+a.offsetHeight;x2=bp.x+b.offsetWidth/2;y2=bp.y}
 const direction=bp.x>=ap.x?1:-1;if(!vertical&&direction<0){x1=ap.x;x2=bp.x+b.offsetWidth}const bend=direction*Math.max(60,Math.abs(x2-x1)*.5),active=e.a===selected||e.b===selected||e.a==='s:'+focus||e.kind==='output';return `<path class="${active?'active ':''}${vertical?'inheritance':''}" d="M${x1},${y1} C${x1+bend},${y1} ${x2-bend},${y2} ${x2},${y2}"/>`}).join('')}
 function canvasState(){P.overviewLayout||={};P.overviewLayout.canvas37||={positions:{}};return P.overviewLayout.canvas37}
 function saveView(){current();canvasState().view={...view};changed()}
 function transform(){q('.overviewGraph').style.transform=`translate(${view.x}px,${view.y}px) scale(${view.z})`;q('[data-overview-zoom-label]').textContent=Math.round(view.z*100)+'%'}
 function zoom(factor,x,y){const box=q('.overviewMap').getBoundingClientRect();x??=box.width/2;y??=box.height/2;const z=Math.max(.15,Math.min(2.5,view.z*factor)),ratio=z/view.z;view={x:x-(x-view.x)*ratio,y:y-(y-view.y)*ratio,z};transform();saveView()}
 function fit(){if(!nodes.size)return;let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;for(const [id,node]of nodes){const p=positions.get(id);left=Math.min(left,p.x);top=Math.min(top,p.y);right=Math.max(right,p.x+node.offsetWidth);bottom=Math.max(bottom,p.y+node.offsetHeight)}const box=q('.overviewMap');const z=Math.max(.15,Math.min(1.15,(box.clientWidth-100)/(right-left),(box.clientHeight-130)/(bottom-top)));view={x:(box.clientWidth-(right-left)*z)/2-left*z,y:60+(box.clientHeight-120-(bottom-top)*z)/2-top*z,z};transform();saveView()}
 function refreshModel(){const model=graphData(P);data=new Map(model.list.map(d=>[d.id,d]));edges=model.links}
 function current(){if(P?.projectId!==owner){dialog.close();throw Error('项目已切换，请重新打开总览')}return P;}
 function highlight(){const near=new Set(edges.filter(e=>e.a===selected||e.b===selected).flatMap(e=>[e.a,e.b]));for(const [id,el]of nodes){el.classList.toggle('selected',id===selected);el.classList.toggle('related',id!==selected&&near.has(id));el.classList.toggle('dimmed',false);el.setAttribute('aria-pressed',String(id===selected));}draw();}
 async function jump(segmentId,panel='boardPanel',targetShot=''){current();const s=P.segments.find(s=>s.id===segmentId);if(!s)throw Error('片段已删除');await flush();current();segIndex=P.segments.indexOf(s);shotId=s.shots.find(h=>h.id===targetShot)?.id||s.shots[0]?.id||'';dialog.close();render();if($(panel)){$(panel).open=true;$(panel).scrollIntoView?.({behavior:'smooth',block:'start'})}}
 function status(message,error=false){const el=q('.canvasEditStatus')||q('.canvasStatus');if(el){el.textContent=message;el.classList.toggle('error',error)}}
 function setEditBusy(value){editBusy=value;const detail=q('.overviewDetail');if(!detail)return;detail.setAttribute('aria-busy',String(value));for(const el of detail.querySelectorAll('input,textarea,select,button')){if(value){el.dataset.canvasWasDisabled=String(el.disabled);el.disabled=true}else if(el.dataset.canvasWasDisabled!==undefined){el.disabled=el.dataset.canvasWasDisabled==='true';delete el.dataset.canvasWasDisabled}}}
 function workspaceRender(){internalRender=true;try{segmentVideoOwner='';render()}finally{internalRender=false}}
 async function saveDraft(refresh=true){
  if(editBusy){status('正在保存，请稍候');return false}
  current();refreshModel();const d=data.get(selected);if(!d){status('选择项已删除，修改未应用。请重新载入。',true);return false}
  if(!editDirty)return true;
  if(frameOverviewEditor.fingerprint(d)!==sourceStamp){status('内容已在其他操作中更新，修改未覆盖。请重新载入后核对。',true);return false}
  const values=frameOverviewEditor.collect(q('.overviewDetail'));setEditBusy(true);status('正在保存并同步提示词…');
  const scroll=q('.overviewDetail').scrollTop;
  try{await frameOverviewEditor.save(d,values);current();refreshModel();sourceStamp=frameOverviewEditor.fingerprint(data.get(selected));editDirty=false;workspaceRender();paintCanvas();status('已保存 · 与工作区共用同一项目');}
  catch(e){refreshModel();sourceStamp=frameOverviewEditor.fingerprint(data.get(selected));status('保存失败：'+e.message+'。输入仍保留，可修正后重试。',true);return false}
  finally{setEditBusy(false)}
  if(refresh){await select(data.has(selected)?selected:'project',true);q('.overviewDetail').scrollTop=scroll;status('已保存 · 与工作区共用同一项目')}
  return true;
 }
 async function select(id,force=false){
  current();if(editBusy)return;if(!force&&id===selected)return;
  if(!force&&editDirty&&!await saveDraft(false))return;
  refreshModel();const d=data.get(id);if(!d)return;
  const target=d.segment||(['segment','prompt','output'].includes(d.kind)?d.item:null)||(d.kind==='asset'&&d.item.scope==='segment'?P.segments.find(s=>s.id===d.item.segmentId):null);
  if(target&&target.id!==focus){focus=target.id;collapsed=false;paintCanvas()}
  selected=id;editDirty=false;hideMentions();referenceTooltip.hidden=true;frameOverviewEditor.context(d);workspaceRender();highlight();q('.overviewDetail video')?.pause?.();
  const revision=++detailRevision,detail=q('.overviewDetail');for(const input of detail.querySelectorAll('textarea,input'))input._mentionObserver?.disconnect();detail.innerHTML=frameOverviewEditor.form(d);sourceStamp=frameOverviewEditor.fingerprint(d);refreshMentionEditors();
  const upload=q('.canvasControls [data-canvas-upload]');if(upload)upload.dataset.canvasUpload=focus;
  if(d.kind==='prompt'){
   const pid=owner;try{await flush();current();const result=await api('compiled-prompt',{projectId:pid,segmentId:d.item.id});if(!dialog.open||P?.projectId!==pid||selected!==id||revision!==detailRevision)return;
    q('#canvasPromptLoading').textContent=result.warnings?.length?'输出检查：'+result.warnings.join('；'):'当前最终输出；可修改后保存';q('#canvas_prompt').value=result.prompt;q('#canvas_prompt').disabled=false;
   }catch(e){if(revision===detailRevision&&q('#canvasPromptLoading'))q('#canvasPromptLoading').textContent='读取失败：'+e.message}
  }
 }
 async function refreshCanvas(id=selected){current();refreshModel();if(!P.segments.some(s=>s.id===focus))focus=seg()?.id||P.segments[0]?.id||'';paintCanvas();await select(data.has(id)?id:(focus?'s:'+focus:'project'),true);if(query)runQuery(query)}
 window.frameOverviewSync=()=>{
  if(!dialog.open||internalRender||editBusy)return;
  if(P?.projectId!==owner){dialog.close();return}
  if(syncQueued)return;syncQueued=true;queueMicrotask(()=>{syncQueued=false;if(!dialog.open||internalRender||editBusy)return;safe(async()=>{current();refreshModel();paintCanvas();if(editDirty){if(frameOverviewEditor.fingerprint(data.get(selected))!==sourceStamp)status('项目内容已更新；保留当前输入，请重新载入后核对。',true);return}await select(data.has(selected)?selected:'project',true)})});
 };
 async function canvasAction(cmd){
  if(cmd==='discard'){editDirty=false;await refreshCanvas(selected);status('已重新载入当前项目内容');return}
  if(cmd==='save'){await saveDraft();return}
  if(!await saveDraft())return;current();refreshModel();const d=data.get(selected);if(!d)throw Error('选择项已删除');frameOverviewEditor.context(d);
  if(cmd==='copy-prompt'){const text=q('#canvas_prompt');if(!text||text.disabled)throw Error('提示词尚未读取');await navigator.clipboard.writeText(text.value);toast('已复制最终提示词');return}
  if(['replace-asset','add-local-asset','add-public-asset'].includes(cmd)){
   assetUpload={pid:owner,kind:cmd,assetId:d.kind==='asset'?d.item.id:'',segmentId:focus};q('#canvasAssetInput').value='';q('#canvasAssetInput').click();return;
  }
  let nextId=selected;setEditBusy(true);
  try{const result=await frameOverviewEditor.command(cmd,d);nextId=result?.select||selected;current();workspaceRender();editDirty=false;refreshModel();sourceStamp=frameOverviewEditor.fingerprint(data.get(selected));paintCanvas()}finally{setEditBusy(false)}
  await refreshCanvas(nextId);
 }
 async function replaceFromCanvas(file,assetId){
  if(!await saveDraft())return;current();setEditBusy(true);
  try{await replaceAssetImage(assetId,file);await flush();current();editDirty=false;workspaceRender()}finally{setEditBusy(false)}
  await refreshCanvas('a:'+assetId);status('图片已替换，编号与引用保留；请重新确认说明。');
 }
 function runQuery(text){current();query=text.trim();const lower=query.toLowerCase();let hits=[];
  if(/未确认/.test(query))hits=[...data.values()].filter(d=>d.kind==='asset'&&!assetVisionCurrent(d.item));
  else if(/没有视频|无视频|没视频/.test(query))hits=[...data.values()].filter(d=>d.kind==='segment'&&!d.item.videos?.length);
  else if(/缺失|缺图/.test(query))hits=[...data.values()].filter(d=>d.kind==='asset'&&!image(d.item.path));
  else hits=[...data.values()].filter(d=>(d.title+' '+d.hint+' '+(d.item.description||'')+' '+(d.item.storyText||'')).toLowerCase().includes(lower));
  q('.overviewResults').innerHTML=query?`<span>${hits.length} 个结果</span>`+hits.map(d=>goButton(d.id,d.title)).join(''):'';
  if(!query){highlight();return}const ids=new Set(hits.map(d=>d.id));for(const [id,node]of nodes)node.classList.toggle('dimmed',!ids.has(id));
 }
 function nodePosition(id,base){const saved=canvasState().positions?.[id];return saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)?{...saved}:{...base}}
 function addNode(d,base){const b=document.createElement('button');b.type='button';b.className='overviewNode '+d.kind;b.dataset.overviewSelect=d.id;const p=nodePosition(d.id,base);positions.set(d.id,p);b.style.left=p.x+'px';b.style.top=p.y+'px';
  let visual='';if(d.kind==='project')visual='<span class="projectRipple r1"></span><span class="projectRipple r2"></span><span class="projectRipple r3"></span><span class="projectOrb">F</span>';
  if(d.kind==='asset'&&image(d.item.path))visual=`<img src="${image(d.item.path)}" alt="" draggable="false">`;
  if(d.kind==='video')visual=(videoMediaSource(d.item)?`<span class="canvasVideoCover"><video muted playsinline preload="metadata" src="${videoMediaSource(d.item)}#t=0.1"></video><span class="canvasPlay">▶</span></span>`:'<span class="canvasVideoCover"><span class="canvasPlay">▶</span><small>点击播放 · 本片段视频</small></span>');
  if(d.kind==='output')visual='<span class="canvasOutputIcon">▷</span>';
  b.innerHTML=visual+`<span class="nodeLabel"><b>${esc(d.title)}</b><small>${esc(d.hint)}</small></span>`;
  if(d.kind==='shot')b.innerHTML+=`<p class="nodeAction">${esc(overviewText(d.item.action||'尚未填写画面动作',d.segment))}</p>`;
  if(d.kind==='segment')b.innerHTML+=`<span class="nodeBadge">${d.item.videos?.length||0} 视频</span>`;
  nodes.set(d.id,b);q('.overviewGraph').append(b);let drag=null,moved=false;
  b.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.stopPropagation();drag={x:e.clientX,y:e.clientY,px:p.x,py:p.y};moved=false;b.setPointerCapture(e.pointerId)});
  b.addEventListener('pointermove',e=>{if(!drag)return;const dx=(e.clientX-drag.x)/view.z,dy=(e.clientY-drag.y)/view.z;if(Math.abs(dx)+Math.abs(dy)>4)moved=true;if(!moved)return;p.x=drag.px+dx;p.y=drag.py+dy;b.style.left=p.x+'px';b.style.top=p.y+'px';draw()});
  const finish=()=>{if(drag&&moved&&P?.projectId===owner){canvasState().positions[d.id]={...p};changed()}drag=null};b.addEventListener('pointerup',finish);b.addEventListener('pointercancel',finish);b.addEventListener('click',e=>{if(moved){e.stopPropagation();moved=false}});return b;
 }
 function paintCanvas(){
  const title=q('.overviewHead h2');if(title)title.textContent=P.title;nodes=new Map();positions=new Map();const g=q('.overviewGraph');if(!g)return;g.innerHTML='<svg class="overviewEdges" aria-hidden="true"></svg>';
  addNode(data.get('project'),{x:0,y:155});
  P.segments.forEach((s,i)=>addNode(data.get('s:'+s.id),{x:265,y:30+i*125}));
  const s=P.segments.find(s=>s.id===focus);if(s){
   if(!collapsed)s.shots.forEach((h,i)=>addNode(data.get('h:'+s.id+':'+h.id),{x:570,y:i*140}));
   addNode(data.get('o:'+s.id),{x:970,y:20});
   (s.videos||[]).forEach((v,i)=>addNode(data.get('v:'+s.id+':'+v.id),{x:970,y:155+i*220}));
   addNode(data.get('p:'+s.id),{x:265,y:Math.max(P.segments.length*125+55,430)});
   const ry=Math.max(collapsed?0:s.shots.length*140,200)+45;
   availableAssets(s).forEach((a,i)=>{const d=data.get('a:'+a.id);addNode({...d,hint:'Picture '+(i+1)+' · '+d.hint},{x:570+(i%2)*185,y:ry+Math.floor(i/2)*170})});
  }
  q('[data-overview-collapse]').textContent=collapsed?'展开镜头':'收起镜头';dialog.classList.toggle('canvasAnimated',animated);highlight();transform();
 }
 async function upload(files,targetId){if(busy)throw Error('视频仍在保存，请稍候');current();const target=P.segments.find(s=>s.id===targetId);if(!target)throw Error('目标片段已删除');busy=true;setEditBusy(true);q('.canvasStatus').textContent='正在保存视频…';try{await addSegmentVideos(files,target);current();if(!dialog.open)return;refreshModel();paintCanvas();setEditBusy(false);await select('o:'+target.id);q('.canvasStatus').textContent='视频已保存，导出导演包会携带视频'}finally{busy=false;setEditBusy(false)}}
 function wireCanvas(){
  const map=q('.overviewMap');let pan=null;
  map.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button,input'))return;pan={x:e.clientX,y:e.clientY,px:view.x,py:view.y};map.setPointerCapture(e.pointerId);map.classList.add('panning')});
  map.addEventListener('pointermove',e=>{if(!pan)return;view.x=pan.px+e.clientX-pan.x;view.y=pan.py+e.clientY-pan.y;transform()});
  const end=()=>{if(pan){pan=null;map.classList.remove('panning');saveView()}};map.addEventListener('pointerup',end);map.addEventListener('pointercancel',end);
  map.addEventListener('wheel',e=>{e.preventDefault();const r=map.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top)},{passive:false});
  map.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();map.classList.add('fileover')}});map.addEventListener('dragleave',e=>{if(!map.contains(e.relatedTarget))map.classList.remove('fileover')});
  map.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();map.classList.remove('fileover');const target=focus;safe(()=>upload([...e.dataTransfer.files],target))});
  const splitter=q('.canvasSplitter');let resize=null;
  function setWidth(w){const max=Math.max(260,(dialog.clientWidth||window.innerWidth)-350);w=Math.max(260,Math.min(max,w));dialog.style.setProperty('--canvas-detail-width',w+'px');splitter.setAttribute('aria-valuenow',Math.round(w));return w}
  setWidth(Number(canvasState().detailWidth)||360);
  splitter.addEventListener('pointerdown',e=>{e.preventDefault();resize={x:e.clientX,w:q('.overviewDetail').offsetWidth};splitter.setPointerCapture(e.pointerId)});
  splitter.addEventListener('pointermove',e=>{if(resize)setWidth(resize.w+resize.x-e.clientX)});
  const finish=()=>{if(resize){resize=null;canvasState().detailWidth=q('.overviewDetail').offsetWidth;changed()}};splitter.addEventListener('pointerup',finish);splitter.addEventListener('pointercancel',finish);
  splitter.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();canvasState().detailWidth=setWidth(q('.overviewDetail').offsetWidth+(e.key==='ArrowLeft'?30:-30));changed()});
 }
 async function fullscreen(){if(document.fullscreenElement===document.documentElement){await document.exitFullscreen();return}dialog.classList.add('canvasMaximized');if(document.documentElement.requestFullscreen){try{await document.documentElement.requestFullscreen()}catch{toast('已铺满窗口；浏览器全屏可按 F11')}}}
 async function open(){ensure();await flush();owner=P.projectId;selected='';query='';focus=P.segments[segIndex]?.id||P.segments[0]?.id||'';collapsed=false;refreshModel();const state=canvasState();animated=state.animated!==false;view=state.view&&Number.isFinite(state.view.x)&&Number.isFinite(state.view.y)&&state.view.z>=.15&&state.view.z<=2.5?{...state.view}:{x:40,y:40,z:1};dialog.classList.add('directorCanvas37','canvasMaximized');
  hideMentions();document.body.append($('assetMentions'));referenceTooltip.hidden=true;document.body.append(referenceTooltip);
  dialog.innerHTML=`<div class="overviewHead"><div><div class="eyebrow">FRAME / DIRECTOR CANVAS</div><h2>${esc(P.title)}</h2></div><div class="canvasHeadActions"><span class="canvasLive">● 可编辑导演画布</span><button data-canvas-action="add-segment">＋ 片段</button><button data-canvas-tasks>任务中心</button><button data-overview-fullscreen>⛶ 全屏</button><button data-overview-window>窗口 / 铺满</button><button data-overview-close aria-label="关闭项目总览">✕</button></div></div><form class="overviewToolbar"><input id="overviewSearch" placeholder="搜索素材、片段或镜头…" aria-label="总览查询"><button>查询</button><button type="button" data-overview-query="没有视频">没有视频</button><button type="button" data-overview-query="未确认素材">未确认素材</button><span class="canvasToolbarGap"></span><button type="button" data-overview-collapse>收起镜头</button><button type="button" data-overview-motion>动效 · ${animated?'开':'关'}</button><button type="button" data-overview-reset>重置布局</button></form><div class="overviewResults" aria-live="polite"></div><div class="overviewWorkspace"><div class="overviewMap" aria-label="可拖动缩放的导演画布"><div class="canvasHint">选片段写故事 → 选镜头编辑 → 上传本片段成片</div><div class="overviewGraph"></div><div class="canvasControls"><button data-overview-zoom="out" aria-label="缩小">−</button><span data-overview-zoom-label>100%</span><button data-overview-zoom="in" aria-label="放大">＋</button><button data-overview-fit>适应全部</button><button data-canvas-upload="${esc(focus)}" class="primary">＋ 上传视频</button></div><p class="canvasStatus" role="status">点击节点直接编辑 · 拖空白平移 · 滚轮缩放 · 拖节点改变布局</p></div><div class="canvasSplitter" role="separator" tabindex="0" aria-orientation="vertical" aria-label="调整右侧详情宽度" aria-valuemin="260" aria-valuenow="360"></div><aside class="overviewDetail" aria-live="polite"></aside></div><input id="canvasVideoInput" type="file" accept=".mp4,.webm,.mov" multiple hidden><input id="canvasAssetInput" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden>`;
  editDirty=false;editBusy=false;
  q('.overviewDetail').addEventListener('input',e=>{if(e.target.matches('[data-canvas-field]')){editDirty=true;status('有未保存修改 · 点击保存或切换节点时保存')}});
  q('.overviewDetail').addEventListener('change',e=>{if(e.target.matches('[data-canvas-field]')){editDirty=true;status('有未保存修改 · 点击保存或切换节点时保存')}});
  q('.overviewDetail').addEventListener('dragover',e=>{if(e.target.closest('[data-canvas-drop]')&&e.dataTransfer.types.includes('Files'))e.preventDefault()});
  q('.overviewDetail').addEventListener('drop',e=>{const drop=e.target.closest('[data-canvas-drop]');if(!drop)return;e.preventDefault();e.stopPropagation();safe(async()=>{if(e.dataTransfer.files.length!==1)throw Error('替换一张素材时请只拖入一张图片');await replaceFromCanvas(e.dataTransfer.files[0],drop.dataset.canvasDrop)})});
  q('#canvasAssetInput').onchange=e=>{const request=assetUpload,files=[...e.target.files];e.target.value='';if(!files.length||!request)return;safe(async()=>{if(P?.projectId!==request.pid)throw Error('项目已切换，文件未写入新项目');if(request.kind==='replace-asset'){if(files.length!==1)throw Error('请只选择一张替换图片');await replaceFromCanvas(files[0],request.assetId);return}const target=P.segments.find(s=>s.id===request.segmentId);if(!target)throw Error('目标片段已删除');segIndex=P.segments.indexOf(target);setEditBusy(true);try{await addAssetFiles(files,request.kind==='add-public-asset'?'public':'segment');await flush();current();workspaceRender()}finally{setEditBusy(false)}await refreshCanvas('s:'+target.id)})};
  paintCanvas();wireCanvas();q('form').onsubmit=e=>{e.preventDefault();safe(()=>runQuery(q('#overviewSearch').value))};q('#canvasVideoInput').onchange=e=>{const files=[...e.target.files],target=uploadTarget;e.target.value='';if(files.length)safe(()=>upload(files,target))};
  dialog.onclick=e=>safe(async()=>{const target=e.target.closest('button');if(!target)return;
   if(target.hasAttribute('data-overview-close')){if(!await saveDraft(false))return;if(document.fullscreenElement===document.documentElement)await document.exitFullscreen();dialog.close();return}
   if(target.hasAttribute('data-overview-fullscreen')){await fullscreen();return}
   if(target.hasAttribute('data-overview-window')){if(document.fullscreenElement===document.documentElement)await document.exitFullscreen();dialog.classList.toggle('canvasMaximized');return}
   if(target.dataset.overviewSelect){await select(target.dataset.overviewSelect);return}
   if(target.dataset.canvasAction){await canvasAction(target.dataset.canvasAction);return}
   if(target.hasAttribute('data-canvas-tasks')){if(await saveDraft())openTaskCenter();return}
   if(target.hasAttribute('data-canvas-upload')){if(!await saveDraft())return;uploadTarget=target.dataset.canvasUpload||focus;q('#canvasVideoInput').click();return}
   if(target.dataset.overviewZoom){zoom(target.dataset.overviewZoom==='in'?1.2:1/1.2);return}
   if(target.hasAttribute('data-overview-fit')){fit();return}
   if(target.dataset.overviewQuery){q('#overviewSearch').value=target.dataset.overviewQuery;runQuery(target.dataset.overviewQuery);return}
   if(target.hasAttribute('data-overview-collapse')){collapsed=!collapsed;paintCanvas();return}
   if(target.hasAttribute('data-overview-motion')){animated=!animated;canvasState().animated=animated;changed();dialog.classList.toggle('canvasAnimated',animated);target.textContent='动效 · '+(animated?'开':'关');return}
   if(target.hasAttribute('data-overview-reset')){current();canvasState().positions={};changed();paintCanvas();fit();return}
   if(target.dataset.overviewJump){await jump(target.dataset.overviewJump,'boardPanel',target.dataset.overviewShot);return}
   if(target.dataset.overviewVideos){await jump(target.dataset.overviewVideos,'segmentVideosPanel');return}
   if(target.dataset.overviewDossier){const a=P.assets.find(a=>a.id===target.dataset.overviewDossier);if(a?.scope==='segment')await jump(a.segmentId,'groupAssetsPanel');else dialog.close();await openAssetDossier(a.id)}
  });
  if(!dialog.open)dialog.showModal();observer?.disconnect();observer=new ResizeObserver(()=>{draw();if(q('.overviewDetail').offsetWidth>dialog.clientWidth-260&&window.innerWidth>700)dialog.style.setProperty('--canvas-detail-width','320px')});observer.observe(q('.overviewMap'));await select(focus?'s:'+focus:'project');if(!state.view)fit();else transform();draw();
 }
 document.addEventListener('fullscreenchange',()=>{const b=q('[data-overview-fullscreen]');if(b)b.textContent=document.fullscreenElement===document.documentElement?'⛶ 退出全屏':'⛶ 全屏'});
 dialog.addEventListener('cancel',e=>{e.preventDefault();safe(async()=>{if(await saveDraft(false))dialog.close()})});
 dialog.addEventListener('close',()=>{workspaceRender();observer?.disconnect();q('.overviewDetail video')?.pause?.();if(document.fullscreenElement===document.documentElement)document.exitFullscreen().catch(()=>{})});$('projectOverview').onclick=()=>safe(open);
})();
