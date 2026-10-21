const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<dialog open><div id="map"></div></dialog>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;const d=w.document.querySelector('dialog'),map=w.document.querySelector('#map');
const calls=[],frames=new Map();let id=0,style={spotlightGrid:true,nodeGlow:true,junctionPads:true,glassPanels:true,gridSize:28,highlight:'#38bdf8'};
const ctx={clearRect(){calls.push('clear')},setTransform(){},createRadialGradient(...args){calls.push(args);return {addColorStop(){}}},fillRect(){},beginPath(){},arc(){},fill(){}};
w.CanvasRenderingContext2D=function(){};w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.ResizeObserver=class{observe(){}disconnect(){}};w.matchMedia=()=>({matches:false,addEventListener(){}});w.requestAnimationFrame=fn=>{frames.set(++id,fn);return id};w.cancelAnimationFrame=n=>frames.delete(n);map.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:700});
w.eval(fs.readFileSync(require('node:path').join(__dirname,'../web/canvas-effects.js'),'utf8'));
let view={x:0,y:0,z:.5};const fx=w.createFrameCanvasEffects({dialog:d,map,appearance:()=>style,view:()=>view});
function tick(t){const work=[...frames];frames.clear();work.forEach(([,fn])=>fn(t))}
function move(target=map){target.dispatchEvent(new w.MouseEvent('pointermove',{clientX:400,clientY:300,bubbles:true}))}
try{move();tick(0);const first=calls.length;tick(16);assert.equal(calls.length,first,'capped at 30 FPS');tick(34);for(let t=68;t<1100;t+=34)tick(t);assert.equal(frames.size,0,'no idle RAF after fade settles');assert(calls.filter(Array.isArray).every(args=>args.at(-1)===150),'screen-space radius stays 150');
 view={x:20,y:10,z:2};d.dispatchEvent(new w.Event('canvasviewchange'));tick(1200);assert(calls.filter(Array.isArray).every(args=>args.at(-1)===150));
 const node=w.document.createElement('div');node.className='overviewNode';map.append(node);move(node);for(let t=1234;t<2400;t+=34)tick(t);assert.equal(frames.size,0,'hover over node fades and stops');
 style.reduceMotion=true;fx.sync();assert(map.querySelector('canvas').hidden);assert.equal(frames.size,0);assert.equal(d.dataset.reduceMotion,'true');fx.dispose();assert.equal(map.querySelector('canvas'),null);move();assert.equal(frames.size,0);
 console.log('PASS: 150 screen-pixel radius at two zooms, max 30 FPS, idle RAF stops, node-hover exclusion, reduced motion and full disposal');
}finally{w.close()}
