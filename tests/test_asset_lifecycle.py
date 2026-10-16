import copy,tempfile,unittest
from pathlib import Path
import server,asset_lifecycle

class AssetLifecycleChecks(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.old=server.DATA,server.STATE,server.CONFIG;server.DATA=Path(self.tmp.name);server.STATE=server.DATA/'project.json';server.CONFIG=server.DATA/'settings.json'
  self.p=server.blank_project();self.owner=self.p['segments'][0]['id'];self.asset={'id':'retained','name':'人物','kind':'人物','path':'assets/a.png','description':'人物参考','scope':'segment','segmentId':self.owner,'pictureNumber':7};self.p['assets']=[self.asset];self.p['media']={'assets/a.png':'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lV4AAAAASUVORK5CYII='};server.save(self.p)
 def tearDown(self):server.DATA,server.STATE,server.CONFIG=self.old;self.tmp.cleanup()
 def test_delete_all_segments_retains_asset_bytes_number_and_export(self):
  p=copy.deepcopy(self.p);p['segments']=[];server.save(p);out=server.load_project();self.assertEqual(len(out['segments']),0);self.assertEqual(out['assets'][0]['id'],'retained');self.assertEqual(out['assets'][0]['pictureNumber'],7);self.assertEqual(out['assets'][0]['scope'],'public');self.assertEqual(out['media'],self.p['media']);self.assertEqual(len(server.scoped_assets(out)),1)
  imported=server.import_project(out);self.assertEqual(imported['segments'],[]);self.assertEqual(imported['media'],out['media'])
 def test_old_client_removing_local_rows_during_segment_deletion_is_protected(self):
  p=copy.deepcopy(self.p);p['segments']=[];p['assets']=[];p['media']={};server.save(p);out=server.load_project();self.assertEqual(len(out['assets']),1);self.assertEqual(out['media'],self.p['media'])
 def test_root_episodes_alias_and_legacy_nested_asset_migration(self):
  p=copy.deepcopy(self.p);p['episodes']=p.pop('segments');p['assets']=[];p['episodes'][0]['assets']=[copy.deepcopy(self.asset)];out=asset_lifecycle.normalize(p);self.assertEqual(len(out['assets']),1);self.assertNotIn('assets',out['segments'][0]);self.assertNotIn('episodes',out)
 def test_explicit_asset_soft_delete_is_preserved(self):
  p=copy.deepcopy(self.p);p['assets'][0]['deleted']=True;server.save(p);self.assertTrue(server.load_project()['assets'][0]['deleted'])
