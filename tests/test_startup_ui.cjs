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
  let failRebuild=false,remoteTasks=[];const projectSnapshots=new Map(),projectTrash=new Map();if(project)projectSnapshots.set(project.projectId,copy(project));
 const calls=[],errors=[];w.addEventListener('error',e=>errors.push(e.error));w.structuredClone=copy;
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
  else if(route==='asset-library')data={revision:'0',categories:['人物'],items:[]};
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
 return {dom,w,calls,errors,set failRebuild(v){failRebuild=v},set tasks(v){remoteTasks=v},get project(){return project},get config(){return config},el:id=>w.document.getElementById(id)};
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
 await click('[data-card-mode]');await click('[data-card-add-shot="'+sample.segments[0].id+'"]');assert.equal(f.project.segments[0].shots.length,sample.segments[0].shots.length+1);assert.equal(f.project.segments[0].shots[0].id,sample.segments[0].shots[0].id);
 await click('.cardNewSegment');assert.equal(f.project.segments.at(-1).shots.length,1);
 await click('[data-creator-library]');assert.match(f.el('modalTitle').textContent,/素材库/);f.el('creatorAdd').click();assert(f.el('creatorTitle'));assert(f.el('creatorNote'));assert(f.el('creatorEditCategory'));assert(f.el('creatorFile'));f.w.close();
 assert.equal(f.errors.length,0);console.log('PASS: card geometry, asset aliases, mode restoration, full timeline add shot, one-shot segment, layout and asset library forms');
 }finally{f.dom.window.close()}
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
 await click('[data-card-toggle="'+sid+'"]');assert(f.w.document.querySelector('[data-overview-select="p:'+sid+'"]'));await click('[data-cards-collapse]');assert.equal(f.w.document.querySelectorAll('.overviewNode').length,source.segments.length+1);await click('[data-cards-expand]');assert(f.w.document.querySelectorAll('.overviewNode').length>source.segments.length+1);
 // Language changes never render again, replace input values, change option values or save project content.
 await click('[data-overview-select="s:'+sid+'"]');const story=f.el('canvas_story');story.focus();story.value='故事、素材、提示词保持中文';story.setSelectionRange(3,5);story.dispatchEvent(new f.w.Event('input',{bubbles:true}));const projectBefore=JSON.stringify(live()),saves=f.calls.filter(c=>c.route==='project'&&c.body).length;
 const languageControl=f.w.document.querySelector('.canvasQuickNav [data-ui-language]');languageControl.value='en';const marker=f.w.document.createElement('span');marker.textContent='任务中心';f.w.document.body.append(marker);await pause();assert.equal(languageControl.value,'en','Background UI refresh must not reset a pending native selection');languageControl.dispatchEvent(new f.w.Event('input',{bubbles:true}));await pause();assert.equal(f.w.document.documentElement.lang,'en');assert.equal(f.w.document.querySelector('[data-canvas-tasks]').textContent.trim(),'Task Center 0');assert.match(f.el('startCreate').textContent,/Create a project/);assert.equal(story.value,'故事、素材、提示词保持中文');assert.equal(story.selectionStart,3);assert.equal(JSON.stringify(live()),projectBefore);assert.equal(f.calls.filter(c=>c.route==='project'&&c.body).length,saves);assert.equal(f.el('canvas_genTask').value,'r2v');assert.equal(f.w.localStorage.getItem('frame-ui-language'),'en');
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
  await click('s:'+sample.segments[0].id);node('s:'+sample.segments[1].id).dispatchEvent(new f.w.MouseEvent('click',{bubbles:true,shiftKey:true}));await pause();await key('Delete');f.el('modalActions').lastElementChild.click();await pause();await pause();await f.w.flush();assert.equal(f.project.segments.length,0,'Deleting all segments leaves a usable project');assert.equal(f.project.assets.length,sample.assets.length);assert(f.el('canvas_title'),'Project remains editable');await key('z',{ctrlKey:true});await f.w.flush();assert.equal(f.project.segments.length,2,'Undo restores all segments');
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
  await f.w.openVisualReference('size');await pause();assert(f.el('importReferencePack'));assert(f.el('referenceStorage').textContent.includes('不设媒体容量上限'));
  f.el('referenceCards').querySelector('[data-reference-edit]').click();await pause();await pause();assert(f.el('customRefFile'));
  const png=new f.w.File([new Uint8Array([137,80,78,71,13,10,26,10,1])],'reference.png',{type:'image/png'});Object.defineProperty(f.el('customRefFile'),'files',{configurable:true,value:[png]});f.el('customRefFile').onchange({target:f.el('customRefFile')});await pause();await pause();assert.match(f.el('customRefStatus').textContent,/已读入/);f.el('modalActions').lastElementChild.click();await pause();await pause();assert(f.calls.some(c=>c.route==='visual-references'&&c.body?.image?.startsWith('data:image/png;base64,')),'Single reference image upload remains functional');
  const pack=new f.w.File(['TEST'],'test.frame-refs.zip',{type:'application/zip'});Object.defineProperty(f.el('referencePackFile'),'files',{configurable:true,value:[pack]});f.el('referencePackFile').onchange({target:f.el('referencePackFile')});await pause();await pause();assert.match(f.el('modalTitle').textContent,/导入视觉参考/);assert.equal(f.el('referencePackMode').value,'keep');f.el('referencePackMode').value='replace';f.el('referencePackMode').onchange();f.el('modalActions').lastElementChild.click();await pause();assert.match(f.el('referencePackError').textContent,/确认替换/);assert(!f.calls.some(c=>c.route==='visual-pack-apply'));f.el('referencePackAck').checked=true;f.el('modalActions').lastElementChild.click();await pause();await pause();assert(f.calls.some(c=>c.route==='visual-pack-apply'&&c.body.mode==='replace'));f.w.close();
  dialog().querySelector('[data-canvas-home]').click();await pause();await pause();assert(f.el('localProjectList').querySelector('[data-local-project]'));
  f.el('startCreate').click();f.el('startupProjectName').value='第二个项目';f.el('modalActions').lastElementChild.click();await pause();await pause();dialog().querySelector('[data-canvas-home]').click();await pause();await pause();assert.equal(f.el('localProjectList').querySelectorAll('[data-local-project]').length,2);f.el('localProjectList').querySelector('[data-local-project="'+sample.projectId+'"]').click();await pause();await pause();assert.equal(f.project.projectId,sample.projectId);assert.equal(dialog().open,true);assert.equal(f.errors.length,0);
  console.log('PASS: frame coalescing, cached geometry, retained media/path nodes, single reference upload, pack conflict confirmation and multiple project entry');
 }finally{f.dom.window.close()}
}
async function appearanceChecks(){
 const f=await fixture(sample,'simple');try{f.el('startResume').click();await pause();const d=f.el('overviewDialog');d.querySelector('[data-canvas-appearance]').click();await pause();const panel=d.querySelector('.canvasSettings');assert.equal(panel.hidden,false);assert.equal(f.el('modal').open,false,'Settings are persistent, not a modal');
 const color=panel.querySelector('[data-appearance-color="highlight"]');color.value='#ff8800';color.dispatchEvent(new f.w.Event('input',{bubbles:true}));const bg=panel.querySelector('[data-appearance-color="background"]');bg.value='#102030';bg.dispatchEvent(new f.w.Event('input',{bubbles:true}));
 const pattern=panel.querySelector('[data-appearance-select="pattern"]');pattern.value='lines';pattern.dispatchEvent(new f.w.Event('change',{bubbles:true}));const grid=panel.querySelector('[data-appearance-number="gridSize"]');grid.value='48';grid.dispatchEvent(new f.w.Event('input',{bubbles:true}));assert.equal(d.style.getPropertyValue('--canvas-glow'),'#ff8800');assert.equal(d.dataset.canvasPattern,'lines');assert.equal(d.style.getPropertyValue('--canvas-grid-size'),'48px');await f.w.flush();assert.equal(f.project.overviewLayout.canvas37.appearance.background,'#102030');d.querySelector('[data-overview-close]').click();await pause();await f.w.openFrameOverview();await pause();assert.equal(d.style.getPropertyValue('--canvas-glow'),'#ff8800');d.querySelector('[data-canvas-appearance]').click();await pause();d.querySelector('[data-reset-appearance]').click();await f.w.flush();assert.deepEqual(f.project.overviewLayout.canvas37.appearance,{});assert.equal(d.dataset.canvasPattern,'dots');assert.equal(f.errors.length,0);console.log('PASS: persistent Inspector settings, ranges, colors, persistence and reset');}finally{f.dom.window.close()}
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
  await click(dialog().querySelector('[data-overview-close]'));await click(f.el('projectOverview'));
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
  dialog.querySelector('[data-canvas-appearance]').click();await pause();
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
  list().querySelector('[data-delete-project]').click();await settle();assert.match(f.el('modalTitle').textContent,/删除本机项目/);f.el('modalActions').firstElementChild.click();await settle();assert.equal(list().querySelectorAll('[data-local-project]').length,1,'Cancelling deletion changes nothing');
  list().querySelector('[data-delete-project]').click();await settle();await confirm();assert.equal(f.project,null);assert.equal(f.w.eval('P'),null);assert.equal(list().querySelectorAll('[data-local-project]').length,0);assert.equal(f.el('clearLocalProjects').disabled,true);
  f.el('localProjectTrash').click();await settle();assert.equal(f.el('modalBody').querySelectorAll('[data-restore-project]').length,1);f.el('modalBody').querySelector('[data-restore-project]').click();await settle();assert.equal(list().querySelectorAll('[data-local-project]').length,1);assert.equal(f.el('modalBody').querySelectorAll('[data-restore-project]').length,0);f.w.close();
  list().querySelector('[data-local-project]').click();await settle();const d=f.el('overviewDialog');assert.equal(d.open,true);const quick=d.querySelector('.overviewHead').firstElementChild;assert(quick.classList.contains('canvasQuickNav'));assert(quick.querySelector('[data-canvas-home]'));assert(quick.querySelector('[data-canvas-tasks]'));assert(!d.querySelector('.canvasMore [data-canvas-tasks]'));
  f.tasks=[{id:'queue-1',type:'planning',status:'waiting',projectId:sample.projectId,segmentId:sample.segments[0].id,title:'排队任务',createdMs:Date.now()}];await f.w.pollTasks();assert.equal(d.querySelector('[data-canvas-task-count]').textContent,'1');quick.querySelector('[data-canvas-tasks]').click();await settle();assert.match(f.el('modalTitle').textContent,/任务中心/);f.w.close();quick.querySelector('[data-canvas-home]').click();await settle();assert.equal(f.w.document.body.dataset.startupView,'home');
  await f.w.createStartupProject(false,'第二个项目');await settle();d.querySelector('[data-canvas-home]').click();await settle();assert.equal(list().querySelectorAll('[data-local-project]').length,2);f.el('clearLocalProjects').click();await settle();assert.match(f.el('modalTitle').textContent,/清空全部/);await confirm();assert.equal(f.project,null);assert.equal(list().querySelectorAll('[data-local-project]').length,0);
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
 await click('project');assert(f.el('canvas_language'));assert(!f.el('canvas_fps'));assert.equal(f.el('canvas_language').closest('details'),null);assert.equal(live().fps,sample.fps);
 const drop=async(target,name,type)=>{const file=new f.w.File([new Uint8Array([137,80,78,71,13,10,26,10,1])],name,{type});const e=new f.w.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:{files:[file],types:['Files']}});Object.defineProperty(e,'clientX',{value:400});Object.defineProperty(e,'clientY',{value:350});target.dispatchEvent(e);for(let i=0;i<5;i++)await pause();await f.w.flush()};
 await click('a:'+sample.assets[0].id);const oldPath=live().assets[0].path;await drop(map,'public.png','image/png');const pub=live().assets.at(-1);assert.equal(pub.scope,'public');assert.equal(live().assets[0].path,oldPath,'Blank drop adds even with existing asset selected');assert(live().overviewLayout.canvas37.positions['a:'+pub.id]);
 await click('s:'+second.id);const shot=d.querySelector('[data-overview-select="h:'+second.id+':'+second.shots[0].id+'"]');const oldFrame=live().segments[1].shots[0].image;await drop(shot,'local.wav','audio/wav');const local=live().assets.at(-1);assert.equal(local.scope,'segment');assert.equal(local.segmentId,second.id);assert.equal(local.mediaType,'audio');assert.equal(live().segments[1].shots[0].image,oldFrame);assert(!f.w.allScopedAssets(live().segments[0]).includes(local));
 const oldLocalPath=local.path,assetNode=d.querySelector('[data-overview-select="a:'+local.id+'"]');await drop(assetNode,'replacement.wav','audio/wav');assert.equal(live().assets.at(-1).id,local.id);assert.notEqual(live().assets.at(-1).path,oldLocalPath);
 await click('a:'+pub.id);d.querySelector('[data-canvas-action="delete-asset"]').click();await pause();assert.match(f.el('modalTitle').textContent,/删除素材/);f.el('modalActions').lastElementChild.click();for(let i=0;i<4;i++)await pause();await f.w.flush();assert(live().assets.find(a=>a.id===pub.id).deleted);assert(live().media[pub.path]);d.querySelector('[data-restore-asset="'+pub.id+'"]').click();for(let i=0;i<4;i++)await pause();assert.equal(live().assets.find(a=>a.id===pub.id).deleted,false);
 d.querySelector('[data-canvas-appearance]').click();await pause();for(const style of ['pcb','orthogonal','straight','curve','hidden']){const select=d.querySelector('[data-appearance-select="lineStyle"]');select.value=style;select.dispatchEvent(new f.w.Event('change',{bubbles:true}));await pause();assert.equal(d.dataset.canvasLineStyle,style)}
 const route=f.w.frameCanvasEdge.path('pcb',0,0,200,100);assert(!route.includes('NaN'));assert.match(route,/L86,0 L100,14/);for(const type of ['chevron2','chevron3','diamond','crosshair','chiseled','pulse'])assert(f.w.frameCanvasEdge.shape(type));assert.equal(f.errors.length,0);console.log('PASS: Inspector tabs, autosave, inline MIXED, visible language, drop routing/replacement, reversible asset deletion and PCB geometry');
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
 await appearanceChecks();
 await canvasWorkflowChecks();
 await multimediaAndGenerationChecks();
 await inspectorWorkflowChecks();
 await uninterruptedTypingChecks();
 await blankPromptPlanningChecks();
 await projectManagementChecks();
 await creativeCanvasChecks();
 await v319Checks();
}
run().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
