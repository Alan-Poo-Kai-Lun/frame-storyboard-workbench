const assert=require('node:assert/strict');
module.exports=async p=>{
 await p.evaluate(()=>frameCardFlow.app.getState().instance.setViewport({x:10000,y:10000,zoom:1}));await p.waitForTimeout(100);
 const pane=await p.locator('.react-flow__pane').boundingBox(),bounds=await p.locator('.rfa-content').boundingBox();await p.mouse.click(pane.x+pane.width-190,pane.y+pane.height-12,{button:'right'});await p.locator('.flow-quick-menu').waitFor();assert.equal(await p.locator('.flow-quick-menu > button').count(),3);
 await p.getByRole('menuitem',{name:'更多编辑',exact:true}).hover();assert.equal(await p.getByRole('menuitem',{name:'反推提示词',exact:true}).count(),0);
 const row=p.getByRole('menuitem',{name:'素材与管理',exact:true});await row.focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(100);const sub=await p.locator('.flow-quick-submenu').boundingBox();assert(sub.x>=bounds.x&&sub.y>=bounds.y&&sub.x+sub.width<=bounds.x+bounds.width&&sub.y+sub.height<=bounds.y+bounds.height,JSON.stringify({sub,bounds}));
 assert.equal(await p.evaluate(()=>document.activeElement.textContent),'确认全部素材');await p.keyboard.press('ArrowLeft');assert(await row.evaluate(el=>el===document.activeElement));await p.keyboard.press('Escape');await p.locator('.flow-quick-menu').waitFor({state:'hidden'});
};
