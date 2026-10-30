const esbuild=require('esbuild');
const fs=require('fs'),path=require('path');
const target=path.resolve(__dirname,'../web/vendor/reactflow-a');fs.mkdirSync(target,{recursive:true});
esbuild.buildSync({entryPoints:[path.join(__dirname,'main.jsx')],bundle:true,minify:true,format:'iife',target:'es2022',outfile:path.join(target,'app.js'),define:{'process.env.NODE_ENV':'"production"'},legalComments:'eof'});
fs.copyFileSync(require.resolve('@xyflow/react/dist/style.css'),path.join(target,'reactflow.css'));
const notices=[];
for(const name of ['marked','dompurify','react','react-dom','scheduler','@xyflow/react','@xyflow/system','zustand','classcat','use-sync-external-store','d3-selection','d3-drag','d3-dispatch','d3-interpolate','d3-color','d3-timer','d3-transition','d3-ease','d3-zoom']){
 const folder=path.join(__dirname,'node_modules',name);const license=['LICENSE','LICENSE.md','LICENSE.txt'].find(n=>fs.existsSync(path.join(folder,n)));
 if(!license)throw Error('Missing license: '+name);const pkg=JSON.parse(fs.readFileSync(path.join(folder,'package.json')));notices.push(name+' '+pkg.version+'\n'+fs.readFileSync(path.join(folder,license),'utf8'));
}
fs.writeFileSync(path.join(target,'LICENSES.txt'),notices.join('\n\n--------------------------------\n\n'));
// check_release.py verifies these hashes, so the build owns them instead of a
// human editing vendor-manifest.json by hand after every rebuild.
const crypto=require('crypto');
const manifest=path.resolve(__dirname,'../vendor-manifest.json');
const files={};
for(const name of ['app.js','reactflow.css','LICENSES.txt']){
 files['web/vendor/reactflow-a/'+name]=crypto.createHash('sha256').update(fs.readFileSync(path.join(target,name))).digest('hex');
}
fs.writeFileSync(manifest,JSON.stringify({files},null,2)+'\n');
console.log('Local production bundle, dependency notices and vendor hashes ready');
