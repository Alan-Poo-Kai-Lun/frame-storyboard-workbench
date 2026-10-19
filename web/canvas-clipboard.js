/* Real image clipboard IO, with project-local duplication kept separate from imports. */
window.createFrameCanvasClipboard=function(o){
 let copied=null,busy=false;
 const png=async blob=>{
  const url=URL.createObjectURL(blob),img=new Image();
  try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('图片无法解码'));img.src=url});const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;if(!canvas.width||!canvas.height)throw Error('图片尺寸无效');canvas.getContext('2d').drawImage(img,0,0);return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('图片转换失败')),'image/png'))}finally{URL.revokeObjectURL(url)}
 };
 const hash=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
 function selected(){const d=o.selected();if(d?.kind!=='asset')throw Error('请先选中一个素材卡片');if(assetMediaType(d.item)!=='image')throw Error('此操作仅支持图片素材');return d.item}
 async function duplicate(asset=selected()){
  if(!await o.save())return;const project=P;if(!project.assets.includes(asset)||asset.deleted)throw Error('素材已删除或项目已切换');
  const copy=structuredClone(asset);copy.id=newId();copy.pictureNumber=nextAssetNumber();copy.name=(asset.name||'素材')+' (副本)';delete copy.deleted;delete copy.deletedReferenceScopes;delete copy.confirmation;
  project.assets.push(copy);project.assetsManaged=true;o.place(copy,asset);changed();try{await flush()}catch(error){project.assets.splice(project.assets.indexOf(copy),1);throw error}await o.refresh('a:'+copy.id);toast('已创建素材副本');return copy;
 }
 async function copyImage(){
  const asset=selected(),project=P;if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw Error('浏览器不支持图片剪贴板，请使用新版 Chrome / Edge 并允许剪贴板访问');
  const src=image(asset.path);if(!src)throw Error('素材图片缺失');
  // Invoke write during the user gesture; lazy PNG conversion also works in Safari.
  const converted=fetch(src).then(r=>r.blob()).then(png);const write=navigator.clipboard.write([new ClipboardItem({'image/png':converted})]);
  try{await write;const blob=await converted;if(P!==project) return;copied={projectId:P.projectId,assetId:asset.id,hash:await hash(blob)};toast('图片已复制，可在微信或其他应用粘贴')}catch(error){converted.catch(()=>{});copied=null;throw Error('复制图片失败：'+error.message)}
 }
 async function paste(files){
  if(busy)return;busy=true;try{
   const project=P;if(!await o.save())return;
   const converted=[];for(const file of files)converted.push(await png(file));
   if(P!==project)throw Error('项目已切换');
   if(converted.length===1&&copied?.projectId===P.projectId&&await hash(converted[0])===copied.hash){const original=P.assets.find(a=>a.id===copied.assetId&&!a.deleted);if(original)return await duplicate(original)}
   const images=converted.map((blob,i)=>new File([blob],'剪贴板素材-'+Date.now()+'-'+(i+1)+'.png',{type:'image/png'}));const added=await addAssetFiles(images,'public');if(P!==project)throw Error('项目已切换');if(!added.length)throw Error('剪贴板中没有可导入的图片');for(const [i,a]of added.entries())o.place(a,null,i);await flush();await o.refresh('a:'+added[0].id);toast('已从剪贴板粘贴 '+added.length+' 张新素材');$('toast')?.classList.add('success');setTimeout(()=>$('toast')?.classList.remove('success'),2200);return added;
  }finally{busy=false}
 }
 return {copyImage,duplicate,paste};
};
