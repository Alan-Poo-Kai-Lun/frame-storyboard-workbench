import base64,copy,io,json,tempfile,unittest,zipfile
from pathlib import Path
from unittest.mock import patch
import server,media_analysis as media,agent_backend as agent,task_backend,plan_store,writing_backend as writing
import test_generation as gen
import test_plan_archive as archive

class MediaAnalysisChecks(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.old=server.DATA,server.STATE,server.CONFIG
  server.DATA=Path(self.tmp.name);server.STATE=server.DATA/'project.json';server.CONFIG=server.DATA/'settings.json'
  server.DATA.joinpath('tasks.json').write_text(json.dumps({'paused':True,'tasks':[]}));self.m=task_backend.manager(server)
  self.p=gen.GenerationChecks().project();server.save(self.p)
 def tearDown(self):
  self.m.action({'action':'pause'});server.DATA,server.STATE,server.CONFIG=self.old;self.tmp.cleanup()
 def snapshot(self,kind='video'):
  a=next(a for a in self.p['assets'] if a['id']==kind)
  return {'asset':a,'b64':self.p['media'][a['path']],'signature':media.digest(a,self.p['media'])}
 def test_visual_frames_only_even_with_legacy_audio_config(self):
  def model(cfg,messages,json_mode):
   frames=messages[-1]['content'][1:];self.assertEqual(len(frames),8)
   for frame in frames:self.assertTrue(base64.b64decode(frame['image_url']['url'].split(',')[1]).startswith(b'\xff\xd8'))
   self.assertNotIn('input_audio',json.dumps(messages));return json.dumps({'summary':'抽样画面','characters':[{'id':'人物A','desc':'蓝色西装'}],'actions':'举手'})
  with patch.object(server,'ai_call',side_effect=model) as call:media.analyze(server,{'provider':'openai','endpoint':'https://example.invalid','model':'test','audioModel':'legacy'},self.snapshot(),{'projectId':self.p['projectId']})
  self.assertEqual(call.call_count,1);p=server.load_project();a=p['assets'][2];result=media.current(a,p['media']);self.assertEqual(result['warnings'],[]);self.assertNotIn('audioFacts',result);self.assertIn('描述：蓝色西装',result['facts']['characters'])
  out=media.update(server,{'projectId':p['projectId'],'assetId':'video','signature':result['signature'],'facts':result['facts'],'useDescription':True})['project'];self.assertIn('蓝色西装',out['assets'][2]['description']);self.assertEqual(out['media'],p['media']);restored=server.readzip(server.export_pack(out,force=True));self.assertIsNotNone(media.current(next(a for a in restored['assets'] if a['id']=='video'),restored['media']))
 def test_audio_analysis_removed_but_reference_export_retained(self):
  with patch.object(server,'ai_call',side_effect=AssertionError('must not call')):
   with self.assertRaisesRegex(ValueError,'视频'):media.enqueue(server,{'projectId':self.p['projectId'],'assetId':'audio'})
   with self.assertRaisesRegex(ValueError,'视觉拆解'):media.analyze(server,{},self.snapshot('audio'),{'projectId':self.p['projectId']})
  with zipfile.ZipFile(io.BytesIO(server.export_pack(self.p,force=True))) as z:self.assertTrue(any('Audio1' in k for k in z.namelist()))
 def test_legacy_visual_report_omits_audio_and_formats_objects(self):
  p=self.p;a=p['assets'][2];a['mediaAnalysis']={'kind':'video','signature':media.digest(a,p['media']),'analyzedDuration':3,'facts':{'summary':'视觉结果','characters':"{'id': '人物A', 'desc': '短发'}"},'audioFacts':{'transcript':'旧音轨'},'warnings':['视频含音轨，未配置音频模型','仅分析前120秒']}
  result=media.current(a,p['media']);self.assertNotIn('audioFacts',result);self.assertEqual(result['warnings'],['仅分析前120秒']);self.assertEqual(result['facts']['characters'],'角色：人物A；描述：短发');self.assertNotIn('旧音轨',json.dumps(agent.project_context(server,p),ensure_ascii=False))
 def test_invalid_timing_rejected(self):
  for n in [True,float('nan'),-1]:
   with self.assertRaises(ValueError):media.clean({'summary':'x','shots':[{'start':n,'end':1}]},2)
 def test_replaced_source_rejects_old_result(self):
  snap=self.snapshot();self.p['assets'][2]['deleted']=True;server.save(self.p)
  with patch.object(media,'run',side_effect=lambda args,*a,**k: json.dumps({'format':{'duration':2},'streams':[{'codec_type':'video'}]}).encode() if '-show_streams' in args else b''),patch.object(Path,'is_file',return_value=True),patch.object(Path,'read_bytes',return_value=b'fake-jpeg'),patch.object(server,'ai_call',return_value='{"summary":"旧结果"}'),self.assertRaisesRegex(ValueError,'素材已替换'):
   media.analyze(server,{'provider':'openai','endpoint':'https://example.invalid','model':'test'},snap,{'projectId':self.p['projectId']})

class GuidePreviewChecks(unittest.TestCase):
 def test_applied_guides_update_without_regeneration_and_export(self):
  helper=archive.PlanArchiveChecks();helper.setUp()
  try:
   row,_=helper.archived();body={'projectId':helper.p['projectId'],'id':row['id']};data=plan_store.endpoint(server,body);edits=data['plan']['segments'];edits[0]['guideFromPrev']=False;edits[1]['guideFromPrev']=True
   settings={**server.guide_settings(helper.p),'continuityEnabled':True,'continuityOverlapFrames':22,'continuityKeepTail':True}
   out=plan_store.endpoint(server,{**body,'action':'apply','segments':edits,'guideSettings':settings});p=out['project'];before=copy.deepcopy(p['segments']);targets=plan_store.endpoint(server,body)['guideTargets'];self.assertEqual(len(targets),2)
   with patch.object(server,'ai_call',side_effect=AssertionError('must not infer')):out=plan_store.endpoint(server,{**body,'action':'guide','guideSettings':{**settings,'continuityOverlapFrames':39},'segmentGuides':[{'id':v['id'],'guideFromPrev':True} for v in targets]})
   p=out['project'];self.assertEqual(len(p['segments']),len(before));self.assertEqual(p['segments'][-1]['shots'],before[-1]['shots']);self.assertEqual(p['directorGuide']['continuityOverlapFrames'],39)
   with zipfile.ZipFile(io.BytesIO(server.export_pack(p,force=True))) as z:
    pack=json.loads(z.read('pack.json'));self.assertEqual(pack['output']['continuityOverlapFrames'],39);self.assertTrue(pack['output']['continuityKeepTail'])
   with self.assertRaisesRegex(ValueError,'整数'):plan_store.endpoint(server,{**body,'action':'guide','guideSettings':{'continuityOverlapFrames':999}})
  finally:helper.tearDown()
if __name__=='__main__':unittest.main()
