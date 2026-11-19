param([string]$DeviceId, [string]$FlutterSdk, [string]$AndroidSdk, [string]$JavaHome)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
. (Join-Path $PSScriptRoot 'toolchain.ps1')
$tools = Set-HisaabToolchain -FlutterSdk $FlutterSdk -AndroidSdk $AndroidSdk -JavaHome $JavaHome
$DeviceId = Get-HisaabDevice -Adb $tools.Adb -DeviceId $DeviceId
try { $health = Invoke-RestMethod 'http://127.0.0.1:5000/api/status' -TimeoutSec 5 } catch { throw 'Start the backend in ../web using npm run dev:server, then retry.' }
if (-not $health.database_connected) { throw 'The backend has no MongoDB connection.' }
& $tools.Adb -s $DeviceId reverse tcp:5000 tcp:5000
if ($LASTEXITCODE -ne 0) { throw 'USB port forwarding failed.' }
& $tools.Flutter pub get
if ($LASTEXITCODE -ne 0) { throw 'Flutter packages failed to install.' }
& $tools.Flutter run -d $DeviceId --debug --dart-define=API_URL=http://127.0.0.1:5000/api
if ($LASTEXITCODE -ne 0) { throw 'Flutter run failed. Review the build error above.' }
