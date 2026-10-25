const esbuild=require('esbuild');
const fs=require('fs'),path=require('path');
const target=path.resolve(__dirname,'../web/vendor/reactflow-a');fs.mkdirSync(target,{recursive:true});
esbuild.buildSync({entryPoints:[path.join(__dirname,'main.jsx')],bundle:true,minify:true,format:'iife',target:'es2022',outfile:path.join(target,'app.js'),define:{'process.env.NODE_ENV':'"production"'},legalComments:'eof'});
fs.copyFileSync(require.resolve('@xyflow/react/dist/style.css'),path.join(target,'reactflow.css'));
const notices=[];
for(const name of ['react','react-dom','scheduler','@xyflow/react','@xyflow/system','zustand','classcat','use-sync-external-store','d3-selection','d3-drag','d3-dispatch','d3-interpolate','d3-color','d3-timer','d3-transition','d3-ease','d3-zoom']){
 const folder=path.join(__dirname,'node_modules',name);const license=['LICENSE','LICENSE.md','LICENSE.txt'].find(n=>fs.existsSync(path.join(folder,n)));
 if(!license)throw Error('Missing license: '+name);const pkg=JSON.parse(fs.readFileSync(path.join(folder,'package.json')));notices.push(name+' '+pkg.version+'\n'+fs.readFileSync(path.join(folder,license),'utf8'));
}
fs.writeFileSync(path.join(target,'LICENSES.txt'),notices.join('\n\n--------------------------------\n\n'));
console.log('Local production bundle and dependency notices ready');
