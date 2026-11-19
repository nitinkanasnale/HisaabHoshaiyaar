param([switch]$Install, [string]$DeviceId, [string]$FlutterSdk, [string]$AndroidSdk, [string]$JavaHome)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
. (Join-Path $PSScriptRoot 'toolchain.ps1')
$tools = Set-HisaabToolchain -FlutterSdk $FlutterSdk -AndroidSdk $AndroidSdk -JavaHome $JavaHome
& $tools.Flutter build apk --debug --target-platform android-arm64 --dart-define=API_URL=http://127.0.0.1:5000/api
if ($LASTEXITCODE -ne 0) { throw 'Android build failed. Review the build error above.' }
$apk = Join-Path $PSScriptRoot 'build\app\outputs\flutter-apk\app-debug.apk'
Write-Host "APK ready: $apk"
if ($Install) {
    $DeviceId = Get-HisaabDevice -Adb $tools.Adb -DeviceId $DeviceId
    & $tools.Adb -s $DeviceId install -r $apk
    if ($LASTEXITCODE -ne 0) { throw 'Installation failed. Unlock the phone and accept its installation prompt.' }
    & $tools.Adb -s $DeviceId reverse tcp:5000 tcp:5000
    if ($LASTEXITCODE -ne 0) { throw 'USB forwarding failed.' }
    & $tools.Adb -s $DeviceId shell am start -n com.hisaabhoshiyaar.hisaab_hoshiyaar_mobile/.MainActivity
    if ($LASTEXITCODE -ne 0) { throw 'Could not launch the installed app.' }
}
