import json,tempfile,threading,unittest
from pathlib import Path
from types import SimpleNamespace
import editor_presets

class EditorPresetChecks(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.s=SimpleNamespace(DATA=Path(self.temp.name),LOCK=threading.RLock(),uid=lambda:'custom1')
 def tearDown(self):self.temp.cleanup()
 def change(self,**body):return editor_presets.library(self.s,{'revision':editor_presets.library(self.s)['revision'],**body})
 def test_custom_roundtrip_and_revision_conflict(self):
  old=editor_presets.library(self.s);result=self.change(action='save',field='action',name='动作',content='伸手查看',shortcut='Alt+Shift+1')
  self.assertEqual(result['items'][-1]['content'],'伸手查看');self.assertEqual(editor_presets.library(self.s),result)
  with self.assertRaises(ValueError):editor_presets.library(self.s,{'action':'delete','id':'custom1','revision':old['revision']})
  self.assertEqual(self.change(action='delete',id='custom1')['items'],old['items'])
 def test_shortcut_conflict_and_reserved_combinations(self):
  self.change(action='save',field='story',name='剧情',content='剧情',shortcut='Alt+Shift+1')
  before=(self.s.DATA/'editor-presets.json').read_bytes()
  for shortcut in ['Alt+Shift+1','Ctrl+S','Alt+1']:
   with self.assertRaises(ValueError):self.change(action='save',field='camera',name='镜头',content='摄影机',shortcut=shortcut)
  self.assertEqual((self.s.DATA/'editor-presets.json').read_bytes(),before)
 def test_binding_identity_and_order(self):
  result=self.change(action='save',field='camera',name='自定义机位',content='',shortcut='',binding={'source':'visual','id':'builtin:angle:0','category':'angle'})
  row=result['items'][-1];self.assertEqual(row['binding']['id'],'builtin:angle:0');self.assertEqual(row['content'],'')
  result=self.change(action='move',id=row['id'],direction='up');self.assertEqual(result['items'][-2]['id'],row['id'])
  result=self.change(action='save',id=row['id'],field='camera',name='重命名',content='',shortcut='Alt+Shift+2',binding=row['binding']);self.assertEqual(result['items'][-2]['name'],'重命名')
 def test_reject_bad_fields_and_bindings_without_writes(self):
  for body in [{'field':'projectId','name':'bad','content':'text'},{'field':'story','name':'','content':'text'},{'field':'story','name':'bad','content':''},{'field':'camera','name':'bad','content':'','binding':{'source':'file','id':'x'}},{'field':'camera','name':'bad','content':'','binding':{'source':'asset','id':1}}]:
   with self.assertRaises(ValueError):self.change(action='save',**body)
  self.assertFalse((self.s.DATA/'editor-presets.json').exists())

if __name__=='__main__':unittest.main()
