"""Windows CF_HDROP copy for actual reusable media files, not an internal ID."""
import ctypes,os,struct,time

def payload(path):
 return struct.pack('<IiiII',20,0,0,0,1)+(str(path)+'\0\0').encode('utf-16-le')

def copy_file(data,ident):
 import creative_library
 row=next((r for r in creative_library._store(data)['items'] if r['id']==ident and not r.get('deleted')),None)
 if not row or not row.get('mediaFile'):raise ValueError('素材文件不存在')
 path=(data/'asset-library-media'/row['mediaFile']).resolve()
 if path.parent!=(data/'asset-library-media').resolve() or not path.is_file():raise ValueError('素材文件缺失')
 if os.name!='nt':raise ValueError('系统文件剪贴板仅支持 Windows；请使用媒体下载')
 user=ctypes.windll.user32;kernel=ctypes.windll.kernel32
 user.CreateWindowExW.argtypes=[ctypes.c_ulong,ctypes.c_wchar_p,ctypes.c_wchar_p,ctypes.c_ulong,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p];user.CreateWindowExW.restype=ctypes.c_void_p
 user.OpenClipboard.argtypes=[ctypes.c_void_p];user.DestroyWindow.argtypes=[ctypes.c_void_p]
 kernel.GlobalAlloc.argtypes=[ctypes.c_uint,ctypes.c_size_t];kernel.GlobalAlloc.restype=ctypes.c_void_p
 kernel.GlobalLock.argtypes=[ctypes.c_void_p];kernel.GlobalLock.restype=ctypes.c_void_p
 kernel.GlobalUnlock.argtypes=[ctypes.c_void_p];kernel.GlobalFree.argtypes=[ctypes.c_void_p]
 user.SetClipboardData.argtypes=[ctypes.c_uint,ctypes.c_void_p];user.SetClipboardData.restype=ctypes.c_void_p
 block=payload(path);handle=kernel.GlobalAlloc(0x0042,len(block))
 if not handle:raise ValueError('无法分配剪贴板内存')
 ptr=kernel.GlobalLock(handle)
 if not ptr:kernel.GlobalFree(handle);raise ValueError('无法锁定剪贴板内存')
 ctypes.memmove(ptr,block,len(block));kernel.GlobalUnlock(handle)
 opened=False;transferred=False;owner=user.CreateWindowExW(0,'STATIC','FRAME Clipboard',0,0,0,0,0,None,None,None,None)
 try:
  if not owner:raise ValueError('无法创建剪贴板所有者窗口')
  for _ in range(10):
   if user.OpenClipboard(owner):opened=True;break
   time.sleep(.025)
  if not opened:raise ValueError('剪贴板正被占用，请重试')
  if not user.EmptyClipboard() or not user.SetClipboardData(15,handle):raise ValueError('写入系统文件剪贴板失败')
  transferred=True
 finally:
  if opened:user.CloseClipboard()
  if not transferred:kernel.GlobalFree(handle)
  if owner:user.DestroyWindow(owner)
 return {'ok':True,'format':'CF_HDROP','name':row['title']}
