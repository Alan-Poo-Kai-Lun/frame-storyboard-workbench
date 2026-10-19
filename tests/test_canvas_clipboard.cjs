/* Clipboard routing with deterministic browser adapters; OS interoperability is checked separately. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {webcrypto}=require('node:crypto');
let asset={id:'a',pictureNumber:1,name:'照片',path:'image.png',scope:'public',mediaType:'image'},P={projectId:'p',assets:[asset],media:{'image.png':'kept'}};
let pixels='original',writes=[],refreshed=[],saves=0;const toasts=[],window={};
const context={window,Blob,File,crypto:webcrypto,URL:{createObjectURL(){return 'blob:local'},revokeObjectURL(){}},Image:class{constructor(){this.naturalWidth=2;this.naturalHeight=2}set src(v){queueMicrotask(()=>this.onload())}},document:{createElement(){return {getContext(){return {drawImage(){}}},toBlob(fn){fn(new Blob([pixels],{type:'image/png'}))}}}},ClipboardItem:class{constructor(items){this.items=items}},navigator:{clipboard:{async write(items){writes.push(await items[0].items['image/png'])}}},fetch:async()=>({blob:async()=>new Blob([pixels])}),structuredClone,P,newId:()=>String(P.assets.length+1),nextAssetNumber:()=>Math.max(...P.assets.map(a=>a.pictureNumber))+1,assetMediaType:a=>a.mediaType,image:()=> 'data:image/png;base64,eA==',changed(){},flush:async()=>{saves++},toast:t=>toasts.push(t),$:()=>null,setTimeout:fn=>fn(),addAssetFiles:async files=>{const rows=files.map(f=>({id:'imported',name:f.name,path:'new.png',pictureNumber:9,scope:'public'}));P.assets.push(...rows);return rows}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../web/canvas-clipboard.js'),'utf8'),context);
const api=window.createFrameCanvasClipboard({selected:()=>({kind:'asset',item:asset}),save:async()=>true,place(){},refresh:id=>refreshed.push(id)});
(async()=>{
 const copy=await api.duplicate();assert.equal(copy.name,'照片 (副本)');assert.notEqual(copy.id,asset.id);assert.equal(copy.path,asset.path);assert.equal(copy.pictureNumber,2);assert.equal(P.media['image.png'],'kept');
 await api.copyImage();assert.equal(writes.length,1);assert.equal(writes[0].type,'image/png');assert.equal(await writes[0].text(),'original');
 const count=P.assets.length;await api.paste([new Blob(['original'],{type:'image/png'})]);assert.equal(P.assets.length,count+1);assert.equal(P.assets.at(-1).name,'照片 (副本)');
 pixels='external';await api.paste([new Blob(['external'],{type:'image/png'})]);assert.equal(P.assets.at(-1).scope,'public');assert(toasts.some(t=>t.includes('已从剪贴板粘贴 1 张新素材')));
 context.navigator.clipboard.write=async()=>{throw Error('permission denied')};await assert.rejects(api.copyImage(),/permission denied/);assert(saves>=3);assert(refreshed.length>=3);
 console.log('PASS: PNG clipboard payload, independent ID/number duplication, internal copy/paste routing, external image import, permission failure and original media retention');
})().catch(e=>{console.error(e);process.exitCode=1});
