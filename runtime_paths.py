"""Separate read-only bundled resources from durable user data."""
import json,os,shutil,sys,tempfile,time
from pathlib import Path

# One stable folder name: a per-release name forced a full copy of every project and
# media file on each upgrade, which is how a workbench ends up holding several
# gigabytes of duplicate data. Older per-release folders are adopted in place.
DATA_FOLDER='FRAME-Data'
LEGACY_FOLDERS=('FRAME-Canvas-R12-Data','FRAME-Canvas-R11-Data','FRAME-Canvas-R10-Data','FRAME-Canvas-R9-Data')
LEGACY_HOMES=('FRAME-Canvas-R12','FRAME-Canvas-R11','FRAME-Canvas-R10','FRAME-Canvas-R9')
SCHEMA_FILE='schema.json'
SCHEMA_VERSION=2
# Applied in order on first launch after an upgrade; each step edits the folder in
# place, so a new release never has to duplicate the user's data.
MIGRATIONS=()
MARKERS=('project.json','settings.json','tasks.json','visual-references.json','reference-media','asset-library.json','canvas-presets.json','editor-presets.json')
_resolved=None


def configure_temp():
 """Keep application-owned temporary files beside the program, falling back to the system folder.

 The frozen build used to hard-code a developer drive. On a machine without that drive
 ``mkdir`` raised during import, so the launcher could not even show an error. A temp
 folder is never worth failing a launch for.
 """
 if sys.platform!='win32':return
 for candidate in temp_candidates():
  try:
   # Creating the folder is the write test: if it works, files can be written there.
   candidate.mkdir(parents=True,exist_ok=True)
  except OSError:
   continue
  if not os.access(candidate,os.W_OK):
   continue
  os.environ['TEMP']=os.environ['TMP']=str(candidate)
  tempfile.tempdir=str(candidate)
  return


def temp_candidates():
 requested=os.environ.get('FRAME_TEMP_DIR')
 if requested:yield Path(requested).expanduser()
 yield program_dir()/'temp'
 yield Path(tempfile.gettempdir())

def resource_dir():return Path(getattr(sys,'_MEIPASS',Path(__file__).resolve().parent))
def program_dir():return Path(sys.executable).resolve().parent if getattr(sys,'frozen',False) else Path(__file__).resolve().parent

def has_data(path):
 """True when a folder exists and holds anything at all, including an empty project list."""
 try:return path.is_dir() and any(path.iterdir())
 except OSError:return False

SETTINGS_FILE='launcher-settings.json'

def settings_file():
 """Portable build keeps settings beside the EXE; read-only installs fall back to APPDATA."""
 portable=program_dir()/SETTINGS_FILE
 try:
  if os.access(program_dir(),os.W_OK):return portable
 except OSError:pass
 base=Path(os.environ.get('APPDATA') or Path.home())/'FRAME'
 try:base.mkdir(parents=True,exist_ok=True)
 except OSError:pass
 return base/SETTINGS_FILE

def load_settings():
 """Never raise: a corrupt or missing file just means "no overrides"."""
 try:
  payload=json.loads(settings_file().read_text('utf-8'))
  return payload if isinstance(payload,dict) else {}
 except (OSError,ValueError,TypeError):return {}

def save_settings(values):
 current=load_settings()
 current.update(values)
 path=settings_file()
 temp=path.with_suffix('.tmp')
 temp.write_text(json.dumps(current,ensure_ascii=False,indent=2),'utf-8')
 temp.replace(path)
 return current

def configured_data_dir():
 """User-chosen data folder from the launcher settings, or None."""
 raw=load_settings().get('dataDir')
 if not raw:return None
 try:return Path(raw).expanduser().resolve()
 except (OSError,ValueError):return None

def export_dir():
 """Default director-pack output folder, or None when the browser should decide."""
 raw=load_settings().get('exportDir')
 if not raw:return None
 try:
  path=Path(raw).expanduser()
  return path if path.is_dir() else None
 except (OSError,ValueError):return None

def data_dir():
 global _resolved
 if os.environ.get('FRAME_DATA_DIR'):return Path(os.environ['FRAME_DATA_DIR']).expanduser().resolve()
 configured=configured_data_dir()
 if configured:return configured
 if not getattr(sys,'frozen',False):return resource_dir()/'data'
 if _resolved:return _resolved
 root=program_dir();target=root/DATA_FOLDER
 if not has_data(target):
  # A per-release folder sitting beside the EXE belongs to this installation, so keep
  # using it where it is. Copying it would double the user's disk for no gain.
  beside=next((root/name for name in LEGACY_FOLDERS if has_data(root/name)),None)
  if beside:
   target=beside
  else:
   # A folder inside another program's directory is copied once instead: writing into
   # a sibling installation would surprise whoever still opens that version.
   sibling=next((path for path in legacy_candidates() if has_data(path)),None)
   if sibling:
    try:migrate_legacy_data(sibling,target)
    except Exception:pass
 _resolved=target
 return target

def legacy_candidates():
 root=program_dir()
 for home in LEGACY_HOMES:
  for name in LEGACY_FOLDERS:
   yield root.parent/home/name

def migrate_legacy_data(source,target):
 """Copy into an empty destination atomically; never overwrite or remove the source."""
 source=Path(source).resolve();target=Path(target).resolve()
 if source==target or not source.is_dir():return False
 if source in target.parents or target in source.parents:raise ValueError('旧数据目录与目标目录不能互相包含')
 if target.exists() and any(target.iterdir()):return False
 if not any((source/name).exists() for name in MARKERS):return False
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

def schema_version(data):
 try:return int(json.loads((Path(data)/SCHEMA_FILE).read_text('utf-8')).get('schemaVersion') or 0)
 except (OSError,ValueError,TypeError):return 0

def ensure_schema(data):
 """Record the data layout version so a later release can migrate in place."""
 data=Path(data)
 if not data.is_dir():return schema_version(data)
 current=schema_version(data)
 if current>=SCHEMA_VERSION:return current
 for version,step in MIGRATIONS:
  if current<version:
   step(data);current=version
 path=data/SCHEMA_FILE;temp=path.with_suffix('.tmp')
 temp.write_text(json.dumps({'schemaVersion':SCHEMA_VERSION,'updatedAt':time.strftime('%Y-%m-%d %H:%M:%S')},ensure_ascii=False),'utf-8')
 temp.replace(path)
 return SCHEMA_VERSION
