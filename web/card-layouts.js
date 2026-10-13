/* Geometry contains semantic roles, never project content or persistent asset IDs. */
function frameInitialShots(duration=15){return P?.overviewLayout?.canvas37?.mode==='cards'?[{id:newId(),start:0,end:Math.min(3,duration),action:'',camera:'',dialogue:'',sound:'',expression:'',image:'',locks:{}}]:[]}
function frameCardGeometry(project,options,scoped){
 const o={assetPosition:'top',shotColumns:3,segmentColumns:2,gap:28,shotWidth:230,shotHeight:220,assetWidth:190,assetHeight:180,rolePositions:{},roleSizes:{},...options},cards=[],points=new Map(),sizes=new Map(),roles=new Map();for(const[k,lo,hi]of [['shotColumns',1,8],['segmentColumns',1,4],['gap',12,100],['shotWidth',160,500],['shotHeight',120,500],['assetWidth',120,400],['assetHeight',100,400]])o[k]=Math.max(lo,Math.min(hi,Math.round(Number(o[k])||lo)));let y=0;
 for(let row=0;row<project.segments.length;row+=o.segmentColumns){let x=260,rowHeight=0;
  for(const s of project.segments.slice(row,row+o.segmentColumns)){
   const assets=scoped(s),members=[],shotArea=o.shotColumns*(o.shotWidth+o.gap)-o.gap,assetCols=o.assetPosition==='left'?1:Math.max(1,Math.floor(shotArea/(o.assetWidth+o.gap))),assetRows=Math.ceil(assets.length/assetCols),assetH=assetRows*(o.assetHeight+o.gap),left=o.assetPosition==='left'&&assets.length?o.assetWidth+o.gap:0,shotsY=150+(o.assetPosition==='top'?assetH:0);let w=Math.max(420,shotArea+left+60),h=0;
   const put=(id,role,px,py,nw,nh)=>{const pos=o.rolePositions?.[role]||{x:px,y:py},size=o.roleSizes?.[role]||{w:nw,h:nh};points.set(id,{x:x+pos.x,y:y+pos.y});sizes.set(id,size);roles.set(id,{segmentId:s.id,role});members.push(id);w=Math.max(w,pos.x+size.w+30);h=Math.max(h,pos.y+size.h+30)};
   put('s:'+s.id,'segment',25,20,Math.max(260,shotArea),100);
   assets.forEach((a,i)=>put('ca:'+s.id+':'+a.id,'asset:'+i,30+(i%assetCols)*(o.assetWidth+o.gap),150+Math.floor(i/assetCols)*(o.assetHeight+o.gap),o.assetWidth,o.assetHeight));
   s.shots.forEach((a,i)=>put('h:'+s.id+':'+a.id,'shot:'+i,30+left+(i%o.shotColumns)*(o.shotWidth+o.gap),shotsY+Math.floor(i/o.shotColumns)*(o.shotHeight+o.gap),o.shotWidth,o.shotHeight));
   const bottom=Math.max(shotsY+Math.max(1,Math.ceil(s.shots.length/o.shotColumns))*(o.shotHeight+o.gap),150+(o.assetPosition==='left'?assetH:0));
   put('p:'+s.id,'prompt',30+left,bottom,Math.max(260,shotArea),110);put('o:'+s.id,'output',30+left,bottom+130,Math.max(260,shotArea),190);
   (s.videos||[]).forEach((v,i)=>put('v:'+s.id+':'+v.id,'video:'+i,30+left,bottom+340+i*230,Math.max(260,shotArea),210));
   const card={id:s.id,s,x,y,w,h:h+60,members};cards.push(card);rowHeight=Math.max(rowHeight,card.h);x+=card.w+o.gap*2;
  }y+=rowHeight+o.gap*2;
 }
 return {cards,points,sizes,roles};
}
async function openFrameLayoutManager(context){
 let store=await api('layout-presets'),selected='',options={...store.items[0].options,...context.options()};
 const fields=[['shotColumns','每行镜头数',1,8],['segmentColumns','每行片段数',1,4],['gap','间距',12,100],['shotWidth','镜头宽度',160,500],['shotHeight','镜头高度',120,500],['assetWidth','素材宽度',120,400],['assetHeight','素材高度',100,400]];
 function read(){const out={...options,mode:$('layoutMode').value,assetPosition:$('layoutAssetPosition').value};for(const[k]of fields)out[k]=Number($('layout_'+k).value);if($('layoutCapture').checked){const capture=context.capture();out.rolePositions=capture.positions;out.roleSizes=capture.sizes}return out}
 function show(){modal('卡片模式与布局方案',`<label>已保存方案<select id="layoutPreset"><option value="">当前项目选项</option>${store.items.map(r=>`<option value="${esc(r.id)}" ${r.id===selected?'selected':''}>${esc(r.name)}${r.id===store.defaultId?' · 新项目默认':''}</option>`).join('')}</select></label><label>方案名称<input id="layoutName" value="${esc(store.items.find(r=>r.id===selected)?.name||'我的布局')}"></label><div class="layoutOptionGrid"><label>显示模式<select id="layoutMode"><option value="cards" ${options.mode!=='free'?'selected':''}>片段卡片</option><option value="free" ${options.mode==='free'?'selected':''}>自由画布</option></select></label><label>素材位置<select id="layoutAssetPosition"><option value="top" ${options.assetPosition!=='left'?'selected':''}>镜头上方</option><option value="left" ${options.assetPosition==='left'?'selected':''}>镜头左侧</option></select></label>${fields.map(([k,label,min,max])=>`<label>${label}<input id="layout_${k}" type="number" min="${min}" max="${max}" value="${options[k]}"></label>`).join('')}</div><label class="checkrow"><input id="layoutCapture" type="checkbox">保存当前片段手动位置 / 尺寸（按素材、镜头顺序复用）</label><p class="muted">布局方案只保存排列选项，不携带素材与故事。新项目使用默认方案；已有项目不会自动重排。切换模式保留各自布局，套用方案前保留上一份布局。</p><p id="layoutError" role="alert"></p>`,[
  {label:'取消',action:close},
  {label:'删除自定义方案',action:()=>operate(async()=>{if(!selected||store.items.find(r=>r.id===selected)?.builtin)throw Error('请选择自定义方案');if(!confirm('删除此布局方案？项目布局保持不变。'))return;store=await api('layout-presets',{action:'delete',id:selected,revision:store.revision});selected='';show()})},
  {label:'设为新项目默认',action:()=>operate(async()=>{if(!selected)throw Error('请先保存或选择方案');store=await api('layout-presets',{action:'default',id:selected,revision:store.revision});show();toast('新项目默认布局已保存')})},
  {label:'保存 / 另存方案',action:()=>operate(async()=>{options=read();const custom=store.items.find(r=>r.id===selected&&!r.builtin);store=await api('layout-presets',{action:'save',id:custom?.id,name:$('layoutName').value,options,revision:store.revision});selected=store.savedId;show();toast('布局方案已保存')})},
  {label:'另存为新方案',action:()=>operate(async()=>{options=read();store=await api('layout-presets',{action:'save',name:$('layoutName').value,options,revision:store.revision});selected=store.savedId;show();toast('新布局方案已保存')})},
  {label:'应用到当前项目',class:'primary',action:()=>operate(async()=>{options=(await api('layout-presets',{action:'validate',options:read()})).options;if(await context.apply(options,$('layoutName').value)!==false)close()})}
 ]);$('layoutPreset').onchange=()=>{selected=$('layoutPreset').value;if(selected)options=structuredClone(store.items.find(r=>r.id===selected).options);show()}}
 async function operate(fn){try{await fn()}catch(e){if($('layoutError'))$('layoutError').textContent=e.message}}
 show();
}
