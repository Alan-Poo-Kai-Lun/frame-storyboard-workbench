/* Pure settings markup and SVG geometry; no project copies or alternate media store. */
function frameThemeSection(a){
 const theme=window.frameTheme?.resolve(a.theme)||{preset:'aurora',particles:{style:'stardust',count:140,speed:1,opacity:.55},backdrop:{dim:.35,vignette:.35,url:''}};
 const presets=window.frameTheme?.PRESETS||[];
 const styles=window.frameTheme?.PARTICLE_LABELS||[];
 const backdrops=window.frameTheme?.backdrops?.()||[];
 const current=theme.backdrop.url||'';
 const options=[['','无 · 用主题渐变']].concat(backdrops.map(row=>[row.url,(row.type==='video'?'视频 · ':'图片 · ')+row.name]));
 if(current&&!options.some(([value])=>value===current))options.push([current,'当前底片']);
 const num=(group,key,label,min,max,step=1,unit='')=>`<label class="inspectorSlider">${label}<output data-theme-value="${group}.${key}">${theme[group][key]}${unit}</output><input type="range" data-theme-field="${group}.${key}" min="${min}" max="${max}" step="${step}" value="${theme[group][key]}"></label>`;
 return `<section class="canvasThemeSection"><h3>动态主题</h3>
 <p class="muted">底片 + 氛围 + 材质。切换会交叉叠化，不硬切。</p>
 <div class="themePresetGrid">${presets.map(item=>`<button type="button" data-theme-preset="${item.id}" aria-pressed="${item.id===theme.preset}"><strong>${item.name}</strong><small>${item.hint}</small></button>`).join('')}</div>
 <details><summary>底片与氛围微调</summary>
 <label>底片素材<select data-theme-field="backdrop.url">${options.map(([value,label])=>`<option value="${esc(value)}" ${value===current?'selected':''}>${esc(label)}</option>`).join('')}</select></label>
 <div class="canvasActionRow"><button type="button" data-theme-backdrop-upload>从本地选择图片 / 视频</button><button type="button" data-theme-backdrop-clear ${current?'':'disabled'}>清除底片</button></div>
 <small>底片存在全局底片库，所有项目都能选；单文件上限 60MB。</small>
 <label>粒子<select data-theme-field="particles.style">${styles.map(([value,label])=>`<option value="${value}" ${value===theme.particles.style?'selected':''}>${label}</option>`).join('')}</select></label>
 ${num('particles','count','粒子密度',0,220,5,' 颗')}
 ${num('particles','speed','运动速度',0.2,3,0.1,'×')}
 ${num('particles','opacity','粒子浓度',0,0.7,0.05)}
 ${num('backdrop','dim','底片压暗',0,0.85,0.05)}
 ${num('backdrop','vignette','暗角',0,0.85,0.05)}
 </details></section>`;
}

