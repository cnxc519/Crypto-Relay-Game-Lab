@echo off
cd /d "%~dp0"

where py >nul 2>nul
if not errorlevel 1 (
  py -3 "%~dp0start_app.py"
  if errorlevel 1 goto :error
  goto :eof
)

where python >nul 2>nul
if not errorlevel 1 (
  python "%~dp0start_app.py"
  if errorlevel 1 goto :error
  goto :eof
)

echo Python was not found. Please install Python or add it to PATH.
pause

goto :eof

:error
echo.
echo BTC Replay Lab failed to start. The error message above should explain why.
pause
