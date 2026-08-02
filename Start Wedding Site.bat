@echo off
setlocal EnableExtensions
REM Double-click launcher for Windows.

cd /d "%~dp0"
set "ROOT=%cd%"
set "TOOLS=%ROOT%\.tools"
set "NODE_VERSION=20.18.1"
if not exist "%TOOLS%" mkdir "%TOOLS%"

echo.
echo   ♡  Kazimir ^& Megan — wedding site launcher

where node >nul 2>&1
if %ERRORLEVEL%==0 (
  for /f "delims=" %%V in ('node -p "process.versions.node.split('.')[0]" 2^>nul') do set "NODE_MAJOR=%%V"
)
if defined NODE_MAJOR if %NODE_MAJOR% GEQ 18 goto HAVE_NODE

echo   … Borrowing a little toolkit for this computer (one-time setup)
set "DIST=node-v%NODE_VERSION%-win-x64"
set "NODE_DIR=%TOOLS%\%DIST%"
set "NODE_EXE=%NODE_DIR%\node.exe"
if exist "%NODE_EXE%" goto ADD_PORTABLE

set "ZIP=%TOOLS%\%DIST%.zip"
set "URL=https://nodejs.org/dist/v%NODE_VERSION%/%DIST%.zip"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { Invoke-WebRequest -Uri '%URL%' -OutFile '%ZIP%' -UseBasicParsing } catch { exit 1 }" >nul
if errorlevel 1 (
  echo   Couldn't download the toolkit. Install Node.js from https://nodejs.org and try again.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Expand-Archive -Path '%ZIP%' -DestinationPath '%TOOLS%' -Force" >nul
del /f /q "%ZIP%" >nul 2>&1
echo   ✓ Toolkit ready

:ADD_PORTABLE
set "PATH=%NODE_DIR%;%PATH%"

:HAVE_NODE
where node >nul 2>&1
if errorlevel 1 (
  echo   We still couldn't find Node.js. Install it from https://nodejs.org and try again.
  pause
  exit /b 1
)

node "%ROOT%\scripts\start-local.mjs"
set "EC=%ERRORLEVEL%"
if not "%EC%"=="0" (
  echo.
  echo   Something didn't work. See the message above.
  pause
)
exit /b %EC%
