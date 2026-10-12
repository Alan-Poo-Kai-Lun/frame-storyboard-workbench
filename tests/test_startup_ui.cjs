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
 let failRebuild=false;const projectSnapshots=new Map();if(project)projectSnapshots.set(project.projectId,copy(project));
 const calls=[],errors=[];w.addEventListener('error',e=>errors.push(e.error));w.structuredClone=copy;
 Object.defineProperty(w.crypto,'randomUUID',{value:require('node:crypto').randomUUID});
 Object.defineProperties(w.HTMLElement.prototype,{offsetWidth:{get(){if(this.classList.contains('overviewNode')){w._nodeMeasures=(w._nodeMeasures||0)+1;return 230}return 1000}},offsetHeight:{get(){if(this.classList.contains('overviewNode')){w._nodeMeasures=(w._nodeMeasures||0)+1;return 100}return 700}},clientWidth:{get(){return 1000}},clientHeight:{get(){return 700}}});
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
  else if(route==='settings')data=config;
  else if(route==='settings-patch'){for(const[k,v]of Object.entries(body))config[k]={...config[k],...v};data={ok:true};}
  else if(route==='check-updates')data={current:'v3.9-beta.1',latest:'v3.9-beta.2',available:true,message:'发现新版本',releaseUrl:'https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/releases/tag/v3.9-beta.2',notes:'更新说明',assets:[{name:'FRAME-Workbench-Windows-x64-v3.9-beta.2.exe',url:'https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/releases/download/v3.9-beta.2/FRAME-Workbench-Windows-x64-v3.9-beta.2.exe'}]};
  else if(route==='tasks')data={tasks:[],paused:false};
  else if(route==='asset-analysis-status')data={assets:[]};
  else if(route==='visual-library-storage')data={used:0,limit:500*1048576};
  else if(route==='visual-pack-preview')data={token:'test-preview',revision:'test-revision',count:1,conflicts:1,bytes:100,entries:[{title:'人物参考',category:'size',media:true,conflict:true}]};
  else if(route==='visual-pack-cancel')data={ok:true};
  else if(route==='visual-pack-apply')data={rows:[],imported:1,skipped:0};
  else if(route==='visual-references')data=[];
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
 return {dom,w,calls,errors,set failRebuild(v){failRebuild=v},get project(){return project},get config(){return config},el:id=>w.document.getElementById(id)};
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
  await click('[data-overview-close]');assert.equal(f.el('overviewDialog').open,false);f.el('projectOverview').click();await pause();await pause();assert(f.el('assetMentions'));assert(f.el('canvas_story'));
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
  await key('a',{ctrlKey:true});await key('Delete');f.el('modalActions').lastElementChild.click();await pause();await pause();await f.w.flush();assert.equal(f.project.segments.length,0,'Deleting all segments leaves a usable project');assert.equal(f.project.assets.length,sample.assets.length);assert(f.el('canvas_title'),'Project remains editable');await key('z',{ctrlKey:true});await f.w.flush();assert.equal(f.project.segments.length,2,'Undo restores all segments');
  assert.equal(f.errors.length,0);console.log('PASS: overview default entry, keyboard text safety, multiselect drag, layout undo, box select, pan, menus, batch deletion and restore');
 }finally{f.dom.window.close()}
}
async function optimizationAndLibraryChecks(){
 const f=await fixture(sample,'professional'),sid=sample.segments[0].id,first='h:'+sid+':'+sample.segments[0].shots[0].id;
 const dialog=()=>f.el('overviewDialog'),map=()=>dialog().querySelector('.overviewMap'),node=id=>dialog().querySelector('.overviewNode[data-overview-select="'+id+'"]');
 try{
  f.el('startResume').click();await pause();await pause();const a=node('a:'+sample.assets[0].id),image=a.querySelector('img'),path=dialog().querySelector('.overviewEdges path');
  node(first).click();await pause();await pause();assert.equal(node('a:'+sample.assets[0].id),a);assert.equal(a.querySelector('img'),image);assert.equal(dialog().querySelector('.overviewEdges path'),path,'SVG paths reused across selection');
  const request=f.w.requestAnimationFrame,cancel=f.w.cancelAnimationFrame;let queue=[];f.w.requestAnimationFrame=cb=>{queue.push(cb);return queue.length};f.w.cancelAnimationFrame=()=>{};
  node(first).dispatchEvent(new f.w.MouseEvent('pointerdown',{bubbles:true,button:0,clientX:100,clientY:100}));await pause();const measures=f.w._nodeMeasures;await f.w.flush();const fullSaves=f.calls.filter(c=>c.route==='project'&&c.body).length;
  for(let i=0;i<120;i++)map().dispatchEvent(new f.w.MouseEvent('pointermove',{bubbles:true,clientX:100+i,clientY:100+i}));assert.equal(queue.length,1,'120 pointer events coalesce into one frame');assert.equal(f.w._nodeMeasures,measures);queue.shift()();assert.equal(f.w._nodeMeasures,measures,'Drag uses cached geometry, without per-frame layout reads');map().dispatchEvent(new f.w.MouseEvent('pointerup',{bubbles:true}));await pause();f.w.requestAnimationFrame=request;f.w.cancelAnimationFrame=cancel;await f.w.flush();assert.equal(f.calls.filter(c=>c.route==='project'&&c.body).length,fullSaves,'Layout-only save avoids serializing the full project in the browser');assert(f.calls.some(c=>c.route==='canvas-layout'));
  assert.equal(dialog().querySelector('.overviewEdges path'),path);assert.equal(a.querySelector('img'),image);
  await f.w.openVisualReference('size');await pause();assert(f.el('importReferencePack'));assert(f.el('referenceStorage').textContent.includes('500'));
  f.el('referenceCards').querySelector('[data-reference-edit]').click();await pause();await pause();assert(f.el('customRefFile'));
  const png=new f.w.File([new Uint8Array([137,80,78,71,13,10,26,10,1])],'reference.png',{type:'image/png'});Object.defineProperty(f.el('customRefFile'),'files',{configurable:true,value:[png]});f.el('customRefFile').onchange({target:f.el('customRefFile')});await pause();await pause();assert.match(f.el('customRefStatus').textContent,/已读入/);f.el('modalActions').lastElementChild.click();await pause();await pause();assert(f.calls.some(c=>c.route==='visual-references'&&c.body?.image?.startsWith('data:image/png;base64,')),'Single reference image upload remains functional');
  const pack=new f.w.File(['TEST'],'test.frame-refs.zip',{type:'application/zip'});Object.defineProperty(f.el('referencePackFile'),'files',{configurable:true,value:[pack]});f.el('referencePackFile').onchange({target:f.el('referencePackFile')});await pause();await pause();assert.match(f.el('modalTitle').textContent,/导入视觉参考/);assert.equal(f.el('referencePackMode').value,'keep');f.el('referencePackMode').value='replace';f.el('referencePackMode').onchange();f.el('modalActions').lastElementChild.click();await pause();assert.match(f.el('referencePackError').textContent,/确认替换/);assert(!f.calls.some(c=>c.route==='visual-pack-apply'));f.el('referencePackAck').checked=true;f.el('modalActions').lastElementChild.click();await pause();await pause();assert(f.calls.some(c=>c.route==='visual-pack-apply'&&c.body.mode==='replace'));f.w.close();
  dialog().querySelector('[data-canvas-home]').click();await pause();await pause();assert(f.el('localProjectList').querySelector('[data-local-project]'));
  f.el('startCreate').click();f.el('startupProjectName').value='第二个项目';f.el('modalActions').lastElementChild.click();await pause();await pause();dialog().querySelector('[data-canvas-home]').click();await pause();await pause();assert.equal(f.el('localProjectList').querySelectorAll('[data-local-project]').length,2);f.el('localProjectList').querySelector('[data-local-project="'+sample.projectId+'"]').click();await pause();await pause();assert.equal(f.project.projectId,sample.projectId);assert.equal(dialog().open,true);assert.equal(f.errors.length,0);
  console.log('PASS: frame coalescing, cached geometry, retained media/path nodes, single reference upload, pack conflict confirmation and multiple project entry');
 }finally{f.dom.window.close()}
}
async function run(){
 let f=await fixture();
 try{
  assert.equal(f.w.document.body.dataset.startupView,'home');assert.equal(f.w.document.body.dataset.workbenchMode,'simple');
  assert.equal(f.w.getComputedStyle(f.el('workspace')).display,'none');assert.equal(f.el('startupResume').hidden,true);assert.equal(f.el('startupLoadStatus').textContent,'');
  assert(!f.calls.some(c=>['check-updates','models','test','plan-shots','analyze-assets'].includes(c.route)),'Opening home must not contact models');
  f.el('checkUpdates').click();await pause();assert.match(f.el('modalTitle').textContent,/新版本/);assert.match(f.el('modalBody').textContent,/Windows EXE/);f.w.close();
  f.el('startExample').click();await pause();
  assert.equal(f.project.assets.length,3);assert.equal(f.w.document.body.dataset.startupView,'workspace');assert.equal(f.w.document.body.dataset.startupStage,'shots');
  assert.equal(f.el('overviewDialog').open,true,'Example enters editable overview');
  assert.equal(f.el('board').querySelectorAll('[data-shot]').length,3);assert.equal(f.w.getComputedStyle(f.el('startupHome')).display,'none');assert.equal(f.w.getComputedStyle(f.el('startupStoryBlock')).display,'none');
  const before=JSON.stringify(f.project.segments);
  f.el('workspaceMode').click();await pause();assert.notEqual(f.w.getComputedStyle(f.el('startupStoryBlock')).display,'none');assert.equal(f.config.ui.workbenchMode,'professional');assert.equal(f.w.document.body.dataset.workbenchMode,'professional');
  f.el('workspaceMode').click();await pause();assert.equal(JSON.stringify(f.project.segments),before,'Mode changes must not rewrite shots');
  f.el('aiSplit').click();await pause();assert.match(f.el('modalTitle').textContent,/AI 连接/);assert(!f.calls.some(c=>c.route==='plan-shots'));
  f.el('modalActions').lastElementChild.click();await pause();assert.equal(f.el('aiProvider').value,'ollama');assert.equal(f.el('aiVisionModel').closest('details').open,false);
  f.el('aiModel').value='my-model';f.el('modalActions').lastElementChild.click();await pause();assert(f.calls.some(c=>c.route==='plan-shots'),'Save and continue resumes requested action');
  f.el('homeEntry').click();f.el('startCreate').click();f.el('startupProjectName').value='新故事';f.el('modalActions').lastElementChild.click();await pause();
  assert.equal(f.project.title,'新故事');assert.equal(f.w.document.body.dataset.startupStage,'story');assert.equal(f.el('startupStoryBlock').parentElement.id,'startupStoryMount');assert.notEqual(f.w.getComputedStyle(f.el('startupStoryBlock')).display,'none');
  f.el('startupNextStep').click();assert.equal(f.w.document.body.dataset.startupStage,'story','Blank story stays at first step');
  f.el('script').value='一个人走进房间。';f.el('script').dispatchEvent(new f.w.Event('input'));f.el('startupNextStep').click();assert.equal(f.w.document.body.dataset.startupStage,'assets');assert.equal(f.el('startupAssetsBlock').parentElement.id,'startupAssetsMount');
  f.el('startupNextStep').click();assert.equal(f.w.document.body.dataset.startupStage,'shots');f.el('addShot').click();await pause();await f.w.flush();assert.equal(f.project.segments[0].shots.length,1);
  f.el('export').click();assert.match(f.el('modalTitle').textContent,/保存项目/);assert.match(f.el('modalBody').textContent,/AI 搅拌手/);
  Object.defineProperty(f.el('packFile'),'files',{configurable:true,value:[{name:'saved.frame.json',text:async()=>JSON.stringify({format:'frame-project',version:1,project:sample})}]});await f.el('packFile').onchange();await pause();assert.equal(f.project.title,sample.title);assert(f.calls.some(c=>c.route==='import-project'));
  assert.equal(f.errors.length,0);console.log('PASS: home, manual steps, example, mode preservation, AI deferred setup/resume, H3 handoff');
 }finally{f.dom.window.close()}
 f=await fixture(sample,'professional');
 try{assert.equal(f.w.document.body.dataset.startupView,'home');assert.equal(f.el('startupResume').hidden,false);f.el('startResume').click();assert.equal(f.w.document.body.dataset.workbenchMode,'professional');assert.equal(f.project.projectId,sample.projectId);assert(!f.calls.some(c=>c.route==='new-project'));assert.equal(f.errors.length,0);console.log('PASS: existing project and persisted professional preference');}finally{f.dom.window.close()}
 f=await fixture(null,'simple',true);
 try{assert.match(f.el('startupLoadStatus').textContent,/读取失败/);assert.equal(f.el('startExample').disabled,true);console.log('PASS: failed startup exposes error and disables creation');}finally{f.dom.window.close()}
 await overviewChecks();
 await canvasInteractionChecks();
 await optimizationAndLibraryChecks();
}
run().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
