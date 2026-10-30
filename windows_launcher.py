"""Small desktop launcher for the frozen Windows build; editor remains in the browser."""
import argparse,json,logging,os,re,sys,tempfile,threading,webbrowser
from pathlib import Path
from urllib.request import Request,urlopen
from logging.handlers import RotatingFileHandler
import runtime_paths
runtime_paths.configure_temp()

def self_test(report):
 import server,tkinter as tk
 root=tk.Tk();root.withdraw();root.update();root.destroy()
 assert (server.ROOT/'web/startup.js').is_file()
 assert (server.ROOT/'web/overview-editor.js').is_file()
 assert (server.ROOT/'web/canvas-controls.js').is_file()
 assert (server.ROOT/'web/canvas-unified-host.js').is_file()
 assert (server.ROOT/'web/flow-operations.js').is_file()
 assert (server.ROOT/'web/canvas-unified.css').is_file()
 assert (server.ROOT/'web/vendor/reactflow-a/app.js').is_file()
 assert (server.ROOT/'web/vendor/reactflow-a/reactflow.css').is_file()
 assert (server.ROOT/'web/vendor/reactflow-a/LICENSES.txt').is_file()
 assert (server.ROOT/'web/visual-packs.js').is_file()
 assert (server.ROOT/'presets/starter-project.mmxpack.zip').is_file()
 assert server.DATA==runtime_paths.data_dir()
 service=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler);service.daemon_threads=True
 thread=threading.Thread(target=service.serve_forever,daemon=True);thread.start();base='http://127.0.0.1:'+str(service.server_port)
 try:
  with urlopen(base+'/api/bootstrap',timeout=5) as r:boot=json.load(r)
  assert boot['appId']=='frame-storyboard-workbench'
  with urlopen(base+'/',timeout=5) as r:html=r.read()
  versions={value for value in re.findall(rb'\?v=([0-9A-Za-z.\-]+)',html)}
  assert len(versions)==1,'页面资源版本不一致：'+repr(versions)
  cache_version=versions.pop().decode()
  for script in ['startup.js','overview-editor.js','canvas-controls.js']:assert (script+'?v='+cache_version).encode() in html,'页面资源版本不一致：'+script
  with urlopen(base+'/overview-editor.js?v='+cache_version,timeout=5) as r:assert b'frameOverviewEditor' in r.read()
  with urlopen(Request(base+'/api/projects',headers={'X-Workbench-Token':server.TOKEN}),timeout=5) as r:assert isinstance(json.load(r),list)
  with urlopen(Request(base+'/api/visual-library-storage',headers={'X-Workbench-Token':server.TOKEN}),timeout=5) as r:assert json.load(r)['limit'] is None
  req=Request(base+'/api/new-project',data=b'{"example":true}',headers={'X-Workbench-Token':server.TOKEN,'Content-Type':'application/json'})
  with urlopen(req,timeout=30) as r:p=json.load(r)
  # Compare against the bundled example instead of fixed numbers: the sample is
  # edited between releases and a stale count turns the smoke test into a false alarm.
  starter=server.readzip((server.ROOT/'presets/starter-project.mmxpack.zip').read_bytes())
  expected=(len([a for a in starter.get('assets') or [] if not a.get('deleted')]),len(starter.get('segments') or []),sum(len(s.get('shots') or []) for s in starter.get('segments') or []))
  assert all(value>0 for value in expected),'示例包内容为空'
  assert (len(p['assets']),len(p['segments']),sum(len(s['shots']) for s in p['segments']))==expected,'示例工程与示例包不一致'
  assert all(a['path'] in p['media'] for a in p['assets'])
  restored=server.readzip(server.export_pack(p))
  assert restored['media']==p['media'] and restored['segments']==p['segments']
  import writing_backend
  bundled_rules=json.loads((server.ROOT/'presets/writing-skills-baseline.json').read_text('utf-8'))['items']
  library=writing_backend.library(server)['items']
  for expected in bundled_rules:
   actual=next(row for row in library if row['id']==expected['id'])
   assert actual['rules']==expected['rules'] and len(actual['rules'])>1000
  result={'ok':True,'release':boot['release'],'runtime':boot['runtimeMode'],'tk':True,'resources':True,'http':True,'httpBacklog':service.request_queue_size,'tempDirectory':tempfile.gettempdir(),'example':True}
  result['writingSkills']=len(library)
  if report:Path(report).write_text(json.dumps(result,indent=2),'utf-8')
 finally:service.shutdown();service.server_close();thread.join(5)
 return 0

