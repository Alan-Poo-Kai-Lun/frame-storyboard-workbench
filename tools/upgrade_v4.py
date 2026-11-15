"""One-time isolated V4 source migration; never accesses the installed program."""
from pathlib import Path
import json,re
R=Path(__file__).resolve().parents[1]
def edit(name,old,new):
 p=R/name;s=p.read_text('utf-8');assert old in s,(name,old[:90]);p.write_text(s.replace(old,new),encoding='utf-8')
v=json.loads((R/'version.json').read_text('utf-8'));v.update(version='V4.0.0',release='v4.0.0',date='2026-11-10');(R/'version.json').write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
edit('frontend/asset-groups.js','const columns=Math.min(2,g.rows.length);','const columns=Math.max(1,g.rows.length);')
edit('frontend/main.jsx',"extent:parentId&&kind!=='text'?'parent':undefined","extent:undefined")
edit('frontend/main.jsx',"if(parentId){pos={x:Math.max(12,pos.x),y:Math.max(55,pos.y)}}","// V4 groups carry nodes without constraining their drag coordinates.")
edit('frontend/main.jsx','let y=storyTop;','let y=storyTop,segmentX=400;')
edit('frontend/main.jsx','let base={x:400,y},parent;','let base={x:segmentX,y},parent;')
edit('frontend/main.jsx',"add(parent,'segment-group',null,{x:400,y}","add(parent,'segment-group',null,{x:segmentX,y}")
p=R/'frontend/main.jsx';s=p.read_text('utf-8');start=s.index('   y+=m.mode===');end=s.index('\n',start)
s=s[:start]+"   segmentX=parent?segmentX+Math.max(420,list.find(n=>n.id===parent).style.width)+90:Math.max(shotX+800,segmentX+420);"+s[end:];p.write_text(s,encoding='utf-8')
edit('frontend/main.jsx','每个片段与镜头横向排列，可 Ctrl+Z 撤销','素材、片段与镜头均单行横排，不自动换行；可 Ctrl+Z 撤销')
edit('frontend/main.jsx','<button onClick={autoAlign}>自动对齐</button>','<button onClick={autoAlign}>横向对齐 →</button><button aria-pressed={!!m.relatedOnly} onClick={()=>{m.relatedOnly=!m.relatedOnly;hover(m.lastSelected||\'\');force(x=>x+1)}}>{m.relatedOnly?\'只看选中关联\':\'全部连线\'}</button>')
edit('frontend/main.jsx',"opacity:id?(hot?1:.1):base","opacity:m.relatedOnly?(hot?1:0):id?(hot?1:.1):base")
edit('frontend/main.jsx','function hover(id){m.hover=id;','function hover(id){id=id||(m.relatedOnly?m.lastSelected:undefined);m.hover=id;')
edit('frontend/main.jsx','function select(id){m.lastSelected=id;','function select(id){m.lastSelected=id;hover(id);')
edit('frontend/main.jsx','onNodeMouseEnter={(e,n)=>hover(n.id)}','onNodeMouseEnter={(e,n)=>{if(!m.relatedOnly)hover(n.id)}}')
edit('frontend/main.jsx','onClick={()=>a.preview(item)}>查看</button>','onClick={()=>a.preview(item)}>查看</button><button className={textFieldClass} onClick={()=>a.H.assetDescription(item.id)}>说明 / 提示词</button>')
edit('web/canvas-unified-host.js',"openPrompt:segmentId=>window.frameR15.openPrompt(segmentId),","openPrompt:segmentId=>window.frameR15.openPrompt(segmentId),\n  assetDescription:id=>prepared(()=>openAssetDossier(id)),")
edit('web/canvas-unified-host.js',"app=frameFlowApp.mount(root,nav,window.frameFlowHost)","app=frameFlowApp.mount(root,nav,window.frameFlowHost);window.frameV4?.navigation(nav,dialog)")
edit('web/app.js',"/^Picture\\s+\\d+\\s/i.test(match[1])","/^(?:【[^】]*】|素材库【[^】]*】|(?:Picture|Subject|Audio|Video)\\s+\\d+(?:\\s|$))/i.test(match[1])")
# Keep cached resources from loading an earlier generation of the UI.
p=R/'web/index.html';s=p.read_text('utf-8');s=re.sub(r'\?v=[0-9A-Za-z.\-]+','?v=4.0.0',s);s=s.replace('</body>','<script src="v4-workspace.js?v=4.0.0"></script><link rel="stylesheet" href="v4-workspace.css?v=4.0.0"></body>');p.write_text(s,encoding='utf-8')
manifest=json.loads((R/'release-manifest.json').read_text('utf-8'));manifest+=['web/v4-workspace.js','web/v4-workspace.css'];(R/'release-manifest.json').write_text(json.dumps(sorted(set(manifest)),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
# Preserve scroll in the same conversation, including task-feed redraws.
edit('web/agent-chat.js',"const history=q(panel,'[data-agent-history]');history.replaceChildren();","const history=q(panel,'[data-agent-history]'),oldTop=history.scrollTop,nearBottom=history.scrollHeight-history.clientHeight-oldTop<45;history.replaceChildren();")
edit('web/agent-chat.js',"\n }\n\n async function refresh(rows=null)","\n requestAnimationFrame(()=>{history.scrollTop=nearBottom?history.scrollHeight:oldTop});\n }\n\n async function refresh(rows=null)")
print('V4 source changes applied')
