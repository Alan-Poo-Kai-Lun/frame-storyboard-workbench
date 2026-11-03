"""Verify package imports, resource roots and flat-source upgrade compatibility."""
import ast,importlib,importlib.util,json,os,subprocess,sys,tempfile,unittest,zipfile
from pathlib import Path
from backend.utils import runtime_paths,update_workbench
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from build_release import build

class BackendPackageChecks(unittest.TestCase):
 def test_source_resource_root_and_all_runtime_modules(self):
  self.assertEqual(runtime_paths.resource_dir(),ROOT)
  self.assertEqual(runtime_paths.program_dir(),ROOT)
  for name in json.loads((ROOT/'release-manifest.json').read_text('utf-8')):
   if not name.startswith('backend/') or not name.endswith('.py') or name.endswith('__init__.py'):continue
   module=importlib.import_module(name[:-3].replace('/','.'))
   self.assertEqual(Path(module.__file__).resolve(),ROOT/name)
   self.assertFalse((ROOT/Path(name).name).exists())
  from backend.services import writing_backend
  self.assertEqual(len(writing_backend.BUILTINS),3)
  self.assertTrue(all(len(r['rules'])>100 for r in writing_backend.BUILTINS))
 def test_imports_do_not_depend_on_retired_flat_modules(self):
  modules={p.stem for p in (ROOT/'backend').rglob('*.py') if p.name!='__init__.py'}
  for file in [ROOT/'server.py',*(ROOT/'backend').rglob('*.py'),ROOT/'tools/windows_launcher.py']:
   for node in ast.walk(ast.parse(file.read_text('utf-8'))):
    if isinstance(node,ast.Import):self.assertFalse(any(n.name in modules for n in node.names),str(file))
    if isinstance(node,ast.ImportFrom):self.assertNotIn(node.module,modules,str(file))
 def test_flat_updater_accepts_new_zip_without_touching_user_data(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);target=root/'installed';target.mkdir();(target/'web').mkdir();(target/'data').mkdir()
   (target/'server.py').write_text('# old server','utf-8');(target/'web/index.html').write_text('old','utf-8');(target/'README.md').write_text('FRAME V3.41.1','utf-8')
   private=target/'data/settings.json';private.write_text('PRIVATE_SENTINEL','utf-8')
   retired=target/'ai_runtime.py';retired.write_text('# retired runtime','utf-8')
   spec=importlib.util.spec_from_file_location('legacy_updater_fixture',ROOT/'tests/fixtures/legacy_update_workbench.py');legacy=importlib.util.module_from_spec(spec);spec.loader.exec_module(legacy)
   legacy.install(build(ROOT,root/'dist'),target)
   self.assertEqual(private.read_text('utf-8'),'PRIVATE_SENTINEL')
   self.assertTrue((target/'backend/ai/ai_runtime.py').is_file());self.assertTrue(retired.exists())
   archive=update_workbench.retire_old_modules(target)
   self.assertFalse(retired.exists());self.assertTrue(private.exists())
   with zipfile.ZipFile(archive) as z:self.assertIn('FRAME-Storyboard-Workbench/ai_runtime.py',z.namelist())
   check="import sys;sys.path.insert(0,sys.argv[1]);from backend.utils import runtime_paths;from backend.services import writing_backend;import server;assert runtime_paths.resource_dir()==server.ROOT;assert (server.ROOT/'web/index.html').is_file();assert len(writing_backend.BUILTINS)==3"
   subprocess.run([sys.executable,'-c',check,str(target)],cwd=root,env={**os.environ,'FRAME_DATA_DIR':str(target/'data'),'PYTHONDONTWRITEBYTECODE':'1'},check=True,timeout=20)
 def test_updated_backend_is_in_program_backup(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);target=root/'installed';target.mkdir();(target/'server.py').write_text('# previous','utf-8');module=target/'backend/ai/ai_runtime.py';module.parent.mkdir(parents=True);module.write_text('# previous backend','utf-8')
   result=update_workbench.install(build(ROOT,root/'dist'),target)
   with zipfile.ZipFile(result['backup']) as z:self.assertEqual(z.read('FRAME-Storyboard-Workbench/backend/ai/ai_runtime.py'),b'# previous backend')

if __name__=='__main__':unittest.main()
