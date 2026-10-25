@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 server.py --port 8828
) else (
  python server.py --port 8828
)
if errorlevel 1 (
  echo Please install Python 3.10 or newer, then try again.
  pause
)
