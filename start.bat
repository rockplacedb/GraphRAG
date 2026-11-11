@echo off
rem 모두몰 지식 그래프 학습 대시보드 — 로컬 실행 스크립트 (Windows)
rem 브라우저를 열고 정적 서버를 띄웁니다. ES 모듈 때문에 file:// 로는 동작하지 않습니다.
setlocal
cd /d "%~dp0"

set PORT=4321
if not "%~1"=="" set PORT=%~1

where node >nul 2>nul
if %errorlevel%==0 (
  echo [start] http://127.0.0.1:%PORT%/  ^(Node.js^)
  start "" /b cmd /c "timeout /t 2 >nul & start http://127.0.0.1:%PORT%/"
  node scripts\serve.mjs %PORT%
  goto :end
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo [start] http://127.0.0.1:%PORT%/  ^(Python^)
  start "" /b cmd /c "timeout /t 2 >nul & start http://127.0.0.1:%PORT%/"
  python -m http.server %PORT% --bind 127.0.0.1
  goto :end
)

echo.
echo [오류] Node.js 또는 Python 3가 필요합니다.
echo   - Node.js: https://nodejs.org/
echo   - 또는 사내 정적 서버에 이 폴더를 그대로 올리세요.
echo.
pause

:end
