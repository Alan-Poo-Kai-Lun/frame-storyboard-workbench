import copy,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import server

def setUpModule():
 import sys
 from pathlib import Path
 sys.path.insert(0,str(Path(__file__).parent))
 import _tempdata;_tempdata.start()

def tearDownModule():
 import _tempdata;_tempdata.stop()


class DialogueLanguageChecks(unittest.TestCase):
 def project(self):
  return {'version':1,'projectId':'lang-project','title':'语言校验','dialogueLanguage':'中文','segments':[{'id':'seg1','title':'片段 01','duration':15,'prompt':'','shots':[
   {'id':'sh1','start':0,'end':5,'action':'画面','dialogue':'台词','dialogueLanguage':'Mandarin\n\n[Shot 2]'},
   {'id':'sh2','start':5,'end':10,'action':'画面','dialogue':'','dialogueLanguage':'粤语'}]}],'assets':[],'media':{}}

 def test_language_field_is_normalised_not_rejected(self):
  self.assertEqual(server.dialogue_language('Mandarin\n\n[Shot 2]'),'Mandarin')
  self.assertEqual(server.dialogue_language('粤语'),'Cantonese')
  self.assertEqual(server.dialogue_language('  '),'')
  self.assertEqual(len(server.dialogue_language('x'*400)),120)
  self.assertEqual(server.dialogue_language(None),'')

 def test_prompt_parse_keeps_language_single_line(self):
  prompt='summary:\n测试\ntimeline:\n[0.00s–5.00s]\n画面动作\nDialogue language: Mandarin\n\n[Shot 2]'
  shots=server.parse_shots(prompt,15)
  self.assertTrue(shots)
  self.assertNotIn('\n',shots[0]['dialogueLanguage'])

 def test_repair_clears_control_characters_in_saved_projects(self):
  project=self.project()
  self.assertTrue(server.repair_dialogue_languages(project))
  self.assertEqual(project['segments'][0]['shots'][0]['dialogueLanguage'],'Mandarin')
  self.assertEqual(project['segments'][0]['shots'][1]['dialogueLanguage'],'Cantonese')
  self.assertFalse(server.repair_dialogue_languages(project))

 def test_rebuild_tolerates_legacy_multiline_language(self):
  segment=copy.deepcopy(self.project()['segments'][0])
  segment['prompt']='summary:\n测试\ntimeline:\n[0.00s–5.00s]\n画面动作\n[5.00s–10.00s]\n画面动作'
  prompt=server.rebuild({**segment,'defaultDialogueLanguage':'Mandarin\n\n[Shot 2]'})
  self.assertIn('Dialogue language: Mandarin',prompt)
  self.assertNotIn('[Shot 2]',prompt)

if __name__=='__main__':unittest.main()
