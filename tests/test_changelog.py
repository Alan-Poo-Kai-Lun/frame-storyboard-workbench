"""Historical text retention, ordering, future SemVer and release-note extraction."""
import hashlib,json,re,sys,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from release_notes import release_notes,release_tag
from bump_version import bump
from backend.utils import update_check,update_workbench

class ChangelogChecks(unittest.TestCase):
 def test_all_archive_bodies_are_present_and_unchanged(self):
  text=(ROOT/'CHANGELOG.md').read_text('utf-8')
  pattern=r'<!-- history-source: ([^;]+); original-sha256: ([a-f0-9]{64}); body-sha256: ([a-f0-9]{64}) -->\n\n([\s\S]*?)\n\n<!-- history-source-end -->'
  blocks=list(re.finditer(pattern,text));self.assertEqual(len(blocks),50)
  self.assertEqual(len({m[1] for m in blocks}),50)
  self.assertEqual(sum('/release-' in m[1] for m in blocks),47)
  for block in blocks:self.assertEqual(hashlib.sha256(block[4].encode()).hexdigest(),block[3],block[1])
  self.assertFalse((ROOT/'docs/releases').exists())
  manifest=json.loads((ROOT/'release-manifest.json').read_text('utf-8'));self.assertFalse(any(n.startswith('docs/releases/') for n in manifest))
 def test_versions_are_sorted_by_numeric_version_and_historical_suffix(self):
  text=(ROOT/'CHANGELOG.md').read_text('utf-8');tags=re.findall(r'^## \[(v[^\]]+)\]',text,re.M)
  keys=[update_check.version_key(tag) for tag in tags]
  self.assertEqual(keys,sorted(keys,reverse=True));self.assertEqual(len(tags),len(set(tags)))
 def test_current_notes_are_extracted_without_other_versions(self):
  tag=json.loads((ROOT/'version.json').read_text('utf-8'))['release'];notes=release_notes(ROOT,tag)
  self.assertTrue(notes.startswith('## ['+tag+']'));self.assertNotIn('history-source:',notes);self.assertNotIn('version-v3.41.2',notes)
  with self.assertRaises(ValueError):release_notes(ROOT,'v999.0.0')
 def test_semver_and_version_tool_reject_legacy_suffixes_without_mutation(self):
  for bad in ['4.0','04.0.0','4.00.0','4.0.0-canvas-r15','vV4.0.0']:
   with self.assertRaises(ValueError):release_tag(bad)
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);(root/'web').mkdir();(root/'version.json').write_text('{"version":"V3.41.2","release":"v3.41.2-canvas-r15","build":"R15"}','utf-8');(root/'web/index.html').write_text('app.js?v=3.41.2-canvas-r15','utf-8');(root/'CHANGELOG.md').write_text('## [v4.0.0] - 2026-11-03\n\n- New version.\n','utf-8')
   before=(root/'version.json').read_bytes()
   with self.assertRaises(ValueError):bump(root,'4.0')
   with self.assertRaises(ValueError):bump(root,'5.0.0')
   self.assertEqual((root/'version.json').read_bytes(),before)
   result=bump(root,'4.0.0','2026-11-03');payload=json.loads((root/'version.json').read_text('utf-8'))
   self.assertEqual(result['release'],'v4.0.0');self.assertEqual(payload['version'],'V4.0.0');self.assertNotIn('build',payload);self.assertIn('?v=4.0.0',(root/'web/index.html').read_text('utf-8'))
 def test_update_checks_and_package_labels_support_three_part_versions(self):
  self.assertGreater(update_check.version_key('v3.41.3'),update_check.version_key('v3.41.2-canvas-r15'))
  self.assertEqual(update_workbench.version_name({'README.md':b'FRAME V3.41.3'}),'V3.41.3')
  self.assertEqual(update_workbench.version_name({'README.md':b'FRAME V3.6'}),'V3.6')

if __name__=='__main__':unittest.main()
