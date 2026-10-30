import base64
import copy
import io
import json
import sys
import unittest
import wave
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server

def setUpModule():
 import sys
 from pathlib import Path
 sys.path.insert(0,str(Path(__file__).parent))
 import _tempdata;_tempdata.start()

def tearDownModule():
 import _tempdata;_tempdata.stop()



class GenerationChecks(unittest.TestCase):
    def test_replaced_reference_cannot_be_overwritten_by_imported_media(self):
        p = self.project()
        p['assets'] = p['assets'][:1]
        p['generationManaged'] = False
        p['segments'][0]['generation'] = {}
        old = 'shared_params/Picture1.png'
        new = 'uploads/current-image.png'
        original = base64.b64decode(p['media'][p['assets'][0]['path']])
        # Distinct real image bytes, with the old image retained by an imported project.
        replacement = original + b'CURRENT-REFERENCE'
        p['media'][old] = base64.b64encode(original).decode()
        p['media'][new] = base64.b64encode(replacement).decode()
        p['assets'][0]['path'] = new
        out = server.export_pack(p, force=True)
        with zipfile.ZipFile(io.BytesIO(out)) as z:
            self.assertEqual(z.read(old), replacement)
            refs = json.loads(z.read('shared_params/shared_params.json'))['refs']
            self.assertEqual(refs[0]['imageFile'], old)
        restored = server.readzip(out)
        with zipfile.ZipFile(io.BytesIO(server.export_pack(restored, force=True))) as z:
            self.assertEqual(z.read(old), replacement)

    def project(self):
        p = server.readzip((ROOT / 'presets/starter-project.mmxpack.zip').read_bytes())
        p['overviewLayout']['canvas37']['appearance']={'lineStyle':'pcb','lineEffect':'dual','arrowType':'chevron3','hierarchy':True,'bodySize':18,'gridSize':25}
        p['assetsManaged'] = True
        p['generationManaged'] = True
        p['segments'] = p['segments'][:1]
        s = p['segments'][0]
        s['duration'] = s['originalDuration'] = 2
        s['shots'] = []
        s['prompt'] = 'summary:\nUse <Audio 1> and <Video 1>.\ntimeline:\n[0s-2s]\nA quiet scene.'
        p['assets'] = p['assets'][:1]
        image = p['assets'][0]['path']
        video = next(k for k in p['media'] if k.endswith('.mp4'))
        wav = io.BytesIO()
        with wave.open(wav, 'wb') as out:
            out.setnchannels(1); out.setsampwidth(2); out.setframerate(16000); out.writeframes(b'\0\0' * 1600)
        audio = 'extra/reference_media/voice.wav'
        p['media'][audio] = base64.b64encode(wav.getvalue()).decode()
        for kind, path in [('audio', audio), ('video', video)]:
            p['assets'].append({'id': kind, 'name': kind, 'mediaType': kind, 'path': path,
                                'kind': kind, 'scope': 'public', 'description': 'reference'})
        p['sourceVideo'] = {'videoFile': video, 'fileName': Path(video).name, 'duration': 60, 'frames': [], 'frameMap': []}
        s['generation'] = {'taskType': 'r2v', 'genImage': image, 'startImage': image, 'endImage': image}
        return p

    def unpack(self, p):
        blob = server.export_pack(p, force=True)
        with zipfile.ZipFile(io.BytesIO(blob)) as z:
            files = {n: z.read(n) for n in z.namelist()}
        return blob, files, json.loads(files['pack.json']), json.loads(files['timeline.json'])

    def test_seven_modes_sync_and_multimedia_roundtrip(self):
        for mode in ('t2v', 'i2v', 'fl2v', 'r2v', 'v2v', 'rv2v', 'mixed'):
            with self.subTest(mode=mode):
                p = self.project(); p['generation'] = {'taskType': mode}
                blob, files, pack, timeline = self.unpack(p)
                self.assertEqual(pack['taskType'], mode)
                self.assertEqual(pack['widgets']['task_type'], mode)
                self.assertEqual(timeline['global']['taskType'], mode)
                self.assertEqual(timeline['batchWorkspaces'], {})
                self.assertEqual(timeline['segments'][0]['taskType'], 'r2v' if mode == 'mixed' else mode)
                for key, field in [('refs', 'imageFile'), ('refAudios', 'audioFile'), ('refVideos', 'videoFile')]:
                    self.assertEqual(len(timeline['global'][key]), 1)
                    self.assertIn(timeline['global'][key][0][field], files)
                if mode in ('v2v', 'rv2v'):
                    self.assertEqual(timeline['timelineMode'], 'video')
                    self.assertEqual(timeline['totalFrames'], 48)
                    self.assertEqual(timeline['segments'][0]['length'], 48)
                    self.assertIn(timeline['videoClips'][0]['videoFile'], files)
                restored = server.readzip(blob)
                self.assertEqual(restored['generation']['taskType'], mode)
                self.assertEqual(restored['overviewLayout'],p['overviewLayout'])
                self.assertEqual([a.get('mediaType', 'image') for a in restored['assets']], ['image', 'audio', 'video'])
                self.assertTrue(all(a['path'] in restored['media'] for a in restored['assets']))
                # A second export must retain audio/video, endpoint paths and edited task selection.
                _, _, second, _ = self.unpack(restored)
                self.assertEqual(second['taskType'], mode)

    def test_public_and_local_slots_do_not_override(self):
        p = self.project(); p['generation'] = {'taskType': 'r2v'}
        local = copy.deepcopy(p['assets'][1]); local.update(id='local', scope='segment', segmentId=p['segments'][0]['id'])
        p['assets'].append(local)
        _, _, _, timeline = self.unpack(p)
        self.assertEqual(timeline['global']['refAudios'][0]['index'], 0)
        self.assertEqual(timeline['segments'][0]['refAudios'][0]['index'], 1)
        self.assertNotIn('Audio', timeline['segments'][0]['prompt'].split('summary:')[0])

    def test_missing_inputs_invalid_mixed_and_limits_fail_explicitly(self):
        cases = [('mixed', {'taskType': 'v2v'}), ('i2v', {'genImage': ''}), ('fl2v', {'startImage': '', 'endImage': ''})]
        for mode, settings in cases:
            p = self.project(); p['generation'] = {'taskType': mode}; p['segments'][0]['generation'] = settings
            with self.assertRaises(ValueError): self.unpack(p)
        p = self.project(); p['generation'] = {'taskType': 'v2v'}; p['sourceVideo'] = {}
        with self.assertRaises(ValueError): self.unpack(p)
        p = self.project(); p['generation'] = {'taskType': 'r2v'}
        for i in range(3):
            a = copy.deepcopy(p['assets'][1]); a['id'] = f'a{i}'; p['assets'].append(a)
        with self.assertRaisesRegex(ValueError, 'audio'): self.unpack(p)

    def test_deleted_bound_input_or_audio_tag_cannot_silently_rebind(self):
        p = self.project(); p['generation'] = {'taskType': 'i2v'}
        p['assets'][0]['deleted'] = True
        with self.assertRaisesRegex(ValueError, '已删除素材'): self.unpack(p)
        p = self.project(); p['generation'] = {'taskType': 'r2v'}
        p['assets'][1].update(deleted=True, deletedReferenceScopes=[{'segmentId': p['segments'][0]['id'], 'label': 'Audio 1'}])
        with self.assertRaisesRegex(ValueError, '已删除素材'): self.unpack(p)
        p['assets'][1]['deleted'] = False
        self.unpack(p)

    def test_legacy_import_exposes_real_audio_video_and_widget_mode(self):
        p = self.project(); p['generation'] = {'taskType': 'r2v'}
        _, files, _, _ = self.unpack(p)
        files.pop('storyboard.json')
        out = io.BytesIO()
        with zipfile.ZipFile(out, 'w') as z:
            for name, value in files.items(): z.writestr(name, value)
        restored = server.readzip(out.getvalue())
        self.assertEqual(restored['generation']['taskType'], 'r2v')
        self.assertFalse(restored['generationManaged'])
        self.assertEqual(sum(a.get('mediaType') in ('audio', 'video') for a in restored['assets']), 2)


if __name__ == '__main__':
    unittest.main()
