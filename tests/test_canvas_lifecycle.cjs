const assert=require('node:assert/strict');
const {fixture,sample,pause}=require('./test_startup_ui.cjs');
(async()=>{const f=await fixture(sample);const w=f.w;try{
 for(let i=0;i<4;i++){
  await w.openFrameOverview();await pause();await pause();const d=f.el('overviewDialog');
  assert.equal(d.querySelectorAll('.canvasSpotlight').length,1);assert.equal(w.frameTaskFeed.subscriberCount,1);
  d.querySelector('[data-inspector-tab="settings"]').click();await pause();
  for(const key of ['nodeGlow','spotlightGrid','junctionPads','glassPanels','reduceMotion']){
   const box=d.querySelector('[data-appearance-check="'+key+'"]');assert(box,key);box.checked=i%2===0;box.dispatchEvent(new w.Event('change',{bubbles:true}));
  }
  await w.flush();assert.equal(f.project.overviewLayout.canvas37.appearance.reduceMotion,i%2===0);
  w.render();assert.equal(f.el('assets').childElementCount,0);assert.equal(f.el('board').childElementCount,0);
  await w.openReversePanel();assert(f.el('reversePanel').isConnected);assert.notEqual(w.getComputedStyle(f.el('reversePanel')).display,'none');w.modal('replacement','<p>replacement</p>');assert(!f.el('reversePanel').isConnected);w.close();
  d.close();d.dispatchEvent(new w.Event('close'));await pause();await pause();
  assert.equal(w.frameTaskFeed.subscriberCount,0);assert.equal(d.querySelectorAll('.overviewNode,.canvasSpotlight,.canvasDynamicBackground').length,0);assert.equal(w.document.querySelectorAll('#workspace,#editForm').length,0);
 }
 assert.equal(f.errors.length,0);console.log('PASS: four open/close cycles, single task subscriber, no hidden board rendering, visual flag persistence, lazy reverse mount/replacement cleanup, disposed graph/canvases');
}finally{w.close()}})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
