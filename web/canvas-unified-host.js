/* Both layouts share one React Flow instance and the existing native services. */
(()=>{
 let dialog,root,nav,app,active=false,activating=false,refreshFrame=0;
 const B=()=>window.frameOverviewBridge;
 const emit=()=>{if(!active||refreshFrame)return;refreshFrame=requestAnimationFrame(()=>{refreshFrame=0;app?.refresh()})};
 async function activate(){if(activating)return;activating=true;try{
  dialog=document.getElementById('overviewDialog');if(!dialog?.open)return;
  if(!window.frameFlowApp)throw Error('本地画布组件未载入，请重新解压完整程序包');
  if(!root?.isConnected){root=document.createElement('div');root.id='frameFlowRoot';root.className='rfa-root';root.setAttribute('aria-label','统一画布');dialog.querySelector('.overviewMap').append(root);nav=document.createElement('div');nav.className='rfa-nav-host';dialog.querySelector('.frameDockSlot.left').prepend(nav);app=frameFlowApp.mount(root,nav,window.frameFlowHost)}
  active=true;dialog.dataset.cardflow='true';dialog.dataset.flowLeftClosed||='false';root.hidden=false;nav.hidden=false;
  if(!root._dockReady){root._dockReady=true;await dialog.querySelector('.unifiedEditorPanel')?._dock?.set('right')}
  dialog._frameDocking?.layout();app.refresh();app.resume();
 }finally{activating=false}}
 async function open(mode){if(!P){toast('先打开项目');return}if(!document.getElementById('overviewDialog')?.open)await openFrameOverview();else await activate();if(mode)await app?.setMode(mode)}
 function dispose(){active=false;if(dialog)dialog.dataset.cardflow='false';cancelAnimationFrame(refreshFrame);refreshFrame=0;app?.unmount();app=null;root?.remove();nav?.remove();root=null;nav=null}
 async function prepared(fn){if(!await B().prepare())throw Error('当前编辑尚未保存');return fn()}
 async function preview(id){const a=P.assets.find(a=>a.id===id&&!a.deleted);if(!a)throw Error('素材已删除');const src=mediaSource(a.path);if(!src)throw Error('素材文件缺失，请替换文件');if(assetMediaType(a)==='image')return openImageViewer(a.path);modal(a.name,assetMediaTag(a),[{label:'关闭',action:close}]);const media=document.querySelectorAll('#modalBody audio,#modalBody video');$('modal').addEventListener('close',()=>media.forEach(v=>v.pause()),{once:true})}
 async function aiSplit(id){await prepared(async()=>{const d=B().descriptor(id);if(!d)throw Error('目标已删除');let target=d,message;
  if(d.kind==='shot'){target={kind:'segment',item:d.segment};message='仅将当前片段中 '+d.item.start+'–'+d.item.end+' 秒的镜头拆成更清晰的多个镜头。保持这个时间范围、原对白与素材引用；该片段其他镜头必须保持原样。先提供可核对的拆镜草案，确认后才应用。当前镜头：'+d.item.action}
  else if(d.kind==='segment')message='将本片段故事拆成完整、连续的镜头。保持原时长、对白、素材身份和剧情结局，先给拆镜草案供预览，不自动覆盖。';
  else if(d.kind==='asset'){target={kind:'project',item:P};message='基于素材“'+d.item.name+'”（ID '+d.item.id+'，'+mediaAssetLabel(d.item)+'）提出新分镜方案。保留已有片段，先输出可预览的 storyPlan，不自动应用。'+(assetMediaType(d.item)==='image'?'以随附实际图片为视觉依据，不编造未见信息。':'只能使用已有说明和已保存分析；未实际分析的音视频不得声称已观看或听取。素材说明：'+(d.item.description||''))}
  else throw Error('请选择素材、片段或镜头');
  await frameAgent.open(target);const panel=dialog.querySelector('.frameAgentNode');const input=panel?.querySelector('textarea[data-native-agent]');if(input){if(input.value.trim())message=input.value+'\n\n'+message;input.value=message;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus()}
  if(d.kind==='asset'&&assetMediaType(d.item)==='image'&&image(d.item.path)){const blob=await fetch(image(d.item.path)).then(r=>r.blob());if(blob.size<=8*1024*1024){const file=new File([blob],d.item.name+'.'+(blob.type.split('/')[1]||'png'),{type:blob.type}),dt=new DataTransfer();dt.items.add(file);const input=panel.querySelector('[data-agent-file]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))}else toast('已准备拆镜要求；图片超过 8MB，请在对话中附加压缩图。')}
  toast('已准备当前目标的 AI 拆镜对话；发送后预览结果，再确认应用');
 })}
 window.frameFlowHost={
  project:()=>P,layout:()=>B().flowLayout(),saveLayout:v=>B().saveFlowLayout(v),appearance:()=>B().appearance(),setAppearance:v=>B().setAppearance(v),
  text:(v,s)=>frameOverviewEditor.scopedText(String(v||''),s),media:a=>mediaSource(typeof a==='string'?a:a?.path)||'',mediaType:a=>assetMediaType(a),number:a=>assetNumber(a),scoped:s=>allScopedAssets(s),imageScoped:s=>availableAssets(s),
  fieldValue:(id,key)=>frameOverviewEditor.fieldValue(B().descriptor(id),key),mode:s=>segmentMode(s),modes:()=>GENERATION_MODES.slice(0,4),imageInputs:s=>[...new Map([...allScopedAssets(s).filter(a=>assetMediaType(a)==='image').map(a=>[a.path,a.name]),...s.shots.flatMap(h=>['image','firstFrame','lastFrame'].filter(k=>h[k]).map(k=>[h[k],'镜头图片 · '+k]))])],descriptor:id=>B().descriptor(id),currentSegment:()=>B().currentSegment(),select:id=>B().select(id,true),edit:(id,fields,expected)=>B().editFields(id,fields,expected),
  command:async(id,cmd)=>{await B().command(id,cmd);emit()},upload:async(files,target)=>{await B().uploadFiles(files,target);emit()},
  uploadResults:async(files,target)=>{await B().uploadResults(files,target);emit()},
  agent:async id=>prepared(()=>frameAgent.open(B().descriptor(id||'project'))),aiSplit,
  projectAgent:()=>{const p=dialog.querySelector('.frameAgentProject');p?._dock?.open();if(p?.querySelector('[data-agent-fold]')?.textContent==='展开')p.querySelector('[data-agent-fold]').click();dialog._frameDocking?.layout()},
  settings:()=>B().settings(),ai:()=>settingsModal(),generation:()=>openGenerationSettings(),setTheme:t=>setTheme(t),notice:m=>toast(m),fullscreen:()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen(),
  modeLabel:mode=>{const label={canvas:'画布模式',cards:'卡片模式',free:'画布模式'}[mode]||'画布模式';const el=dialog?.querySelector('[data-flow-mode-label]');if(el)el.textContent=label+' ▾';dialog.dataset.unifiedMode=mode;for(const b of dialog.querySelectorAll('[data-flow-mode]'))b.setAttribute('aria-pressed',String(b.dataset.flowMode===mode))},
  confirm:scope=>B().confirm(scope),reverse:()=>B().reverse(),order:(id,delta)=>B().orderAsset(id,delta),preview,
  copy:async ids=>prepared(()=>frameFlowOperations.write(frameFlowOperations.capture(ids))),
  capture:ids=>frameFlowOperations.capture(ids),decode:text=>frameFlowOperations.decode(text),readClipboard:()=>frameFlowOperations.read(),
  paste:async(data,target)=>prepared(async()=>{const ids=await frameFlowOperations.paste(data,target);await B().resync(ids.find(id=>!id.startsWith('t:'))||'project');return ids}),
  pasteText:async text=>prepared(async()=>{const ids=await frameFlowOperations.note(text);await B().resync();return ids}),
  undoTime:()=>frameFlowOperations.undoTime,undoLabel:()=>frameFlowOperations.undoLabel,remove:async ids=>prepared(async()=>{await frameFlowOperations.remove(ids);await B().resync()}),undo:async()=>prepared(async()=>{const label=await frameFlowOperations.undo();await B().resync();toast(label?'已撤销：'+label:'已撤销')}),redo:async()=>prepared(async()=>{const label=await frameFlowOperations.redo();await B().resync();toast(label?'已重做：'+label:'已重做')}),
  saveProject:()=>B().flush(),close:mode=>app?.setMode(mode||'canvas'),
 };
 const editing=e=>!!e.target?.closest('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=file]):not([type=range]):not([type=color]),textarea,select,[contenteditable=true],.mentionMirror');
 document.addEventListener('click',e=>{const mode=e.target.closest('[data-flow-mode]');if(mode){e.preventDefault();e.stopImmediatePropagation();mode.closest('details').open=false;safe(()=>open(mode.dataset.flowMode));return}const target=e.target.closest('[data-canvas-home],[data-creator-library],[data-visual-library]');if(active&&target&&!target._flowProceed){e.preventDefault();e.stopImmediatePropagation();safe(async()=>{if(!await app.commitAll())return;await app.save();await B().flush();app.suspend();target._flowProceed=true;try{target.click()}finally{target._flowProceed=false}});return}if(e.target.closest('#cardFlowEntry,[data-cardflow-open]')){e.preventDefault();e.stopImmediatePropagation();safe(()=>open('canvas'))}},true);
 document.addEventListener('keydown',e=>{if(!active||editing(e)||e.isComposing||document.querySelector('#modal[open],#imageViewer[open]'))return;const mod=e.ctrlKey||e.metaKey;if(mod&&e.key.toLowerCase()==='c'&&window.getSelection()?.toString())return;
  if(mod&&['c','v','s','z','a'].includes(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation();safe(()=>e.key.toLowerCase()==='c'?app.copySelection():e.key.toLowerCase()==='v'?app.pasteClipboard():e.key.toLowerCase()==='z'?(e.shiftKey&&window.frameFlowHost?.redo?window.frameFlowHost.redo():app.undo()):e.key.toLowerCase()==='a'?app.selectAll():app.commitAll().then(ok=>ok&&app.save()));return}
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();e.stopImmediatePropagation();safe(()=>app.deleteSelection());return}
  if(mod&&e.shiftKey&&e.key.toLowerCase()==='f'){e.preventDefault();e.stopImmediatePropagation();safe(()=>frameFlowHost.fullscreen());return}
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();app?.escape()}
 },true);
 document.addEventListener('paste',e=>{if(!active||editing(e)||document.querySelector('#modal[open],#imageViewer[open]'))return;const text=e.clipboardData?.getData('text/plain')||'',files=[...(e.clipboardData?.files||[])];if(!text&&!files.length)return;e.preventDefault();e.stopImmediatePropagation();safe(()=>app.pasteIncoming({text,files}))},true);
 window.addEventListener('beforeunload',e=>{if(active&&app?.getState()?.drafts.size){e.preventDefault();e.returnValue=''}});
 window.frameCardFlow={open,activate,close:mode=>app?.setMode(mode||'canvas'),dispose,refresh:emit,get isOpen(){return active||document.getElementById('overviewDialog')?.dataset.cardflow==='true'},get app(){return app}};
})();
