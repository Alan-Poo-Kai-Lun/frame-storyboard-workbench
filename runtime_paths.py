"""Separate read-only bundled resources from durable user data."""
import json,os,shutil,sys,tempfile,time
from pathlib import Path

def resource_dir():return Path(getattr(sys,'_MEIPASS',Path(__file__).resolve().parent))
def program_dir():return Path(sys.executable).resolve().parent if getattr(sys,'frozen',False) else Path(__file__).resolve().parent
def data_dir():
 if os.environ.get('FRAME_DATA_DIR'):return Path(os.environ['FRAME_DATA_DIR']).expanduser().resolve()
 if not getattr(sys,'frozen',False):return resource_dir()/'data'
 if sys.platform=='win32':
  configured=os.environ.get('LOCALAPPDATA');home=Path(configured) if configured else Path.home()/'AppData'/'Local'
 else:
  configured=os.environ.get('XDG_DATA_HOME');home=Path(configured) if configured else Path.home()/'.local/share'
 return home/'FRAME'/'Workbench'/'data'
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
