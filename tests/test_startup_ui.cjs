/* DOM integration checks. No browser automation or model/network requests. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
const sample=JSON.parse(fs.readFileSync(path.join(root,'presets/starter-project.json'),'utf8'));
const copy=v=>JSON.parse(JSON.stringify(v));
const pause=()=>new Promise(r=>setTimeout(r,30));
async function fixture(existing=null,mode='simple',broken=false){
 const dom=new JSDOM(html,{url:'http://127.0.0.1:8787/',runScripts:'outside-only',pretendToBeVisual:true});
 const styles=dom.window.document.createElement('style');styles.textContent=fs.readFileSync(path.join(root,'web/startup.css'),'utf8');dom.window.document.head.append(styles);
 const w=dom.window;let project=existing&&copy(existing),config={ai:{provider:'ollama',endpoint:'http://127.0.0.1:11434',model:'',key:''},ui:{workbenchMode:mode}};
  let appearanceStore={revision:'0',items:[]};let topics=[],topicCounter=0;let failRebuild=false,remoteTasks=[],visualRows=[],libraryRows=[],presetRevision=0,presets=['中景','特写','广角','POV 视角','缓慢推近','绕圈环拍','极速俯冲'].map((name,i)=>({id:'camera-'+i,field:'camera',name,content:name,shortcut:'',binding:null}));const projectSnapshots=new Map(),projectTrash=new Map();if(project)projectSnapshots.set(project.projectId,copy(project));
 let writingRevision=0,writingItems=[{id:'fight',name:'动作导演',category:'动作',description:'动作规则',rules:'保持因果',builtin:true}];const calls=[],errors=[];w.addEventListener('error',e=>errors.push(e.error));w.structuredClone=copy;
 Object.defineProperty(w.crypto,'randomUUID',{value:require('node:crypto').randomUUID});
 Object.defineProperties(w.HTMLElement.prototype,{offsetWidth:{get(){if(this.classList.contains('overviewNode')){w._nodeMeasures=(w._nodeMeasures||0)+1;return parseFloat(this.style.width)||230}return 1000}},offsetHeight:{get(){if(this.classList.contains('overviewNode')){w._nodeMeasures=(w._nodeMeasures||0)+1;return parseFloat(this.style.height)||100}return 700}},clientWidth:{get(){return 1000}},clientHeight:{get(){return 700}}});
 w.ResizeObserver=class{observe(){}disconnect(){}unobserve(){}};
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 w.HTMLMediaElement.prototype.pause=function(){};w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.show=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.fetch=async(url,options={})=>{
  const route=String(url).split('?')[0].replace('/api/','');let data;
  const body=options.body?(options.body instanceof w.File?options.body:JSON.parse(options.body)):null;calls.push({route,body});
  if(route==='bootstrap')data={token:'test-token'};
  else if(route==='project'){if(broken)throw Error('test startup error');if(body){project=copy(body);projectSnapshots.set(project.projectId,copy(project))}data=project;}
  else if(route==='canvas-layout'){project.overviewLayout=copy(body.layout);projectSnapshots.set(project.projectId,copy(project));data={ok:true};}
  else if(route==='projects')data=[...projectSnapshots.values()].map(p=>({id:p.projectId,title:p.title,segments:p.segments.length,shots:p.segments.reduce((n,s)=>n+s.shots.length,0),assets:p.assets.length,current:p.projectId===project?.projectId,updatedAt:'2026-10-12'}));
  else if(route==='project-open'){project=copy(projectSnapshots.get(body.projectId));data=project;}
  else if(route==='projects-trash')data=[...projectTrash.values()].map(p=>({id:p.projectId,title:p.title,segments:p.segments.length,shots:p.segments.reduce((n,s)=>n+s.shots.length,0),deletedAt:'2026-10-13'}));
  else if(route==='projects-delete'){const currentDeleted=body.projectIds.includes(project?.projectId);for(const id of body.projectIds){projectTrash.set(id,projectSnapshots.get(id));projectSnapshots.delete(id)}if(currentDeleted)project=null;data={deleted:body.projectIds.length,currentDeleted};}
  else if(route==='project-restore'){const p=projectTrash.get(body.projectId);projectSnapshots.set(p.projectId,p);projectTrash.delete(body.projectId);data={restored:body.projectId};}
  else if(route==='prompt-translations')data={original:project.segments.find(s=>s.id===body.segmentId).prompt,versions:{zh:'中文副本',en:'English copy'},stale:false,exportLanguage:'original'};
  else if(route==='prompt-export-language'){project.segments.find(s=>s.id===body.segmentId).promptExportLanguage=body.language;data={project};}
  else if(route==='prompt-translate')data={id:'translation-task'};
  else if(route==='agent-info'){const base=JSON.stringify(body.target),scopeKey=body.threadId||base;if(!topics.some(t=>t.id===scopeKey))topics.push({id:scopeKey,title:'原有对话',target:body.target});const topic=topics.find(t=>t.id===scopeKey);data={scopeKey,threadId:scopeKey,threads:topics.filter(t=>JSON.stringify(t.target)===base),deleted:!!topic.deletedAt,targetExists:body.target.kind!=='shot'||project.segments.some(s=>s.shots.some(h=>h.id===body.target.shotId)),messages:remoteTasks.filter(r=>r.scopeKey===scopeKey).flatMap(r=>[{role:'user',content:r.request||'改善当前镜头',taskId:r.id,timestamp:r.userTimestamp},{role:'assistant',content:r.result.reply,taskId:r.id,timestamp:r.replyTimestamp}])};}
  else if(route==='agent-threads'){let topic=topics.find(t=>t.id===body.threadId);if(body.action==='create'){topic={id:'topic-'+(++topicCounter),title:'新话题',target:body.target};topics.push(topic)}else if(body.action==='delete')topic.deletedAt=123;else if(body.action==='restore')delete topic.deletedAt;else if(body.action==='rename')topic.title=body.title;data={threadId:topic.id};}
  else if(route==='agent-send'){const scopeKey=body.threadId||JSON.stringify(body.target);const row={id:'agent-task-'+remoteTasks.length,type:'agent',projectId:project.projectId,status:'done',scopeKey,agentThreadId:scopeKey,agentTarget:body.target,request:body.message,result:{reply:'建议让角色先停步再回头。',calls:2,trace:[{tool:'read_node'}],target:body.target,attachmentAvailable:!!body.attachment,attachmentName:body.attachment?.name,changes:body.target.kind==='shot'?[{target:body.target,before:{action:'原动作'},fields:{action:'先停步再回头'}}]:[]}};remoteTasks.push(row);data={id:row.id};}
  else if(route==='agent-apply'){project.segments[0].shots[0].action='先停步再回头';remoteTasks.find(r=>r.id===body.id).appliedAt=123;data={project};}
  else if(route==='agent-undo'){project.segments[0].shots[0].action='原动作';remoteTasks.find(r=>r.id===body.id).undoneAt=124;data={project};}
  else if(route==='writing-rules'){if(body?.action==='save'){assert.equal(body.revision,String(writingRevision));const item={...body,id:body.id||'custom-'+(++writingRevision),builtin:false};writingItems=body.id?writingItems.map(r=>r.id===body.id?item:r):[...writingItems,item];writingRevision++}data={revision:String(writingRevision),items:copy(writingItems)}}
  else if(route==='story-plan')data={id:'story-task'};
  else if(route==='editor-presets'){if(body?.action){if(body.action==='save'){const row={...body,id:body.id||'preset'+(++presetRevision)};presets=body.id?presets.map(r=>r.id===body.id?row:r):presets.concat(row)}else if(body.action==='delete')presets=presets.filter(r=>r.id!==body.id);else if(body.action==='move'){const i=presets.findIndex(r=>r.id===body.id),j=i+(body.direction==='up'?-1:1);if(j>=0&&j<presets.length)[presets[i],presets[j]]=[presets[j],presets[i]]}presetRevision++;}data={revision:String(presetRevision),items:presets};}
  else if(route==='appearance-presets'){if(body){if(body.action==='delete')appearanceStore.items=appearanceStore.items.filter(r=>r.id!==body.id);else{const row={id:body.id||'look-'+appearanceStore.items.length,name:body.name,appearance:copy(body.appearance)};appearanceStore.items=appearanceStore.items.filter(r=>r.id!==row.id).concat(row);appearanceStore.savedId=row.id}appearanceStore.revision=String(Number(appearanceStore.revision)+1)}data=appearanceStore;}
  else if(route==='asset-library')data={revision:'0',categories:['人物'],items:libraryRows};
  else if(route==='layout-presets'){const options={mode:'cards',assetPosition:'top',shotColumns:3,segmentColumns:2,gap:28,shotWidth:230,shotHeight:220,assetWidth:190,assetHeight:180,rolePositions:{},roleSizes:{}};data=body?.action==='validate'?{options:body.options}:{revision:'0',defaultId:'cards-top',items:[{id:'cards-top',name:'卡片',builtin:true,options}]};}
  else if(route==='settings')data=config;
  else if(route==='settings-patch'){for(const[k,v]of Object.entries(body))config[k]={...config[k],...v};data={ok:true};}
  else if(route==='check-updates')data={current:'v3.9-beta.1',latest:'v3.9-beta.2',available:true,message:'发现新版本',releaseUrl:'https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/releases/tag/v3.9-beta.2',notes:'更新说明',assets:[{name:'FRAME-Workbench-Windows-x64-v3.9-beta.2.exe',url:'https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/releases/download/v3.9-beta.2/FRAME-Workbench-Windows-x64-v3.9-beta.2.exe'}]};
  else if(route==='tasks')data={tasks:remoteTasks,paused:false};
  else if(route==='asset-analysis-status')data={assets:(project?.assets||[]).filter(a=>!a.deleted).map(a=>({id:a.id,signature:'stamp-'+a.id}))};
  else if(route==='confirm-assets'){for(const a of project.assets)if(body.assets.some(x=>x.id===a.id))a.confirmation={mode:'manual',source:[a.path||'',a.name||'',a.kind||'',a.description||'']};data={project,confirmed:body.assets.length,skipped:[]};}
  else if(route==='prompt-quality')data={segments:[]};
  else if(route==='visual-library-storage')data={used:0,limit:null};
  else if(route==='visual-pack-preview')data={token:'test-preview',revision:'test-revision',count:1,conflicts:1,bytes:100,entries:[{title:'人物参考',category:'size',media:true,conflict:true}]};
  else if(route==='visual-pack-cancel')data={ok:true};
  else if(route==='visual-pack-apply')data={rows:[],imported:1,skipped:0};
  else if(route==='visual-references')data=visualRows;
  else if(route==='reverse-templates')data={};
  else if(route==='new-project'){if(project)projectSnapshots.set(project.projectId,copy(project));project=body.example?copy(sample):{version:1,projectId:'new-project',title:body.title||'新导演项目',script:'',aspect:'16:9',fps:24,segments:[{id:'s1',title:'片段 01',duration:15,shots:[],refs:[]}],assets:[],media:{},originalZip:''};projectSnapshots.set(project.projectId,copy(project));data=project;}
  else if(route==='import-project'){project=copy(body.project);data=project;}
  else if(route==='rebuild'){if(failRebuild)throw Error('rebuild unavailable');data={prompt:'summary:\n测试\ntimeline:\n'};}
  else if(route==='compiled-prompt')data={prompt:project.segments.find(s=>s.id===body.segmentId)?.prompt||'summary:\n测试\ntimeline:\n[0.00s–3.00s]\n测试画面',warnings:[]};
  else if(route==='plan-shots')data={id:'task1'};
  else if(route==='analyze-assets')data={id:'asset-task1'};
  else throw Error('Unexpected request '+route);
  return {ok:true,json:async()=>copy(data)};
 };
 for(const match of html.matchAll(/<script src="([^"?]+)/g))require('node:vm').runInContext(fs.readFileSync(path.join(root,'web',match[1]),'utf8'),dom.getInternalVMContext(),{filename:match[1]});
 await pause();
 return {dom,w,calls,errors,set visualRows(v){visualRows=v},set libraryRows(v){libraryRows=v},set failRebuild(v){failRebuild=v},set tasks(v){remoteTasks=v},get project(){return project},get config(){return config},el:id=>w.document.getElementById(id)||w.frameCommands?.get(id)};
}
async function runtimeAndPromptChecks(){
 const source=copy(sample);source.segments[0].prompt='Camera: '+ 'cinematic lighting and detailed rendering parameters '.repeat(8);const f=await fixture(source,'professional');
 try{
  await f.w.openFrameOverview();await pause();await pause();const d=f.el('overviewDialog'),input=f.el('canvas_segmentPrompt'),wrap=input.closest('.highlightPrompt');
  assert(wrap.classList.contains('promptCollapsed'));assert.equal(wrap.querySelector('.promptExpandToggle').getAttribute('aria-expanded'),'false');const original=input.value;let copied='';Object.defineProperty(f.w.navigator,'clipboard',{configurable:true,value:{writeText:async text=>{copied=text}}});
  wrap.querySelector('.promptCopyIcon').click();await pause();assert.equal(copied,original);assert(wrap.querySelector('.promptCopyIcon').classList.contains('copied'));wrap.querySelector('.promptExpandToggle').click();assert(!wrap.classList.contains('promptCollapsed'));assert.equal(input.value,original);wrap.querySelector('.promptExpandToggle').click();assert(wrap.classList.contains('promptCollapsed'));assert.equal(input.value,original);
  d.querySelector('.unifiedEditorPanel [data-panel-dock="floating"]').click();await pause();await pause();assert(d.querySelector('.unifiedEditorPanel').classList.contains('framePanelFloating'));f.w.dispatchEvent(new f.w.Event('resize'));assert.equal(f.errors.length,0);
  const nativeFetch=f.w.fetch;let finish;f.w.fetch=async(url,options)=>String(url).includes('/api/compiled-prompt')?new Promise(resolve=>{finish=()=>resolve({ok:true,json:async()=>({prompt:'LATE RESULT',warnings:[]})})}):nativeFetch(url,options);
  d.querySelector('[data-overview-select="p:'+source.segments[0].id+'"]').click();await pause();await pause();assert(finish);
  d.querySelector('[data-canvas-home]').click();await pause();await pause();d.dispatchEvent(new f.w.Event('close'));finish();await pause();await pause();assert.equal(d.open,false);assert.equal(f.errors.length,0);assert(!f.el('toast').textContent.includes('Cannot set properties'));
  assert.doesNotThrow(()=>f.w.framePromptTools(null,null));const toast=f.el('toast');toast.remove();assert.doesNotThrow(()=>f.w.toast('detached'));f.w.document.body.append(toast);
  console.log('PASS: full prompt copy, green feedback, reversible three-line preview, stale compiled response after Home, null tool mount and missing Toast');
 }finally{f.w.close()}
}
async function visualOptionsChecks(){
 const f=await fixture(sample,'professional');try{await f.w.openFrameOverview();await pause();const d=f.el('overviewDialog');d.querySelector('[data-inspector-tab=settings]').click();await pause();
 const change=(key,value)=>{const el=d.querySelector('[data-appearance-select="'+key+'"]');assert([...el.options].some(o=>o.value===value));el.value=value;el.dispatchEvent(new f.w.Event('change',{bubbles:true}))};
 for(const shape of ['film','octagon','pill','badge']){change('projectShape',shape);assert.equal(d.dataset.projectShape,shape);assert(d.querySelector('g[data-project-shape="'+shape+'"]'))}
 change('lineStyle','rounded');await pause();assert([...d.querySelectorAll('.overviewEdges>path')].some(p=>(p.getAttribute('d')||'').includes('Q')),'Rounded turns contain quadratic arcs');
 change('lineStyle','bus');await pause();const trunks=d.querySelectorAll('[data-canvas-bus]');assert.equal(trunks.length,1,'One trunk shared by project segments');const firstCount=d.querySelectorAll('.overviewEdges>path').length;change('lineStyle','bus');await pause();assert.equal(d.querySelectorAll('.overviewEdges>path').length,firstCount,'Repeated redraw does not accumulate bus trunks');
 change('lineStyle','dotted');await pause();assert(d.querySelector('.dottedEdge'));assert.equal(d.querySelectorAll('[data-canvas-bus]').length,0);
 const hierarchy=d.querySelector('[data-appearance-check=hierarchy]');hierarchy.checked=false;hierarchy.dispatchEvent(new f.w.Event('change',{bubbles:true}));
 for(const arrow of ['clapper','fork','jack','radar']){change('arrowType',arrow);await pause();assert([...d.querySelectorAll('.overviewEdges>path')].some(p=>(p.getAttribute('marker-end')||'').includes('canvas-edge-'+arrow)));assert(f.w.frameCanvasEdge.shape(arrow).length>30)}
 for(const effect of ['ants','comet','breathing','grain']){change('lineEffect',effect);await pause();assert.equal(d.dataset.canvasLineEffect,effect)}
 assert.equal(f.errors.length,0);console.log('PASS: four root shapes, rounded geometry, one shared bus trunk, dotted lines, four effects and four actual terminal markers');
 }finally{f.dom.window.close()}
}
async function paletteChecks(){
 const p=copy(sample);p.overviewLayout={canvas37:{appearance:{background:'#101010',node:'#191919',titleColor:'#ffeebb',highlight:'#ff9900'}}};const f=await fixture(p,'professional');
 const click=async selector=>{f.w.document.querySelector(selector).click();await pause();await pause()};
 try{await f.w.openFrameOverview();await pause();const d=f.el('overviewDialog');await click('[data-inspector-tab=settings]');
  assert.equal(d.style.getPropertyValue('--canvas-background'),'#f0f3f5','Legacy dark colors stay in dark palette');
  let c=d.querySelector('[data-appearance-color=cardBackground]');c.value='#ddeeff';c.dispatchEvent(new f.w.Event('input',{bubbles:true}));assert.equal(d.style.getPropertyValue('--canvas-card-bg'),'#ddeeff');await f.w.flush();
  f.w.setTheme('dark');await pause();assert.equal(d.style.getPropertyValue('--canvas-background'),'#101010');assert.equal(d.style.getPropertyValue('--canvas-title-color'),'#ffeebb');
  c=d.querySelector('[data-appearance-color=cardBackground]');c.value='#2a2418';c.dispatchEvent(new f.w.Event('input',{bubbles:true}));f.w.setTheme('light');await pause();assert.equal(d.style.getPropertyValue('--canvas-card-bg'),'#ddeeff');
  d.querySelector('[data-appearance-profile-name]').value='暖金';await click('[data-profile-action=save]');assert.equal(f.calls.filter(r=>r.route==='appearance-presets'&&r.body?.action==='save').length,1);
  await click('[data-reset-appearance]');assert.notEqual(d.style.getPropertyValue('--canvas-card-bg'),'#ddeeff');
  d.querySelector('[data-appearance-profile]').value='look-0';d.querySelector('[data-appearance-profile]').dispatchEvent(new f.w.Event('change',{bubbles:true}));await click('[data-profile-action=apply]');assert.equal(d.style.getPropertyValue('--canvas-card-bg'),'#ddeeff');f.w.setTheme('dark');await pause();assert.equal(d.style.getPropertyValue('--canvas-card-bg'),'#2a2418');
  await f.w.flush();assert.equal(f.project.overviewLayout.canvas37.appearance.themeColors.light.cardBackground,'#ddeeff');assert.equal(f.project.overviewLayout.canvas37.appearance.themeColors.dark.cardBackground,'#2a2418');
  d.querySelector('[data-appearance-profile]').value='look-0';d.querySelector('[data-appearance-profile-name]').value='暖金改名';await click('[data-profile-action=overwrite]');assert.equal(f.calls.at(-1)?.route==='appearance-presets'||f.calls.some(r=>r.body?.name==='暖金改名'),true);
  await click('[data-profile-action=delete]');assert.equal(d.querySelector('[data-appearance-profile]').options.length,1);assert.equal(d.style.getPropertyValue('--canvas-card-bg'),'#2a2418');assert.equal(f.errors.length,0);console.log('PASS: independent theme palettes, legacy migration, card colors, named profile save/apply/overwrite/delete without changing project media');
 }finally{f.dom.window.close()}
}
async function upgradeChecks(){
 const f=await fixture(sample,'professional');try{
  f.el('homeProjectSearch').value='no-such-project';f.el('homeProjectSearch').dispatchEvent(new f.w.Event('input'));assert.equal(f.el('localProjectList').querySelectorAll('.homeProject').length,0);
  f.el('homeProjectSearch').value='';f.el('homeProjectSearch').dispatchEvent(new f.w.Event('input'));f.el('homeList').click();assert(f.el('localProjectList').classList.contains('homeListView'));f.el('homeGrid').click();
  const search=f.el('homeProjectSearch');search.value='replace me';search.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true,cancelable:true}));assert.equal(f.w.document.activeElement,search);assert.equal(search.selectionStart,0);assert.equal(search.selectionEnd,10);search.value='';
  const drag=(kind,target=f.el('startImport'),related=null)=>{const e=new f.w.Event(kind,{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:{types:['Files'],files:[],dropEffect:'none'}});Object.defineProperty(e,'relatedTarget',{value:related});target.dispatchEvent(e)};
  drag('dragenter');assert(f.el('startImport').classList.contains('fileover'));assert.match(f.el('startImport').textContent,/松手即可/);drag('dragenter',f.el('startImport').querySelector('b'));drag('dragleave',f.el('startImport').querySelector('b'),f.el('startImport'));assert(f.el('startImport').classList.contains('fileover'),'nested child leave must not flicker');drag('dragleave');assert(!f.el('startImport').classList.contains('fileover'));assert.match(f.el('startImport').textContent,/支持直接拖拽/);
  const card=f.el('localProjectList').querySelector('.homeProject');assert.equal(card.querySelectorAll('.homeMetaCounts .highlight').length,2);assert.equal(card.querySelector('.homeCoverBadge').textContent,'已有分镜');
  f.el('homeSettings').click();await pause();assert(f.el('homeSettingsMount').contains(f.el('checkUpdates')));f.w.close();assert(f.el('checkUpdates').closest('header'));
  await f.w.openFrameOverview();await pause();await pause();const d=f.el('overviewDialog');d.querySelector('[data-card-mode]').click();await pause();await pause();assert(d.querySelectorAll('.referenceEdge').length>0,'Cards keep reference links');
  const before=f.project.assets.length,fold=d.querySelector('[data-project-assets-toggle]');const right=d.querySelector('[data-dock-arrow=right]');if(right.getAttribute('aria-expanded')==='true'){right.click();await pause()}fold.click();await pause();await pause();await f.w.flush();assert.equal(right.getAttribute('aria-expanded'),'false','Asset repaint must not reopen collapsed Inspector');assert.equal(d.querySelectorAll('.canvasAssetLayer .overviewNode.asset').length,0);assert.equal(f.project.assets.length,before);assert(f.project.overviewLayout.canvas37.assetsCollapsed);assert(d.querySelectorAll('.referenceEdge').length>0,'Collapsed dock keeps reference links');
  d.querySelector('[data-project-assets-toggle]').click();await pause();await pause();assert.equal(d.querySelectorAll('.canvasAssetLayer .overviewNode.asset').length,before);
  const input=f.el('agentMessageProject');input.value='保留这个草稿';input.dispatchEvent(new f.w.Event('input',{bubbles:true}));d.querySelector('.frameAgentProject [data-panel-dock=right]').click();await pause();assert.equal(f.el('agentMessageProject'),input);assert.equal(input.value,'保留这个草稿');
  d.querySelector('[data-dock-arrow=right]').click();await pause();assert.equal(input.value,'保留这个草稿');d.querySelector('[data-dock-arrow=right]').click();await pause();assert.equal(input.value,'保留这个草稿');
  assert(d.querySelector('[data-canvas-theme]'));d.querySelector('[data-canvas-theme]').click();assert(['light','dark'].includes(f.w.document.documentElement.dataset.theme));
  await f.w.openStoryPlanner();assert.equal(f.el('wholeOutputLanguage').value,'zh');f.el('wholeOutputLanguage').value='en';f.el('wholeOutputLanguage').dispatchEvent(new f.w.Event('change'));assert(f.el('wholeDialogueLanguage'));
  f.w.frameI18n.set('en');assert(!/[\u4e00-\u9fff]/.test(f.w.frameI18n.translate('已完成，结果可查看')));assert(!/[\u4e00-\u9fff]/.test(f.w.frameI18n.translate('修改先预览，确认后应用。模型在设置中配置。')));assert(!/[\u4e00-\u9fff]/.test(f.w.frameI18n.translate('输出 4944 字 · 关闭思考 · 模型报告 1256 tokens')));assert.equal(f.errors.length,0);console.log('PASS: upgraded home search/list/settings, card reference edges, folded permanent asset dock, docking preserves drafts, theme and independent planning languages');
 }finally{f.dom.window.close()}
}
async function assetDecouplingChecks(){
 const p=copy(sample);p.segments=[];p.assets=p.assets.map(a=>({...a,scope:'public',segmentId:''}));const f=await fixture(p,'pro');try{
  await f.w.openFrameOverview();await pause();await pause();const d=f.el('overviewDialog');assert.equal(f.project.segments.length,0);assert(d.querySelector('.canvasAssetLayer'));assert(d.querySelector('.canvasStoryLayer'));assert.equal(d.querySelectorAll('.canvasAssetLayer .overviewNode.asset').length,p.assets.length);
  d.querySelector('[data-card-mode]').click();await pause();await pause();assert.equal(d.dataset.layoutMode,'cards');assert.equal(d.querySelectorAll('.canvasAssetLayer .overviewNode.asset').length,p.assets.length);assert.equal(f.project.segments.length,0);
  const originalIds=f.project.assets.map(a=>a.id);await f.w.addAssetFiles([new f.w.File(['image'],'new.png',{type:'image/png'})],'public');await f.w.flush();await pause();await pause();assert.equal(f.project.segments.length,0,'Upload must not create a segment');assert.equal(f.project.assets.length,originalIds.length+1);for(const id of originalIds)assert(f.project.assets.some(a=>a.id===id));assert.equal(d.querySelectorAll('.canvasAssetLayer .overviewNode.asset').length,originalIds.length+1);
  d.close();await f.w.openFrameOverview();await pause();await pause();assert.equal(f.project.segments.length,0,'Reopening must not create a segment');assert.equal(d.querySelectorAll('.canvasAssetLayer .overviewNode.asset').length,originalIds.length+1);assert.equal(f.errors.length,0);console.log('PASS: permanent asset and graph layers, zero-segment free/cards views, upload and reopen without implicit segment creation');
 }finally{f.w.close()}
}
async function agentChecks(){
 const f=await fixture(copy(sample),'pro');try{await f.w.openFrameOverview();await pause();const d=f.el('overviewDialog'),s=f.project.segments[0];assert(d.querySelector('.frameAgentProject'));assert(!d.querySelector('.overviewToolbar select[data-model]'));d.querySelector('[data-overview-select="h:'+s.id+':'+s.shots[0].id+'"]').click();await pause();await pause();d.querySelector('.frameAgentEntry').click();await pause();await pause();const panel=d.querySelector('.frameAgentNode');assert(!panel.hidden);assert.match(panel.textContent,/当前镜头/);const input=panel.querySelector('textarea');input.value='改善当前镜头';input.dispatchEvent(new f.w.Event('input',{bubbles:true}));panel.querySelector('[data-agent-send]').click();await pause();await pause();await new Promise(r=>setTimeout(r,300));assert(f.calls.some(c=>c.route==='agent-send'&&c.body.target.shotId===s.shots[0].id));assert(panel.querySelector('.frameAgentCompare'));const apply=[...panel.querySelectorAll('button')].find(b=>b.textContent==='确认应用修改');assert(apply);apply.click();await pause();await pause();assert.equal(f.project.segments[0].shots[0].action,'先停步再回头');assert(f.calls.some(c=>c.route==='agent-apply'));assert.equal(f.errors.length,0);console.log('PASS: Agent dual entrances, scope target, real request payload, preview and explicit apply');}finally{f.w.close()}
}
async function creativeCanvasChecks(){
 const f=await fixture(sample,'professional');
 const click=async selector=>{const el=f.w.document.querySelector(selector);assert(el,'Missing '+selector);el.click();await pause();await pause()};
 try{
 f.el('startResume').click();f.el('projectOverview').click();await pause();await pause();
 const original=copy(f.w.eval('P.overviewLayout?.canvas37?.positions||{}'));
 await click('[data-card-mode]');assert.equal(f.el('overviewDialog').dataset.layoutMode,'cards');assert.equal(f.w.document.querySelectorAll('.segmentLayoutCard').length,sample.segments.length);
 assert(f.w.document.querySelector('[data-overview-select^="ca:"]'),'Segment asset aliases rendered');
 const geometry=f.w.frameCardGeometry(sample,{assetPosition:'left',shotColumns:2,segmentColumns:1},s=>sample.assets);const many={...sample,segments:Array.from({length:20},(_,i)=>({...copy(sample.segments[0]),id:'stress'+i}))},compact=f.w.frameCardGeometry(many,{segmentColumns:4},s=>sample.assets,{collapsedCards:Object.fromEntries(many.segments.map(s=>[s.id,true]))});assert.equal(compact.cards.length,20);assert(compact.cards.every(c=>c.h===190&&c.w===360));assert.equal(compact.cards[19].y,4*(190+56));
 assert.equal(geometry.cards.length,sample.segments.length);assert(geometry.cards[1].y>geometry.cards[0].y);assert(geometry.points.size>10);
 await click('[data-layout-presets]');assert(f.el('layoutMode'));assert(f.el('layoutCapture'));f.w.close();
 await click('[data-card-mode]');assert.equal(f.el('overviewDialog').dataset.layoutMode,'free');assert.deepEqual(copy(f.w.eval('P.overviewLayout.canvas37.positions')),original);
 await click('[data-card-mode]');await click('[data-card-add-shot="'+sample.segments[0].id+'"]');f.el('modalActions').lastElementChild.click();await pause();await pause();assert.equal(f.project.segments[0].shots.length,sample.segments[0].shots.length+1);assert.equal(f.project.segments[0].shots[0].id,sample.segments[0].shots[0].id);
 await click('.cardNewSegment');assert.equal(f.project.segments.at(-1).shots.length,1);
 await click('[data-creator-library]');assert.match(f.el('modalTitle').textContent,/素材库/);f.el('creatorAdd').click();assert(f.el('creatorTitle'));assert(f.el('creatorNote'));assert(f.el('creatorEditCategory'));assert(f.el('creatorFile'));f.w.close();
 assert.equal(f.errors.length,0);console.log('PASS: card geometry, asset aliases, mode restoration, full timeline add shot, one-shot segment, layout and asset library forms');
 }finally{f.dom.window.close()}
}
async function v322Checks(){
 const f=await fixture(copy(sample),'pro');try{await f.w.openFrameOverview();await pause();const d=f.el('overviewDialog');const input=f.el('canvas_segmentPrompt');assert(input.closest('.highlightPrompt'));const text='Camera: 机位\nExpression: 表情\nSound: 音效\nSpatial start: 起点\nSpatial end: 终点\nDialogue: 原文对白\nDialogue language: Cantonese';input.value=text;input.setSelectionRange(3,7);input.dispatchEvent(new f.w.Event('input',{bubbles:true}));for(const name of ['camera','expression','sound','start','end','dialogue','language'])assert(input.closest('.highlightPrompt').querySelector('.syntax-'+name));assert.equal(input.value,text);assert.equal(input.selectionStart,3);assert.equal(input.selectionEnd,7);input.scrollTop=37;input.dispatchEvent(new f.w.Event('scroll'));assert.equal(input.closest('.highlightPrompt').querySelector('pre').scrollTop,37);
 input.value=sample.segments[0].prompt;input.dispatchEvent(new f.w.Event('input',{bubbles:true}));d.querySelector('[data-inspector-tab="settings"]').click();await pause();const select=d.querySelector('[data-appearance-select="projectShape"]');assert(select);for(const shape of ['circle','rounded','square','diamond','hexagon','chamfer']){select.value=shape;select.dispatchEvent(new f.w.Event('change',{bubbles:true}));assert.equal(d.dataset.projectShape,shape)}await f.w.flush();assert.equal(f.project.overviewLayout.canvas37.appearance.projectShape,'chamfer');d.querySelector('[data-inspector-tab="segment"]').click();await pause();await pause();assert.equal(d.querySelector('.overviewDetail').hidden,false);assert(f.el('canvas_segmentPrompt'));
 d.querySelector('[data-overview-select="s:'+sample.segments[0].id+'"]').dispatchEvent(new f.w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:950,clientY:600}));await pause();await pause();const open=d.querySelector('[data-submenu-open="view"]'),panel=d.querySelector('[data-submenu="view"]');assert(panel.hidden);open.click();assert(!panel.hidden);assert.equal(open.getAttribute('aria-expanded'),'true');open.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));panel.querySelector('button').dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));assert(panel.hidden);const manage=d.querySelector('[data-submenu-open="manage"]');manage.dispatchEvent(new f.w.Event('pointerover',{bubbles:true}));assert(!d.querySelector('[data-submenu="manage"]').hidden);assert.equal(f.errors.length,0);console.log('PASS: detailed field colors, segment prompt input/selection/scroll safety, six persistent shapes and click/hover/keyboard submenus');}finally{f.w.close()}
}
async function v321Checks(){
 const p=copy(sample);p.segments[0].planning={warnings:['测试提醒']};const f=await fixture(p,'pro');
 try{await f.w.openFrameOverview();await pause();const d=f.el('overviewDialog'),map=d.querySelector('.overviewMap'),s=p.segments[0];
 assert(!d.querySelector('[data-canvas-appearance]'));assert(!d.querySelector('[data-group-command]'));assert.equal(d.querySelector('.projectOrb').textContent,p.title);assert.equal(d.querySelector('.overviewNode.project .nodeLabel b'),null);
 const right=async node=>{node.dispatchEvent(new f.w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:20,clientY:20}));await pause();await pause()};
 await right(d.querySelector('[data-overview-select="s:'+s.id+'"]'));assert(d.querySelector('[data-menu-command="plan"].primary'));assert(!d.querySelector('[data-menu-command="group"]'));assert.equal([...d.querySelectorAll('.canvasContextMenu button')].at(-1).dataset.menuCommand,'delete');assert(d.querySelector('[data-menu-command="all"] kbd'));
 await right(d.querySelector('[data-overview-select="a:'+p.assets[0].id+'"]'));assert(d.querySelector('[data-menu-command="analyze-asset"].primary'));await right(map);assert(!d.querySelector('[data-menu-command="group"]'));
 d.querySelector('[data-overview-select="s:'+s.id+'"]').click();await pause();assert(f.el('canvas_language'));const check=d.querySelector('.canvasOutputCheck details');assert(check);assert(check.open);check.open=false;check.dispatchEvent(new f.w.Event('toggle'));assert.equal(f.w.localStorage.getItem('frame-check:'+p.projectId+':'+s.id+':测试提醒'),'closed');
 d.querySelector('[data-overview-select="p:'+s.id+'"]').click();await pause();await pause();const input=f.el('canvas_prompt'),original=input.value;assert(d.querySelector('.promptCopyIcon'));assert(d.querySelector('.promptSyntax'));input.value='<Subject 1> from <Picture 1>\n[0s–15s]\nCamera: 静止';input.dispatchEvent(new f.w.Event('input',{bubbles:true}));assert(d.querySelector('.syntax-subject'));assert(d.querySelector('.syntax-reference'));assert.equal(input.value,'<Subject 1> from <Picture 1>\n[0s–15s]\nCamera: 静止');input.value=original;input.dispatchEvent(new f.w.Event('input',{bubbles:true}));
 await f.w.openWritingRules();assert(f.el('ruleName'));assert(f.el('ruleText'));f.el('modalActions').firstElementChild.click();await f.w.openStoryPlanner();assert(f.el('wholeStory'));f.el('wholeCount').value='3';f.el('wholeCount').dispatchEvent(new f.w.Event('input'));assert.match(f.el('wholeTotal').textContent,/45/);assert.equal(f.errors.length,0);console.log('PASS: context AI actions and hierarchy, project title, language scope, collapsible checks, syntax preservation, rules and story planner');
 }finally{f.w.close()}
}
async function repairAndInspectorChecks(){
 const p=copy(sample);p.segments[0].planning={warnings:['海浪影响未明确']};const f=await fixture(p,'pro');
 try{await f.w.openFrameOverview(p.segments[0].id);await pause();const d=f.el('projectOverviewDialog')||f.w.document.querySelector('.directorCanvas37');
 const toggle=d.querySelector('[data-dock-arrow=right]');assert(toggle);toggle.click();await pause();assert.equal(toggle.getAttribute('aria-expanded'),'true');toggle.click();await pause();assert.equal(toggle.getAttribute('aria-expanded'),'false');await f.w.flush();assert.equal(JSON.parse(f.w.localStorage.getItem('frame.dock.editor')).collapsed,true);
 toggle.click();await pause();assert.equal(toggle.getAttribute('aria-expanded'),'true');assert(d.querySelector('[data-canvas-action="repair"]'));
 const before=copy(f.project);const result={smartRepair:true,comparisonBefore:[{action:'原动作',camera:'固定'}],comparisonSummary:'原摘要',summary:'新摘要',shots:[{start:0,end:15,action:'新动作',camera:'固定'}]};const comparison=f.w.planningComparison(result);assert.match(comparison,/原动作/);assert.match(comparison,/新动作/);assert.match(comparison,/原摘要/);assert.deepEqual(f.project,before);assert.equal(f.errors.length,0);
 console.log('PASS: Inspector collapse persistence and safe repair comparison preview');}finally{f.w.close()}
}
async function agentTopicChecks(){
 const f=await fixture(copy(sample),'pro');try{await f.w.openFrameOverview();await pause();await pause();const d=f.el('overviewDialog'),p=d.querySelector('.frameAgentProject');assert.equal(p.dataset.panelMode,'left','Agent starts in the left dock');p.querySelector('[data-panel-dock="floating"]').click();await pause();p.querySelector('[data-agent-fold]').click();p.querySelector('[data-agent-fold]').click();await pause();assert(p.classList.contains('expanded'));
 p.querySelector('[data-agent-topics]').click();await pause();await pause();assert(!p.querySelector('.frameAgentTopics').hidden);p.querySelector('[data-agent-new]').click();await pause();await pause();const first=p._threadId;assert.match(first,/topic-/);
 let input=p.querySelector('textarea');input.value='第一种方案';input.dispatchEvent(new f.w.Event('input',{bubbles:true}));p.querySelector('[data-agent-send]').click();await pause();await pause();await new Promise(r=>setTimeout(r,150));assert.match(p.querySelector('[data-agent-history]').textContent,/第一种方案/);
 p.querySelector('[data-agent-new]').click();await pause();await pause();const second=p._threadId;assert.notEqual(second,first);assert(!p.querySelector('[data-agent-history]').textContent.includes('第一种方案'));
 const topic=()=>[...p.querySelectorAll('.frameAgentTopic')].find(t=>t.firstElementChild.getAttribute('aria-pressed')==='true');[...topic().querySelectorAll('button')].find(b=>b.textContent==='删除').click();await pause();await pause();assert(p.querySelector('[data-agent-send]').disabled);assert.match(p.querySelector('[data-agent-status]').textContent,/回收站/);p.querySelector('[data-agent-trash]').click();await pause();const restore=[...p.querySelectorAll('.frameAgentTopic button')].find(b=>b.textContent==='恢复');assert(restore);restore.click();await pause();await pause();assert.equal(p._threadId,second);assert(!p.querySelector('[data-agent-send]').disabled);
 const handle=p.querySelector('.frameAgentHandle');handle.dispatchEvent(new f.w.MouseEvent('pointerdown',{button:0,clientX:200,clientY:200,bubbles:true}));await pause();handle.dispatchEvent(new f.w.MouseEvent('pointermove',{clientX:250,clientY:240,bubbles:true}));handle.dispatchEvent(new f.w.MouseEvent('pointerup',{bubbles:true}));assert.equal(p.style.transform,'none');assert(p.style.left);assert(f.w.localStorage.getItem('frame.dock.project-agent'));
 const sh=f.project.segments[0].shots[0],sid=f.project.segments[0].id;d.querySelector('[data-overview-select="h:'+sid+':'+sh.id+'"]').click();await pause();await pause();d.querySelector('.frameAgentEntry').click();await pause();await pause();const node=d.querySelector('.frameAgentNode');assert(!node.hidden);f.w.eval('P').segments=[];f.project.segments=[];await f.w.pollTasks();await new Promise(r=>setTimeout(r,180));assert.match(node.querySelector('[data-agent-status]').textContent,/已删除/);assert(node.querySelector('[data-agent-send]').disabled);
 f.w._wholeStoryDraft={story:'方案',count:'2',duration:'15',sourceProjectId:f.project.projectId,sourceAgentTaskId:'image-source',imageName:'产品.png'};await f.w.openStoryPlanner();assert(f.el('wholeAgentImage').checked);assert.match(f.el('modalBody').textContent,/产品.png/);assert.equal(f.errors.length,0);console.log('PASS: isolated Agent topics, recoverable deletion, compact launcher, project drag and persistence, stale node history and planning image handoff');
 }finally{f.w.close()}
}
async function v319Checks(){
 const source=copy(sample);source.segments[0].planning={warnings:['测试提醒：人物场景需要核对'],summary:'故事'};source.assets[0].name='素材';source.segments[0].shots[0].action='故事';
 const f=await fixture(source,'professional'),sid=source.segments[0].id,live=()=>f.w.eval('P');
 const click=async selector=>{const el=f.w.document.querySelector(selector);assert(el,'Missing '+selector);el.click();await pause();await pause()};
 const pointer=async(type,target,x,y)=>{target.dispatchEvent(new f.w.MouseEvent(type,{clientX:x,clientY:y,button:0,bubbles:true,cancelable:true}));await pause()};
 try{
 f.el('startResume').click();await pause();await pause();assert(f.w.document.querySelector('.canvasOutputCheck.hasWarnings'));assert.equal(f.w.document.querySelector('.canvasOutputCheck').getAttribute('role'),'alert');
 await click('[data-card-mode]');await click('[data-overview-select="s:'+sid+'"]');
 const prompt=f.el('canvas_segmentPrompt'),oldShots=copy(live().segments[0].shots);prompt.value='简单剧情';prompt.dispatchEvent(new f.w.Event('input',{bubbles:true}));await click('[data-canvas-action="save"]');assert.match(f.w.document.querySelector('.canvasEditStatus').textContent,/未找到有效时间线/);assert.deepEqual(copy(live().segments[0].shots),oldShots);
 f.el('canvas_duration').value='5';f.el('canvas_duration').dispatchEvent(new f.w.Event('input',{bubbles:true}));await click('[data-manual-prompt-template]');assert.match(f.el('canvas_segmentPrompt').value,/0.00s–5.00s/);await click('[data-canvas-action="save"]');assert.equal(f.project.segments[0].duration,5);assert.equal(f.project.segments[0].shots.at(-1).end,5);
 const card=()=>f.w.document.querySelector('[data-segment-card="'+sid+'"]'),map=f.w.document.querySelector('.overviewMap'),node=()=>f.w.document.querySelector('[data-overview-select="s:'+sid+'"]');
 await click('[data-card-toggle="'+sid+'"]');assert.equal(live().overviewLayout.canvas37.collapsedCards[sid],true);assert.equal(card().querySelector('[data-card-toggle]').getAttribute('aria-expanded'),'false');assert(!f.w.document.querySelector('[data-overview-select="p:'+sid+'"]'));
 const before=copy(live().overviewLayout.canvas37.positions),startX=parseFloat(node().style.left);await pointer('pointerdown',card().querySelector('[data-card-drag]'),100,100);await pointer('pointermove',map,160,140);await pointer('pointerup',map,160,140);await f.w.flush();assert(parseFloat(node().style.left)>startX);const after=copy(live().overviewLayout.canvas37.positions);for(const id of Object.keys(before).filter(id=>id.includes(sid)))assert(Math.abs((after[id].x-before[id].x)-(after['s:'+sid].x-before['s:'+sid].x))<.001,'Hidden members move with card');
 await click('[data-card-toggle="'+sid+'"]');assert(f.w.document.querySelector('[data-overview-select="p:'+sid+'"]'));await click('[data-cards-collapse]');assert.equal(f.w.document.querySelectorAll('.canvasStoryLayer .overviewNode').length,source.segments.length+1);await click('[data-cards-expand]');assert(f.w.document.querySelectorAll('.overviewNode').length>source.segments.length+1);
 // Language changes never render again, replace input values, change option values or save project content.
 await click('[data-overview-select="s:'+sid+'"]');const story=f.el('canvas_story');story.focus();story.value='故事、素材、提示词保持中文';story.setSelectionRange(3,5);story.dispatchEvent(new f.w.Event('input',{bubbles:true}));const projectBefore=JSON.stringify(live()),saves=f.calls.filter(c=>c.route==='project'&&c.body).length;
 const languageControl=f.w.document.querySelector('.canvasQuickNav [data-ui-language]');languageControl.value='en';const marker=f.w.document.createElement('span');marker.textContent='任务中心';f.w.document.body.append(marker);await pause();assert.equal(languageControl.value,'en','Background UI refresh must not reset a pending native selection');languageControl.dispatchEvent(new f.w.Event('input',{bubbles:true}));await pause();assert.equal(f.w.document.documentElement.lang,'en');assert.equal(f.w.document.querySelector('[data-canvas-tasks]').textContent.trim(),'Task Center 0');assert.match(f.el('startCreate').textContent,/Create project/);assert.equal(story.value,'故事、素材、提示词保持中文');assert.equal(story.selectionStart,3);assert.equal(JSON.stringify(live()),projectBefore);assert.equal(f.calls.filter(c=>c.route==='project'&&c.body).length,saves);assert.equal(f.el('canvas_genTask').value,'r2v');assert.equal(f.w.localStorage.getItem('frame-ui-language'),'en');
 const select=f.w.document.createElement('select');select.innerHTML='<option>人物</option><option>场景</option>';f.w.document.body.append(select);await pause();assert.equal(select.options[0].textContent,'Character');assert.equal(select.options[0].value,'人物');
 const detailLanguage=f.w.document.querySelector('header [data-ui-language]');detailLanguage.value='zh';detailLanguage.dispatchEvent(new f.w.Event('change',{bubbles:true}));await pause();assert.equal(select.options[0].textContent,'人物');assert.equal(story.value,'故事、素材、提示词保持中文');assert.equal(JSON.stringify(live()),projectBefore);assert.equal(f.errors.length,0);
 await click('[data-canvas-action="bilingual"]');assert(f.el('promptLanguageView'));assert.equal(f.el('translatedPromptText').value,f.project.segments[0].prompt);f.el('promptLanguageView').value='en';f.el('promptLanguageView').dispatchEvent(new f.w.Event('change',{bubbles:true}));assert.equal(f.el('translatedPromptText').value,'English copy');assert.equal(f.project.segments[0].promptExportLanguage,undefined);f.w.close();
 console.log('PASS: highlighted warnings, valid manual template/current duration, invalid drafts preserved, collapsed card/hidden-member drag, all-collapse, locale draft/data/option safety');
 }finally{f.dom.window.close()}
}
async function overviewChecks(){
 const source=copy(sample);source.assets[1].pictureNumber=8;source.assets[2].pictureNumber=10;
 source.segments[0].shots[0].image=source.assets[0].path;
 source.segments[0].videos=[{id:'video-one',title:'旧视频',name:'demo.mp4',path:'videos/demo.mp4',note:'旧备注'}];
 const f=await fixture(source,'professional');
 const live=()=>f.w.eval('P'), sid=source.segments[0].id, hid=source.segments[0].shots[0].id;
 const detail=()=>f.el('overviewDialog').querySelector('.overviewDetail');
 const click=async selector=>{const el=f.el('overviewDialog').querySelector(selector);assert(el,'Missing control '+selector);el.click();await pause();await pause()};
 const choose=async id=>click('[data-overview-select="'+id+'"]');
 const set=(key,value)=>{const el=f.el('canvas_'+key);assert(el,'Missing field '+key);el.value=value;el.dispatchEvent(new f.w.Event('input',{bubbles:true}))};
 const save=()=>click('[data-canvas-action="save"]');
 try{
  f.el('startResume').click();f.el('projectOverview').click();await pause();await pause();
  assert.equal(f.el('overviewDialog').open,true);assert(f.el('canvas_story'));
  set('story','@Picture 2 与 @Picture 1 在 @Picture 3 交谈。');await save();
  assert.equal(f.project.segments[0].storyText,'@Picture 8 与 @Picture 1 在 @Picture 10 交谈。');assert(f.project.segments[0].storyHistory.length>=2);
  await choose('project');set('title','总览编辑项目');await choose('h:'+sid+':'+hid);
  assert.equal(f.project.title,'总览编辑项目','Selecting another node saves draft');
  set('action','@Picture 2 在 @Picture 3 柜台后点头');set('startState','@Picture 2 在柜台后');set('pro_size','特写');await save();
  assert.equal(f.project.segments[0].shots[0].action,'@Picture 8 在 @Picture 10 柜台后点头');assert.equal(f.project.segments[0].shots[0].professional.size,'特写');assert.equal(f.project.segments[0].shots[0].image,source.assets[0].path);assert(f.calls.some(c=>c.route==='rebuild'));
  await click('[data-canvas-action="reference-camera"]');assert.match(f.el('modalTitle').textContent,/视觉参考库/);f.el('referenceCards').querySelector('[data-reference-apply]').click();await pause();await pause();await f.w.flush();assert.equal(f.el('modal').open,false);assert.equal(f.project.segments[0].shots[0].professional.size,'特写');assert.equal(f.project.segments[0].shots[1].professional.size,source.segments[0].shots[1].professional.size,'Reference applies only to selected shot');assert.equal(f.el('canvas_pro_size').value,'特写');
  const before=f.project.segments[0].shots[0].action;
  set('end',1000);await save();assert.match(detail().textContent,/保存失败/);assert.equal(f.project.segments[0].shots[0].action,before);assert.equal(f.el('canvas_end').value,'1000');
  set('end',5);set('action','重建失败时保留输入');f.failRebuild=true;await save();assert.equal(live().segments[0].shots[0].action,before);assert.equal(f.el('canvas_action').value,'重建失败时保留输入');f.failRebuild=false;await save();assert.equal(f.project.segments[0].shots[0].action,'重建失败时保留输入');
  set('action','尚未提交的草稿');live().segments[0].shots[0].action='外部操作已更新';f.w.render();await pause();await save();assert.match(detail().textContent,/未覆盖|保留当前输入/);assert.equal(live().segments[0].shots[0].action,'外部操作已更新');await click('[data-canvas-action="discard"]');assert.equal(f.el('canvas_action').value,'外部操作已更新');
  await choose('a:'+source.assets[0].id);set('name','主角 A');set('description','全身蓝色制服，身份保持一致');await save();assert.equal(f.project.assets[0].description,'全身蓝色制服，身份保持一致');
  await choose('v:'+sid+':video-one');set('title','已生成版本 2');set('note','已检查空间连贯');await save();assert.equal(f.project.segments[0].videos[0].title,'已生成版本 2');assert.equal(f.project.segments[0].videos[0].note,'已检查空间连贯');
  await choose('p:'+sid);assert.equal(f.el('canvas_prompt').disabled,false);
  set('prompt','summary:\n人物交谈\ntimeline:\n[0.00s–5.00s]\n<Subject 2> 对 <Subject 1> 点头\nCamera: 中景\nDialogue: <Subject 2>: 你好 Picture 2\n[5.00s–10.00s]\n回应\n[10.00s–15.00s]\n微笑');await save();assert.equal(f.project.segments[0].shots[0].id,hid);assert.equal(f.project.segments[0].shots[0].image,source.assets[0].path);assert.match(f.project.segments[0].shots[0].action,/<Picture 8>/);assert.equal(f.project.segments[0].shots[0].dialogue,'<Picture 8>: 你好 Picture 2','Speaker mapped; literal speech preserved');
  await click('[data-canvas-action="add-segment"]');assert.equal(f.project.segments.length,source.segments.length+1);assert.equal(f.el('canvas_title').value,'片段 03','New segment selected');const created=f.project.segments.at(-1);assert.equal(created.continuity,false);
  await click('[data-canvas-action="add-shot"]');assert.equal(f.project.segments.at(-1).shots.length,1);assert(f.el('canvas_action'),'New shot selected');
  await click('[data-canvas-action="delete-shot"]');assert.equal(f.project.segments.at(-1).shots.length,0);assert(f.el('canvas_story'));
  set('story','新片段的独立故事');await click('[data-canvas-action="copy-segment"]');assert.equal(f.project.segments.length,source.segments.length+2);assert.match(f.el('canvas_title').value,/副本/);assert.equal(f.project.segments.at(-1).storyText,'新片段的独立故事');
  // Mention menus and tooltips stay reusable when closing and reopening the dialog.
  set('story','@');f.el('canvas_story').selectionStart=1;f.el('canvas_story').dispatchEvent(new f.w.Event('input',{bubbles:true}));assert(f.el('assetMentions'));
  await click('[data-canvas-home]');assert.equal(f.el('overviewDialog').open,false);f.el('projectOverview').click();await pause();await pause();assert(f.el('assetMentions'));assert(f.el('canvas_story'));
  assert.equal(f.errors.length,0);console.log('PASS: editable overview shared saves, numbering, history, validation, rollback, stale drafts, media preservation, prompt mapping, creation and reuse');
 }finally{f.dom.window.close()}
}
async function canvasInteractionChecks(){
 const f=await fixture(sample,'professional'),live=()=>f.w.eval('P'),sid=sample.segments[0].id;
 const dialog=()=>f.el('overviewDialog'),map=()=>dialog().querySelector('.overviewMap');
 const node=id=>dialog().querySelector('.overviewNode[data-overview-select="'+id+'"]');
 const click=async id=>{node(id).click();await pause();await pause()};
 const key=async(k,extra={},target=dialog())=>{target.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true,...extra}));await pause();await pause()};
 const pointer=async(type,target,x,y,extra={})=>{target.dispatchEvent(new f.w.MouseEvent(type,{clientX:x,clientY:y,button:0,bubbles:true,cancelable:true,...extra}));await pause()};
 const selectTwo=async()=>{await click('h:'+sid+':'+sample.segments[0].shots[0].id);node('h:'+sid+':'+sample.segments[0].shots[1].id).dispatchEvent(new f.w.MouseEvent('click',{bubbles:true,shiftKey:true}));await pause();await pause();assert.equal(dialog().querySelectorAll('.overviewNode.selected').length,2)};
 try{
  f.el('startResume').click();await pause();await pause();assert.equal(dialog().open,true,'Resume enters overview');
  await key('a',{ctrlKey:true});assert.equal(dialog().querySelectorAll('.overviewNode.selected').length,dialog().querySelectorAll('.overviewNode').length,'All visible nodes selected');
  await click('s:'+sid);f.el('canvas_story').value='未保存的故事';f.el('canvas_story').dispatchEvent(new f.w.Event('input',{bubbles:true}));await key('a',{ctrlKey:true},f.el('canvas_story'));assert.equal(dialog().querySelectorAll('.overviewNode.selected').length,1,'Text Ctrl+A does not select canvas');await key('s',{ctrlKey:true},f.el('canvas_story'));assert.equal(f.project.segments[0].storyText,'未保存的故事');
  await selectTwo();const first='h:'+sid+':'+sample.segments[0].shots[0].id,second='h:'+sid+':'+sample.segments[0].shots[1].id;
  const before=[node(first),node(second)].map(n=>({x:parseFloat(n.style.left),y:parseFloat(n.style.top)}));
  await pointer('pointerdown',node(first),100,100);await pointer('pointermove',map(),145,135);await pointer('pointerup',map(),145,135);await f.w.flush();
  assert.equal(dialog().querySelectorAll('.overviewNode.selected').length,2);const layout=f.project.overviewLayout.canvas37.positions;assert(layout[first]&&layout[second]);assert(Math.abs((layout[first].x-before[0].x)-(layout[second].x-before[1].x))<.001,'Batch drag preserves relative positions');
  await key('z',{ctrlKey:true});await f.w.flush();assert.equal(f.project.overviewLayout.canvas37.positions[first].x,before[0].x);
  await selectTwo();await key('Delete');assert.match(f.el('modalTitle').textContent,/删除所选/);f.el('modalActions').lastElementChild.click();await pause();await pause();await f.w.flush();assert.equal(f.project.segments[0].shots.length,1);assert.equal(f.project.assets.length,sample.assets.length,'Shared assets preserved');await key('z',{ctrlKey:true});await f.w.flush();assert.equal(f.project.segments[0].shots.length,3,'Deletion undo restores shots');
  const box=dialog().querySelector('.canvasSelectionBox');await pointer('pointerdown',map(),0,0);await pointer('pointermove',map(),900,650);assert.equal(box.hidden,false);await pointer('pointerup',map(),900,650);assert(dialog().querySelectorAll('.overviewNode.selected').length>1,'Blank drag selects nodes');assert.equal(box.hidden,true);
  await key('Escape');assert.equal(dialog().querySelectorAll('.overviewNode.selected').length,0);
  const v={...live().overviewLayout.canvas37.view};await pointer('pointerdown',map(),100,100,{button:1});await pointer('pointermove',map(),140,125,{button:1});await pointer('pointerup',map(),140,125,{button:1});assert.equal(live().overviewLayout.canvas37.view.x,v.x+40,'Middle mouse pans');
  map().dispatchEvent(new f.w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:150,clientY:150}));await pause();const menu=dialog().querySelector('.canvasContextMenu');assert.equal(menu.hidden,false);assert(menu.querySelector('[data-menu-command="add-segment"]'));await key('Escape');assert.equal(menu.hidden,true);assert.equal(dialog().open,true,'Esc closes menu before canvas');
  await click('s:'+sid);await key('Delete');f.el('modalActions').lastElementChild.click();await pause();await pause();await f.w.flush();assert.equal(f.project.segments.length,1);await key('z',{ctrlKey:true});await f.w.flush();assert.equal(f.project.segments.length,2);assert.equal(f.project.media[sample.assets[0].path],sample.media[sample.assets[0].path]);
  await click('s:'+sample.segments[0].id);node('s:'+sample.segments[1].id).dispatchEvent(new f.w.MouseEvent('click',{bubbles:true,shiftKey:true}));await pause();await key('Delete');f.el('modalActions').lastElementChild.click();await pause();await pause();await f.w.flush();assert.equal(f.project.segments.length,0,'Deleting all segments leaves a usable project');assert.equal(f.project.assets.length,sample.assets.length);assert(f.el('canvas_title'),'Project remains editable');await key('z',{ctrlKey:true});await f.w.flush();assert.equal(f.project.segments.length,2,'Undo restores all segments');
  assert.equal(f.errors.length,0);console.log('PASS: overview default entry, keyboard text safety, multiselect drag, layout undo, box select, pan, menus, batch deletion and restore');
 }finally{f.dom.window.close()}
}
async function optimizationAndLibraryChecks(){
 const f=await fixture(sample,'professional'),sid=sample.segments[0].id,first='h:'+sid+':'+sample.segments[0].shots[0].id;
 const dialog=()=>f.el('overviewDialog'),map=()=>dialog().querySelector('.overviewMap'),node=id=>dialog().querySelector('.overviewNode[data-overview-select="'+id+'"]');
 try{
  f.el('startResume').click();await pause();await pause();const a=node('a:'+sample.assets[0].id),image=a.querySelector('img'),path=dialog().querySelector('.overviewEdges>path');
  node(first).click();await pause();await pause();assert.equal(node('a:'+sample.assets[0].id),a);assert.equal(a.querySelector('img'),image);assert.equal(dialog().querySelector('.overviewEdges>path'),path,'SVG paths reused across selection');
  const request=f.w.requestAnimationFrame,cancel=f.w.cancelAnimationFrame;let queue=[];f.w.requestAnimationFrame=cb=>{queue.push(cb);return queue.length};f.w.cancelAnimationFrame=()=>{};
  node(first).dispatchEvent(new f.w.MouseEvent('pointerdown',{bubbles:true,button:0,clientX:100,clientY:100}));await pause();const measures=f.w._nodeMeasures;await f.w.flush();const fullSaves=f.calls.filter(c=>c.route==='project'&&c.body).length;
  for(let i=0;i<120;i++)map().dispatchEvent(new f.w.MouseEvent('pointermove',{bubbles:true,clientX:100+i,clientY:100+i}));assert.equal(queue.length,1,'120 pointer events coalesce into one frame');assert.equal(f.w._nodeMeasures,measures);queue.shift()();assert.equal(f.w._nodeMeasures,measures,'Drag uses cached geometry, without per-frame layout reads');map().dispatchEvent(new f.w.MouseEvent('pointerup',{bubbles:true}));await pause();f.w.requestAnimationFrame=request;f.w.cancelAnimationFrame=cancel;await f.w.flush();assert.equal(f.calls.filter(c=>c.route==='project'&&c.body).length,fullSaves,'Layout-only save avoids serializing the full project in the browser');assert(f.calls.some(c=>c.route==='canvas-layout'));
  assert.equal(dialog().querySelector('.overviewEdges>path'),path);assert.equal(a.querySelector('img'),image);
  await f.w.openVisualReference('size');await pause();assert(f.el('importReferencePack'));assert(f.el('referenceStorage').textContent.includes('不设媒体容量上限'));
  f.el('referenceCards').querySelector('[data-reference-edit]').click();await pause();await pause();assert(f.el('customRefFile'));
  const png=new f.w.File([new Uint8Array([137,80,78,71,13,10,26,10,1])],'reference.png',{type:'image/png'});Object.defineProperty(f.el('customRefFile'),'files',{configurable:true,value:[png]});f.el('customRefFile').onchange({target:f.el('customRefFile')});await pause();await pause();assert.match(f.el('customRefStatus').textContent,/已读入/);f.el('modalActions').lastElementChild.click();await pause();await pause();assert(f.calls.some(c=>c.route==='visual-references'&&c.body?.image?.startsWith('data:image/png;base64,')),'Single reference image upload remains functional');
  const pack=new f.w.File(['TEST'],'test.frame-refs.zip',{type:'application/zip'});Object.defineProperty(f.el('referencePackFile'),'files',{configurable:true,value:[pack]});f.el('referencePackFile').onchange({target:f.el('referencePackFile')});await pause();await pause();assert.match(f.el('modalTitle').textContent,/导入视觉参考/);assert.equal(f.el('referencePackMode').value,'keep');f.el('referencePackMode').value='replace';f.el('referencePackMode').onchange();f.el('modalActions').lastElementChild.click();await pause();assert.match(f.el('referencePackError').textContent,/确认替换/);assert(!f.calls.some(c=>c.route==='visual-pack-apply'));f.el('referencePackAck').checked=true;f.el('modalActions').lastElementChild.click();await pause();await pause();assert(f.calls.some(c=>c.route==='visual-pack-apply'&&c.body.mode==='replace'));f.w.close();
  dialog().querySelector('[data-canvas-home]').click();await pause();await pause();assert(f.el('localProjectList').querySelector('[data-local-project]'));
  f.el('startCreate').click();f.el('startupProjectName').value='第二个项目';f.el('modalActions').lastElementChild.click();await pause();await pause();dialog().querySelector('[data-canvas-home]').click();await pause();await pause();assert.equal(f.el('localProjectList').querySelectorAll('.homeProject').length,2);f.el('localProjectList').querySelector('[data-local-project="'+sample.projectId+'"]').click();await pause();await pause();assert.equal(f.project.projectId,sample.projectId);assert.equal(dialog().open,true);assert.equal(f.errors.length,0);
  console.log('PASS: frame coalescing, cached geometry, retained media/path nodes, single reference upload, pack conflict confirmation and multiple project entry');
 }finally{f.dom.window.close()}
}
async function appearanceChecks(){
 const f=await fixture(sample,'simple');try{f.el('startResume').click();await pause();const d=f.el('overviewDialog');d.querySelector('[data-inspector-tab="settings"]').click();await pause();const panel=d.querySelector('.canvasSettings');assert.equal(panel.hidden,false);assert.equal(f.el('modal').open,false,'Settings are persistent, not a modal');
 const color=panel.querySelector('[data-appearance-color="highlight"]');color.value='#ff8800';color.dispatchEvent(new f.w.Event('input',{bubbles:true}));const bg=panel.querySelector('[data-appearance-color="background"]');bg.value='#102030';bg.dispatchEvent(new f.w.Event('input',{bubbles:true}));
 const pattern=panel.querySelector('[data-appearance-select="pattern"]');pattern.value='lines';pattern.dispatchEvent(new f.w.Event('change',{bubbles:true}));const grid=panel.querySelector('[data-appearance-number="gridSize"]');grid.value='48';grid.dispatchEvent(new f.w.Event('input',{bubbles:true}));assert.equal(d.style.getPropertyValue('--canvas-glow'),'#ff8800');assert.equal(d.dataset.canvasPattern,'lines');assert.equal(d.style.getPropertyValue('--canvas-grid-size'),'48px');await f.w.flush();assert.equal(f.project.overviewLayout.canvas37.appearance.background,'#102030');d.querySelector('[data-canvas-home]').click();await pause();await f.w.openFrameOverview();await pause();assert.equal(d.style.getPropertyValue('--canvas-glow'),'#ff8800');d.querySelector('[data-inspector-tab="settings"]').click();await pause();d.querySelector('[data-reset-appearance]').click();await f.w.flush();assert.equal(f.project.overviewLayout.canvas37.appearance.background,f.w.frameAppearance.defaults[f.w.frameAppearance.theme()].background);assert.equal(d.dataset.canvasPattern,'dots');assert.equal(f.errors.length,0);console.log('PASS: persistent Inspector settings, ranges, colors, persistence and reset');}finally{f.dom.window.close()}
}
async function canvasWorkflowChecks(){
 const source=copy(sample),f=await fixture(source,'professional'),live=()=>f.w.eval('P'),dialog=()=>f.el('overviewDialog'),map=()=>dialog().querySelector('.overviewMap');
 const first='s:'+source.segments[0].id,second='h:'+source.segments[0].id+':'+source.segments[0].shots[0].id,node=id=>[...dialog().querySelectorAll('.overviewNode')].find(el=>el.dataset.overviewSelect===id);
 const click=async el=>{el.click();await pause();await pause()};
 const pointer=async(type,target,x,y)=>{target.dispatchEvent(new f.w.MouseEvent(type,{clientX:x,clientY:y,button:0,bubbles:true,cancelable:true}));await pause()};
 const key=async(key,extra={})=>{map().dispatchEvent(new f.w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...extra}));await pause();await pause()};
 try{
  f.el('startResume').click();await pause();await pause();
  assert.equal(f.el('projectOverview').textContent,'画布模式');
  const original=JSON.stringify(live().segments),assets=JSON.stringify(live().assets);
  await click(node(first));node(second).dispatchEvent(new f.w.MouseEvent('click',{bubbles:true,shiftKey:true}));await pause();await key('g',{ctrlKey:true});
  assert.equal(live().overviewLayout.canvas37.groups.length,1);assert.equal(live().overviewLayout.canvas37.groups[0].members.length,2);
  const before=copy(live().overviewLayout.canvas37.positions),z=live().overviewLayout.canvas37.view.z;
  await pointer('pointerdown',node(second),100,100);await pointer('pointermove',map(),150,130);await pointer('pointerup',map(),150,130);await f.w.flush();
  for(const id of [first,second]){assert.equal(live().overviewLayout.canvas37.positions[id].x,before[id].x+50/z);assert.equal(live().overviewLayout.canvas37.positions[id].y,before[id].y+30/z)}
  assert.equal(JSON.stringify(live().segments),original);assert.equal(JSON.stringify(live().assets),assets,'Layout grouping cannot alter project content');
  assert(dialog().querySelector('.canvasGroupFrame'));
  dialog().querySelector('.canvasGroupLabel').dispatchEvent(new f.w.MouseEvent('dblclick',{bubbles:true}));await pause();f.el('canvasGroupName').value='主角和镜头';await click(f.el('modalActions').lastElementChild);assert.equal(live().overviewLayout.canvas37.groups[0].title,'主角和镜头');
  const grip=node(second).querySelector('.canvasResizeHandle');await pointer('pointerdown',grip,100,100);await pointer('pointermove',map(),200,170);await pointer('pointerup',map(),200,170);await f.w.flush();
  const size=copy(live().overviewLayout.canvas37.sizes[second]);assert(size.w>230&&size.h>100);assert.equal(node(second).style.width,size.w+'px');
  await key('z',{ctrlKey:true});assert.equal(live().overviewLayout.canvas37.sizes[second],undefined);assert.equal(node(second).style.width,'');
  await pointer('pointerdown',node(second).querySelector('.canvasResizeHandle'),100,100);await pointer('pointermove',map(),180,150);await pointer('pointerup',map(),180,150);await f.w.flush();
  const persisted=copy(live().overviewLayout.canvas37);
  await click(dialog().querySelector('[data-canvas-home]'));await click(f.el('projectOverview'));
  assert.deepEqual(copy(live().overviewLayout.canvas37.groups),persisted.groups);assert.equal(node(second).style.width,persisted.sizes[second].w+'px');
  await click(node(second));await key('g',{ctrlKey:true,shiftKey:true});assert.equal(live().overviewLayout.canvas37.groups.length,0);await key('z',{ctrlKey:true});assert.equal(live().overviewLayout.canvas37.groups.length,1);
  // A group member hidden by switching focus still moves with its visible member.
  await click(node('s:'+source.segments[1].id));assert(!node(second));
  const hiddenBefore=copy(live().overviewLayout.canvas37.positions[second]);
  await pointer('pointerdown',node(first),100,100);await pointer('pointermove',map(),130,140);await pointer('pointerup',map(),130,140);await f.w.flush();
  assert.equal(live().overviewLayout.canvas37.positions[second].x,hiddenBefore.x+30/live().overviewLayout.canvas37.view.z);
  // Validate direct export and import entry without a second implementation.
  let exports=0,imports=0;f.w.eval('downloadDirectorPack=async()=>{window._exports=(window._exports||0)+1}');
  await click(dialog().querySelector('[data-canvas-action="export-pack"]'));assert.equal(f.w._exports,1);
  map().dispatchEvent(new f.w.MouseEvent('contextmenu',{bubbles:true,clientX:20,clientY:20}));await pause();assert(dialog().querySelector('[data-menu-command="import-pack"]'));assert(dialog().querySelector('[data-menu-command="export-pack"]'));
  f.el('packFile').click=()=>imports++;await click(dialog().querySelector('[data-canvas-action="import-pack"]'));assert.equal(imports,1);assert.equal(dialog().open,false);
  await click(f.el('projectOverview'));await click(dialog().querySelector('[data-canvas-action="confirm-all-assets"]'));assert.equal(f.calls.filter(c=>c.route==='confirm-assets').at(-1).body.assets.length,source.assets.length);
  await click(f.w.document.querySelector('[data-confirm-assets="public"]'));assert(f.calls.filter(c=>c.route==='confirm-assets').at(-1).body.assets.every(row=>source.assets.find(a=>a.id===row.id).scope!=='segment'));
  assert.equal(f.errors.length,0);console.log('PASS: canvas group/hidden-member movement, rename, resize, undo, persistence, pack entry and bulk confirmation');
 }finally{f.dom.window.close()}
}
async function multimediaAndGenerationChecks(){
 const source=copy(sample),sid=source.segments[0].id;
 while(source.segments.length<4){const extra=copy(source.segments[0]);extra.id='test-segment-'+source.segments.length;extra.title='测试片段 '+source.segments.length;source.segments.push(extra)}
 source.assets.push({id:'voice',name:'声音参考',kind:'声音',mediaType:'audio',path:'extra/voice.wav',scope:'public',description:'声音参考'});source.media['extra/voice.wav']='UklGRg==';
 source.assets.push({id:'refvideo',name:'运动参考',kind:'视频',mediaType:'video',path:'extra/ref.mp4',scope:'segment',segmentId:sid,description:'运动参考'});source.media['extra/ref.mp4']='AAAA';
 const f=await fixture(source,'professional'),live=()=>f.w.eval('P');
 try{
  f.el('startResume').click();await pause();await pause();const dialog=f.el('overviewDialog');
  assert.equal(f.w.availableAssets().length,sample.assets.length,'Picture numbering excludes audio/video');assert.equal(f.w.allScopedAssets().length,sample.assets.length+2);
  assert(dialog.querySelector('[data-overview-select="a:voice"] audio[controls]'));assert(dialog.querySelector('[data-overview-select="a:refvideo"] video[controls]'));
  const audio=dialog.querySelector('[data-overview-select="a:voice"] audio');let delivered=false;audio.addEventListener('click',()=>delivered=true);audio.dispatchEvent(new f.w.MouseEvent('click',{bubbles:true}));assert(delivered,'Canvas capture must allow native media controls');
  await f.w.openGenerationSettings();f.el('generationTask').value='mixed';f.el('generationTask').dispatchEvent(new f.w.Event('change'));
  const rows=[...f.el('generationSegments').children];const modes=['r2v','fl2v','i2v','t2v'];for(const [i,row]of rows.entries()){row.querySelector('[data-generation="taskType"]').value=modes[i];for(const key of ['genImage','startImage','endImage'])row.querySelector('[data-generation="'+key+'"]').value=source.assets[0].path;}
  f.el('modalActions').lastElementChild.click();await pause();await pause();assert.equal(live().generation.taskType,'mixed');assert(live().generationManaged);assert.deepEqual(live().segments.map(s=>s.generation.taskType),modes);
  dialog.querySelector('[data-inspector-tab="settings"]').click();await pause();
  for(const style of ['straight','curve','hidden','orthogonal','default']){const input=dialog.querySelector('.canvasSettings [data-appearance-select="lineStyle"]');input.value=style;input.dispatchEvent(new f.w.Event('change',{bubbles:true}));await pause();assert.equal(dialog.dataset.canvasLineStyle,style);if(style==='hidden')assert.equal(dialog.querySelector('.overviewEdges').style.display,'none');else assert.notEqual(dialog.querySelector('.overviewEdges').style.display,'none');}
  const size=dialog.querySelector('.canvasSettings [data-appearance-number="bodySize"]');size.value='21';size.dispatchEvent(new f.w.Event('input',{bubbles:true}));assert.equal(dialog.style.getPropertyValue('--canvas-body-size'),'21px');
  const flow=dialog.querySelector('[data-appearance-check="flow"]');flow.checked=false;flow.dispatchEvent(new f.w.Event('change',{bubbles:true}));assert.equal(dialog.dataset.canvasFlow,'off');
  await f.w.flush();assert.equal(f.project.overviewLayout.canvas37.appearance.bodySize,21);assert.equal(f.errors.length,0);
  console.log('PASS: media roles, native control gesture safety, MIXED per-segment persistence, five edge styles, typography and animation settings');
 }finally{f.dom.window.close()}
}
async function blankPromptPlanningChecks(){
 const source=copy(sample);source.segments[0].shots=[];source.segments[0].prompt='';source.segments[0].planning={summary:''};source.segments[0].storyText='';
 const f=await fixture(source,'professional');try{
  f.w.eval("cfg.ai.model='test-model'");f.el('startResume').click();await pause();await pause();const d=f.el('overviewDialog');
  const input=(id,value)=>{const el=f.el(id);el.value=value;el.dispatchEvent(new f.w.Event('input',{bubbles:true}))};
  const click=async action=>{d.querySelector('[data-canvas-action="'+action+'"]').click();for(let i=0;i<5;i++)await pause()};
  input('canvas_story','@Picture 1 从入口走向柜台。');await click('plan');assert.equal(f.project.segments[0].storyText,'@Picture 1 从入口走向柜台。');assert(f.calls.some(c=>c.route==='plan-shots'),'Story-only segment can request AI planning with no prompt');assert(!d.querySelector('.canvasEditStatus').textContent.includes('失败'));
  input('canvas_duration','20');await click('save');assert.equal(f.project.segments[0].duration,20);assert.equal(f.el('canvas_segmentPrompt').value,f.project.segments[0].prompt,'Derived prompt is synchronized after rebuilding');
  input('canvas_story','@Picture 1 继续向柜台走去。');await click('save');assert.equal(f.project.segments[0].storyText,'@Picture 1 继续向柜台走去。','Untouched generated prompt is never treated as a new prompt edit');
  await click('add-shot');d.querySelector('[data-overview-select="s:'+source.segments[0].id+'"]').click();await pause();await pause();const shotIds=f.project.segments[0].shots.map(h=>h.id),plans=f.calls.filter(c=>c.route==='plan-shots').length;
  input('canvas_segmentPrompt','');input('canvas_story','@Picture 1 点头回应。');await click('plan');assert.equal(f.project.segments[0].prompt,'');assert.deepEqual(f.project.segments[0].shots.map(h=>h.id),shotIds,'Clearing a draft prompt does not delete shots');assert.equal(f.calls.filter(c=>c.route==='plan-shots').length,plans+1);assert.equal(f.errors.length,0);
  console.log('PASS: story-only AI planning, empty prompt drafts, derived prompt synchronization and existing shot preservation');
 }finally{f.dom.window.close()}
}
async function projectManagementChecks(){
 const f=await fixture(sample,'professional');try{
  const settle=async()=>{for(let i=0;i<6;i++)await pause()},confirm=async()=>{f.el('modalActions').lastElementChild.click();await settle()};
  await settle();assert.equal(f.el('localProjectList').querySelectorAll('[data-delete-project]').length,1);const list=()=>f.el('localProjectList');
  list().querySelector('[data-delete-project]').click();await settle();assert.match(f.el('modalTitle').textContent,/删除本机项目/);f.el('modalActions').firstElementChild.click();await settle();assert.equal(list().querySelectorAll('.homeProject').length,1,'Cancelling deletion changes nothing');
  list().querySelector('[data-delete-project]').click();await settle();await confirm();assert.equal(f.project,null);assert.equal(f.w.eval('P'),null);assert.equal(list().querySelectorAll('.homeProject').length,0);assert.equal(f.el('clearLocalProjects').disabled,true);
  f.el('localProjectTrash').click();await settle();assert.equal(f.el('modalBody').querySelectorAll('[data-restore-project]').length,1);f.el('modalBody').querySelector('[data-restore-project]').click();await settle();assert.equal(list().querySelectorAll('.homeProject').length,1);assert.equal(f.el('modalBody').querySelectorAll('[data-restore-project]').length,0);f.w.close();
  list().querySelector('[data-local-project]').click();await settle();const d=f.el('overviewDialog');assert.equal(d.open,true);const quick=d.querySelector('.overviewHead').firstElementChild;assert(quick.classList.contains('canvasQuickNav'));assert(quick.querySelector('[data-canvas-home]'));assert(quick.querySelector('[data-canvas-tasks]'));assert(!d.querySelector('.canvasMore [data-canvas-tasks]'));
  f.tasks=[{id:'queue-1',type:'planning',status:'waiting',projectId:sample.projectId,segmentId:sample.segments[0].id,title:'排队任务',createdMs:Date.now()}];await f.w.pollTasks();assert.equal(d.querySelector('[data-canvas-task-count]').textContent,'1');quick.querySelector('[data-canvas-tasks]').click();await settle();assert.match(f.el('modalTitle').textContent,/任务中心/);f.w.close();quick.querySelector('[data-canvas-home]').click();await settle();assert.equal(f.w.document.body.dataset.startupView,'home');
  await f.w.createStartupProject(false,'第二个项目');await settle();d.querySelector('[data-canvas-home]').click();await settle();assert.equal(list().querySelectorAll('.homeProject').length,2);f.el('clearLocalProjects').click();await settle();assert.match(f.el('modalTitle').textContent,/清空全部/);await confirm();assert.equal(f.project,null);assert.equal(list().querySelectorAll('.homeProject').length,0);
  f.el('localProjectTrash').click();await settle();assert.equal(f.el('modalBody').querySelectorAll('[data-restore-project]').length,2);assert.equal(f.errors.length,0);
  console.log('PASS: direct left home/example and task count, individual project delete/cancel/restore and clear-all empty state');
 }finally{f.dom.window.close()}
}
async function uninterruptedTypingChecks(){
 const f=await fixture(sample,'professional'),live=()=>f.w.eval('P');
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 try{
  f.el('startResume').click();await pause();await pause();
  const dialog=f.el('overviewDialog'),story=f.el('canvas_story'),title=f.el('canvas_title'),original=live().segments[0].storyText;
  const writes=()=>f.calls.filter(c=>c.route==='rebuild'||c.route==='project'&&c.body).length;
  const input=(field,text)=>{field.value=text;field.dispatchEvent(new f.w.Event('input',{bubbles:true}))};
  story.focus();input(story,'写到一半，先想一想');story.setSelectionRange(3,6);story.scrollTop=22;
  const baseline=writes();await wait(1000);
  assert.equal(writes(),baseline,'Pausing while focused must not save or rebuild');assert.equal(live().segments[0].storyText,original);
  assert.equal(f.w.document.activeElement,story);assert.equal(story.disabled,false);assert.equal(story.selectionStart,3);assert.equal(story.selectionEnd,6);assert.equal(f.el('canvas_story'),story);
  input(story,'@');story.setSelectionRange(1,1);story.dispatchEvent(new f.w.Event('input',{bubbles:true}));assert.equal(f.el('assetMentions').hidden,false);
  const imeEnter=new f.w.KeyboardEvent('keydown',{key:'Enter',keyCode:229,isComposing:true,bubbles:true,cancelable:true});story.dispatchEvent(imeEnter);assert.equal(imeEnter.defaultPrevented,false,'IME Enter must not insert a Picture reference');assert.equal(story.value,'@');
  story.dispatchEvent(new f.w.CompositionEvent('compositionstart',{bubbles:true}));assert.equal(f.el('assetMentions').hidden,true);
  story.value='中文选词中';story.dispatchEvent(new f.w.InputEvent('input',{bubbles:true,isComposing:true}));await wait(1000);assert.equal(writes(),baseline,'IME composition must not save');
  story.dispatchEvent(new f.w.CompositionEvent('compositionend',{bubbles:true,data:'中文'}));await wait(900);assert.equal(writes(),baseline,'Confirming IME text must not interrupt continued editing');
  title.focus();input(title,'新的片段名称');await wait(1000);assert.equal(writes(),baseline,'Tabbing between text fields must not save mid-edit');
  input(story,'完整故事，写完再保存。');f.el('overviewSearch').focus();await wait(400);await f.w.flush();
  assert.equal(f.project.segments[0].storyText,'完整故事，写完再保存。');assert.equal(f.project.segments[0].title,'新的片段名称');assert.equal(f.el('canvas_story'),story,'Blur save retains the existing input nodes');
  // A previously scheduled select save must also defer if text editing starts before it runs.
  f.el('canvas_genTask').value='t2v';f.el('canvas_genTask').dispatchEvent(new f.w.Event('change',{bubbles:true}));
  story.focus();input(story,'改模式后继续写故事');const pending=writes();await wait(1000);assert.equal(writes(),pending);
  story.setSelectionRange(2,5,'backward');story.scrollTop=37;
  story.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}));await pause();await pause();await f.w.flush();
  assert.equal(f.project.segments[0].storyText,'改模式后继续写故事');assert.equal(f.w.document.activeElement,story);assert.equal(story.selectionStart,2);assert.equal(story.selectionEnd,5);assert.equal(story.selectionDirection,'backward');assert.equal(story.scrollTop,37);
  const sid=sample.segments[0].id,hid=sample.segments[0].shots[0].id;
  dialog.querySelector('[data-overview-select="h:'+sid+':'+hid+'"]').click();await pause();await pause();
  const action=f.el('canvas_action'),before=live().segments[0].shots[0].action;action.focus();input(action,'镜头动作还没写完');action.setSelectionRange(2,4);
  const shotBaseline=writes();await wait(1000);assert.equal(writes(),shotBaseline,'Shot text uses the same uninterrupted editing rule');assert.equal(live().segments[0].shots[0].action,before);
  f.failRebuild=true;action.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}));await pause();await pause();
  assert.match(dialog.querySelector('.canvasEditStatus').textContent,/失败/);assert.equal(action.value,'镜头动作还没写完');assert.equal(f.w.document.activeElement,action);assert.equal(action.selectionStart,2);assert.equal(action.selectionEnd,4);assert.equal(action.disabled,false);f.failRebuild=false;
  input(action,'镜头动作完整保存');dialog.querySelector('[data-overview-select="s:'+sample.segments[1].id+'"]').click();await pause();await pause();await f.w.flush();
  assert.equal(f.project.segments[0].shots[0].action,'镜头动作完整保存','Switching nodes saves the completed draft');assert(f.el('canvas_story'));assert.equal(f.errors.length,0);
  console.log('PASS: focused typing pauses, IME and mention Enter, field-to-field editing, blur/node saves, pending timers, Ctrl+S caret and failed drafts');
 }finally{f.dom.window.close()}
}
async function inspectorWorkflowChecks(){
 const source=copy(sample);source.segments[1].shots=[{...copy(source.segments[0].shots[0]),id:'drop-shot-second'}];
 const f=await fixture(source,'professional'),live=()=>f.w.eval('P');try{
 f.el('startResume').click();await pause();await pause();const d=f.el('overviewDialog'),map=d.querySelector('.overviewMap'),first=source.segments[0],second=source.segments[1];
 const click=async id=>{d.querySelector('[data-overview-select="'+id+'"]').click();await pause();await pause()};
 assert.equal(d.querySelectorAll('[data-inspector-tab]').length,3);assert(d.querySelector('[data-canvas-field="genTask"]'));assert(!d.querySelector('.canvasSegmentNavigation[open]'));
 f.el('canvas_title').value='自动保存后的片段';f.el('canvas_title').dispatchEvent(new f.w.Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,1000));await f.w.flush();assert.equal(f.project.segments[0].title,'自动保存后的片段');assert.notEqual(live().generation?.taskType,'mixed','Ordinary edits must not switch generation mode');
 f.el('canvas_genTask').value='i2v';f.el('canvas_genTask').dispatchEvent(new f.w.Event('change',{bubbles:true}));assert.equal(d.querySelector('[data-inline-input="genImage"]').hidden,false);d.querySelector('[data-canvas-field="gen_genImage"]').value=sample.assets[0].path;d.querySelector('[data-canvas-field="gen_genImage"]').dispatchEvent(new f.w.Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,1000));await f.w.flush();assert.equal(live().generation.taskType,'mixed');assert.equal(live().segments[0].generation.taskType,'i2v');assert.equal(live().segments[1].generation.taskType,'r2v');
 await click('h:'+first.id+':'+first.shots[0].id);const prior=live().segments[0].shots[0].action;f.failRebuild=true;f.el('canvas_action').value='失败后保留的草稿';f.el('canvas_action').dispatchEvent(new f.w.Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,1000));assert.equal(live().segments[0].shots[0].action,prior);assert.equal(f.el('canvas_action').value,'失败后保留的草稿');assert.match(d.querySelector('.canvasEditStatus').textContent,/失败/);f.failRebuild=false;d.querySelector('[data-canvas-action="save"]').click();await pause();await pause();assert.equal(live().segments[0].shots[0].action,'失败后保留的草稿');
 await click('project');assert(!f.el('canvas_language'));assert(!f.el('canvas_fps'));await click('s:'+first.id);assert(f.el('canvas_language'));assert.equal(f.el('canvas_language').closest('details').dataset.editorSection,'basic');assert.equal(live().fps,sample.fps);
 const drop=async(target,name,type)=>{const file=new f.w.File([new Uint8Array([137,80,78,71,13,10,26,10,1])],name,{type});const e=new f.w.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:{files:[file],types:['Files']}});Object.defineProperty(e,'clientX',{value:400});Object.defineProperty(e,'clientY',{value:350});target.dispatchEvent(e);for(let i=0;i<5;i++)await pause();await f.w.flush()};
 await click('a:'+sample.assets[0].id);const oldPath=live().assets[0].path;await drop(map,'public.png','image/png');const pub=live().assets.at(-1);assert.equal(pub.scope,'public');assert.equal(live().assets[0].path,oldPath,'Blank drop adds even with existing asset selected');assert(live().overviewLayout.canvas37.positions['a:'+pub.id]);
 await click('s:'+second.id);const shot=d.querySelector('[data-overview-select="h:'+second.id+':'+second.shots[0].id+'"]');const oldFrame=live().segments[1].shots[0].image;await drop(shot,'local.wav','audio/wav');const local=live().assets.at(-1);assert.equal(local.scope,'segment');assert.equal(local.segmentId,second.id);assert.equal(local.mediaType,'audio');assert.equal(live().segments[1].shots[0].image,oldFrame);assert(!f.w.allScopedAssets(live().segments[0]).includes(local));
 const oldLocalPath=local.path,assetNode=d.querySelector('[data-overview-select="a:'+local.id+'"]');await drop(assetNode,'replacement.wav','audio/wav');assert.equal(live().assets.at(-1).id,local.id);assert.notEqual(live().assets.at(-1).path,oldLocalPath);
 await click('a:'+pub.id);d.querySelector('[data-canvas-action="delete-asset"]').click();await pause();assert.match(f.el('modalTitle').textContent,/删除素材/);f.el('modalActions').lastElementChild.click();for(let i=0;i<4;i++)await pause();await f.w.flush();assert(live().assets.find(a=>a.id===pub.id).deleted);assert(live().media[pub.path]);d.querySelector('[data-restore-asset="'+pub.id+'"]').click();for(let i=0;i<4;i++)await pause();assert.equal(live().assets.find(a=>a.id===pub.id).deleted,false);
 d.querySelector('[data-inspector-tab="settings"]').click();await pause();for(const style of ['pcb','orthogonal','straight','curve','hidden']){const select=d.querySelector('[data-appearance-select="lineStyle"]');select.value=style;select.dispatchEvent(new f.w.Event('change',{bubbles:true}));await pause();assert.equal(d.dataset.canvasLineStyle,style)}
 const route=f.w.frameCanvasEdge.path('pcb',0,0,200,100);assert(!route.includes('NaN'));assert.match(route,/L86,0 L100,14/);for(const type of ['chevron2','chevron3','diamond','crosshair','chiseled','pulse'])assert(f.w.frameCanvasEdge.shape(type));assert.equal(f.errors.length,0);console.log('PASS: Inspector tabs, autosave, inline MIXED, visible language, drop routing/replacement, reversible asset deletion and PCB geometry');
 }finally{f.dom.window.close()}
}
async function run(){
 await inlineEditingChecks();if(process.env.FRAME_INLINE_ONLY)return;
 await interactionUpgradeChecks();if(process.env.FRAME_INTERACTION_ONLY)return;
 await nameOnlyMentionChecks();if(process.env.FRAME_MENTIONS_ONLY)return;
 await planningRepairChecks();if(process.env.FRAME_PLANNING_ONLY)return;
 await runtimeAndPromptChecks();if(process.env.FRAME_RUNTIME_ONLY)return;await visualOptionsChecks();await paletteChecks();await upgradeChecks();if(process.env.FRAME_UPGRADE_ONLY)return;
 await canvasOnlyStartupChecks();
 await assetDecouplingChecks();
 await agentTopicChecks();
 await agentChecks();
 await overviewChecks();
 await canvasInteractionChecks();
 await optimizationAndLibraryChecks();
 await appearanceChecks();
 await canvasWorkflowChecks();
 await multimediaAndGenerationChecks();
 await inspectorWorkflowChecks();
 await uninterruptedTypingChecks();
 await blankPromptPlanningChecks();
 await projectManagementChecks();
 await creativeCanvasChecks();
 await presetAndDisclosureChecks();await floatingEditorChecks();await v322Checks();await v321Checks();await repairAndInspectorChecks();await v319Checks();
}
async function presetAndDisclosureChecks(){
 const f=await fixture(sample,'professional');
 const click=async selector=>{const el=f.w.document.querySelector(selector);assert(el,'Missing '+selector);el.click();await pause();await pause()};
 const edit=(id,value)=>{const el=f.el(id);el.value=value;el.dispatchEvent(new f.w.Event('input',{bubbles:true}));};
 try{await f.w.openFrameOverview();await pause();await pause();const d=f.el('overviewDialog'),s=sample.segments[0],story=f.el('canvas_story');story.value='草稿未丢失';story.dispatchEvent(new f.w.Event('input',{bubbles:true}));
  await click('[data-editor-fold="close"]');assert([...d.querySelectorAll('.canvasEditFields details')].every(el=>!el.open));assert.equal(f.el('canvas_story'),story);assert.equal(story.value,'草稿未丢失');
  await click('[data-editor-fold="open"]');assert([...d.querySelectorAll('.canvasEditFields details')].every(el=>el.open));
  await click('[data-manage-preset="story"]');f.el('presetName').value='剧情模板';f.el('presetContent').value='新剧情';f.el('presetShortcut').value='Alt+Shift+1';await click('#presetSave');assert(f.calls.some(c=>c.route==='editor-presets'&&c.body?.name==='剧情模板'));f.w.close();
  story.focus();story.setSelectionRange(story.value.length,story.value.length);story.dispatchEvent(new f.w.KeyboardEvent('keydown',{code:'Digit1',key:'1',altKey:true,shiftKey:true,bubbles:true,cancelable:true}));await pause();await pause();assert.match(story.value,/新剧情/);
  await click('[data-overview-select="h:'+s.id+':'+s.shots[0].id+'"]');await click('[data-manage-preset="action"]');f.visualRows=[{id:'custom-action',category:'action',title:'自定义挥手',note:'抬手打招呼'}];await click('#presetRefresh');await click('[data-preset-source="visual"]');f.el('presetCategory').value='action';f.el('presetCategory').dispatchEvent(new f.w.Event('change'));const rows=[...f.el('presetRows').querySelectorAll('article')];rows.find(r=>r.querySelector('b').textContent==='自定义挥手').querySelector('button').click();await pause();await pause();f.w.close();
  f.visualRows=[{id:'custom-action',category:'action',title:'自定义挥手',note:'使用最新库内容'}];const chip=[...d.querySelectorAll('[data-preset-field="action"] [data-preset-id]')].find(el=>el.textContent==='自定义挥手');chip.click();await pause();await pause();assert.match(f.el('canvas_action').value,/使用最新库内容/);
  f.visualRows=[];await f.w.frameEditorPresets.reload();await click('[data-floating-next]');await click('[data-floating-prev]');const missing=[...d.querySelectorAll('[data-preset-field="action"] [data-preset-id]')].find(el=>el.textContent==='自定义挥手');assert(missing.disabled,'Deleted library binding is disabled');
  await click('[data-editor-fold="close"]');await click('[data-floating-next]');assert([...d.querySelectorAll('details[data-editor-section]')].every(el=>!el.open));assert.equal(f.errors.length,0);console.log('PASS: section folding retains live drafts, persisted fold state, custom shortcuts, live library binding and deleted reference handling');
 }finally{f.dom.window.close()}
}
async function floatingEditorChecks(){
 const f=await fixture(sample,'professional');
 const click=async selector=>{const el=f.w.document.querySelector(selector);assert(el,'Missing '+selector);el.click();await pause();await pause()};
 const edit=(id,value)=>{const el=f.el(id);el.value=value;el.dispatchEvent(new f.w.Event('input',{bubbles:true}));};
 try{
  await f.w.openFrameOverview();await pause();const d=f.el('overviewDialog'),s=sample.segments[0];
  await click('[data-overview-select="h:'+s.id+':'+s.shots[0].id+'"]');
  assert(d.classList.contains('floatingEditorMode'));assert.equal(f.el('canvas_action').closest('.canvasFloatingEditor')!==null,true);
  const handle=d.querySelector('.floatingEditorHandle');handle.setPointerCapture=()=>{};
  const pointer=(type,x,y)=>{const e=new f.w.MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0});Object.defineProperty(e,'pointerId',{value:1});handle.dispatchEvent(e)};
  pointer('pointerdown',10,10);await pause();pointer('pointermove',50,65);assert.equal(d.querySelector('.canvasFloatingEditor').style.top,'55px');pointer('pointerup',50,65);
  const firstEnd=Number(f.el('canvas_end').value);edit('canvas_action','floating draft');f.el('canvas_action').focus();
  f.failRebuild=true;await click('[data-floating-next]');assert.equal(f.el('canvas_action').value,'floating draft');assert.match(d.querySelector('.canvasEditStatus').textContent,/保存失败/);
  await click('[data-floating-close]');assert.equal(d.querySelector('.canvasFloatingEditor').hidden,false,'Failed saves keep editor open');
  f.failRebuild=false;await click('[data-floating-next]');assert.equal(f.project.segments[0].shots[0].action,'floating draft');assert.equal(d.querySelector('[data-floating-count]').textContent,'2 / '+s.shots.length);
  await click('[data-floating-prev]');assert.equal(f.el('canvas_action').value,'floating draft');
  edit('canvas_end',String(firstEnd+0.1));assert.match(d.querySelector('.floatingShotDuration').textContent,/秒/);assert.equal(d.querySelector('.floatingTimeSuggestion').hidden,false);
  await click('.floatingTimeSuggestion button');assert.equal(f.project.segments[0].shots[1].start,firstEnd+0.1);
  const camera=f.el('canvas_camera');camera.setSelectionRange(camera.value.length,camera.value.length);await click('.floatingCameraChips button');assert.match(f.el('canvas_camera').value,/中景/);
  await click('.unifiedEditorPanel [data-panel-dock="right"]');assert.equal(d.classList.contains('floatingEditorMode'),false);assert(f.el('canvas_action').closest('.canvasInspector'));assert.equal(JSON.parse(f.w.localStorage.getItem('frame.dock.editor')).mode,'right');
  await click('.unifiedEditorPanel [data-panel-dock="floating"]');assert(f.el('canvas_action').closest('.canvasFloatingEditor'));await click('[data-floating-close]');assert.equal(d.querySelector('[data-dock-arrow="right"]').getAttribute('aria-expanded'),'false');
  await click('[data-overview-select="h:'+s.id+':'+s.shots[0].id+'"]');assert.equal(d.querySelector('.canvasFloatingEditor').hidden,false);
  d.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowRight',ctrlKey:true,bubbles:true,cancelable:true}));await pause();await pause();assert.match(d.querySelector('[data-floating-count]').textContent,/^2/);
  assert.equal(f.errors.length,0);console.log('PASS: floating drag, pager, failed-save navigation/close protection, duration, explicit next-shot alignment, camera chips, shared docking and mode memory');
 }finally{f.dom.window.close()}
}
async function planningRepairChecks(){
 const input=copy(sample);input.segments[0].shots=[];
 const f=await fixture(input,'professional'),settle=async()=>{for(let i=0;i<4;i++)await pause()},click=async selector=>{const el=f.w.document.querySelector(selector);assert(el,selector);el.click();await settle()};
 try{
  await f.w.openFrameOverview();await settle();const d=f.el('overviewDialog'),sid=input.segments[0].id;
  await click('[data-overview-select="s:'+sid+'"]');await click(d.dataset.layoutMode==='cards'?'[data-card-add-shot="'+sid+'"]':'[data-inline-shot="'+sid+'"]');assert.equal(f.project.segments[0].shots.length,1);assert.equal(f.project.segments[0].shots[0].start,0);assert.equal(f.project.segments[0].shots[0].end,3);
  const first=f.project.segments[0].shots[0].id;await click('[data-canvas-action="insert-shot-before"]');assert.match(f.el('modalTitle').textContent,/时间安排/);f.el('modalActions').children[1].click();await settle();assert.equal(f.project.segments[0].duration,18);assert.equal(f.project.segments[0].shots[1].id,first);assert.equal(f.project.segments[0].shots[1].start,3);
  await click('[data-canvas-action="insert-shot-after"]');f.el('modalActions').lastElementChild.click();await settle();assert.equal(f.project.segments[0].shots.length,3);assert.equal(f.project.segments[0].shots[0].end,6);assert.equal(f.project.segments[0].shots.at(-1).end,18);
  const before=copy(f.project.segments[0]);await click('[data-canvas-action="insert-shot-after"]');f.el('modalActions').firstElementChild.click();await settle();assert.deepEqual(f.project.segments[0].shots,before.shots);
  await click('[data-card-mode]');assert(d.querySelector('[data-card-add-shot]'));await click('[data-overview-select="s:'+sid+'"]');await click(d.dataset.layoutMode==='cards'?'[data-card-add-shot="'+sid+'"]':'[data-inline-shot="'+sid+'"]');f.el('modalActions').lastElementChild.click();await settle();assert.equal(f.project.segments[0].shots.length,4);
  await f.w.openStoryPlanner();await settle();assert(f.el('wholeContinuity'));assert(f.el('wholeGuide'));const asset=f.el('modalBody').querySelector('[data-whole-asset]');assert(asset);asset.checked=false;f.el('wholeStory').value='有素材的故事';f.el('wholeGuide').checked=true;f.el('modalActions').lastElementChild.click();await settle();const req=f.calls.findLast(c=>c.route==='story-plan').body;assert.equal(req.guideFromPrev,true);assert.equal(req.continuity,true);assert(!req.assetIds.includes(asset.dataset.wholeAsset));assert(Object.values(req.assetRoles).every(v=>v==='general'));
  const h3='detailed_description:\n[Shot 1] [0.00s–3.00s]\n动作\n<Subject 1> (S1) says, <d>[Mandarin] 你好</d>\nSpatial end: 门口\n\noverall_soundscape:\n风声\nnon_diegetic_music:\n无';const parsed=f.w.parseText(f.w.storedCompiledPrompt(h3),3);assert.equal(parsed.length,1);assert.match(parsed[0].dialogue,/你好/);assert.equal(parsed[0].endState,'门口');assert(!parsed[0].action.includes('says'));
  assert.equal(f.errors.length,0);console.log('PASS: free/cards shared Add Shot, empty timeline, explicit extend/rebalance/cancel, insert order and ID preservation; planning controls/selected assets payload; H3 dialogue parsing');
 }finally{f.w.close()}
}
async function nameOnlyMentionChecks(){
 const input=copy(sample);input.assets[0].name='主角海报';input.assets[0].description='不应在候选列表和悬停提示显示的长篇说明'.repeat(200);
 const f=await fixture(input,'professional');try{
  await f.w.openFrameOverview();await pause();await f.w.openStoryPlanner();await pause();const text=f.el('wholeStory');text.value='@';text.setSelectionRange(1,1);text.dispatchEvent(new f.w.Event('input',{bubbles:true}));await pause();
  const list=f.el('assetMentions');assert(!list.hidden);assert(list.textContent.includes('主角海报'));assert(!list.textContent.includes('不应在候选列表'));assert(list.querySelector('small'));assert(list.querySelector('img'));const button=list.querySelector('[data-mention="0"]');assert(button.textContent.includes('素材 1 · 主角海报'));button.dispatchEvent(new f.w.MouseEvent('pointerover',{bubbles:true}));const rich=f.w.document.querySelector('.mentionPreviewCard');assert(!rich.hidden);assert(rich.querySelector('img'));assert(rich.textContent.includes('不应在候选列表')); button.dispatchEvent(new f.w.MouseEvent('mousedown',{bubbles:true,cancelable:true}));await pause();assert.match(text.value,/@Picture 1/);
  const token=text._mentionMirror.querySelector('[data-ref-number]');assert(token);assert.equal(token.dataset.refName,'@主角海报');assert.equal(token.dataset.refNumber,'1');assert.equal(token.getAttribute('aria-label'),'@主角海报');token.dispatchEvent(new f.w.MouseEvent('pointerover',{bubbles:true}));const tooltip=f.w.document.querySelector('.mentionPreviewCard');assert(tooltip.textContent.includes('主角海报'));assert(tooltip.querySelector('img'));assert(tooltip.textContent.includes('不应在候选列表'));assert.match(text.value,/@Picture 1/);
  const html=f.w.highlightMentions('@Picture 99','workspace');assert.match(html,/素材缺失/);assert.match(html,/data-ref-number="99"/);
  f.w.assetByNumber(1).name='新名称';text._mentionUpdate();assert.equal(text._mentionMirror.querySelector('[data-ref-number]').dataset.refName,'@新名称');assert.match(text.value,/@Picture 1/);assert.equal(f.project.assets[0].description,input.assets[0].description);
  assert.equal(f.errors.length,0);console.log('PASS: illustrated mention candidates, rich hover preview and accessible chips; canonical IDs, long descriptions, rename and missing-reference safety preserved');
 }finally{f.w.close()}
}
async function interactionUpgradeChecks(){
 const input=copy(sample);input.overviewLayout={canvas37:{mode:'free'}};const f=await fixture(input,'professional'),settle=async()=>{for(let i=0;i<5;i++)await pause()},click=async selector=>{const el=f.w.document.querySelector(selector);assert(el,selector);el.click();await settle()};let copied='';Object.defineProperty(f.w.navigator,'clipboard',{value:{writeText:async text=>{copied=text}},configurable:true});
 try{
  await f.w.openFrameOverview();await settle();const d=f.el('overviewDialog'),s=input.segments[0],drawer=()=>d.querySelector('.nodeInspectorDrawer');assert(!d.querySelector('.canvasHeadActions [data-canvas-action="add-segment"],.canvasHeadActions [data-canvas-action="add-shot"]'));assert(d.querySelector('.canvasInlineCreate[data-canvas-action="add-segment"]'));
  const node=d.querySelector('[data-overview-select="h:'+s.id+':'+s.shots[0].id+'"]'),height=node.style.height;await click('[data-overview-select="h:'+s.id+':'+s.shots[0].id+'"]');assert(!drawer().hidden);assert(drawer().textContent.includes(s.shots[0].action));assert.equal(node.style.height,height);await click('[data-node-drawer-copy]');assert(copied.includes(s.shots[0].action));assert(drawer().querySelectorAll('figure').length>0);
  const map=d.querySelector('.overviewMap');map.setPointerCapture=()=>{};node.dispatchEvent(new f.w.MouseEvent('pointerdown',{bubbles:true,button:0,clientX:100,clientY:100}));await settle();map.dispatchEvent(new f.w.MouseEvent('pointerup',{bubbles:true,button:0,clientX:100,clientY:100}));await settle();map.click();await settle();assert(!drawer().hidden,'Pointer-captured node clicks retain drawer');map.dispatchEvent(new f.w.MouseEvent('pointerdown',{bubbles:true,button:0,clientX:900,clientY:600}));await settle();map.dispatchEvent(new f.w.MouseEvent('pointerup',{bubbles:true,button:0,clientX:900,clientY:600}));await settle();await click('.overviewMap');assert(drawer().hidden);
  await click('[data-overview-select="p:'+s.id+'"]');assert(drawer().querySelector('pre').textContent.includes('summary:'));await click('[data-node-drawer-copy]');assert(copied.includes('summary:'));
  await click('[data-overview-select="a:'+input.assets[0].id+'"]');assert(drawer().querySelector('.nodeDrawerHero'));assert(drawer().textContent.includes('关联片段'));const media=copy(f.project.media),count=f.project.assets.length;d.querySelector('.overviewMap').focus();d.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'d',ctrlKey:true,bubbles:true,cancelable:true}));await settle();assert.equal(f.project.assets.length,count+1);assert(f.project.assets.at(-1).name.endsWith('(副本)'));assert.deepEqual(f.project.media,media);
  await click('[data-card-mode]');await click('[data-overview-select="h:'+s.id+':'+s.shots[0].id+'"]');assert.equal(drawer().dataset.kind,'shot');d.querySelector('.overviewMap').focus();d.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();assert(drawer().hidden);
  await f.w.openWritingRules();await settle();assert(f.el('writingRuleList').classList.contains('writingRuleGrid'));assert(!f.el('writingRuleList').querySelector('details,pre'));const checkbox=f.el('writingRuleList').querySelector('input');checkbox.checked=true;checkbox.dispatchEvent(new f.w.Event('change',{bubbles:true}));await click('[data-rule-filter="script"]');assert(f.el('writingRuleList').firstElementChild.hidden);await click('[data-rule-filter="all"]');assert(checkbox.checked);await click('[data-rule-view]');assert(!f.w.document.querySelector('.writingRulesDrawer').hidden);assert(f.w.document.querySelector('[data-rule-markdown]').textContent.includes('保持因果'));assert(!f.w.frameRulesMarkdown('<img src=x onerror=alert(1)>').includes('<img'));f.el('closeModal').click();await settle();
  f.tasks=[{id:'time-test',type:'agent',projectId:input.projectId,status:'done',scopeKey:JSON.stringify({kind:'project'}),request:'昨天的问题',userTimestamp:Date.parse('2026-10-18T15:59:00Z'),replyTimestamp:Date.parse('2026-10-18T16:01:00Z'),result:{reply:'跨天回复',target:{kind:'project'},changes:[]}}];await click('.frameAgentProject [data-agent-fold]');await settle();await click('.frameAgentProject [data-agent-fold]');await settle();const history=d.querySelector('.frameAgentProject [data-agent-history]');assert.equal(history.querySelectorAll('.frameAgentDateDivider').length,2);assert(history.textContent.includes('10-18 23:59'));assert(history.textContent.includes('2026-10-19 00:01:00'));assert(history.querySelector('time[datetime]'));
  assert.equal(f.errors.length,0);console.log('PASS: local creation without header buttons, drawers/copy/blank/Escape in both layouts, real duplicate IDs/media preservation, filtered rules grid and safe Markdown drawer, Malaysia timestamps/day separators');
 }finally{f.w.close()}
}
async function inlineEditingChecks(){
 const f=await fixture(copy(sample),'professional'),settle=async()=>{for(let i=0;i<6;i++)await pause()},click=async selector=>{const el=f.w.document.querySelector(selector);assert(el,selector);el.click();await settle()};
 try{
  await f.w.openFrameOverview();await settle();const d=f.el('overviewDialog'),sid=sample.segments[0].id,hid=sample.segments[0].shots[0].id;
  await click('[data-overview-select="h:'+sid+':'+hid+'"]');const node=d.querySelector('.overviewNode.shot'),drawer=d.querySelector('.nodeInspectorDrawer');let zoomCalls=0;d.querySelector('.overviewMap').addEventListener('wheel',()=>zoomCalls++);drawer.dispatchEvent(new f.w.WheelEvent('wheel',{bubbles:true,deltaY:100,cancelable:true}));assert.equal(zoomCalls,0);
  await click('[data-node-edit="action"]');let area=drawer.querySelector('textarea');assert(area);area.value='就地修改动作 @Picture 1';area.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await settle();assert.equal(f.project.segments[0].shots[0].action,'就地修改动作 @Picture 1');assert(f.calls.some(c=>c.route==='rebuild'));
  await click('[data-node-edit="dialogue"]');area=drawer.querySelector('textarea');area.value='失败时保留对白';f.failRebuild=true;area.dispatchEvent(new f.w.FocusEvent('blur'));await settle();assert(drawer.querySelector('textarea'));assert.match(drawer.textContent,/保存失败/);assert.notEqual(f.project.segments[0].shots[0].dialogue,'失败时保留对白');f.failRebuild=false;area.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await settle();assert.equal(f.project.segments[0].shots[0].dialogue,'失败时保留对白');
  await click('[data-card-mode]');await click('[data-overview-select="h:'+sid+':'+hid+'"]');await click('[data-node-edit="startState"]');area=drawer.querySelector('textarea');area.value='不应保存';area.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();assert.notEqual(f.project.segments[0].shots[0].startState,'不应保存');
  await f.w.openWritingRules();await settle();let checkbox=f.el('writingRuleList').querySelector('input');checkbox.checked=true;await click('[data-rule-edit="fight"]');assert.equal(f.el('ruleText').value,'保持因果');assert.equal(f.el('saveWritingRule').textContent,'保存修改');assert(!f.el('cancelWritingRule').hidden);f.el('ruleName').value='动作自定义副本';f.el('ruleText').value='修改后的完整规则';await click('#saveWritingRule');assert.equal(f.el('writingRuleList').querySelectorAll('article').length,2);assert(!f.el('writingRuleList').querySelector('[data-rule-select="fight"]').checked);const own=f.el('writingRuleList').querySelector('[data-rule-select^="custom-"]');assert(own.checked);await click('[data-rule-edit="'+own.dataset.ruleSelect+'"]');assert.equal(f.el('ruleText').value,'修改后的完整规则');f.el('ruleText').value='更新同一副本';await click('#saveWritingRule');assert.equal(f.el('writingRuleList').querySelectorAll('article').length,2);await click('[data-rule-edit="fight"]');await click('#cancelWritingRule');assert(!f.el('ruleEditor').open);f.el('closeModal').click();
  await f.w.openStoryPlanner();await settle();const text=f.el('wholeStory');f.w.assetByNumber(1).name='马来男客人完整很长名称';text.value='@Picture 1 后文';text.dispatchEvent(new f.w.Event('input',{bubbles:true}));const mirror=text._mentionMirror,token=mirror.querySelector('[data-ref-token]');assert.equal(token.querySelector('.mentionName').textContent,'@马来男客人完整很长名称');assert.equal(f.w.mentionPlainText(mirror),text.value);token.dispatchEvent(new f.w.MouseEvent('pointerover',{bubbles:true}));assert(!f.w.document.querySelector('.mentionPreviewCard').hidden);assert(f.w.document.querySelector('.mentionPreviewCard img'));
  mirror.focus();f.w.placeMentionCaret(mirror,text.value.length);assert.deepEqual(Array.from(f.w.mentionEditorOffsets(mirror)),[text.value.length,text.value.length]);mirror.firstElementChild.append(f.w.document.createTextNode('编辑'));mirror.dispatchEvent(new f.w.Event('input',{bubbles:true}));assert.equal(text.value,'@Picture 1 后文编辑');assert.equal(f.w.mentionPlainText(mirror),text.value);assert(!text.value.includes('马来男'));
  assert.equal(f.errors.length,0);console.log('PASS: drawer wheel isolation, inline rebuild/persistence/retry/cancel in both layouts; builtin copy and custom update/cancel; full name editable tokens retain canonical offsets and rich preview');
 }finally{f.w.close()}
}
async function canvasOnlyStartupChecks(){
 const f=await fixture(),wait=async()=>{for(let i=0;i<5;i++)await pause()};try{
  assert.equal(f.w.document.body.dataset.startupView,'home');assert.equal(f.w.document.querySelector('#workspace'),null);assert.equal(f.el('board').isConnected,false);assert.equal(f.el('startupResume').hidden,true);assert(!f.calls.some(c=>['models','test','plan-shots','analyze-assets'].includes(c.route)));
  f.el('startExample').click();await wait();const d=f.el('overviewDialog');assert(d.open);assert(d.querySelector('.overviewNode.shot'));assert(!d.querySelector('[data-overview-close]'));assert(d.querySelector('[data-open-reverse]'));assert.equal(f.el('board').children.length,0);assert.equal(f.el('assets').children.length,0);assert(!f.w.document.querySelector('#editForm'));
  d.querySelector('[data-canvas-home]').click();await wait();d.dispatchEvent(new f.w.Event('close'));await wait();assert.equal(d.querySelector('.overviewNode'),null);assert.equal(f.w.document.body.dataset.startupView,'home');f.el('startCreate').click();await wait();f.el('startupProjectName').value='画布唯一入口';f.el('modalActions').lastElementChild.click();await wait();assert(d.open);assert.equal(f.project.title,'画布唯一入口');assert.equal(f.w.document.querySelectorAll('#board [data-shot]').length,0);assert.equal(f.errors.length,0);console.log('PASS: canvas-only home/example/create, no mounted legacy page or legacy renders, local tools and disposal on exit');
 }finally{f.w.close()}
}
if(require.main===module)run().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});module.exports={fixture,sample,pause};
