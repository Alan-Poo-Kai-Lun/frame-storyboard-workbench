import copy,io,json,unittest,zipfile
import server,agent_backend as agent,writing_backend as writing
import test_generation as gen

def setUpModule():
 import sys
 from pathlib import Path
 sys.path.insert(0,str(Path(__file__).parent))
 import _tempdata;_tempdata.start()

def tearDownModule():
 import _tempdata;_tempdata.stop()


class MediaReferenceChecks(unittest.TestCase):
 def project(self):return gen.GenerationChecks().project()
 def test_agent_inventory_reports_existing_media_without_claiming_analysis(self):
  p=self.project();ctx=agent.project_context(server,p)
  self.assertEqual([a['mediaType'] for a in ctx['assets']],['image','audio','video'])
  self.assertTrue(all(a['available'] for a in ctx['assets']))
  self.assertEqual(ctx['assets'][1]['referenceLabel'],'Audio 1')
  self.assertEqual(ctx['assets'][2]['analysisStatus'],'metadata_only')
 def test_plan_media_survives_preview_apply_and_compiled_prompt(self):
  p=self.project();snap={'target':{'kind':'project'},'context':agent.project_context(server,p),'signature':writing.signature(p),'rules':[],'message':'使用 @Audio 1 和 @Video 1 规划，每段2秒'}
  raw={'duration':2,'segments':[{'title':'声音参考','story':'人物说话','summary':'说话','shots':[{'start':0,'end':2,'action':'人物说话','camera':'固定','dialogue':'原台词','sound':'雨声','startState':'站立','endState':'站立','references':[]}]}]}
  result=agent.checked_story_plan(server,p,snap,raw,recover=True)
  self.assertEqual(set(result['segments'][0]['shots'][0]['mediaAssetIds']),{'audio','video'})
  checked=writing.validate_edits(server,result,result['segments'])
  writing.append_plan(server,p,checked,checked['segments'],'media-plan',{})
  seg=p['segments'][-1];self.assertEqual(seg['shots'][0]['dialogue'],'原台词');self.assertIn('<Audio 1>',seg['prompt']);self.assertIn('<Video 1>',seg['prompt'])
  self.assertIn('audio',seg['shots'][0]['assetIds'])
 def test_type_slots_filenames_and_inventory_match_after_interleaved_assets(self):
  p=self.project();p['assets']=[p['assets'][1],p['assets'][0],p['assets'][2]];p['generation']={'taskType':'r2v'}
  blob=server.export_pack(p,force=True)
  with zipfile.ZipFile(io.BytesIO(blob)) as z:
   tl=json.loads(z.read('timeline.json'));g=tl['global']
   for key,field,name in [('refs','imageFile','Picture1'),('refAudios','audioFile','Audio1'),('refVideos','videoFile','Video1')]:
    ref=g[key][0];self.assertEqual(ref['index'],0);self.assertIn('/'+name+'.',ref[field]);self.assertTrue(z.read(ref[field]))
   inventory=json.loads(z.read('extra/reference_inventory.json'));self.assertEqual(inventory['public']['refAudios'],g['refAudios'])
  restored=server.readzip(blob);self.assertEqual([server.generation_backend.media_type(a) for a in restored['assets']],['audio','image','video'])
 def test_local_audio_binding_clones_to_new_segment_with_correct_slot(self):
  p=self.project();local=copy.deepcopy(p['assets'][1]);local.update(id='local-voice',scope='segment',segmentId=p['segments'][0]['id']);p['assets'].append(local)
  segment={'id':'new-segment','title':'新段','planning':{},'shots':[{'mediaAssetIds':['local-voice'],'assetIds':[],'sound':'参考 <Audio 2>','dialogue':'不能改'}]}
  server.generation_backend.bind_plan_media(p,segment,server.uid)
  ident=segment['shots'][0]['mediaAssetIds'][0];self.assertNotEqual(ident,'local-voice');self.assertEqual(next(a for a in p['assets'] if a['id']==ident)['segmentId'],'new-segment');self.assertIn('<Audio 2>',segment['shots'][0]['sound']);self.assertEqual(segment['shots'][0]['dialogue'],'不能改')
if __name__=='__main__':unittest.main()
