"""Separate read-only bundled resources from durable user data."""
import json,os,shutil,sys,tempfile,time
from pathlib import Path

DATA_FOLDER='FRAME-Canvas-R11-Data'
LEGACY_FOLDERS=('FRAME-Canvas-R10-Data','FRAME-Canvas-R9-Data')
LEGACY_HOMES=('FRAME-Canvas-R10','FRAME-Canvas-R9')
_resolved=None

def configure_temp():
 """Keep application-owned temporary files on the requested D drive."""
 if sys.platform!='win32':return
 folder=Path(r'D:\Codex\FRAME\FRAME-Canvas-R11\temp')
 folder.mkdir(parents=True,exist_ok=True)
 os.environ['TEMP']=os.environ['TMP']=str(folder)
 tempfile.tempdir=str(folder)

def resource_dir():return Path(getattr(sys,'_MEIPASS',Path(__file__).resolve().parent))
def program_dir():return Path(sys.executable).resolve().parent if getattr(sys,'frozen',False) else Path(__file__).resolve().parent
def data_dir():
 global _resolved
 if os.environ.get('FRAME_DATA_DIR'):return Path(os.environ['FRAME_DATA_DIR']).expanduser().resolve()
 if not getattr(sys,'frozen',False):return resource_dir()/'data'
 if _resolved:return _resolved
 target=program_dir()/DATA_FOLDER
 if not target.exists() or not any(target.iterdir()):
  # An update must not look like an empty workbench: copy the previous canvas data
  # once, and leave the old folder untouched. The previous version may sit beside
  # the new EXE or in its own sibling folder.
  for source in legacy_candidates():
   if source.is_dir() and any(source.iterdir()):
    try: migrate_legacy_data(source,target)
    except Exception: pass
    break
 _resolved=target
 return target
def legacy_candidates():
 root=program_dir()
 for name in LEGACY_FOLDERS: yield root/name
 for home in LEGACY_HOMES:
  for name in LEGACY_FOLDERS: yield root.parent/home/name
def migrate_legacy_data(source,target):
 """Copy into an empty destination atomically; never overwrite or remove the source."""
 source=Path(source).resolve();target=Path(target).resolve()
 if source==target or not source.is_dir():return False
 if source in target.parents or target in source.parents:raise ValueError('旧数据目录与目标目录不能互相包含')
 if target.exists() and any(target.iterdir()):return False
 if not any((source/name).exists() for name in ['project.json','settings.json','tasks.json','visual-references.json','reference-media','asset-library.json','canvas-presets.json','editor-presets.json']):return False
 if source.is_symlink() or any(p.is_symlink() for p in source.rglob('*')):raise ValueError('旧数据含符号链接，请先使用项目备份导入，原数据未改动')
 target.parent.mkdir(parents=True,exist_ok=True)
 staging=Path(tempfile.mkdtemp(prefix='.frame-migrate-',dir=target.parent))
 try:
  shutil.copytree(source,staging,dirs_exist_ok=True)
  (staging/'.migration.json').write_text(json.dumps({'source':str(source),'copiedAt':time.strftime('%Y-%m-%d %H:%M:%S'),'sourcePreserved':True},ensure_ascii=False),'utf-8')
  if target.exists():target.rmdir()
  staging.replace(target)
 finally:
  if staging.exists():shutil.rmtree(staging)
 return True
