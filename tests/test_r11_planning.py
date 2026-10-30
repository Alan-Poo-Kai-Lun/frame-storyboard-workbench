import copy,json,unittest
from types import SimpleNamespace
from unittest.mock import patch
import server,writing_backend as writing
import test_generation as gen

def setUpModule():
 import sys
 from pathlib import Path
 sys.path.insert(0,str(Path(__file__).parent))
 import _tempdata;_tempdata.start()

def tearDownModule():
 import _tempdata;_tempdata.stop()


class R11PlanningChecks(unittest.TestCase):
 def project(self):return gen.GenerationChecks().project()
 def enqueue(self,p,chosen,story='使用 @Picture 1 @Audio 1 @Video 1'):
  saved={}
  def add(kind,meta,cfg,snap):saved.update(copy.deepcopy(snap));return {'id':'qa'}
  with patch.object(server,'load_project',return_value=p),patch.object(server,'settings',return_value={'ai':{'endpoint':'http://localhost','model':'mock'}}),patch.object(writing,'selected',return_value=[]),patch('task_backend.manager',return_value=SimpleNamespace(add=add)):
   writing.enqueue(server,{'projectId':p['projectId'],'story':story,'count':1,'duration':2,'assetIds':chosen})
  return saved
 def raw(self):return {'segments':[{'title':'声音与视频','story':'@Picture 1 站立','language':'Mandarin','shots':[{'start':0,'end':2,'action':'@Picture 1 站立','camera':'固定','dialogue':'原对白','sound':'环境音','startState':'门口站立','endState':'仍在门口','references':[1]}]}]}
 def test_whole_story_media_survives_enqueue_preview_apply_and_export(self):
  p=self.project();snap=self.enqueue(p,[a['id'] for a in p['assets']]);self.assertEqual({r['referenceLabel'] for r in snap['mediaRefs']},{'Audio 1','Video 1'})
  self.assertEqual([r['number'] for r in snap['refs']],[1]);self.assertTrue(all(r['analysisStatus']=='metadata_only' for r in snap['mediaRefs']))
  result=writing.recover(server,self.raw(),snap);self.assertFalse(result['blockingIssues']);self.assertEqual(set(result['segments'][0]['shots'][0]['mediaAssetIds']),{'audio','video'})
  checked=writing.validate_edits(server,result,result['segments']);writing.append_plan(server,p,checked,checked['segments'],'r11',{})
  shot=p['segments'][-1]['shots'][0];self.assertTrue({'audio','video'}.issubset(shot['assetIds']));self.assertEqual(shot['dialogue'],'原对白');self.assertIn('<Audio 1>',p['segments'][-1]['prompt']);self.assertIn('<Video 1>',p['segments'][-1]['prompt'])
  restored=server.readzip(server.export_pack(p,force=True));self.assertEqual(set(restored['segments'][-1]['shots'][0]['mediaAssetIds']),{'audio','video'})
 def test_unselected_or_missing_typed_reference_rejected(self):
  p=self.project()
  with self.assertRaisesRegex(ValueError,'音视频'):self.enqueue(p,[p['assets'][0]['id']],'使用 @Audio 1')
  with self.assertRaisesRegex(ValueError,'音视频'):self.enqueue(p,[a['id'] for a in p['assets']],'使用 @Video 99')
 def test_same_number_in_three_media_types_does_not_cross_bind(self):
  p=self.project();snap=self.enqueue(p,['audio'],'使用 @Audio 1');raw=self.raw();raw['segments'][0]['story']='站立';raw['segments'][0]['shots'][0].update(action='站立',references=[],mediaAssetIds=['video','not-real'])
  result=writing.recover(server,raw,snap);self.assertFalse(result['blockingIssues']);shot=result['segments'][0]['shots'][0];self.assertEqual(shot['referenceNumbers'],[]);self.assertEqual(shot['mediaAssetIds'],['audio'])
 def test_replaced_media_blocks_stale_apply(self):
  p=self.project();snap=self.enqueue(p,[a['id'] for a in p['assets']]);r=writing.recover(server,self.raw(),snap);p['assets'][1]['path']='other.wav'
  with self.assertRaisesRegex(ValueError,'音视频已变化'):writing.append_plan(server,p,r,r['segments'],'r11',{})
 def test_model_context_has_metadata_not_binary(self):
  p=self.project();snap=self.enqueue(p,[a['id'] for a in p['assets']])
  with patch.object(server,'ai_call',return_value=json.dumps(self.raw())) as call:writing.analyze(server,{},snap,{})
  payload=json.loads(call.call_args.args[1][1]['content']);self.assertEqual(len(payload['mediaRefs']),2);self.assertNotIn('media',payload);self.assertNotIn('base64',json.dumps(payload))
if __name__=='__main__':unittest.main()
