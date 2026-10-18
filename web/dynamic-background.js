/* A viewport-only decorative layer: never enters the project graph or hit testing. */
window.createFrameDynamicBackground=function({dialog,map,appearance,root}){
 const canvas=document.createElement('canvas');canvas.className='canvasDynamicBg';canvas.setAttribute('aria-hidden','true');map.prepend(canvas);
 let ctx=null;try{if(window.CanvasRenderingContext2D)ctx=canvas.getContext('2d')}catch(_){}
 let raf=0,last=-Infinity,phase=0,previous=null,movingUntil=0,disposed=false,width=0,height=0,dpr=1,color='#38bdf8',intensity=.08,particles=[];
 const motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 const allowed=()=>!disposed&&ctx&&dialog.open&&!document.hidden&&!motion?.matches&&appearance().enableDynamicBg===true&&Number(appearance().bgIntensity)>0;
 function stop(){if(raf)cancelAnimationFrame(raf);raf=0;previous=null;last=-Infinity}
 function clear(){ctx?.clearRect(0,0,width,height)}
 function resize(){const oldWidth=width,oldHeight=height,r=map.getBoundingClientRect();width=Math.max(0,r.width);height=Math.max(0,r.height);dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx?.setTransform(dpr,0,0,dpr,0,0);if(!width||!height)stop();else if(!particles.length)particles=Array.from({length:40},()=>({x:Math.random()*width,y:Math.random()*height,radius:Math.random()*1.5+.5,alpha:Math.random()*.4+.1,speed:Math.random()*.3+.1,angle:Math.random()*Math.PI*2}));else if(oldWidth&&oldHeight)for(const p of particles){p.x*=width/oldWidth;p.y*=height/oldHeight}}
 function tick(now){raf=0;if(!allowed())return;raf=requestAnimationFrame(tick);const moving=now<movingUntil||map.classList.contains('panning')||dialog.classList.contains('canvasInteracting');
  if(now-last<(moving?1000/10:1000/30))return;
  const elapsed=previous===null?0:Math.min(100,now-previous);previous=now;phase+=elapsed/1000;last=now;
  const node=root();if(!node||!width||!height){clear();return}
  const r=node.getBoundingClientRect(),v=map.getBoundingClientRect(),x=r.left+r.width/2-v.left,y=r.top+r.height/2-v.top;
  clear();const [red,green,blue]=color.slice(1).match(/../g).map(v=>parseInt(v,16)),rgba=alpha=>`rgba(${red},${green},${blue},${alpha})`;
  ctx.save();
  try{
   ctx.globalCompositeOperation='screen';
   // Broad, continuously feathered fields: no stroked circles or hard bands.
   const core=ctx.createRadialGradient(x,y,0,x,y,450);
   core.addColorStop(0,rgba(.12*intensity));core.addColorStop(.5,rgba(.03*intensity));core.addColorStop(1,rgba(0));
   ctx.fillStyle=core;ctx.beginPath();ctx.arc(x,y,450,0,Math.PI*2);ctx.fill();
   const timeSec=phase*.8;
   for(const cfg of [{baseR:120,maxR:380,offset:0},{baseR:180,maxR:520,offset:Math.PI}]){
    const progress=(Math.sin(timeSec+cfg.offset)+1)/2,radius=cfg.baseR+(cfg.maxR-cfg.baseR)*progress,waveWidth=70;
    const wave=ctx.createRadialGradient(x,y,Math.max(0,radius-waveWidth),x,y,radius+waveWidth);
    wave.addColorStop(0,rgba(0));wave.addColorStop(.5,rgba((1-progress*.6)*.22*intensity));wave.addColorStop(1,rgba(0));
    ctx.fillStyle=wave;ctx.beginPath();ctx.arc(x,y,radius+waveWidth,0,Math.PI*2);ctx.fill();
   }
   // Keep particles stable across frames and resizes. Skip updates during gestures.
   if(!moving)for(const p of particles){
    p.x=(p.x+Math.cos(p.angle)*p.speed*elapsed*.03+width)%width;
    p.y=(p.y+Math.sin(p.angle)*p.speed*elapsed*.03+height)%height;
    ctx.fillStyle=rgba(p.alpha*intensity*1.5);ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);ctx.fill();
   }
  }finally{ctx.restore()}

 }
 function sync(){const a=appearance(),n=Number(a.bgIntensity);intensity=Number.isFinite(n)?Math.max(0,Math.min(30,n))/100:.08;canvas.style.opacity='1';color=/^#[0-9a-f]{6}$/i.test(a.highlight||'')?a.highlight:'#38bdf8';if(allowed()){canvas.hidden=false;if(!raf){resize();if(width&&height)raf=requestAnimationFrame(tick)}}else{stop();clear();canvas.hidden=true}}
 const interacting=()=>{movingUntil=performance.now()+180};
 map.addEventListener('wheel',interacting,{passive:true});map.addEventListener('pointermove',interacting,{passive:true});
 document.addEventListener('visibilitychange',sync);motion?.addEventListener?.('change',sync);
 const observer=new MutationObserver(sync);observer.observe(dialog,{attributes:true,attributeFilter:['open','class']});
 const size=new ResizeObserver(()=>{resize();sync()});size.observe(map);sync();
 return {sync,dispose(){disposed=true;stop();observer.disconnect();size.disconnect();document.removeEventListener('visibilitychange',sync);motion?.removeEventListener?.('change',sync);map.removeEventListener('wheel',interacting);map.removeEventListener('pointermove',interacting);particles=[];canvas.remove()}};
};
