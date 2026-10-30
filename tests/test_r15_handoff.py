import copy,io,json,zipfile,unittest
import server,agent_backend,creative_library
import test_plan_archive as archive_fixture

class R15Checks(unittest.TestCase):
 def setUp(self):
  self.fixture=archive_fixture.PlanArchiveChecks();self.fixture.setUp();self.addCleanup(self.fixture.tearDown)
 def test_handoff_roundtrip_notes_chat_plans_no_secret(self):
  row,_=self.fixture.archived();p=server.load_project();p['notes']=[{'id':'global','text':'全局笔记'}]
  p.setdefault('overviewLayout',{})['unifiedFlow']={'notes':[{'id':'local','title':'局部','text':'# 标题','parentId':'board:public'}]}
  agent_backend.store_chat(server,p['projectId'],'thread',{'role':'user','content':'请保持服装','at':1})
  topics=agent_backend.read_threads(server);topics[p['projectId']]={'thread':{'id':'thread','target':{'kind':'project'},'title':'原有对话','createdAt':1,'updatedAt':1}};agent_backend.write_threads(server,topics)
  server.save(p)
  blob=server.export_pack(p,force=True)
  with zipfile.ZipFile(io.BytesIO(blob)) as z:
   self.assertIn('handoff/README.md',z.namelist());value=json.loads(z.read('handoff/records.json'));self.assertEqual(value['notes'][0]['text'],'全局笔记');self.assertEqual(value['conversations']['thread'][0]['content'],'请保持服装')
  restored=server.readzip(blob);self.assertNotEqual(restored['projectId'],p['projectId']);server.save(restored)
  self.assertEqual(restored['notes'],p['notes']);self.assertEqual(restored['overviewLayout']['unifiedFlow']['notes'],p['overviewLayout']['unifiedFlow']['notes'])
  self.assertEqual(agent_backend.read_chats(server)[restored['projectId']]['thread'][0]['content'],'请保持服装')
  self.assertIn(row['id'],restored['planArchive'])
 def test_optional_handoff_excludes_selected_records_and_credentials(self):
  import handoff_archive
  self.assertEqual(handoff_archive.clean({'key':'SECRET','cfg':{'x':1},'safe':'ok'}),{'safe':'ok'})
  self.fixture.archived();p=server.load_project();p['notes']=[{'text':'private note'}];p['handoffOptions']={'notes':False,'agent':False,'planning':False}
  with zipfile.ZipFile(io.BytesIO(server.export_pack(p,force=True))) as z:
   v=json.loads(z.read('handoff/records.json'));self.assertEqual(v['notes'],[]);self.assertEqual(v['plans'],{});self.assertNotIn('private note',z.read('storyboard.json').decode())
 def test_library_dates_reorder_and_revision_guard(self):
  store=creative_library.library(server.DATA)
  for name in ['first','second']:
   store=creative_library.update_asset(server.DATA,{'title':name,'note':'说明','category':'人物','kind':'人物','revision':store['revision']})
  ids=[r['id'] for r in store['items']];self.assertTrue(store['items'][0]['createdAt'])
  store=creative_library.update_asset(server.DATA,{'action':'reorder','ids':ids[::-1],'revision':store['revision']});self.assertEqual([r['id'] for r in store['items']],ids[::-1])
  with self.assertRaises(ValueError):creative_library.update_asset(server.DATA,{'action':'reorder','ids':ids,'revision':'stale'})

if __name__=='__main__':unittest.main()
