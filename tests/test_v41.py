import copy,io,json,unittest,zipfile
import server
from backend.project import plan_store
import test_plan_archive as fixture

class V41Checks(unittest.TestCase):
 def setUp(self):
  self.f=fixture.PlanArchiveChecks();self.f.setUp();self.addCleanup(self.f.tearDown)
 def endpoint(self,**kw):return plan_store.endpoint(server,{'projectId':self.f.p['projectId'],**kw})
 def test_history_roundtrip_dedup_rename(self):
  snapshot={'story':'first idea','assetIds':[],'count':3,'duration':15,'visualTone':'film'}
  self.endpoint(action='history-save',snapshot=snapshot);self.endpoint(action='history-save',snapshot=snapshot)
  rows=self.endpoint(action='history-list')['items'];self.assertEqual(len(rows),1)
  self.endpoint(action='history-rename',id=rows[0]['id'],title='named idea')
  p=server.load_project();blob=server.export_pack(p,force=True);restored=server.readzip(blob)
  self.assertEqual(restored['planningHistory'][0]['title'],'named idea')
  self.assertEqual(restored['planningHistory'][0]['snapshot'],snapshot)
  with zipfile.ZipFile(io.BytesIO(blob)) as z:self.assertEqual(json.loads(z.read('handoff/records.json'))['ideaHistory'][0]['snapshot'],snapshot)
 def test_deleted_archive_never_deletes_timeline_or_resurrects(self):
  row,_=self.f.archived();before=server.load_project();self.endpoint(action='delete',ids=[row['id']]);after=server.load_project()
  self.assertEqual(after['segments'],before['segments']);self.assertEqual(after['assets'],before['assets'])
  self.assertEqual(self.endpoint(action='list')['items'],[])
  with self.assertRaises(ValueError):self.endpoint(action='get',id=row['id'])
  plan_store.preserve(server,row);self.assertEqual(self.endpoint(action='list')['items'],[])
 def test_history_exclusion_and_invalid_delete(self):
  self.endpoint(action='history-save',snapshot={'story':'private idea'})
  p=server.load_project();p['handoffOptions']={'planning':False}
  with zipfile.ZipFile(io.BytesIO(server.export_pack(p,force=True))) as z:self.assertNotIn('private idea',z.read('storyboard.json').decode())
  with self.assertRaises(ValueError):self.endpoint(action='delete',ids=['foreign'])
