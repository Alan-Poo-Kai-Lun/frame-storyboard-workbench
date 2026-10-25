import copy,json,os,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import runtime_paths,update_check

class UpdateChecks(unittest.TestCase):
 def setUp(self):runtime_paths._resolved=None
 def tearDown(self):runtime_paths._resolved=None
 def test_resources_and_frozen_data_are_separate(self):
  with tempfile.TemporaryDirectory() as folder:
   with patch.object(sys,'frozen',True,create=True),patch.object(sys,'_MEIPASS',folder+'/resources',create=True),patch.object(sys,'platform','win32'),patch.dict(os.environ,{'LOCALAPPDATA':folder},clear=True):
    self.assertEqual(runtime_paths.resource_dir(),Path(folder+'/resources'))
    self.assertEqual(runtime_paths.data_dir(),runtime_paths.program_dir()/'FRAME-Canvas-R10-Data')
    self.assertNotEqual(runtime_paths.data_dir(),runtime_paths.resource_dir())
 def test_legacy_migration_is_copy_only_and_never_overwrites(self):
  with tempfile.TemporaryDirectory() as folder:
   p=Path(folder);old=p/'old/data';old.mkdir(parents=True);(old/'project.json').write_text('{"title":"原项目"}',encoding='utf-8')
   (old/'settings.json').write_text('{"ai":{"model":"original"}}',encoding='utf-8');(old/'reference-media').mkdir();(old/'reference-media/a.bin').write_bytes(b'MEDIA')
   target=p/'profile/data';target.mkdir(parents=True)
   self.assertTrue(runtime_paths.migrate_legacy_data(old,target));self.assertEqual((target/'project.json').read_bytes(),(old/'project.json').read_bytes());self.assertTrue((old/'reference-media/a.bin').is_file())
   (old/'project.json').write_text('NEW',encoding='utf-8');self.assertFalse(runtime_paths.migrate_legacy_data(old,target));self.assertNotEqual((target/'project.json').read_text(encoding='utf-8'),'NEW')
 def test_newest_beta_selected_and_external_links_ignored(self):
  base='https://github.com/'+update_check.REPOSITORY+'/releases/'
  old={'tag_name':'v3.8-beta.1','html_url':base+'tag/v3.8-beta.1','draft':False,'prerelease':True}
  newest={'tag_name':'v3.9-beta.2','html_url':base+'tag/v3.9-beta.2','draft':False,'prerelease':True,'assets':[{'name':'FRAME-Workbench-Windows-x64-v3.9-beta.2.exe','browser_download_url':base+'download/v3.9-beta.2/FRAME-Workbench-Windows-x64-v3.9-beta.2.exe'},{'name':'FRAME-Workbench-Windows-x64-bad.exe','browser_download_url':'https://evil.example/file.exe'}]}
  result=update_check.release_info([old,newest],'v3.9-beta.1')
  self.assertTrue(result['available']);self.assertEqual(result['latest'],'v3.9-beta.2');self.assertEqual(len(result['assets']),1)
  draft={**newest,'draft':True};self.assertFalse(update_check.release_info([old,draft],'v3.9-beta.1')['available'])
 def test_stable_versions_sort_after_beta_and_future_current_is_kept(self):
  self.assertGreater(update_check.version_key('v3.9'),update_check.version_key('v3.9-beta.99'))
  self.assertGreater(update_check.version_key('v3.10-beta.1'),update_check.version_key('v3.9'))
  self.assertFalse(update_check.release_info([],'v3.9-beta.1')['available'])
 def test_check_uses_public_release_request_without_private_settings(self):
  class Response:
   def __enter__(self):return self
   def __exit__(self,*args):pass
   def read(self,*args):return b'[]'
  with patch('update_check.urlopen',return_value=Response()) as request:
   update_check.check('v3.9-beta.1');req=request.call_args.args[0]
   self.assertEqual(req.full_url,update_check.API_URL);self.assertNotIn('Authorization',req.headers);self.assertIsNone(req.data)

 def test_canvas_versions_are_valid_and_sort_in_iteration_order(self):
  self.assertGreater(update_check.version_key('v3.38-canvas-r10'),update_check.version_key('v3.38-canvas-r9'))
  self.assertGreater(update_check.version_key('v3.38-canvas-r10'),update_check.version_key('v3.37-beta.9-canvas-r7'))
  self.assertGreater(update_check.version_key('v3.39'),update_check.version_key('v3.38-canvas-r10'))
  with self.assertRaises(ValueError):update_check.version_key('v3.38-canvas-r10-invalid')

 def test_canvas_release_is_detected_with_approved_downloads(self):
  tag='v3.38-canvas-r10';base='https://github.com/'+update_check.REPOSITORY+'/releases/'
  row={'tag_name':tag,'html_url':base+'tag/'+tag,'assets':[{'name':'FRAME-Workbench-Windows-x64-'+tag+'.exe','browser_download_url':base+'download/'+tag+'/FRAME-Workbench-Windows-x64-'+tag+'.exe'}]}
  self.assertTrue(update_check.release_info([row],'v3.37-beta.9-canvas-r7')['available'])
  self.assertFalse(update_check.release_info([row],tag)['available'])
  self.assertEqual(len(update_check.release_info([row],tag)['assets']),1)

if __name__=='__main__':unittest.main()
