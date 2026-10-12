/* Update checks are explicit; no silent downloads or automatic installation. */
const FRAME_RELEASES='https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/releases';
function releaseLink(url,label){return `<a class="updateDownload" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`}
async function openUpdateCheck(){
 const button=$('checkUpdates');if(button.disabled)return;button.disabled=true;
 modal('检查更新','<p class="notice" role="status">正在读取 GitHub Releases…不会发送项目、素材或模型密钥。</p>');
 try{
  const info=await api('check-updates');
  const assets=(info.assets||[]).filter(a=>typeof a.url==='string'&&a.url.startsWith('https://github.com/Alan-Poo-Kai-Lun/frame-storyboard-workbench/releases/download/'));
  const exe=assets.find(a=>a.name.endsWith('.exe')),zip=assets.find(a=>a.name.endsWith('.zip'));
  modal(info.available?'发现新版本':'版本信息',`<p class="notice">${esc(info.message)} · 当前 ${esc(info.current)} · 已发布 ${esc(info.latest)}</p><div class="updateDownloads">${exe?releaseLink(exe.url,'下载 Windows EXE'):''}${zip?releaseLink(zip.url,'下载源码安装 / 更新 ZIP'):''}${releaseLink(info.releaseUrl||FRAME_RELEASES,'查看版本说明')}</div><p class="muted">EXE：关闭旧启动器后，双击下载的新版。项目与连接设置保存在同一用户数据目录。<br>源码 ZIP：关闭旧服务器，把下载的专用更新 ZIP 拖到原目录的 Update-Windows.bat，再重启并按 Ctrl+F5。</p>${info.notes?`<details><summary>更新说明</summary><pre class="updateNotes">${esc(info.notes)}</pre></details>`:''}`, [{label:'关闭',class:'primary',action:close}]);
 }catch(e){modal('暂时无法检查更新',`<p class="warning">${esc(e.message)}</p><p class="muted">可能是网络或 GitHub 请求限制。可以稍后重试，或手动打开正式下载页。</p>${releaseLink(FRAME_RELEASES,'打开 GitHub Releases')}`,[{label:'关闭',action:close}])}
 finally{button.disabled=false}
}
$('checkUpdates').onclick=()=>safe(openUpdateCheck);
if(new URLSearchParams(location.search).get('check-updates')==='1'){
 const begin=()=>{if(ready)safe(openUpdateCheck);else if(!$('startupLoadStatus')?.textContent?.startsWith('读取失败'))setTimeout(begin,100)};
 begin();
}
