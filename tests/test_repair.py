import copy,sys,unittest
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import planning_backend as planning
class RepairChecks(unittest.TestCase):
 def test_model_warnings_are_repairable_without_export_errors(self):
  p={'projectId':'p','segments':[{'id':'s','shots':[{'action':'original'}],'planning':{'warnings':['海浪影响未明确','海浪影响未明确']}}]}
  source=copy.deepcopy(p)
  with patch.object(planning,'quality',return_value=[]),patch.object(planning,'enqueue',return_value={'id':'task'}) as enqueue:
   self.assertEqual(planning.smart_repair(SimpleNamespace(load_project=lambda:p),{'projectId':'p','segmentId':'s'}),{'id':'task'})
   body=enqueue.call_args.args[1];self.assertTrue(body['smartRepair']);self.assertEqual(body['mode'],'review');self.assertEqual(body['instruction'].count('海浪影响未明确'),1)
  self.assertEqual(p,source)
 def test_no_issues_does_not_queue(self):
  p={'projectId':'p','segments':[{'id':'s','shots':[{}],'planning':{}}]}
  with patch.object(planning,'quality',return_value=[]),patch.object(planning,'enqueue') as enqueue:
   with self.assertRaises(ValueError):planning.smart_repair(SimpleNamespace(load_project=lambda:p),{'projectId':'p','segmentId':'s'})
   enqueue.assert_not_called()