# Bilingual strings for the launcher window. Keep both languages in sync when adding keys.
LAUNCHER_TEXT={
 'zh':{
  'window':'FRAME · 画布 {b}',
  'version':'画布 {b} · {v}',
  'group_start':'开始',
  'open':'打开工作台',
  'open_hint':'继续创作、导入项目、导出导演包都在这里',
  'group_data':'数据',
  'data':'打开数据目录',
  'data_hint':'项目、素材和设置都在这个文件夹里',
  'migrate':'迁移旧数据',
  'migrate_hint':'从旧版 FRAME 导入项目、素材和设置',
  'backup':'备份全部',
  'backup_hint':'把项目和素材打包成 zip，可存到别处',
  'group_maint':'维护',
  'update':'检查更新',
  'update_hint':'打开工作台的更新页面',
  'logs':'查看日志',
  'logs_hint':'启动器与本机服务的运行记录',
  'exit':'退出',
  'path_label':'项目、素材和连接设置保存在：',
  'starting':'正在启动…',
  'started':'已启动 · {base} · 资源 {ver}{extra}',
  'adopted':' · 沿用旧数据目录',
  'closing':'正在关闭本机服务…',
  'failed':'启动失败。请关闭旧版服务器后重试。',
  'failed_title':'FRAME 启动失败',
  'lang_button':'EN',
  'migrate_pick':'选择旧工作台的 data 文件夹',
  'migrate_busy_t':'已有数据',
  'migrate_busy':'当前数据目录已有内容。请使用工作台首页导入项目备份，旧文件夹保持原样。',
  'migrate_ok':'旧数据已复制迁移。请刷新工作台；原文件保留。',
  'migrate_none_t':'未迁移',
  'migrate_none':'未找到旧工作台数据，或目标已有数据。原文件没有改动。',
  'migrate_err':'迁移失败',
  'backup_pick':'选择备份保存位置',
  'backup_done':'备份已保存：{p}',
  'backup_none_t':'没有可备份的内容',
  'backup_none':'数据目录还是空的，先创建工作台项目再备份。',
  'backup_err':'备份失败',
  'busy_t':'仍有任务运行',
  'busy':'退出会中断本机任务。确定退出吗？',
  'settings':'存储设置',
  'settings_hint':'更改数据目录和导演包导出位置',
  'settings_title':'存储设置',
  'data_dir_label':'数据目录',
  'data_dir_note':'项目、素材和设置都存这里。更改后需要重启启动器。',
  'export_dir_label':'导演包导出位置',
  'export_dir_note':'留空则由浏览器决定保存位置。',
  'change':'更改…',
  'clear':'清除',
  'pick_data_dir':'选择新的数据目录',
  'pick_export_dir':'选择导演包导出目录',
  'data_changed':'数据目录已改为：\n{p}\n\n重启启动器后生效。当前数据不会自动移动，需要的话请手动复制。',
  'data_changed_t':'数据目录已更新',
  'export_changed':'导出位置已设为：\n{p}',
  'export_cleared':'已清除导出位置，之后由浏览器决定。',
  'saved_t':'已保存',
  'close':'关闭',
 },
 'en':{
  'window':'FRAME · Canvas {b}',
  'version':'Canvas {b} · {v}',
  'group_start':'START',
  'open':'Open Workbench',
  'open_hint':'Continue writing, import projects, export director packs',
  'group_data':'DATA',
  'data':'Open Data Folder',
  'data_hint':'All projects, media and settings live in this folder',
  'migrate':'Migrate Old Data',
  'migrate_hint':'Import projects, media and settings from an older FRAME',
  'backup':'Back Up Everything',
  'backup_hint':'Pack projects and media into a zip you can store elsewhere',
  'group_maint':'MAINTENANCE',
  'update':'Check for Updates',
  'update_hint':'Opens the update page inside the workbench',
  'logs':'View Logs',
  'logs_hint':'Launcher and local service records',
  'exit':'Quit',
  'path_label':'Projects, media and connection settings are stored in:',
  'starting':'Starting…',
  'started':'Running · {base} · assets {ver}{extra}',
  'adopted':' · using an existing data folder',
  'closing':'Shutting down the local service…',
  'failed':'Startup failed. Close the older server and try again.',
  'failed_title':'FRAME failed to start',
  'lang_button':'中',
  'migrate_pick':'Pick the data folder of an older workbench',
  'migrate_busy_t':'Data already present',
  'migrate_busy':'This data folder is not empty. Import project backups from the workbench home instead; the old folder stays untouched.',
  'migrate_ok':'Old data copied. Refresh the workbench; the originals are kept.',
  'migrate_none_t':'Nothing migrated',
  'migrate_none':'No old workbench data found, or the target already has data. Nothing was changed.',
  'migrate_err':'Migration failed',
  'backup_pick':'Choose where to save the backup',
  'backup_done':'Backup saved: {p}',
  'backup_none_t':'Nothing to back up',
  'backup_none':'The data folder is still empty. Create a project first.',
  'backup_err':'Backup failed',
  'busy_t':'Tasks are still running',
  'busy':'Quitting will interrupt local tasks. Continue?',
  'settings':'Storage Settings',
  'settings_hint':'Change the data folder and director-pack export location',
  'settings_title':'Storage Settings',
  'data_dir_label':'Data folder',
  'data_dir_note':'Projects, media and settings live here. Restart the launcher after changing it.',
  'export_dir_label':'Director pack export folder',
  'export_dir_note':'Leave empty and the browser decides where to save.',
  'change':'Change…',
  'clear':'Clear',
  'pick_data_dir':'Choose a new data folder',
  'pick_export_dir':'Choose the director pack export folder',
  'data_changed':'Data folder changed to:\n{p}\n\nRestart the launcher to apply. Existing data is not moved automatically — copy it yourself if needed.',
  'data_changed_t':'Data folder updated',
  'export_changed':'Export folder set to:\n{p}',
  'export_cleared':'Export folder cleared. The browser decides again.',
  'saved_t':'Saved',
  'close':'Close',
 },
}

