import copy, tempfile, unittest
from pathlib import Path
import appearance_presets as profiles

class AppearancePresetsChecks(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.data=Path(self.temp.name)
  self.value={'background':'#eeeeee','cardBackground':'#ffffff','cardBorder':'#aabbcc','titleSize':18,'flow':False,'pattern':'lines','activeTheme':'light','themeColors':{'light':{'background':'#eeeeee'},'dark':{'background':'#111111','titleColor':'#eeeeee'}}}
 def tearDown(self):self.temp.cleanup()
 def save(self,**extra):return profiles.update(self.data,{'revision':profiles.listing(self.data)['revision'],'name':'暖金','appearance':self.value,**extra})
 def test_persist_both_themes_and_leave_project_untouched(self):
  project=self.data/'project.json';project.write_text('{"original":true}')
  row=self.save();self.assertEqual(next(r for r in profiles.listing(self.data)['items'] if not r.get('builtin'))['appearance'],self.value);self.assertEqual(project.read_text(),'{"original":true}');self.assertEqual(row['savedId'],next(r for r in row['items'] if not r.get('builtin'))['id'])
 def test_overwrite_and_delete_preserve_other_profile(self):
  a=self.save();ident=a['savedId'];b=self.save(name='另一套');self.save(id=ident,name='改名');self.assertEqual(len([r for r in profiles.listing(self.data)['items'] if not r.get('builtin')]),2)
  out=self.save(action='delete',id=ident);self.assertEqual([r['id'] for r in out['items'] if not r.get('builtin')],[b['savedId']])
 def test_stale_writer_cannot_overwrite(self):
  self.save();before=profiles.listing(self.data)
  with self.assertRaises(ValueError):profiles.update(self.data,{'revision':'0','name':'旧窗口','appearance':self.value})
  self.assertEqual(profiles.listing(self.data),before)
 def test_invalid_settings_do_not_write(self):
  for key,value in [('background','url(secret)'),('gridSize',999),('arrowSpeed',float('nan')),('flow','false'),('lineStyle','unknown'),('filePath','/tmp'),('themeColors',{'light':{'key':'secret'}})]:
   broken={**copy.deepcopy(self.value),key:value}
   with self.subTest(key=key),self.assertRaises(ValueError):self.save(appearance=broken)
  self.assertEqual([r for r in profiles.listing(self.data)['items'] if not r.get('builtin')],[])
 def test_invalid_ids_do_not_create_or_delete(self):
  for action in ['save','delete']:
   with self.assertRaises(ValueError):self.save(id='../absent',action=action)

 def test_twelve_builtins_are_read_only_resources(self):
  rows=profiles.listing(self.data)['items'];self.assertEqual(len(rows),12);self.assertTrue(all(r['builtin'] for r in rows));self.assertFalse((self.data/'appearance-presets.json').exists())
  for row in rows:profiles.validate(row['appearance'])
  original=copy.deepcopy(rows[0]);self.save(id=original['id'],name=original['name'],appearance={**original['appearance'],'projectShape':'film','lineStyle':'bus','lineEffect':'comet','arrowType':'fork'})
  effective=profiles.listing(self.data)['items'];self.assertEqual(len(effective),12);self.assertEqual(next(r for r in effective if r['id']==original['id'])['appearance']['lineStyle'],'bus');self.assertEqual(profiles.builtins()[0],original)
  self.save(action='delete',id=original['id']);self.assertEqual(profiles.listing(self.data)['items'][0],original)
 def test_existing_local_names_take_priority_without_duplicates(self):
  builtin=profiles.builtins()[0];self.save(name=builtin['name']);self.assertEqual(len(profiles.listing(self.data)['items']),12);self.assertEqual(len([r for r in profiles.listing(self.data)['items'] if r['name']==builtin['name']]),1)
 def test_builtin_original_cannot_be_deleted(self):
  with self.assertRaises(ValueError):self.save(action='delete',id=profiles.builtins()[0]['id'])

 def test_dynamic_background_persistence_and_validation(self):
  value={**self.value,'enableDynamicBg':True,'bgIntensity':8,'themeDynamicBg':{'dark':{'enableDynamicBg':True,'bgIntensity':8},'light':{'enableDynamicBg':False,'bgIntensity':3}}}
  self.save(appearance=value)
  self.assertEqual(next(r for r in profiles.listing(self.data)['items'] if not r.get('builtin'))['appearance'],value)
  for key,v in [('bgIntensity',31),('bgIntensity',-1),('bgIntensity',True),('enableDynamicBg',1),('themeDynamicBg',{'dark':{'secret':'x'}})]:
   with self.subTest(key=key,value=v),self.assertRaises(ValueError):profiles.validate({key:v})

 def test_visual_effect_flags_round_trip(self):
  flags={key:True for key in ['nodeGlow','spotlightGrid','junctionPads','glassPanels','reduceMotion']}
  self.save(appearance={**self.value,**flags})
  saved=next(r for r in profiles.listing(self.data)['items'] if not r.get('builtin'))['appearance']
  for key in flags:
   self.assertIs(saved[key],True)
   with self.subTest(key=key),self.assertRaises(ValueError):profiles.validate({key:1})
