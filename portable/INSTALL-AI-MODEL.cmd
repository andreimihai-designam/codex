@echo off
setlocal
set "AI_EXE="
for /f "delims=" %%i in ('where ollama 2^>nul') do if not defined AI_EXE set "AI_EXE=%%i"
if not defined AI_EXE if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set "AI_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
if not defined AI_EXE (
  echo Install Ollama from https://ollama.com/download/windows first.
  pause
  exit /b 1
)
echo Start START-AI.cmd in another window first.
echo This downloads qwen2.5:3b from the official Ollama registry.
echo Internet is needed for this one-time model download. Disk space and RAM are required.
pause
"%AI_EXE%" pull qwen2.5:3b
if errorlevel 1 (
  echo Model installation failed. Check the Ollama server, Internet and available disk space.
) else (
  echo Model is ready. Open the application, choose Asistent AI and verify the models.
)
pause
endlocal
