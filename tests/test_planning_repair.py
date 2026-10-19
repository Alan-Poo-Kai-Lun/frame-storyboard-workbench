import copy
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import server
import writing_backend as writing
import h3_compiler


class PlanningRepairChecks(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.old=server.DATA,server.STATE,server.CONFIG
        server.DATA=Path(self.temp.name);server.STATE=server.DATA/'project.json';server.CONFIG=server.DATA/'settings.json'
        self.p=server.blank_project();self.p['assetsManaged']=True
        self.p['assets']=[dict(id='poster',pictureNumber=7,name='海报',kind='人物',description='人物与产品综合海报',path='assets/poster.png',scope='public'),dict(id='actor',pictureNumber=9,name='角色',kind='人物',description='白衣人物',path='assets/actor.png',scope='public')]
        self.p['media']={'assets/poster.png':'aW1hZ2U=','assets/actor.png':'aW1hZ2Uy'}
        server.save(self.p)
    def tearDown(self):
        server.DATA,server.STATE,server.CONFIG=self.old;self.temp.cleanup()
    def snap(self):
        return dict(schemaVersion=2,count=1,duration=6,signature=writing.signature(server.load_project()),story='对白故事',rules=[],refs=[dict(id='poster',number=7,role='general'),dict(id='actor',number=9,role='person')],continuity=True,guideFromPrev=True)
    def output(self):
        return {'segments':[dict(title='故事',story='@Picture 9 走向 @Picture 7',summary='走近',language='Mandarin',shots=[dict(start=0,end=3,action='@Picture 9 走近',references=[9],startState='门外站立',endState='来到门前',dialogue='<Picture 9>: 你好'),dict(start=3,end=6,action='@Picture 7 海报',references=[7],startState='来到门前',endState='停步',dialogue='旁白: 请进')])]}
    def apply(self):
        result=writing.validate(server,self.output(),self.snap())
        row=dict(id='plan',type='story',status='done',projectId=self.p['projectId'],result=result)
        with patch('task_backend.manager',return_value=SimpleNamespace(get=lambda _:row,patch=lambda *a,**k:None)):
            return writing.apply(server,dict(id='plan',segments=[dict(title='故事',storyText=result['segments'][0]['storyText'])]))['project']
    def test_strict_state_and_binding_validation(self):
        result=writing.validate(server,self.output(),self.snap())
        self.assertEqual(result['segments'][0]['shots'][0]['assetIds'],['actor'])
        for key,value in [('references',[99]),('references',[]),('endState','')]:
            obj=self.output();obj['segments'][0]['shots'][0][key]=value
            with self.assertRaises(ValueError):writing.validate(server,obj,self.snap())
        obj=self.output();obj['segments'][0]['shots'][0]['action']='@Picture 7 走近'
        with self.assertRaises(ValueError):writing.validate(server,obj,self.snap())
    def test_restore_missing_shots_preview_idempotence_and_no_ai(self):
        p=self.apply();s=p['segments'][-1];removed=s['shots'].pop(0);s['shots'][0]['action']='保留手动编辑';server.save(p)
        before=server.STATE.read_bytes();body=dict(projectId=p['projectId'],planId='plan',mode='missing')
        with patch.object(server,'ai_call',side_effect=AssertionError('No inference')):
            preview=writing.restore(server,{**body,'preview':True})
            self.assertEqual(preview['restoredShots'],1);self.assertEqual(server.STATE.read_bytes(),before)
            out=writing.restore(server,body)['project'];self.assertEqual(out['segments'][-1]['shots'][0]['id'],removed['id'])
            self.assertEqual(out['segments'][-1]['shots'][1]['action'],'保留手动编辑')
            self.assertEqual(writing.restore(server,{**body,'preview':True})['items'],[])
        self.assertTrue(out['segments'][-1]['guideFromPrev']);self.assertTrue(out['directorGuide']['continuityEnabled'])
    def test_restore_overlap_rejects_without_save(self):
        p=self.apply();s=p['segments'][-1];s['shots'].pop(0);s['shots'][0]['start']=0;server.save(p);before=server.STATE.read_bytes()
        with self.assertRaisesRegex(ValueError,'重叠'):writing.restore(server,dict(projectId=p['projectId'],planId='plan'))
        self.assertEqual(server.STATE.read_bytes(),before)
    def test_stale_append_requires_explicit_review_and_stable_assets(self):
        snap=self.snap();snap['refs'][0]['sourceHash']=writing.digest({k:self.p['assets'][0].get(k) for k in ['id','path','description','kind']})
        result=writing.validate(server,self.output(),snap);row=dict(id='plan',type='story',status='done',projectId=self.p['projectId'],result=result)
        p=server.load_project();p['title']='改名';server.save(p)
        body=dict(id='plan',segments=[dict(title='故事',storyText=result['segments'][0]['storyText'])])
        with patch('task_backend.manager',return_value=SimpleNamespace(get=lambda _:row,patch=lambda *a,**k:None)):
            with self.assertRaises(ValueError):writing.apply(server,body)
            p['assets'][0]['description']='换图说明';server.save(p)
            with self.assertRaisesRegex(ValueError,'素材已删除、替换或修改'):writing.apply(server,{**body,'acceptSourceChanges':True})
            p['assets'][0]=self.p['assets'][0];server.save(p)
            self.assertEqual(writing.apply(server,{**body,'acceptSourceChanges':True})['created'],1)
    def test_h3_sections_speaker_order_and_composite_poster(self):
        p=self.apply();s=p['segments'][-1];text=server.scoped_prompt(p,s)
        sections=['subject_definitions:','summary:','retention_analysis:','detailed_description:','overall_soundscape:','non_diegetic_music:']
        self.assertEqual([text.index(k) for k in sections],sorted(text.index(k) for k in sections))
        self.assertIn('<Subject 2> (S1) says, <d>[Mandarin] 你好</d>',text)
        self.assertIn('Voice 旁白 (S2)',text);self.assertNotIn('<Subject 1> is',text)
        self.assertIn('<Picture 1> provides general',text);self.assertNotIn('@Picture',text)
        self.assertEqual(text.count('你好'),1);self.assertIn('Spatial end: 停步',text)
        p2=server.readzip(server.export_pack(p,force=True));self.assertEqual(server.scoped_prompt(p2,p2['segments'][-1]),text)
    def test_scene_role_and_professional_parameters_survive_compilation(self):
        p=self.apply();s=p['segments'][-1]
        p['assets'][0]['kind']='场景';s['planning']['referenceRoles'].pop('poster');s['shots'][0]['professionalNote']='机位保持固定'
        text=h3_compiler.compile_prompt(server,p,s)
        self.assertIn('<Subject 1> is',text);self.assertIn('Professional: 机位保持固定',text)
        s['planning']['referenceRoles']['poster']='general';self.assertNotIn('<Subject 1> is',h3_compiler.compile_prompt(server,p,s))
    def test_base_modes_use_only_base_sections_and_real_endpoints(self):
        p=self.apply();s=p['segments'][-1]
        for mode,expected in [('t2v',None),('i2v','at 0.00 seconds'),('fl2v','<Picture 2>')]:
            p['generation']={'taskType':mode};s['generation']={'genImage':'assets/poster.png','startImage':'assets/poster.png','endImage':'assets/actor.png'}
            text=h3_compiler.compile_prompt(server,p,s)
            self.assertTrue(text.startswith('integrated_multimodal_description:'));self.assertNotIn('subject_definitions:',text)
            if expected:self.assertIn(expected,text)
        s['generation']={'endImage':'assets/actor.png'};text=h3_compiler.compile_prompt(server,p,s)
        self.assertIn('<Picture 1> (from [Shot 2]) aligns with the 6.00-second',text);self.assertNotIn('0.00-second mark',text)


if __name__=='__main__':unittest.main()
