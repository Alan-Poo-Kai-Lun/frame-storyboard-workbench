import copy,unittest
from unittest.mock import patch
from test_planning_repair import PlanningRepairChecks
from backend.ai import h3_compiler as h3
import server

class H3OutputChecks(PlanningRepairChecks):
 def test_default_general_roles_create_source_linked_subjects(self):
  p=self.apply();s=p['segments'][-1]
  p['assets'][0].update(kind='场景',description='全景办公室；落地窗；黑色地面')
  s['planning']['referenceRoles']={'poster':'general','actor':'general'}
  s['shots'][0]['dialogue']='（无台词，环境音）';s['shots'][1]['dialogue']='你好，窗外下雨。'
  with patch.object(server,'_ai_call',side_effect=AssertionError('compile must stay local')):text=h3.compile_prompt(server,p,s)
  self.assertIn('<Subject 1> is 全景办公室',text);self.assertIn('from <Picture 1>',text)
  self.assertIn('<Subject 2> is 白衣人物 from <Picture 2>',text)
  self.assertIn('<Subject 2> (S1) says, <d>[Mandarin] 你好，窗外下雨。</d>',text)
  self.assertNotIn('无台词',text);self.assertNotIn('(S2)',text)
  self.assertIn('[Shot 2] At 00:03.000,',text);self.assertNotIn('[0.00s',text)
  self.assertEqual(p['assets'][0]['description'],'全景办公室；落地窗；黑色地面')
 def test_subject_map_does_not_assume_picture_number(self):
  p=self.apply();s=p['segments'][-1];refs=h3.reference_map(server,p,s)
  self.assertIn({'label':'Subject 1','assetId':'actor'},refs)
  self.assertIn({'label':'Picture 1','assetId':'poster'},refs)
 def test_non_speech_with_explicit_speaker_does_not_consume_voice_id(self):
  p=self.apply();s=p['segments'][-1];s['shots'][0]['dialogue']='<Picture 9>: 无台词';s['shots'][1]['dialogue']='<Picture 9>: 继续。'
  text=h3.compile_prompt(server,p,s);self.assertIn('(S1) says, <d>[Mandarin] 继续。</d>',text);self.assertNotIn('(S2)',text)
 def test_dense_dialogue_is_warned_without_rewriting(self):
  p=self.apply();s=p['segments'][-1];s['shots'][0]['dialogue']='人'*40
  before=copy.deepcopy(s);text=h3.compile_prompt(server,p,s)
  self.assertTrue(any('密度偏高' in x for x in h3.diagnostics(p,s,text)));self.assertEqual(s,before);self.assertIn('人'*40,text)
