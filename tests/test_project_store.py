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

 def test_delete_and_restore_preserve_media_and_skip_old_backup_recovery(self):
  a=server.create_project(title='A');a['media']['keep.png']='VEVTVA==';server.save(a);b=server.create_project(title='B')
  result=project_store.delete_projects(self.data,server.STATE,[a['projectId']],b['projectId'])
  self.assertFalse(result['currentDeleted']);self.assertEqual([r['id'] for r in result['projects']],[b['projectId']])
  self.assertEqual(project_store.recover(self.data,server.STATE)['recovered'],0)
  self.assertEqual(project_store.trash_listing(self.data,server.STATE)[0]['id'],a['projectId'])
  project_store.restore_project(self.data,server.STATE,a['projectId'],b['projectId'])
  restored=project_store.open_project(self.data,server.STATE,a['projectId'],b['projectId'],server.save)
  self.assertEqual(restored['media'],a['media']);self.assertEqual(project_store.trash_listing(self.data,server.STATE),[])

 def test_delete_current_blocks_stale_saves_and_leaves_settings_and_library(self):
  a=server.create_project(title='当前');a['media']['audio.wav']='VEVTVA==';server.save(a)
  server.CONFIG.write_text('PRIVATE_SETTINGS','utf-8');library=self.data/'visual-references.json';library.write_text('KEEP_LIBRARY','utf-8')
  result=project_store.delete_projects(self.data,server.STATE,[a['projectId']],a['projectId'])
  self.assertTrue(result['currentDeleted']);self.assertIsNone(server.load_project());self.assertEqual(result['projects'],[])
  with self.assertRaises(ValueError):server.save(a)
  self.assertFalse(server.STATE.exists());self.assertEqual(server.CONFIG.read_text('utf-8'),'PRIVATE_SETTINGS');self.assertEqual(library.read_text('utf-8'),'KEEP_LIBRARY')
  project_store.restore_project(self.data,server.STATE,a['projectId'],'')
  restored=project_store.open_project(self.data,server.STATE,a['projectId'],'',server.save);self.assertEqual(restored['media'],a['media'])

 def test_clear_all_rejects_stale_scope_and_is_recoverable(self):
  a=server.create_project(title='A');b=server.create_project(title='B')
  with self.assertRaises(ValueError):project_store.delete_projects(self.data,server.STATE,[a['projectId']],b['projectId'],True)
  self.assertEqual(len(project_store.listing(self.data,server.STATE)),2)
  result=project_store.delete_projects(self.data,server.STATE,[a['projectId'],b['projectId']],b['projectId'],True)
  self.assertEqual(result['deleted'],2);self.assertEqual(result['projects'],[]);self.assertIsNone(server.load_project())
  project_store.restore_project(self.data,server.STATE,b['projectId'],'');self.assertEqual(len(project_store.listing(self.data,server.STATE)),1)
  self.assertEqual(project_store.recover(self.data,server.STATE)['recovered'],0)

 def test_delete_restore_guards_and_rollback(self):
  from unittest.mock import patch
  a=server.create_project(title='A')
  for ids in [[],['../bad'],[a['projectId'],a['projectId']],[{}],['missing']]:
   with self.assertRaises(ValueError):project_store.delete_projects(self.data,server.STATE,ids,a['projectId'])
  with self.assertRaises(ValueError):project_store.delete_projects(self.data,server.STATE,[a['projectId']],'stale')
  with patch.object(Path,'unlink',side_effect=OSError('cannot remove current')):
   with self.assertRaises(OSError):project_store.delete_projects(self.data,server.STATE,[a['projectId']],a['projectId'])
  self.assertEqual(server.load_project()['projectId'],a['projectId']);self.assertEqual(len(project_store.listing(self.data,server.STATE)),1);self.assertEqual(project_store.trash_listing(self.data,server.STATE),[])

 def test_deleted_project_tasks_are_cancelled_without_touching_other_projects(self):
  import threading,types,task_backend
  from unittest.mock import Mock,patch
  rows=[{'id':'a','projectId':'deleted','status':'waiting'},{'id':'b','projectId':'deleted','status':'running'},{'id':'c','projectId':'kept','status':'waiting'},{'id':'d','projectId':'deleted','status':'done'}]
  manager=types.SimpleNamespace(lock=threading.RLock(),rows=rows,write=Mock(),event=threading.Event())
  with patch.dict(task_backend._INSTANCES,{(str(server.DATA),server.TOKEN):manager}):task_backend.cancel_projects(server,['deleted'])
  self.assertEqual(rows[0]['status'],'cancelled');self.assertTrue(rows[1]['cancelRequested']);self.assertEqual(rows[2]['status'],'waiting');self.assertEqual(rows[3]['status'],'done');manager.write.assert_called_once();self.assertTrue(manager.event.is_set())
