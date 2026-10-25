"""Run the current React Flow UI against isolated HTTP data and a local mock model."""
import json,os,shutil,socket,subprocess,sys,tempfile,threading,time
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.request import urlopen

ROOT=Path(__file__).resolve().parents[1]

def main():
 output=Path(os.environ.get('FRAME_QA_OUTPUT',ROOT/'dist/browser-checks.json')).resolve();output.parent.mkdir(parents=True,exist_ok=True)
 with tempfile.TemporaryDirectory(prefix='frame-browser-') as directory:
  work=Path(directory);media=work/'reference.mp4'
  ffmpeg=shutil.which('ffmpeg')
  if not ffmpeg:raise RuntimeError('ffmpeg is required for the video playback and Range checks')
  subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=teal:s=320x180:r=24','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',str(media)],check=True)
  class Model(BaseHTTPRequestHandler):
   def log_message(self,*args):pass
   def do_POST(self):
    json.loads(self.rfile.read(int(self.headers['Content-Length'])))
    plan={'duration':15,'segments':[{'title':f'方案 {i+1}','story':'@Picture 1 站在门口','language':'Mandarin','shots':[{'start':0,'end':15,'action':'@Picture 1 站在门口','camera':'固定中景','dialogue':'原文对白','sound':'环境声','startState':'人物在门口','endState':'人物仍在门口','references':[1]}]} for i in range(2)]}
    raw=json.dumps({'choices':[{'message':{'content':json.dumps({'reply':'本地测试方案，请预览确认。','changes':[],'storyPlan':plan},ensure_ascii=False)}}]}).encode()
    self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
  model=ThreadingHTTPServer(('127.0.0.1',0),Model);thread=threading.Thread(target=model.serve_forever,daemon=True);thread.start()
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  env={**os.environ,'FRAME_DATA_DIR':str(work/'data'),'PYTHONDONTWRITEBYTECODE':'1','PYTHONIOENCODING':'utf-8','FRAME_QA_URL':f'http://127.0.0.1:{port}','FRAME_QA_MODEL_URL':f'http://127.0.0.1:{model.server_port}/v1','FRAME_QA_VIDEO':str(media),'FRAME_QA_OUTPUT':str(output)}
  with (work/'server.log').open('w',encoding='utf-8') as log:
   process=subprocess.Popen([sys.executable,'-c',f"import server;server.ThreadingHTTPServer(('127.0.0.1',{port}),server.Handler).serve_forever()"],cwd=ROOT,env=env,stdout=log,stderr=log)
   try:
    for _ in range(100):
     try:
      with urlopen(env['FRAME_QA_URL']+'/api/bootstrap',timeout=1):break
     except OSError:
      if process.poll() is not None:raise RuntimeError((work/'server.log').read_text('utf-8'))
      time.sleep(.1)
    else:raise RuntimeError('Isolated HTTP server did not become ready')
    subprocess.run(['node',str(ROOT/'tests/r10-browser.cjs')],cwd=ROOT,env=env,check=True,timeout=180)
   finally:
    process.terminate();process.wait(timeout=10);model.shutdown();model.server_close();thread.join(5)
 print('PASS current React Flow browser checks:',output)

if __name__=='__main__':main()
