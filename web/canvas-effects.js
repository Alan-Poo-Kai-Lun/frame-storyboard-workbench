/* Event-driven 180 screen-pixel spotlight. Static grid and graph stay untouched. */
window.createFrameCanvasEffects=function(o){
 const {dialog,map}=o,abort=new AbortController(),signal=abort.signal,motion=matchMedia('(prefers-reduced-motion: reduce)');
 const canvas=document.createElement('canvas');canvas.className='canvasSpotlight';canvas.setAttribute('aria-hidden','true');map.prepend(canvas);
 let ctx=null;try{if(window.CanvasRenderingContext2D)ctx=canvas.getContext('2d')}catch{}
 let rect={left:0,top:0,width:0,height:0},raf=0,last=-Infinity,opacity=0,disposed=false,mouse={x:0,y:0,inside:false},style={},accent='56,189,248';
 const quiet=()=>motion.matches||style.reduceMotion===true;
 const allowed=()=>!disposed&&ctx&&dialog.open&&!document.hidden&&!quiet()&&style.spotlightGrid===true;
 const moving=()=>dialog.classList.contains('canvasInteracting')||map.classList.contains('panning');
 function stop(){if(raf)cancelAnimationFrame(raf);raf=0;last=-Infinity}
 function clear(){ctx?.clearRect(0,0,rect.width,rect.height)}
 function request(){if(!raf&&allowed())raf=requestAnimationFrame(draw)}
 function resize(){rect=map.getBoundingClientRect();const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.ceil(rect.width*dpr);canvas.height=Math.ceil(rect.height*dpr);ctx?.setTransform(dpr,0,0,dpr,0,0);request()}
 function sync(){style=o.appearance();const color=/^#[0-9a-f]{6}$/i.test(style.highlight||'')?style.highlight:'#38bdf8';accent=color.slice(1).match(/../g).map(v=>parseInt(v,16)).join(',');dialog.style.setProperty('--canvas-glow-rgb',accent);dialog.dataset.nodeGlow=String(style.nodeGlow===true);dialog.dataset.glassPanels=String(style.glassPanels===true);dialog.dataset.junctionPads=String(style.junctionPads===true&&style.pins!==false);dialog.dataset.reduceMotion=String(quiet());dialog.dataset.effectsPaused=String(document.hidden);canvas.hidden=!allowed();if(!allowed()){stop();opacity=0;clear()}else request()}
 function draw(now){raf=0;if(!allowed())return;if(now-last<1000/30){request();return}last=now;
  const target=mouse.inside&&!moving()?1:0;opacity+=(target-opacity)*.24;if(Math.abs(target-opacity)<.01)opacity=target;clear();
  if(opacity>0){const v=o.view(),step=Math.max(8,(style.gridSize||28)*v.z),radius=180,ox=((v.x%step)+step)%step,oy=((v.y%step)+step)%step,x=mouse.x,y=mouse.y;
   const fade=ctx.createRadialGradient(x,y,0,x,y,radius);fade.addColorStop(0,`rgba(${accent},${opacity*.045})`);fade.addColorStop(1,`rgba(${accent},0)`);ctx.fillStyle=fade;ctx.fillRect(Math.max(0,x-radius),Math.max(0,y-radius),radius*2,radius*2);
   if(style.pattern!=='none')for(let px=ox+Math.ceil((x-radius-ox)/step)*step;px<Math.min(rect.width,x+radius);px+=step)for(let py=oy+Math.ceil((y-radius-oy)/step)*step;py<Math.min(rect.height,y+radius);py+=step){if(px<0||py<0)continue;const distance=Math.hypot(px-x,py-y);if(distance>=radius)continue;ctx.fillStyle=`rgba(${accent},${opacity*.5*(1-distance/radius)**2})`;ctx.beginPath();ctx.arc(px,py,1.1,0,Math.PI*2);ctx.fill()}
  }
  if(opacity!==target)request();
 }
 map.addEventListener('pointermove',e=>{mouse={x:e.clientX-rect.left,y:e.clientY-rect.top,inside:!e.target.closest('.overviewNode,.nodeInspectorDrawer,.canvasControls,.frameAgentProject,.frameAgentNode,button,input,textarea,[contenteditable]')};request()},{signal,passive:true});
 map.addEventListener('pointerleave',()=>{mouse.inside=false;request()},{signal});
 dialog.addEventListener('canvasviewchange',request,{signal});
 document.addEventListener('visibilitychange',sync,{signal});motion.addEventListener('change',sync,{signal});
 const observer=new MutationObserver(sync);observer.observe(dialog,{attributes:true,attributeFilter:['class','open']});
 const size=new ResizeObserver(resize);size.observe(map);resize();sync();
 return {sync,dispose(){disposed=true;stop();abort.abort();observer.disconnect();size.disconnect();clear();canvas.remove()}};
};
