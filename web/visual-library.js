/* Additional offline diagrams and reusable, locally saved custom references. */
const EXTRA_REFERENCES={
 size:[['大特写 / 微距 ECU','画面聚焦眼睛、嘴唇或物体微小细节，局部填满画幅。'],['中远景 / 七分身','膝盖以上入画，保留手部和腰部动作空间；也称 American / Cowboy Shot。']],
 angle:[['垂直俯拍 / 鸟瞰','摄影机位于主体正上方，镜头垂直朝下，展现空间布局。'],['极低仰拍 / 虫视','摄影机贴近地面向上拍，使主体显得高大并增强压迫感。'],['荷兰角 / 倾斜镜头','摄影机绕镜头轴倾斜，使地平线倾斜，传达紧张或失衡。'],['背影 / 追尾机位','摄影机位于人物身后，跟随其前进，主要呈现背影和前方环境。']],
 movement:[['希区柯克变焦 / Dolly Zoom','摄影机后退同时变焦拉近，或推进同时变焦拉远；保持主体大小，改变背景透视。'],['手持镜头 / 晃动镜头','摄影机随拍摄者产生轻微不规则晃动，传达呼吸感和纪实感。'],['穿梭镜头 / FPV','摄影机连续向前穿过门窗或狭窄空间，避免切镜和穿透实体。'],['甩镜头 / Whip Pan','快速水平旋转镜头，画面短暂出现横向模糊，停在新主体上。']],
 lighting:[['伦勃朗光','主光从侧上方照射，背光侧脸颊形成小三角亮区。'],['侧逆光 / 边缘光','光源位于侧后方，在人物发丝与肩部形成明亮轮廓。'],['硬光 / 强直射光','小面积或远距离光源产生边缘锐利、反差强的阴影。'],['底光 / 鬼火光','光源从下巴下方向上照，鼻子与眉骨阴影向上延伸。'],['体积光 / 丁达尔效应','光束穿过薄雾或尘埃，空间中可见清晰的束状光线。'],['霓虹光 / 双色温','左右分别使用青蓝和粉红等色光，形成对比色轮廓。']],
 composition:[['框式构图','通过门框、窗户或枝叶围住主体，前景形成画中画。'],['引导线构图','道路、铁轨或走廊边线向主体汇聚，引导视线。'],['对角线构图','主体或关键元素沿画面对角线排列，强化运动张力。']],
 lens:[['超广角 / 鱼眼','超广角扩大视野；鱼眼进一步产生明显弯曲畸变，可自行指定采用哪一种。'],['微距镜头','近距离放大小物件、纹理与微观细节，通常景深很浅。']],
 palette:[['黑白单色','只用黑白灰表现明暗层次，可指定高反差或柔和灰阶。'],['电影青橙调色','阴影偏青蓝，肤色和亮部偏暖橙，保持肤色自然。'],['胶片质感 / 复古','柔和褪色、细腻颗粒与暖色高光，可补充 Kodak / Fuji 等色彩偏好。']],
 action:[['拥抱','两人面对面靠近，双臂环抱对方肩背。'],['握手','两人伸出右手相握，身体保持适当距离。'],['出拳','人物重心向前转移，一只手快速向目标打出，另一只手护住身体。'],['拔枪 / 拔剑','人物从腰间取出指定武器，明确握持手与取出方向。'],['闪避','人物快速侧移或俯身，避开迎面而来的攻击。'],['跌倒','人物失去平衡向地面倒下，身体与地面发生接触。'],['喝水','人物举起杯子到嘴边，轻轻倾斜杯子饮水。'],['吸烟','人物将香烟靠近嘴边，随后呼出轻薄烟雾。'],['看表','人物抬起戴表的手腕，低头看向表盘。'],['打字','人物坐在桌前，双手手指在键盘上连续敲击。'],['叹气','人物呼出一口气，肩膀轻轻下降，动作幅度小。'],['揉眼睛','人物抬手轻揉眼角，随后放下手。']],
 expression:[['冷笑 / 轻蔑','一侧嘴角上扬，眼睛微眯，目光带轻蔑。'],['恐惧 / 绝望','眼睛睁大或失焦，眉毛内侧上扬，嘴唇轻颤。'],['痛哭 / 流泪','眉毛内侧上扬，泪水沿脸颊滑落，嘴角下垂或张口哭泣。'],['愤怒嘶吼','眉头紧压，眼神强烈，嘴巴大张，脸部肌肉紧绷。'],['狡黠 / 阴险','眼睛微眯，眉毛不对称，一侧嘴角缓慢抬起。']],
 environment:[['雨夜','夜晚持续下雨，湿润路面反射灯光，雨丝在逆光中可见。'],['大雾弥漫','浓雾遮蔽远处，近景清晰，远景对比度逐渐降低。'],['沙尘暴','黄褐色沙尘随强风横向移动，能见度下降。'],['飘雪','雪花缓慢飘落，地面和枝叶积雪，环境安静。'],['落叶','秋叶随风飘落并在地面翻动，暖色环境。'],['阳光尘埃','阳光穿过窗户，细小尘埃在光束内缓慢漂浮。'],['废土废墟','破损建筑、碎石与荒草，空气干燥，环境空旷。']],
 style:[['电影实拍','写实人物与物理可信的材质，电影构图、自然光影及细腻纹理。'],['3D 动画','三维角色、立体材质与动画化表演，可自定义写实或卡通渲染。'],['2D 日漫','二维线稿、赛璐璐色块与动画角色比例，明确描边。'],['复古 VHS','低清录像带质感、扫描线、色彩溢出和轻微信号噪点。'],['赛博朋克','高科技都市与密集霓虹，湿润街面及青粉对比色。']],
 aspect:[['16:9 横屏影视','宽 16、高 9，适用于横屏画面。此项是镜头提示词参数，项目画幅需在左侧单独设置。'],['9:16 竖屏短视频','宽 9、高 16，适用于手机竖屏。此项是镜头提示词参数。'],['2.39:1 宽荧幕','宽 2.39、高 1，宽幅电影构图，保留横向空间。'],['1:1 方幅','宽高相等，主体布局适合方形画面。']],
 motion:[['升格慢动作','动作以慢速播放，展示连续运动的细节。'],['延时摄影','以时间压缩方式展示云层、光线或人流的长时间变化。'],['动态模糊','快速运动主体沿运动方向出现拖影，静止背景保持清晰。']]
};
const ORIGINAL_REFERENCE_COUNTS=Object.fromEntries([...Object.entries(PROFESSIONAL).map(([k,v])=>[k,v.options.length]),['action',ACTION_REFERENCES.length],['expression',EXPRESSION_REFERENCES.length]]);
for(const [key,label] of Object.entries({environment:'环境与氛围',style:'画面风格 / 材质',aspect:'画幅比例',motion:'快门与速度感'}))PROFESSIONAL[key]={label,options:[]};
for(const [key,entries] of Object.entries(EXTRA_REFERENCES)){
 if(key==='action')ACTION_REFERENCES.push(...entries);else if(key==='expression')EXPRESSION_REFERENCES.push(...entries);else{PROFESSIONAL[key].options.push(...entries.map(e=>e[0]));REFERENCE_NOTES[key]||=[];REFERENCE_NOTES[key].push(...entries.map(e=>e[1]))}
}
let customReferences=[];
const builtinReferenceItems=referenceItems;
referenceItems=function(category){return [...builtinReferenceItems(category),...customReferences.filter(r=>r.category===category&&!r.builtin).map(r=>[r.title,r.note,r])];};
let visualCustomLoaded=false,visualCustomLoading=null;
async function loadVisualCustom(force=false){
 if(visualCustomLoaded&&!force)return;
 if(!visualCustomLoading)visualCustomLoading=api('visual-references').then(rows=>{customReferences=rows;visualCustomLoaded=true}).finally(()=>visualCustomLoading=null);
 await visualCustomLoading;
}
function diagramSVG(title,drawing){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 250"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0 0L7 3L0 6" fill="#b25f35"/></marker><filter id="blur"><feGaussianBlur stdDeviation="4"/></filter></defs><rect width="320" height="250" fill="#f5f3eb"/><svg width="320" height="210" viewBox="0 0 320 210">${drawing}</svg><rect y="210" width="320" height="40" fill="#e5e9e0"/><text x="160" y="235" text-anchor="middle" font-size="14" font-family="sans-serif" fill="#263b49">${esc(title)}</text></svg>`}
function expandedReferenceSVG(category,index){
 const entry=referenceItems(category)[index],start=ORIGINAL_REFERENCE_COUNTS[category]||0;if(index<start)return '';if(!entry)return '';
 if(entry[2])return diagramSVG(entry[0],'<rect x="30" y="40" width="260" height="130" rx="12" fill="#dde4db"/><text x="160" y="98" text-anchor="middle" fill="#364b58" font-size="18">自定义文字参考</text><text x="160" y="130" text-anchor="middle" fill="#364b58" font-size="13">可在编辑中添加自己的参考图</text>');
 const i=index-start,person=refPerson(160,58,1.05),ground='<path d="M10 185H310" stroke="#a9b8b0"/>';let d='';
 if(category==='size')d=i===0?'<ellipse cx="160" cy="102" rx="129" ry="56" fill="#fff" stroke="#364b58" stroke-width="5"/><circle cx="160" cy="102" r="51" fill="#607a7d"/><circle cx="160" cy="102" r="27" fill="#263b49"/><circle cx="176" cy="83" r="9" fill="#fff"/>':refPerson(160,57,1.45)+'<rect y="190" width="320" height="20" fill="#f5f3eb"/><path d="M40 190H280" stroke="#b25f35" stroke-dasharray="5 4"/><text x="45" y="177" font-size="13">膝盖裁切线</text>';
 else if(category==='angle'){
  if(i===0)d='<rect x="35" y="23" width="250" height="157" fill="#dde4db" stroke="#607a7d"/><ellipse cx="160" cy="107" rx="32" ry="17" fill="#607a7d"/><circle cx="160" cy="102" r="17" fill="#dfb28e"/>'+refCamera(160,30,90)+refArrow('M160 48V77')+'<text x="160" y="201" text-anchor="middle" font-size="14">正上方垂直向下</text>';
  if(i===1)d=refPerson(210,30,1.35)+refCamera(49,180,-60)+refArrow('M72 162L176 54');
  if(i===2)d='<g transform="rotate(-18 160 105)">'+ground+person+'</g><path d="M10 185H310" stroke="#b25f35" stroke-dasharray="4 4"/>';
  if(i===3)d=ground+person+'<ellipse cx="160" cy="47" rx="16" ry="19" fill="#364b58"/><path d="M40 190L132 114M280 190L189 114" stroke="#607a7d"/>'+refCamera(160,186,-90)+refArrow('M160 157V129');
 }else if(category==='composition')d=person+(i===0?'<path d="M42 205V15H278V205M58 205V31H262V205" stroke="#795c46" stroke-width="12" fill="none"/>':i===1?'<path d="M15 210L146 96M305 210L174 96M70 210L150 96M250 210L170 96" stroke="#795c46" stroke-width="7"/>':'<path d="M20 190L298 20" stroke="#b25f35" stroke-width="4" stroke-dasharray="7 4"/>');
 else if(category==='lighting'){
  d='<rect width="320" height="210" fill="#263b49"/>'+person;
  if(i===0)d+='<path d="M160 30Q185 33 177 65H160Z" fill="#152633" opacity=".75"/><path d="M163 49L175 60L163 67Z" fill="#ffe5a2"/><circle cx="45" cy="26" r="17" fill="#ffe5a2"/>'+refArrow('M67 33L139 52');
  if(i===1)d+='<path d="M175 32Q191 52 178 67L179 125" stroke="#ffe5a2" stroke-width="5" fill="none"/><circle cx="260" cy="30" r="18" fill="#ffe5a2"/>';
  if(i===2)d+='<path d="M178 178L291 178L291 198L175 189Z" fill="#091722"/><circle cx="32" cy="27" r="11" fill="#fff1c2"/>'+refArrow('M55 42L132 87');
  if(i===3)d+='<circle cx="160" cy="192" r="15" fill="#ffe5a2"/><path d="M160 185L117 49H203Z" fill="#ffe5a2" opacity=".25"/>'+refArrow('M160 157V75');
  if(i===4)d+='<path d="M0 10L30 0L290 210H200Z M60 0H77L320 175V210Z" fill="#ffe5a2" opacity=".27"/>'+Array.from({length:15},(_,n)=>`<circle cx="${40+n*17}" cy="${30+n%4*39}" r="2" fill="#ffe5a2"/>`).join('');
  if(i===5)d+='<path d="M0 45L160 30V175L0 160Z" fill="#39cbe3" opacity=".3"/><path d="M320 45L160 30V175L320 160Z" fill="#fa62b7" opacity=".3"/>';
 }else if(category==='movement'){
  d='<rect x="190" y="40" width="60" height="138" fill="#dde4db"/><circle cx="220" cy="105" r="19" fill="#607a7d"/>'+refCamera(60,105);
  if(i===0)d+=refArrow('M130 105H85')+refArrow('M65 66H150')+'<text x="95" y="42" text-anchor="middle" font-size="13">后退 + 拉近变焦</text><path d="M190 40L278 12M250 178L295 201" stroke="#b25f35"/>';
  if(i===1)d+=refArrow('M58 69L67 44L44 29L58 15')+refArrow('M45 139L64 156L46 174L70 188');
  if(i===2)d='<path d="M18 210V12H112V210M148 175V40H210V175M235 142V66H274V142" fill="none" stroke="#607a7d" stroke-width="8"/>'+refCamera(46,114)+refArrow('M72 114C150 114 160 90 264 97');
  if(i===3)d+=refArrow('M89 54Q173 17 258 53')+'<path d="M25 146H180M17 156H167M28 166H150" stroke="#b25f35" stroke-width="3"/><text x="110" y="194" font-size="13">极速转向 → 横向拖影</text>';
 }else if(category==='lens')d=i===0?'<ellipse cx="160" cy="100" rx="138" ry="86" fill="#dde4db" stroke="#364b58" stroke-width="4"/><path d="M50 44Q120 100 50 156M105 21Q146 100 105 182M215 21Q174 100 215 182M270 44Q200 100 270 156M35 70Q160 45 285 70M35 130Q160 155 285 130" stroke="#607a7d" fill="none"/>'+refPerson(160,78,.65):'<path d="M20 190Q90 15 167 92Q152 158 20 190" fill="#8cafaa" stroke="#607a7d"/><circle cx="229" cy="99" r="69" fill="#c7dbcd" stroke="#364b58" stroke-width="5"/><path d="M185 147L269 46M180 95L237 107M226 92L231 46" stroke="#607a7d" stroke-width="5"/>';
 else if(category==='palette'){
  const colors=[['#111','#555','#999','#ccc','#eee'],['#183b49','#287787','#dfb28e','#e7a15c','#bd663b'],['#6b755e','#b4ae83','#d7bd94','#a47b64','#e7d5b9']][i];d=colors.map((c,n)=>`<rect x="${n*64}" width="64" height="210" fill="${c}"/>`).join('');if(i===2)d+=Array.from({length:130},(_,n)=>`<circle cx="${n*47%320}" cy="${n*31%210}" r="1" opacity=".2" fill="#263b49"/>`).join('');
 }else if(category==='action'){
  if(i<2){const x=i===0?136:111;d=ground+refPerson(x,65,1,6)+`<g transform="translate(320 0) scale(-1 1)">${refPerson(x,65,1,6)}</g>`+(i===0?'<path d="M132 83Q202 82 202 114Q184 128 141 105M188 83Q118 82 118 114Q136 128 179 105" stroke="#dfb28e" stroke-width="8" fill="none"/>':'<ellipse cx="160" cy="87" rx="13" ry="7" fill="#dfb28e"/>');}
  else if(i===2)d=ground+refPerson(110,63,1,6)+refArrow('M172 77H253')+'<rect x="259" y="42" width="23" height="77" fill="#bd6d50"/>';
  else if(i===3)d=ground+refPerson(152,60,1,6)+'<path d="M163 122L229 65" stroke="#364b58" stroke-width="7"/>'+refArrow('M191 140L236 92');
  else if(i===4)d=ground+`<g transform="rotate(30 160 117)">${person}</g>`+refArrow('M45 65H121')+refArrow('M188 120L269 155');
  else if(i===5)d=ground+`<g transform="rotate(75 160 150)">${refPerson(140,82,.85)}</g>`+refArrow('M88 62Q205 31 244 162');
  else{d=ground+refPerson(150,64,1,i===9?3:6);
   const props={6:'<path d="M180 38H202L198 63H184Z" fill="#8cafaa" stroke="#364b58"/><path d="M150 88L184 57" stroke="#dfb28e" stroke-width="9"/>',7:'<path d="M170 49H198" stroke="#bd6d50" stroke-width="5"/><path d="M199 41Q216 26 206 12" stroke="#9aafa9" fill="none"/>',8:'<circle cx="191" cy="82" r="11" fill="#fff" stroke="#364b58"/><path d="M191 76V82H197" stroke="#364b58"/>',9:'<path d="M163 120H285V193" stroke="#795c46" stroke-width="7"/><rect x="194" y="112" width="66" height="8" fill="#364b58"/>',10:'<path d="M174 55Q230 40 257 57M182 66Q225 61 250 71" stroke="#9aafa9" fill="none"/>'+refArrow('M109 85V112'),11:'<path d="M155 84L164 51" stroke="#dfb28e" stroke-width="9"/>'+refArrow('M169 36Q193 50 172 62')};d+=props[i]||'';}
 }else if(category==='expression'){
  const angry=i===3,cry=i===2;d='<ellipse cx="160" cy="100" rx="72" ry="81" fill="#dfb28e"/><path d="M97 71Q100 5 174 17Q222 17 228 71" fill="#364b58"/>';
  d+=`<path d="${angry?'M105 60L135 78M185 78L215 60':i===1||cry?'M106 70L132 53M188 53L214 70':'M106 58L132 64M188 68L214 56'}" stroke="#364b58" stroke-width="5"/><ellipse cx="121" cy="86" rx="12" ry="${i===1?14:6}" fill="#fff"/><ellipse cx="199" cy="86" rx="12" ry="${i===1?14:6}" fill="#fff"/><circle cx="122" cy="86" r="4" fill="#364b58"/><circle cx="200" cy="86" r="4" fill="#364b58"/>`;
  d+=angry?'<ellipse cx="160" cy="143" rx="24" ry="25" fill="#884f47"/>':`<path d="${cry||i===1?'M136 147Q160 124 184 147':'M137 137Q171 144 189 123'}" fill="none" stroke="#884f47" stroke-width="4"/>`;if(cry)d+='<path d="M118 98Q106 117 119 129Q130 117 118 98M199 98Q187 117 200 129Q211 117 199 98" fill="#74b3dd"/>';
 }else if(category==='aspect'){
  const ratios=[16/9,9/16,2.39,1],w=ratios[i]>1?270:175*ratios[i],h=w/ratios[i];d=`<rect x="${(320-w)/2}" y="${(210-h)/2}" width="${w}" height="${h}" fill="#dde4db" stroke="#607a7d" stroke-width="4"/><path d="M160 ${(210-h)/2}V${(210+h)/2}" stroke="#b25f35" stroke-dasharray="5 4"/>`;
 }else if(category==='motion')d=i===0?refPerson(85,68,.9,2)+refPerson(170,68,.9,2)+'<text x="160" y="26" text-anchor="middle" font-size="15">更多时间展示一个动作</text>':i===1?'<circle cx="55" cy="61" r="20" fill="#e7a15c"/><circle cx="160" cy="30" r="20" fill="#e7a15c"/><circle cx="265" cy="61" r="20" fill="#e7a15c"/>'+refArrow('M76 67Q160 4 246 65')+ground+'<text x="160" y="148" text-anchor="middle" font-size="15">长时间变化 → 短时间播放</text>':`<g opacity=".2">${refPerson(83,65,1,2)}</g><g opacity=".4">${refPerson(118,65,1,2)}</g>${refPerson(160,65,1,2)}`+refArrow('M225 117H292');
 else if(category==='environment'){
  d='<rect width="320" height="210" fill="'+(['#203544','#c6d0ca','#c4a267','#b8d0db','#c69e6e','#364b58','#a39b87'][i])+'"/>'+ground+person;
  if(i===0)d+=Array.from({length:35},(_,n)=>`<path d="M${n*43%320} ${n*29%200}l-8 18" stroke="#96bdce"/>`).join('');
  if(i===1)d+='<path d="M0 50H320M0 100H320M0 150H320" stroke="#eef2e9" stroke-width="45" opacity=".6"/>';
  if(i===2)d+='<path d="M0 60Q170 10 320 70M0 110Q170 70 320 125M0 160Q170 130 320 180" stroke="#936c41" stroke-width="15" fill="none" opacity=".45"/>';
  if(i===3||i===4)d+=Array.from({length:30},(_,n)=>`<ellipse cx="${n*73%320}" cy="${n*43%200}" rx="${i===3?3:6}" ry="${i===3?3:3}" fill="${i===3?'#fff':'#e7a15c'}"/>`).join('');
  if(i===5)d+='<path d="M0 0H50L290 210H210Z" fill="#ffe5a2" opacity=".4"/>'+Array.from({length:17},(_,n)=>`<circle cx="${45+n*12}" cy="${40+n*9}" r="2" fill="#ffe5a2"/>`).join('');
  if(i===6)d+='<path d="M12 190V55L48 70L65 24L89 76V190M241 190V60L272 40L299 89V190" fill="#747c71"/><path d="M13 182L40 160L68 180L103 161L128 185" fill="#b4ae83"/>';
 }else if(category==='style'){
  d=person+ground;
  if(i===0)d+='<path d="M0 0H320V20H0ZM0 190H320V210H0Z" fill="#263b49"/>';
  if(i===1)d='<rect width="320" height="210" fill="#b8d0db"/><ellipse cx="160" cy="183" rx="52" ry="10" fill="#607a7d" opacity=".3"/>'+person+'<ellipse cx="151" cy="46" rx="8" ry="13" fill="#fff" opacity=".2"/>';
  if(i===2)d='<rect width="320" height="210" fill="#fff"/><g stroke="#263b49" stroke-width="2">'+person+'</g><path d="M173 20L174 80L190 130H174Z" fill="#364b58" opacity=".2"/>';
  if(i===3)d+='<rect width="320" height="210" fill="#bd6d50" opacity=".18"/>'+Array.from({length:42},(_,n)=>`<path d="M0 ${n*5}H320" stroke="#263b49" opacity=".18"/>`).join('')+'<text x="20" y="28" font-size="16" fill="#fff">PLAY ▶</text>';
  if(i===4)d='<rect width="320" height="210" fill="#172937"/><path d="M20 200V40H87V200M240 200V10H299V200" stroke="#fa62b7" fill="#283b4a" stroke-width="3"/><path d="M32 56H73M254 41H286M25 183H297" stroke="#39cbe3" stroke-width="6"/>'+person;
 }
 return diagramSVG(entry[0],d);
}
/* Stable built-in IDs do not change when cards are hidden or filtered. */
function visualReferenceEntries(category){
 const builtins=builtinReferenceItems(category).map(([title,note],index)=>{
  const id='builtin:'+category+':'+index,override=customReferences.find(r=>r.id===id&&r.builtin===id);
  return {id,builtin:id,category,title,note,index,...override,modified:!!override};
 });
 return [...builtins,...customReferences.filter(r=>r.category===category&&!r.builtin).map(r=>({...r,modified:true}))];
}
function referenceMediaKind(entry){const mime=entry.image?.startsWith('data:')?entry.image.slice(5).split(';')[0]:entry.mime;return entry.image?(mime?.startsWith('video/')?'video':mime==='image/gif'?'gif':'image'):entry.builtin?'diagram':'text'}
function referenceMediaSource(entry){return entry.image||(entry.builtin?referenceImageURI(entry.category,entry.index):'')}
function referenceMediaHTML(entry,preview=false){
 const source=referenceMediaSource(entry),kind=referenceMediaKind(entry);
 if(entry.mediaMissing)return '<div class="referenceNoMedia referenceMediaError">找不到参考媒体文件<br><small>说明已保留，请从原工作台 data 目录恢复媒体，或点击下方替换</small></div>';
 if(kind==='video')return `<video class="referenceClip" controls loop muted playsinline preload="none" src="${esc(source)}" aria-label="${esc(entry.title)}视频参考"></video>`;
 if(kind==='gif'&&!preview)return `<button class="referencePicture referenceGifPlaceholder" data-reference-view="${esc(entry.id)}">▶ 点击播放 GIF 动图</button>`;
 if(source)return `<button class="referencePicture" data-reference-view="${esc(entry.id)}" aria-label="放大查看${esc(entry.title)}"><img src="${esc(source)}" alt="${esc(entry.title)}参考" loading="eager" decoding="async" draggable="false"></button>`;
 return '<div class="referenceNoMedia">尚未添加媒体<br><small>拖入图片、GIF 或视频</small></div>';
}
let visualLibraryOpen=0;
openVisualReference=async function(category='size'){
 const request=++visualLibraryOpen,target={pid:P?.projectId,sid:seg()?.id,id:shot()?.id},previousRevision=typeof modalRevision==='number'?modalRevision:0,previousBody=$('modalBody').firstElementChild;
 await loadVisualCustom();if(request!==visualLibraryOpen||(typeof modalRevision==='number'&&modalRevision!==previousRevision)||$('modalBody').firstElementChild!==previousBody)return;
 const categories={...Object.fromEntries(Object.entries(PROFESSIONAL).map(([k,v])=>[k,v.label])),action:'动作',expression:'表情'};
 modal('视觉参考库 · '+categories[category],`<p class="muted">每张卡片都能修改名称、说明和参考媒体。直接拖入文件即可替换；GIF 点击后播放，视频可播放、暂停和拖动进度。示意图可逐项换成自己的实际参考。</p><div class="referenceLibraryToolbar"><label>分类<select id="referenceCategory">${Object.entries(categories).map(([k,label])=>`<option value="${k}" ${k===category?'selected':''}>${label}</option>`).join('')}</select></label><label>查找<input id="referenceSearch" placeholder="名称或说明"></label></div><div class="row referenceLibraryFilters"><button id="addCustomReference">＋ 新增参考</button><button id="refreshVisualReferences">刷新参考库</button><label><input id="referenceOnlyMedia" type="checkbox">只看已添加的图片 / 动图 / 视频</label><label><input id="referenceShowHidden" type="checkbox">显示隐藏的内置条目</label></div><label id="referenceApplyLabel">动作 / 表情文字应用方式<select id="referenceApplyMode"><option value="append">追加描述</option><option value="replace">替换描述</option></select></label><p id="referenceLibraryStatus" class="muted" aria-live="polite"></p><div id="referenceCards" class="referenceCards"></div><div class="row"><button id="referencePrevious">上一页</button><span id="referencePageInfo"></span><button id="referenceNext">下一页</button></div>`,[{label:'关闭',action:()=>{visualLibraryOpen++;close()}}]);
 let referencePage=0;const pageSize=12;
 const renderCards=()=>{
  if(!$('referenceCategory'))return;const key=$('referenceCategory').value,search=$('referenceSearch').value.trim().toLowerCase();
  const entries=visualReferenceEntries(key).filter(e=>(!e.hidden||$('referenceShowHidden').checked)&&(!$('referenceOnlyMedia').checked||e.image)&&(!search||(e.title+' '+e.note).toLowerCase().includes(search)));
  $('referenceApplyLabel').hidden=!['action','expression'].includes(key);
  const pageCount=Math.max(1,Math.ceil(entries.length/pageSize));referencePage=Math.min(referencePage,pageCount-1);
  for(const video of $('referenceCards').querySelectorAll('video'))video.pause();
  $('referencePrevious').disabled=referencePage===0;$('referenceNext').disabled=referencePage>=pageCount-1;$('referencePageInfo').textContent=(referencePage+1)+' / '+pageCount;
  $('referenceCards').innerHTML=entries.slice(referencePage*pageSize,(referencePage+1)*pageSize).map(entry=>`<article class="referenceCard ${entry.hidden?'referenceHidden':''}" data-reference-id="${esc(entry.id)}"><div class="referenceCardTop"><small>${({diagram:'内置示意',text:'文字参考',image:'图片',gif:'GIF 动图',video:'视频'})[referenceMediaKind(entry)]}${entry.hidden?' · 已隐藏':entry.modified&&entry.builtin?' · 已修改':''}</small>${referenceMediaKind(entry)==='video'?`<button data-reference-view="${esc(entry.id)}">放大播放</button>`:''}</div>${referenceMediaHTML(entry)}<b>${esc(entry.title)}</b><p>${esc(entry.note)}</p><small class="referenceDropHint">拖入媒体替换 · 或点击下方修改</small><button data-reference-edit="${esc(entry.id)}" class="full">修改 / 替换参考</button><div class="row referenceCardActions"><button data-reference-apply="${esc(entry.id)}" ${document.documentElement.dataset.referenceLibrary==='true'?'disabled title="请回工作台选定镜头后应用"':''}>${PROFESSIONAL[key]?'应用'+esc(PROFESSIONAL[key].label):'应用描述'}</button><button data-reference-remove="${esc(entry.id)}">${entry.builtin?'恢复 / 隐藏':'删除'}</button></div></article>`).join('')||'<p class="muted">没有匹配的参考。可以关闭筛选或添加自己的参考。</p>';
  $('referenceLibraryStatus').textContent=entries.length+' 条参考 · 图片 5MB / GIF 10MB / 视频 20MB';
 };
 const resetCards=()=>{referencePage=0;renderCards()};
 for(const id of ['referenceCategory','referenceOnlyMedia','referenceShowHidden'])$(id).onchange=resetCards;
 let searchTimer;$('referenceSearch').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if($('referenceCards')===cards)resetCards()},180)};
 $('referencePrevious').onclick=()=>{referencePage--;renderCards()};$('referenceNext').onclick=()=>{referencePage++;renderCards()};
 $('refreshVisualReferences').onclick=()=>safe(async()=>{await loadVisualCustom(true);if($('referenceCards')===cards)renderCards()});
 $('addCustomReference').onclick=()=>safe(()=>editVisualCustom($('referenceCategory').value));renderCards();
 const getEntry=id=>visualReferenceEntries($('referenceCategory').value).find(e=>e.id===id);
 $('referenceCards').onclick=e=>safe(async()=>{
  const view=e.target.closest('[data-reference-view]'),edit=e.target.closest('[data-reference-edit]'),apply=e.target.closest('[data-reference-apply]'),remove=e.target.closest('[data-reference-remove]');
  if(view){
   if(view.dataset.referenceRetry){const im=view.querySelector('img');delete view.dataset.referenceRetry;if(im)delete im.dataset.fallbackTried;view.querySelector('.referenceLoadError')?.remove();if(im){im.hidden=false;const source=im.src;im.src='';im.src=source}return}
   return openReferenceMedia(getEntry(view.dataset.referenceView));
  }
  if(edit)return editVisualCustom($('referenceCategory').value,getEntry(edit.dataset.referenceEdit));
  if(remove){const entry=getEntry(remove.dataset.referenceRemove);if(entry.builtin)return referenceBuiltinActions(entry);if(!confirm('删除这条自定义参考？已应用的镜头描述会保留。'))return;customReferences=await api('visual-references',{action:'delete',id:entry.id});renderCards();return}
  if(!apply)return;const entry=getEntry(apply.dataset.referenceApply),key=entry.category;
  if(!target.id||P?.projectId!==target.pid||seg()?.id!==target.sid||shot()?.id!==target.id)throw Error('先选定镜头，再重新打开参考库应用');
  if(PROFESSIONAL[key]){shot().professional||={};shot().professional[key]=entry.modified?entry.title+'：'+entry.note:entry.title}else{const old=shot()[key]||'';shot()[key]=$('referenceApplyMode').value==='replace'||!old?entry.note:old.trimEnd()+'\n'+entry.note}
  await edited();visualLibraryOpen++;close();toast('已应用：'+entry.title);
 });
 const cards=$('referenceCards');let importing=false;
 cards.addEventListener('error',e=>{
  const im=e.target;if(im.tagName!=='IMG')return;
  const box=im.closest('.referencePicture');if(!box)return;
  im.hidden=true;
  let status=box.querySelector('.referenceLoadError');
  if(!status){status=document.createElement('span');status.className='referenceLoadError';box.append(status)}
  const failedSource=im.getAttribute('src');
  if(failedSource?.startsWith('/reference-media/')&&!im.dataset.fallbackTried){
   im.dataset.fallbackTried='true';status.textContent='正在重新读取参考图片…';
   api('visual-reference-media',{id:box.dataset.referenceView}).then(result=>{
    if(!im.isConnected)return;status.remove();im.hidden=false;im.src=result.image;
   }).catch(error=>{if(im.isConnected){status.textContent='图片读取失败：'+error.message+'。请关闭后台终端并重新启动工作台。';box.dataset.referenceRetry='true'}});
  }else{status.textContent='图片读取失败 · 点击重试';box.dataset.referenceRetry='true'}
 },true);
 for(const name of ['dragenter','dragover'])cards.addEventListener(name,e=>{const card=e.target.closest('[data-reference-id]');if(!card)return;e.preventDefault();card.classList.add('referenceDragging')});
 cards.addEventListener('dragleave',e=>{const card=e.target.closest('[data-reference-id]');if(card&&!card.contains(e.relatedTarget))card.classList.remove('referenceDragging')});
 cards.addEventListener('drop',e=>{const card=e.target.closest('[data-reference-id]');if(!card)return;e.preventDefault();e.stopPropagation();card.classList.remove('referenceDragging');return safe(async()=>{
  if(importing)throw Error('正在保存上一条参考，请稍候');const files=[...e.dataTransfer.files];if(files.length!==1)throw Error('每条参考一次拖入一个文件');const entry=getEntry(card.dataset.referenceId),form=$('referenceCards');importing=true;
  try{const media=await readReferenceMedia(files[0]);if($('referenceCards')!==form)throw Error('参考界面已切换，请重新拖入');await saveVisualReference({...entry,image:media});if($('referenceCards')===form)renderCards();toast('参考媒体已替换并保存')}finally{importing=false}
 })});
};
async function readReferenceMedia(file){
 if(!file)throw Error('请选择参考媒体');const mime=({'png':'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',mp4:'video/mp4',webm:'video/webm'})[file.name.split('.').at(-1).toLowerCase()];
 if(!mime)throw Error('支持 PNG / JPG / WebP / GIF / MP4 / WebM');const limit=mime.startsWith('video/')?20:mime==='image/gif'?10:5;if(file.size>limit*1048576)throw Error('该参考媒体上限 '+limit+'MB');
 const raw=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('媒体读取失败'));reader.readAsDataURL(file)});
 return 'data:'+mime+';base64,'+raw.split(',')[1];
}
async function saveVisualReference(entry){
 const body={category:entry.category,title:entry.title,note:entry.note,image:entry.image||''};if(entry.id)body.id=entry.id;if(entry.builtin){body.builtin=entry.builtin;body.hidden=!!entry.hidden}
 if(entry.image?.startsWith('/reference-media/')){delete body.image;body.keepMedia=true}
 customReferences=await api('visual-references',body);visualCustomLoaded=true;return customReferences;
}
function openReferenceMedia(entry){
 if(!entry)return;if(referenceMediaKind(entry)!=='video')return openImageViewerSource(referenceMediaSource(entry),entry.title);
 let viewer=$('referenceMediaViewer');if(!viewer){viewer=document.createElement('dialog');viewer.id='referenceMediaViewer';viewer.className='referenceMediaViewer';document.body.append(viewer);viewer.addEventListener('close',()=>{viewer.querySelector('video')?.pause();viewer.innerHTML=''})}
 viewer.innerHTML=`<div class="modalhead"><h2>${esc(entry.title)}</h2><button id="closeReferenceMedia" aria-label="关闭视频参考">✕</button></div><video controls loop muted playsinline preload="metadata" src="${esc(entry.image)}"></video><p>${esc(entry.note)}</p><small>循环播放已开启；可用播放器进入全屏。不能播放时请换用 H.264 编码的 MP4。</small>`;
 $('closeReferenceMedia').onclick=()=>viewer.close();viewer.showModal();
}
function referenceBuiltinActions(entry){
 modal('内置参考 · '+entry.title,'<p>恢复默认会撤销这条参考的名称、说明与媒体修改。隐藏只影响参考库，已应用的镜头文字会保留。</p>',[{label:'返回',action:()=>openVisualReference(entry.category)},{label:entry.hidden?'取消隐藏':'隐藏此条',action:async()=>{await saveVisualReference({...entry,hidden:!entry.hidden});await openVisualReference(entry.category)}},{label:'恢复默认',action:async()=>{if(!confirm('恢复这条内置参考的默认内容？'))return;customReferences=await api('visual-references',{action:'delete',id:entry.id});await openVisualReference(entry.category)}}]);
}
async function editVisualCustom(category,item=null){
 visualLibraryOpen++;
 const entry=item?{...item}:{category,title:'',note:'',image:''};let picture=entry.image||'',reading=false;
 modal(item?'修改参考 · '+item.title:'添加参考',`<p class="muted">图片、GIF 或视频都可作为参考。媒体仅用于查看；应用到镜头时使用下方文字说明。</p><label>名称（必填）<input id="customRefTitle" maxlength="80" value="${esc(entry.title)}"></label><label>提示词 / 具体说明（必填）<textarea id="customRefNote" rows="5" maxlength="3000">${esc(entry.note)}</textarea></label><div id="customRefDrop" class="assetDrop" role="button" tabindex="0">拖入媒体或点击选择 · 图片 / GIF / MP4 / WebM</div><input id="customRefFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,.gif,.mp4,.webm"><p id="customRefStatus" class="muted">图片 5MB，GIF 10MB，视频 20MB；参考媒体合计约 100MB。</p><div id="customRefPreview"></div><button id="removeCustomRefImage">移除已添加媒体</button>`,[{label:'取消',action:()=>openVisualReference(category)},{label:'保存参考',class:'primary',action:async()=>{if(reading)throw Error('媒体尚未读完，请稍候');if($('customRefTitle')!==form)throw Error('编辑界面已切换，请重新打开参考');await saveVisualReference({...entry,title:$('customRefTitle').value,note:$('customRefNote').value,image:picture});await openVisualReference(category);toast('参考已保存，下次打开仍可使用')}}]);
 const form=$('customRefTitle'),renderPreview=()=>{$('customRefPreview').innerHTML=referenceMediaHTML({...entry,title:form.value||'参考预览',image:picture,mediaMissing:picture===entry.image&&entry.mediaMissing},true)};renderPreview();
 const read=async file=>{if(reading)throw Error('正在读取媒体，请稍候');reading=true;const status=$('customRefStatus');status.textContent='正在读取…';try{const data=await readReferenceMedia(file);if($('customRefTitle')!==form)return;picture=data;renderPreview();status.textContent='已读入，点击“保存参考”后永久保存'}catch(error){if($('customRefTitle')===form)status.textContent='读取失败：'+error.message;throw error}finally{reading=false}};
 $('customRefDrop').onclick=()=>$('customRefFile').click();$('customRefDrop').onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();$('customRefFile').click()}};
 $('customRefFile').onchange=e=>{const file=e.target.files[0];e.target.value='';safe(()=>read(file))};
 for(const event of ['dragenter','dragover'])$('customRefDrop').addEventListener(event,e=>{e.preventDefault();e.currentTarget.classList.add('referenceDragging')});
 $('customRefDrop').ondragleave=e=>e.currentTarget.classList.remove('referenceDragging');
 $('customRefDrop').ondrop=e=>{e.preventDefault();e.stopPropagation();e.currentTarget.classList.remove('referenceDragging');safe(async()=>{if(e.dataTransfer.files.length!==1)throw Error('一次拖入一个参考文件');await read(e.dataTransfer.files[0])})};
 $('removeCustomRefImage').onclick=()=>{if(reading)return;picture='';renderPreview()};
 $('customRefPreview').onclick=e=>{if(e.target.closest('[data-reference-view]'))openReferenceMedia({...entry,title:form.value||'参考预览',image:picture})};
}
$('modal').addEventListener('close',()=>{visualLibraryOpen++;for(const video of $('modalBody').querySelectorAll('video'))video.pause()});

/* Shared library, independent page; it never applies a shot from a stale project copy. */
$('visualLibrary').onclick=()=>{window.open('/reference-library.html','_blank','noopener')};
if(document.documentElement.dataset.referenceLibrary==='true'){
 const back=document.createElement('a');back.href='/';back.className='referenceBack';back.textContent='返回分镜工作台';document.querySelector('header').append(back);
 $('visualLibrary').textContent='打开参考库';$('visualLibrary').onclick=()=>safe(()=>openVisualReference('size'));
 let waits=0;const start=()=>{if(ready){safe(()=>openVisualReference('size'));return}if(++waits<200)setTimeout(start,50);else toast('初始化失败，请刷新页面或检查工作台服务')};start();
}
