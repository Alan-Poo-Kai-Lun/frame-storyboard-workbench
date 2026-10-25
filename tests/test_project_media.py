import copy,json,os,unittest
from pathlib import Path
import server

PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lV4AAAAASUVORK5CYII='

class ProjectMediaChecks(unittest.TestCase):
 def setUp(self):
  self.p=server.blank_project()
  self.p['media']={'assets/a.png':PNG,'assets/b.png':PNG[::-1]}
  self.p['originalZip']='UEsDBAoAAAAAA'
  self.p['segments'][0]['shots']=[{'id':'sh1','start':0,'end':5,'action':'画面','camera':'','dialogue':'','sound':'','expression':'','image':'','locks':{}}]
  server.save(self.p)

 def test_media_and_zip_leave_the_project_file(self):
  payload=json.loads(server.STATE.read_text('utf-8'))
  self.assertNotIn('media',payload)
  self.assertNotIn('originalZip',payload)
  self.assertEqual(set(payload['mediaIndex']),set(self.p['media']))
  self.assertTrue(payload.get('originalZipHash'))
  self.assertLess(server.STATE.stat().st_size,200000)
  folder=server.DATA/'media'
  self.assertTrue(all((folder/(sha+'.b64')).is_file() for sha in payload['mediaIndex'].values()))
  self.assertTrue((folder/('original-'+payload['originalZipHash']+'.b64')).is_file())

 def test_round_trip_restores_exact_bytes(self):
  again=server.load_project()
  self.assertEqual(again['media'],self.p['media'])
  self.assertEqual(again['originalZip'],self.p['originalZip'])
  self.assertEqual(json.dumps(again['segments'],sort_keys=True),json.dumps(self.p['segments'],sort_keys=True))

 def test_unchanged_media_is_not_rewritten(self):
  folder=server.DATA/'media'
  stamps={item.name:item.stat().st_mtime_ns for item in folder.iterdir()}
  project=server.load_project();project['title']='改个名字';server.save(project)
  for name,stamp in stamps.items():
   self.assertEqual((folder/name).stat().st_mtime_ns,stamp,name)

 def test_layout_has_its_own_file(self):
  project=server.load_project();layout={'unifiedFlow':{'nodes':{'a:x':{'x':1,'y':2}},'mode':'canvas'}}
  before=server.STATE.stat().st_mtime_ns
  import project_layout
  project_layout.write(server.DATA,project['projectId'],layout)
  self.assertEqual(server.STATE.stat().st_mtime_ns,before)
  self.assertEqual(project_layout.all(server.DATA)[project['projectId']],layout)
  # A layout-only write must be picked up without rewriting the project file.
  self.assertEqual(server.load_project()['overviewLayout'],layout)

 def test_loads_are_cached_but_isolated(self):
  first=server.load_project();second=server.load_project()
  self.assertEqual(first['media'],second['media'])
  self.assertIsNot(first,second)
  second['title']='只改副本'
  self.assertNotEqual(server.load_project()['title'],'只改副本')
  project=server.load_project();project['title']='写回'
  server.save(project)
  self.assertEqual(server.load_project()['title'],'写回')

 def test_legacy_inline_project_is_migrated_on_first_save(self):
  legacy={'version':1,'projectId':'legacy-media','title':'旧格式','script':'','aspect':'16:9','fps':24,
          'segments':[{'id':'seg1','title':'片段 01','duration':15,'prompt':'','shots':[]}],
          'assets':[],'media':{'assets/old.png':PNG},'originalZip':''}
  server.STATE.write_text(json.dumps(legacy,ensure_ascii=False),'utf-8')
  import project_media
  project_media.forget()
  loaded=server.load_project()
  self.assertEqual(loaded['media'],{'assets/old.png':PNG})
  # Loading alone must shrink the file: a 60 MB project should not stay 60 MB.
  self.assertNotIn('media',json.loads(server.STATE.read_text('utf-8')))
  server.save(loaded)
  payload=json.loads(server.STATE.read_text('utf-8'))
  self.assertNotIn('media',payload)
  self.assertIn('assets/old.png',payload['mediaIndex'])
  self.assertEqual(server.load_project()['media'],{'assets/old.png':PNG})

if __name__=='__main__':unittest.main()

class MediaEndpointChecks(unittest.TestCase):
 """R9: media is fetched by path; the project payload no longer carries the bytes."""

 def setUp(self):
  self.p=server.blank_project()
  self.p['media']={'assets/a.png':PNG}
  server.save(self.p)

 def test_public_project_ships_references_only(self):
  published=server.public_project(server.load_project())
  self.assertNotIn('originalZip',published)
  self.assertEqual(list(published['media'].values())[0],server.load_project()['mediaIndex']['assets/a.png'])
  self.assertLess(len(json.dumps(published)),5000)

 def test_media_route_serves_bytes_and_ranges(self):
  import threading,urllib.request
  from http.server import ThreadingHTTPServer
  service=ThreadingHTTPServer(('127.0.0.1',0),server.Handler);service.daemon_threads=False
  thread=threading.Thread(target=service.serve_forever,daemon=True);thread.start()
  try:
   project=server.load_project();digest=project['mediaIndex']['assets/a.png']
   url='http://127.0.0.1:%d/api/media?p=%s&path=%s&h=%s'%(service.server_port,project['projectId'],'assets/a.png',digest)
   request=urllib.request.Request(url,headers={'Sec-Fetch-Site':'same-origin'})
   with urllib.request.urlopen(request,timeout=20) as response:
    self.assertEqual(response.status,200)
    self.assertEqual(response.headers.get('Content-Type'),'image/png')
    self.assertEqual(response.read(),__import__('base64').b64decode(PNG))
   ranged=urllib.request.Request(url,headers={'Sec-Fetch-Site':'same-origin','Range':'bytes=1-8'})
   with urllib.request.urlopen(ranged,timeout=20) as response:
    self.assertEqual(response.status,206)
    self.assertEqual(response.read(),__import__('base64').b64decode(PNG)[1:9])
   bad=urllib.request.Request(url.replace(digest,'0'*64),headers={'Sec-Fetch-Site':'same-origin'})
   with self.assertRaises(urllib.error.HTTPError):urllib.request.urlopen(bad,timeout=20)
  finally:
   service.shutdown();service.server_close();thread.join(timeout=3)

 def test_cross_site_media_request_is_rejected(self):
  import threading,urllib.request,urllib.error
  from http.server import ThreadingHTTPServer
  service=ThreadingHTTPServer(('127.0.0.1',0),server.Handler);service.daemon_threads=False
  thread=threading.Thread(target=service.serve_forever,daemon=True);thread.start()
  try:
   project=server.load_project();digest=project['mediaIndex']['assets/a.png']
   url='http://127.0.0.1:%d/api/media?p=%s&path=assets/a.png&h=%s'%(service.server_port,project['projectId'],digest)
   request=urllib.request.Request(url,headers={'Sec-Fetch-Site':'cross-site'})
   with self.assertRaises(urllib.error.HTTPError):urllib.request.urlopen(request,timeout=20)
  finally:
   service.shutdown();service.server_close();thread.join(timeout=3)
