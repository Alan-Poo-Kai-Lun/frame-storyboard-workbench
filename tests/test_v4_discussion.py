import json
from unittest.mock import patch
from test_agent import AgentChecks
import server
from backend.services import agent_backend as agent

class DiscussionChecks(AgentChecks):
 def test_discussion_discards_changes_and_story_plan(self):
  self.snap.update(discussion=True,maxCalls=1)
  response={'reply':'先讨论动作的连贯性。','changes':self.proposal(),'storyPlan':{'duration':15,'segments':[]}}
  with patch('backend.services.task_backend.manager',return_value=self.manager),patch.object(server,'ai_call',return_value=json.dumps(response)) as call:
   result=agent.analyze(server,{},self.snap,{'_taskId':'agent'})
  self.assertEqual(call.call_count,1)
  self.assertEqual(result['changes'],[])
  self.assertNotIn('storyPlan',result)
  self.assertEqual(server.load_project()['segments'],self.p['segments'])
