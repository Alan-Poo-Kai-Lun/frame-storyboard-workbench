"""Small desktop launcher for the frozen Windows build; editor remains in the browser."""
import argparse,json,logging,os,sys,tempfile,threading,webbrowser
from pathlib import Path
from urllib.request import Request,urlopen
from logging.handlers import RotatingFileHandler
import runtime_paths

def self_test(report):
 import server,tkinter as tk
 root=tk.Tk();root.withdraw();root.update();root.destroy()
 assert (server.ROOT/'web/startup.js').is_file()
 assert (server.ROOT/'presets/starter-project.json').is_file()
 assert server.DATA==runtime_paths.data_dir()
 service=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler);service.daemon_threads=True
 thread=threading.Thread(target=service.serve_forever,daemon=True);thread.start();base='http://127.0.0.1:'+str(service.server_port)
 try:
  with urlopen(base+'/api/bootstrap',timeout=5) as r:boot=json.load(r)
  assert boot['appId']=='frame-storyboard-workbench'
  with urlopen(base+'/',timeout=5) as r:assert b'startup.js?v=3.9' in r.read()
  req=Request(base+'/api/new-project',data=b'{"example":true}',headers={'X-Workbench-Token':server.TOKEN,'Content-Type':'application/json'})
  with urlopen(req,timeout=5) as r:p=json.load(r)
  assert len(p['assets'])==3 and len(p['segments'][0]['shots'])==3
  result={'ok':True,'release':boot['release'],'runtime':boot['runtimeMode'],'tk':True,'resources':True,'http':True,'example':True}
  if report:Path(report).write_text(json.dumps(result,indent=2),'utf-8')
 finally:service.shutdown();service.server_close();thread.join(5)
 return 0

def launch(port=8787,no_browser=False):
 import tkinter as tk
 from tkinter import ttk,messagebox,filedialog
 version=json.loads((runtime_paths.resource_dir()/'version.json').read_text('utf-8'))
 base='http://127.0.0.1:'+str(port)
 # Reopening the same frozen service does not start a second writer.
 try:
  with urlopen(base+'/api/bootstrap',timeout=1) as r:existing=json.load(r)
  if existing.get('appId')=='frame-storyboard-workbench' and existing.get('release')==version['release'] and existing.get('runtimeMode')=='exe' and existing.get('dataDirectory')==str(runtime_paths.data_dir()):
   webbrowser.open(base);return 0
 except Exception:pass
 root=tk.Tk();root.title('FRAME · 分镜工作台');root.geometry('480x355');root.minsize(450,335)
 try:root.iconbitmap(str(runtime_paths.resource_dir()/'FRAME.ico'))
 except Exception:pass
 folder=runtime_paths.data_dir();folder.parent.mkdir(parents=True,exist_ok=True)
 logs=folder.parent/'logs';logs.mkdir(exist_ok=True)
 handler=RotatingFileHandler(logs/'launcher.log',maxBytes=1024*1024,backupCount=2,encoding='utf-8');logging.getLogger().addHandler(handler);logging.getLogger().setLevel(logging.INFO)
 status=tk.StringVar(value='正在启动…');path_label=tk.StringVar(value=str(folder));service=None;closing=False
 area=ttk.Frame(root,padding=25);area.pack(fill='both',expand=True)
 ttk.Label(area,text='FRAME',font=('Segoe UI',24,'bold')).pack(anchor='w')
 ttk.Label(area,text='分镜工作台 · '+version['version']+' Beta',font=('Microsoft YaHei UI',11)).pack(anchor='w',pady=(0,14))
 ttk.Label(area,textvariable=status,wraplength=415).pack(anchor='w',pady=(0,12))
 def open_workbench():webbrowser.open(base)
 def open_data():
  folder.mkdir(parents=True,exist_ok=True)
  if sys.platform=='win32':os.startfile(str(folder))
  else:webbrowser.open(folder.as_uri())
 buttons=ttk.Frame(area);buttons.pack(fill='x',pady=5)
 open_button=ttk.Button(buttons,text='打开工作台',command=open_workbench);open_button.pack(side='left',padx=(0,8))
 ttk.Button(buttons,text='打开数据目录',command=open_data).pack(side='left')
 def import_old():
  source=filedialog.askdirectory(title='选择旧工作台的 data 文件夹')
  if not source:return
  if any(folder.iterdir()):messagebox.showinfo('已有数据','当前数据目录已有内容。请使用工作台首页导入项目备份，旧文件夹保持原样。',parent=root);return
  try:
   if runtime_paths.migrate_legacy_data(source,folder):status.set('旧数据已复制迁移。请刷新工作台；原文件保留。')
   else:messagebox.showinfo('未迁移','未找到旧工作台数据，或目标已有数据。原文件没有改动。',parent=root)
  except Exception as e:messagebox.showerror('迁移失败',str(e),parent=root)
 def exit_app():
  nonlocal closing
  if closing:return
  import task_backend
  manager=task_backend._INSTANCES.get((str(folder),getattr(sys.modules.get('server'),'TOKEN','')))
  if manager and any(r.get('status')=='running' for r in manager.rows):
   if not messagebox.askyesno('仍有任务运行','退出会中断本机任务。确定退出吗？',parent=root):return
  closing=True;status.set('正在关闭本机服务…');open_button.config(state='disabled')
  def finish():
   if service:service.shutdown();service.server_close()
   root.after(0,root.destroy)
  threading.Thread(target=finish,daemon=True).start()
 extras=ttk.Frame(area);extras.pack(fill='x',pady=7)
 ttk.Button(extras,text='检查更新',command=lambda:webbrowser.open(base+'/?check-updates=1')).pack(side='left',padx=(0,8))
 ttk.Button(extras,text='迁移旧数据',command=import_old).pack(side='left',padx=(0,8))
 ttk.Button(extras,text='退出',command=exit_app).pack(side='right')
 ttk.Separator(area).pack(fill='x',pady=12)
 ttk.Label(area,text='项目、素材和连接设置保存在：',foreground='#59616a').pack(anchor='w')
 ttk.Label(area,textvariable=path_label,wraplength=415).pack(anchor='w')
 root.protocol('WM_DELETE_WINDOW',exit_app);root.update()
 try:
  # Bind before migration, so a running older service prevents competing data writes.
  import server
  service=server.ThreadingHTTPServer(('127.0.0.1',port),server.Handler);service.daemon_threads=True
  migrated=runtime_paths.migrate_legacy_data(runtime_paths.program_dir()/'data',folder)
  threading.Thread(target=service.serve_forever,daemon=True).start()
  status.set('已启动 · '+base+(' · 旧数据已复制迁移' if migrated else ''))
  if not no_browser:root.after(350,open_workbench)
 except Exception as e:
  logging.exception('Launcher startup failed')
  if service:service.server_close()
  status.set('启动失败。请关闭旧版服务器后重试。');open_button.config(state='disabled')
  messagebox.showerror('FRAME 启动失败',str(e)+'\n\n日志位于：'+str(logs/'launcher.log'),parent=root)
  service=None
 root.mainloop();return 0

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8787);parser.add_argument('--no-browser',action='store_true');parser.add_argument('--self-test',action='store_true');args=parser.parse_args()
 if args.self_test:
  report=os.environ.get('FRAME_SELF_TEST_REPORT')
  try:return self_test(report)
  except Exception as e:
   if report:Path(report).write_text(json.dumps({'ok':False,'error':str(e)}),'utf-8')
   return 1
 return launch(args.port,args.no_browser)
if __name__=='__main__':raise SystemExit(main())
