let frameAssetCategoryCatalog=['人物','场景','道具','风格','未分类'];
function frameAssetCategoryOptions(value){return [...new Set([...frameAssetCategoryCatalog,...(P?.assets||[]).map(a=>a.kind),value].filter(Boolean))]}
(()=>{
 function hydrate(){for(const el of document.querySelectorAll('#canvas_kind,[data-asset-field="kind"],#creatorKind')){const value=el.value;el.innerHTML=frameAssetCategoryOptions(value).map(k=>`<option value="${esc(k)}">${esc(k)}</option>`).join('');el.value=value}window.frameI18n?.apply()}
 const original=api;api=async function(route,body,...rest){const result=await original(route,body,...rest);if(route==='asset-library'&&result?.categories){frameAssetCategoryCatalog=result.categories;
  if(body?.action==='category'&&P){const replacement=body.remove?'未分类':body.newName||body.name;for(const a of P.assets)if(a.kind===body.name){a.kind=replacement;delete a.confirmation}for(const el of document.querySelectorAll('#canvas_kind,[data-asset-field="kind"]'))if(el.value===body.name){el.innerHTML=frameAssetCategoryOptions(replacement).map(k=>`<option value="${esc(k)}">${esc(k)}</option>`).join('');el.value=replacement}}
  hydrate()}return result};
 const observer=new MutationObserver(()=>{for(const el of document.querySelectorAll('#canvas_kind,[data-asset-field="kind"]')){const signature=JSON.stringify(frameAssetCategoryOptions(el.value));if(el.dataset.categoryOptions!==signature){el.dataset.categoryOptions=signature;const value=el.value;el.innerHTML=frameAssetCategoryOptions(value).map(k=>`<option value="${esc(k)}">${esc(k)}</option>`).join('');el.value=value}}});observer.observe(document.body,{subtree:true,childList:true});
 const begin=()=>{if(!ready){setTimeout(begin,100);return}safe(async()=>{const result=await api('asset-library');frameAssetCategoryCatalog=result.categories;hydrate()})};begin();
})();
