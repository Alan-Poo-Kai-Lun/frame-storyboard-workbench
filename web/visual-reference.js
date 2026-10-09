/* Offline teaching diagrams: no models, network images or VRAM required. */
const REFERENCE_NOTES={
 size:['脸部或局部占据画面，突出细节。','头部到胸肩为主，突出神态。','腰部以上为主，兼顾手部动作。','完整人物与脚部入画，交代身体动作。','人物较小，环境占主要面积。','人物极小或几乎不可见，展示大范围环境。'],
 angle:['摄影机与主体眼睛高度接近。','摄影机高于主体，向下拍摄。','摄影机低于主体，向上拍摄。','前景保留另一人的肩背，观看对面主体。','用角色眼睛的位置观察场景。'],
 composition:['主体靠近三分线交点。','主体位于画面中心。','两侧元素围绕中轴呼应。','主体靠近黄金分割线，约 0.382 / 0.618。','主体偏一侧，另一侧留出空白。'],
 lighting:['用天空、窗户等自然环境光照明。','光源面积较大，明暗过渡柔和。','光从人物侧面照来，强化立体感。','光源在人物后方，勾出轮廓。','光源从头顶向下，眼窝和下巴阴影明显。','主光、补光和轮廓光配合；这里展示一种常见布光。'],
 palette:['接近日常观察的中性色彩。','黄、橙等暖色占主要比例。','蓝、青等冷色占主要比例。','亮部与暗部差异较大。','颜色较淡，减少鲜艳程度。'],
 movement:['摄影机位置和朝向均保持不动。','摄影机朝主体移动；不是数码放大。','摄影机离开主体，逐渐展示更多环境。','摄影机横向移动，方向大体不变。','摄影机随主体同向移动，保持相对距离。','摄影机留在原地，旋转朝向。','摄影机围绕主体沿弧线移动。','摄影机在竖直方向上升或下降。'],
 lens:['视野较宽；近距离拍摄时近大远小更明显。','常见视角，透视表现较自然。','视野较窄，常用于人像与细节。','视野更窄，常用于远处主体。'],
 depth:['主体清晰，前景或背景明显模糊。','从主体到远处环境均较清晰。']
};
const ACTION_REFERENCES=[
 ['自然站立','人物站直，双手自然下垂，双脚落地。'],['向前走路','人物向前行走，左右脚交替迈步，双臂自然摆动。'],
 ['向前奔跑','人物身体微向前倾，快速迈步，双臂配合摆动。'],['坐在椅子上','人物坐在椅子上，膝盖自然弯曲，双脚落地。'],
 ['回头转身','人物转动上半身并回头看向身后，双脚保持稳定。'],['抬手挥手','人物抬起一只手，掌心向外，轻轻挥手示意。'],
 ['伸手指向','人物抬起一只手，伸出食指指向侧前方的目标。'],['俯身查看','人物上半身向前俯下，低头查看面前的物体。']
];
const EXPRESSION_REFERENCES=[
 ['自然平静','表情自然平静，眉眼放松，嘴唇轻合。'],['亲切微笑','嘴角轻轻上扬，眼神柔和，表情亲切。'],
 ['开心大笑','嘴角明显上扬，张口笑，眼睛略微眯起。'],['怀疑好奇','一侧眉毛抬起，眼神探询，嘴唇轻抿。'],
 ['惊讶','眉毛上扬，眼睛睁大，嘴唇微张。'],['生气','眉头向内压低，目光集中，嘴唇紧抿。'],
 ['委屈难过','眉毛内侧抬起，嘴角轻轻下垂，眼神低落。'],['紧张担忧','眉头略微皱起，眼睛注意周围，嘴唇紧绷。']
];
function referenceItems(category){
 if(category==='action')return ACTION_REFERENCES;
 if(category==='expression')return EXPRESSION_REFERENCES;
 return (PROFESSIONAL[category]?.options||[]).map((name,i)=>[name,REFERENCE_NOTES[category]?.[i]||name]);
}
const REF_COLORS=['#dfb28e','#bd6d50','#607a7d','#8cafaa','#e9dabc'];
function refPerson(x=160,y=106,scale=1,pose=0){
 const limbs=[['M0 20L-22 59M0 20L22 59','M-9 68L-12 111M9 68L12 111'],['M0 20L-23 43M0 20L26 28','M-9 68L-30 106M9 68L32 94'],['M0 20L-25 29M0 20L26 47','M-9 68L-32 91M9 68L35 105'],['M0 20L-15 53M0 20L21 53','M-9 68L24 68L24 104M9 68L36 68L36 104'],['M0 20L-15 45M0 20L30 48','M-9 68L-12 111M9 68L12 111'],['M0 20L-22 57M0 20L27 0L25 -25','M-9 68L-12 111M9 68L12 111'],['M0 20L-22 57M0 20L55 13','M-9 68L-12 111M9 68L12 111'],['M0 20L22 48M0 20L35 43','M-9 68L-12 111M9 68L12 111']][pose];
 return `<g transform="translate(${x} ${y}) scale(${scale})" stroke-linecap="round"><circle cy="-10" r="16" fill="#dfb28e" stroke="#364b58" stroke-width="2"/><path d="M-16 -13Q-15 -36 14 -19L16 -11" fill="#364b58"/><circle cx="-5" cy="-9" r="1.6" fill="#364b58"/><circle cx="5" cy="-9" r="1.6" fill="#364b58"/><path d="M-4 -2Q0 1 4 -2" stroke="#91584f" fill="none"/><path d="M-14 12Q0 5 14 12L17 67H-17Z" fill="#607a7d"/><path d="${limbs[0]}" stroke="#dfb28e" stroke-width="9" fill="none"/><path d="${limbs[1]}" stroke="#364b58" stroke-width="10" fill="none"/>${pose===3?'<path d="M-27 25V78H39V113M-27 78V113" stroke="#ac835f" stroke-width="6" fill="none"/>':''}</g>`;
}
function refArrow(path){return `<path d="${path}" stroke="#b25f35" stroke-width="3" fill="none" marker-end="url(#arrow)"/>`}
function refCamera(x,y,rotation=0){return `<g transform="translate(${x} ${y}) rotate(${rotation})"><rect x="-14" y="-9" width="24" height="18" rx="3" fill="#364b58"/><path d="M10 -6L21 -12V12L10 6Z" fill="#364b58"/></g>`}
function visualReferenceSVG(category,index){
 if(typeof expandedReferenceSVG==='function'){const extra=expandedReferenceSVG(category,index);if(extra)return extra}
 const items=referenceItems(category),title=items[index]?.[0]||'',safeTitle=esc(title);let drawing='';
 const terrain='<path d="M0 153L54 90L101 140L146 76L210 147L264 105L320 153V210H0Z" fill="#d0d9d1"/><path d="M0 180H320" stroke="#b0b9b6"/>';
 if(category==='size'){
  const scales=[3.8,2.7,1.75,1.12,.52,.22],ys=[165,140,97,49,100,119];
  drawing=terrain+refPerson(160,ys[index],scales[index]);
 }else if(category==='angle'){
  if(index===3)drawing=terrain+refPerson(196,56,1.04)+`<path d="M0 210V138Q11 92 43 110Q95 122 115 210Z" fill="#364b58"/><ellipse cx="35" cy="97" rx="31" ry="40" fill="#364b58"/>`;
  else if(index===4)drawing=terrain+'<path d="M20 210Q20 152 76 143L111 157L67 210M300 210Q300 152 244 143L209 157L253 210" fill="#dfb28e"/><rect x="127" y="131" width="66" height="42" rx="5" fill="#607a7d"/><text x="160" y="63" text-anchor="middle" fill="#364b58" font-size="16">角色眼前所见</text>';
  else{const y=[77,37,154][index];drawing=refPerson(207,50,1.05)+refCamera(66,y,[0,25,-25][index])+`<path d="M90 ${y}L185 41M90 ${y}L185 158" stroke="#b25f35" stroke-width="2" stroke-dasharray="5 4"/><path d="M35 178H280" stroke="#b0b9b6"/>`}
 }else if(category==='composition'){
  const x=[106,160,160,198,78][index];drawing=terrain+refPerson(x,55,1.07);
  if(index===0||index===3){const a=index===0?106:122,b=index===0?214:198;drawing+=`<path d="M${a} 0V210M${b} 0V210M0 70H320M0 140H320" stroke="#b25f35" stroke-dasharray="5 4"/>`}
  if(index===1||index===2)drawing+='<path d="M160 0V210" stroke="#b25f35" stroke-dasharray="5 4"/>';
  if(index===2)drawing+='<path d="M25 190V60H66V190M254 190V60H295V190" fill="#9aafa8"/>';
  if(index===4)drawing+='<rect x="176" y="44" width="119" height="122" rx="8" fill="#faf8f3" stroke="#b25f35" stroke-dasharray="5 4"/><text x="235" y="111" text-anchor="middle" fill="#915b39" font-size="15">留白空间</text>';
 }else if(category==='lighting'){
  drawing='<rect width="320" height="210" fill="#283b4a"/>'+refPerson(160,58,1.1);
  const pos=[[55,36],[54,66],[33,109],[160,46],[160,12],[35,52]][index];
  drawing+=`<ellipse cx="${pos[0]}" cy="${pos[1]}" rx="${index===1?28:15}" ry="${index===1?41:15}" fill="#ffe4a3"/>`;
  drawing+=`<path d="M${pos[0]} ${pos[1]}L139 48L181 168Z" fill="#ffdd8a" opacity="${index===1?.12:.24}"/>`;
  if(index===2)drawing+='<path d="M160 49Q194 56 176 83L180 128H160Z" fill="#172937" opacity=".6"/>';
  if(index===3)drawing+='<ellipse cx="160" cy="47" rx="19" ry="18" fill="none" stroke="#ffe4a3" stroke-width="3"/><path d="M143 75L139 133M177 75L181 133" stroke="#ffe4a3" stroke-width="3"/>';
  if(index===4)drawing+='<path d="M149 50H157M165 50H173M155 66H168" stroke="#283b4a" stroke-width="4"/>';
  if(index===5)drawing+='<circle cx="283" cy="81" r="15" fill="#afcce3"/><path d="M283 81L180 48L143 172Z" fill="#afcce3" opacity=".13"/><circle cx="204" cy="27" r="10" fill="#ffe4a3"/><path d="M177 42Q194 51 178 69" stroke="#ffe4a3" stroke-width="3" fill="none"/>';
 }else if(category==='palette'){
  const colors=[REF_COLORS,['#efcb8b','#b15e3f','#744540','#e79d55','#d7b781'],['#dae6ee','#6884a3','#3b596b','#74b3b6','#aec3d9'],['#faf5e6','#182932','#f2dcb2','#15222d','#f8f5e9'],['#c5bdb6','#a19995','#9ba7a6','#b0bdb9','#d3cec4']][index];
  drawing=colors.map((c,i)=>`<rect x="${i*64}" y="0" width="64" height="210" fill="${c}"/>`).join('')+refPerson(160,55,1.08);
 }else if(category==='movement'){
  drawing='<rect x="105" y="20" width="183" height="175" rx="10" fill="#dde4db"/><circle cx="201" cy="96" r="17" fill="#607a7d"/><text x="201" y="133" text-anchor="middle" fill="#364b58" font-size="13">主体</text>';
  if(index===0)drawing+=refCamera(57,96)+'<text x="57" y="137" text-anchor="middle" fill="#364b58" font-size="13">位置不动</text>';
  if(index===1)drawing+=refCamera(46,96)+refArrow('M76 96H167');
  if(index===2)drawing+=refCamera(137,96)+refArrow('M109 96H32');
  if(index===3)drawing+=refCamera(63,68)+refArrow('M63 92V175');
  if(index===4)drawing+=refCamera(63,62)+refArrow('M63 92V172')+refArrow('M201 148V181');
  if(index===5)drawing+=refCamera(55,96)+refArrow('M88 57Q130 97 88 136')+'<circle cx="55" cy="96" r="24" fill="none" stroke="#364b58" stroke-dasharray="3 4"/>';
  if(index===6)drawing+=refCamera(139,172,-55)+refArrow('M126 150C82 27 280 7 279 137');
  if(index===7)drawing=refPerson(207,55,1.08)+refCamera(65,118)+refArrow('M65 84V25')+refArrow('M65 150V195');
 }else if(category==='lens'){
  const half=[81,56,34,18][index];drawing=refCamera(36,105)+`<path d="M57 105L302 ${105-half}V${105+half}Z" fill="#dde4db" stroke="#b25f35" stroke-width="2"/>`+refPerson(243,61,.82)+`<text x="170" y="197" text-anchor="middle" font-size="14" fill="#364b58">视野范围示意 · 不是固定毫米数</text>`;
 }else if(category==='depth'){
  const background='<path d="M15 182V65H72V182M235 182V48H300V182" fill="#93aaa3"/><path d="M22 92H65M22 114H65M244 75H291M244 96H291" stroke="#eaf0e7" stroke-width="5"/>';
  drawing=`<g ${index===0?'filter="url(#blur)"':''}>${background}</g>`+refPerson(160,53,1.1);
 }else if(category==='action'){
  drawing='<path d="M20 187H300" stroke="#acb9b4"/>'+refPerson(149,index===3?91:65,index===3?.92:1.1,index);
  if([1,2].includes(index))drawing+=refArrow('M210 135H280');
  if(index===4)drawing+=refArrow('M115 31Q161 1 195 35');
  if(index===5)drawing+=refArrow('M199 22Q232 42 206 57');
  if(index===6)drawing+='<circle cx="273" cy="60" r="10" fill="#e4c48c"/>';
  if(index===7)drawing='<path d="M25 187H300M198 133H273V187" stroke="#acb9b4" fill="none"/>'+`<g transform="rotate(22 148 130)">${refPerson(142,57,1.05,7)}</g>`+'<rect x="215" y="111" width="34" height="20" fill="#e4c48c"/>';
 }else if(category==='expression'){
  const brows=['M106 70Q119 66 132 70M188 70Q201 66 214 70','M106 66Q119 61 132 66M188 66Q201 61 214 66','M106 61Q119 56 132 61M188 61Q201 56 214 61','M106 60L132 65M188 56L214 48','M106 51Q119 43 132 51M188 51Q201 43 214 51','M106 59L132 72M188 72L214 59','M106 68L132 56M188 56L214 68','M106 64L132 58M188 58L214 64'][index];
  const mouths=['M137 135H183','M137 130Q160 150 183 130','M132 125Q160 169 188 125Z','M140 136L180 132','M151 126Q160 113 169 126Q178 149 160 151Q142 149 151 126','M138 137L182 137','M139 143Q160 122 181 143','M139 137Q160 132 181 137'][index];
  drawing='<path d="M75 210Q90 168 120 163H200Q230 168 245 210" fill="#607a7d"/><ellipse cx="160" cy="101" rx="68" ry="80" fill="#dfb28e" stroke="#364b58" stroke-width="2"/><path d="M92 74Q91 5 167 11Q232 13 228 74L200 34Q152 49 110 44Z" fill="#364b58"/>'+`<path d="${brows}" stroke="#364b58" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  drawing+=index===2?'<path d="M108 87Q120 74 132 87M188 87Q200 74 212 87" stroke="#364b58" stroke-width="4" fill="none"/>':`<ellipse cx="120" cy="87" rx="${index===4?12:10}" ry="${index===4?14:6}" fill="#fff8ed"/><ellipse cx="200" cy="87" rx="${index===4?12:10}" ry="${index===4?14:6}" fill="#fff8ed"/><circle cx="120" cy="87" r="4" fill="#364b58"/><circle cx="200" cy="87" r="4" fill="#364b58"/>`;
  drawing+=`<path d="M157 99L153 115H165" stroke="#ad795d" fill="none" stroke-width="2"/><path d="${mouths}" fill="${[2,4].includes(index)?'#884f47':'none'}" stroke="#884f47" stroke-width="3" stroke-linecap="round"/>`;
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 250" role="img" aria-label="${safeTitle}图示"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0 0L7 3L0 6" fill="#b25f35"/></marker><filter id="blur"><feGaussianBlur stdDeviation="6"/></filter><clipPath id="scene"><rect width="320" height="210"/></clipPath></defs><rect width="320" height="250" fill="#f5f3eb"/><g clip-path="url(#scene)">${drawing}</g><rect y="210" width="320" height="40" fill="#e5e9e0"/><text x="160" y="236" text-anchor="middle" font-family="Microsoft YaHei, sans-serif" font-size="16" fill="#263b49">${safeTitle}</text></svg>`;
}
function referenceImageURI(category,index){const custom=typeof customReferences!=='undefined'?referenceItems(category)[index]?.[2]:null;if(custom?.image)return custom.image;return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(visualReferenceSVG(category,index))}
function openVisualReference(category='size'){
 if(!ready||!shot())throw Error('先选择一个镜头');
 const target={pid:P.projectId,sid:seg().id,id:shot().id};
 const categories={...Object.fromEntries(Object.entries(PROFESSIONAL).map(([k,v])=>[k,v.label])),action:'动作',expression:'表情'};
 modal('视觉参考 · '+categories[category],`<p class="muted">教学示意图用于理解效果，可点击放大。运镜箭头表示摄影机方向；跟拍同时展示主体方向。最终效果还取决于场景、构图和模型。</p><label>参考分类<select id="referenceCategory">${Object.entries(categories).map(([k,v])=>`<option value="${k}" ${k===category?'selected':''}>${v}</option>`).join('')}</select></label><label id="referenceApplyLabel" ${['action','expression'].includes(category)?'':'hidden'}>文字应用方式<select id="referenceApplyMode"><option value="append">追加到现有描述</option><option value="replace">替换此字段描述</option></select><small>追加会保留已有角色、素材引用和具体剧情。替换仅影响当前字段。</small></label><div class="row"><button id="addCustomReference">＋ 自定义参考</button><button id="editCustomReference">管理自定义参考</button></div><div id="referenceCards" class="referenceCards"></div>`,[{label:'关闭',action:close}]);
 const renderCards=()=>{
  const key=$('referenceCategory').value||category,items=referenceItems(key);
  $('referenceApplyLabel').hidden=!['action','expression'].includes(key);
  $('referenceCards').innerHTML=items.map(([title,note],i)=>`<article class="referenceCard"><button class="referencePicture" data-reference-view="${i}" aria-label="放大查看${esc(title)}"><img src="${referenceImageURI(key,i)}" alt="${esc(title)}图示" draggable="false"></button><b>${esc(title)}</b><p>${esc(note)}</p><button data-reference-apply="${i}" class="full">${PROFESSIONAL[key]?'设置'+esc(PROFESSIONAL[key].label):'应用描述'}</button></article>`).join('');
 };
 $('referenceCategory').onchange=renderCards;renderCards();
 $('addCustomReference').onclick=()=>safe(()=>editVisualCustom($('referenceCategory').value));
 $('editCustomReference').onclick=()=>safe(()=>manageVisualCustom($('referenceCategory').value));
 if(typeof loadVisualCustom==='function')loadVisualCustom().then(()=>{if($('referenceCards')&&$('referenceCategory'))renderCards()}).catch(e=>toast('自定义参考读取失败：'+e.message));
 $('referenceCards').onclick=e=>safe(async()=>{
  const key=$('referenceCategory').value||category,view=e.target.closest('[data-reference-view]'),apply=e.target.closest('[data-reference-apply]');
  if(view){const i=Number(view.dataset.referenceView);openImageViewerSource(referenceImageURI(key,i),referenceItems(key)[i]?.[0]+' · 图示参考');return}
  if(!apply)return;
  if(P?.projectId!==target.pid||seg()?.id!==target.sid||shot()?.id!==target.id)throw Error('镜头已切换，请重新打开参考');
  const entry=referenceItems(key)[Number(apply.dataset.referenceApply)];if(!entry)throw Error('参考选项不存在');
  const sh=shot();
  if(PROFESSIONAL[key]){sh.professional||={};sh.professional[key]=entry[2]?entry[0]+'：'+entry[1]:entry[0]}
  else{const old=sh[key]||'';sh[key]=$('referenceApplyMode').value==='replace'||!old?entry[1]:old.trimEnd()+'\n'+entry[1]}
  await edited();close();toast('已应用到当前镜头：'+entry[0]);
 });
}
$('actionReference').onclick=()=>safe(()=>openVisualReference('action'));
$('expressionReference').onclick=()=>safe(()=>openVisualReference('expression'));
$('cameraReference').onclick=()=>safe(()=>openVisualReference('size'));
/* Native details retain focus and contents; render() never rebuilds the sections. */
let workspaceFoldState={};
try{const value=JSON.parse(localStorage.getItem('frame-workspace-folds')||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))workspaceFoldState=value}catch{}
for(const id of ['boardPanel','reversePanel','groupAssetsPanel','timelinePanel','assistantPanel','segmentVideosPanel']){
 const panel=$(id);if(!panel)continue;
 if(typeof workspaceFoldState[id]==='boolean')panel.open=workspaceFoldState[id];
 panel.addEventListener('toggle',()=>{workspaceFoldState[id]=panel.open;try{localStorage.setItem('frame-workspace-folds',JSON.stringify(workspaceFoldState))}catch{}});
}
