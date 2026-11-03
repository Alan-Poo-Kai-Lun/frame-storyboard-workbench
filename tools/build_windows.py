"""Build a one-file Windows launcher from public resources only."""
import hashlib,json,os,shutil,struct,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def icon_bytes():
 size=32;pixels=bytearray()
 for y in reversed(range(size)):
  for x in range(size):
   mark=(8<=x<12 and 7<=y<25) or (8<=x<25 and 7<=y<11) or (8<=x<23 and 14<=y<18)
   r,g,b=(223,234,145) if mark else (28,34,41);pixels.extend((b,g,r,255))
 mask=b'\0'*(((size+31)//32)*4*size)
 dib=struct.pack('<IIIHHIIIIII',40,size,size*2,1,32,0,len(pixels)+len(mask),0,0,0,0)+pixels+mask
 return struct.pack('<HHH',0,1,1)+struct.pack('<BBBBHHII',size,size,0,0,1,32,len(dib),22)+dib

def copy_pillow_notices(notices):
 from importlib.metadata import distribution
 dist=distribution('Pillow')
 files=[f for f in dist.files or [] if '.dist-info/licenses/' in str(f).replace('\\','/')]
 if not files:raise RuntimeError('Pillow license files missing')
 for file in files:
  relative=str(file).replace('\\','/').split('.dist-info/licenses/',1)[1]
  dest=notices/'Pillow'/relative
  dest.parent.mkdir(parents=True,exist_ok=True)
  shutil.copyfile(dist.locate_file(file),dest)

def build():
 if sys.platform!='win32':raise RuntimeError('Windows EXE 必须在 Windows 构建；使用仓库的 Windows release workflow')
 sys.path.insert(0,str(ROOT/'tools'));from check_release import inputs
 names=inputs(ROOT)
 output=ROOT/'dist';output.mkdir(exist_ok=True);work=ROOT/'build/windows';work.mkdir(parents=True,exist_ok=True)
 icon=work/'FRAME.ico';icon.write_bytes(icon_bytes())
 resources=work/'resources';resources.mkdir(exist_ok=True)
 for rel in names:
  if rel.startswith(('web/','presets/')) or rel in ['version.json','LICENSE','NOTICE.md','vendor-manifest.json']:
   dest=resources/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/rel,dest)
 from importlib.metadata import distribution
 notices=resources/'third-party-notices';notices.mkdir(exist_ok=True)
 copy_pillow_notices(notices)
 dist=distribution('pyinstaller')
 copying=next((Path(dist.locate_file(f)) for f in dist.files or [] if str(f).endswith('COPYING.txt')),None)
 licenses=[(Path(sys.base_prefix)/'LICENSE.txt','Python-LICENSE.txt'),(copying,'PyInstaller-COPYING.txt')]
 for file,name in licenses:
  if file is None or not file.is_file():raise RuntimeError('Runtime license missing: '+name)
  shutil.copyfile(file,notices/name)
 tcl_terms=list((Path(sys.base_prefix)/'tcl').rglob('license.terms'))
 if not tcl_terms:raise RuntimeError('Tcl/Tk license text missing')
 for file in tcl_terms:shutil.copyfile(file,notices/(file.parent.name+'-license.terms'))
 release=json.loads((ROOT/'version.json').read_text('utf-8'))['release']
 name='FRAME-Workbench-Windows-x64-'+release
 command=[sys.executable,'-m','PyInstaller','--clean','--noconfirm','--onefile','--windowed','--name',name,'--paths',str(ROOT),'--icon',str(icon),'--distpath',str(output),'--workpath',str(work/'pyinstaller'),'--specpath',str(work)]
 runtime_tmp=os.environ.get('FRAME_BUILD_RUNTIME_TMP','').strip()
 if runtime_tmp:command+=['--runtime-tmpdir',runtime_tmp]
 for src,dest in [(resources/'web','web'),(resources/'presets','presets'),(resources/'version.json','.'),(resources/'LICENSE','.'),(resources/'NOTICE.md','.'),(resources/'vendor-manifest.json','.'),(notices,'third-party-notices'),(icon,'.')]:command+=['--add-data',str(src)+os.pathsep+dest]
 for module in ['backend.utils.library_clipboard','backend.project.handoff_archive','backend.ai.ai_continuity','backend.project.continuity_review','backend.utils.video_provider_contract','backend.project.media_analysis','server','backend.project.plan_store','backend.ai.h3_compiler','backend.project.creative_library','backend.ai.prompt_translation','backend.services.writing_backend','backend.services.agent_backend','backend.project.asset_lifecycle','backend.project.project_hub','backend.presets.appearance_presets','PIL.Image','PIL.ImageOps','backend.presets.editor_presets','backend.utils.runtime_paths','backend.utils.update_check','backend.services.task_backend','backend.services.studio_backend','backend.services.reverse_backend','backend.services.planning_backend','backend.project.asset_analysis','backend.ai.prompt_review','backend.presets.visual_library','backend.presets.reference_packs','backend.project.project_store','backend.ai.ai_runtime','backend.utils.update_workbench','backend.project.project_media','backend.project.project_layout','backend.presets.theme_backdrops']:command+=['--hidden-import',module]
 command.append(str(ROOT/'tools/windows_launcher.py'));subprocess.run(command,check=True,cwd=ROOT)
 exe=output/(name+'.exe');assert exe.is_file()
 sums=output/'SHA256SUMS.txt';old=sums.read_text('utf-8') if sums.exists() else ''
 lines=[line for line in old.splitlines() if not line.endswith('  '+exe.name)];lines.append(hashlib.sha256(exe.read_bytes()).hexdigest()+'  '+exe.name);sums.write_text('\n'.join(lines)+'\n','utf-8')
 print(exe);return exe
if __name__=='__main__':build()
