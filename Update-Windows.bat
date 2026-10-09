@echo off
cd /d "%~dp0"
set "FRAME_UPDATE_PACKAGE=%~1"
if not defined FRAME_UPDATE_PACKAGE (
  echo Drag the downloaded FRAME ZIP onto Update-Windows.bat.
  echo Close the workbench server before updating.
  pause
  exit /b 1
)
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 update_workbench.py "%FRAME_UPDATE_PACKAGE%"
) else (
  python update_workbench.py "%FRAME_UPDATE_PACKAGE%"
)
if errorlevel 1 (
  echo Update did not complete. Read the message above.
)
pause
