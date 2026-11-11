# qa/run.ps1 — 헤드리스 Chrome을 띄우고 CDP 기반 QA를 실행한 뒤 프로세스 트리만 정리한다.
# (사용자의 다른 Chrome 창은 건드리지 않는다: taskkill /T 로 이 프로세스의 자식만 종료)
param(
  [switch]$Shots,
  [switch]$Full,
  [string]$Routes = '',
  [string]$Theme = '',
  [int]$Width = 1440,
  [int]$Height = 1000
)

$ErrorActionPreference = 'Stop'
$qaDir = $PSScriptRoot
$root = Split-Path -Parent $qaDir

# Chrome/Edge: 설치 경로 후보를 순서대로 확인
$chrome = @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
  'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) {
  Write-Host 'Chrome 또는 Edge를 찾지 못했습니다. 설치 후 다시 실행하세요.'
  exit 4
}

# Node: NODE_EXE 환경변수 우선, 없으면 PATH에서 탐색 (사용자 경로 하드코딩 금지)
$node = if ($env:NODE_EXE -and (Test-Path $env:NODE_EXE)) { $env:NODE_EXE } else { (Get-Command node -ErrorAction SilentlyContinue).Source }
if (-not $node) {
  Write-Host 'Node.js가 필요합니다. https://nodejs.org/ 에서 설치하거나 PATH에 추가하세요.'
  exit 4
}

$profile = Join-Path $qaDir '.chrome-profile'

$chromeArgs = @(
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--disable-crash-reporter', '--disable-breakpad', '--disable-extensions',
  '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9222',
  "--user-data-dir=$profile",
  '--window-size=1440,1000',
  'about:blank'
)

$proc = Start-Process -FilePath $chrome -ArgumentList $chromeArgs -PassThru -WindowStyle Hidden
$up = $false
$deadline = (Get-Date).AddSeconds(25)
while (-not $up -and (Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 350
  try {
    $null = Invoke-RestMethod -Uri 'http://127.0.0.1:9222/json/version' -TimeoutSec 2
    $up = $true
  } catch { $up = $false }
}
if (-not $up) {
  Write-Host 'Chrome CDP 기동 실패'
  if ($proc) { & taskkill /PID $proc.Id /T /F 2>$null | Out-Null }
  exit 3
}

$qaArgs = @((Join-Path $root 'scripts\qa.mjs'), '--width', $Width, '--height', $Height)
if ($Shots) { $qaArgs += '--shots' }
if ($Full) { $qaArgs += '--full' }
if ($Theme) { $qaArgs += @('--theme', $Theme) }
if ($Routes) { $qaArgs += @('--routes', $Routes) }

& $node @qaArgs
$code = $LASTEXITCODE

if ($proc) { & taskkill /PID $proc.Id /T /F 2>$null | Out-Null }
exit $code
