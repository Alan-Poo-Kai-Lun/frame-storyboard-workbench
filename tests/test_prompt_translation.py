import copy,json,tempfile,sys,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import server,prompt_translation as tr
class TranslationChecks(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.old=(server.DATA,server.STATE,server.CONFIG);server.DATA=Path(self.temp.name);server.STATE=server.DATA/'project.json';server.CONFIG=server.DATA/'settings.json'
  self.p=server.blank_project();self.s=self.p['segments'][0];self.s['prompt']='summary:\n人物停下\ntimeline:\n[0.00s–15.00s]\n<Subject 1> 看向 <Picture 2>\nCamera: 固定机位\nDialogue: <Subject 1>: 你好 123\nDialogue language: 粤语\n<d>[粤语] 不准翻译这句话\n保持原文</d>\n';server.save(self.p)
 def tearDown(self):server.DATA,server.STATE,server.CONFIG=self.old;self.temp.cleanup()
 def result(self):
  source=server.original_scoped_prompt(self.p,self.s)
  def fake(cfg,messages,mode):
   jobs=json.loads(messages[-1]['content'])['fragments'];return json.dumps({'zh':['中文'+x for x in jobs],'en':['Translated '+x for x in jobs]})
  with patch.object(server,'_ai_call',side_effect=fake):return tr.analyze(server,{'model':'test'},{'original':source},{})
 def test_tokens_dialogue_original_and_selected_export(self):
  before=copy.deepcopy(self.p);r=self.result();self.assertEqual(self.p,before)
  for lang in ['zh','en']:
   self.assertIn('[0.00s–15.00s]',r[lang]);self.assertIn('Dialogue: <Subject 1>: 你好 123',r[lang]);self.assertIn('Dialogue language: 粤语',r[lang]);self.assertIn('<d>[粤语] 不准翻译这句话\n保持原文</d>',r[lang]);self.assertIn('<Picture 2>',r[lang])
  from types import SimpleNamespace
  row={'id':'translationtest','type':'translation','status':'done','projectId':self.p['projectId'],'segmentId':self.s['id'],'result':r}
  with patch('task_backend.manager',return_value=SimpleNamespace(get=lambda ident:row)):
   tr.save_result(server,{'id':row['id'],'projectId':self.p['projectId'],'segmentId':self.s['id']})
  self.p=server.load_project();self.s=self.p['segments'][0];
  tr.choose(server,{'projectId':self.p['projectId'],'segmentId':self.s['id'],'language':'en'});p=server.load_project();self.assertEqual(server.scoped_prompt(p,p['segments'][0]),r['en']);self.assertEqual(p['segments'][0]['prompt'],before['segments'][0]['prompt']);restored=server.readzip(server.export_pack(p,force=True));self.assertEqual(restored['segments'][0]['promptTranslations'],r);self.assertEqual(restored['segments'][0]['promptExportLanguage'],'en');self.assertEqual(server.scoped_prompt(restored,restored['segments'][0]),r['en'])
  p['segments'][0]['prompt']+='新增内容';server.save(p)
  with self.assertRaises(ValueError):server.scoped_prompt(p,p['segments'][0])
  tr.choose(server,{'projectId':p['projectId'],'segmentId':self.s['id'],'language':'original'})
 def test_reject_incomplete_invented_structure_and_stale_result(self):
  for value in [{'zh':[],'en':[]},'not json']:
   with patch.object(server,'_ai_call',return_value=value):
    with self.assertRaises(ValueError):tr.analyze(server,{'model':'test'},{'original':self.s['prompt']},{})
  def bad(cfg,messages,mode):
   n=len(json.loads(messages[-1]['content'])['fragments']);return {'zh':['Picture 9']*n,'en':['hello']*n}
  with patch.object(server,'_ai_call',side_effect=bad):
   with self.assertRaises(ValueError):tr.analyze(server,{'model':'test'},{'original':self.s['prompt']},{})
  self.assertEqual(server.load_project()['segments'][0]['prompt'],self.s['prompt'])
if __name__=='__main__':unittest.main()

