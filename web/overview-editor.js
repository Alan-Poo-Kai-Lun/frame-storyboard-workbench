/* Shared project operations for the editable canvas. No alternate project or media store. */
(()=>{
 const field=(key,label,value,rows=0,extra='')=>`<label for="canvas_${key}">${esc(label)}</label>${rows?`<textarea id="canvas_${key}" data-canvas-field="${key}" rows="${rows}" ${extra}>${esc(value)}</textarea>`:`<input id="canvas_${key}" data-canvas-field="${key}" value="${esc(value)}" ${extra}>`}`;
 const choice=(key,label,value,options)=>`<label for="canvas_${key}">${esc(label)}</label><select id="canvas_${key}" data-canvas-field="${key}">${options.map(([v,t])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(t)}</option>`).join('')}</select>`;
 const action=(key,label,cls='')=>`<button type="button" data-canvas-action="${key}" class="${cls}">${esc(label)}</button>`;
 const refs=s=>`<div class="canvasEditableRefs">${allScopedAssets(s).map((a,i)=>`<button type="button" data-overview-select="a:${esc(a.id)}">${image(a.path)?`<img src="${image(a.path)}" alt="${esc(a.name)}" loading="lazy" draggable="false">`:''}<span>${mediaAssetLabel(a,s)}<small>${esc(a.name)} · ${a.scope==='segment'?'本组':'公共'}</small></span></button>`).join('')||'<p class="muted">先添加人物、场景或道具素材。</p>'}</div>`;
 function scopedText(text,s,store=false){
  const assets=availableAssets(s);if(store)return String(text||'').replace(/\[缺失引用：(\d+)\]|(@?Picture\s+)(\d+)\b/gi,(full,missing,prefix,n)=>missing?'@Picture '+missing:assets[Number(n)-1]?prefix+assetNumber(assets[Number(n)-1]):full);
  return String(text||'').replace(/(<)?(@?Picture\s+)(\d+)(>)?/gi,(full,open,prefix,n,end)=>{const i=assets.indexOf(assetByNumber(Number(n)));return i<0?'[缺失引用：'+n+']':(open||'')+prefix+(i+1)+(end||'')});
 }
 function context(d){
  const s=d.segment||(['segment','prompt','output'].includes(d.kind)?d.item:null)||(d.kind==='asset'&&d.item.scope==='segment'?P.segments.find(s=>s.id===d.item.segmentId):null)||seg();
  if(s){segIndex=P.segments.indexOf(s);shotId=d.kind==='shot'?d.item.id:(s.shots.some(h=>h.id===shotId)?shotId:s.shots[0]?.id||'')}
  return s;
 }
 function fingerprint(d){
  if(!d)return '';
  if(d.kind==='project')return JSON.stringify([P.generation,P.title,P.aspect,P.fps,P.dialogueLanguage,P.intent,P.segments.map(s=>[s.id,s.title,s.duration,s.shots.length])]);
  if(d.kind==='asset')return JSON.stringify(['name','kind','description','scope','segmentId','path','confirmation','sceneLayout'].map(k=>d.item[k]));
  if(d.kind==='video')return JSON.stringify([d.item.title,d.item.note,d.item.path]);
  const s=d.segment||d.item,refs=availableAssets(d.segment||(['segment','prompt'].includes(d.kind)?d.item:seg())).map(a=>[a.id,assetNumber(a)]);
  if(d.kind==='segment')return JSON.stringify([P.generation,s.generation,s.prompt,s.title,s.duration,s.storyText,s.continuity,s.guideFromPrev,s.planning?.summary,s.shots,refs]);
  if(d.kind==='shot')return JSON.stringify([d.item,s.duration,refs]);
  if(d.kind==='prompt')return JSON.stringify([s.prompt,s.shots,s.duration,s.planning,refs]);
  return JSON.stringify(d.item);
 }
 function form(d){
  const s=context(d),v=d.item;let out='';
  if(d.kind==='project')out=field('title','项目名称',P.title)+choice('aspect','画幅',P.aspect,ASPECTS.filter(a=>/^\d+:\d+$/.test(a)).map(a=>[a,a]))+field('language','默认对白语言',P.dialogueLanguage||'',0,'list="dialogueLanguages"')+field('goal','故事目标',P.intent?.goal||'',3)+`<small>用于本项目对白，镜头单独指定语言时优先使用镜头设置。</small><div class="canvasActionRow">${action('add-segment','＋ 新增片段')}${action('handoff','保存 / 交接')}</div><details class="canvasSegmentNavigation"><summary>片段导航</summary>${P.segments.map(s=>`<button class="canvasSegmentLink" data-overview-select="s:${esc(s.id)}">${esc(s.title)}<small>${s.shots.length} 个镜头 · ${s.duration} 秒</small></button>`).join('')}</details>`;
  if(d.kind==='segment')out=inlineGenerationForm(v)+field('title','片段名称',v.title)+field('duration','时长 / 秒',v.duration,0,'type="number" min="1" max="600" step="0.1"')+field('story','故事 / 剧本',scopedText(v.storyText??'',s),5)+field('segmentPrompt','本段提示词',scopedText(v.prompt||'',s),6)+`<div class="canvasActionRow">${action('plan','AI 拆镜','primary')}${action('add-shot','＋ 手动添加镜头')}</div><h3>本片段素材 · 公共 + 本组</h3>${refs(s)}<div class="canvasActionRow">${action('add-local-asset','＋ 本组素材')}${action('add-public-asset','＋ 公共素材')}</div><details><summary>片段承接与摘要</summary><label class="checkrow"><input type="checkbox" id="canvas_continuity" data-canvas-field="continuity" ${v.continuity&&P.segments.indexOf(s)>0?'checked':''} ${P.segments.indexOf(s)===0?'disabled':''}>文字拆镜继承上一段</label><label class="checkrow"><input type="checkbox" id="canvas_guide" data-canvas-field="guide" ${(v.guideFromPrev??v.continuity)&&P.segments.indexOf(s)>0?'checked':''} ${P.segments.indexOf(s)===0?'disabled':''}>H3 视频段间引导继承上一段</label><small>视频引导还受项目全局开关控制，效果由外部 H3 导演台实现。</small>${field('summary','剧情摘要',scopedText(v.planning?.summary||'',s),3)}<div class="canvasActionRow">${action('guide','全局段间引导')}${action('review','深度审查')}</div></details><div class="canvasActionRow">${action('story-history','故事历史')}${action('copy-segment','复制整段')}${action('segment-up','片段前移')}${action('segment-down','片段后移')}</div><div class="canvasActionRow">${action('delete-segment','删除片段','danger')}${action('undo-segment','撤销删除片段')}</div>`;
  if(d.kind==='shot')out=`<div class="canvasTimeRow">${field('start','开始 / 秒',v.start,0,'type="number" min="0" step="0.1"')}${field('end','结束 / 秒',v.end,0,'type="number" min="0" step="0.1"')}</div>${field('action','画面 / 动作',scopedText(v.action,s),4)}${field('camera','摄影机',scopedText(v.camera,s),2)}<div class="canvasActionRow">${action('reference-camera','选镜头参考')}${action('reference-action','选动作参考')}</div>${field('dialogue','对白',scopedText(v.dialogue,s),3)}<details><summary>表演、声音与对白语言</summary>${field('expression','表情 / 表演',scopedText(v.expression,s),2)}${action('reference-expression','选表情参考')}${field('sound','声音',scopedText(v.sound,s),2)}${field('language','镜头对白语言',v.dialogueLanguage||'',0,'list="dialogueLanguages"')}</details><details><summary>镜头起止空间状态</summary>${field('startState','起始位置 / 朝向 / 姿态',scopedText(v.startState,s),3)}${field('endState','结束位置 / 动作结果',scopedText(v.endState,s),3)}<small>下一镜头应承接结束状态；区分场景位置与画面左右。</small></details><details><summary>专业镜头参数</summary>${Object.entries(PROFESSIONAL).map(([key,p])=>field('pro_'+key,p.label,v.professional?.[key]||'',0,`list="canvas_options_${key}"`)+`<datalist id="canvas_options_${key}">${p.options.map(t=>`<option value="${esc(t)}">`).join('')}</datalist>`).join('')}</details><h3>本片段 Picture 编号</h3>${refs(s)}<div class="canvasActionRow">${action('upload-shot','上传 / 替换镜头图')}${action('shot-up','镜头前移')}${action('shot-down','镜头后移')}</div><div class="canvasActionRow">${action('delete-shot','删除镜头','danger')}${action('undo-shots','撤销镜头修改')}</div>`;
  if(d.kind==='asset')out=assetMediaTag(v)+field('name','素材名称',v.name)+choice('kind','素材类型',v.kind,['人物','场景','道具','风格','声音','视频'].map(k=>[k,k]))+choice('scope','素材用途',v.scope==='segment'?v.segmentId:'public',[['public','公共 · 所有片段'],...P.segments.map(x=>[x.id,'本组 · '+x.title])])+field('description','具体说明',scopedText(v.description||'',s),5)+`<p class="canvasAssetStatus">${assetVisionCurrent(v)?'说明已确认':'说明未确认或已变化'}；替换图片或修改说明后需重新确认。</p><div class="canvasAssetDrop" data-canvas-drop="${esc(v.id)}">拖入同类素材，替换此素材<br><small>保留编号与现有引用</small></div><div class="canvasActionRow">${action('replace-asset','选择素材替换')}${action('confirm-asset','确认使用我的说明','primary')}${assetMediaType(v)==='image'?action('analyze-asset','AI 分析说明'):''}</div><div class="canvasActionRow">${action('delete-asset','删除素材','danger')}${action('dossier','AI 草稿 / 说明历史')}${v.kind==='场景'?action('scene-layout','场景基准布局'):''}</div><h3>引用此素材的片段</h3>${P.segments.filter(x=>allScopedAssets(x).some(a=>a.id===v.id)).map(x=>`<button class="canvasSegmentLink" data-overview-select="s:${esc(x.id)}">${esc(x.title)}</button>`).join('')}`;
  if(d.kind==='prompt')out=`<p class="muted">查看、复制或直接修改最终提示词。修改后按时间区间保留已有镜头图片与编号，旧镜头可撤销。人物 / 场景定义由素材说明自动编译，请在素材节点修改。</p><p id="canvasPromptLoading" role="status">正在读取最终输出…</p>${field('prompt','H3 FINAL PROMPT','',14,'disabled')}<div class="canvasActionRow">${action('copy-prompt','复制提示词')}${action('prompt-history','提示词历史')}${action('undo-shots','撤销镜头修改')}</div>`;
  if(d.kind==='output')out=`<p>记录本片段已经生成的视频。文件与备注随导演包保存。</p><button class="primary" data-canvas-upload="${esc(v.id)}">＋ 上传本片段视频</button><div class="canvasActionRow">${action('add-local-asset','＋ 本组素材')}</div>${(v.videos||[]).map(x=>`<button class="canvasSegmentLink" data-overview-select="v:${esc(v.id)}:${esc(x.id)}">${esc(x.title||x.name)}<small>${esc(x.note||'暂无备注')}</small></button>`).join('')}`;
  if(d.kind==='video')out=(videoMediaSource(v)?`<video controls playsinline preload="none" src="${videoMediaSource(v)}"></video>`:'<p class="warning">视频文件缺失。</p>')+field('title','视频名称',v.title||v.name)+field('note','模型、版本与记录',v.note||'',5)+`<p class="muted">${esc(v.name)} · ${esc(v.createdAt||'')}</p><div class="canvasActionRow">${action('download-video','下载视频')}${action('delete-video','删除视频记录','danger')}</div>`;
  const editable=d.kind!=='output';
  return `<div class="canvasDetailHeading"><div class="eyebrow">${esc({project:'项目',segment:'片段',shot:'镜头',asset:'素材',prompt:'最终提示词',output:'成片',video:'视频记录'}[d.kind])} · 直接编辑</div><h2>${esc(d.title)}</h2></div><p class="canvasEditStatus" role="status">选择节点后可直接修改。${editable?'停止输入后自动保存。':''}</p>${editable?`<div class="canvasSaveRow">${action('save','立即保存')}${action('discard','重新载入')}</div>`:''}<div class="canvasEditFields">${d.kind==='project'?'<button type="button" data-generation-settings class="generationPrimary">项目生成配置</button>':''}${out}</div>`;
 }
 function collect(detail){return Object.fromEntries([...detail.querySelectorAll('[data-canvas-field]')].map(el=>[el.dataset.canvasField,el.type==='checkbox'?el.checked:el.value]))}
 function archive(s,reason){return [...(s.shotHistory||[]),{savedAt:new Date().toISOString(),reason,duration:s.duration,shots:structuredClone(s.shots||[]),prompt:s.prompt||'',planning:structuredClone(s.planning||null)}].slice(-5)}
 async function save(d,values){
  const project=P,s=context(d),v=d.item,ops=[],targets=[];
  function put(object,key,value){if(JSON.stringify(object[key])===JSON.stringify(value))return;ops.push({object,key,value,had:Object.hasOwn(object,key),old:structuredClone(object[key]??null)})}
  function number(key,min,max){const n=Number(values[key]);if(String(values[key]??'').trim()===''||!Number.isFinite(n)||n<min||n>max)throw Error('请输入有效的 '+key+'（'+min+'–'+max+'）');return n}
  function text(key){return scopedText(values[key]||'',s,true)}
  function rebuild(target){if(target&&!targets.includes(target))targets.push(target)}
  if(d.kind==='project'){
   const title=String(values.title||'').trim();if(!title)throw Error('请填写项目名称');if(!ASPECTS.includes(values.aspect)||!/^[\d]+:[\d]+$/.test(values.aspect))throw Error('请选择有效画幅');
   const language=cleanDialogueLanguage(values.language);put(P,'title',title.slice(0,200));put(P,'aspect',values.aspect);if(!Number.isFinite(P.fps))put(P,'fps',24);put(P,'intent',{...P.intent,goal:values.goal||''});
   if(language!==(P.dialogueLanguage||'')){put(P,'dialogueLanguage',language);P.segments.forEach(rebuild)}
  }
  if(d.kind==='segment'){
   if(values.genTask!==undefined){if(!['t2v','i2v','fl2v','r2v'].includes(values.genTask))throw Error('本段模式无效');const global=P.generation?.taskType||'r2v';if(['v2v','rv2v'].includes(global))throw Error('源视频项目请使用项目模式设置');const current=segmentMode(s);const settings={...s.generation,taskType:values.genTask,...Object.fromEntries(['genImage','startImage','endImage'].map(k=>[k,values['gen_'+k]||'']))};const old=s.generation||{},before={taskType:current,genImage:old.genImage??s.genImage?.imageFile??s.imageFile??'',startImage:old.startImage??s.startImage?.imageFile??s.shots.find(h=>h.firstFrame)?.firstFrame??'',endImage:old.endImage??s.endImage?.imageFile??s.shots.findLast(h=>h.lastFrame)?.lastFrame??''};if(Object.keys(before).some(k=>before[k]!==settings[k])){if(current!==values.genTask){for(const other of P.segments)if(other!==s)put(other,'generation',{...other.generation,taskType:segmentMode(other)});put(P,'generation',{...P.generation,taskType:'mixed'})}else put(P,'generation',{...P.generation,taskType:global});put(P,'generationManaged',true);put(s,'generation',settings)}}
   const duration=number('duration',1,600),story=text('story'),title=String(values.title||'').trim();if(!title)throw Error('请填写片段名称');
   put(s,'title',title.slice(0,200));put(s,'continuity',P.segments.indexOf(s)>0&&!!values.continuity);put(s,'guideFromPrev',P.segments.indexOf(s)>0&&!!values.guide);
   if(duration!==s.duration){put(s,'shotHistory',archive(s,'总览调整片段时长前'));const ratio=duration/s.duration;put(s,'shots',s.shots.map(h=>({...h,start:Number((h.start*ratio).toFixed(3)),end:Number((h.end*ratio).toFixed(3))})));put(s,'duration',duration);rebuild(s)}
   if(story!==(s.storyText||'')){let history=[...(s.storyHistory||[])];for(const [reason,t]of [['总览编辑前',s.storyText||''],['总览保存',story]])if(t.trim()&&history.at(-1)?.text!==t)history.push({id:newId(),createdAt:new Date().toISOString(),reason,text:t});put(s,'storyHistory',history.slice(-100));put(s,'storyText',story);put(P,'script',story)}
   const summary=text('summary');if(summary!==(s.planning?.summary||'')){put(s,'planning',{...s.planning,summary});rebuild(s)}
  }
  if(d.kind==='shot'){
   const start=number('start',0,s.duration),end=number('end',0,s.duration);if(end<=start)throw Error('结束时间必须晚于开始时间，且不能超出片段时长');
   const priorOps=ops.length;put(v,'start',start);put(v,'end',end);
   for(const key of ['action','camera','expression','dialogue','sound','startState','endState'])put(v,key,text(key));
   put(v,'dialogueLanguage',cleanDialogueLanguage(values.language));put(v,'professional',Object.fromEntries(Object.keys(PROFESSIONAL).map(k=>[k,String(values['pro_'+k]||'').trim()]).filter(([,x])=>x)));if(ops.length>priorOps){put(s,'shotHistory',archive(s,'总览修改镜头前'));rebuild(s)}
  }
  if(d.kind==='asset'){
   const name=String(values.name||'').trim();if(!name)throw Error('请填写素材名称');if(!['人物','场景','道具','风格','声音','视频'].includes(values.kind))throw Error('素材类型无效');if(values.scope!=='public'&&!P.segments.some(s=>s.id===values.scope))throw Error('素材目标片段已删除');
   put(v,'name',name.slice(0,200));put(v,'kind',values.kind);put(v,'description',text('description'));put(v,'scope',values.scope==='public'?'public':'segment');put(v,'segmentId',values.scope==='public'?'':values.scope);P.segments.filter(s=>s.shots.length).forEach(rebuild);
  }
  if(d.kind==='video'){const title=String(values.title||'').trim();if(!title)throw Error('请填写视频名称');put(v,'title',title.slice(0,200));put(v,'note',String(values.note||'').slice(0,5000))}
  if(d.kind==='prompt'||(d.kind==='segment'&&values.segmentPrompt!==undefined&&text('segmentPrompt')!==(s.prompt||''))){
   const raw=String(d.kind==='segment'?values.segmentPrompt:values.prompt||'');if(!raw.trim())throw Error('提示词不能为空');const stored=storedCompiledPrompt(raw).split('\n').map(line=>line.replace(/^(\s*Dialogue:\s*)<Subject\s+(\d+)>(?=(?:（[^\n]*）)?\s*:)/i,(full,prefix,n)=>prefix+'<Picture '+(availableAssets(s)[Number(n)-1]?assetNumber(availableAssets(s)[Number(n)-1]):n)+'>')).join('\n'),parsed=parseText(stored,s.duration);
   if(!parsed.length||parsed.some(h=>!Number.isFinite(h.start)||!Number.isFinite(h.end)||h.start<0||h.end<=h.start||h.end>s.duration))throw Error('提示词需包含有效时间线，镜头不能超出片段时长');
   for(const h of parsed){const old=s.shots.find(x=>Math.abs(x.start-h.start)<.001&&Math.abs(x.end-h.end)<.001);if(old)for(const key of ['id','image','firstFrame','lastFrame','locks'])if(old[key]!==undefined)h[key]=structuredClone(old[key]);h.professional=old?structuredClone(old.professional||{}):{};if(h.professionalNote)for(const part of h.professionalNote.split(/[；;]/)){const [label,...value]=part.split(/[:：]/);const entry=Object.entries(PROFESSIONAL).find(([,p])=>p.label===label.trim());if(entry)h.professional[entry[0]]=value.join('：').trim()}}
   const rebuildIndex=targets.indexOf(s);if(rebuildIndex>=0)targets.splice(rebuildIndex,1);put(s,'shotHistory',archive(s,'总览修改最终提示词前'));put(s,'promptHistory',[...(s.promptHistory||[]),{savedAt:new Date().toISOString(),reason:'总览修改前',text:s.prompt||''}].slice(-100));put(s,'prompt',stored);put(s,'shots',parsed);
   const summary=stored.match(/^summary:\s*([\s\S]*?)(?=^[a-z_]+:|(?![\s\S]))/im);if(summary)put(s,'planning',{...s.planning,summary:summary[1].trim()});
  }
  for(const op of ops)op.object[op.key]=op.value;
  try{
   const results=await Promise.all(targets.map(async target=>[target,(await api('rebuild',{...target,defaultDialogueLanguage:P.dialogueLanguage||'',assetReferences:availableAssets(target).map(a=>({index:assetNumber(a),name:a.name,kind:a.kind,description:a.description||''}))})).prompt]));
   if(P!==project||P.projectId!==project.projectId)throw Error('项目已切换，未把修改写入新项目');
   for(const [target,prompt]of results){if(!P.segments.includes(target))throw Error('原片段已删除');const previous=ops.find(o=>o.object===target&&o.key==='prompt')?.old??target.prompt;if(previous&&previous!==prompt)target.promptHistory=[...(target.promptHistory||[]),{savedAt:new Date().toISOString(),reason:'总览编辑前',text:previous}].slice(-100);target.prompt=prompt}
  }catch(e){for(const op of ops.slice().reverse())if(JSON.stringify(op.object[op.key])===JSON.stringify(op.value)){if(op.had)op.object[op.key]=op.old;else delete op.object[op.key]}throw e}
  if(d.kind==='shot')shotId=v.id;if(d.kind==='prompt')shotId=s.shots[0]?.id||'';
  changed();await flush();return {segment:s};
 }
 async function command(cmd,d){
  const s=context(d),v=d.item;
  if(cmd==='plan')return askAI('根据本片段故事拆成适合指定时长的镜头。');
  if(cmd==='review')return askAI('检查当前分镜的空间、动作对象与承接，只提出必要的局部修改。','review');
  if(cmd==='reference-camera')return openVisualReference('size');if(cmd==='reference-action')return openVisualReference('action');if(cmd==='reference-expression')return openVisualReference('expression');
  if(cmd==='confirm-asset')return confirmManual(v.id);if(cmd==='analyze-asset')return analyzeAssets(v.id,true);if(cmd==='dossier')return openAssetDossier(v.id);if(cmd==='scene-layout')return editSceneLayout(v.id);
  if(cmd==='story-history')return $('storyHistory').click();if(cmd==='prompt-history')return $('promptHistory').click();if(cmd==='guide')return $('directorGuide').click();if(cmd==='handoff')return $('export').click();
  if(cmd==='upload-shot')return $('uploadShot').click();
  if(cmd==='add-segment'){const row={id:newId(),title:'片段 '+String(P.segments.length+1).padStart(2,'0'),duration:15,originalDuration:15,prompt:'',originalPrompt:'',storyText:'',storyHistory:[],shots:[],refs:[],continuity:false,guideFromPrev:false};P.segments.push(row);changed();await flush();return {select:'s:'+row.id}}
  if(cmd==='add-shot'){const at=s.shots.at(-1)?.end||0;if(at>=s.duration)throw Error('时间线已覆盖片段。请先增加片段时长或缩短现有镜头');s.shotHistory=archive(s,'总览添加镜头前');const h={id:newId(),start:at,end:Math.min(at+3,s.duration),action:'',camera:'',expression:'',dialogue:'',sound:'',image:'',locks:{identity:true,costume:false,scene:true,prop:false}};s.shots.push(h);shotId=h.id;await updatePrompt();await flush();return {select:'h:'+s.id+':'+h.id}}
  if(cmd==='copy-segment'){const copy=duplicateCurrentSegment();copy.storyText=storedWorkspaceText(workspaceText(copy.storyText||'',true));P.script=copy.storyText;changed();await flush();return {select:'s:'+copy.id}}
  if(cmd==='segment-up'||cmd==='segment-down'){const i=P.segments.indexOf(s),j=i+(cmd==='segment-up'?-1:1);if(j>=0&&j<P.segments.length)await moveSegment(s.id,P.segments[j].id,cmd==='segment-down');return {select:'s:'+s.id}}
  if(cmd==='delete-segment')return deleteSegmentModal(s.id);if(cmd==='undo-segment')return $('undoDeleteSegment').onclick();
  if(['shot-up','shot-down','delete-shot'].includes(cmd)){
   const i=s.shots.indexOf(v),j=i+(cmd==='shot-up'?-1:1);if(i<0)throw Error('镜头已删除');if(cmd!=='delete-shot'&&(j<0||j>=s.shots.length))return;
   s.shotHistory=archive(s,'总览调整镜头前');if(cmd==='delete-shot')s.shots.splice(i,1);else[s.shots[i],s.shots[j]]=[s.shots[j],s.shots[i]];normalize();shotId=cmd==='delete-shot'?s.shots[Math.min(i,s.shots.length-1)]?.id||'':v.id;await updatePrompt();await flush();return {select:shotId?'h:'+s.id+':'+shotId:'s:'+s.id};
  }
  if(cmd==='undo-shots'){await $('undoShots').onclick();return {select:'s:'+s.id}}
  if(cmd==='download-video'){const src=videoMediaSource(v);if(!src)throw Error('视频文件缺失');const a=document.createElement('a');a.href=src;a.download=v.name;a.click();return}
  if(cmd==='delete-video'){if(!confirm('删除这条视频记录？已导出的文件不受影响。'))return;s.videos=s.videos.filter(x=>x!==v);if(!P.segments.some(x=>x.videos?.some(y=>y.path===v.path)))delete P.media[v.path];changed();await flush();return {select:'o:'+s.id}}
 }
 for(const key of ['story','summary','description','action','camera','expression','dialogue','sound','startState','endState'])mentionFields.add('canvas_'+key);
 window.frameOverviewEditor={form,collect,fingerprint,save,command,context,scopedText};
})();
