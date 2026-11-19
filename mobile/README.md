# Hisaab Hoshiyaar — Android

Native Flutter client for the Express API. Login sessions are stored using Android secure storage. Business records are stored by the backend in MongoDB Atlas.

## Run

Start the API from `../web` with `npm run dev:server`, connect an authorized USB-debugging phone, then run:

```cmd
adb devices
adb reverse tcp:5000 tcp:5000
flutter pub get
flutter run -d YOUR_DEVICE_ID --debug --dart-define=API_URL=http://127.0.0.1:5000/api
```

For the Windows helper:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\run-oppo.ps1
```

Optional parameters:

```powershell
.\run-oppo.ps1 -DeviceId YOUR_DEVICE_ID -FlutterSdk 'D:\flutter_windows_3.50.0-stable\flutter' -AndroidSdk "$env:LOCALAPPDATA\Android\Sdk" -JavaHome 'C:\Program Files\Android\Android Studio\jbr'
```

Set `FLUTTER_ROOT`, `ANDROID_HOME`/`ANDROID_SDK_ROOT`, or `JAVA_HOME`, or put Flutter and ADB on PATH. The helper also checks the known D-drive Flutter/platform-tools locations. An invalid or missing tool path produces an explicit error.

## Build and install

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build-apk.ps1 -Install
```

This produces an ARM64 debug APK, installs it on a single authorized device, forwards the API port, and launches the app. The backend must remain running. No emulator is needed.

## Check

```cmd
flutter analyze lib test
flutter test
```

See the [project README](../README.md) for architecture, financial rules, integrations, deployment, and current limitations. The mobile interface currently omits web CSV export, translations, reset-link deep linking, and advanced seasonal controls. Cash Overview does not yet display a safety-reserve card; the configured reserve is used by the health calculation.
