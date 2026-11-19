function Set-HisaabToolchain {
    param([string]$FlutterSdk, [string]$AndroidSdk, [string]$JavaHome)
    if (-not $FlutterSdk) { $FlutterSdk = $env:FLUTTER_ROOT }
    $flutterCommand = Get-Command flutter.bat -ErrorAction SilentlyContinue
    if (-not $FlutterSdk -and $flutterCommand) { $FlutterSdk = Split-Path (Split-Path $flutterCommand.Source -Parent) -Parent }
    if (-not $FlutterSdk -and (Test-Path -LiteralPath 'D:\flutter_windows_3.50.0-stable\flutter\bin\flutter.bat')) { $FlutterSdk = 'D:\flutter_windows_3.50.0-stable\flutter' }
    if (-not $FlutterSdk -or -not (Test-Path -LiteralPath (Join-Path $FlutterSdk 'bin\flutter.bat'))) { throw 'Flutter not found. Set FLUTTER_ROOT, add Flutter to PATH, or pass -FlutterSdk.' }

    if (-not $AndroidSdk) { $AndroidSdk = $env:ANDROID_HOME }
    if (-not $AndroidSdk) { $AndroidSdk = $env:ANDROID_SDK_ROOT }
    if (-not $AndroidSdk) { $AndroidSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
    if (-not (Test-Path -LiteralPath $AndroidSdk)) { throw 'Android SDK not found. Set ANDROID_HOME or pass -AndroidSdk.' }
    $env:ANDROID_HOME = $AndroidSdk

    if (-not $JavaHome) {
        $studioJava = Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'
        if (Test-Path -LiteralPath (Join-Path $studioJava 'bin\java.exe')) { $JavaHome = $studioJava }
        else { $JavaHome = $env:JAVA_HOME }
    }
    if (-not $JavaHome -or -not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin\java.exe'))) { throw 'Java not found. Set JAVA_HOME or pass -JavaHome.' }
    $env:JAVA_HOME = $JavaHome
    $env:FLUTTER_ROOT = $FlutterSdk
    if (-not $env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME = Join-Path $env:LOCALAPPDATA 'HisaabHoshiyaar\gradle' }

    $adb = Join-Path $AndroidSdk 'platform-tools\adb.exe'
    if (-not (Test-Path -LiteralPath $adb)) {
        $adbCommand = Get-Command adb.exe -ErrorAction SilentlyContinue
        if ($adbCommand) { $adb = $adbCommand.Source }
        elseif (Test-Path -LiteralPath 'D:\platform-tools-latest-windows\platform-tools\adb.exe') { $adb = 'D:\platform-tools-latest-windows\platform-tools\adb.exe' }
        else { throw 'ADB not found. Install Android platform-tools.' }
    }
    return @{ Flutter = (Join-Path $FlutterSdk 'bin\flutter.bat'); Adb = $adb }
}

function Get-HisaabDevice {
    param([string]$Adb, [string]$DeviceId)
    if ($DeviceId) { return $DeviceId }
    $devices = @(& $Adb devices | Select-String '^\S+\s+device$' | ForEach-Object { ($_.Line -split '\s+')[0] })
    if ($devices.Count -ne 1) { throw 'Connect one authorized Android device, or pass -DeviceId. Unlock the phone and accept USB debugging.' }
    return $devices[0]
}
