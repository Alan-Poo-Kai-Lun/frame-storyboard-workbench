import {geometryLimits,clampDimension} from './node-geometry.js';
import {assetCategory,assetGroups} from './asset-groups.js';
import React,{memo,useEffect,useState,useRef,useCallback,useMemo} from 'react';
import {MediaPreview} from './media.jsx';
import {ContextMenu} from './context-menu.jsx';
import {Compare} from './compare.jsx';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {ReactFlow,ReactFlowProvider,Handle,Position,Background,MiniMap,Controls,NodeResizer,applyNodeChanges,SelectionMode,BaseEdge,getBezierPath,getSmoothStepPath,getStraightPath} from '@xyflow/react';

const C=React.createContext(null),useApp=()=>React.useContext(C);
const textFieldClass='nodrag nopan nowheel';
const category=assetCategory;
const SEMANTIC={story:'#38bdf8',character:'#c084fc',scene:'#fbbf24',audio:'#fb923c',other:'#2dd4bf'};
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
// The appearance panel offers these endpoint glyphs; the legacy SVG canvas already
// draws them, so the React Flow canvas reuses the same shapes as SVG markers.
const ARROW_TYPES=['chevron2','chevron3','diamond','crosshair','chiseled','pulse','filled','open','dot','none','clapper','fork','jack','radar'];
const LINE_EFFECTS=['none','pulse','dual','neon','ants','comet','breathing','grain'];
const isHex=v=>/^#[0-9a-f]{6}$/i.test(String(v||''));
const markerKey=(type,color)=>'rfa-arrow-'+type+'-'+String(color).replace(/[^0-9a-z]/gi,'').toLowerCase();
const arrowShape=(type,color)=>{const body=window.frameCanvasEdge?.shape?.(type,true)||'<polygon points="-5,-4 3,0 -5,4"/>';return '<g stroke="'+color+'" fill="'+color+'" stroke-width="1.5" stroke-linejoin="round">'+body+'</g>'};
const MARKER_BOX='markerWidth="40" markerHeight="24" viewBox="-12 -8 28 16" refX="16" refY="0" orient="auto" markerUnits="userSpaceOnUse" overflow="visible"';
function RfaEdge({id,sourceX,sourceY,targetX,targetY,sourcePosition,targetPosition,markerEnd,style,data}){
 const route=data?.route||'default';let path='';
 if(route==='straight')[path]=getStraightPath({sourceX,sourceY,targetX,targetY});
 else if((route==='pcb'||route==='orthogonal')&&window.frameCanvasEdge?.path)path=window.frameCanvasEdge.path(route,sourceX,sourceY,targetX,targetY);
 else if(route==='smoothstep')[path]=getSmoothStepPath({sourceX,sourceY,targetX,targetY,sourcePosition,targetPosition,borderRadius:data?.radius||6});
 else[path]=getBezierPath({sourceX,sourceY,targetX,targetY,sourcePosition,targetPosition});
 const fx=data?.fx&&data.fx!=='none'?'rfa-fx-'+data.fx:'';
 const flow=data?.flow&&data.flowShape?data.flowShape+'<animateMotion dur="'+data.duration+'s" repeatCount="indefinite" rotate="auto"><mpath href="#'+id+'"/></animateMotion>':'';
 return <>
  <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} className={fx}/>
  {flow?<g className="rfa-flow-mark" dangerouslySetInnerHTML={{__html:flow}}/>:null}
 </>;
}
const edgeTypes={rfa:RfaEdge};

