"""Manual public-release lookup. No model settings, API keys or project data are sent."""
import json,re
from urllib.parse import urlparse
from urllib.request import Request,urlopen
REPOSITORY='Alan-Poo-Kai-Lun/frame-storyboard-workbench'
RELEASES_URL='https://github.com/'+REPOSITORY+'/releases'
API_URL='https://api.github.com/repos/'+REPOSITORY+'/releases?per_page=20'

def version_key(tag):
 m=re.fullmatch(r'[vV]?(\d+)\.(\d+)(?:\.(\d+))?(?:-beta\.(\d+))?(?:-canvas-r(\d+))?',str(tag))
 if not m:raise ValueError('版本编号无效')
 return (int(m[1]),int(m[2]),int(m[3] or 0),m[4] is None,int(m[4] or 0),int(m[5] or 0))
def approved_url(value,asset=False):
 try:
  p=urlparse(value)
  return p.scheme=='https' and p.netloc=='github.com' and p.path.startswith('/'+REPOSITORY+'/releases/'+('download/' if asset else 'tag/')) and not p.query and not p.fragment
 except Exception:return False
def release_info(rows,current,include_beta=True):
 candidates=[];current_key=version_key(current)
 if not isinstance(rows,list):raise ValueError('GitHub 返回的版本列表无效')
 for r in rows:
  if not isinstance(r,dict) or r.get('draft') or (r.get('prerelease') and not include_beta):continue
  try:key=version_key(r.get('tag_name'))
  except ValueError:continue
  if not approved_url(r.get('html_url','')):continue
  candidates.append((key,r))
 if not candidates:return {'current':current,'available':False,'latest':current,'releaseUrl':RELEASES_URL,'message':'尚未找到可下载版本，可稍后查看 Releases。','assets':[]}
 key,r=max(candidates,key=lambda x:x[0]);assets=[]
 for a in r.get('assets',[]):
  name=a.get('name','');url=a.get('browser_download_url','')
  if isinstance(name,str) and approved_url(url,True) and (name.startswith('FRAME-Workbench-Windows-x64-') and name.endswith('.exe') or name.startswith('FRAME-Storyboard-Workbench-') and name.endswith('.zip') or name=='SHA256SUMS.txt'):
   assets.append({'name':name,'url':url,'size':a.get('size',0)})
 return {'current':current,'latest':r['tag_name'],'available':key>current_key,'releaseUrl':r['html_url'],'notes':str(r.get('body') or '')[:12000],'publishedAt':r.get('published_at',''),'assets':assets,'message':'发现新版本' if key>current_key else '当前已是最新可用版本'}
def check(current,include_beta=True):
 req=Request(API_URL,headers={'Accept':'application/vnd.github+json','User-Agent':'FRAME-Workbench-Update-Check','X-GitHub-Api-Version':'2022-11-28'})
 with urlopen(req,timeout=12) as response:raw=response.read(2*1024*1024+1)
 if len(raw)>2*1024*1024:raise ValueError('版本信息过大，请直接查看 GitHub Releases')
 return release_info(json.loads(raw),current,include_beta)
