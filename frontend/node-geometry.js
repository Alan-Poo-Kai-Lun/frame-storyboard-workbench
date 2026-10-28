// @ts-check
/** @typedef {{data:{kind:string,minWidth?:number,minHeight?:number,collapsed?:boolean},style?:{width?:number,height?:number},measured?:{width?:number,height?:number}}} SizedNode */
/** @param {SizedNode} node */
export function geometryLimits(node){
 const pairs={asset:[185,450],shot:[280,360],segment:[250,260],prompt:[360,300],result:[380,280],project:[210,140],text:[220,160]};
 const group=['group','segment-group'].includes(node.data.kind);
 const pair=pairs[/** @type {keyof typeof pairs} */(node.data.kind)]||[250,180];
 return {minWidth:group?(node.data.minWidth||300):pair[0],minHeight:group?(node.data.collapsed?60:node.data.minHeight||230):pair[1]};
}
/** @param {number} value @param {number} min */
export function clampDimension(value,min){return Math.max(min,Math.min(Math.max(4000,min),Math.round(value)))}
