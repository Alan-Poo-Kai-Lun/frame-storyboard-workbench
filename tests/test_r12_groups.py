import copy,io,json,unittest,zipfile
import test_generation as gen
import server

def setUpModule():
 import sys
 from pathlib import Path
 sys.path.insert(0,str(Path(__file__).parent))
 import _tempdata;_tempdata.start()

def tearDownModule():
 import _tempdata;_tempdata.stop()


class GroupCompatibilityChecks(unittest.TestCase):
 def project(self):return gen.GenerationChecks().project()
 def test_group_view_does_not_change_director_pack_or_timeline(self):
  p=self.project();p['overviewLayout']={'unifiedFlow':{'version':3,'mode':'canvas','views':{'canvas':{'coordinateVersion':3,'positions':{'a:'+p['assets'][0]['id']:{'x':15,'y':60}}}}}}
  _,_,pack,timeline=gen.GenerationChecks().unpack(p)
  before=copy.deepcopy(p);view=p['overviewLayout']['unifiedFlow']['views']['canvas'];view.update(assetGroupsVersion=1,collapsedGroups=['asset-group:public:character'],positions={'asset-group:public:character':{'x':15,'y':60},'a:'+p['assets'][0]['id']:{'x':15,'y':60}})
  _,_,new_pack,new_timeline=gen.GenerationChecks().unpack(p)
  self.assertEqual(pack,new_pack);self.assertEqual(timeline,new_timeline)
  for key in ['assets','segments','media']:self.assertEqual(p[key],before[key])
 def test_zip_sidecar_roundtrips_groups_and_stable_shot_bindings(self):
  p=self.project();p['segments'][0]['shots']=[{'id':'r12-shot','start':0,'end':2,'action':'@Picture 1 站立','camera':'固定','dialogue':'原对白','sound':'参考 <Audio 1> <Video 1>'}];shot=p['segments'][0]['shots'][0];shot.update(assetIds=[p['assets'][0]['id'],'audio','video'],mediaAssetIds=['audio','video'],referenceNumbers=[1])
  p['overviewLayout']={'unifiedFlow':{'version':3,'mode':'canvas','views':{'canvas':{'assetGroupsVersion':1,'collapsedGroups':['asset-group:public:other'],'positions':{'asset-group:public:other':{'x':45,'y':60}}}}}}
  # JSON copying and the established ZIP exporter/importer preserve the same fields.
  copied=json.loads(json.dumps(p));restored=server.readzip(server.export_pack(copied,force=True));h=restored['segments'][0]['shots'][0]
  self.assertEqual(h['assetIds'],shot['assetIds']);self.assertEqual(h['mediaAssetIds'],shot['mediaAssetIds']);self.assertEqual(h['referenceNumbers'],[1]);self.assertEqual(restored['overviewLayout'],p['overviewLayout'])

if __name__=='__main__':unittest.main()
