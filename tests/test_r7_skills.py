import copy,json,tempfile,unittest
from pathlib import Path
from types import SimpleNamespace
from threading import RLock
import writing_backend as writing

class SkillBaselineChecks(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.s=SimpleNamespace(DATA=Path(self.temp.name),LOCK=RLock(),uid=lambda:'new-rule')
  self.baseline=json.loads((Path(writing.__file__).parent/'presets/writing-skills-baseline.json').read_text('utf-8'))
 def tearDown(self):self.temp.cleanup()
 def test_fresh_install_contains_all_complete_desktop_rules_and_original_ids(self):
  rows=writing.library(self.s)['items'];self.assertEqual(len(rows),7)
  for expected in self.baseline['items']:
   actual=next(r for r in rows if r['id']==expected['id'])
   for key in ['name','category','description','rules']:self.assertEqual(actual[key],expected[key])
   self.assertGreater(len(actual['rules']),3000)
 def test_existing_edits_and_custom_entries_win_during_upgrade(self):
  modified=copy.deepcopy(self.baseline['items'][0]);modified['rules']='用户已修改，必须保留'
  (self.s.DATA/'writing-rules.json').write_text(json.dumps([modified,{'id':'user-extra','name':'新增','rules':'新增规则'}]),'utf-8')
  rows=writing.library(self.s)['items'];self.assertEqual(next(r for r in rows if r['id']==modified['id'])['rules'],modified['rules']);self.assertTrue(any(r['id']=='user-extra' for r in rows));self.assertEqual(len(rows),8)
 def test_later_delete_and_hide_survive_repeat_load_and_upgrade_seed(self):
  lib=writing.library(self.s);target=self.baseline['items'][0]['id'];other=self.baseline['items'][1]['id']
  lib=writing.library(self.s,{'action':'delete','id':target,'revision':lib['revision']})
  writing.library(self.s,{'action':'visibility','id':other,'hidden':True,'revision':lib['revision']})
  for _ in range(3):
   rows=writing.library(self.s)['items'];self.assertFalse(any(r['id']==target for r in rows));self.assertTrue(next(r for r in rows if r['id']==other)['hidden'])
 def test_missing_rules_require_explicit_recovery_and_keep_valid_rules(self):
  p={'writingRuleIds':['fight','missing-rule']}
  with self.assertRaises(ValueError):writing.selected(self.s,p)
  rows=writing.selected(self.s,p,allow_missing=True);self.assertEqual([r['id'] for r in rows],['fight']);self.assertEqual(p['writingRuleIds'],['fight','missing-rule'])

if __name__=='__main__':unittest.main()
