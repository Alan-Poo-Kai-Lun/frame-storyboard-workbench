"""Read a release section from the single authoritative changelog."""
import re
from pathlib import Path
SEMVER=re.compile(r'(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)')

def release_tag(version):
 value=re.sub(r'^[vV]','',str(version).strip())
 if not SEMVER.fullmatch(value):raise ValueError('版本号必须为三段 SemVer，例如 4.0.0；不得带 canvas-rXX 后缀')
 return 'v'+value

def release_notes(root,tag):
 tag=release_tag(tag);text=(Path(root)/'CHANGELOG.md').read_text('utf-8')
 heading=re.search(r'^## \['+re.escape(tag)+r'\](?:[^\n]*)$',text,re.M)
 if not heading:raise ValueError('CHANGELOG.md 缺少版本说明：'+tag)
 next_heading=re.search(r'^## ',text[heading.end():],re.M)
 end=heading.end()+next_heading.start() if next_heading else len(text)
 notes=text[heading.start():end].strip()
 notes=re.sub(r'\n<a id="[^"]+"></a>\s*$','',notes).strip()
 if not notes.partition('\n')[2].strip():raise ValueError('版本说明不能为空：'+tag)
 return notes
