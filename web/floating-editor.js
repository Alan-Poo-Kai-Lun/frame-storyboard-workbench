/* One editor surface: docking moves the existing form, never copies its draft. */
(()=>{
 window.createFrameFloatingEditor=function({dialog,descriptor,select,save,node,align,settings}){
  const workspace=dialog.querySelector('.overviewWorkspace'),inspector=dialog.querySelector('.canvasInspector'),detail=dialog.querySelector('.overviewDetail');
  let mode='floating',geometry={},current=null,drag=null,closed=false,disposed=false;
  try{const pref=JSON.parse(localStorage.getItem('frame.editor.v1')||'{}');mode=pref.mode==='side'?'side':'floating';geometry=pref.geometry||{}}catch{}
  const panel=document.createElement('section');panel.className='canvasFloatingEditor';panel.setAttribute('aria-label','浮动节点编辑');panel.innerHTML='<header class="floatingEditorHandle"><strong data-floating-title data-user-content>节点编辑</strong><div class="floatingShotPager"><button type="button" data-floating-prev aria-label="上一镜">‹</button><span data-floating-count></span><button type="button" data-floating-next aria-label="下一镜">›</button></div><button type="button" data-floating-dock>右侧编辑</button><button type="button" data-floating-close aria-label="关闭编辑面板">×</button></header>';
  workspace.append(panel);
  const toggle=document.createElement('button');toggle.type='button';toggle.dataset.editorMode='';dialog.querySelector('.overviewToolbar').append(toggle);
  const settingsButton=document.createElement('button');settingsButton.type='button';settingsButton.textContent='画布设置';settingsButton.addEventListener('click',()=>safe(async()=>{if(await save(false))settings()}));dialog.querySelector('.overviewToolbar').append(settingsButton);
  const tether=document.createElement('div');tether.className='floatingEditorTether';workspace.append(tether);
  const persist=()=>{try{localStorage.setItem('frame.editor.v1',JSON.stringify({mode,geometry}))}catch{}};
  function clamp(){if(mode!=='floating')return;const w=workspace.clientWidth||window.innerWidth,h=workspace.clientHeight||window.innerHeight;if(w<640){panel.style.cssText='';return}const width=Math.min(w-20,Math.max(320,Number(geometry.width)||520)),height=Math.min(h-20,Math.max(230,Number(geometry.height)||Math.min(640,h-24)));panel.style.width=width+'px';panel.style.height=height+'px';panel.style.left=Math.max(10,Math.min(w-width-10,Number(geometry.left)||Math.max(10,w-width-28)))+'px';panel.style.top=Math.max(10,Math.min(h-height-10,Number(geometry.top)||20))+'px';}
  function connect(){tether.hidden=mode!=='floating'||closed||!current;const target=current&&node(current.id);if(!target||target.hidden||!target.isConnected){tether.hidden=true;return}const n=target.getBoundingClientRect(),p=panel.getBoundingClientRect(),w=workspace.getBoundingClientRect(),map=dialog.querySelector('.overviewMap').getBoundingClientRect();if(n.right<map.left||n.left>map.right||n.bottom<map.top||n.top>map.bottom){tether.hidden=true;return}const x=n.left+n.width/2-w.left,y=n.top+n.height/2-w.top,dx=p.left-w.left-x,dy=p.top+28-w.top-y;tether.style.left=x+'px';tether.style.top=y+'px';tether.style.width=Math.hypot(dx,dy)+'px';tether.style.transform='rotate('+Math.atan2(dy,dx)+'rad)';}
  function apply(){dialog.classList.toggle('floatingEditorMode',mode==='floating');panel.hidden=mode!=='floating'||closed;toggle.textContent=mode==='floating'?'编辑方式 · 浮动':'编辑方式 · 右侧';toggle.setAttribute('aria-pressed',String(mode==='floating'));if(mode==='floating'){panel.append(detail);detail.hidden=false;}else{inspector.insertBefore(detail,inspector.querySelector('.canvasAssetLibrary'));detail.hidden=false;}clamp();connect();}
  async function changeMode(){if(!await save(false))return;mode=mode==='floating'?'side':'floating';closed=false;apply();persist();}
  async function move(delta){if(current?.kind!=='shot')return;const s=current.segment,i=s.shots.indexOf(current.item),next=s.shots[i+delta];if(next)await select('h:'+s.id+':'+next.id);}
  toggle.addEventListener('click',()=>safe(changeMode));panel.querySelector('[data-floating-dock]').addEventListener('click',()=>safe(changeMode));
  panel.querySelector('[data-floating-close]').addEventListener('click',()=>safe(async()=>{if(!await save(false))return;closed=true;panel.hidden=true;tether.hidden=true;hideMentions();}));
  panel.querySelector('[data-floating-prev]').addEventListener('click',()=>safe(()=>move(-1)));panel.querySelector('[data-floating-next]').addEventListener('click',()=>safe(()=>move(1)));
  function keys(e){if(mode!=='floating'||panel.hidden||current?.kind!=='shot'||!e.ctrlKey||!['ArrowLeft','ArrowRight'].includes(e.key)||e.isComposing)return;e.preventDefault();e.stopPropagation();safe(()=>move(e.key==='ArrowRight'?1:-1));}
  dialog.addEventListener('keydown',keys,true);
  const handle=panel.querySelector('.floatingEditorHandle');
  handle.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button')||workspace.clientWidth<640)return;const p=panel.getBoundingClientRect(),w=workspace.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:p.left-w.left,top:p.top-w.top};handle.setPointerCapture(e.pointerId);e.preventDefault();hideMentions();});
  handle.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const w=workspace.clientWidth,h=workspace.clientHeight;panel.style.left=Math.max(0,Math.min(w-panel.offsetWidth,drag.left+e.clientX-drag.x))+'px';panel.style.top=Math.max(0,Math.min(h-48,drag.top+e.clientY-drag.y))+'px';connect();});
  function remember(){if(mode!=='floating'||workspace.clientWidth<640)return;geometry={left:parseFloat(panel.style.left)||0,top:parseFloat(panel.style.top)||0,width:panel.offsetWidth,height:panel.offsetHeight};persist();}
  function endDrag(){if(!drag)return;drag=null;remember();clamp();connect();}
  handle.addEventListener('pointerup',endDrag);handle.addEventListener('pointercancel',endDrag);handle.addEventListener('lostpointercapture',endDrag);
  panel.addEventListener('pointerup',remember);
  function resize(){if(disposed)return;clamp();connect()}
  window.addEventListener('resize',resize);
  const ro=new ResizeObserver(()=>{if(!disposed)connect()});ro.observe(panel);
  const mo=new MutationObserver(()=>{if(!disposed)connect()});mo.observe(dialog.querySelector('.overviewGraph'),{subtree:true,attributes:true,attributeFilter:['style']});
  function selected(d){current=d;closed=false;panel.querySelector('[data-floating-title]').textContent=d.title;const pager=panel.querySelector('.floatingShotPager');pager.hidden=d.kind!=='shot';if(d.kind==='shot'){const i=d.segment.shots.indexOf(d.item);panel.querySelector('[data-floating-count]').textContent=(i+1)+' / '+d.segment.shots.length;panel.querySelector('[data-floating-prev]').disabled=i<=0;panel.querySelector('[data-floating-next]').disabled=i>=d.segment.shots.length-1;enhanceShot(d);}apply();}
  function enhanceShot(d){
   const start=detail.querySelector('#canvas_start'),end=detail.querySelector('#canvas_end');if(!start||!end)return;
   const duration=document.createElement('small');duration.className='floatingShotDuration';duration.setAttribute('aria-live','polite');detail.querySelector('.canvasTimeRow').after(duration);
   const suggest=document.createElement('div');suggest.className='floatingTimeSuggestion';const message=document.createElement('span'),button=document.createElement('button');button.type='button';button.textContent='对齐下一镜开始时间';suggest.append(message,button);duration.after(suggest);
   function calculate(){const a=Number(start.value),b=Number(end.value),valid=start.value!==''&&end.value!==''&&Number.isFinite(a)&&Number.isFinite(b)&&a>=0&&b>a&&b<=d.segment.duration;duration.textContent=valid?'共 '+Number((b-a).toFixed(3))+' 秒':'开始须小于结束，且不能超出本段 '+d.segment.duration+' 秒';duration.classList.toggle('error',!valid);const next=d.segment.shots[d.segment.shots.indexOf(d.item)+1];suggest.hidden=!valid||!next||Number(next.start)===b;if(next&&!suggest.hidden){message.textContent='下一镜当前从 '+next.start+' 秒开始';button.disabled=b>=Number(next.end);if(button.disabled)message.textContent+='；当前结束已达到下一镜末尾，无法对齐';}}
   start.addEventListener('input',calculate);end.addEventListener('input',calculate);calculate();
   button.addEventListener('click',()=>safe(async()=>{if(!await save(false))return;const fresh=descriptor(d.id);if(fresh){await align(fresh);calculate();}}));
   const action=detail.querySelector('#canvas_action');if(action){const hint=document.createElement('small');hint.textContent='输入 @ 选择本片段素材；↑ ↓ 选择，Enter 插入，Esc 关闭。';action.after(hint);}
  }
  apply();
  return {selected,connect,reopen(){closed=false;apply()},showSettings(){if(mode==='floating'){inspector.hidden=false;inspector.inert=false;dialog.classList.add('floatingShowInspector')}},hideSettings(){dialog.classList.remove('floatingShowInspector')},dispose(){disposed=true;window.removeEventListener('resize',resize);dialog.removeEventListener('keydown',keys,true);ro.disconnect();mo.disconnect();}};
 };
})();
