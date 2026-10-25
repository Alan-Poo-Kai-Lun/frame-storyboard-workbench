import React,{useState} from 'react';
import {MediaPreview} from './media.jsx';
export function Compare({items,H}){
 const [left,setLeft]=useState(items.at(-2)?.id),[right,setRight]=useState(items.at(-1)?.id);
 return <div className="flow-compare"><p>并排对比 · 每侧可独立播放、暂停和拖动进度</p><div className="flow-compare-grid">{[[left,setLeft,right],[right,setRight,left]].map(([id,setId,other],side)=>{const v=items.find(x=>x.id===id);return <section key={side}><label>{side?'右侧版本':'左侧版本'}<select aria-label={side?'右侧对比版本':'左侧对比版本'} value={id} onChange={e=>setId(e.target.value)}>{items.map((v,i)=><option key={v.id} value={v.id} disabled={v.id===other}>{i+1} · {v.title||v.name}</option>)}</select></label>{v&&<MediaPreview key={v.id} src={H.media(v)} type="video" name={v.title||v.name} large allowConcurrent/>}</section>})}</div></div>
}
