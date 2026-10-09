"""Install a local FRAME ZIP in place; keep data and centralize program backups."""
import argparse,datetime,json,re,socket,sys,zipfile
from pathlib import Path,PurePosixPath
OBSOLETE_FILES=['video_backend.py', 'enhance_backend.py', 'web/video.js', 'web/prompt-enhance.js', 'presets/Qwen21-i2i-API.json', 'presets/Qwen21-t2i-API.json', 'presets/Qwen21-workbench-profile.json', 'presets/character-prompt-defaults.json', 'presets/system_prompt_edit.txt', 'presets/system_prompt_t2i.txt', 'demo/example.mmxpack.zip']

def archive_files(path):
 with zipfile.ZipFile(path) as z:
  result={}
  total=0
  if len(z.infolist())>1000:raise ValueError('更新包文件过多')
  for item in z.infolist():
   name=item.filename.replace('\\','/');parts=PurePosixPath(name).parts
   if name.startswith('/') or '..' in parts or ':' in name or item.file_size>64*1024*1024:raise ValueError('更新包包含无效路径或过大文件')
   if item.is_dir():continue
   if parts and parts[0]=='FRAME-Storyboard-Workbench':parts=parts[1:]
   rel=PurePosixPath(*parts)
   if parts and parts[0]=='versions':continue
   if not parts or parts[0] in ['data','__pycache__'] or str(rel) in result:raise ValueError('更新包不能包含项目数据、版本档案或重复路径')
   if item.external_attr>>16 & 0o170000==0o120000:raise ValueError('更新包不能包含符号链接')
   total+=item.file_size
   if total>128*1024*1024:raise ValueError('更新包解压内容过大')
   result[str(rel)]=z.read(item)
  if sum(map(len,result.values()))>128*1024*1024:raise ValueError('更新包解压内容过大')
 if not {'server.py','web/index.html','README.md'}.issubset(result):raise ValueError('这不是 FRAME 工作台安装包')
 return result

def version_name(files):
 raw=files.get('README.md',b'').decode('utf-8',errors='replace');m=re.search(r'\bV(\d+\.\d+)\b',raw)
 return 'V'+m[1] if m else 'unknown'

def install(package,target):
 target=Path(target).resolve();files=archive_files(package)
 if not (target/'server.py').is_file():raise ValueError('请在现有工作台目录中运行更新脚本')
 if any((target/name).is_symlink() or any(p.is_symlink() for p in (target/name).parents if p!=target.parent) for name in files):raise ValueError('目标目录含符号链接，未更新')
 old={}
 for p in target.iterdir():
  if p.is_file() and p.suffix.lower() in ['.py','.bat','.md','.json','.txt']:old[p.name]=p.read_bytes()
 for folder in ['web','presets','demo']:
  for p in (target/folder).rglob('*'):
   if p.is_file() and not p.is_symlink():old[str(p.relative_to(target)).replace('\\','/')]=p.read_bytes()
 backups=target/'versions'
 if backups.is_symlink():raise ValueError('版本档案目录不能是符号链接')
 backups.mkdir(exist_ok=True)
 oldversion=version_name(old);stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f');backup=backups/f'FRAME-Workbench-{oldversion}-{stamp}.zip'
 with zipfile.ZipFile(backup,'w',zipfile.ZIP_DEFLATED) as z:
  for name,value in old.items():z.writestr('FRAME-Storyboard-Workbench/'+name,value)
 obsolete=json.loads(files.get('version.json',b'{}')).get('obsolete_files',[])
 allowed_obsolete=OBSOLETE_FILES
 if not isinstance(obsolete,list) or any(name not in allowed_obsolete for name in obsolete):raise ValueError('更新包的旧模块清理列表无效')
 if any((target/name).is_symlink() or any(p.is_symlink() for p in (target/name).parents if p!=target.parent) for name in obsolete):raise ValueError('旧模块路径含符号链接，未清理')
 written=[]
 try:
  for name,value in files.items():
   dest=target/name;dest.parent.mkdir(parents=True,exist_ok=True);temp=dest.with_name(dest.name+'.update-tmp');temp.write_bytes(value);temp.replace(dest);written.append(name)
  for name in obsolete:
   if name not in files and (target/name).is_file():written.append(name);(target/name).unlink()
 except Exception:
  for name in reversed(written):
   dest=target/name
   if name in old:dest.write_bytes(old[name])
   else:dest.unlink(missing_ok=True)
  for name in files:
   try:(target/name).with_name(Path(name).name+'.update-tmp').unlink(missing_ok=True)
   except OSError:pass
  raise
 return {'version':version_name(files),'backup':str(backup),'directory':str(target)}

def retire_old_modules(target):
 target=Path(target).resolve();existing=[name for name in OBSOLETE_FILES if (target/name).is_file() and not (target/name).is_symlink() and not any(p.is_symlink() for p in (target/name).parents if p!=target.parent)]
 if not existing:return None
 folder=target/'versions'
 if folder.is_symlink():raise ValueError('版本目录不能是符号链接')
 folder.mkdir(exist_ok=True);stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f');archive=folder/f'FRAME-Retired-Modules-{stamp}.zip'
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
  for name in existing:z.write(target/name,'FRAME-Storyboard-Workbench/'+name)
 with zipfile.ZipFile(archive) as z:
  if z.testzip() is not None:raise ValueError('旧模块备份校验失败，未清理')
 for name in existing:(target/name).unlink()
 return str(archive)

def main():
 parser=argparse.ArgumentParser(description='Update FRAME from a downloaded ZIP; preserve data and archive the old program.')
 parser.add_argument('package',type=Path);parser.add_argument('--target',type=Path,default=Path(__file__).resolve().parent);args=parser.parse_args()
 try:
  with socket.socket() as probe:
   probe.settimeout(.5)
   if probe.connect_ex(('127.0.0.1',8787))==0:raise ValueError('请先关闭工作台服务器，再更新程序')
  result=install(args.package,args.target);print('Updated to '+result['version']+'\nPrevious program: '+result['backup']+'\nProject data preserved. Restart and press Ctrl+F5.')
 except Exception as e:print('Update failed: '+str(e),file=sys.stderr);return 1
 return 0
if __name__=='__main__':raise SystemExit(main())
