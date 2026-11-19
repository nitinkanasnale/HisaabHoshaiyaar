@echo off
cd /d "%~dp0"
if not exist .env (
  copy .env.example .env >nul
  echo Configure MONGODB_URI and JWT_SECRET in .env, then run start.bat again.
  notepad .env
  exit /b 1
)
if not exist node_modules call npm.cmd ci
if errorlevel 1 exit /b 1
call npm.cmd run dev
