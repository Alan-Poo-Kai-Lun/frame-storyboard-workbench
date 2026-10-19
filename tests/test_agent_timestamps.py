import json,tempfile,unittest
from pathlib import Path
import server,agent_backend as agent

class AgentTimestampChecks(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.old=server.DATA;server.DATA=Path(self.tmp.name)
 def tearDown(self):server.DATA=self.old;self.tmp.cleanup()
 def test_new_messages_persist_millisecond_timestamp(self):
  agent.store_chat(server,'project','thread',{'role':'user','content':'hello','at':1792372800.25})
  message=agent.read_chats(server)['project']['thread'][0]
  self.assertEqual(message['timestamp'],1792372800250)
  self.assertEqual(json.loads((server.DATA/'agent-conversations.json').read_text('utf-8'))['project']['thread'][0]['timestamp'],1792372800250)
 def test_legacy_migration_is_stable_and_does_not_invent_missing_times(self):
  path=server.DATA/'agent-conversations.json';path.write_text(json.dumps({'p':{'t':[{'at':1792372800,'content':'old'},{'content':'unknown'}]}}),'utf-8')
  messages=agent.read_chats(server)['p']['t'];self.assertEqual(messages[0]['timestamp'],1792372800000);self.assertEqual(messages[1]['timestamp'],0)
  before=path.read_bytes();self.assertEqual(agent.read_chats(server)['p']['t'],messages);self.assertEqual(path.read_bytes(),before)
 def test_explicit_timestamp_is_preserved(self):
  agent.store_chat(server,'p','t',{'content':'fixed','timestamp':1792372800123})
  self.assertEqual(agent.read_chats(server)['p']['t'][0]['timestamp'],1792372800123)

if __name__=='__main__':unittest.main()