def launch(port=8852,no_browser=False):
 import tkinter as tk
 from tkinter import ttk,messagebox,filedialog
 import zipfile,datetime
 version=json.loads((runtime_paths.resource_dir()/'version.json').read_text('utf-8'));build=version.get('build') or version.get('release','')
 base='http://127.0.0.1:'+str(port)
 # Reopening the same frozen service does not start a second writer.
 try:
  with urlopen(base+'/api/bootstrap',timeout=1) as r:existing=json.load(r)
  if existing.get('appId')=='frame-storyboard-workbench' and existing.get('release')==version['release'] and existing.get('runtimeMode')=='exe' and existing.get('dataDirectory')==str(runtime_paths.data_dir()):
   webbrowser.open(base);return 0
 except Exception:pass
 def detect_language():
  # Environment variables win: they are what the shell and CI actually set.
  try:
   for key in ('FRAME_UI_LANGUAGE','LANGUAGE','LC_ALL','LC_MESSAGES','LANG'):
    value=os.environ.get(key)
    if value:return 'en' if value.lower().startswith('en') else 'zh'
   import locale as _locale,warnings as _warnings
   with _warnings.catch_warnings():
    _warnings.simplefilter('ignore',DeprecationWarning)
    name=(_locale.getdefaultlocale()[0] or '').lower()
   return 'en' if name.startswith('en') else 'zh'
  except Exception:return 'zh'
 state={'lang':detect_language(),'closing':False,'service':None}
 def t(key,**kw):
  text=LAUNCHER_TEXT[state['lang']].get(key,key)
  return text.format(b=build,v=version['version'],**kw) if kw else text.format(b=build,v=version['version'])
 root=tk.Tk();root.title(t('window'));root.geometry('560x660');root.minsize(520,620)
 try:root.iconbitmap(str(runtime_paths.resource_dir()/'FRAME.ico'))
 except Exception:pass
 folder=runtime_paths.data_dir();folder.parent.mkdir(parents=True,exist_ok=True)
 logs=folder.parent/'logs';logs.mkdir(exist_ok=True)
 handler=RotatingFileHandler(logs/'launcher.log',maxBytes=1024*1024,backupCount=2,encoding='utf-8');logging.getLogger().addHandler(handler);logging.getLogger().setLevel(logging.INFO)
 status=tk.StringVar(value=t('starting'));path_label=tk.StringVar(value=str(folder))
 refs=[]  # (widget, key, kind) — kind: 'text' updates text, 'status' is handled separately
 area=ttk.Frame(root,padding=(24,20));area.pack(fill='both',expand=True)

 head=ttk.Frame(area);head.pack(fill='x')
 brand=ttk.Label(head,text='FRAME',font=('Segoe UI',26,'bold'));brand.pack(side='left')
 lang_button=ttk.Button(head,text=t('lang_button'),width=4,command=lambda:toggle_language());lang_button.pack(side='right')
 sub=ttk.Label(area,font=('Microsoft YaHei UI',11),foreground='#59616a');sub.pack(anchor='w',pady=(0,10))
 refs.append((sub,'version','text'))
 status_label=ttk.Label(area,textvariable=status,wraplength=505,foreground='#3c4149');status_label.pack(anchor='w',pady=(0,14))

 def group(title_key):
  wrap=ttk.Frame(area);wrap.pack(fill='x',pady=(0,6))
  label=ttk.Label(wrap,font=('Microsoft YaHei UI',9,'bold'),foreground='#8a9099');label.pack(anchor='w',pady=(6,4))
  refs.append((label,title_key,'text'))
  return wrap

 def action_row(parent,button_key,hint_key,command,primary=False,width=None):
  row=ttk.Frame(parent);row.pack(fill='x',pady=(0,6))
  btn=ttk.Button(row,command=command,width=width or (18 if primary else 16))
  btn.pack(side='left',anchor='n')
  refs.append((btn,button_key,'text'))
  hint=ttk.Label(row,font=('Microsoft YaHei UI',9),foreground='#8a9099',wraplength=340,justify='left')
  hint.pack(side='left',padx=(10,0),anchor='w')
  refs.append((hint,hint_key,'text'))
  return btn

 def open_workbench():webbrowser.open(base)
 def open_data():
  folder.mkdir(parents=True,exist_ok=True)
  if sys.platform=='win32':os.startfile(str(folder))
  else:webbrowser.open(folder.as_uri())
 def open_logs():
  logs.mkdir(parents=True,exist_ok=True)
  if sys.platform=='win32':os.startfile(str(logs))
  else:webbrowser.open(logs.as_uri())
 def import_old():
  source=filedialog.askdirectory(title=t('migrate_pick'))
  if not source:return
  if any(folder.iterdir()):messagebox.showinfo(t('migrate_busy_t'),t('migrate_busy'),parent=root);return
  try:
   if runtime_paths.migrate_legacy_data(source,folder):status.set(t('migrate_ok'))
   else:messagebox.showinfo(t('migrate_none_t'),t('migrate_none'),parent=root)
  except Exception as e:messagebox.showerror(t('migrate_err'),str(e),parent=root)
 def backup_all():
  try:
   if not folder.is_dir() or not any(folder.iterdir()):
    messagebox.showinfo(t('backup_none_t'),t('backup_none'),parent=root);return
   stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M')
   target=filedialog.asksaveasfilename(title=t('backup_pick'),defaultextension='.zip',initialfile='FRAME-data-'+stamp+'.zip',filetypes=[('Zip archive','*.zip')])
   if not target:return
   status.set('…')
   with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
    for path in folder.rglob('*'):
     if path.is_file():z.write(path,path.relative_to(folder.parent))
   status.set(t('backup_done',p=target))
  except Exception as e:
   messagebox.showerror(t('backup_err'),str(e),parent=root)
   status.set('')
 def open_settings():
  win=tk.Toplevel(root);win.title(t('settings_title'));win.geometry('560x340');win.transient(root);win.grab_set();win.resizable(False,False)
  body=ttk.Frame(win,padding=(20,16));body.pack(fill='both',expand=True)
  data_var=tk.StringVar(value=str(runtime_paths.data_dir()))
  export_var=tk.StringVar(value=str(runtime_paths.export_dir() or ''))
  ttk.Label(body,text=t('data_dir_label'),font=('Microsoft YaHei UI',10,'bold')).pack(anchor='w')
  row1=ttk.Frame(body);row1.pack(fill='x',pady=(4,2))
  ttk.Entry(row1,textvariable=data_var,state='readonly').pack(side='left',fill='x',expand=True)
  def pick_data():
   try:initial=str(runtime_paths.data_dir().parent)
   except Exception:initial=None
   chosen=filedialog.askdirectory(title=t('pick_data_dir'),initialdir=initial,parent=win)
   if not chosen:return
   try:runtime_paths.save_settings({'dataDir':chosen})
   except Exception as error:messagebox.showerror(t('migrate_err'),str(error),parent=win);return
   data_var.set(chosen)
   messagebox.showinfo(t('data_changed_t'),t('data_changed',p=chosen),parent=win)
  ttk.Button(row1,text=t('change'),command=pick_data,width=8).pack(side='left',padx=(8,0))
  ttk.Label(body,text=t('data_dir_note'),foreground='#8a9099',wraplength=500,font=('Microsoft YaHei UI',9)).pack(anchor='w',pady=(0,14))
  ttk.Label(body,text=t('export_dir_label'),font=('Microsoft YaHei UI',10,'bold')).pack(anchor='w')
  row2=ttk.Frame(body);row2.pack(fill='x',pady=(4,2))
  ttk.Entry(row2,textvariable=export_var,state='readonly').pack(side='left',fill='x',expand=True)
  def pick_export():
   base=export_var.get() or str(runtime_paths.data_dir().parent)
   chosen=filedialog.askdirectory(title=t('pick_export_dir'),initialdir=base,parent=win)
   if not chosen:return
   try:runtime_paths.save_settings({'exportDir':chosen})
   except Exception as error:messagebox.showerror(t('migrate_err'),str(error),parent=win);return
   export_var.set(chosen)
   messagebox.showinfo(t('saved_t'),t('export_changed',p=chosen),parent=win)
  def clear_export():
   try:runtime_paths.save_settings({'exportDir':''})
   except Exception as error:messagebox.showerror(t('migrate_err'),str(error),parent=win);return
   export_var.set('')
   messagebox.showinfo(t('saved_t'),t('export_cleared'),parent=win)
  ttk.Button(row2,text=t('change'),command=pick_export,width=8).pack(side='left',padx=(8,0))
  ttk.Button(row2,text=t('clear'),command=clear_export,width=6).pack(side='left',padx=(6,0))
  ttk.Label(body,text=t('export_dir_note'),foreground='#8a9099',wraplength=500,font=('Microsoft YaHei UI',9)).pack(anchor='w',pady=(0,14))
  ttk.Button(body,text=t('close'),command=win.destroy,width=10).pack(side='right')
 def exit_app():
  if state['closing']:return
  import task_backend
  # The server module only exists once the launcher reached the import below; asking
  # the manager for it is what keeps the "tasks are running" warning honest.
  module=sys.modules.get('server')
  manager=task_backend.manager(module) if module else None
  if manager and any(r.get('status')=='running' for r in manager.rows):
   if not messagebox.askyesno(t('busy_t'),t('busy'),parent=root):return
  state['closing']=True;status.set(t('closing'));open_button.config(state='disabled')
  def finish():
   service=state['service']
   if service:service.shutdown();service.server_close()
   root.after(0,root.destroy)
  threading.Thread(target=finish,daemon=True).start()

 start_group=group('group_start')
 open_button=action_row(start_group,'open','open_hint',open_workbench,primary=True,width=20)
 data_group=group('group_data')
 data_row=ttk.Frame(data_group);data_row.pack(fill='x',pady=(0,6))
 data_btn=ttk.Button(data_row,text=t('data'),command=open_data,width=16);data_btn.pack(side='left')
 refs.append((data_btn,'data','text'))
 data_hint=ttk.Label(data_row,font=('Microsoft YaHei UI',9),foreground='#8a9099',wraplength=340,justify='left')
 data_hint.pack(side='left',padx=(10,0),anchor='w')
 refs.append((data_hint,'data_hint','text'))
 action_row(data_group,'migrate','migrate_hint',import_old)
 action_row(data_group,'backup','backup_hint',backup_all)
 action_row(data_group,'settings','settings_hint',open_settings)
 maint_group=group('group_maint')
 update_btn=ttk.Button(maint_group,command=lambda:webbrowser.open(base+'/?check-updates=1'),width=16)
 update_btn.pack(side='left',padx=(0,8))
 refs.append((update_btn,'update','text'))
 logs_btn=ttk.Button(maint_group,command=open_logs,width=16);logs_btn.pack(side='left')
 refs.append((logs_btn,'logs','text'))

 footer=ttk.Frame(area);footer.pack(fill='x',pady=(14,0))
 exit_btn=ttk.Button(footer,command=exit_app,width=10);exit_btn.pack(side='right')
 refs.append((exit_btn,'exit','text'))
 ttk.Separator(area).pack(fill='x',pady=(14,10))
 path_hint=ttk.Label(area,foreground='#59616a');path_hint.pack(anchor='w')
 refs.append((path_hint,'path_label','text'))
 path_value=ttk.Label(area,textvariable=path_label,wraplength=505,foreground='#3c4149');path_value.pack(anchor='w')

 def retranslate():
  root.title(t('window'))
  lang_button.config(text=t('lang_button'))
  for widget,key,kind in refs:
   try:widget.config(text=t(key))
   except Exception:pass
  # Status text carries runtime values, so rebuild it instead of translating in place.
  if state.get('started'):
   extra=t('adopted') if state.get('adopted') else ''
   status.set(t('started',base=base,ver=state.get('asset_version',''),extra=extra))
  else:status.set(t('starting'))
 def toggle_language():
  state['lang']='en' if state['lang']=='zh' else 'zh'
  retranslate()
 retranslate()
 root.protocol('WM_DELETE_WINDOW',exit_app);root.update()
 try:
  # Bind before migration, so a running older service prevents competing data writes.
  import server
  service=server.ThreadingHTTPServer(('127.0.0.1',port),server.Handler);service.daemon_threads=True
  state['service']=service
  threading.Thread(target=service.serve_forever,daemon=True).start()
  # A per-release folder beside the EXE is used where it is, so say so instead of
  # claiming a migration that never happened.
  adopted=folder.name!=runtime_paths.DATA_FOLDER
  asset_version=server.asset_version()
  # Show which build of the front-end is being served: "I rebuilt it but still see
  # the old screen" is almost always a stale browser cache, and this makes it visible.
  state['started']=True;state['adopted']=adopted;state['asset_version']=asset_version
  status.set(t('started',base=base,ver=asset_version,extra=t('adopted') if adopted else ''))
  if not no_browser:root.after(350,open_workbench)
 except Exception as e:
  logging.exception('Launcher startup failed')
  if state['service']:state['service'].server_close()
  status.set(t('failed'));open_button.config(state='disabled')
  messagebox.showerror(t('failed_title'),str(e)+'\n\n日志位于：'+str(logs/'launcher.log'),parent=root)
  state['service']=None
 root.mainloop();return 0

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8852);parser.add_argument('--no-browser',action='store_true');parser.add_argument('--self-test',action='store_true');args=parser.parse_args()
 if args.self_test:
  report=os.environ.get('FRAME_SELF_TEST_REPORT')
  try:return self_test(report)
  except Exception as e:
   if report:Path(report).write_text(json.dumps({'ok':False,'error':str(e)}),'utf-8')
   return 1
 return launch(args.port,args.no_browser)
if __name__=='__main__':raise SystemExit(main())
