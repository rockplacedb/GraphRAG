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
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$node = 'C:\Users\이종정\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
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
