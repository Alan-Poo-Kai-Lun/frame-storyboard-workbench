/* Main-workspace reverse prompts. Browser decoding keeps source videos local. */
let reverseTemplates={},reverseTemplatesLoaded=false,reverseTemplatesLoading,reverseSelected='',reverseDraft=null,reverseLoadVersion=0,reverseBusy=false,reverseProject='',reverseWantedTask='',reverseSeen=new Set();
function reverseDataUrl(frame){return 'data:'+frame.mime+';base64,'+frame.b64}
function releaseReverseDraft(){if(reverseDraft?.owned&&reverseDraft.url)URL.revokeObjectURL(reverseDraft.url);reverseDraft=null}
async function loadReverseTemplates(){
 if(reverseTemplatesLoaded)return;
 if(!reverseTemplatesLoading)reverseTemplatesLoading=api('reverse-templates').then(rows=>{reverseTemplates=rows;reverseTemplatesLoaded=true;renderReverseTemplates('',true)}).finally(()=>{reverseTemplatesLoading=null});
 return reverseTemplatesLoading;
}
function renderReverseTemplates(preferred=reverseSelected,replace=false){
 const type=reverseDraft?.type||'image',rows=Object.entries(reverseTemplates).filter(([,t])=>t.type===type);
 $('reverseTemplate').innerHTML=rows.length?rows.map(([id,t])=>`<option value="${esc(id)}">${esc(t.name)}</option>`).join(''):'<option value="">无已保存模板，可新增或直接输入</option>';
 const selected=rows.some(([id])=>id===preferred)?preferred:rows[0]?.[0]||'';reverseSelected=selected;$('reverseTemplate').value=selected;
 if(replace)$('reverseInstruction').value=reverseTemplates[selected]?.prompt||'';
}
function renderReverseSources(){
 if(!P)return;const value=$('reverseSource').value,options=[];
 const assets=availableAssets();if(assets.length)options.push('<optgroup label="公共 / 本组素材">'+assets.map(a=>`<option value="asset:${esc(a.id)}">${esc(assetLabel(a))}</option>`).join('')+'</optgroup>');
 const shots=(seg()?.shots||[]).flatMap((sh,i)=>['image','firstFrame','lastFrame'].filter(k=>sh[k]&&P.media[sh[k]]).map(k=>`<option value="shot:${esc(sh.id)}:${k}">镜头 ${i+1} · ${{image:'分镜图',firstFrame:'首帧',lastFrame:'尾帧'}[k]}</option>`));if(shots.length)options.push('<optgroup label="当前片段图片">'+shots.join('')+'</optgroup>');
 $('reverseSource').innerHTML='<option value="">选择图片 / 视频</option>'+options.join('');$('reverseSource').value=value;
}
function syncReversePanel(){
 if(!P)return;
 if(reverseProject!==P.projectId){reverseProject=P.projectId;reverseLoadVersion++;releaseReverseDraft();reverseBusy=false;$('reverseSubmit').disabled=$('reverseSampling').disabled=false;reverseWantedTask='';reverseSeen.clear();$('reversePreview').innerHTML='';$('reverseOutput').hidden=true;$('reverseSamplingLabel').hidden=$('reverseAudio').hidden=true;$('reverseState').textContent='请选择图片或视频';$('reverseAudioNotes').value='';if(reverseTemplatesLoaded)renderReverseTemplates('',true)}
 renderReverseSources();if(!$('reverseModel').value)$('reverseModel').value=cfg.ui?.reverseModel||cfg.ai?.model||'';
 if(ready&&!reverseTemplatesLoaded)safe(loadReverseTemplates);
}
async function openReversePanel(){if(!ready)throw Error('工作台正在加载，请稍候');ensure();$('reversePanel').open=true;syncReversePanel();await loadReverseTemplates();$('reversePanel').scrollIntoView?.({behavior:'smooth',block:'nearest'})}
$('reversePrompt').onclick=()=>safe(openReversePanel);
$('reversePanel').ontoggle=()=>{if($('reversePanel').open)safe(loadReverseTemplates)};
function mediaEvent(media,event,action,timeout=20000){
 return new Promise((resolve,reject)=>{
  const clean=()=>{clearTimeout(timer);media.removeEventListener(event,ok);media.removeEventListener('error',bad)};
  const ok=()=>{clean();resolve()},bad=()=>{clean();reject(Error('浏览器无法读取该视频，可转换为 MP4 / H.264 后重试'))};
  const timer=setTimeout(()=>{clean();reject(Error('视频读取超时，请使用可正常播放的本地视频'))},timeout);
  media.addEventListener(event,ok,{once:true});media.addEventListener('error',bad,{once:true});try{action?.()}catch(e){clean();reject(e)}
 });
}
function canvasFrame(source,width,height,time=0,longEdge=768){
 if(!width||!height)throw Error('媒体没有有效尺寸');
 const scale=Math.min(1,longEdge/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));const context=canvas.getContext('2d');
 context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(source,0,0,canvas.width,canvas.height);
 return {time,mime:'image/jpeg',b64:canvas.toDataURL('image/jpeg',.9).split(',')[1]};
}
async function sampleReverseVideo(url,count,version){
 const video=document.createElement('video');video.preload='auto';video.muted=true;video.playsInline=true;video.src=url;
 try{
  await mediaEvent(video,'loadedmetadata',()=>video.load());const duration=video.duration;
  if(!Number.isFinite(duration)||duration<=0||duration>600)throw Error('视频需在 10 分钟以内，长视频请分段');
  if(video.readyState<2)await mediaEvent(video,'loadeddata');
  const frames=[];
  for(let i=0;i<count;i++){
   if(version!==reverseLoadVersion)throw Error('已切换分析素材');
   const at=Math.min(Math.max(0,duration-.05),duration*i/(count-1));
   if(Math.abs(video.currentTime-at)>.001)await mediaEvent(video,'seeked',()=>{video.currentTime=at});
   frames.push(canvasFrame(video,video.videoWidth,video.videoHeight,video.currentTime));$('reverseState').textContent=`正在读取视频帧 ${i+1} / ${count}`;
  }
  return {duration,frames};
 }finally{video.removeAttribute('src');video.load()}
}
async function prepareReverseMedia(url,name,type,owned=false){
 ensure();const pid=P.projectId,version=++reverseLoadVersion,previousType=reverseDraft?.type||reverseTemplates[reverseSelected]?.type||'image';
 if(reverseDraft?.url!==url)releaseReverseDraft();else reverseDraft=null;
 reverseBusy=true;$('reverseSubmit').disabled=$('reverseSampling').disabled=true;$('reverseState').textContent='正在读取素材…';
 try{
  let frames,duration=0;
  if(type==='video'){const count=Number($('reverseSampling').value)||8;({duration,frames}=await sampleReverseVideo(url,count,version))}
  else{
   const image=await new Promise((resolve,reject)=>{const im=new Image;im.onload=()=>resolve(im);im.onerror=()=>reject(Error('图片无法读取'));im.src=url});
   frames=[canvasFrame(image,image.naturalWidth,image.naturalHeight,0,1536)];
  }
  if(version!==reverseLoadVersion||P.projectId!==pid)throw Error('项目或素材已切换，未载入旧素材');
  reverseDraft={url,name,type,owned,frames,duration,projectId:pid};$('reverseSamplingLabel').hidden=$('reverseAudio').hidden=type!=='video';if(type!=='video')$('reverseAudioNotes').value='';renderReverseTemplates(reverseSelected,previousType!==type);renderReversePreview();
  $('reverseState').textContent=type==='video'?`${name} · ${duration.toFixed(2)} 秒 · ${frames.length} 帧 · 音轨未分析`:`${name} · 图片已读取`;
 }catch(e){if(owned)URL.revokeObjectURL(url);if(version===reverseLoadVersion){reverseDraft=null;$('reversePreview').innerHTML='';$('reverseState').textContent=e.message}throw e}
 finally{if(version===reverseLoadVersion){reverseBusy=false;$('reverseSubmit').disabled=$('reverseSampling').disabled=false}}
}
function renderReversePreview(){
 const draft=reverseDraft;if(!draft){$('reversePreview').innerHTML='';return}
 $('reversePreview').innerHTML=(draft.type==='video'?`<video controls playsinline preload="metadata" src="${esc(draft.url)}"></video>`:'')+draft.frames.map((f,i)=>draft.type==='image'?`<img data-reverse-image="${i}" src="${reverseDataUrl(f)}" alt="待分析图片" title="点击放大" tabindex="0" role="button">`:`<button class="reverseFrame" data-reverse-image="${i}"><img src="${reverseDataUrl(f)}" alt="视频采样帧"><small>${f.time.toFixed(2)}s</small></button>`).join('');
}
$('reversePreview').onclick=e=>{const el=e.target.closest('[data-reverse-image]');if(el&&reverseDraft)openImageViewerSource(reverseDataUrl(reverseDraft.frames[Number(el.dataset.reverseImage)]),reverseDraft.name)};
async function reverseFile(file){
 if(!file)return;if(file.size>550*1024*1024)throw Error('视频文件上限 550MB');
 const type=/^video\//.test(file.type)||/\.(mp4|webm|mov|mkv)$/i.test(file.name)?'video':['image/png','image/jpeg','image/webp'].includes(file.type)?'image':'';
 if(!type)throw Error('请选择 PNG / JPG / WebP 图片或视频文件');if(type==='image'&&file.size>30*1024*1024)throw Error('图片上限 30MB');
 await openReversePanel();const url=URL.createObjectURL(file);await prepareReverseMedia(url,file.name,type,true);$('reverseSource').value='';
}
$('reverseDrop').onclick=()=>$('reverseFile').click();$('reverseDrop').onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();$('reverseFile').click()}};
$('reverseDrop').ondragover=e=>{e.preventDefault();$('reverseDrop').classList.add('dragging')};$('reverseDrop').ondragleave=()=>$('reverseDrop').classList.remove('dragging');
$('reverseDrop').ondrop=e=>safe(async()=>{e.preventDefault();$('reverseDrop').classList.remove('dragging');if(e.dataTransfer.files.length!==1)throw Error('请每次拖入一张图片或一个视频');await reverseFile(e.dataTransfer.files[0])});
$('reverseFile').onchange=()=>safe(async()=>{try{await reverseFile($('reverseFile').files[0])}finally{$('reverseFile').value=''}});
$('reverseSource').onchange=()=>safe(async()=>{
 const [type,id,field]=$('reverseSource').value.split(':');if(!id)return;await loadReverseTemplates();
 {const asset=type==='asset'?P.assets.find(a=>a.id===id):null,sh=type==='shot'?seg()?.shots.find(h=>h.id===id):null,path=asset?.path||sh?.[field];if(!path||!image(path))throw Error('图片缺失，请先替换或修复');await prepareReverseMedia(image(path),asset?.name||'镜头图片','image')}
});
$('reverseSampling').onchange=()=>safe(async()=>{if(reverseDraft?.type==='video'){const {url,name,owned}=reverseDraft;await prepareReverseMedia(url,name,'video',owned)}});
$('reverseRefreshModels').onclick=()=>safe(async()=>{if(cfg.ai?.provider!=='ollama')throw Error('当前 AI 接口不是 Ollama，请手动填写视觉模型');const r=await api('models',cfg.ai);$('reverseModels').innerHTML=r.models.map(m=>`<option value="${esc(m.name)}">`).join('');toast('已读取 '+r.models.length+' 个模型，请选择具备图片输入能力的模型')});
$('reverseTemplate').onchange=()=>{const id=$('reverseTemplate').value;if($('reverseInstruction').value!==reverseTemplates[reverseSelected]?.prompt&&$('reverseInstruction').value.trim()&&!confirm('切换模板将替换本次临时编辑，继续吗？')){$('reverseTemplate').value=reverseSelected;return}reverseSelected=id;$('reverseInstruction').value=reverseTemplates[id]?.prompt||''};
async function editReverseTemplate(asNew=false){
 await loadReverseTemplates();const id=asNew?'':reverseSelected,old=reverseTemplates[id]||{};
 modal(asNew?'新增反推模板':'修改反推模板',`<label>模板名称<input id="rtName" value="${esc(asNew?'':old.name||'')}"></label><label>用途<select id="rtType"><option value="image">图片反推</option><option value="video">视频反推</option></select></label><label>模板提示词<textarea id="rtPrompt" rows="16">${esc($('reverseInstruction').value)}</textarea></label><p class="muted">默认两套提示词也可以修改或删除；模板保存在本机，升级保留 data 即可继续使用。</p>`,[{label:'保存模板',class:'primary',action:async()=>{const r=await api('reverse-templates',{id:id||newId(),name:$('rtName').value,type:$('rtType').value,prompt:$('rtPrompt').value});reverseTemplates=r.templates;renderReverseTemplates(r.id,true);close();toast('反推模板已保存')}}]);$('rtType').value=old.type||reverseDraft?.type||'image';
}
$('reverseAddTemplate').onclick=()=>safe(()=>editReverseTemplate(true));$('reverseEditTemplate').onclick=()=>safe(()=>editReverseTemplate());
$('reverseDeleteTemplate').onclick=()=>safe(async()=>{const id=reverseSelected;if(!id)throw Error('先选择模板');if(!confirm('删除「'+reverseTemplates[id].name+'」反推模板？'))return;reverseTemplates=(await api('reverse-templates',{operation:'delete',id})).templates;renderReverseTemplates('',true);toast('已删除反推模板')});
$('reverseSubmit').onclick=()=>safe(async()=>{
 if(reverseBusy)throw Error('正在读取素材，请稍候');if(!reverseDraft)throw Error('请先选择图片或视频');const pid=P.projectId,draft=reverseDraft;
 if(draft.projectId!==pid)throw Error('项目已切换，请重新选择素材');const body={projectId:pid,mediaType:draft.type,name:draft.name,duration:draft.duration,frames:draft.frames,prompt:$('reverseInstruction').value,model:$('reverseModel').value.trim(),extra:$('reverseExtra').value,audioNotes:draft.type==='video'?$('reverseAudioNotes').value:''};
 if(!body.prompt.trim())throw Error('请选择模板或填写反推提示词');if(!body.model)throw Error('请填写支持图片输入的视觉模型');
 $('reverseSubmit').disabled=true;
 try{await flush();if(P.projectId!==pid)throw Error('项目已切换');const r=await api('reverse-prompt',body);if(P.projectId!==pid)throw Error('项目已切换，任务记录保留在原项目');reverseWantedTask=r.id;$('reverseState').textContent='反推任务已排队，完成后在下方显示结果';toast('已加入提示词反推队列');pollTasks()}finally{$('reverseSubmit').disabled=false}
});
$('reverseTasks').onclick=openTaskCenter;
function reverseMarkdown(text){
 const lines=String(text||'').split('\n'),html=[],rich=t=>esc(t).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>'),cells=line=>line.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(line.includes('|')&&i+1<lines.length&&cells(lines[i+1]).length>1&&cells(lines[i+1]).every(c=>/^:?-{3,}:?$/.test(c))){const header=cells(line);i+=2;const rows=[];while(i<lines.length&&lines[i].includes('|')){rows.push(cells(lines[i]));i++}i--;html.push('<table><thead><tr>'+header.map(c=>'<th>'+rich(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(c=>'<td>'+rich(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>')}
  else if(/^#{1,6}\s/.test(line))html.push('<h3>'+rich(line.replace(/^#+\s*/,''))+'</h3>');else if(line.trim())html.push('<p>'+rich(line)+'</p>');
 }
 return html.join('');
}
function showReverseResult(row){
 const result=row.result;if(!result)return;$('reverseOutput').hidden=false;$('reverseResultTitle').textContent='反推结果 · '+result.name;$('reverseText').value=result.text;$('reverseRendered').innerHTML=reverseMarkdown(result.text);
 $('reverseResultInfo').textContent=row.createdAt+(result.mediaType==='video'?` · ${result.duration.toFixed(2)} 秒 · ${result.frameTimes.length} 个采样帧 · ${result.audioStatus}`:' · 图片反推');
 if(row.id===reverseWantedTask){reverseWantedTask='';$('reverseState').textContent='提示词反推已完成，结果已保存到任务历史'}
}
function consumeReverseTasks(rows){
 if(!P)return;const completed=rows.filter(r=>r.type==='reverse'&&r.status==='done'&&r.projectId===P.projectId),fresh=completed.filter(r=>!reverseSeen.has(r.id));completed.forEach(r=>reverseSeen.add(r.id));
 const selected=reverseWantedTask?fresh.find(r=>r.id===reverseWantedTask):fresh.at(-1);if(selected)showReverseResult(selected);
 const failed=rows.find(r=>r.id===reverseWantedTask&&['error','cancelled','interrupted'].includes(r.status));if(failed){$('reverseState').textContent='反推任务未完成：'+(failed.error||failed.status);reverseWantedTask=''}
}
function viewReverseTask(id){const row=taskRows.find(r=>r.id===id);if(!row||row.projectId!==P?.projectId){toast('先打开原项目再查看反推结果');return}$('reversePanel').open=true;showReverseResult(row);$('reverseOutput').scrollIntoView?.({behavior:'smooth',block:'nearest'})}
$('reverseCopy').onclick=()=>safe(async()=>{await navigator.clipboard.writeText($('reverseText').value);toast('已复制反推结果')});
$('reverseDownload').onclick=()=>{const value=$('reverseText').value;if(!value)return;const url=URL.createObjectURL(new Blob([value],{type:'text/markdown;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='FRAME-Reverse-Prompt.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)};
syncReversePanel();

$('reverseModel').onchange=()=>safe(async()=>{if(typeof saveUIPreference==='function')await saveUIPreference('reverseModel',$('reverseModel').value.trim())});
