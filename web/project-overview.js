/* Project relationships are derived from export scopes and explicit continuity flags. */
(()=>{
 let owner='',selected='',query='',observer=null,nodes=new Map(),edges=[],data=new Map(),focus='',collapsed=false,animated=true,view={x:40,y:40,z:1},positions=new Map(),uploadTarget='',busy=false,editDirty=false,editBusy=false,sourceStamp='',internalRender=false,detailRevision=0,syncQueued=false,assetUpload=null,controls=null,opening=false,edgePaths=new Map(),nodeSizes=new Map(),painting=null,layoutDirty=false,layoutTimer=0,layoutChain=Promise.resolve();
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
 function measureNodes(){nodeSizes=new Map([...nodes].map(([id,el])=>[id,{w:el.offsetWidth,h:el.offsetHeight}]))}
 function draw(moved=null){const svg=q('.overviewEdges');if(!svg)return;const alive=new Set();for(const e of edges){if(!nodes.has(e.a)||!nodes.has(e.b)||(e.kind==='reference'&&e.b!=='s:'+focus))continue;const key=e.a+'|'+e.b+'|'+e.kind;alive.add(key);let path=edgePaths.get(key);if(!path){path=document.createElementNS('http://www.w3.org/2000/svg','path');svg.append(path);edgePaths.set(key,path)}else if(moved&&!moved.has(e.a)&&!moved.has(e.b))continue;
  const a=nodeSizes.get(e.a)||{w:165,h:100},b=nodeSizes.get(e.b)||{w:165,h:100},ap=positions.get(e.a),bp=positions.get(e.b),vertical=['text','videoGuide'].includes(e.kind);let x1=ap.x+a.w,y1=ap.y+a.h/2,x2=bp.x,y2=bp.y+b.h/2;
  if(vertical){x1=ap.x+a.w/2;y1=ap.y+a.h;x2=bp.x+b.w/2;y2=bp.y}
  const direction=bp.x>=ap.x?1:-1;if(!vertical&&direction<0){x1=ap.x;x2=bp.x+b.w}const bend=direction*Math.max(60,Math.abs(x2-x1)*.5),active=e.a===selected||e.b===selected||e.a==='s:'+focus||e.kind==='output';const value=`M${x1},${y1} C${x1+bend},${y1} ${x2-bend},${y2} ${x2},${y2}`,cls=(active?'active ':'')+(vertical?'inheritance':'');if(path.getAttribute('d')!==value)path.setAttribute('d',value);if(path.getAttribute('class')!==cls)path.setAttribute('class',cls);
 }for(const[key,path]of edgePaths)if(!alive.has(key)){path.remove();edgePaths.delete(key)}}
 function canvasState(){P.overviewLayout||={};P.overviewLayout.canvas37||={positions:{}};return P.overviewLayout.canvas37}
 function queueLayoutSave(){layoutDirty=true;$('saved').textContent='布局待保存';clearTimeout(layoutTimer);layoutTimer=setTimeout(()=>safe(flushOverviewLayout),450)}
 function flushOverviewLayout(){clearTimeout(layoutTimer);if(!layoutDirty||!P)return layoutChain;layoutDirty=false;const pid=P.projectId,layout=structuredClone(P.overviewLayout);layoutChain=layoutChain.catch(()=>{}).then(()=>api('canvas-layout',{projectId:pid,layout})).then(()=>{if(P?.projectId===pid&&!layoutDirty&&!dirty)$('saved').textContent='布局已保存'}).catch(error=>{if(P?.projectId===pid)layoutDirty=true;throw error});return layoutChain}
 const originalFlush=flush;flush=()=>flushOverviewLayout().then(()=>originalFlush());
 function saveView(){current();canvasState().view={...view};queueLayoutSave()}
 function transform(){q('.overviewGraph').style.transform=`translate(${view.x}px,${view.y}px) scale(${view.z})`;q('[data-overview-zoom-label]').textContent=Math.round(view.z*100)+'%'}
 function zoom(factor,x,y){const box=q('.overviewMap').getBoundingClientRect();x??=box.width/2;y??=box.height/2;const z=Math.max(.15,Math.min(2.5,view.z*factor)),ratio=z/view.z;view={x:x-(x-view.x)*ratio,y:y-(y-view.y)*ratio,z};transform();saveView()}
 function fit(){if(!nodes.size)return;let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;for(const [id,node]of nodes){const p=positions.get(id);left=Math.min(left,p.x);top=Math.min(top,p.y);right=Math.max(right,p.x+node.offsetWidth);bottom=Math.max(bottom,p.y+node.offsetHeight)}const box=q('.overviewMap');const z=Math.max(.15,Math.min(1.15,(box.clientWidth-100)/(right-left),(box.clientHeight-130)/(bottom-top)));view={x:(box.clientWidth-(right-left)*z)/2-left*z,y:60+(box.clientHeight-120-(bottom-top)*z)/2-top*z,z};transform();saveView()}
 function refreshModel(){const model=graphData(P);data=new Map(model.list.map(d=>[d.id,d]));edges=model.links}
 function current(){if(P?.projectId!==owner){dialog.close();throw Error('项目已切换，请重新打开总览')}return P;}
 function highlight(){const near=new Set(edges.filter(e=>e.a===selected||e.b===selected).flatMap(e=>[e.a,e.b]));for(const [id,el]of nodes){el.classList.toggle('selected',id===selected);el.classList.toggle('related',id!==selected&&near.has(id));el.classList.toggle('dimmed',false);el.setAttribute('aria-pressed',String(id===selected));}draw();controls?.repaint();}
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
  selected=id;editDirty=false;controls?.select(id);hideMentions();referenceTooltip.hidden=true;frameOverviewEditor.context(d);highlight();q('.overviewDetail video')?.pause?.();
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
  if(syncQueued)return;syncQueued=true;queueMicrotask(()=>{syncQueued=false;if(!dialog.open||internalRender||editBusy)return;safe(async()=>{current();refreshModel();paintCanvas();if(editDirty){if(frameOverviewEditor.fingerprint(data.get(selected))!==sourceStamp)status('项目内容已更新；保留当前输入，请重新载入后核对。',true);return}const d=data.get(selected);if(!d||frameOverviewEditor.fingerprint(d)!==sourceStamp)await select(d?selected:'project',true)})});
 };
 async function canvasAction(cmd){
  if(cmd==='discard'){editDirty=false;await refreshCanvas(selected);status('已重新载入当前项目内容');return}
  if(cmd==='save'){await saveDraft();return}
  if(!await saveDraft())return;current();refreshModel();const d=data.get(selected);if(!d)throw Error('选择项已删除');frameOverviewEditor.context(d);workspaceRender();
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
 function addNode(d,base){const g=q('.overviewGraph'),old=nodes.get(d.id),b=old||document.createElement('button');painting?.add(d.id);b.type='button';b.className='overviewNode '+d.kind;b.dataset.overviewSelect=d.id;const p=nodePosition(d.id,base);positions.set(d.id,p);b.style.left=p.x+'px';b.style.top=p.y+'px';
  const signature=JSON.stringify([d.kind,d.title,d.hint,d.kind==='shot'?d.item.action:'',d.kind==='segment'?d.item.videos?.length:0,d.kind==='asset'?d.item.path:'']),media=d.kind==='asset'?P.media[d.item.path]:'';if(old&&old._canvasSignature===signature&&old._canvasMedia===media){return b}if(old&&old._canvasMedia===media){b.querySelector('.nodeLabel b').textContent=d.title;b.querySelector('.nodeLabel small').textContent=d.hint;if(d.kind==='shot')b.querySelector('.nodeAction').textContent=overviewText(d.item.action||'尚未填写画面动作',d.segment);if(d.kind==='segment')b.querySelector('.nodeBadge').textContent=(d.item.videos?.length||0)+' 视频';b._canvasSignature=signature;return b}b._canvasSignature=signature;b._canvasMedia=media;
  let visual='';if(d.kind==='project')visual='<span class="projectRipple r1"></span><span class="projectRipple r2"></span><span class="projectRipple r3"></span><span class="projectOrb">F</span>';
  if(d.kind==='asset'&&image(d.item.path))visual=`<img src="${image(d.item.path)}" alt="" loading="lazy" decoding="async" draggable="false">`;
  if(d.kind==='video')visual='<span class="canvasVideoCover"><span class="canvasPlay">▶</span><small>选中后播放 · 视频版本记录</small></span>';
  if(d.kind==='output')visual='<span class="canvasOutputIcon">▷</span>';
  b.innerHTML=visual+`<span class="nodeLabel"><b>${esc(d.title)}</b><small>${esc(d.hint)}</small></span>`;
  if(d.kind==='shot')b.innerHTML+=`<p class="nodeAction">${esc(overviewText(d.item.action||'尚未填写画面动作',d.segment))}</p>`;
  if(d.kind==='segment')b.innerHTML+=`<span class="nodeBadge">${d.item.videos?.length||0} 视频</span>`;
  nodes.set(d.id,b);if(!old)g.append(b);return b;
 }
 function paintCanvas(){
  const title=q('.overviewHead h2');if(title)title.textContent=P.title;const g=q('.overviewGraph');if(!g)return;painting=new Set();if(!g.querySelector('.overviewEdges')){g.innerHTML='<svg class="overviewEdges" aria-hidden="true"></svg>';edgePaths=new Map();nodes=new Map();positions=new Map()}
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
  for(const[id,el]of nodes)if(!painting.has(id)){el.remove();nodes.delete(id);positions.delete(id)}painting=null;measureNodes();
  q('[data-overview-collapse]').textContent=collapsed?'展开镜头':'收起镜头';dialog.classList.toggle('canvasAnimated',animated);highlight();transform();
 }
 async function upload(files,targetId){if(busy)throw Error('视频仍在保存，请稍候');current();const target=P.segments.find(s=>s.id===targetId);if(!target)throw Error('目标片段已删除');busy=true;setEditBusy(true);q('.canvasStatus').textContent='正在保存视频…';try{await addSegmentVideos(files,target);current();if(!dialog.open)return;refreshModel();paintCanvas();setEditBusy(false);await select('o:'+target.id);q('.canvasStatus').textContent='视频已保存，导出导演包会携带视频'}finally{busy=false;setEditBusy(false)}}
 function wireCanvas(){
  const map=q('.overviewMap');let pan=null;
  map.addEventListener('wheel',e=>{e.preventDefault();const r=map.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top)},{passive:false});
  map.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();map.classList.add('fileover')}});map.addEventListener('dragleave',e=>{if(!map.contains(e.relatedTarget))map.classList.remove('fileover')});
  map.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();map.classList.remove('fileover');const target=focus;safe(()=>upload([...e.dataTransfer.files],target))});
  const splitter=q('.canvasSplitter');let resize=null;
  function setWidth(w){const max=Math.max(260,(dialog.clientWidth||window.innerWidth)-350);w=Math.max(260,Math.min(max,w));dialog.style.setProperty('--canvas-detail-width',w+'px');splitter.setAttribute('aria-valuenow',Math.round(w));return w}
  setWidth(Number(canvasState().detailWidth)||360);
  splitter.addEventListener('pointerdown',e=>{e.preventDefault();resize={x:e.clientX,w:q('.overviewDetail').offsetWidth};splitter.setPointerCapture(e.pointerId)});
  splitter.addEventListener('pointermove',e=>{if(resize)setWidth(resize.w+resize.x-e.clientX)});
  const finish=()=>{if(resize){resize=null;canvasState().detailWidth=q('.overviewDetail').offsetWidth;queueLayoutSave()}};splitter.addEventListener('pointerup',finish);splitter.addEventListener('pointercancel',finish);
  splitter.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();canvasState().detailWidth=setWidth(q('.overviewDetail').offsetWidth+(e.key==='ArrowLeft'?30:-30));queueLayoutSave()});
 }
 function multiPanel(count){
  if(editBusy||editDirty)return;const detail=q('.overviewDetail');for(const input of detail.querySelectorAll('textarea,input'))input._mentionObserver?.disconnect();
  detail.innerHTML=`<div class="eyebrow">FRAME / 总览</div><h2>${count?'已选择 '+count+' 个节点':'从一个片段开始'}</h2><p class="muted">${count?'拖动任一选中节点可一起移动。右键打开快捷操作。':'先写故事，再添加人物与场景，最后编排镜头。'}</p><div class="canvasStartActions"><button data-canvas-action="add-segment">① 新建片段 / 写故事</button><button data-canvas-action="add-public-asset">② 添加公共素材</button><button data-canvas-action="add-shot">③ 添加手动镜头</button></div><p class="muted">AI 拆镜按需使用，无需配置也可手动创作。</p>`;
 }
 async function removeSelected(ids,record){
  if(!await saveDraft())return;current();refreshModel();const pid=owner,targets=ids.map(id=>data.get(id)).filter(d=>d&&['segment','shot'].includes(d.kind));
  if(!targets.length)throw Error('请选择镜头或片段；公共素材、提示词与项目节点不会批量删除');
  const segments=new Set(targets.filter(d=>d.kind==='segment').map(d=>d.item.id)),shots=new Set(targets.filter(d=>d.kind==='shot'&&!segments.has(d.segment.id)).map(d=>d.item.id));
  const childCount=P.segments.filter(s=>segments.has(s.id)).reduce((n,s)=>n+s.shots.length,0);
  modal('删除所选镜头 / 片段',`<p>将删除 ${segments.size} 个片段（包含 ${childCount} 个镜头）及另外 ${shots.size} 个镜头。</p><p>片段所属素材卡片一并移除；公共素材和媒体文件保留。受影响的排队或运行任务会取消。可在本次会话中用 Ctrl / ⌘ Z 撤销删除；已取消任务不自动恢复。</p>`,[{label:'取消',action:close},{label:'确认删除',class:'danger',action:async()=>{
   if(P?.projectId!==pid)throw Error('项目已切换');await flush();const project=P,stamp=JSON.stringify([P.segments,P.assets]),before={segments:structuredClone(P.segments),assets:structuredClone(P.assets),collapsed:structuredClone(P.groupAssetsCollapsed||{})};
   const next=structuredClone(P.segments.filter(s=>!segments.has(s.id)));
   for(const s of next)if(s.shots.some(h=>shots.has(h.id))){s.shotHistory=[...(s.shotHistory||[]),{savedAt:new Date().toISOString(),reason:'总览批量删除前',duration:s.duration,shots:structuredClone(s.shots),prompt:s.prompt,planning:structuredClone(s.planning||null)}].slice(-5);s.shots=s.shots.filter(h=>!shots.has(h.id));let at=0;for(const h of s.shots){const duration=h.end-h.start;h.start=at;h.end=at+duration;at=h.end}s.prompt=(await api('rebuild',{...s,defaultDialogueLanguage:P.dialogueLanguage||'',assetReferences:availableAssets(s).map(a=>({index:assetNumber(a),name:a.name,kind:a.kind,description:a.description||''}))})).prompt}
   const allShotIds=new Set([...shots,...P.segments.filter(s=>segments.has(s.id)).flatMap(s=>s.shots.map(h=>h.id))]),tasks=await api('tasks');
   for(const task of tasks.tasks||[])if(task.projectId===pid&&(segments.has(task.segmentId)||allShotIds.has(task.shotId))&&['waiting','running'].includes(task.status))await api('task-action',{id:task.id,action:'cancel'});
   if(P!==project||JSON.stringify([P.segments,P.assets])!==stamp)throw Error('项目内容已变化，请重新选择后删除');
   P.segments=next;P.assets=P.assets.filter(a=>a.scope!=='segment'||!segments.has(a.segmentId));for(const id of segments)if(P.groupAssetsCollapsed)delete P.groupAssetsCollapsed[id];keepSegmentSelection(focus,shotId);const expected=JSON.stringify([P.segments,P.assets]);
   record(async()=>{current();if(JSON.stringify([P.segments,P.assets])!==expected)throw Error('删除后项目已修改，请使用对应片段 / 镜头历史恢复，避免覆盖新内容');P.segments=before.segments;P.assets=before.assets;P.groupAssetsCollapsed=before.collapsed;keepSegmentSelection(focus,shotId);changed();await flush();workspaceRender();await refreshCanvas();toast('已恢复删除的片段、镜头与素材；取消的任务需手动重提')});
   changed();await flush();close();workspaceRender();await refreshCanvas();toast('已删除所选项目，可用 Ctrl / ⌘ Z 撤销');
  }}]);
 }
 function installControls(){controls=createFrameCanvasControls({dialog,map:q('.overviewMap'),appearance:()=>canvasState().appearance||{},setAppearance:value=>{current();canvasState().appearance=value;queueLayoutSave()},nodes:()=>nodes,positions:()=>positions,view:()=>view,descriptor:id=>data.get(id),busy:()=>editBusy||busy,save:()=>saveDraft(false),select:id=>select(id,true),multi:multiPanel,draw,fit,saveView,pan:(x,y)=>{view.x=x;view.y=y;transform()},persist:points=>{current();for(const p of points)canvasState().positions[p.id]={x:p.x,y:p.y};queueLayoutSave()},refresh:()=>{paintCanvas()},remove:removeSelected,action:async cmd=>{if(cmd==='upload-video'){if(!await saveDraft())return;uploadTarget=focus;q('#canvasVideoInput').click();return}await canvasAction(cmd)},exit:async()=>{if(await saveDraft(false))dialog.close()}})}
 async function fullscreen(){if(document.fullscreenElement===document.documentElement){await document.exitFullscreen();return}dialog.classList.add('canvasMaximized');if(document.documentElement.requestFullscreen){try{await document.documentElement.requestFullscreen()}catch{toast('已铺满窗口；浏览器全屏可按 F11')}}}
 async function open(){controls?.dispose();controls=null;ensure();await flush();owner=P.projectId;selected='';query='';focus=P.segments[segIndex]?.id||P.segments[0]?.id||'';collapsed=false;refreshModel();const state=canvasState();animated=state.animated!==false;view=state.view&&Number.isFinite(state.view.x)&&Number.isFinite(state.view.y)&&state.view.z>=.15&&state.view.z<=2.5?{...state.view}:{x:40,y:40,z:1};dialog.classList.add('directorCanvas37','canvasMaximized');
  hideMentions();document.body.append($('assetMentions'));document.body.append($('toast'));referenceTooltip.hidden=true;document.body.append(referenceTooltip);
  dialog.innerHTML=`<div class="overviewHead"><div><div class="eyebrow">FRAME / DIRECTOR CANVAS</div><h2>${esc(P.title)}</h2></div><div class="canvasHeadActions"><span class="canvasLive">● 可编辑导演画布</span><button data-canvas-action="add-segment">＋ 片段</button><button data-canvas-tasks>任务中心</button><button data-canvas-home>首页</button><button data-overview-close aria-label="进入详细编辑">详细编辑 ↗</button></div></div><form class="overviewToolbar"><input id="overviewSearch" placeholder="搜索素材、片段或镜头…" aria-label="总览查询"><button>查询</button><span class="canvasToolbarGap"></span><button type="button" data-overview-collapse>收起镜头</button><button type="button" data-overview-help title="快捷键帮助">?</button><details class="canvasMore"><summary>更多</summary><div><button type="button" data-overview-fullscreen>⛶ 浏览器全屏</button><button type="button" data-overview-window>窗口 / 铺满</button><button type="button" data-overview-query="没有视频">查找没有视频的片段</button><button type="button" data-overview-query="未确认素材">查找未确认素材</button><button type="button" data-overview-motion>动效 · ${animated?'开':'关'}</button><button type="button" data-overview-reset>重置布局</button></div></details></form><div class="overviewResults" aria-live="polite"></div><div class="overviewWorkspace"><div class="overviewMap" tabindex="0" aria-label="可拖动缩放的导演画布"><div class="canvasHint">选片段写故事 → 选镜头编辑 → 上传本片段成片</div><div class="overviewGraph"></div><div class="canvasControls"><button data-overview-zoom="out" aria-label="缩小">−</button><span data-overview-zoom-label>100%</span><button data-overview-zoom="in" aria-label="放大">＋</button><button data-overview-fit>适应全部</button><button data-canvas-upload="${esc(focus)}" class="primary">＋ 上传视频</button></div><p class="canvasStatus" role="status">点节点编辑 · 拖空白框选 · 空格拖动平移 · 右键快捷操作</p></div><div class="canvasSplitter" role="separator" tabindex="0" aria-orientation="vertical" aria-label="调整右侧详情宽度" aria-valuemin="260" aria-valuenow="360"></div><aside class="overviewDetail" aria-live="polite"></aside></div><input id="canvasVideoInput" type="file" accept=".mp4,.webm,.mov" multiple hidden><input id="canvasAssetInput" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden>`;
  dialog.append($('toast'));editDirty=false;editBusy=false;
  q('.overviewDetail').addEventListener('input',e=>{if(e.target.matches('[data-canvas-field]')){editDirty=true;status('有未保存修改 · 点击保存或切换节点时保存')}});
  q('.overviewDetail').addEventListener('change',e=>{if(e.target.matches('[data-canvas-field]')){editDirty=true;status('有未保存修改 · 点击保存或切换节点时保存')}});
  q('.overviewDetail').addEventListener('dragover',e=>{if(e.target.closest('[data-canvas-drop]')&&e.dataTransfer.types.includes('Files'))e.preventDefault()});
  q('.overviewDetail').addEventListener('drop',e=>{const drop=e.target.closest('[data-canvas-drop]');if(!drop)return;e.preventDefault();e.stopPropagation();safe(async()=>{if(e.dataTransfer.files.length!==1)throw Error('替换一张素材时请只拖入一张图片');await replaceFromCanvas(e.dataTransfer.files[0],drop.dataset.canvasDrop)})});
  q('#canvasAssetInput').onchange=e=>{const request=assetUpload,files=[...e.target.files];e.target.value='';if(!files.length||!request)return;safe(async()=>{if(P?.projectId!==request.pid)throw Error('项目已切换，文件未写入新项目');if(request.kind==='replace-asset'){if(files.length!==1)throw Error('请只选择一张替换图片');await replaceFromCanvas(files[0],request.assetId);return}const target=P.segments.find(s=>s.id===request.segmentId);if(!target)throw Error('目标片段已删除');segIndex=P.segments.indexOf(target);setEditBusy(true);try{await addAssetFiles(files,request.kind==='add-public-asset'?'public':'segment');await flush();current();workspaceRender()}finally{setEditBusy(false)}await refreshCanvas('s:'+target.id)})};
  paintCanvas();wireCanvas();installControls();q('form').onsubmit=e=>{e.preventDefault();safe(()=>runQuery(q('#overviewSearch').value))};q('#canvasVideoInput').onchange=e=>{const files=[...e.target.files],target=uploadTarget;e.target.value='';if(files.length)safe(()=>upload(files,target))};
  dialog.onclick=e=>safe(async()=>{const target=e.target.closest('button');if(!target)return;
   if(target.hasAttribute('data-overview-help')){controls.help();return}
   if(target.hasAttribute('data-canvas-home')){if(await saveDraft(false)){dialog.close();if(typeof openStartupHome==='function')openStartupHome();else location.href='/'}return}
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
   if(target.hasAttribute('data-overview-motion')){animated=!animated;canvasState().animated=animated;queueLayoutSave();dialog.classList.toggle('canvasAnimated',animated);target.textContent='动效 · '+(animated?'开':'关');return}
   if(target.hasAttribute('data-overview-reset')){current();canvasState().positions={};queueLayoutSave();paintCanvas();fit();return}
   if(target.dataset.overviewJump){await jump(target.dataset.overviewJump,'boardPanel',target.dataset.overviewShot);return}
   if(target.dataset.overviewVideos){await jump(target.dataset.overviewVideos,'segmentVideosPanel');return}
   if(target.dataset.overviewDossier){const a=P.assets.find(a=>a.id===target.dataset.overviewDossier);if(a?.scope==='segment')await jump(a.segmentId,'groupAssetsPanel');else dialog.close();await openAssetDossier(a.id)}
  });
  if(!dialog.open)dialog.showModal();observer?.disconnect();observer=new ResizeObserver(()=>{measureNodes();draw();if(q('.overviewDetail').offsetWidth>dialog.clientWidth-260&&window.innerWidth>700)dialog.style.setProperty('--canvas-detail-width','320px')});observer.observe(q('.overviewMap'));await select(focus?'s:'+focus:'project');if(!state.view)fit();else transform();draw();
 }
 document.addEventListener('fullscreenchange',()=>{const b=q('[data-overview-fullscreen]');if(b)b.textContent=document.fullscreenElement===document.documentElement?'⛶ 退出全屏':'⛶ 全屏'});
 dialog.addEventListener('cancel',e=>{e.preventDefault();safe(async()=>{if(await saveDraft(false))dialog.close()})});
 dialog.addEventListener('close',()=>{document.body.append($('toast'));workspaceRender();observer?.disconnect();controls?.dispose();controls=null;q('.overviewDetail video')?.pause?.();if(document.fullscreenElement===document.documentElement)document.exitFullscreen().catch(()=>{})});window.openFrameOverview=()=>safe(async()=>{if(opening||dialog.open)return;opening=true;try{await open()}finally{opening=false}});$('projectOverview').onclick=openFrameOverview;
})();
