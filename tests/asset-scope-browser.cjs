const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const output=process.env.FRAME_QA_OUTPUT,checks=[],browser=await chromium.launch({channel:process.env.FRAME_BROWSER==='chromium'?undefined:'msedge',headless:true,args:['--disk-cache-dir='+path.join(path.dirname(output),'browser-cache')]});try{
const p=await browser.newPage({viewport:{width:1600,height:1100}});p.setDefaultTimeout(15000);await p.goto(process.env.FRAME_QA_URL);await p.waitForFunction(()=>typeof ready!=='undefined'&&ready);await p.evaluate(()=>createStartupProject(true));await p.waitForFunction(()=>frameCardFlow.app?.getState()?.instance);
const ids=await p.evaluate(()=>({asset:P.assets[0].id,segment:P.segments[2].id,number:P.assets[0].pictureNumber,path:P.assets[0].path}));
for(const mode of ['canvas','cards']){
await p.evaluate(mode=>frameCardFlow.app.setMode(mode),mode);await p.evaluate(id=>(P.overviewLayout.canvas37.mode='cards',frameOverviewBridge.select('a:'+id,true)),ids.asset);
await p.locator('#canvas_scope').selectOption(ids.segment);await p.getByRole('button',{name:'立即保存',exact:true}).click();await p.waitForTimeout(1000);
await p.evaluate(()=>frameOverviewBridge.flush());
assert.equal(await p.evaluate(id=>P.assets.find(a=>a.id===id).segmentId,ids.asset),ids.segment);
await p.locator('#canvas_name').fill('Scope QA '+mode);await p.getByRole('button',{name:'立即保存',exact:true}).click();await p.waitForTimeout(700);await p.evaluate(()=>frameOverviewBridge.flush());
assert.equal(await p.evaluate(id=>P.assets.find(a=>a.id===id).name,ids.asset),'Scope QA '+mode);checks.push(mode+': scope move keeps selected inspector editable');
await p.locator('#canvas_scope').selectOption('public');await p.getByRole('button',{name:'立即保存',exact:true}).click();await p.waitForTimeout(700);await p.evaluate(()=>frameOverviewBridge.flush());
assert.equal(await p.evaluate(id=>P.assets.find(a=>a.id===id).scope,ids.asset),'public');
await p.evaluate(()=>frameFlowHost.undo());await p.waitForTimeout(400);assert.equal(await p.evaluate(id=>P.assets.find(a=>a.id===id).segmentId,ids.asset),ids.segment);
await p.evaluate(()=>frameFlowHost.redo());await p.waitForTimeout(400);assert.equal(await p.evaluate(id=>P.assets.find(a=>a.id===id).scope,ids.asset),'public');
const asset=await p.evaluate(id=>P.assets.find(a=>a.id===id),ids.asset);assert.equal(asset.path,ids.path);assert.equal(asset.pictureNumber,ids.number);assert(!asset.deleted);checks.push(mode+': scope undo/redo preserves stable asset ID, number and media');
}
fs.writeFileSync(output,JSON.stringify({ok:true,checks},null,2));console.log('PASS',checks.join('; '));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
