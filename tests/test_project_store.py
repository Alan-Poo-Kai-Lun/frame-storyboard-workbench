import copy,json,tempfile,unittest
from pathlib import Path
import server,project_store
class ProjectStoreChecks(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.data=Path(self.tmp.name);self.original=(server.DATA,server.STATE,server.CONFIG);server.DATA=self.data;server.STATE=self.data/'project.json';server.CONFIG=self.data/'settings.json'
 def tearDown(self):server.DATA,server.STATE,server.CONFIG=self.original;self.tmp.cleanup()
 def test_multiple_projects_switch_with_edits_and_media(self):
  a=server.create_project(example=True);a['title']='项目 A';server.save(a);b=server.create_project(title='项目 B');b['script']='第二个故事';server.save(b)
  rows=project_store.listing(self.data,server.STATE);self.assertEqual(len(rows),2)
  restored=project_store.open_project(self.data,server.STATE,a['projectId'],b['projectId'],server.save);self.assertEqual(restored['media'],a['media']);self.assertEqual(restored['title'],'项目 A')
  restored['segments'][0]['storyText']='后续修改';server.save(restored);project_store.open_project(self.data,server.STATE,b['projectId'],a['projectId'],server.save);again=project_store.open_project(self.data,server.STATE,a['projectId'],b['projectId'],server.save);self.assertEqual(again['segments'][0]['storyText'],'后续修改')
 def test_current_saves_do_not_duplicate_media_archive(self):
  a=server.create_project(example=True);server.save(a);self.assertFalse((self.data/'projects').exists())
 def test_recover_old_backups_deduplicates_and_preserves_current(self):
  current=server.create_project(title='当前');folder=self.data/'backups';folder.mkdir(exist_ok=True);old=copy.deepcopy(current);old.update(projectId='old',title='旧项目');(folder/'old.json').write_text(json.dumps(old),encoding='utf-8');(folder/'old-copy.json').write_text(json.dumps(old),encoding='utf-8');(folder/'broken.json').write_text('broken',encoding='utf-8')
  r=project_store.recover(self.data,server.STATE);self.assertEqual(r['recovered'],1);self.assertEqual(r['skipped'],1);self.assertEqual(server.load_project()['projectId'],current['projectId']);self.assertEqual(project_store.recover(self.data,server.STATE)['recovered'],0)
 def test_switch_guard_and_paths(self):
  a=server.create_project(title='A');b=server.create_project(title='B')
  with self.assertRaises(ValueError):project_store.open_project(self.data,server.STATE,a['projectId'],'stale',server.save)
  with self.assertRaises(ValueError):project_store.open_project(self.data,server.STATE,'../../bad',b['projectId'],server.save)
  self.assertEqual(server.load_project()['projectId'],b['projectId'])
