"""Actual HTTP transport and task queue against a local deterministic model server."""
import copy,json,tempfile,threading,time,unittest
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.request import Request,urlopen
import server,task_backend

class AgentHTTPChecks(unittest.TestCase):
 def test_http_tool_loop_and_explicit_apply(self):
  old=server.DATA,server.STATE,server.CONFIG;requests=[]
  with tempfile.TemporaryDirectory() as folder:
   server.DATA=Path(folder);server.STATE=server.DATA/'project.json';server.CONFIG=server.DATA/'settings.json'
   p=server.blank_project();seg=p['segments'][0];seg['shots']=[{'id':'shot','start':0,'end':15,'action':'站立','camera':'固定','expression':'平静','dialogue':'你好','sound':'风声','startState':'门口','endState':'门口','image':''}];server.save(p)
   target={'kind':'shot','segmentId':seg['id'],'shotId':'shot'}
   class Model(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_POST(self):
     body=json.loads(self.rfile.read(int(self.headers['Content-Length'])));requests.append(body)
     output={'tool':'read_node','args':{'target':target}} if len(requests)==1 else {'reply':'建议先停步，再看向门外。','changes':[{'target':target,'fields':{'action':'停步后看向门外'}}]}
     raw=json.dumps({'choices':[{'message':{'content':json.dumps(output,ensure_ascii=False)},'finish_reason':'stop'}]}).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(raw)
   provider=ThreadingHTTPServer(('127.0.0.1',0),Model);threading.Thread(target=provider.serve_forever,daemon=True).start()
   server.CONFIG.write_text(json.dumps({'ai':{'provider':'openai','endpoint':f'http://127.0.0.1:{provider.server_port}','model':'local-test','autoUnload':False}}),'utf-8')
   web=ThreadingHTTPServer(('127.0.0.1',0),server.Handler);threading.Thread(target=web.serve_forever,daemon=True).start()
   def post(route,body):
    req=Request(f'http://127.0.0.1:{web.server_port}/api/'+route,data=json.dumps(body).encode(),headers={'Content-Type':'application/json','X-Workbench-Token':server.TOKEN})
    with urlopen(req,timeout=10) as response:return json.load(response)
   try:
    task=post('agent-send',{'projectId':p['projectId'],'target':target,'message':'改善动作，保留对白'})
    manager=task_backend.manager(server)
    for _ in range(100):
     row=manager.get(task['id'])
     if row['status'] in task_backend.TERMINAL:break
     time.sleep(.05)
    self.assertEqual(row['status'],'done',row.get('error'));self.assertEqual(len(requests),2)
    self.assertEqual(server.load_project()['segments'][0]['shots'][0]['action'],'站立')
    out=post('agent-apply',{'id':row['id']})['project'];self.assertEqual(out['segments'][0]['shots'][0]['action'],'停步后看向门外');self.assertEqual(out['segments'][0]['shots'][0]['dialogue'],'你好')
    out=post('agent-undo',{'id':row['id']})['project'];self.assertEqual(out['segments'][0]['shots'][0]['action'],'站立')
    self.assertEqual(post('agent-info',{'projectId':p['projectId'],'target':target})['messages'][-1]['role'],'assistant')
   finally:
    web.shutdown();web.server_close();provider.shutdown();provider.server_close();server.DATA,server.STATE,server.CONFIG=old
