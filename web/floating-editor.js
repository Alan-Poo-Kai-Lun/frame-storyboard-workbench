/* One editor surface: docking moves the existing form, never copies its draft. */
(()=>{
 window.createFrameFloatingEditor=function({dialog,descriptor,select,save,node,align,settings}){
  const workspace=dialog.querySelector('.overviewWorkspace'),inspector=dialog.querySelector('.canvasInspector'),detail=dialog.querySelector('.overviewDetail');
  let mode='floating',geometry={},current=null,drag=null,closed=false,disposed=false;
  try{const pref=JSON.parse(localStorage.getItem('frame.editor.v1')||'{}');mode=pref.mode==='side'?'side':'floating';geometry=pref.geometry||{}}catch{}
  const panel=document.createElement('section');panel.className='canvasFloatingEditor';panel.setAttribute('aria-label','浮动节点编辑');panel.innerHTML='<header class="floatingEditorHandle"><strong data-floating-title data-user-content>节点编辑</strong><div class="floatingShotPager"><button type="button" data-floating-prev aria-label="上一镜">‹</button><span data-floating-count></span><button type="button" data-floating-next aria-label="下一镜">›</button></div><button type="button" data-floating-dock>右侧编辑</button><button type="button" data-floating-close aria-label="关闭编辑面板">×</button></header>';
  workspace.append(panel);
  const toggle=document.createElement('button');toggle.type='button';toggle.dataset.editorMode='';toggle.hidden=true;
  panel.querySelector('[data-floating-dock]').hidden=true;
  panel.append(inspector);panel.classList.add('unifiedEditorPanel');
  const docking=dialog._frameDocking||(dialog._frameDocking=frameDocking.create(dialog));
  const tether=document.createElement('div');tether.className='floatingEditorTether';tether.hidden=true;workspace.append(tether);
  const persist=()=>{};function connect(){const target=current&&node(current.id);tether.hidden=controller?.mode()!=='floating'||!target||target.hidden||!target.isConnected;if(tether.hidden)return;const n=target.getBoundingClientRect(),p=panel.getBoundingClientRect(),w=workspace.getBoundingClientRect(),x=n.left+n.width/2-w.left,y=n.top+n.height/2-w.top,dx=p.left-w.left-x,dy=p.top+25-w.top-y;tether.style.left=x+'px';tether.style.top=y+'px';tether.style.width=Math.hypot(dx,dy)+'px';tether.style.transform='rotate('+Math.atan2(dy,dx)+'rad)'}
  const controller=docking.register({key:'editor',panel,handle:panel.querySelector('.floatingEditorHandle'),label:'属性',defaultMode:mode==='side'?'right':'floating',before:()=>save(false),onMode:value=>{mode=value==='floating'?'floating':'side';dialog.classList.toggle('floatingEditorMode',mode==='floating')}});
  function apply(){panel.hidden=closed;connect()}
  async function changeMode(){await controller.set(controller.mode()==='floating'?'right':'floating')}
  async function move(delta){if(current?.kind!=='shot')return;const s=current.segment,i=s.shots.indexOf(current.item),next=s.shots[i+delta];if(next)await select('h:'+s.id+':'+next.id)}
  panel.querySelector('[data-floating-close]').addEventListener('click',()=>safe(async()=>{if(!await save(false))return;if(controller.mode()==='floating'){await controller.set('right');controller.collapse()}else controller.collapse();hideMentions()}));
  panel.querySelector('[data-floating-prev]').addEventListener('click',()=>safe(()=>move(-1)));panel.querySelector('[data-floating-next]').addEventListener('click',()=>safe(()=>move(1)));
  function keys(e){if(panel.hidden||current?.kind!=='shot'||!e.ctrlKey||!['ArrowLeft','ArrowRight'].includes(e.key)||e.isComposing)return;e.preventDefault();e.stopPropagation();safe(()=>move(e.key==='ArrowRight'?1:-1))}dialog.addEventListener('keydown',keys,true);
  const ro=new ResizeObserver(()=>connect());ro.observe(panel);const mo=new MutationObserver(()=>connect());mo.observe(dialog.querySelector('.overviewGraph'),{subtree:true,attributes:true,attributeFilter:['style']});
  function selected(d){const changed=!!current&&current.id!==d.id;current=d;closed=false;if(changed)controller.open();panel.querySelector('[data-floating-title]').textContent=d.title;const pager=panel.querySelector('.floatingShotPager');pager.hidden=d.kind!=='shot';if(d.kind==='shot'){const i=d.segment.shots.indexOf(d.item);panel.querySelector('[data-floating-count]').textContent=(i+1)+' / '+d.segment.shots.length;panel.querySelector('[data-floating-prev]').disabled=i<=0;panel.querySelector('[data-floating-next]').disabled=i>=d.segment.shots.length-1;enhanceShot(d)}apply()}
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
  return {selected,connect,reopen(){closed=false;controller.open();apply()},showSettings(){controller.open()},hideSettings(){},collapse(){controller.collapse()},dispose(){disposed=true;dialog.removeEventListener('keydown',keys,true);ro.disconnect();mo.disconnect();controller.dispose();}};
 };
})();
