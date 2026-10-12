"""Publish verified artifacts in GitHub Actions. Never replace a published version."""
import argparse,hashlib,json,os
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request,urlopen
ROOT=Path(__file__).resolve().parents[1]
EXPECTED_REPOSITORY='Alan-Poo-Kai-Lun/frame-storyboard-workbench'

def publish(repository,sha,folder):
 if repository!=EXPECTED_REPOSITORY:raise ValueError('Unexpected release repository')
 if len(sha)!=40 or any(c not in '0123456789abcdef' for c in sha):raise ValueError('Expected a concrete commit SHA')
 token=os.environ.get('GITHUB_TOKEN','')
 if not token:raise ValueError('GITHUB_TOKEN is required in Actions; never pass it on the command line')
 version=json.loads((ROOT/'version.json').read_text('utf-8'));tag=version['release']
 folder=Path(folder);names=['FRAME-Storyboard-Workbench-'+tag+'.zip','FRAME-Workbench-Windows-x64-'+tag+'.exe','SHA256SUMS.txt']
 for name in names:
  if not (folder/name).is_file():raise ValueError('Missing verified artifact: '+name)
 sums=dict((name,digest) for digest,name in (line.split('  ',1) for line in (folder/'SHA256SUMS.txt').read_text('utf-8').splitlines() if line))
 for name in names[:2]:
  if hashlib.sha256((folder/name).read_bytes()).hexdigest()!=sums.get(name):raise ValueError('Checksum mismatch: '+name)
 base='https://api.github.com/repos/'+repository
 def request(url,method='GET',data=None,mime='application/json'):
  raw=json.dumps(data).encode() if isinstance(data,dict) else data
  req=Request(url,data=raw,method=method,headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','Content-Type':mime,'User-Agent':'FRAME-Release-Publisher','X-GitHub-Api-Version':'2022-11-28'})
  with urlopen(req,timeout=120) as r:return json.load(r)
 try:release=request(base+'/releases/tags/'+quote(tag,safe=''))
 except HTTPError as e:
  if e.code!=404:raise
  # Include an interrupted draft so reruns do not create duplicate tags/assets.
  release=next((r for r in request(base+'/releases?per_page=100') if r.get('tag_name')==tag),None)
 if release and not release.get('draft'):
  print('Published version already exists; preserved unchanged: '+release['html_url']);return release['html_url']
 notes=(ROOT/'docs'/('release-'+tag+'.md')).read_text('utf-8')
 if not release:release=request(base+'/releases','POST',{'tag_name':tag,'target_commitish':sha,'name':'FRAME '+tag,'body':notes,'draft':True,'prerelease':'-beta.' in tag})
 elif release.get('target_commitish')!=sha:raise ValueError('Draft belongs to another commit. Bump the release version instead of replacing it.')
 for name in names:
  old=next((a for a in release.get('assets',[]) if a.get('name')==name),None)
  if old:
   remote=request(base+'/releases/assets/'+str(old['id']))
   if remote.get('digest')=='sha256:'+hashlib.sha256((folder/name).read_bytes()).hexdigest():continue
   raise ValueError('Draft asset exists with different content; do not overwrite it: '+name)
  url='https://uploads.github.com/repos/'+repository+'/releases/'+str(release['id'])+'/assets?name='+quote(name,safe='')
  request(url,'POST',(folder/name).read_bytes(),'application/octet-stream')
 release=request(base+'/releases/'+str(release['id']),'PATCH',{'draft':False,'prerelease':'-beta.' in tag,'make_latest':'false' if '-beta.' in tag else 'true'})
 print('Published: '+release['html_url']);return release['html_url']

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--repository',required=True);p.add_argument('--sha',required=True);p.add_argument('--folder',type=Path,default=ROOT/'dist');a=p.parse_args();publish(a.repository,a.sha,a.folder)
