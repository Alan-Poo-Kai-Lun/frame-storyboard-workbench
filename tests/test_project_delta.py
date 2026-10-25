import copy,unittest
import server

class ProjectDeltaChecks(unittest.TestCase):
 def setUp(self):
  self.project={'version':1,'projectId':'delta-project','title':'原项目','segments':[],'assets':[],'media':{'video.mp4':'eHl6','same.png':'YWJj'},'originalZip':'cGFjaw=='}
 def request(self):
  return {'project':{k:copy.deepcopy(v) for k,v in self.project.items() if k not in ['media','originalZip']},'media':{'put':{},'remove':[]}}
 def test_metadata_save_preserves_media_and_original_pack(self):
  body=self.request();body['project']['title']='修改名称';p=server.merge_project_delta(self.project,body)
  self.assertEqual(p['media'],self.project['media']);self.assertEqual(p['originalZip'],self.project['originalZip']);self.assertEqual(p['title'],'修改名称');self.assertEqual(self.project['title'],'原项目')
 def test_replace_add_remove_are_staged_without_mutating_current(self):
  body=self.request();body['media']={'put':{'video.mp4':'bmV3','new.wav':'d2F2'},'remove':['same.png']};p=server.merge_project_delta(self.project,body)
  self.assertEqual(p['media'],{'video.mp4':'bmV3','new.wav':'d2F2'});self.assertEqual(self.project['media'],{'video.mp4':'eHl6','same.png':'YWJj'})
 def test_project_switch_rejected(self):
  body=self.request();body['project']['projectId']='other'
  with self.assertRaises(ValueError):server.merge_project_delta(self.project,body)
 def test_invalid_patch_cannot_override_media_or_read_files(self):
  for invalid in [{'put':{'../secret':'YWJj'}},{'remove':'video.mp4'},{'put':{'D:/private':'YWJj'}},{'put':{'video.mp4':123}}]:
   body=self.request();body['media']=invalid
   with self.assertRaises(ValueError):server.merge_project_delta(self.project,body)
  body=self.request();body['project']['media']={}
  with self.assertRaises(ValueError):server.merge_project_delta(self.project,body)
 def test_original_pack_changes_only_when_explicit(self):
  body=self.request();body['originalZip']='';p=server.merge_project_delta(self.project,body);self.assertEqual(p['originalZip'],'');self.assertEqual(self.project['originalZip'],'cGFjaw==')

if __name__=='__main__':unittest.main()
