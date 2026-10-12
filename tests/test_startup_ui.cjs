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
 const calls=[],errors=[];w.addEventListener('error',e=>errors.push(e.error));w.structuredClone=copy;
 Object.defineProperty(w.crypto,'randomUUID',{value:require('node:crypto').randomUUID});
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.show=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.fetch=async(url,options={})=>{
  const route=String(url).split('?')[0].replace('/api/','');let data;
  const body=options.body?JSON.parse(options.body):null;calls.push({route,body});
  if(route==='bootstrap')data={token:'test-token'};
  else if(route==='project'){if(broken)throw Error('test startup error');if(body)project=copy(body);data=project;}
  else if(route==='settings')data=config;
  else if(route==='settings-patch'){for(const[k,v]of Object.entries(body))config[k]={...config[k],...v};data={ok:true};}
  else if(route==='tasks')data={tasks:[],paused:false};
  else if(route==='asset-analysis-status')data={assets:[]};
  else if(route==='reverse-templates')data={};
  else if(route==='new-project'){project=body.example?copy(sample):{version:1,projectId:'new-project',title:body.title||'新导演项目',script:'',aspect:'16:9',fps:24,segments:[{id:'s1',title:'片段 01',duration:15,shots:[],refs:[]}],assets:[],media:{},originalZip:''};data=project;}
  else if(route==='import-project'){project=copy(body.project);data=project;}
  else if(route==='rebuild')data={prompt:'summary:\n测试\ntimeline:\n'};
  else if(route==='plan-shots')data={id:'task1'};
  else if(route==='analyze-assets')data={id:'asset-task1'};
  else throw Error('Unexpected request '+route);
  return {ok:true,json:async()=>copy(data)};
 };
 for(const match of html.matchAll(/<script src="([^"?]+)/g))require('node:vm').runInContext(fs.readFileSync(path.join(root,'web',match[1]),'utf8'),dom.getInternalVMContext(),{filename:match[1]});
 await pause();
 return {dom,w,calls,errors,get project(){return project},get config(){return config},el:id=>w.document.getElementById(id)};
}
async function run(){
 let f=await fixture();
 try{
  assert.equal(f.w.document.body.dataset.startupView,'home');assert.equal(f.w.document.body.dataset.workbenchMode,'simple');
  assert.equal(f.w.getComputedStyle(f.el('workspace')).display,'none');assert.equal(f.el('startupResume').hidden,true);assert.equal(f.el('startupLoadStatus').textContent,'');
  assert(!f.calls.some(c=>['models','test','plan-shots','analyze-assets'].includes(c.route)),'Opening home must not contact models');
  f.el('startExample').click();await pause();
  assert.equal(f.project.assets.length,3);assert.equal(f.w.document.body.dataset.startupView,'workspace');assert.equal(f.w.document.body.dataset.startupStage,'shots');
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
}
run().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
