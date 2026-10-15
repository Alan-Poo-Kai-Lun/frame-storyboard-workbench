/* Pure settings markup and SVG geometry; no project copies or alternate media store. */
function frameCanvasSettings(a,asset){
 const slider=(key,label,min,max,fallback,step=1)=>{const n=Number(a[key]),value=Number.isFinite(n)&&n>=min&&n<=max?n:fallback;return `<label class="inspectorSlider" for="canvas-style-${key}">${label}<output data-value="${key}">${value}${key==='arrowSpeed'?'×':' px'}</output><input id="canvas-style-${key}" type="range" data-appearance-number="${key}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`};
 const color=(key,label,fallback)=>`<label class="inspectorColor">${label}<input type="color" data-appearance-color="${key}" value="${/^#[0-9a-f]{6}$/i.test(a[key]||'')?a[key]:fallback}"></label>`;
 const select=(key,label,options,fallback)=>`<label>${label}<select data-appearance-select="${key}">${options.map(([v,t])=>`<option value="${v}" ${v===(a[key]||fallback)?'selected':''}>${t}</option>`).join('')}</select></label>`;
 const check=(key,label,fallback)=>`<label class="checkrow"><input type="checkbox" data-appearance-check="${key}" ${(a[key]??fallback)?'checked':''}>${label}</label>`;
 const dark=document.documentElement.dataset.theme==='dark';
 return `<h2>字体、素材与连线</h2><p class="muted">即时预览，随项目自动保存。</p><details open><summary>项目根节点</summary>${select('projectShape','根节点形状',[['circle','圆形'],['rounded','圆角矩形'],['square','方形'],['diamond','菱形'],['hexagon','六边形'],['chamfer','科技切角框']],'circle')}</details><details open><summary>文字与素材</summary>${slider('titleSize','标题字号',10,48,16)}${slider('bodySize','正文字号',10,36,15)}${slider('captionSize','辅助字号',9,28,12)}<div class="inspectorPair">${color('titleColor','标题颜色',dark?'#e2eff4':'#263b49')}${color('bodyColor','正文颜色',dark?'#aec7d2':'#607786')}</div>${color('captionColor','辅助颜色',dark?'#91aebb':'#607786')}<p class="muted">${asset?'当前素材：'+esc(asset.title):'选择一个素材节点后调整它的宽高；不会修改其他节点。'}</p>${['w','h'].map((key,i)=>`<label class="inspectorSlider" for="canvas-asset-size-${key}">素材节点${i?'高度':'宽度'}<output data-size-value="${key}">${asset?.[key]||'—'}${asset?' px':''}</output><input id="canvas-asset-size-${key}" type="range" data-asset-size="${key}" min="${i?70:100}" max="1200" value="${asset?.[key]||(i?195:210)}" ${asset?'':'disabled'}></label>`).join('')}${select('imageFit','图片显示',[['contain','完整显示 · 保持比例'],['cover','填满 · 裁剪边缘']],'contain')}</details><details open><summary>连线与箭头</summary>${select('lineStyle','走线形态',[['default','原有默认'],['pcb','PCB · 45°切角'],['orthogonal','直角线'],['straight','直线'],['curve','曲线'],['hidden','隐藏连线']],'pcb')}${select('lineEffect','光效',[['none','简洁实线'],['pulse','流光粒子脉冲'],['dual','双轨数据总线'],['neon','霓虹光晕']],'none')}${check('hierarchy','主干 / 分支层级样式',true)}<div class="inspectorPair">${color('lineColor','连线颜色','#33dec1')}${color('arrowColor','箭头颜色','#33dec1')}</div>${select('arrowType','箭头 / 端点',[['chevron2','双重 HUD 游标'],['chevron3','三重 HUD 游标'],['diamond','空心菱形'],['crosshair','十字准星'],['chiseled','斜切尖端'],['pulse','脉冲圆环'],['filled','实心三角'],['open','空心箭头'],['dot','圆点'],['none','无箭头']],'chevron2')}<small>层级样式开启时，主干使用 HUD 游标，素材分支使用菱形；关闭后统一使用所选端点。</small>${slider('arrowSpeed','流动速度',.1,5,1,.1)}${check('flow','启用流动动画',true)}${check('pins','显示焊盘与卡片接口',true)}</details><details open><summary>背景与高亮</summary><div class="inspectorPair">${color('background','背景',dark?'#10212c':'#eaf0f3')}${color('node','节点',dark?'#12384d':'#f5f9fa')}${color('highlight','高亮','#33dec1')}${color('grid','网格',dark?'#2b424e':'#d4dfe4')}</div>${select('pattern','背景样式',[['dots','点阵'],['lines','方格'],['none','纯色']],'dots')}${slider('gridSize','格子大小',8,160,28)}</details><button type="button" data-reset-appearance>恢复默认外观</button>`;
}
window.frameCanvasEdge={
 shape(type,terminal=false){
  const x=terminal?7:0;
  if(type==='chevron2'||type==='chevron3')return Array.from({length:type==='chevron3'?3:2},(_,i)=>`<polyline points="${x-5-i*5},-4 ${x-i*5},0 ${x-5-i*5},4" fill="none" stroke-width="1.4"/>`).join('');
  return ({diamond:`<polygon points="${x},-4 ${x+4},0 ${x},4 ${x-4},0" fill="none"/>`,crosshair:`<polyline points="${x-5},0 ${x+5},0"/><polyline points="${x},-5 ${x},5"/>`,chiseled:`<polygon points="${x-6},-3 ${x+3},0 ${x},3 ${x-6},3"/>`,pulse:`<circle cx="${x}" r="5" opacity=".3"/><circle cx="${x}" r="2"/>`,dot:`<circle cx="${x}" r="3"/>`,open:`<polyline points="${x-5},-4 ${x+1},0 ${x-5},4" fill="none" stroke-width="1.5"/>`})[type]||`<polygon points="${x-5},-4 ${x+3},0 ${x-5},4"/>`;
 },
 path(style,x1,y1,x2,y2,vertical=false){
  if(style==='straight')return `M${x1},${y1} L${x2},${y2}`;
  const points=vertical?[[x1,y1],[x1,(y1+y2)/2],[x2,(y1+y2)/2],[x2,y2]]:[[x1,y1],[(x1+x2)/2,y1],[(x1+x2)/2,y2],[x2,y2]];
  if(style==='orthogonal')return 'M'+points.map(p=>p.join(',')).join(' L');
  if(style==='pcb'){
   let d=`M${x1},${y1}`;
   for(let i=1;i<points.length-1;i++){const p=points[i],before=points[i-1],after=points[i+1],a=Math.hypot(p[0]-before[0],p[1]-before[1]),b=Math.hypot(p[0]-after[0],p[1]-after[1]),r=Math.min(14,a/2,b/2);if(!a||!b){d+=` L${p}`;continue}d+=` L${p[0]+(before[0]-p[0])*r/a},${p[1]+(before[1]-p[1])*r/a} L${p[0]+(after[0]-p[0])*r/b},${p[1]+(after[1]-p[1])*r/b}`}
   return d+` L${x2},${y2}`;
  }
  const bend=(x2>=x1?1:-1)*Math.max(60,Math.abs(x2-x1)*.5);return `M${x1},${y1} C${x1+bend},${y1} ${x2-bend},${y2} ${x2},${y2}`;
 }
};

function frameProjectShapeSvg(){
 const paths={circle:'M50 2 A48 48 0 1 1 49.99 2 Z',rounded:'M16 2 H84 Q98 2 98 16 V84 Q98 98 84 98 H16 Q2 98 2 84 V16 Q2 2 16 2 Z',square:'M2 2 H98 V98 H2 Z',diamond:'M50 2 L98 50 L50 98 L2 50 Z',hexagon:'M25 2 H75 L98 50 L75 98 H25 L2 50 Z',chamfer:'M14 2 H86 L98 14 V86 L86 98 H14 L2 86 V14 Z'};
 return '<svg class="projectShapeSvg" viewBox="0 0 100 100" aria-hidden="true">'+Object.entries(paths).map(([key,d])=>'<g data-project-shape="'+key+'"><path class="rootShape" d="'+d+'"/>'+[1,2,3].map(i=>'<path class="rootShapeRipple r'+i+'" d="'+d+'"/>').join('')+'</g>').join('')+'</svg>';
}