function Port({source=false,id,color}){return <Handle type={source?'source':'target'} id={id||(source?'out':'in')} position={source?Position.Right:Position.Left} style={{background:color||'var(--rfa-accent)',borderColor:color||'var(--rfa-accent)'}}/>}
function CardResizer({id,selected}){const a=useApp(),limits=a.nodeLimits(id);return <NodeResizer minWidth={limits.minWidth} minHeight={limits.minHeight} isVisible={selected} color="var(--rfa-accent)" onResizeStart={()=>a.startResize(id)} onResizeEnd={()=>a.endResize()}/>}
function Check({id,label}){const a=useApp();return <input className={textFieldClass} type="checkbox" aria-label={'选择'+label} checked={a.checked.has(id)} onChange={e=>{e.stopPropagation();a.check(id,e.target.checked)}} onClick={e=>e.stopPropagation()}/>}
function Edit({id,field,value,label,rows=2}){const a=useApp();return <label className="rfa-edit-label">{label}<textarea className={textFieldClass} aria-label={label} rows={rows} value={a.drafts.get(id)?.fields[field]??value??''} onChange={e=>a.change(id,field,e.target.value)} onBlur={()=>a.commit(id)} onKeyDown={e=>{e.stopPropagation();if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();a.commit(id)}}}/></label>}
function Choice({id,field,value,label,options}){const a=useApp(),current=a.drafts.get(id)?.fields[field]??value??'';if(current&&!options.some(([key])=>key===current))options=[...options,[current,current.split('/').at(-1)+'（已保存）']];return <label className="rfa-edit-label">{label}<select className={textFieldClass} aria-label={label} value={a.drafts.get(id)?.fields[field]??value??''} onChange={e=>{a.change(id,field,e.target.value);a.commit(id)}}>{options.map(([key,title])=><option key={key} value={key}>{title}</option>)}</select></label>}
function Generation({id,item}){const a=useApp(),global=a.H.project().generation?.taskType||'r2v',mode=a.drafts.get(id)?.fields.genTask??a.H.mode(item);if(['v2v','rv2v'].includes(global))return <div className="rfa-inline-fields"><strong>项目源视频模式 · {global.toUpperCase()}</strong><button className={textFieldClass} onClick={()=>a.H.generation()}>项目模式设置</button></div>;const inputs=[['','未指定'],...a.H.imageInputs(item)];return <div className="rfa-inline-fields rfa-generation"><Choice id={id} field="genTask" label="本段生成模式" value={a.H.mode(item)} options={a.H.modes()}/>{(mode==='i2v'?[['genImage','I2V 输入图片']]:mode==='fl2v'?[['startImage','FL2V 首帧'],['endImage','FL2V 尾帧']]:[]).map(([key,label])=><Choice key={key} id={id} field={'gen_'+key} label={label} value={a.H.fieldValue(id,'gen_'+key)} options={inputs}/>)}<small>{mode==='i2v'?'需指定输入图片':mode==='fl2v'?'需指定首帧或尾帧':'使用现有参考与生成规则'}</small></div>}
function FinalPrompt({id,item,selected}){
 const a=useApp(),[output,setOutput]=useState(item.prompt||''),[message,setMessage]=useState('读取最终输出…');
 useEffect(()=>{let live=true;setMessage('读取最终输出…');a.H.compiledPrompt(item.id).then(value=>{if(live){setOutput(value);setMessage('与当前镜头及素材同步')}}).catch(error=>{if(live)setMessage('读取失败：'+error.message+'；已保留原提示词')});return()=>{live=false}},[item.id,item.prompt]);
 return <article className={'rfa-card rfa-prompt '+(selected?'chosen':'')} data-rfa-id={id}><CardResizer id={id} selected={selected}/><Port color={SEMANTIC.story}/><header className="rfa-drag"><strong>H3 最终提示词</strong><small>{item.shots.length} 镜头</small></header><div className="rfa-inline-fields"><label className="rfa-edit-label">最终提示词<textarea className={textFieldClass} aria-label="最终提示词" value={output} rows={20} readOnly/></label><small role="status">{a.drafts.get(id)?.error||message}</small></div><footer><button className={textFieldClass} onClick={()=>a.H.copyPrompt(item.id,output).catch(()=>{})}>复制最终提示词</button><button className={textFieldClass} onClick={()=>a.select(id)}>查看 / 编辑</button></footer></article>;
}
const StoryNode=memo(function({id,data,selected}){
 const a=useApp(),{kind,item,segment,index}=data;
 if(kind==='prompt')return <FinalPrompt id={id} item={item} selected={selected}/>;
 if(kind==='text')return <article className="rfa-card flow-note" data-rfa-id={id}><CardResizer id={id} selected={selected}/><header className="rfa-drag"><Check id={id} label="文字便签"/><strong>文字便签</strong></header><textarea className={textFieldClass} aria-label="便签内容" value={item.text} onChange={e=>a.noteChange(item.id,e.target.value)} /></article>;
 if(kind==='group'||kind==='segment-group')return <div className={'rfa-group '+(data.collapsed?'rfa-collapsed ':'')+(selected?'chosen':'')} data-rfa-group={id} data-asset-category={data.categoryGroup||undefined}>
  <NodeResizer minWidth={data.minWidth||300} minHeight={data.collapsed?60:data.minHeight||230} isVisible={selected&&!data.collapsed} color="var(--rfa-accent)" onResizeStart={()=>a.startResize(id)} onResizeEnd={()=>a.endResize()}/>
  <header className="rfa-drag"><strong>{data.title}</strong><small>{data.count} 项</small><button className={textFieldClass} onClick={()=>a.collapseGroup(id)}>{data.collapsed?'展开':'折叠'}</button><button className={textFieldClass} aria-label="缩小素材区" onClick={()=>a.resizeNode(id,-60)}>−</button><button className={textFieldClass} aria-label="放大素材区" onClick={()=>a.resizeNode(id,60)}>＋</button><button className={textFieldClass} onClick={()=>a.gallery(id)}>⤢</button>{kind==='group'&&<button className={textFieldClass} onClick={()=>a.addAsset(data.segmentId?{segmentId:data.segmentId}:{})}>＋ 素材</button>}</header><Port/>
  {!data.count&&!data.collapsed&&<div className="rfa-empty">拖入图片、音频或视频<br/>也可点击“＋ 素材”</div>}<Port source/>
 </div>;
 if(kind==='asset')return <article className={'rfa-card rfa-asset '+(selected?'chosen':'')} data-rfa-id={id} data-rfa-replace={item.id}>
  <CardResizer id={id} selected={selected}/>
  <header className="rfa-drag"><Check id={id} label={'素材 '+item.name}/><strong>{item.name}</strong><small>{item.kind}</small></header>
  <div className="rfa-media"><MediaPreview src={data.src} type={data.mediaType} name={item.name} interactive onOpen={()=>a.preview(item)}/></div>
  <div className="rfa-inline-fields"><Edit id={id} field="name" value={item.name} label="素材名称" rows={1}/><Edit id={id} field="description" value={item.description} label="素材说明" rows={2}/>{a.drafts.get(id)?.error&&<small className="rfa-draft-status">{a.drafts.get(id).error}</small>}</div>
  <footer><span>{data.label} · {item.scope==='segment'?'本组':'公共'}</span><button className={textFieldClass} onClick={()=>a.preview(item)}>查看</button><button className={textFieldClass} onClick={()=>a.addAsset({assetId:item.id})}>替换</button></footer><Port source color={SEMANTIC[category(item)]}/>
 </article>;
 if(kind==='result')return <article className={'rfa-card rfa-result '+(selected?'chosen':'')} data-rfa-id={id} data-result-segment={segment.id} data-result-shot={data.shotId||''}><CardResizer id={id} selected={selected}/><Port color={SEMANTIC.story}/><header className="rfa-drag"><strong>{data.title}</strong><button className={textFieldClass} onClick={()=>a.addResult({segmentId:segment.id,shotId:data.shotId})}>＋ 导入成片</button><button className={textFieldClass} disabled={data.videos.length<2} onClick={()=>a.compare(data.videos,data.title)}>并排对比</button></header><div className="flow-result-versions">{data.videos.map((v,i)=><section key={v.id} data-result-version={'v:'+segment.id+':'+v.id} onContextMenu={e=>a.menuAt(e,'v:'+segment.id+':'+v.id)}><strong>{i+1} · {v.title||v.name}</strong>{v.shotId&&!segment.shots.some(h=>h.id===v.shotId)&&<small>原关联镜头已删除，视频保留</small>}<MediaPreview src={a.H.media(v)} type="video" name={v.title||v.name} interactive onOpen={()=>a.preview({...v,name:v.title||v.name})}/><button className={textFieldClass} onClick={()=>a.select('v:'+segment.id+':'+v.id)}>名称 / 备注</button><button className={textFieldClass} onClick={()=>a.deleteSelection('v:'+segment.id+':'+v.id)}>删除此版本</button></section>)}</div></article>;
 if(kind==='project')return <article className="rfa-card rfa-project" data-rfa-id={id}><CardResizer id={id} selected={selected}/><header className="rfa-drag"><strong>{item.title||'未命名项目'}</strong></header><p>{data.count} 个片段 · 共 {data.shots} 镜头</p><button className={textFieldClass} onClick={()=>a.command('project','add-segment')}>＋ 添加片段</button><Port source color={SEMANTIC.story}/></article>;
 if(kind==='segment')return <article className={'rfa-card rfa-segment '+(selected?'chosen':'')} data-rfa-id={id}><CardResizer id={id} selected={selected}/><Port color={SEMANTIC.story}/><Port source color={SEMANTIC.story}/>
  <header className="rfa-drag"><Check id={id} label={'片段 '+(index+1)}/><strong>片段 {String(index+1).padStart(2,'0')}</strong><span>{item.duration} 秒</span></header>
  <Generation id={id} item={item}/><div className="rfa-inline-fields"><Edit id={id} field="title" value={item.title} label="片段名称" rows={1}/><Edit id={id} field="story" value={a.H.text(item.storyText||'',item)} label="片段故事" rows={4}/><label className="rfa-edit-label">时长 / 秒<input className={textFieldClass} type="number" min="1" max="600" aria-label="片段时长秒数" value={a.drafts.get(id)?.fields.duration??item.duration} onChange={e=>a.change(id,'duration',e.target.value)} onBlur={()=>a.commit(id)}/></label>{a.drafts.get(id)?.error&&<small className="rfa-draft-status">{a.drafts.get(id).error}</small>}</div><p>{item.shots.length} 镜头 · {(item.videos||[]).length} 成片</p>
  <div className="rfa-actions"><button className={textFieldClass} aria-expanded={a.expanded.has(item.id)} onClick={()=>a.expand(item.id)}>{a.expanded.has(item.id)?'收起镜头':'展开镜头'}</button><button className={textFieldClass} onClick={()=>a.focusShot(item.id)}>查看镜头 →</button><button className={textFieldClass} onClick={()=>a.addResult({segmentId:item.id})}>＋ 本段成片</button></div>
 </article>;
 const sh=item,ref=data.refs;
 return <article className={'rfa-card rfa-shot '+(selected?'chosen':'')} data-rfa-id={id}><CardResizer id={id} selected={selected}/>
  <Port color={SEMANTIC.story}/><Port source color={SEMANTIC.story}/>
  <header className="rfa-drag"><Check id={id} label={'镜头 '+(index+1)}/><strong>镜头 {String(index+1).padStart(2,'0')}</strong><small>{sh.start}–{sh.end}s</small><button className={textFieldClass} aria-label="镜头更多操作" onClick={e=>a.menuAt(e,id)}>•••</button></header>
  <div className="rfa-shot-preview" onDoubleClick={()=>a.select(id)}>{data.src?<img draggable="false" loading="lazy" src={data.src} alt={'镜头 '+(index+1)}/>:<span>尚未生成分镜图<br/><small>{a.H.text(sh.camera,segment)||'点卡片查看完整配置'}</small></span>}</div>
  <div className="rfa-shot-fields"><Edit id={id} field="action" value={a.H.text(sh.action,segment)} label="画面动作" rows={3}/><Edit id={id} field="camera" value={a.H.text(sh.camera,segment)} label="摄影机" rows={2}/><Edit id={id} field="dialogue" value={sh.dialogue} label="角色对白"/><Edit id={id} field="language" value={sh.dialogueLanguage||''} label="对白语言" rows={1}/><small>留空继承本段 / 项目对白语言</small><strong>镜头起止空间状态</strong><Edit id={id} field="startState" value={a.H.text(sh.startState,segment)} label="起始位置 / 朝向 / 姿态"/><Edit id={id} field="endState" value={a.H.text(sh.endState,segment)} label="结束位置 / 动作结果"/>
   <div className="rfa-time"><label>开始 / 秒<input aria-label="镜头开始秒数" className={textFieldClass} type="number" min="0" max={segment.duration} step=".1" value={a.drafts.get(id)?.fields.start??sh.start} onChange={e=>a.change(id,'start',e.target.value)} onBlur={()=>a.commit(id)}/></label><label>结束 / 秒<input aria-label="镜头结束秒数" className={textFieldClass} type="number" min="0" max={segment.duration} step=".1" value={a.drafts.get(id)?.fields.end??sh.end} onChange={e=>a.change(id,'end',e.target.value)} onBlur={()=>a.commit(id)}/></label></div>
  <button className={textFieldClass} onClick={()=>a.addResult({segmentId:segment.id,shotId:sh.id})}>＋ 导入该镜头成片</button></div><footer className="rfa-refs">{ref.length?ref.map(r=><button className={textFieldClass} key={r.id} title={r.name} style={{borderColor:SEMANTIC[category(r)]}} onMouseEnter={e=>a.refHover(r,e)} onMouseLeave={()=>a.refHover(null)} onFocus={e=>a.refHover(r,e)} onBlur={()=>a.refHover(null)} onClick={()=>a.preview(r)}>{r.name}</button>):<small>拖素材输出端点到左侧，绑定参考</small>}</footer>
  {a.drafts.has(id)&&<small className="rfa-draft-status">{a.drafts.get(id).error||'草稿未保存 · 失焦或 Ctrl+Enter 保存'}</small>}
 </article>;
});
const nodeTypes={story:StoryNode};

