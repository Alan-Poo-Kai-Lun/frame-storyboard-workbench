const {chromium:engine}=require('playwright'),path=require('path');
exports.chromium={launch:async options=>{
 const ctx=await engine.launchPersistentContext(path.resolve('../qa-browser-profiles',String(process.pid)),{...options,viewport:{width:1600,height:1000},permissions:['clipboard-read','clipboard-write'],args:['--disk-cache-dir='+path.resolve('../cache/browser')]});
 for(const page of ctx.pages())await page.close();
 const newPage=async options=>{const p=await ctx.newPage();if(options?.viewport)await p.setViewportSize(options.viewport);return p};
 return {newPage,newContext:async options=>({newPage:()=>newPage(options)}),close:()=>ctx.close()};
}};
