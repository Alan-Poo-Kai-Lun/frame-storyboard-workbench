"""Validate explicit release inputs without touching user data."""
import ast,hashlib,json,re,subprocess,zipfile
from pathlib import Path,PurePosixPath
ROOT=Path(__file__).resolve().parents[1]
SECRET=re.compile(r'(?:\bsk-[A-Za-z0-9_-]{20,}|\bgh[pousr]_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)')
STARTER='presets/starter-project.mmxpack.zip'
STARTER_SHA256='2976b88232c9cd469ca0f2411c51d3d6e83d47e7d49e533a0b2ac99b6006d67a'
def inputs(root=ROOT):
 names=json.loads((root/'release-manifest.json').read_text('utf-8'))
 if not isinstance(names,list) or not names or len(names)!=len(set(names)):raise ValueError('Missing or duplicate release manifest entries')
 for name in names:
  if not isinstance(name,str):raise ValueError('Invalid manifest entry')
  p=PurePosixPath(name)
  if p.is_absolute() or '..' in p.parts or '\\' in name or ':' in name:raise ValueError('Unsafe release path: '+name)
  if p.parts[0] in {'data','.git','.github','dist','tests','tools'} or (name!=STARTER and p.suffix.lower() in {'.zip','.mp4','.mov','.webm','.mmxpack','.key','.pem'}):raise ValueError('Private/non-runtime release entry: '+name)
  if p.parts[0]=='versions' and name!='versions/README.txt':raise ValueError('Archived program in release')
  file=root/name
  if not file.is_file() or file.is_symlink() or any(parent.is_symlink() for parent in file.parents if parent!=root.parent):raise ValueError('Missing or linked input: '+name)
  if name==STARTER:
   if hashlib.sha256(file.read_bytes()).hexdigest()!=STARTER_SHA256:raise ValueError('Starter project changed; inspect and approve its checksum before packaging')
   with zipfile.ZipFile(file) as z:
    if z.testzip() is not None:raise ValueError('Starter project CRC failed')
    for entry in z.namelist():
     if entry.endswith('.json') and SECRET.search(z.read(entry).decode('utf-8')):raise ValueError('Possible credential in starter project')
  elif p.suffix.lower()=='.png' and p.parts[:3]==('docs','assets','screenshots'):
   if not file.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'):raise ValueError('Invalid documentation PNG: '+name)
  elif p.suffix.lower() in {'.jpg','.jpeg'} and p.parts[:3]==('docs','assets','screenshots'):
   if not file.read_bytes().startswith(b'\xff\xd8\xff'):raise ValueError('Invalid documentation JPEG: '+name)
  else:
   raw=file.read_text('utf-8')
   if SECRET.search(raw):raise ValueError('Possible credential in '+name)
  if name!=STARTER and file.stat().st_size>2*1024*1024:raise ValueError('Oversized source file: '+name)
  if name.endswith('.py'):ast.parse(raw,filename=name)
  if name.endswith('.json'):json.loads(raw)
 for required in ['server.py','web/index.html','version.json','LICENSE','README.md']:
  if required not in names:raise ValueError('Required file omitted: '+required)
 return names
if __name__=='__main__':
 names=inputs()
 print('PASS: '+str(len(names))+' explicit runtime inputs; checksum-verified starter only; no user data or obvious credentials')