function App({H,nav,expose}){
 const [nodes,setNodes]=useState([]),[edges,setEdges]=useState([]),[tick,force]=useState(0),[menu,setMenu]=useState(null),[popup,setPopup]=useState(null),[hoverRef,setHoverRef]=useState(null),[zoom,setZoom]=useState(1),[pan,setPan]=useState(false),[status,setStatus]=useState('本地项目 · 拖动标题移动卡片，空格拖动画布'),[theme,setThemeState]=useState(document.documentElement.dataset.theme||'light'),[markerMarkup,setMarkerMarkup]=useState('');
 const ref=useRef({H,initialized:false,nodes:[],edges:[],positions:{},sizes:{},expanded:new Set(),checked:new Set(),drafts:new Map(),cache:new Map(),instance:null,owner:'',timer:0,op:Promise.resolve(),hover:'',selection:[],viewport:null,ready:false,disposed:false,mode:'canvas',views:{},collapsedGroups:new Set(),notes:[],layoutUndo:[],lastSelected:'',lastPointer:null,dragging:false,coordinateVersion:3,legacyViews:null}),m=ref.current;
 const container=useRef(null),file=useRef(null),fileTarget=useRef({}),resultFile=useRef(null),resultTarget=useRef({}),navBody=useRef(null),defsSvg=useRef(null),backdropRef=useRef(null),backdropNextRef=useRef(null),particlesRef=useRef(null),backdropVideoRef=useRef(null);
 const update=()=>force(v=>v+1);
 function fail(e){setStatus('未完成：'+e.message);H.notice(e.message);return false}
 function enqueue(fn){const work=m.op.catch(()=>{}).then(fn);m.op=work.catch(()=>{});return work.catch(fail)}
 function project(){return H.project()}
 function viewSnapshot(){return {coordinateVersion:3,positions:Object.fromEntries(m.nodes.map(n=>[n.id,{...n.position}])),sizes:structuredClone(m.sizes),expanded:[...m.expanded],collapsedGroups:[...m.collapsedGroups],viewport:m.instance?.getViewport()||m.viewport,assetGroupsVersion:1,promptNodesVersion:1,legacyAssetPositions:m.legacyAssetPositions}}
 function snapshot(){m.views[m.mode]=viewSnapshot();return {version:3,mode:m.mode,views:m.views,legacyViews:m.legacyViews,notes:m.notes,checked:[...m.checked],projectId:project().projectId}}
 function loadView(v={}){m.promptNodesVersion=v.promptNodesVersion||0;m.assetGroupsVersion=v.assetGroupsVersion||0;m.legacyAssetPositions=v.legacyAssetPositions;m.positions=structuredClone(v.positions||{});m.sizes=structuredClone(v.sizes||{});m.expanded=new Set(v.expanded||project().segments.slice(0,1).map(s=>s.id));m.collapsedGroups=new Set(v.collapsedGroups||[]);m.viewport=v.viewport;m.coordinateVersion=v.coordinateVersion||2;m.cache.clear()}
 function migratePositions(positions={}){return Object.fromEntries(Object.entries(positions).filter(([,p])=>finitePoint(p)).map(([id,p])=>[id==='asset-board'?'board:public':id,{...p}]))}
 function modeChange(mode){return ready(async()=>{if(mode==='free')mode='canvas';if(!['canvas','cards'].includes(mode)||mode===m.mode)return;await save();m.mode=mode;loadView(m.views[mode]||{coordinateVersion:3});m.initialized=false;setMenu(null);H.modeLabel(mode);build();initialView();scheduleSave()})}

 function scheduleSave(){clearTimeout(m.timer);m.timer=setTimeout(()=>enqueue(save),500)}
 async function save(){clearTimeout(m.timer);if(m.owner!==project()?.projectId)throw Error('项目已切换，布局未写入其他项目');await H.saveLayout(snapshot());setStatus(m.drafts.size?'有未保存的输入，请核对提示':'布局已保存 · 同一张画布，片段点击只定位或展开');return true}
 function checkOwner(){const p=project();if(m.owner===p.projectId)return;m.lastSelected='';m.resizeSession='';const saved=H.layout();m.owner=p.projectId;m.mode=saved.mode==='cards'?'cards':'canvas';m.legacyViews=saved.legacyViews||((saved.version||0)<3?structuredClone(saved.views||saved):null);m.views=structuredClone(saved.views||{});if(saved.mode==='free'&&m.views.free)m.views.canvas=structuredClone(m.views.free);if(saved.positions)m.views.canvas||={...saved,positions:migratePositions(saved.positions)};m.notes=structuredClone(saved.notes||[]);loadView(m.views[m.mode]||{positions:migratePositions(project().overviewLayout?.canvas37?.positions||{})});m.checked=new Set(saved.checked||[]);m.drafts.clear();m.initialized=false;H.modeLabel(m.mode)}
 function resolveRefs(sh,s){const all=H.scoped(s),fields=['action','camera','expression','dialogue','sound'].map(k=>sh[k]||'').join(' '),explicit=(sh.referenceNumbers||[]).length||(sh.assetIds||[]).length||/(?:Picture|Subject)\s+\d+/i.test(fields),text=explicit?fields:fields+' '+(s.storyText||''),nums=new Set([...(sh.referenceNumbers||[]),...[...text.matchAll(/(?:Picture|Subject)\s+(\d+)/gi)].map(x=>+x[1])]);return all.filter(a=>(H.mediaType(a)==='image'&&(nums.has(H.number(a))||(sh.assetIds||[]).includes(a.id)))||(sh.mediaAssetIds||[]).includes(a.id)||H.mediaType(a)!=='image'&&String(sh.sound||'').includes('<'+(H.mediaType(a)==='audio'?'Audio':'Video')+' '+(project().assets.filter(x=>!x.deleted&&H.mediaType(x)===H.mediaType(a)).indexOf(a)+1)+'>'))}
 function build(){
  checkOwner();m.popup=popup;const p=project(),ap=H.appearance();m.ap=ap;
  const assets=p.assets.filter(a=>!a.deleted),list=[],links=[],priorNodes=new Map(m.nodes.map(n=>[n.id,n]));
  if(!m.promptNodesVersion){for(const id of Object.keys(m.positions))if(id.startsWith('p:'))delete m.positions[id];m.promptNodesVersion=1}
  if(!m.assetGroupsVersion){m.legacyAssetPositions=Object.fromEntries(Object.entries(m.positions).filter(([id])=>id.startsWith('a:')));for(const id of Object.keys(m.legacyAssetPositions))delete m.positions[id];m.assetGroupsVersion=1}

  function add(id,kind,item,position,extra={},parentId){const old=priorNodes.get(id);if(kind==='asset'&&old?.parentId&&old.parentId!==parentId)delete m.positions[id];let pos=m.positions[id]||position;
   if(parentId&&m.coordinateVersion<3&&m.positions[id]){const parent=list.find(n=>n.id===parentId),w=kind==='asset'?228:kind==='segment'?275:350,h=kind==='asset'?450:kind==='segment'?430:640;const fits=q=>q.x>=0&&q.y>=50&&q.x+w<=parent.style.width&&q.y+h<=parent.style.height;if(!fits(pos)){const converted={x:pos.x-parent.position.x,y:pos.y-parent.position.y};pos=fits(converted)?converted:position;m.positions[id]={...pos}}}
   if(parentId){pos={x:Math.max(12,pos.x),y:Math.max(55,pos.y)}}
   const raw={kind,item, ...extra};
   // Media data and the entire parent segment are not serialized per shot.
   // Parent ID/duration are the card's only segment rendering dependencies.
   const signature=JSON.stringify({...raw,src:undefined,segment:extra.segment?{id:extra.segment.id,duration:extra.segment.duration}:undefined},(k,v)=>k==='media'||k==='originalZip'?undefined:v),cached=m.cache.get(id),data=cached?.signature===signature&&cached.src===raw.src?cached.data:raw;m.cache.set(id,{signature,src:raw.src,data});
   const size=m.sizes[id],style=['group','segment-group'].includes(kind)?{width:extra.collapsed?(extra.categoryGroup?300:420):size?.width||extra.width||540,height:extra.collapsed?60:size?.height||extra.height||280}:{width:size?.width||(kind==='shot'?350:kind==='asset'?228:kind==='project'?235:kind==='text'?300:kind==='result'?660:kind==='prompt'?460:275),...(kind==='asset'?{height:Math.max(450,size?.height||450)}:size?.height?{height:Math.max(geometryLimits({data:{kind}}).minHeight,size.height)}:{})};
   list.push({...old,id,type:'story',className:size?.height&&!['group','segment-group'].includes(kind)?'rfa-sized-node':'',data,position:finitePoint(pos)?pos:position,parentId,style,dragHandle:'.rfa-drag',selected:m.checked.has(id),hidden:parentId&&(m.collapsedGroups.has(parentId)||list.find(n=>n.id===parentId)?.hidden),extent:parentId?'parent':undefined,zIndex:['group','segment-group'].includes(kind)?0:2});
  }
  const publicAssets=assets.filter(a=>a.scope!=='segment'),parents=new Map();
  const route=ap.lineStyle==='straight'?'straight':['orthogonal','pcb'].includes(ap.lineStyle)?ap.lineStyle:['rounded','bus'].includes(ap.lineStyle)?'smoothstep':'default';
  // Every connector control is resolved once here so the panel, the edge list and
  // the marker <defs> cannot drift apart.
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||ap.reduceMotion===true;
  const arrowType=ARROW_TYPES.includes(ap.arrowType)?ap.arrowType:'chevron2';
  const hierarchical=ap.hierarchy!==false&&ap.lineStyle!=='default';
  const arrowColor=isHex(ap.arrowColor)?ap.arrowColor:'';
  const lineColor=isHex(ap.lineColor)?ap.lineColor:SEMANTIC.story;
  const effect=LINE_EFFECTS.includes(ap.lineEffect)?ap.lineEffect:'none';
  const dash=ap.lineStyle==='dotted'?'2 5':undefined;
  const duration=6/Math.max(.1,Math.min(5,Number(ap.arrowSpeed)||1));
  const flowOn=ap.flow!==false&&!reduced&&ap.lineStyle!=='hidden';
  const markers=new Map();
  function edge(source,target,kind='story'){const proxy=id=>{let current=id;while(parents.has(current)){current=parents.get(current);if(m.collapsedGroups.has(current))id=current}return id};source=proxy(source);target=proxy(target);if(source===target||links.some(e=>e.source===source&&e.target===target))return;
   const color=kind==='story'?lineColor:(SEMANTIC[kind]||lineColor),type=arrowType==='none'?null:(hierarchical?(kind==='story'?'chevron2':'diamond'):arrowType),markColor=arrowColor||color,key=type?markerKey(type,markColor):'';
   if(type&&!markers.has(key))markers.set(key,{id:key,type,color:markColor});
   links.push({id:source+'>'+target,source,target,sourceHandle:'out',targetHandle:'in',type:'rfa',zIndex:1,selectable:false,focusable:false,className:'rfa-edge'+(kind==='story'?' rfa-edge-story':' rfa-edge-'+kind),style:{stroke:color,'--rfa-edge':color,display:ap.lineStyle==='hidden'?'none':undefined,strokeWidth:kind==='story'?2.4:1.6,strokeDasharray:dash||(kind==='story'?undefined:'5 5'),opacity:kind==='story'?.85:.58},markerEnd:type?key:undefined,data:{category:kind,route:kind==='story'?route:'default',radius:ap.lineStyle==='rounded'?18:6,fx:effect,flow:flowOn,flowShape:type&&links.length<90?arrowShape(type,markColor):'',duration,baseOpacity:kind==='story'?.85:.58,baseWidth:kind==='story'?2.4:1.6}})}
  function board(id,title,rows,position,segmentId,parentId){
   const frames=assetGroups(rows,m.sizes,id.slice(6));
   const width=Math.max(420,frames.reduce((w,g)=>w+(m.collapsedGroups.has(g.gid)?300:Math.max(g.width,m.sizes[g.gid]?.width||0))+24,15)),height=Math.max(110,...frames.map(g=>m.collapsedGroups.has(g.gid)?140:Math.max(g.height,m.sizes[g.gid]?.height||0)+85));
   if(parentId)parents.set(id,parentId);add(id,'group',null,position,{title,count:rows.length,segmentId,assetIds:rows.map(a=>a.id),width,height,collapsed:m.collapsedGroups.has(id)},parentId);
   let x=15;
   for(const g of frames){parents.set(g.gid,id);add(g.gid,'group',null,{x,y:60},{title:g.label,count:g.rows.length,segmentId,assetIds:g.rows.map(a=>a.id),categoryGroup:g.key,width:g.width,height:g.height,collapsed:m.collapsedGroups.has(g.gid)},id);
    for(const [i,a] of g.rows.entries()){const key='a:'+a.id;parents.set(key,g.gid);add(key,'asset',a,{x:15+(i%g.columns)*(g.cellWidth+18),y:60+Math.floor(i/g.columns)*(g.cellHeight+24)},{src:H.media(a),mediaType:H.mediaType(a),label:H.mediaType(a)==='image'?'Picture '+H.number(a):H.mediaType(a)==='audio'?'声音参考':'视频参考'},g.gid)}
    x+=(m.collapsedGroups.has(g.gid)?300:Math.max(g.width,m.sizes[g.gid]?.width||0))+24;
   }
   return m.collapsedGroups.has(id)?60:Math.max(height,m.sizes[id]?.height||0)
  }
  const publicHeight=board('board:public','公共素材',publicAssets,{x:400,y:-350}),storyTop=Math.max(0,publicHeight-300);
  add('project','project',{title:p.title},{x:30,y:storyTop+50},{count:p.segments.length,shots:p.segments.reduce((n,s)=>n+s.shots.length,0)});
  let y=storyTop;
  for(const [i,seg]of p.segments.entries()){
   const sid='s:'+seg.id,local=assets.filter(a=>a.scope==='segment'&&a.segmentId===seg.id),open=m.expanded.has(seg.id),rowHeight=1120;
   let base={x:400,y},parent;
   if(m.mode==='cards'){parent='card:'+seg.id;add(parent,'segment-group',null,{x:400,y},{title:seg.title||'片段 '+(i+1),count:seg.shots.length,width:420,height:100,collapsed:m.collapsedGroups.has(parent)});parents.set(sid,parent);base={x:15,y:65}}
   add(sid,'segment',seg,base,{index:i},parent);edge('project',sid);
   const segmentHeight=list.find(n=>n.id===sid)?.measured?.height||620;let localHeight=0;if(local.length)localHeight=board('board:'+seg.id,'本组素材 · '+(seg.title||'片段 '+(i+1)),local,{x:base.x,y:base.y+segmentHeight+32},seg.id,parent);
   for(const asset of H.scoped(seg))edge('a:'+asset.id,sid,category(asset));
   let shotX=base.x+(m.sizes[sid]?.width||275)+48;
   if(open)for(const [j,sh]of seg.shots.entries()){const id='h:'+seg.id+':'+sh.id,refs=resolveRefs(sh,seg),position={x:shotX,y:base.y};shotX+=(m.sizes[id]?.width||350)+28;if(parent)parents.set(id,parent);add(id,'shot',sh,position,{segment:seg,index:j,refs,src:H.media(sh.image||sh.firstFrame)},parent);edge(j?'h:'+seg.id+':'+seg.shots[j-1].id:sid,id);for(const a of refs)edge('a:'+a.id,id,category(a))}
   const promptId='p:'+seg.id;if(parent)parents.set(promptId,parent);add(promptId,'prompt',seg,{x:shotX,y:base.y},{segment:seg},parent);edge(open&&seg.shots.length?'h:'+seg.id+':'+seg.shots.at(-1).id:sid,promptId);shotX+=(m.sizes[promptId]?.width||460)+28;
   if(open){const scopes=seg.shots.map((h,j)=>({shotId:h.id,title:'镜头 '+String(j+1).padStart(2,'0')+' · 成片',source:'h:'+seg.id+':'+h.id,videos:(seg.videos||[]).filter(v=>v.shotId===h.id)}));scopes.push({title:'本段 / 未关联镜头成片',source:sid,videos:(seg.videos||[]).filter(v=>!v.shotId||!seg.shots.some(h=>h.id===v.shotId))});let resultY=m.mode==='cards'?65:base.y;for(const scope of scopes.filter(x=>x.videos.length)){const rid='r:'+seg.id+':'+(scope.shotId||'segment');if(parent)parents.set(rid,parent);add(rid,'result',null,{x:shotX+48,y:resultY},{segment:seg,shotId:scope.shotId,title:scope.title,videos:scope.videos},parent);edge(scope.source,rid);resultY+=Math.ceil(scope.videos.length/2)*360+100}}
   // Grow frames around their children in relative coordinates; never shrink a
   // frame past manually placed content, or relocate the user's root nodes.
   const descendants=list.filter(n=>n.parentId===parent&&parent);let frameHeight=0;
   if(parent){const frame=list.find(n=>n.id===parent);if(!frame.data.collapsed)for(const child of descendants){const height=child.style.height||child.measured?.height||(child.data.kind==='segment'?620:child.data.kind==='result'?Math.ceil(child.data.videos.length/2)*360+70:1040);frame.style.width=Math.max(frame.style.width,child.position.x+child.style.width+20);frame.style.height=Math.max(frame.style.height,child.position.y+height+25)}if(frame.data.collapsed)frame.style.height=60;frameHeight=frame.style.height}
   y+=m.mode==='cards'?frameHeight+70:Math.max(segmentHeight+70,localHeight?localHeight+segmentHeight+102:0,...list.filter(n=>n.id.startsWith('h:'+seg.id+':')||n.id.startsWith('r:'+seg.id+':')||n.id==='p:'+seg.id).map(n=>n.position.y-base.y+(n.measured?.height||(n.data.kind==='result'?Math.ceil(n.data.videos.length/2)*360+100:1040))+70));
  }
  // Bottom-up bounds include nested local material boards. Collapsed parents
  // keep their saved expanded dimensions, but do not render descendants.
  for(const frame of [...list].reverse().filter(n=>['group','segment-group'].includes(n.data.kind))){if(frame.data.collapsed){frame.style={width:frame.data.categoryGroup?300:420,height:60};frame.width=frame.style.width;frame.height=60;frame.measured={width:420,height:60};continue}let w=frame.data.categoryGroup?360:420,h=100;for(const child of list.filter(n=>n.parentId===frame.id)){w=Math.max(w,child.position.x+child.style.width+20);h=Math.max(h,child.position.y+(child.style.height||child.measured?.height||(child.data.kind==='asset'?450:child.data.kind==='segment'?620:child.data.kind==='result'?Math.ceil(child.data.videos.length/2)*360+70:1040))+25)}frame.data={...frame.data,minWidth:w,minHeight:h};frame.style.width=Math.max(frame.style.width,w);frame.style.height=Math.max(frame.style.height,h);frame.width=frame.style.width;frame.height=frame.style.height;frame.measured={...frame.style}}
  m.coordinateVersion=3;
  for(const [i,n]of m.notes.entries())add('t:'+n.id,'text',n,{x:200+i*330,y:250});
  const live=new Set(list.map(n=>n.id));m.checked=new Set([...m.checked].filter(id=>live.has(id)));
  m.nodes=list;m.edges=links;setNodes(list);setEdges(links);
  const markup=[...markers.values()].map(mk=>'<marker id="'+mk.id+'" '+MARKER_BOX+'>'+arrowShape(mk.type,mk.color)+'</marker>').join('');
  m.markerMarkup=markup;setMarkerMarkup(markup);
  update();applyAppearance();notifyGeometry();
 }
 function applyAppearance(){const a=H.appearance(),root=container.current,dialog=root?.closest('dialog');if(!dialog||!root)return;const vars={background:'--rfa-bg',node:'--rfa-node',cardBackground:'--rfa-card',cardBorder:'--rfa-line',highlight:'--rfa-accent',grid:'--rfa-grid',titleColor:'--rfa-title',bodyColor:'--rfa-text',captionColor:'--rfa-muted'};for(const [k,v]of Object.entries(vars))if(a[k])dialog.style.setProperty(v,a[k]);
  // Group boards and cards share the container settings, but the board stays lighter
  // so nested cards remain distinguishable.
  if(a.cardBackground){dialog.style.setProperty('--rfa-group-bg',a.cardBackground);dialog.style.setProperty('--rfa-group-head','color-mix(in srgb,'+a.cardBackground+' 88%,var(--rfa-bg))')}
  if(a.cardBorder){dialog.style.setProperty('--rfa-group-border',a.cardBorder)}
  for(const [k,v]of [['bodySize','--rfa-body-size'],['titleSize','--rfa-title-size'],['captionSize','--rfa-caption-size']])dialog.style.setProperty(v,(a[k]||{bodySize:14,titleSize:16,captionSize:12}[k])+'px');
  dialog.dataset.flowImageFit=a.imageFit||'contain';dialog.style.setProperty('--rfa-glow-opacity',String((a.bgIntensity||8)/100));dialog.dataset.flowReduceMotion=String(a.reduceMotion===true||matchMedia('(prefers-reduced-motion: reduce)').matches);
  root.dataset.pins=a.pins===false?'off':'on';root.dataset.nodeGlow=a.nodeGlow===false?'off':'on';root.dataset.lineEffect=LINE_EFFECTS.includes(a.lineEffect)?a.lineEffect:'none';root.dataset.lineStyle=a.lineStyle||'pcb';root.dataset.flow=a.flow===false?'off':'on';root.dataset.motion=(a.reduceMotion===true||matchMedia('(prefers-reduced-motion: reduce)').matches)?'off':'on';
  dialog.style.setProperty('--rfa-flow-duration',(6/Math.max(.1,Math.min(5,Number(a.arrowSpeed)||1)))+'s');window.frameTheme?.apply(dialog,a.theme);window.frameThemeSync?.();}
 async function doCommit(id){const d=m.drafts.get(id);if(!d)return true;const fields={...d.fields},expected={...d.expected};try{await H.edit(id,fields,expected);const current=m.drafts.get(id);if(current===d&&JSON.stringify(current.fields)===JSON.stringify(fields))m.drafts.delete(id);else if(current){for(const k of Object.keys(fields)){if(current.fields[k]===fields[k])delete current.fields[k];current.expected[k]=H.fieldValue(id,k)}if(!Object.keys(current.fields).length)m.drafts.delete(id)}build();setStatus('卡片内容已保存，并同步项目提示词');return true}catch(e){d.error='保存失败：'+e.message+'；输入已保留';update();return fail(e)}}
 async function doCommitAll(){for(const id of [...m.drafts.keys()])if(!await doCommit(id))return false;return true}
 const commit=id=>enqueue(()=>doCommit(id));
 const commitAll=()=>enqueue(doCommitAll);
 const ready=fn=>enqueue(async()=>{if(!await doCommitAll())return false;return fn()});
 function change(id,key,value){let d=m.drafts.get(id);if(!d){d={fields:{},expected:{}};m.drafts.set(id,d)}if(!Object.hasOwn(d.expected,key))d.expected[key]=H.fieldValue(id,key);d.fields[key]=value;d.error='';update()}
 function check(id,value){if(value)m.checked.add(id);else m.checked.delete(id);const s=project().segments.find(s=>'s:'+s.id===id);if(s)for(const h of s.shots){const key='h:'+s.id+':'+h.id;if(value)m.checked.add(key);else m.checked.delete(key)}setNodes(ns=>ns.map(n=>({...n,selected:m.checked.has(n.id)})));update();scheduleSave()}
 function select(id){m.lastSelected=id;notifyGeometry();return ready(async()=>{if(!H.descriptor(id))return;await H.select(id);setStatus('正在编辑：'+(H.descriptor(id)?.title||'项目'));return true})}
 function command(id,cmd){return ready(async()=>{await H.command(id,cmd);build();return true})}
 function expand(id){if(m.expanded.has(id))m.expanded.delete(id);else m.expanded.add(id);build();scheduleSave()}
 function worldPosition(n){let pos={...n.position},parent=n.parentId;const seen=new Set();while(parent&&!seen.has(parent)){seen.add(parent);const p=m.nodes.find(x=>x.id===parent);if(!p)break;pos.x+=p.position.x;pos.y+=p.position.y;parent=p.parentId}return pos}
 function focusNode(id){const n=m.nodes.find(n=>n.id===id);if(!n)return;const pos=worldPosition(n);m.instance?.setCenter(pos.x+(n.style.width||300)/2,pos.y+(n.measured?.height||n.style.height||220)/2,{zoom:1,duration:220})}
 function focusShot(sid){if(!m.expanded.has(sid)){m.expanded.add(sid);build();scheduleSave()}const s=project().segments.find(s=>s.id===sid);requestAnimationFrame(()=>focusNode(s?.shots.length?'h:'+sid+':'+s.shots[0].id:'s:'+sid))}
 function go(id){if(id.startsWith('h:')){const sid=id.split(':')[1];if(!m.expanded.has(sid)){m.expanded.add(sid);build();scheduleSave()}}else if(id.startsWith('s:')&&!m.expanded.has(id.slice(2))){m.expanded.add(id.slice(2));build();scheduleSave()}requestAnimationFrame(()=>focusNode(id));select(id)}
 function addAsset(target={}){fileTarget.current=target;if(file.current){file.current.value='';file.current.click()}}
 function upload(files,target){return ready(async()=>{const added=await H.upload(files,target);build();return added})}
 function addResult(target){resultTarget.current=target;if(resultFile.current){resultFile.current.value='';resultFile.current.click()}}
 function uploadResult(files,target){return ready(async()=>{setStatus('正在导入成片，保留已有版本…');await H.uploadResults(files,target);m.expanded.add(target.segmentId);build();requestAnimationFrame(()=>focusNode('r:'+target.segmentId+':'+(target.shotId||'segment')));scheduleSave();setStatus('成片已追加，原镜头与旧版本保留')})}
 function compare(items,title){container.current?.querySelectorAll('video,audio').forEach(v=>v.pause());setPopup({kind:'compare',items,title})}
 function menuAt(e,id='pane'){e.preventDefault();e.stopPropagation();const r=container.current.closest('.overviewWorkspace').getBoundingClientRect();setMenu({id,x:Math.max(8,Math.min(r.width-230,e.clientX-r.left)),y:Math.max(8,Math.min(r.height-190,e.clientY-r.top))})}
 function fit(){m.instance?.fitView({padding:.12,minZoom:.2,maxZoom:1,duration:250})}
 function descendants(id){const found=new Set([id]);for(const n of m.nodes)if(found.has(n.parentId))found.add(n.id);return found}
 function hover(id){m.hover=id;const members=descendants(id);setEdges(m.edges.map(e=>{const hot=!!id&&(members.has(e.source)||members.has(e.target)),base=e.data?.baseOpacity??e.style.opacity,width=e.data?.baseWidth??e.style.strokeWidth;return {...e,style:{...e.style,opacity:id?(hot?1:.1):base,strokeWidth:hot?width+1:width,filter:hot?'drop-shadow(0 0 3px '+e.style.stroke+')':undefined}}}))}
 function connect(c){return ready(async()=>{
  if(!c.source?.startsWith('a:')||!c.target?.startsWith('h:'))throw Error('请从素材的右侧端点，连接到镜头左侧端点；剧情顺序由项目镜头顺序决定');
  const a=project().assets.find(a=>'a:'+a.id===c.source),d=H.descriptor(c.target);if(!a||!d||d.kind!=='shot')throw Error('素材或镜头已删除');
  if(!H.scoped(d.segment).some(x=>x.id===a.id))throw Error('此素材属于其他片段，请先在素材属性中改为公共素材');
  if((d.item.assetIds||[]).includes(a.id)&&(H.mediaType(a)==='image'?(d.item.referenceNumbers||[]).includes(H.number(a)):(d.item.mediaAssetIds||[]).includes(a.id))){H.notice('此镜头已经引用该素材');return}
  await H.bindAsset(a.id,d.segment.id,d.item.id);build();setStatus('已绑定素材 ID，并同步镜头引用与提示词');
 })}
 // Resolve the real drop target from the pointer, not from the event target: resize
 // handles, node padding and group frames sit on top of cards and would otherwise
 // turn a replacement into a new asset.
 function dropZone(e){const stack=document.elementsFromPoint?.(e.clientX,e.clientY)||[];const within=el=>!!container.current?.contains(el);const hit=sel=>{for(const el of stack){const found=el.closest?.(sel);if(found&&within(found))return found}return null};
  const card=hit('[data-rfa-replace]')||hit('[data-rfa-id]')||hit('.react-flow__node[data-id^="a:"]');
  const id=card?.dataset.rfaId||(card?.dataset.rfaReplace?'a:'+card.dataset.rfaReplace:card?.dataset.id)||'';
  const group=hit('[data-rfa-group]')?.dataset.rfaGroup||'';
  const result=hit('[data-result-segment]');
  return {id,group,result:result?{segmentId:result.dataset.resultSegment,shotId:result.dataset.resultShot||undefined}:null};
 }
 async function onDrop(e){e.preventDefault();e.stopPropagation();const files=[...e.dataTransfer.files],{id,group,result}=dropZone(e),d=id&&!id.startsWith('t:')&&H.descriptor(id);
  const source=e.dataTransfer.getData('application/x-frame-asset');if(source&&!files.length){const a=project().assets.find(a=>a.id===source&&!a.deleted);if(!a)return;
   if(d?.kind==='asset'){if(d.item.id===a.id)return;return ready(async()=>{if(H.mediaType(a)!==H.mediaType(d.item))throw Error('替换请选择相同媒体类型');const src=H.media(a);if(!src)throw Error('来源素材文件缺失');const b=await fetch(src).then(r=>r.blob());await H.upload([new File([b],a.name+'.'+(a.path.split('.').at(-1)||'bin'),{type:b.type})],{assetId:d.item.id});build()})}
   if(d?.kind==='shot')return connect({source:'a:'+source,target:id});focusNode('a:'+source);return;
  }
  if(!files.length)return;if(result)return uploadResult(files,result);if(d?.kind==='shot'&&files.every(f=>/\.(mp4|webm|mov)$/i.test(f.name)))return uploadResult(files,{segmentId:d.segment.id,shotId:d.item.id});await upload(files,d?.kind==='asset'?{assetId:d.item.id}:d?.kind==='segment'||d?.kind==='shot'?{segmentId:(d.segment||d.item).id}:m.nodes.find(n=>n.id===group)?.data.segmentId?{segmentId:m.nodes.find(n=>n.id===group).data.segmentId}:{})}

 function preview(asset){container.current?.querySelectorAll('video,audio').forEach(v=>v.pause());setHoverRef(null);setPopup({kind:'asset',asset})}
 function gallery(id){const ids=m.nodes.find(n=>n.id===id)?.data.assetIds||[];const items=project().assets.filter(a=>ids.includes(a.id)&&!a.deleted);setPopup({kind:'gallery',title:m.nodes.find(n=>n.id===id)?.data.title,items})}
 function notifyGeometry(){window.dispatchEvent(new Event('frame:node-geometry'))}
 function nodeLimits(id){return geometryLimits(m.nodes.find(n=>n.id===id)||{data:{kind:'segment'}})}
 function nodeSize(){const n=m.nodes.find(n=>n.id===m.lastSelected&&!n.hidden);if(!n)return null;const limits=nodeLimits(n.id);return {id:n.id,title:H.descriptor(n.id)?.title||n.data.title||'节点',kind:n.data.kind,width:Math.round(n.style.width||n.measured?.width||300),height:Math.round(n.style.height||n.measured?.height||450),...limits,disabled:!!n.data.collapsed}}
 function startResize(id){m.lastSelected=id;if(!m.resizeSession){rememberLayout();m.resizeSession=id}}
 function setNodeSize(id,size){const n=m.nodes.find(n=>n.id===id);if(!n||n.data.collapsed)return;const limits=nodeLimits(id);const current={width:n.style.width||n.measured?.width||300,height:n.style.height||n.measured?.height||450};const next={width:clampDimension(Number(size.width??current.width),limits.minWidth),height:clampDimension(Number(size.height??current.height),limits.minHeight)};if(!Number.isFinite(next.width)||!Number.isFinite(next.height))return;startResize(id);m.sizes[id]=next;build()}
 function endResize(){if(!m.resizeSession)return;m.resizeSession='';build();scheduleSave();notifyGeometry()}
 function rememberLayout(){m.layoutUndo.push({at:Date.now(),positions:Object.fromEntries(m.nodes.map(n=>[n.id,{...n.position}])),sizes:structuredClone(m.sizes),collapsedGroups:[...m.collapsedGroups]});if(m.layoutUndo.length>64)m.layoutUndo.shift()}
 function collapseGroup(id){rememberLayout();m.collapsedGroups.has(id)?m.collapsedGroups.delete(id):m.collapsedGroups.add(id);build();scheduleSave()}
 function resizeNode(id,delta){
  rememberLayout();m.collapsedGroups.delete(id);const members=descendants(id),children=m.nodes.filter(n=>members.has(n.id)&&n.data.kind==='asset'),factor=delta>0?1.15:1/1.15;
  // Change content dimensions as well as the frame, then fit its bounds.
  for(const n of children){m.sizes[n.id]={width:Math.max(n.data.kind==='asset'?185:275,Math.round(n.style.width*factor)),...(n.data.kind==='asset'?{height:Math.max(450,Math.round(n.style.height*factor))}:{})};delete m.positions[n.id]}
  for(const n of m.nodes)if(members.has(n.id)&&['group','segment-group'].includes(n.data.kind)){delete m.sizes[n.id];if(n.id!==id)delete m.positions[n.id]}build();scheduleSave()
 }
 const autoAlign=()=>ready(async()=>{rememberLayout();for(const n of m.nodes){if(n.data.kind==='text')continue;delete m.positions[n.id];if(['group','segment-group'].includes(n.data.kind))delete m.sizes[n.id]}build();await save();requestAnimationFrame(()=>fit());setStatus('已自动对齐：每个片段与镜头横向排列，可 Ctrl+Z 撤销')});
 function noteChange(id,text){const note=m.notes.find(n=>n.id===id);if(note){note.text=text;update();scheduleSave()}}
 function refHover(asset,e){if(!asset){setHoverRef(null);return}const box=container.current.getBoundingClientRect(),r=e.currentTarget.getBoundingClientRect();setHoverRef({asset,x:Math.max(8,Math.min(box.width-290,r.left-box.left)),y:Math.max(80,Math.min(box.height-240,r.top-box.top-215))})}
 function selectionIds(id){const ids=id&&!m.checked.has(id)?[id]:[...m.checked];return [...new Set(ids.flatMap(id=>{if(id.startsWith('r:')){const n=m.nodes.find(n=>n.id===id);return (n?.data.videos||[]).map(v=>'v:'+n.data.segment.id+':'+v.id)}return /^[ashtv]:/.test(id)?[id]:[]}))]}

 const copySelection=id=>ready(async()=>{const target=id||(m.checked.size===1?[...m.checked][0]:'');if(target?.startsWith('p:'))return H.copyPrompt(target.slice(2));await save();const ids=selectionIds(id);if(!ids.length)throw Error('先选择素材、片段或镜头');await H.copy(ids);setStatus('已复制到系统剪贴板，可在画布内外粘贴')});
 function placePasted(ids){m.notes=structuredClone(H.layout().notes||[]);for(const id of ids){if(id.startsWith('h:'))m.expanded.add(id.split(':')[1]);if(id.startsWith('s:'))m.expanded.add(id.slice(2))}build();const r=container.current.querySelector('.rfa-flow-stage').getBoundingClientRect(),point=m.instance.screenToFlowPosition(m.lastPointer||{x:r.left+r.width/2,y:r.top+r.height/2});for(const [i,id]of ids.entries()){const n=m.nodes.find(n=>n.id===id);if(!n)continue;const parent=n.parentId&&m.nodes.find(x=>x.id===n.parentId);if(n.data.kind==='segment'&&parent?.data.kind==='segment-group'){m.positions[parent.id]={x:point.x+i*35,y:point.y+i*35};continue}const offset=parent?worldPosition(parent):{x:0,y:0},x=point.x+i*35-offset.x,y=point.y+i*35-offset.y;m.positions[id]=parent?{x:Math.max(12,Math.min(x,parent.style.width-n.style.width-20)),y:Math.max(55,Math.min(y,parent.style.height-(n.measured?.height||450)-25))}:{x,y}}m.checked=new Set(ids);build();scheduleSave()}
 const pasteIncoming=input=>ready(async()=>{await save();const data=input.data||H.decode(input.text||'');if(data){const ids=await H.paste(data,H.currentSegment()?.id);placePasted(ids);setStatus('已粘贴独立副本，原件与引用保持');return}if(input.files?.length)return uploadDirect(input.files,{});if(input.text?.trim()){const ids=await H.pasteText(input.text);placePasted(ids)}});
 async function uploadDirect(files,target){await H.upload(files,target);build()}
 const pasteClipboard=async()=>{try{return await pasteIncoming(await H.readClipboard())}catch(e){return fail(e)}};
 const duplicate=id=>ready(async()=>{await save();const ids=selectionIds(id);if(!ids.length)throw Error('先选择节点');placePasted(await H.paste(H.capture(ids),H.currentSegment()?.id));setStatus('已创建独立副本')});
 const deleteSelection=id=>ready(async()=>{const ids=selectionIds(id);if(!ids.length)return;if(!ids.every(id=>id.startsWith('v:')))await save();if(!confirm('删除选中的 '+ids.length+' 项？成片只删除对应版本记录，不删除镜头或磁盘原文件；节点修改可撤销。'))return;setStatus('正在删除并保存，请稍候…');await H.remove(ids);m.checked.clear();m.notes=structuredClone(H.layout().notes||[]);build();scheduleSave();setStatus('已删除并保存，可用 Ctrl+Z 撤销')});
 const undo=()=>ready(async()=>{const latest=m.layoutUndo.at(-1),before=latest&&latest.at>(H.undoTime?.()||0)?m.layoutUndo.pop():null;if(before){m.positions=before.positions;if(before.sizes)m.sizes=before.sizes;if(before.collapsedGroups)m.collapsedGroups=new Set(before.collapsedGroups);build();scheduleSave()}else{await H.undo();m.notes=structuredClone(H.layout().notes||[]);build()}});
 const selectAll=()=>{m.checked=new Set(m.nodes.filter(n=>!n.hidden&&!['group','segment-group','project','prompt'].includes(n.data.kind)).map(n=>n.id));build()};
 const reorderScope=ids=>{for(const id of ids){delete m.positions['a:'+id];for(const view of Object.values(m.views))if(view.positions)delete view.positions['a:'+id]}build();scheduleSave()};
 const handleAPI={nodeSize,setNodeSize,startResize,endResize,autoAlign,reorderScope,setMode:modeChange,copySelection,pasteClipboard,pasteIncoming,deleteSelection,undo,selectAll};
 function initialView(attempt=0){if(m.disposed||m.initialized)return;if(!m.instance||!container.current?.clientWidth){if(attempt<40)setTimeout(()=>initialView(attempt+1),60);return}m.initialized=true;build();const viewport=m.viewport&&[m.viewport.x,m.viewport.y,m.viewport.zoom].every(Number.isFinite)?m.viewport:{x:24,y:320,zoom:.85};requestAnimationFrame(()=>m.instance.setViewport(viewport));}
 useEffect(()=>{m.disposed=false;build();expose({...handleAPI,refresh:()=>{if(!m.disposed)build()},resume:()=>initialView(),suspend:()=>{container.current?.querySelectorAll('video,audio').forEach(v=>v.pause());setPopup(null);setMenu(null);setHoverRef(null)},save,commitAll,escape(){if(m.popup){setPopup(null);return}setMenu(null);setHoverRef(null);m.checked.clear();update();setNodes(ns=>ns.map(n=>({...n,selected:false})))},getState:()=>({nodes:m.nodes,edges:m.edges,drafts:m.drafts,expanded:m.expanded,checked:m.checked,instance:m.instance,mode:m.mode,collapsedGroups:m.collapsedGroups}),unmount:()=>{}});
  const observer=new MutationObserver(()=>{setThemeState(document.documentElement.dataset.theme||'light');applyAppearance();build()});observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  let resizeFrame=0;const ro=new ResizeObserver(()=>{if(resizeFrame||!container.current?.clientWidth)return;resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;if(!m.disposed)build()})});ro.observe(container.current);
  return()=>{m.disposed=true;clearTimeout(m.timer);cancelAnimationFrame(resizeFrame);observer.disconnect();ro.disconnect()};
 },[]);
 useEffect(()=>{const svg=defsSvg.current;if(!svg)return;const html='<defs>'+markerMarkup+'</defs>';if(svg.dataset.markup!==html){svg.innerHTML=html;svg.dataset.markup=html}},[markerMarkup]);
 // Dynamic theme layers: backdrop (colour/gradient/image/video), particles, big type.
 // A theme change crossfades the backdrop instead of hard-switching it.
 useEffect(()=>{
  const first=backdropRef.current,second=backdropNextRef.current,canvas=particlesRef.current,video=backdropVideoRef.current;
  if(!first||!second||!canvas)return;
  let front=first,spare=second,current='';
  window.frameParticles?.attach(canvas);
  function paint(theme){
   const value=theme.backdrop;
   const useVideo=value.type==='video'&&value.url;
   if(video){
    const src=useVideo?(value.url||''):'';
    if(useVideo){if(video.dataset.src!==src){video.dataset.src=src;video.src=src;}video.hidden=false;const playing=video.play?.();playing?.catch?.(()=>{})}
    else{video.pause?.();video.hidden=true;video.removeAttribute('src');delete video.dataset.src}
   }
   const css=useVideo?'':(value.type==='image'&&value.url?'url("'+value.url+'") center/cover no-repeat':(value.css||'linear-gradient(160deg,#0b0d10,#101318 60%,#0a0c0f)'));
   if(css&&css!==current){
    spare.style.background=css;spare.style.opacity='1';front.style.opacity='0';
    const swap=front;front=spare;spare=swap;current=css;
   }
   window.frameParticles?.sync(theme);
  }
  m.themeSync=()=>{const a=H.appearance()||{};paint(window.frameTheme?.resolve(a.theme)||{backdrop:{type:'gradient'},particles:{style:'none'},type:{enabled:false}})};
  // applyAppearance() lives outside React, so expose the repaint for it to call.
  window.frameThemeSync=m.themeSync;
  m.themeSync();
  const size=new ResizeObserver(()=>window.frameParticles?.measure());size.observe(canvas);
  return ()=>{size.disconnect();if(window.frameThemeSync===m.themeSync)delete window.frameThemeSync;if(m.themeSync)delete m.themeSync};
 },[H]);

 const context=useMemo(()=>({H,addResult,compare,drafts:m.drafts,checked:m.checked,expanded:m.expanded,change,commit,check,expand,focusShot,select,command,addAsset,menuAt,deleteSelection,nodeLimits,startResize,endResize,persist:scheduleSave,preview,gallery,collapseGroup,resizeNode,noteChange,refHover}),[tick]);
 m.popup=popup;const p=project(),ap=H.appearance();
 const menuGroups=()=>{if(!menu)return[];const id=menu.id,d=/^[ash]:/.test(id)?H.descriptor(id):null;
  if(id.startsWith('p:'))return [['最终提示词',[['查看 / 编辑',()=>select(id)],['复制最终提示词',()=>ready(()=>H.copyPrompt(id.slice(2)))]]]];
  if(id.startsWith('v:'))return [['成片操作',[['名称 / 备注',()=>select(id)],['删除此版本 · Del',()=>deleteSelection(id)]]]];
  if(id.startsWith('r:'))return [['成片操作',[['删除本组成片记录 · Del',()=>deleteSelection(id)]]]];
  if(id==='pane'||id==='project')return [
   ['更多编辑',[['新建片段',()=>command('project','add-segment')],['添加公共素材',()=>addAsset()],['添加本组素材',()=>{const s=H.currentSegment();if(!s)throw Error('请先选择片段');addAsset({segmentId:s.id})}],['粘贴 · Ctrl+V',pasteClipboard]]],
   ['视图与选择',[['全选已展开节点 · Ctrl+A',selectAll],['取消选择 · Esc',()=>{m.checked.clear();build()}],['适应全部',fit],['撤销画布操作 · Ctrl+Z',undo]]],
   ['素材与管理',[['确认全部素材',()=>ready(()=>H.confirm('all'))],['确认本段素材',()=>ready(()=>H.confirm('segment'))],['确认公共素材',()=>ready(()=>H.confirm('public'))],['反推提示词',()=>ready(()=>H.reverse())],['导入导演包',()=>command('project','import-pack')],['导出导演包',()=>command('project','export-pack')]]]
  ];
  const items=[];if(d){items.push(['编辑属性',()=>select(id)],['与节点 Agent 对话',()=>ready(()=>H.agent(id))],['AI 拆镜',()=>ready(()=>H.aiSplit(id))])}items.push(['复制 · Ctrl+C',()=>copySelection(id)],['创建副本',()=>duplicate(id)]);
  if(d?.kind==='shot')items.push(['插入镜头',()=>command(id,'add-shot')],['镜头前移',()=>command(id,'shot-up')],['镜头后移',()=>command(id,'shot-down')],['撤销镜头修改',()=>command(id,'undo-shots')]);
  if(d?.kind==='asset')items.push(['查看素材',()=>preview(d.item)],['替换素材文件',()=>addAsset({assetId:d.item.id})]);
  if(d?.kind==='segment')items.push(['展开 / 收起镜头',()=>expand(d.item.id)]);
  if(d||id.startsWith('t:'))items.push(['删除 · Del',()=>deleteSelection(id)]);else items.push(['折叠 / 展开',()=>collapseGroup(id)],['查看素材区',()=>gallery(id)]);
  return [['编辑与副本',items.filter(([t])=>/编辑属性|复制|副本|删除/.test(t))],['AI 与对话',items.filter(([t])=>/Agent|AI 拆镜/.test(t))],['更多操作',items.filter(([t])=>!/编辑属性|复制|副本|删除|Agent|AI 拆镜/.test(t))]].filter(([,rows])=>rows.length);
 };
 return <C.Provider value={context}>
  {createPortal(<nav className="rfa-tree" aria-label="片段和镜头"><div className="rfa-tree-heading"><strong>片段 / 镜头</strong><span>{p.segments.length} 段</span><button onClick={fit}>全部片段</button></div><div className="rfa-tree-scroll" ref={navBody}>
   {p.segments.map((s,i)=><section key={s.id}><div className="rfa-tree-row" data-tree-id={'s:'+s.id} onContextMenu={e=>menuAt(e,'s:'+s.id)}><input type="checkbox" aria-label={'勾选片段 '+(i+1)} checked={m.checked.has('s:'+s.id)} onChange={e=>check('s:'+s.id,e.target.checked)}/><button className="rfa-tree-disclosure" aria-label={'展开片段 '+(i+1)} onClick={()=>expand(s.id)}>{m.expanded.has(s.id)?'▾':'▸'}</button><button className="rfa-tree-title" onClick={()=>go('s:'+s.id)}>{s.title||'片段 '+(i+1)}</button><small>{s.shots.length}</small></div>{m.expanded.has(s.id)&&s.shots.map((h,j)=><div className="rfa-tree-row rfa-tree-shot" key={h.id} data-tree-id={'h:'+s.id+':'+h.id} onContextMenu={e=>menuAt(e,'h:'+s.id+':'+h.id)}><input type="checkbox" aria-label={'勾选片段 '+(i+1)+' 镜头 '+(j+1)} checked={m.checked.has('h:'+s.id+':'+h.id)} onChange={e=>check('h:'+s.id+':'+h.id,e.target.checked)}/><button onClick={()=>go('h:'+s.id+':'+h.id)}>镜头 {String(j+1).padStart(2,'0')}</button><small>{+(h.end-h.start).toFixed(2)}s</small></div>)}</section>)}
  </div><small className="rfa-selection">已选 {m.checked.size} 项 · 勾选用于画布多选与一起移动</small></nav>,nav)}
  <div className="rfa-content" ref={container} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();e.stopPropagation();ready(save)}}} onDragOver={e=>{if(e.dataTransfer.types.includes('Files')||e.dataTransfer.types.includes('application/x-frame-asset')){e.preventDefault();e.stopPropagation()}}} onDrop={onDrop} onPointerMove={e=>{m.lastPointer={x:e.clientX,y:e.clientY}}} onPointerDown={()=>{if(menu)setMenu(null)}}>
   <header className="rfa-toolbar"><strong>{({canvas:'画布模式',cards:'卡片模式',free:'自由画布'})[m.mode]}</strong><button onClick={()=>setPan(!pan)} aria-pressed={pan}>{pan?'平移':'框选'}</button><button onClick={fit}>适应全部</button><button onClick={autoAlign}>自动对齐</button><button onClick={()=>{for(const s of p.segments)m.expanded.add(s.id);build();scheduleSave()}}>展开全部镜头</button><button onClick={()=>{m.expanded.clear();build();scheduleSave()}}>收起镜头</button><button onClick={()=>H.fullscreen()}>全屏</button></header>
   <div className="rfa-flow-stage"><div className="rfa-backdrop" ref={backdropRef} aria-hidden="true"/><video className="rfa-backdrop-video" ref={backdropVideoRef} muted loop playsInline preload="metadata" aria-hidden="true"/><div className="rfa-backdrop next" ref={backdropNextRef} aria-hidden="true"/><canvas className="rfa-particles" ref={particlesRef} aria-hidden="true"/>
   <svg className="rfa-arrow-defs" ref={defsSvg} aria-hidden="true" focusable="false" width="0" height="0"/>
   <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} colorMode={theme==='dark'?'dark':'light'} onlyRenderVisibleElements elevateEdgesOnSelect={false} minZoom={.15} maxZoom={2} deleteKeyCode={null} panOnDrag={pan?[0,1,2]:[1,2]} selectionOnDrag={!pan} selectionMode={SelectionMode.Partial} multiSelectionKeyCode={['Control','Meta','Shift']} panActivationKeyCode="Space" zoomOnDoubleClick={false} nodeDragThreshold={5} onInit={i=>{m.instance=i;m.ready=true}} onNodesChange={changes=>{setNodes(ns=>{const next=applyNodeChanges(changes,ns);m.nodes=next;return next});for(const c of changes){if(c.type==='position'&&(c.dragging||m.dragging)&&finitePoint(c.position))m.positions[c.id]=c.position;if(c.type==='dimensions'&&c.resizing)m.sizes[c.id]=c.dimensions;if(c.type==='select'){if(c.selected)m.checked.add(c.id);else m.checked.delete(c.id)}}if(changes.some(c=>c.type==='select'))update();if(changes.some(c=>c.type==='dimensions'))notifyGeometry()}} onNodeDragStart={()=>{m.dragging=true;m.layoutUndo.push({at:Date.now(),positions:structuredClone(m.positions)});if(m.layoutUndo.length>64)m.layoutUndo.shift()}} onNodeDragStop={()=>{m.dragging=false;build();scheduleSave()}} onSelectionDragStart={()=>{m.dragging=true}} onSelectionDragStop={()=>{m.dragging=false;build();scheduleSave()}} onNodeClick={(e,n)=>{if(e.target.closest('input,textarea,button,audio,video'))return;select(n.id==='asset-board'?'project':n.id)}} onNodeContextMenu={(e,n)=>{if(e.target.closest('[data-result-version]'))return;menuAt(e,n.id)}} onPaneContextMenu={e=>menuAt(e,'pane')} onPaneClick={()=>setMenu(null)} onConnect={connect} isValidConnection={c=>c.source?.startsWith('a:')&&c.target?.startsWith('h:')} onMoveStart={()=>{m.interacting=true}} onMoveEnd={(e,v)=>{m.interacting=false;m.viewport=v;scheduleSave()}} onMove={(e,v)=>setZoom(v.zoom)} onNodeMouseEnter={(e,n)=>hover(n.id)} onNodeMouseLeave={()=>hover('')} onError={(code,msg)=>setStatus('画布提示 '+code+'：'+msg)}>
    {ap.pattern!=='none'&&<Background variant={ap.pattern==='lines'?'lines':'dots'} gap={ap.gridSize||28} size={ap.pattern==='lines'?.5:1} color="var(--rfa-grid)"/>}
    <Controls showInteractive={false} position="bottom-left" fitViewOptions={{padding:.12,minZoom:.2,maxZoom:1}}/>
    <MiniMap position="bottom-right" pannable zoomable nodeColor={n=>n.data.kind==='asset'?SEMANTIC[category(n.data.item)]:n.data.kind==='segment'?SEMANTIC.story:'var(--rfa-accent)'} maskColor="color-mix(in srgb,var(--rfa-bg) 65%,transparent)" onClick={(e,pos)=>m.instance?.setCenter(pos.x,pos.y,{zoom:m.instance.getZoom(),duration:150})}/>
   </ReactFlow></div>
   {menu&&createPortal(<ContextMenu key={menu.id+':'+menu.x+':'+menu.y} menu={menu} groups={menuGroups()} bounds={()=>container.current.closest('.overviewWorkspace').getBoundingClientRect()} onClose={()=>setMenu(null)} onError={fail}/>,container.current.closest('.overviewWorkspace'))}

   {hoverRef&&<div className="flow-ref-hover" role="tooltip" style={{left:hoverRef.x,top:hoverRef.y}}><strong>{hoverRef.asset.name}</strong><small>{H.mediaType(hoverRef.asset)} · {hoverRef.asset.scope==='segment'?'本组':'公共'}</small><MediaPreview src={H.media(hoverRef.asset)} type={H.mediaType(hoverRef.asset)} name={hoverRef.asset.name}/></div>}
   {popup&&<div className="flow-preview-backdrop" onPointerDown={e=>e.stopPropagation()} onClick={()=>setPopup(null)}><section className="flow-preview-dialog" role="dialog" aria-modal="true" aria-label="素材预览" onClick={e=>e.stopPropagation()}><header><strong>{popup.asset?.name||popup.title||'素材预览'}</strong><button onClick={()=>setPopup(null)} aria-label="关闭素材预览">×</button></header>{popup.kind==='compare'?<Compare items={popup.items} H={H}/>:popup.asset?<MediaPreview key={popup.asset.id} src={H.media(popup.asset)} type={H.mediaType(popup.asset)} name={popup.asset.name} large/>:<div className="flow-gallery">{popup.items.map(asset=><article key={asset.id}><MediaPreview src={H.media(asset)} type={H.mediaType(asset)} name={asset.name} onOpen={()=>preview(asset)}/><button onClick={()=>preview(asset)}>{asset.name} · 查看</button></article>)}</div>}</section></div>}
   <footer className="rfa-status" role="status"><span>{status}</span><span>{Math.round(zoom*100)}% · {p.segments.length} 片段 · {p.segments.reduce((n,s)=>n+s.shots.length,0)} 镜头</span><button onClick={()=>ready(()=>save())}>保存</button></footer>
   <input ref={resultFile} data-flow-result-file type="file" multiple accept=".mp4,.webm,.mov" hidden onChange={e=>{const files=[...e.target.files];if(files.length)uploadResult(files,resultTarget.current)}}/>
   <input ref={file} data-flow-file type="file" multiple accept="image/png,image/jpeg,image/webp,audio/*,video/*" hidden onChange={e=>{const files=[...e.target.files];if(files.length)upload(files,fileTarget.current)}}/>
  </div>
 </C.Provider>;
}

window.frameFlowApp={mount(root,nav,H){const reactRoot=createRoot(root);let api=null;reactRoot.render(<ReactFlowProvider><App H={H} nav={nav} expose={a=>{api=a}}/></ReactFlowProvider>);return {refresh(){api?.refresh()},nodeSize:()=>api?.nodeSize(),setNodeSize:(id,size)=>api?.setNodeSize(id,size),startResize:id=>api?.startResize(id),endResize:()=>api?.endResize(),suspend(){api?.suspend()},reorderScope:ids=>api?.reorderScope(ids),resume(){if(api)api.resume();else setTimeout(()=>api?.resume(),80)},save:()=>api?.save(),commitAll:()=>api?.commitAll()??Promise.resolve(true),escape:()=>api?.escape(),setMode:mode=>api?.setMode(mode),copySelection:()=>api?.copySelection(),pasteClipboard:()=>api?.pasteClipboard(),pasteIncoming:input=>api?.pasteIncoming(input),deleteSelection:()=>api?.deleteSelection(),undo:()=>api?.undo(),selectAll:()=>api?.selectAll(),getState:()=>api?.getState(),unmount(){reactRoot.unmount()}}}};
