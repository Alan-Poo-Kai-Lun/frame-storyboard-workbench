import copy,unittest
from unittest.mock import patch
import continuity_review as cr
import video_provider_contract as vp

class ReviewChecks(unittest.TestCase):
 def test_detects_posture_binding_speaker_load_and_never_mutates(self):
  rows=[{'id':'s','shots':[{'id':'a','action':'@Picture 1 坐在沙发','endState':'@Picture 1 坐在沙发','referenceNumbers':[1]},{'id':'b','action':'@Picture 2 瞬移，连续两记踢击，@Picture 1 从沙发上起身','startState':'@Picture 1 已经起身','endState':'双方站立','dialogue':'就这？','referenceNumbers':[2]}]}];old=copy.deepcopy(rows)
  result=cr.review(rows,[{'number':1},{'number':2}]);codes={r['code'] for r in result['issues']}
  self.assertTrue({'pose_jump','binding','speaker','internal_pose','action_load'}<=codes);self.assertEqual(rows,old)
 def test_missing_start_suggestion_and_no_automatic_rewrite(self):
  rows=[{'shots':[{'endState':'@Picture 1 坐在沙发'},{'startState':''}]}];r=cr.review(rows,[])
  issue=next(x for x in r['issues'] if x['shot']==1 and x['code']=='missing_start');self.assertEqual(issue['suggestion'],'@Picture 1 坐在沙发');self.assertEqual(rows[0]['shots'][1]['startState'],'')
 def test_unknown_reference_is_not_added_to_binding(self):
  r=cr.review([{'shots':[{'action':'@Picture 99 出现','referenceNumbers':[]}]}],[{'number':1}]);self.assertIn('unknown_reference',{x['code'] for x in r['issues']});self.assertEqual(next(x for x in r['issues'] if x['code']=='binding')['suggestion'],[])
 def test_identity_feature_mix_is_flagged_as_suspected(self):
  r=cr.review([{'shots':[{'action':'@Picture 1 戴露指战术手套','referenceNumbers':[1]}]}],[{'number':1}], [{'pictureNumber':1,'description':'西装'},{'pictureNumber':2,'description':'露指战术手套'}]);self.assertIn('identity_mix',{x['code'] for x in r['issues']})

class ProviderChecks(unittest.TestCase):
 def project(self):return {'projectId':'p','aspect':'16:9','assets':[{'id':'ref','path':'reference.png'}],'media':{},'segments':[{'id':'s','duration':5,'shots':[{'id':'h'}]}]}
 def test_mock_lifecycle_attaches_idempotently_without_material_pollution(self):
  p=self.project();r=vp.make_request(p,'s','minimax-h3','原提示词',shot_id='h',continuity={'tailVideo':'tail.webm'})
  adapter=vp.MockVideoProvider(b'\x1aE\xdf\xa3fixture');t=adapter.submit(r,idempotency_key='once');self.assertEqual(t,adapter.submit(r,idempotency_key='once'));self.assertEqual(adapter.query(t['taskId'])['status'],'completed')
  out=vp.attach_result(p,r,adapter.result(t['taskId']));self.assertEqual(out['assets'],p['assets']);self.assertNotIn('videos',p['segments'][0]);self.assertEqual(out['segments'][0]['videos'][0]['shotId'],'h');self.assertEqual(vp.attach_result(out,r,adapter.result(t['taskId'])),out)
 def test_unconfigured_adapters_cannot_charge(self):
  for model in vp.MODELS:
   with self.assertRaises(RuntimeError):vp.UnconfiguredProvider().submit(vp.make_request(self.project(),'s',model,'prompt'),idempotency_key='test')
 def test_result_rejects_switched_project_deleted_shot_and_invalid_media(self):
  p=self.project();r=vp.make_request(p,'s','seedance-2.5','prompt',shot_id='h');result={'taskId':'x','bytes':b'bad','mime':'video/mp4'}
  with self.assertRaises(ValueError):vp.attach_result(p,r,result)
  p['projectId']='other'
  with self.assertRaises(ValueError):vp.attach_result(p,r,result)
  p['projectId']='p';p['segments'][0]['shots']=[]
  with self.assertRaises(ValueError):vp.attach_result(p,r,result)
