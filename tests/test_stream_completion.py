import io,json,unittest
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import patch
import ai_runtime

class StreamCompletionChecks(unittest.TestCase):
 def test_task_stream_reads_chunks_and_completion(self):
  cases=[
   ('ollama','application/x-ndjson',[{'message':{'content':'你'},'done':False},{'message':{'content':'好'},'done':False},{'message':{'content':''},'done':True}],True),
   ('openai','text/event-stream',[{'choices':[{'delta':{'content':'你'}}]},{'choices':[{'delta':{'content':'好'}}]},{'choices':[{'delta':{},'finish_reason':'stop'}]}],True),
   ('openai','text/event-stream',[{'choices':[{'delta':{'content':'你'}}]},{'choices':[{'delta':{'content':'好'}}]}],True),
   ('openai','application/json',{'choices':[{'message':{'content':'你好'}}]},False),
  ]
  for provider,ctype,objects,stream in cases:
   with self.subTest(provider=provider,ctype=ctype,objects=objects):
    if stream:
     raw='\n'.join(('data: ' if provider=='openai' else '')+json.dumps(o) for o in objects)+'\n'
     if provider=='openai':raw+='data: [DONE]\n'
    else:raw=json.dumps(objects)
    @contextmanager
    def response(*args):
     out=io.BytesIO(raw.encode());out.headers={'Content-Type':ctype};yield out
    previous=getattr(ai_runtime.LOCAL,'run',None)
    ai_runtime.LOCAL.run={'id':'stream-test'}
    manager=SimpleNamespace(cancelled=lambda ident:False)
    try:
     with patch('task_backend.manager',return_value=manager),patch('task_backend.check_cancel'),patch.object(ai_runtime,'report'),patch.object(ai_runtime,'thinking_control',return_value=(False,'off')),patch.object(ai_runtime,'cancellable_response',response):
      self.assertEqual(ai_runtime.call(SimpleNamespace(),{'provider':provider,'endpoint':'http://local-mock','model':'mock'},[{'role':'user','content':'hello'}],False),'你好')
    finally:ai_runtime.LOCAL.run=previous

if __name__=='__main__':unittest.main()
