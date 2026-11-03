"""Set a strict three-part release version; release notes live in CHANGELOG.md."""
import argparse,datetime,json,sys
from pathlib import Path
from release_notes import release_tag,release_notes
ROOT=Path(__file__).resolve().parents[1]

def bump(root,version,today=None):
 root=Path(root);tag=release_tag(version);notes=release_notes(root,tag)
 path=root/'version.json';payload=json.loads(path.read_text('utf-8'));old_tag=payload.get('release','')
 payload.update(version='V'+tag[1:],release=tag,date=today or datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).date().isoformat());payload.pop('build',None)
 index=root/'web/index.html';raw=index.read_text('utf-8');old_cache=old_tag.removeprefix('v')
 # The server fingerprints served resources. Update the readable literal when present;
 # older packages may already have a different literal and must not fail halfway.
 if old_cache and old_cache!=tag[1:] and old_cache in raw:index.write_text(raw.replace(old_cache,tag[1:]),'utf-8')
 path.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n','utf-8')
 return {'version':payload['version'],'release':tag,'cacheKey':tag[1:],'notes':'CHANGELOG.md','releaseNotes':notes}

def main():
 parser=argparse.ArgumentParser(description='Set a SemVer release with notes in CHANGELOG.md.')
 parser.add_argument('--version',required=True,help='例如 4.0.0')
 parser.add_argument('--root',type=Path,default=ROOT)
 parser.add_argument('--date',default=None)
 args=parser.parse_args()
 try:result=bump(args.root,args.version,args.date)
 except Exception as error:print('版本号未更新：'+str(error),file=sys.stderr);return 1
 print(result['version']+' → '+result['release']+'\n版本说明：CHANGELOG.md');return 0

if __name__=='__main__':raise SystemExit(main())
