/* First-run entry and progressive disclosure. Uses the existing project/editor, no second data store. */
let startupReady=false,startupStage='shots',startupCreating=false;
const startupHome=document.createElement('section');startupHome.id='startupHome';startupHome.className='startupHome';
startupHome.innerHTML=`<div class="startupHero"><div><div class="startupEyebrow">YOUR STORY STARTS HERE</div><h1>先把故事讲清楚。<br>再拍好每一个镜头。</h1><p>整理素材、规划分镜、记录成片。<br>从手动创作开始，随时加入 AI 辅助。</p></div><div class="startupFlow" aria-label="故事、素材、分镜创作流程"><div><b>故事</b><small>你想讲什么</small></div><div><b>素材</b><small>谁 · 在哪里</small></div><div><b>分镜</b><small>镜头怎么拍</small></div></div></div><div class="startupEntries"><button id="startExample" class="startupEntry featured"><small>从这里开始 · 推荐</small><b>体验示例项目</b><span>打开「赛博修仙 v5」，体验完整故事、参考素材、分镜与已有成片。</span><em>无需配置 · 可直接编辑 ↗</em></button><button id="startCreate" class="startupEntry"><small>开始自己的故事</small><b>创建新项目</b><span>写下一个想法，逐步准备素材，再添加第一个镜头。</span><em>手动创作也能完整使用 ＋</em></button><button id="startImport" class="startupEntry"><small>继续已有创作</small><b>导入已有项目</b><span>打开保存的项目或导演包，继续整理与修改。</span><em>沿用已有故事和素材 ↗</em></button></div><div id="startupResume" class="startupResume" hidden><div><small>本机已有项目</small><b id="startupResumeTitle"></b></div><button id="startResume" class="primary">继续编辑 →</button></div><div class="startupBottom"><span>基础分镜无需连接 AI。首次使用 AI 功能时，再设置模型。</span><button id="startHelp">AI 与 H3 分别用来做什么？</button></div><p id="startupLoadStatus" role="status">正在读取本机项目…</p>`;
$('workspaceAnchor').before(startupHome);
const localProjects=document.createElement('section');localProjects.className='startupLocalProjects';localProjects.innerHTML='<div class="startupLocalHeading"><h2>本机项目</h2><button id="recoverLocalProjects">找回旧项目</button><button id="refreshLocalProjects">刷新</button><button id="clearLocalProjects" class="danger" disabled>清空全部</button><button id="localProjectTrash">回收站</button></div><p id="localProjectStatus" role="status"></p><div id="localProjectList"></div>';startupHome.querySelector('.startupBottom').before(localProjects);
let localProjectsRevision=0,localProjectRows=[],localProjectsBusy=false;
async function refreshLocalProjects(){const revision=++localProjectsRevision;try{const rows=await api('projects');if(revision!==localProjectsRevision)return;localProjectRows=rows;$('clearLocalProjects').disabled=localProjectsBusy||!rows.length;$('localProjectList').innerHTML=rows.map(row=>`<article class="localProjectCard"><div><b>${esc(row.title)}</b><small>${row.segments} 片段 · ${row.shots} 镜头 · ${row.assets} 素材 · ${esc(row.updatedAt)}</small></div><button data-local-project="${esc(row.id)}" ${row.missing?'disabled':''}>${row.missing?'文件缺失':row.current?'继续编辑 →':'打开总览 →'}</button><button data-delete-project="${esc(row.id)}" class="danger" aria-label="删除 ${esc(row.title)}">删除</button></article>`).join('')||'<p class="muted">还没有项目，试试上方示例或新建。</p>';$('localProjectStatus').textContent='旧版导入过的项目，可点“找回旧项目”扫描最近备份。'}catch(e){$('localProjectStatus').textContent='项目列表读取失败：'+e.message}}
$('refreshLocalProjects').onclick=()=>safe(refreshLocalProjects);$('recoverLocalProjects').onclick=()=>safe(async()=>{if(localProjectsBusy)return;const button=$('recoverLocalProjects');button.disabled=true;$('localProjectStatus').textContent='正在检查最近的旧项目备份…';try{const r=await api('projects-recover',{});await refreshLocalProjects();$('localProjectStatus').textContent='找回 '+r.recovered+' 个旧项目'+(r.skipped?'；'+r.skipped+' 个备份无法读取':'')+'。原备份仍保留。'}finally{button.disabled=false}});
$('localProjectList').onclick=e=>safe(async()=>{if(localProjectsBusy)return;const remove=e.target.closest('[data-delete-project]');if(remove){deleteLocalProjects([remove.dataset.deleteProject]);return}const button=e.target.closest('[data-local-project]');if(!button)return;button.disabled=true;try{await flush();P=await api('project-open',{projectId:button.dataset.localProject,currentProjectId:P?.projectId||''});dirty=false;segIndex=0;shotId=seg()?.shots[0]?.id||'';render();enterStartupWorkspace()}finally{button.disabled=false}});
function restoreStartupBlocks(){}
function syncStartup(){if(!startupReady)return;$('startupResume').hidden=!P;$('startupResumeTitle').textContent=P?.title||'未命名项目';document.body.dataset.workbenchMode='canvas';document.body.dataset.startupStage=startupStage;$('export').textContent='导出 H3 包';if(!cfg.ai?.model)$('connection').textContent='手动创作已就绪 · AI 可按需连接'}
function openStartupHome(){restoreStartupBlocks();document.body.dataset.startupView='home';syncStartup();safe(refreshLocalProjects)}
function setLocalProjectsBusy(value){localProjectsBusy=value;for(const el of localProjects.querySelectorAll('button'))el.disabled=value||el.id==='clearLocalProjects'&&!localProjectRows.length||el.hasAttribute('data-local-project')&&localProjectRows.some(row=>row.id===el.dataset.localProject&&row.missing)}
function deleteLocalProjects(keys,all=false){
 const rows=localProjectRows.filter(row=>keys.includes(row.id)),pid=P?.projectId||'';if(!rows.length||localProjectsBusy)return;
 modal(all?'清空全部本机项目':'删除本机项目',`<p>将以下 ${rows.length} 个项目移入回收站，可在首页“回收站”恢复。相关未完成任务会取消跟踪。</p><ul>${rows.map(row=>`<li>${esc(row.title)}${row.current?'（当前项目）':''}</li>`).join('')}</ul><p class="muted">项目媒体保留用于恢复；参考库、AI 设置和原始导入文件不受影响。</p><p id="projectDeleteStatus" role="alert"></p>`,[{label:'取消',action:close},{label:all?'全部移入回收站':'移入回收站',class:'danger',action:async()=>{
  setLocalProjectsBusy(true);try{if((P?.projectId||'')!==pid)throw Error('当前项目已切换，请重新核对');await flush();const result=await api('projects-delete',{projectIds:rows.map(row=>row.id),currentProjectId:pid,all});if(result.currentDeleted){clearTimeout(saveTimer);P=null;dirty=false;segIndex=0;shotId=''}close();render();openStartupHome();await refreshLocalProjects();toast('已将 '+result.deleted+' 个项目移入回收站，可恢复。')}catch(error){$('projectDeleteStatus').textContent='删除失败：'+error.message}finally{setLocalProjectsBusy(false)}
 }}]);
}
async function openLocalProjectTrash(){
 if(localProjectsBusy)return;await flush();const rows=await api('projects-trash');
 modal('本机项目回收站',`<p>删除的项目与媒体仍保留。恢复后回到首页列表选择项目继续编辑。</p><div>${rows.map(row=>`<article class="localProjectCard"><div><b>${esc(row.title)}</b><small>${esc(row.deletedAt)} · ${row.segments} 片段 · ${row.shots} 镜头</small></div><button data-restore-project="${esc(row.id)}">恢复</button></article>`).join('')||'<p class="muted">回收站为空。</p>'}</div><p id="projectTrashStatus" role="alert"></p>`,[{label:'关闭',action:close}]);
 $('modalBody').onclick=e=>safe(async()=>{const button=e.target.closest('[data-restore-project]');if(!button||localProjectsBusy)return;setLocalProjectsBusy(true);button.disabled=true;try{await flush();await api('project-restore',{projectId:button.dataset.restoreProject,currentProjectId:P?.projectId||''});await refreshLocalProjects();setLocalProjectsBusy(false);await openLocalProjectTrash()}catch(error){$('projectTrashStatus').textContent='恢复失败：'+error.message}finally{setLocalProjectsBusy(false);button.disabled=false}});
}
$('clearLocalProjects').onclick=()=>deleteLocalProjects(localProjectRows.map(row=>row.id),true);$('localProjectTrash').onclick=()=>safe(openLocalProjectTrash);
function enterStartupWorkspace(stage='shots'){
 if(!P){openStartupCreate();return}
 startupStage=stage;document.body.dataset.startupView='workspace';syncStartup();openFrameOverview();
}
function initStartup(){
 startupReady=true;
 document.body.classList.remove('startupPending');$('startupLoadStatus').textContent='';
 openStartupHome();
}
function startupFailed(message){document.body.classList.remove('startupPending');document.body.dataset.startupView='home';$('startupLoadStatus').textContent='读取失败：'+message+'。请刷新重试。';for(const id of ['startCreate','startExample','startImport'])$(id).disabled=true}
function startupHelp(){modal('按你的需要，逐步开始',`<article class="startupHelpItem"><h3>基础分镜 · 无需模型</h3><p>写故事、整理素材、手动编辑镜头、查看提示词和记录成片。</p></article><article class="startupHelpItem"><h3>AI 辅助 · 可选</h3><p>拆镜、素材分析、深度审查和反推。需要本地 Ollama 或兼容 API，二选一。</p></article><article class="startupHelpItem"><h3>H3 视频交接 · 可选</h3><p>导出的导演包交给 AI 搅拌手（AIMixer）H3 导演台。需另行安装 ComfyUI 节点、对应工作流与模型。工作台负责策划与记录，视频在外部工具生成。</p></article>`,[{label:'知道了',class:'primary',action:close}])}
async function createStartupProject(example=false,title=''){
 if(!ready||startupCreating)throw Error('工作台正在加载或创建项目，请稍候');
 startupCreating=true;
 try{
  await flush();P=await api('new-project',{example,title});segIndex=0;shotId=seg()?.shots[0]?.id||'';dirty=false;
  $('jobStatus').textContent='';$('instruction').value='';close();render();enterStartupWorkspace(example?'shots':'story');
  $('saved').textContent='项目已保存在本机';toast((example?'示例已就绪，可直接编辑':'空白项目已创建')+'；上一项目已自动备份');
 }finally{startupCreating=false}
}
function openStartupCreate(){if(!ready){toast('工作台正在加载，请稍候');return}modal('创建第一个项目',`<label>项目名称<input id="startupProjectName" maxlength="200" placeholder="例如：手机店短片"></label><p class="muted">从故事开始，素材与镜头可以稍后添加。${P?'当前项目会自动备份到本机。':''}</p>`,[{label:'取消',action:close},{label:'创建并进入总览 →',class:'primary',action:()=>createStartupProject(false,$('startupProjectName').value.trim())}]);$('startupProjectName').focus()}
$('startCreate').onclick=openStartupCreate;$('newProject').onclick=openStartupCreate;
$('startExample').onclick=()=>{if(!ready){toast('工作台正在加载，请稍候');return}if(P)modal('打开入门示例',`<p>示例「赛博修仙 v5」包含 2 张参考图、4 个片段、12 个镜头和 1 条已有视频；打开示例不调用 AI。当前项目「${esc(P.title)}」会自动备份；可以取消并继续原项目。</p>`,[{label:'取消',action:close},{label:'备份并打开示例',class:'primary',action:()=>createStartupProject(true)}]);else safe(()=>createStartupProject(true))};
$('startImport').onclick=()=>$('import').click();$('startResume').onclick=()=>enterStartupWorkspace();$('homeEntry').onclick=openStartupHome;$('startHelp').onclick=startupHelp;
function requireStartupAI(label,resume,vision=false,modelOverride=''){
 const a=cfg.ai||{},model=modelOverride||(vision?(a.visionModel||a.model):a.model);
 if(a.endpoint?.trim()&&model?.trim())return true;
 const pid=P?.projectId,sid=seg()?.id;
 modal('使用'+label+'，先选择 AI 连接',`<p class="notice">${vision?'这项功能需要能读取图片的视觉模型。':'这项功能需要文字模型。'}可以选择本地 Ollama 或兼容 API。</p><p>基础分镜仍可手动完成。已有配置会保存在本机，下次启动自动读取。</p>`,[{label:'先手动编辑',action:()=>{close();toast('继续手动规划即可，稍后可从 AI 连接设置配置模型。')}},{label:'设置 AI 连接',class:'primary',action:()=>settingsModal(async()=>{if(P?.projectId!==pid||seg()?.id!==sid)throw Error('项目或片段已切换，请重新点击原功能');await resume()},vision)}]);return false;
}
function startupHandoff(continueExport){
 if(!P){toast('先创建或导入项目');return}
 modal('保存项目，或交接给 H3 导演台',`<article class="startupHelpItem"><h3>保存工作台项目</h3><p>下载完整项目备份，包含故事、素材、分镜与片段视频。以后从首页导入，继续编辑。无需 AI 或 H3 导演台。</p></article><article class="startupHelpItem"><h3>H3 导演包交接</h3><p>适配 AI 搅拌手（AIMixer）H3 导演台。需自行安装 ComfyUI 节点、工作流和模型，并在该节点的「导入导演包」中打开。</p><small>素材与分镜准备不等于生成结果保证。</small></article>`,[{label:'取消',action:close},{label:'保存项目备份',action:async()=>{await flush();const project=structuredClone(P);const url=URL.createObjectURL(new Blob([JSON.stringify({format:'frame-project',version:1,project},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=(P.title.replace(/[\\/:*?"<>|]/g,'_')||'FRAME')+'.frame.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);close();toast('完整项目备份已下载，可从首页导入') }},{label:'继续导出 H3 导演包',class:'primary',action:async()=>{close();await continueExport()}}]);
}
const startupExportAction=$('export').onclick;$('export').onclick=()=>startupHandoff(startupExportAction);
const startupImportChange=$('packFile').onchange;
$('packFile').accept='.zip,.mmxpack,.frame,.json';
$('packFile').onchange=()=>safe(async()=>{
 const f=$('packFile').files[0];if(!f)return;
 if(!/\.(frame|json)$/i.test(f.name)){await startupImportChange();if(P&& !$('packFile').value)enterStartupWorkspace();return}
 try{const obj=JSON.parse(await f.text());if(obj.format!=='frame-project'||obj.version!==1||!obj.project)throw Error('请选择 FRAME 项目备份 (.frame / .frame.json) 或导演包 (.mmxpack.zip)');await flush();if(P&&!confirm('导入将替换当前项目，原项目会自动备份。继续吗？'))return;P=await api('import-project',{project:obj.project});dirty=false;segIndex=0;shotId=seg()?.shots[0]?.id||'';render();enterStartupWorkspace();toast('项目备份已导入')}finally{$('packFile').value=''}
});
if(ready)initStartup();