function frameCanvasSettings(a,asset){
 const slider=(key,label,min,max,fallback,step=1)=>{const n=Number(a[key]),value=Number.isFinite(n)&&n>=min&&n<=max?n:fallback;return `<label class="inspectorSlider" for="canvas-style-${key}">${label}<output data-value="${key}">${value}${key==='arrowSpeed'?'×':' px'}</output><input id="canvas-style-${key}" type="range" data-appearance-number="${key}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`};
 const color=(key,label,fallback)=>`<label class="inspectorColor">${label}<input type="color" data-appearance-color="${key}" value="${/^#[0-9a-f]{6}$/i.test(a[key]||'')?a[key]:fallback}"></label>`;
 const select=(key,label,options,fallback)=>`<label>${label}<select data-appearance-select="${key}">${options.map(([v,t])=>`<option value="${v}" ${v===(a[key]||fallback)?'selected':''}>${t}</option>`).join('')}</select></label>`;
 const check=(key,label,fallback)=>`<label class="checkrow"><input type="checkbox" data-appearance-check="${key}" ${(a[key]??fallback)?'checked':''}>${label}</label>`;
 const dark=document.documentElement.dataset.theme==='dark';
 return `<h2>字体、素材与连线</h2><p class="muted">即时预览，随项目自动保存。日间与夜间配色分别保留。</p>${frameThemeSection(a)}<details open><summary>文字与素材</summary>${slider('titleSize','标题字号',10,48,16)}${slider('bodySize','正文字号',10,36,15)}${slider('captionSize','辅助字号',9,28,12)}<div class="inspectorPair">${color('titleColor','标题颜色',dark?'#e2eff4':'#263b49')}${color('bodyColor','正文颜色',dark?'#aec7d2':'#607786')}</div>${color('captionColor','辅助颜色',dark?'#91aebb':'#607786')}<p class="muted">${asset?'当前素材：'+esc(asset.title):'选择一个素材节点后调整它的宽高；不会修改其他节点。'}</p>${['w','h'].map((key,i)=>`<label class="inspectorSlider" for="canvas-asset-size-${key}">素材节点${i?'高度':'宽度'}<output data-size-value="${key}">${asset?.[key]||'—'}${asset?' px':''}</output><input id="canvas-asset-size-${key}" type="range" data-asset-size="${key}" min="${i?70:100}" max="1200" value="${asset?.[key]||(i?195:210)}" ${asset?'':'disabled'}></label>`).join('')}${select('imageFit','图片显示',[['contain','完整显示 · 保持比例'],['cover','填满 · 裁剪边缘']],'contain')}</details><details open><summary>连线与箭头</summary>${select('lineStyle','走线形态',[['default','原有默认'],['pcb','PCB · 45°切角'],['orthogonal','直角线'],['straight','直线'],['curve','曲线'],['rounded','圆角折线'],['bus','共享主干总线'],['dotted','点阵虚线'],['hidden','隐藏连线']],'pcb')}${select('lineEffect','光效',[['none','简洁实线'],['pulse','流光粒子脉冲'],['dual','双轨数据总线'],['neon','霓虹光晕'],['ants','行军蚁'],['comet','彗星拖尾'],['breathing','呼吸微光'],['grain','胶片颗粒微光']],'none')}${check('hierarchy','主干 / 分支层级样式',true)}<div class="inspectorPair">${color('lineColor','连线颜色','#33dec1')}${color('arrowColor','箭头颜色','#33dec1')}</div>${select('arrowType','箭头 / 端点',[['chevron2','双重 HUD 游标'],['chevron3','三重 HUD 游标'],['diamond','空心菱形'],['crosshair','十字准星'],['chiseled','斜切尖端'],['pulse','脉冲圆环'],['filled','实心三角'],['open','空心箭头'],['dot','圆点'],['none','无箭头'],['clapper','场记板角标'],['fork','三叉信号头'],['jack','方块终端插头'],['radar','雷达扇形']],'chevron2')}<small>层级样式开启时主干使用 HUD 游标、分支使用菱形。手动选择箭头会切换为统一端点；重新勾选层级样式可恢复自动分层。</small>${slider('arrowSpeed','流动速度',.1,5,1,.1)}${check('flow','启用流动动画',true)}${check('pins','显示焊盘与卡片接口',true)}</details><details open><summary>卡片容器</summary><div class="inspectorPair">${color('cardBackground','卡片背景',dark?'#1b252d':'#e4ecef')}${color('cardBorder','卡片边框',dark?'#41535e':'#a6bdc6')}</div></details><details open><summary>背景与高亮</summary><div class="inspectorPair">${color('background','背景',dark?'#10212c':'#eaf0f3')}${color('node','节点',dark?'#12384d':'#f5f9fa')}${color('highlight','高亮','#33dec1')}${color('grid','网格',dark?'#2b424e':'#d4dfe4')}</div>${select('pattern','背景样式',[['dots','点阵'],['lines','方格'],['none','纯色']],'dots')}${slider('gridSize','格子大小',8,160,28)}</details><button type="button" data-reset-appearance>恢复默认外观</button>`;
}
window.frameCanvasEdge={
 shape(type,terminal=false){
  const x=terminal?7:0;
  if(type==='clapper')return `<path d="M${x-8} -5 H${x+2} V5 H${x-8} Z" fill="none"/><path d="M${x-7} -4 L${x-3} 0 M${x-2} -4 L${x+2} 0" stroke-width="2"/><path d="M${x-6} 3 H${x}"/>`;
  if(type==='fork')return `<path d="M${x-9} 0 H${x+2} M${x-6} 0 V-4 H${x+2} M${x-6} 0 V4 H${x+2}" fill="none" stroke-width="1.5"/>`;
  if(type==='jack')return `<rect x="${x-4}" y="-4" width="8" height="8" rx="1" fill="none"/><path d="M${x-8} -2 H${x-4} M${x-8} 2 H${x-4}"/>`;
  if(type==='radar')return `<circle cx="${x-4}" cy="0" r="1.4"/><path d="M${x-1} -3 Q${x+2} 0 ${x-1} 3 M${x+2} -5 Q${x+7} 0 ${x+2} 5" fill="none"/>`;
  if(type==='chevron2'||type==='chevron3')return Array.from({length:type==='chevron3'?3:2},(_,i)=>`<polyline points="${x-5-i*5},-4 ${x-i*5},0 ${x-5-i*5},4" fill="none" stroke-width="1.4"/>`).join('');
  return ({diamond:`<polygon points="${x},-4 ${x+4},0 ${x},4 ${x-4},0" fill="none"/>`,crosshair:`<polyline points="${x-5},0 ${x+5},0"/><polyline points="${x},-5 ${x},5"/>`,chiseled:`<polygon points="${x-6},-3 ${x+3},0 ${x},3 ${x-6},3"/>`,pulse:`<circle cx="${x}" r="5" opacity=".3"/><circle cx="${x}" r="2"/>`,dot:`<circle cx="${x}" r="3"/>`,open:`<polyline points="${x-5},-4 ${x+1},0 ${x-5},4" fill="none" stroke-width="1.5"/>`})[type]||`<polygon points="${x-5},-4 ${x+3},0 ${x-5},4"/>`;
 },
 path(style,x1,y1,x2,y2,vertical=false){
  if(['straight','bus','dotted'].includes(style))return `M${x1},${y1} L${x2},${y2}`;
  const points=vertical?[[x1,y1],[x1,(y1+y2)/2],[x2,(y1+y2)/2],[x2,y2]]:[[x1,y1],[(x1+x2)/2,y1],[(x1+x2)/2,y2],[x2,y2]];
  if(style==='rounded'){
   let d=`M${x1},${y1}`;
   for(let i=1;i<points.length-1;i++){const p=points[i],a=points[i-1],b=points[i+1],la=Math.hypot(a[0]-p[0],a[1]-p[1]),lb=Math.hypot(b[0]-p[0],b[1]-p[1]),r=Math.min(8,la/2,lb/2);if(!la||!lb){d+=` L${p}`;continue}d+=` L${p[0]+(a[0]-p[0])*r/la},${p[1]+(a[1]-p[1])*r/la} Q${p} ${p[0]+(b[0]-p[0])*r/lb},${p[1]+(b[1]-p[1])*r/lb}`}
   return d+` L${x2},${y2}`;
  }
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
 const paths={film:'M3 5 H97 V95 H3 Z '+Array.from({length:8},(_,i)=>`M${8+i*11} 9 h7 v7 h-7 Z M${8+i*11} 84 h7 v7 h-7 Z`).join(' '),octagon:'M20 2 H80 L98 20 V80 L80 98 H20 L2 80 V20 Z',pill:'M25 3 H75 A23 47 0 0 1 75 97 H25 A23 47 0 0 1 25 3 Z',badge:'M18 3 H88 L98 13 V87 L88 97 H18 L2 81 V19 Z M9 50 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z',circle:'M50 2 A48 48 0 1 1 49.99 2 Z',rounded:'M16 2 H84 Q98 2 98 16 V84 Q98 98 84 98 H16 Q2 98 2 84 V16 Q2 2 16 2 Z',square:'M2 2 H98 V98 H2 Z',diamond:'M50 2 L98 50 L50 98 L2 50 Z',hexagon:'M25 2 H75 L98 50 L75 98 H25 L2 50 Z',chamfer:'M14 2 H86 L98 14 V86 L86 98 H14 L2 86 V14 Z'};
 return '<svg class="projectShapeSvg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">'+Object.entries(paths).map(([key,d])=>'<g data-project-shape="'+key+'"><path class="rootShape" fill-rule="evenodd" d="'+d+'"/>'+(key==='octagon'?'<path class="rootShapeDetail" d="M22 8 H78 L92 22 V78 L78 92 H22 L8 78 V22 Z"/>':'')+[1,2,3].map(i=>'<path class="rootShapeRipple r'+i+'" d="'+d+'"/>').join('')+'</g>').join('')+'</svg>';
}
