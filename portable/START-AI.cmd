@echo off
setlocal
set "OLLAMA_ORIGINS=null"
set "AI_EXE="
for /f "delims=" %%i in ('where ollama 2^>nul') do if not defined AI_EXE set "AI_EXE=%%i"
if not defined AI_EXE if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set "AI_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
if not defined AI_EXE (
  echo Ollama is not installed. Install it from https://ollama.com/download/windows
  echo Then run this file again. No API key is required.
  pause
  exit /b 1
)
echo Close Ollama from the Windows system tray first if it is already running.
echo This window starts a local AI server for the portable HTML app.
echo Keep it open while using AI. Close it to stop the server.
echo No global environment settings or browser security settings are changed.
pause
"%AI_EXE%" serve
if errorlevel 1 (
  echo If port 11434 is busy, close the existing Ollama tray app and try again.
  pause
)
endlocal
