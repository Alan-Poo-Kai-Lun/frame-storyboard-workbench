"""Pixel verification of browser-rendered endpoints, not just SVG IDs."""
import hashlib,json,sys
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[2];phase=sys.argv[1] if len(sys.argv)>1 else 'source'
types=['chevron2','chevron3','diamond','crosshair','chiseled','pulse','filled','open','dot','none','clapper','fork','jack','radar']
counts={};hashes={}
for kind in types:
 image=Image.open(root/f'qa-r7-{phase}-arrow-{kind}.png').convert('RGB')
 mask=bytes(255 if r>160 and b>160 and g<120 else 0 for r,g,b in image.getdata())
 counts[kind]=mask.count(255);hashes[kind]=hashlib.sha256(mask).hexdigest()
 assert (counts[kind]==0 if kind=='none' else counts[kind]>8),(kind,counts[kind])
assert len(set(hashes.values()))==len(types),'Different endpoint selections rendered the same pixels'
report={'ok':True,'phase':phase,'magentaPixels':counts,'distinctRenderedMasks':len(set(hashes.values()))}
(root/f'qa-r7-{phase}-pixels.json').write_text(json.dumps(report,indent=2),'utf-8')
print('PASS: all 13 endpoints visibly differ; none removes the endpoint; counts:',counts)
