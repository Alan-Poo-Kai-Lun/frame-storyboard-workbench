import copy,threading,unittest
from types import SimpleNamespace
import asset_analysis as aa

class BulkAssetChecks(unittest.TestCase):
 def setUp(self):
  self.p={'projectId':'p','media':{'a.png':'bytes'},'assets':[]};self.saves=0
  self.s=SimpleNamespace(LOCK=threading.RLock(),load_project=lambda:copy.deepcopy(self.p),save=self.save)
 def save(self,p):self.p=p;self.saves+=1
 def asset(self,id,**kwargs):
  a={'id':id,'path':'a.png','name':id,'kind':'人物','description':'  蓝色制服，短发。  ',**kwargs};self.p['assets'].append(a);return a
 def body(self):return {'projectId':'p','assets':[{'id':a['id'],'signature':aa.signature(a,self.p['media'])} for a in self.p['assets']]}
 def test_one_save_preserves_description_and_ai_draft_with_skip_reasons(self):
  a=self.asset('ok',analysisDraft={'facts':{'appearance':'AI 草稿'}});self.asset('missing',path='missing.png');self.asset('empty',description='  ');ready=self.asset('ready');ready['confirmation']={'signature':aa.signature(ready,self.p['media']),'mode':'ai'};self.asset('deleted',deleted=True);self.asset('long',description='x'*30001)
  before=copy.deepcopy(a);r=aa.confirm_all(self.s,self.body());self.assertEqual(r['confirmed'],1);self.assertEqual(self.saves,1)
  saved=self.p['assets'][0];self.assertEqual(saved['description'],before['description']);self.assertEqual(saved['analysisDraft'],before['analysisDraft']);self.assertTrue(aa.valid(saved,self.p['media']))
  self.assertEqual({x['reason'] for x in r['skipped']},{'图片缺失','说明为空','已确认','已删除或不存在','说明超过 30000 字'})
  self.assertEqual(aa.confirm_all(self.s,self.body())['confirmed'],0);self.assertEqual(self.saves,1)
 def test_stale_snapshot_and_project_switch(self):
  a=self.asset('a');body=self.body();a['description']='新说明';r=aa.confirm_all(self.s,body);self.assertEqual(r['confirmed'],0);self.assertEqual(r['skipped'][0]['reason'],'素材已修改');self.assertEqual(self.saves,0)
  body['projectId']='other'
  with self.assertRaisesRegex(ValueError,'项目已切换'):aa.confirm_all(self.s,body)
 def test_scope_is_explicit_and_duplicates_do_not_repeat(self):
  a=self.asset('a');self.asset('b');body=self.body();body['assets']=[body['assets'][0]]*2;r=aa.confirm_all(self.s,body);self.assertEqual(r['confirmed'],1);self.assertNotIn('confirmation',self.p['assets'][1])
