/* Stable asset mentions and locally persisted workspace layout. */
function mentionAsset(n,context){return context==='group'?availableAssets()[n-1]:assetByNumber(n)}
function highlightMentions(text,context='workspace'){
  const source=String(text||'');let result='',last=0;
  for(const m of source.matchAll(/@?Picture\s*(\d+)\b/gi)){
    const a=mentionAsset(Number(m[1]),context),missing=!a||a.deleted;
    result+=esc(source.slice(last,m.index))+`<span class="mentionToken${missing?' missing':''}" data-ref-number="${Number(m[1])}" data-ref-context="${context}" data-ref-start="${m.index}" data-ref-end="${m.index+m[0].length}" tabindex="0" aria-label="${esc(m[0]+(missing?'，素材缺失':'，'+a.name))}">${esc(m[0])}</span>`;last=m.index+m[0].length;
  }
  return result+esc(source.slice(last));
}
function refreshMentionEditors(){
  for(const input of document.querySelectorAll('textarea,input')){
    if(!mentionFields.has(input.id)&&!input.matches('textarea[data-asset-field="description"]'))continue;
    if(!input._mentionMirror){
      const wrap=document.createElement('div'),mirror=document.createElement('div');wrap.className='mentionEditor';mirror.className='mentionMirror';mirror.setAttribute('aria-hidden','true');input.before(wrap);wrap.append(input,mirror);input._mentionMirror=mirror;
      const update=()=>{
        const cs=getComputedStyle(input);for(const k of ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','paddingTop','paddingRight','paddingBottom','paddingLeft','textAlign'])mirror.style[k]=cs[k];
        mirror.style.top=(input.offsetTop+1)+'px';mirror.style.left=(input.offsetLeft+1)+'px';mirror.style.width=input.clientWidth+'px';mirror.style.height=input.clientHeight+'px';
        mirror.innerHTML='<div>'+highlightMentions(input.value,'group')+'\n</div>';
        mirror.firstElementChild.style.transform=`translate(${-input.scrollLeft}px,${-input.scrollTop}px)`;
      };
      input._mentionUpdate=update;input.addEventListener('input',update);input.addEventListener('scroll',update);if(typeof ResizeObserver!=='undefined')new ResizeObserver(update).observe(input);
      mirror.addEventListener('mousedown',e=>{const t=e.target.closest('[data-ref-number]');if(t){e.preventDefault();input.focus();input.setSelectionRange(Number(t.dataset.refStart),Number(t.dataset.refEnd))}});
    }
    input._mentionUpdate();
  }
}
const referenceTooltip=document.createElement('div');referenceTooltip.className='referenceTooltip';referenceTooltip.hidden=true;referenceTooltip.setAttribute('role','tooltip');document.body.append(referenceTooltip);
function showReferenceTooltip(target){
  const a=mentionAsset(Number(target.dataset.refNumber),target.dataset.refContext),missing=!a||a.deleted;
  referenceTooltip.innerHTML=`${a&&!missing?imgTag(a.path):''}<div><b>Picture ${target.dataset.refNumber}${missing?' · 素材缺失':''}</b><p>${esc(a?.name||'未找到这个编号')}</p><small>${esc(a?.description|| (missing?'在素材区显示缺失素材后，恢复或替换原卡片。':'未填写具体说明'))}</small>${a?'<small>'+esc(a.kind+' · '+(a.scope==='segment'?'本组参考':'公共参考'))+'</small>':''}</div>`;
  (target.closest('dialog')||document.body).append(referenceTooltip);referenceTooltip.hidden=false;
  const r=target.getBoundingClientRect(),w=Math.min(360,window.innerWidth-24);referenceTooltip.style.width=w+'px';referenceTooltip.style.left=Math.max(8,Math.min(r.left,window.innerWidth-w-8))+'px';referenceTooltip.style.top=Math.max(8,Math.min(r.bottom+8,window.innerHeight-referenceTooltip.offsetHeight-8))+'px';
}
document.addEventListener('pointerover',e=>{const t=e.target.closest('[data-ref-number]');if(t)showReferenceTooltip(t)});
document.addEventListener('pointerout',e=>{if(e.target.closest('[data-ref-number]')&&!referenceTooltip.contains(e.relatedTarget))referenceTooltip.hidden=true});
document.addEventListener('focusin',e=>{const t=e.target.closest('[data-ref-number]');if(t)showReferenceTooltip(t)});
document.addEventListener('focusout',()=>referenceTooltip.hidden=true);
referenceTooltip.addEventListener('pointerleave',()=>referenceTooltip.hidden=true);
const layoutDefaults={left:320,right:380};let panelLayout={...layoutDefaults};
try{const stored=JSON.parse(localStorage.getItem('frame-layout')||'{}');for(const k of ['left','right'])if(Number.isFinite(stored[k]))panelLayout[k]=stored[k]}catch{}
function applyPanelLayout(save=true){
  const width=window.innerWidth;let left=Math.max(200,Math.min(800,panelLayout.left)),right=Math.max(240,Math.min(800,panelLayout.right));
  if(width>900){const extra=left+right+372-width;if(extra>0){const budget=width-372-440;left=200+Math.max(0,budget)*(left-200)/Math.max(1,left+right-440);right=width-372-left}}
  document.documentElement.style.setProperty('--panel-left',left+'px');document.documentElement.style.setProperty('--panel-right',right+'px');
  if(save)localStorage.setItem('frame-layout',JSON.stringify(panelLayout));
}
for(const [id,key,sign] of [['leftDivider','left',1],['rightDivider','right',-1]]){
  const handle=$(id);let drag;
  handle.title='拖动调整宽度；双击恢复默认；方向键微调';
  handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();drag={x:e.clientX,width:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--panel-'+key))};handle.setPointerCapture(e.pointerId);document.body.classList.add('resizingPanels')});
  handle.addEventListener('pointermove',e=>{if(!drag)return;panelLayout[key]=Math.max(key==='left'?200:240,Math.min(800,drag.width+(e.clientX-drag.x)*sign));applyPanelLayout()});
  const end=()=>{drag=null;document.body.classList.remove('resizingPanels');refreshMentionEditors()};handle.addEventListener('pointerup',end);handle.addEventListener('lostpointercapture',end);
  handle.addEventListener('dblclick',()=>{panelLayout[key]=layoutDefaults[key];applyPanelLayout()});
  handle.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();panelLayout[key]+=(e.key==='ArrowRight'?20:-20)*sign;applyPanelLayout()}});
}
$('layoutSettings').onclick=()=>{
  modal('调整工作台布局',`<p class="muted">拖动左右分界线调整面板宽度。弹窗右下角、文本框下边缘也可拖动调整大小。</p><label>素材面板宽度<input id="layoutLeft" type="range" min="200" max="800" value="${panelLayout.left}"></label><label>镜头编辑面板宽度<input id="layoutRight" type="range" min="240" max="800" value="${panelLayout.right}"></label>`,[{label:'恢复默认布局',action:()=>{panelLayout={...layoutDefaults};applyPanelLayout();close()}},{label:'完成',class:'primary',action:close}]);
  for(const [id,key] of [['layoutLeft','left'],['layoutRight','right']])$(id).oninput=()=>{panelLayout[key]=Number($(id).value);applyPanelLayout()};
};
window.addEventListener('resize',()=>applyPanelLayout(false));applyPanelLayout(false);refreshMentionEditors();

document.addEventListener('change',()=>refreshMentionEditors());
document.addEventListener('focusin',e=>{if(e.target._mentionUpdate)e.target._mentionUpdate()});
