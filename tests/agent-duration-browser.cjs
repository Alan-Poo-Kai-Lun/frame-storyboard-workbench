const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const output=process.env.FRAME_QA_OUTPUT,checks=[],browser=await chromium.launch({channel:process.env.FRAME_BROWSER==='chromium'?undefined:'msedge',headless:true,args:['--disk-cache-dir='+path.join(path.dirname(output),'browser-cache')]});try{
 const p=await browser.newPage({viewport:{width:1600,height:1100}});p.setDefaultTimeout(15000);await p.goto(process.env.FRAME_QA_URL);await p.waitForFunction(()=>typeof ready!=='undefined'&&ready);await p.evaluate(()=>createStartupProject(true));await p.waitForFunction(()=>frameCardFlow.app?.getState()?.instance);
 await p.evaluate(endpoint=>api('settings-patch',{ai:{provider:'openai',endpoint,model:'qa-local-mock',agentModel:'qa-local-mock',agentMaxCalls:2,autoUnload:false}}),process.env.FRAME_QA_MODEL_URL);
 const before=await p.evaluate(()=>structuredClone(P.segments)),sid=before[0].id;
 const row=await p.evaluate(sid=>api('agent-send',{projectId:P.projectId,target:{kind:'segment',segmentId:sid},message:'按当前片段完整时长规划镜头，先预览',preserveDialogue:false}),sid);
 let task;for(let i=0;i<150;i++){task=await p.evaluate(id=>api('tasks').then(doc=>doc.tasks.find(r=>r.id===id)),row.id).catch(()=>null);if(task?.status==='done'||task?.status==='error')break;await p.waitForTimeout(100)}
 // Task detail endpoint is task-detail in some builds; plan-record is the durable capability.
 let record;for(let i=0;i<100;i++){record=await p.evaluate(id=>api('plan-record',{action:'get',projectId:P.projectId,id}),row.id).catch(()=>null);if(record?.plan?.segments?.length)break;await p.waitForTimeout(100)}
 assert(record?.plan,JSON.stringify(task));assert.equal(record.plan.duration,before[0].duration);assert.equal(record.plan.segments[0].shots.at(-1).end,before[0].duration);assert.equal(record.plan.applyTarget.segmentId,sid);checks.push('Streamed segment Agent returns the locked complete duration');
 await p.evaluate(id=>framePlanPreview(id),row.id);await p.getByText('当前片段分镜方案预览 · 只更新当前片段',{exact:true}).waitFor();assert.deepEqual(await p.evaluate(()=>P.segments),before);checks.push('Scoped preview leaves canvas unchanged');
 await p.getByRole('button',{name:'确认仅应用到当前片段',exact:true}).click();await p.waitForFunction(sid=>P.segments.find(s=>s.id===sid).title==='方案 1',sid);
 const after=await p.evaluate(()=>P.segments);assert.equal(after.length,before.length);assert.deepEqual(after.slice(1),before.slice(1));assert.equal(after[0].shots.at(-1).end,before[0].duration);checks.push('Preview applies only current segment to canvas without changing others');
 fs.writeFileSync(output,JSON.stringify({ok:true,checks,ai:'local HTTP SSE mock only'},null,2));console.log('PASS',checks.join('; '));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});

