function releaseEditorBindings(root){for(const input of root.querySelectorAll('textarea,input')){input._mentionObserver?.disconnect();input._mentionStateObserver?.disconnect();input._promptResize?.disconnect()}}
/* Stable asset mentions and locally persisted workspace layout. */
function mentionAsset(n,context){return context==='group'?availableAssets()[n-1]:assetByNumber(n)}
function highlightMentions(text,context='workspace'){
  const source=String(text||'');let result='',last=0;
  for(const m of source.matchAll(/@?Picture\s*(\d+)\b/gi)){
    const a=mentionAsset(Number(m[1]),context),missing=!a||a.deleted;
    result+=esc(source.slice(last,m.index))+`<span class="mentionToken${missing?' missing':''}" data-ref-number="${Number(m[1])}" data-ref-context="${context}" data-ref-token="${esc(m[0])}" data-ref-start="${m.index}" data-ref-end="${m.index+m[0].length}" tabindex="0" data-ref-name="${esc(missing?'素材缺失':'@'+(a.name||'未命名素材'))}" aria-label="${esc(missing?'素材缺失':'@'+(a.name||'未命名素材'))}"><span class="mentionCanonical" aria-hidden="true">${esc(m[0])}</span><span class="mentionName">${esc(missing?'素材缺失':'@'+(a.name||'未命名素材'))}</span></span>`;last=m.index+m[0].length;
  }
  return result+esc(source.slice(last));
}
// Canonical textarea values remain @Picture N; the editing surface displays full name tokens.
function mentionPlainText(node){if(node.nodeType===3)return node.nodeValue;if(node.nodeType!==1&&node.nodeType!==11)return '';if(node.dataset?.refToken)return node.dataset.refToken;if(node.nodeName==='BR')return '\n';let text='';for(const child of node.childNodes){if(['DIV','P'].includes(child.nodeName)&&text&&!text.endsWith('\n'))text+='\n';text+=mentionPlainText(child)}return text}
function mentionEditorOffsets(mirror){const selection=getSelection();if(!selection?.rangeCount||!mirror.contains(selection.anchorNode))return null;const range=selection.getRangeAt(0),prefix=range.cloneRange();prefix.selectNodeContents(mirror);prefix.setEnd(range.startContainer,range.startOffset);const start=mentionPlainText(prefix.cloneContents()).length;prefix.setEnd(range.endContainer,range.endOffset);return [start,mentionPlainText(prefix.cloneContents()).length]}
function placeMentionCaret(mirror,offset){const range=document.createRange();let left=offset,placed=false;function visit(node){for(const child of node.childNodes){if(placed)return;if(child.dataset?.refToken){const length=child.dataset.refToken.length;if(left<=length){if(left===0)range.setStartBefore(child);else range.setStartAfter(child);placed=true;return}left-=length}else if(child.nodeType===3){if(left<=child.length){range.setStart(child,left);placed=true;return}left-=child.length}else visit(child)}}visit(mirror.firstElementChild||mirror);if(!placed){range.selectNodeContents(mirror);range.collapse(false)}else range.collapse(true);const selection=getSelection();selection.removeAllRanges();selection.addRange(range)}
function refreshMentionEditors(){
 for(const input of document.querySelectorAll('textarea,input')){
  if(!mentionFields.has(input.id)&&!input.matches('textarea[data-asset-field="description"]'))continue;
  if(!input._mentionMirror){
   const wrap=document.createElement('div'),mirror=document.createElement('div');wrap.className='mentionEditor';mirror.className='mentionMirror';mirror.contentEditable='true';mirror.setAttribute('role','textbox');mirror.setAttribute('aria-multiline',String(input.tagName==='TEXTAREA'));mirror.setAttribute('aria-label',input.getAttribute('aria-label')||input.labels?.[0]?.textContent||input.placeholder||'文字编辑');input.before(wrap);wrap.append(input,mirror);input.setAttribute('aria-hidden','true');input.tabIndex=-1;mirror.dataset.placeholder=input.placeholder||'';input._mentionMirror=mirror;mirror._mentionInput=input;let syncing=false,composing=false;
   const update=()=>{mirror.contentEditable=String(!input.disabled&&!input.readOnly);mirror.setAttribute('aria-disabled',String(input.disabled));const cs=getComputedStyle(input);for(const k of ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','paddingTop','paddingRight','paddingBottom','paddingLeft','textAlign'])mirror.style[k]=cs[k];mirror.style.top=(input.offsetTop+1)+'px';mirror.style.left=(input.offsetLeft+1)+'px';mirror.style.width=input.clientWidth+'px';mirror.style.height=input.clientHeight+'px';if(syncing||composing)return;const offsets=document.activeElement===mirror?mentionEditorOffsets(mirror):null;mirror.innerHTML='<div>'+highlightMentions(input.value,input.dataset.mentionContext==='project'?'workspace':'group')+'</div>';for(const token of mirror.querySelectorAll('[data-ref-token]'))token.contentEditable='false';if(offsets)placeMentionCaret(mirror,offsets[1]);mirror.scrollTop=input.scrollTop;mirror.scrollLeft=input.scrollLeft};
   input._mentionUpdate=update;input.addEventListener('input',update);input.addEventListener('scroll',()=>{if(document.activeElement!==mirror){mirror.scrollTop=input.scrollTop;mirror.scrollLeft=input.scrollLeft}});if(typeof ResizeObserver!=='undefined'){input._mentionObserver=new ResizeObserver(update);input._mentionObserver.observe(input)}input._mentionStateObserver=new MutationObserver(update);input._mentionStateObserver.observe(input,{attributes:true,attributeFilter:['disabled','readonly']});
   const sync=()=>{if(composing)return;const offsets=mentionEditorOffsets(mirror);syncing=true;try{input.value=mentionPlainText(mirror);if(offsets)input.setSelectionRange(...offsets);input.dispatchEvent(new Event('input',{bubbles:true}))}finally{syncing=false}};
   const insertText=text=>{const sel=getSelection();if(!sel?.rangeCount||!mirror.contains(sel.anchorNode))return;const range=sel.getRangeAt(0);range.deleteContents();const node=document.createTextNode(text);range.insertNode(node);range.setStartAfter(node);range.collapse(true);sel.removeAllRanges();sel.addRange(range);sync()};
   mirror.addEventListener('input',sync);mirror.addEventListener('compositionstart',()=>{composing=true;input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}))});mirror.addEventListener('compositionend',()=>{composing=false;sync();input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}))});
   mirror.addEventListener('beforeinput',e=>{if(e.inputType==='insertParagraph'||e.inputType==='insertLineBreak'){e.preventDefault();insertText('\n')}});
   for(const kind of ['copy','cut'])mirror.addEventListener(kind,e=>{const offsets=mentionEditorOffsets(mirror);if(!offsets||offsets[0]===offsets[1])return;e.preventDefault();e.clipboardData.setData('text/plain',input.value.slice(...offsets));if(kind==='cut'){const range=getSelection().getRangeAt(0);range.deleteContents();sync()}});
   mirror.addEventListener('paste',e=>{e.preventDefault();e.stopPropagation();insertText(e.clipboardData.getData('text/plain'))});
   mirror.addEventListener('keydown',e=>{if(e.isComposing)return;const offsets=mentionEditorOffsets(mirror);if(offsets)input.setSelectionRange(...offsets);if(!document.getElementById('assetMentions').hidden&&['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key)){e.preventDefault();e.stopPropagation();input.dispatchEvent(new KeyboardEvent('keydown',{key:e.key,bubbles:true,cancelable:true}))}});
   mirror.addEventListener('blur',()=>{sync();input.dispatchEvent(new Event('change',{bubbles:true}));input.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));input._mentionUpdate()});
   input.addEventListener('focus',()=>{mirror.classList.add('canonicalFocus')});input.addEventListener('blur',()=>mirror.classList.remove('canonicalFocus'));
   mirror.addEventListener('focus',()=>{mirror.classList.remove('canonicalFocus')});
   mirror.addEventListener('scroll',()=>{input.scrollTop=mirror.scrollTop;input.scrollLeft=mirror.scrollLeft});
  }
  input._mentionUpdate();
 }
}
let referencePreviewTimer;
const referenceTooltip=document.createElement('div');referenceTooltip.className='referenceTooltip';referenceTooltip.hidden=true;document.body.append(referenceTooltip);
function showReferenceTooltip(target){const a=mentionAsset(Number(target.dataset.refNumber),target.dataset.refContext);if(a&&!a.deleted){referenceTooltip.hidden=true;showMentionPreview(target,a)}else{hideMentionPreview();referenceTooltip.textContent='素材缺失';(target.closest('dialog')||document.body).append(referenceTooltip);referenceTooltip.hidden=false;const r=target.getBoundingClientRect();referenceTooltip.style.left=Math.max(8,r.left)+'px';referenceTooltip.style.top=r.bottom+6+'px'}}
document.addEventListener('pointerover',e=>{const target=e.target.closest('[data-ref-number]');if(target)showReferenceTooltip(target)});
document.addEventListener('pointerout',e=>{const target=e.target.closest('[data-ref-number]');if(target&&!target.contains(e.relatedTarget)&&!mentionPreviewCard.contains(e.relatedTarget)){referenceTooltip.hidden=true;mentionPreviewTimer=setTimeout(hideMentionPreview,160)}});
document.addEventListener('focusin',e=>{const target=e.target.closest('[data-ref-number]');if(target)showReferenceTooltip(target)});
document.addEventListener('focusout',e=>{if(e.target.closest('[data-ref-number]'))mentionPreviewTimer=setTimeout(hideMentionPreview,160)});
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
