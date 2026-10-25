/* Shared project operations and interoperable clipboard data. No private browser-only clipboard. */
window.frameFlowOperations=(()=>{
 const FORMAT='FRAME_GRAPH_CLIPBOARD',PREFIX='FRAME-NODES/1\n',LIMIT=80*1024*1024;
 const uid=()=>crypto.randomUUID().replaceAll('-','').slice(0,12);
 const clone=v=>v?.media&&v?.segments?{...structuredClone({...v,media:undefined,originalZip:undefined}),media:{...v.media},originalZip:v.originalZip}:structuredClone(v);
 function capture(ids){
  const p=P,explicit=new Set(ids),assets=new Map(),segments=[],shots=[],notes=[];
  const take=a=>{if(a&&!a.deleted)assets.set(a.id,clone(a))};
  for(const id of explicit){
   if(id.startsWith('a:'))take(p.assets.find(a=>'a:'+a.id===id));
   else if(id.startsWith('s:')){const s=p.segments.find(s=>'s:'+s.id===id);if(s){segments.push(clone(s));allScopedAssets(s).forEach(take)}}
  }
  for(const id of explicit){if(id.startsWith('h:')){const [,sid,hid]=id.split(':'),s=p.segments.find(s=>s.id===sid),h=s?.shots.find(h=>h.id===hid);if(h&&!segments.some(s=>s.id===sid)){shots.push({sourceSegmentId:sid,duration:s.duration,item:clone(h)});allScopedAssets(s).forEach(take)}}if(id.startsWith('t:')){const n=p.overviewLayout?.unifiedFlow?.notes?.find(n=>'t:'+n.id===id);if(n)notes.push(clone(n))}}
  const paths=new Set([...assets.values()].map(a=>a.path));
  function walk(v){if(typeof v==='string'&&Object.hasOwn(p.media,v))paths.add(v);else if(v&&typeof v==='object')Object.values(v).forEach(walk)}
  segments.forEach(walk);shots.forEach(walk);
  return {format:FORMAT,version:1,projectId:p.projectId,explicit:[...explicit],mediaNumbers:Object.fromEntries([...assets.values()].filter(a=>assetMediaType(a)!=='image').map(a=>[a.id,{type:assetMediaType(a),index:p.assets.filter(x=>!x.deleted&&assetMediaType(x)===assetMediaType(a)).findIndex(x=>x.id===a.id)+1}])),assets:[...assets.values()],segments,shots,notes,media:Object.fromEntries([...paths].filter(path=>p.media[path]).map(path=>[path,p.media[path]]))};
 }
 function encode(data){const s=PREFIX+JSON.stringify(data);if(s.length>LIMIT)throw Error('复制内容超过 80MB，请分批复制');return s}
 function decode(text){const prefix=typeof text==='string'&&/^FRAME-NODES\/1\r?\n/.exec(text);if(!prefix)return null;if(text.length>LIMIT)throw Error('剪贴板内容过大');const d=JSON.parse(text.slice(prefix[0].length),(k,v)=>{if(['__proto__','constructor','prototype'].includes(k))throw Error('剪贴板包含不支持的字段');return v});if(d?.format!==FORMAT||d.version!==1||!Array.isArray(d.assets)||!Array.isArray(d.segments)||!Array.isArray(d.shots))throw Error('节点剪贴板格式无效');if(d.assets.length+d.segments.length+d.shots.length>2000)throw Error('请分批粘贴节点');if(!d.media||typeof d.media!=='object'||Array.isArray(d.media))throw Error('媒体清单无效');for(const [k,v]of Object.entries(d.media))if(!k||k.includes('..')||k.startsWith('/')||k.includes(':')||typeof v!=='string'||!/^[A-Za-z0-9+/=\s]+$/.test(v))throw Error('剪贴板媒体无效');return d}
 async function png(src){const blob=await fetch(src).then(r=>r.blob()),bitmap=await createImageBitmap(blob);try{const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;c.getContext('2d').drawImage(bitmap,0,0);return await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('图片转换失败')),'image/png'))}finally{bitmap.close()}}
 async function write(data){const text=encode(data);if(!navigator.clipboard)throw Error('当前浏览器不支持系统剪贴板');const imageAsset=data.explicit?.length===1&&data.explicit[0].startsWith('a:')?data.assets.find(a=>'a:'+a.id===data.explicit[0]&&assetMediaType(a)==='image'):null;
  if(imageAsset&&image(imageAsset.path)&&navigator.clipboard.write&&typeof ClipboardItem!=='undefined')await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([text],{type:'text/plain'}),'image/png':png(image(imageAsset.path))})]);else await navigator.clipboard.writeText(text);
  return data.explicit.length;
 }
 async function read(){if(navigator.clipboard?.read){const entries=await navigator.clipboard.read();let plain='',files=[];for(const item of entries){if(item.types.includes('text/plain'))plain=await(await item.getType('text/plain')).text();for(const t of item.types.filter(t=>t.startsWith('image/'))){const b=await item.getType(t);files.push(new File([b],'剪贴板-'+uid()+'.'+(t.split('/')[1]||'png'),{type:t}))}}return {data:decode(plain),text:plain,files}}const text=await navigator.clipboard.readText();return {data:decode(text),text,files:[]}}
 async function paste(data,targetSegmentId){
  frameUndo.push('粘贴节点');
  // Build and validate a staging project before changing the live document.
  decode(encode(data));const before=P,next=clone(P),assetMap=new Map(),numberMap=new Map(),pathMap=new Map(),segmentMap=new Map(),typedMap={audio:new Map(),video:new Map()},selected=[],rebuild=new Set(),same=data.projectId===P.projectId;
  let number=Math.max(next.nextPictureNumber||1,...next.assets.map(a=>(Number(a.pictureNumber)||0)+1),1);
  for(const s of data.segments){if(!s||typeof s.id!=='string'||!Array.isArray(s.shots)||!Number.isFinite(s.duration)||s.duration<1||s.duration>600)throw Error('片段剪贴板格式无效');segmentMap.set(s.id,uid())}
  function file(path){if(!path||!Object.hasOwn(data.media,path))return path||'';if(pathMap.has(path))return pathMap.get(path);let out=path;if(next.media[out]&&next.media[out]!==data.media[path])out='extra/pasted/'+uid()+'.'+(path.split('.').at(-1)||'bin');next.media[out]=data.media[path];pathMap.set(path,out);return out}
  function remap(v){if(typeof v==='string'){if(Object.hasOwn(data.media,v))return file(v);return v.replace(/((?:Picture|Subject)\s+)(\d+)\b/gi,(all,p,n)=>numberMap.has(+n)?p+numberMap.get(+n):all).replace(/((Audio|Video)\s*)(\d+)\b/gi,(all,p,type,n)=>typedMap[type.toLowerCase()].has(+n)?p+typedMap[type.toLowerCase()].get(+n):all)}if(Array.isArray(v))return v.map(remap);if(v&&typeof v==='object'){const out={};for(const [k,x]of Object.entries(v)){if(k==='referenceNumbers')out[k]=(x||[]).map(n=>numberMap.get(n)??n);else if(k==='assetId'&&typeof x==='string')out[k]=assetMap.get(x)||x;else if(['assetIds','mediaAssetIds'].includes(k))out[k]=(x||[]).map(id=>assetMap.get(id)||id);else out[k]=remap(x)}return out}return v}
  for(const source of data.assets){if(!source||typeof source.id!=='string'||typeof source.name!=='string')throw Error('素材剪贴板格式无效');const existing=same&&next.assets.find(a=>a.id===source.id&&!a.deleted),explicit=data.explicit.includes('a:'+source.id),localCopy=source.scope==='segment'&&segmentMap.has(source.segmentId);
   if(existing&&!explicit&&!localCopy){assetMap.set(source.id,existing.id);numberMap.set(+source.pictureNumber,+existing.pictureNumber);continue}
   const a=clone(source);a.id=uid();a.pictureNumber=number++;a.name=(source.name||'素材')+' · 副本';delete a.confirmation;delete a.deleted;delete a.deletedReferenceScopes;a.path=file(a.path);if(localCopy)a.segmentId=segmentMap.get(source.segmentId);else if(a.scope==='segment'){a.segmentId=targetSegmentId||'';if(!a.segmentId)a.scope='public'}assetMap.set(source.id,a.id);numberMap.set(+source.pictureNumber,a.pictureNumber);next.assets.push(a);if(explicit)selected.push('a:'+a.id)
  }
  for(const [id,info]of Object.entries(data.mediaNumbers||{})){if(!typedMap[info.type]||!Number.isInteger(info.index))continue;const index=next.assets.filter(a=>!a.deleted&&assetMediaType(a)===info.type).findIndex(a=>a.id===assetMap.get(id))+1;if(index>0)typedMap[info.type].set(info.index,index)}
  for(const source of data.segments){const s=remap(source);s.id=segmentMap.get(source.id);s.title=(s.title||'片段')+' · 副本';const shotMap=new Map(s.shots.map(h=>[h.id,uid()]));s.shots=s.shots.map(h=>({...h,id:shotMap.get(h.id)}));s.videos=(s.videos||[]).map(v=>({...v,id:uid(),...(v.shotId?{shotId:shotMap.get(v.shotId)||v.shotId}:{})}));s.groupPath='asset_groups/copy_'+s.id+'/group.json';s.continuity=false;s.guideFromPrev=false;delete s.shotHistory;next.segments.push(s);selected.push('s:'+s.id);rebuild.add(s.id)}
  if(data.shots.length){let s=next.segments.find(s=>s.id===targetSegmentId);if(!s){s={id:uid(),title:'粘贴镜头',duration:15,shots:[],refs:[],prompt:'',storyText:'',continuity:false,guideFromPrev:false};next.segments.push(s)}
   s.shotHistory=[...(s.shotHistory||[]),{id:uid(),createdAt:new Date().toISOString(),reason:'粘贴镜头前',shots:clone(s.shots),duration:s.duration,prompt:s.prompt||''}].slice(-50);
   for(const source of data.shots){const h=remap(source.item),length=Number(h.end)-Number(h.start);if(!Number.isFinite(length)||length<=0)throw Error('复制镜头时长无效');h.id=uid();h.start=s.shots.at(-1)?.end||0;h.end=Number((h.start+length).toFixed(3));if(h.end>600)throw Error('粘贴后片段超过 600 秒，请选择其他片段');s.duration=Math.max(s.duration,h.end);s.shots.push(h);selected.push('h:'+s.id+':'+h.id)}rebuild.add(s.id)
  }
  next.overviewLayout||={};next.overviewLayout.unifiedFlow||=clone(next.overviewLayout.reactFlowA||{});const notes=next.overviewLayout.unifiedFlow.notes||=[];for(const source of data.notes||[]){const n={id:uid(),text:String(source.text||'').slice(0,20000)};notes.push(n);selected.push('t:'+n.id)}
  for(const sid of rebuild){const s=next.segments.find(s=>s.id===sid);s.prompt=(await api('rebuild',{...s,defaultDialogueLanguage:s.dialogueLanguage??next.dialogueLanguage??'',assetReferences:next.assets.filter(a=>!a.deleted&&assetMediaType(a)==='image'&&(a.scope!=='segment'||a.segmentId===sid)).map(a=>({index:a.pictureNumber,name:a.name,kind:a.kind,description:a.description||''}))})).prompt}
  next.assetsManaged=true;next.nextPictureNumber=number;if(P!==before)throw Error('项目已切换，粘贴已取消');P=next;changed();try{await flush();frameUndo.commit()}catch(e){P=before;changed();throw e}render();return selected;
 }
 const undoRows=[];
 const fingerprint=p=>JSON.stringify([p.assets,p.segments,p.overviewLayout?.unifiedFlow?.notes||[]]);
 async function remove(ids){const original=P,before=clone(P),next=clone(P),targets=new Set(ids);frameUndo.push('删除节点或片段',before),removedSegments=new Set(next.segments.filter(s=>targets.has('s:'+s.id)).map(s=>s.id));
  if(removedSegments.size){const tasks=await api('tasks');for(const task of tasks.tasks||[])if(task.projectId===P.projectId&&removedSegments.has(task.segmentId)&&['waiting','running'].includes(task.status))await api('task-action',{id:task.id,action:'cancel'})}
  for(const a of next.assets){if(targets.has('a:'+a.id))a.deleted=true;if(a.scope==='segment'&&removedSegments.has(a.segmentId)){a.formerSegmentId=a.segmentId;a.scope='public';a.segmentId=''}}
  next.segments=next.segments.filter(s=>!removedSegments.has(s.id));
  for(const s of next.segments){s.videos=(s.videos||[]).filter(v=>!targets.has('v:'+s.id+':'+v.id));const remain=s.shots.filter(h=>!targets.has('h:'+s.id+':'+h.id));if(remain.length!==s.shots.length){s.shotHistory=[...(s.shotHistory||[]),{id:uid(),createdAt:new Date().toISOString(),reason:'画布删除镜头前',shots:clone(s.shots),duration:s.duration,prompt:s.prompt||''}].slice(-50);s.shots=remain;s.prompt=(await api('rebuild',{...s,assetReferences:next.assets.filter(a=>!a.deleted&&assetMediaType(a)==='image'&&(a.scope!=='segment'||a.segmentId===s.id)).map(a=>({index:a.pictureNumber,name:a.name,kind:a.kind,description:a.description||''}))})).prompt}}
  const flow=next.overviewLayout?.unifiedFlow;if(flow?.notes)flow.notes=flow.notes.filter(n=>!targets.has('t:'+n.id));if(P!==original)throw Error('项目已改变，删除取消');P=next;changed();window.frameCardFlow?.refresh();try{await flush()}catch(e){P=original;changed();window.frameCardFlow?.refresh();throw e}frameUndo.commit();render();
 }
 async function replace(id,fn){
  const original=P,before=clone(P);if(!P.assets.some(a=>a.id===id&&!a.deleted))throw Error('目标素材已删除');frameUndo.push('替换素材',before);
  try{await fn();if(P!==original)throw Error('项目已切换，替换未记录到其他项目');await flush();frameUndo.commit()}
  catch(error){if(P===original){P=before;changed();render();window.frameCardFlow?.refresh()}throw error}
 }
 async function undo(){
  const now=P;const result=frameUndo.undo();P=result.project;changed();
  try{await flush()}catch(e){P=now;changed();throw e}
  render();window.frameCardFlow?.refresh();return result.label
 }
 async function redo(){
  const now=P;const result=frameUndo.redo();P=result.project;changed();
  try{await flush()}catch(e){P=now;changed();throw e}
  render();window.frameCardFlow?.refresh();return result.label
 }
 return {capture,encode,decode,write,read,paste,remove,replace,undo,redo,get undoTime(){return frameUndo.time||0},get undoLabel(){return frameUndo.label||''},async note(text){const d={format:FORMAT,version:1,projectId:P.projectId,explicit:[],assets:[],segments:[],shots:[],notes:[{text}],media:{}};return paste(d)}};
})();

const frameBaseReplaceAssetImage=replaceAssetImage;replaceAssetImage=(id,file)=>frameFlowOperations.replace(id,()=>frameBaseReplaceAssetImage(id,file));
