/* Translation results are explicit copies; editing remains on the original prompt. */
async function queuePromptTranslation(segmentId){
 if(typeof requireStartupAI==='function'&&!requireStartupAI('提示词双语翻译',()=>queuePromptTranslation(segmentId)))return;
 await flush();const result=await api('prompt-translate',{projectId:P.projectId,segmentId});toast('双语翻译已加入任务中心');openTaskCenter();return result;
}
async function openPromptTranslations(segmentId=seg()?.id){
 if(!P||!segmentId)throw Error('请先选择片段');await flush();const pid=P.projectId,body={projectId:pid,segmentId},data=await api('prompt-translations',body);if(P?.projectId!==pid||!P.segments?.some(s=>s.id===segmentId))return;
 const versions=data.versions||{},texts={original:data.original,zh:versions.zh||'',en:versions.en||''};
 modal('最终提示词 · 中英双语',`<p class="notice">按需调用已配置的文字 AI。时间线、素材编号与对白原文保持不变；原文不会被翻译覆盖。翻译需人工核对。</p><p class="warning">${data.stale?'原文或素材已改变，旧翻译仅供查看，请重新翻译。':''}</p><label>查看版本<select id="promptLanguageView"><option value="original">原文</option><option value="zh">中文副本</option><option value="en">English copy</option></select></label><textarea id="translatedPromptText" rows="14" readonly data-user-content>${esc(texts.original)}</textarea><p>当前导演包导出语言：<b data-user-content>${esc({original:'原文',zh:'中文',en:'English'}[data.exportLanguage]||'原文')}</b></p><p id="translationError" role="alert"></p>`,[
 {label:'关闭',action:close},{label:'AI 生成中文与英文副本',action:()=>queuePromptTranslation(segmentId)},
 {label:'复制当前版本',action:async()=>{if(!$('translatedPromptText').value)throw Error('此版本尚未生成');await navigator.clipboard.writeText($('translatedPromptText').value);toast('已复制')}},
 {label:'设为导演包导出语言',class:'primary',action:async()=>{if(P?.projectId!==pid)throw Error('项目已切换');await flush();const r=await api('prompt-export-language',{...body,language:$('promptLanguageView').value});P=r.project;dirty=false;render();close();toast('导出语言已保存；原文未修改')}}]);
 $('promptLanguageView').onchange=()=>{$('translatedPromptText').value=texts[$('promptLanguageView').value]||''};
}
async function viewTranslationTask(id){
 const row=taskRows.find(r=>r.id===id);if(!row?.result)throw Error('翻译结果尚未完成');const result=row.result;
 modal('双语翻译预览',`<p class="notice">保存副本后可查看、复制或选择导演包导出语言。不会覆盖原文或自动替换镜头；请核对翻译含义。</p><label>中文副本<textarea rows="10" readonly data-user-content>${esc(result.zh)}</textarea></label><label>English copy<textarea rows="10" readonly data-user-content>${esc(result.en)}</textarea></label>`,[{label:'返回任务中心',action:openTaskCenter},{label:'保存双语副本',class:'primary',action:async()=>{if(P?.projectId!==row.projectId)throw Error('请先打开原项目');await flush();const r=await api('prompt-translation-save',{id,projectId:row.projectId,segmentId:row.segmentId});P=r.project;dirty=false;render();close();await openPromptTranslations(row.segmentId)}}]);taskCenterOpen=false;
}
(()=>{const button=document.createElement('button');button.id='bilingualPrompt';button.textContent='双语提示词';button.onclick=()=>safe(()=>openPromptTranslations());$('viewPrompt').after(button)})();
