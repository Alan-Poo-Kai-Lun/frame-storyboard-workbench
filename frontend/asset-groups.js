// @ts-check
/** @typedef {{id:string, kind?:string, mediaType?:string}} GroupAsset */
/** @typedef {Record<string,{width?:number,height?:number}>} Sizes */

/** @param {GroupAsset | null | undefined} asset */
export function assetCategory(asset) {
 if(asset?.mediaType==='audio'||/音频|声音|audio/i.test(asset?.kind||''))return 'audio';
 if(/人物|角色|character/i.test(asset?.kind||''))return 'character';
 if(/场景|scene/i.test(asset?.kind||''))return 'scene';
 return 'other';
}

/** Layout only: source assets are never cloned, renumbered or mutated.
 * @param {GroupAsset[]} rows
 * @param {Sizes} sizes
 * @param {string} scope
 */
export function assetGroups(rows,sizes,scope) {
 const categories=[['character','人物组'],['scene','场景组'],['other','道具与声音']];
 return categories.map(([key,label])=>({key,label,rows:rows.filter(a=>{
  const c=assetCategory(a);return key==='other'?!['character','scene'].includes(c):c===key;
 })})).filter(g=>g.rows.length).map(g=>{
  const columns=Math.min(2,g.rows.length);
  const cellWidth=Math.max(185,...g.rows.map(a=>sizes['a:'+a.id]?.width||228));
  const cellHeight=Math.max(450,...g.rows.map(a=>sizes['a:'+a.id]?.height||450));
  return {...g,gid:'asset-group:'+scope+':'+g.key,columns,cellWidth,cellHeight,
   width:Math.max(360,columns*(cellWidth+18)+12),height:Math.ceil(g.rows.length/columns)*(cellHeight+24)+65};
 });
}
