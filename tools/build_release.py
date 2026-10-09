"""Build the installation ZIP from an explicit input list, never user directories."""
import hashlib,zipfile
from pathlib import Path
from check_release import ROOT,inputs

def build(root=ROOT,output=None):
 names=inputs(root);folder=Path(output) if output else root/'dist';folder.mkdir(parents=True,exist_ok=True)
 path=folder/'FRAME-Storyboard-Workbench-v1.zip';temp=path.with_suffix('.tmp')
 with zipfile.ZipFile(temp,'w',zipfile.ZIP_DEFLATED) as z:
  for name in names:
   raw=(root/name).read_bytes()
   if name.endswith('.bat'):raw=raw.replace(b'\r\n',b'\n').replace(b'\n',b'\r\n')
   info=zipfile.ZipInfo(name,(2026,10,9,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,raw)
 with zipfile.ZipFile(temp) as z:
  if z.testzip() is not None:raise ValueError('Archive CRC failed')
 temp.replace(path)
 digest=hashlib.sha256(path.read_bytes()).hexdigest();(folder/'SHA256SUMS.txt').write_text(digest+'  '+path.name+'\n')
 return path
if __name__=='__main__':print(build())
