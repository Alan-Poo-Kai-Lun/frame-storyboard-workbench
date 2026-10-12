"""Exercise the built EXE in an isolated profile, including Tk and local HTTP."""
import json,os,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
release=json.loads((ROOT/'version.json').read_text('utf-8'))['release']
exe=ROOT/'dist'/('FRAME-Workbench-Windows-x64-'+release+'.exe')
with tempfile.TemporaryDirectory() as folder:
 path=Path(folder);report=path/'result.json';env={**os.environ,'FRAME_DATA_DIR':str(path/'data'),'FRAME_SELF_TEST_REPORT':str(report)}
 result=subprocess.run([str(exe),'--self-test'],env=env,timeout=120)
 if not report.is_file():raise RuntimeError('EXE did not write self-test report')
 data=json.loads(report.read_text('utf-8'));print(json.dumps(data,ensure_ascii=False))
 assert result.returncode==0 and data.get('ok'),data
 assert (path/'data/project.json').is_file()
 assert data['release']==release and data['runtime']=='exe'
