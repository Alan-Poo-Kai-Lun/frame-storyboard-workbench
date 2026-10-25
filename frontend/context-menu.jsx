import React,{useState,useRef,useLayoutEffect} from 'react';

// Same interaction as the existing canvas quick menu: side-opening groups,
// flipped at the viewport edge, with keyboard return to the parent row.
export function ContextMenu({menu,groups,bounds,onClose,onError}){
 const [active,setActive]=useState(-1),[placement,setPlacement]=useState({left:218,top:0}),root=useRef(null),sub=useRef(null),rows=useRef([]);
 useLayoutEffect(()=>{if(active<0||!root.current||!sub.current)return;const r=root.current.getBoundingClientRect(),b=bounds(),row=rows.current[active].getBoundingClientRect(),s=sub.current.getBoundingClientRect();let left=r.width-4;if(r.right+s.width>b.right-8)left=-s.width+4;left=Math.max(b.left+8-r.left,Math.min(left,b.right-8-r.left-s.width));setPlacement({left,top:Math.max(b.top+8-r.top,Math.min(row.top-r.top,b.bottom-8-r.top-s.height))})},[active,menu]);
 const run=fn=>{onClose();try{fn()?.catch?.(onError)}catch(e){onError(e)}};
 return <div ref={root} className="rfa-context flow-quick-menu" role="menu" aria-label="画布快捷操作" style={{left:menu.x,top:menu.y}} onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose()}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const buttons=[...e.target.closest('[role=menu]').querySelectorAll(':scope > button')],i=buttons.indexOf(document.activeElement);buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()}}}>
  <small>画布快捷操作</small>
  {groups.map(([label,items],i)=><button key={label} ref={el=>rows.current[i]=el} role="menuitem" aria-label={label} aria-haspopup="menu" aria-expanded={active===i} onMouseEnter={()=>setActive(i)} onFocus={()=>setActive(i)} onClick={()=>setActive(i)} onKeyDown={e=>{if(e.key==='ArrowRight'){e.preventDefault();setActive(i);requestAnimationFrame(()=>sub.current?.querySelector('button')?.focus())}}}>{label}<span>›</span></button>)}
  {active>=0&&<div ref={sub} role="menu" aria-label={groups[active][0]} className="flow-quick-submenu" style={placement} onKeyDown={e=>{if(e.key==='ArrowLeft'){e.preventDefault();e.stopPropagation();rows.current[active]?.focus()}}}>{groups[active][1].map(([title,fn])=><button role="menuitem" key={title} onClick={()=>run(fn)}>{title}</button>)}</div>}
 </div>
}
