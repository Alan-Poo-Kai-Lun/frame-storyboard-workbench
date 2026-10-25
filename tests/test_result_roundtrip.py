import base64,copy,unittest
import server
import test_generation as gen

class ResultRoundtripChecks(unittest.TestCase):
 def test_clip_versions_shot_links_and_fields_survive_director_pack(self):
  p=gen.GenerationChecks().project();s=p['segments'][0];h={'id':'result-shot','start':0,'end':2,'action':'人物站立','dialogue':''};s['shots']=[h]
  h.update(startState='门口面向室内',endState='桌边站立',dialogueLanguage='Cantonese',camera='固定机位')
  rows=[{'id':'result-'+str(i),'path':'extra/segment_videos/result-'+str(i)+'.mp4','mime':'video/mp4','shotId':h['id'],'title':'版本'+str(i),'name':'result.mp4','note':'保留备注'} for i in range(2)]
  s['videos']=copy.deepcopy(rows)
  for v in rows:p['media'][v['path']]=base64.b64encode(b'\0\0\0\x18ftypmp42'+b'\0'*32).decode()
  restored=server.readzip(server.export_pack(p,force=True));out=restored['segments'][0]
  # Director packs deliberately rewrite media paths. Links, version metadata
  # and the bytes at those rewritten paths must survive.
  self.assertEqual([{k:v for k,v in row.items() if k!='path'} for row in out['videos']], [{k:v for k,v in row.items() if k!='path'} for row in rows])
  for original,record in zip(rows,out['videos']):self.assertEqual(restored['media'][record['path']],p['media'][original['path']])
  for key in ['startState','endState','dialogueLanguage','camera']:self.assertEqual(out['shots'][0][key],h[key])
  self.assertEqual([a['id'] for a in restored['assets']],[a['id'] for a in p['assets']])
