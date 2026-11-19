# Hisaab Hoshiyaar

**Because Every Rupee Has a Tomorrow.**

Hisaab Hoshiyaar helps small businesses track money in and out, manage customer dues, forecast cash shortages, and compare financial decisions. It includes a native Flutter Android app and a React web dashboard backed by Express and MongoDB Atlas.

## Features

- Business registration, login, password change, and email-based password recovery.
- Opening balance and current cash reconciliation.
- Income and expense transactions with Expected, Overdue, and Settled statuses.
- Customer contacts, payment-delay history, and outstanding receivables.
- Eight-week cash-flow forecasts and shortage detection.
- What-if simulations for delayed collections, postponed payments, reduced sales, and unexpected expenses.
- Comparison of earlier invoice collection, supplier deferral, and short-term financing scenarios.
- Business health score with six weighted indicators.
- Monthly seasonal projections combining historical estimates and scheduled pending payments.
- WhatsApp reminder drafts and optional email/SMS delivery.
- Ollie, an account-scoped financial assistant with a built-in advisor and optional Anthropic integration.

The web dashboard also provides transaction CSV export, additional filters, selectable seasonal controls, and English/Hindi/Kannada navigation. The Android interface is English and optimized for phone workflows.

## Architecture

```text
Flutter Android app ──┐
                     ├── Express REST API ── Mongoose ── MongoDB Atlas
React web dashboard ─┘
```

Both clients use the same accounts and records. The native app uses Flutter widgets and calls the API directly.

| Layer | Technologies |
|---|---|
| Android | Flutter, Dart, Android secure storage |
| Web | React, Vite, Tailwind CSS, Recharts |
| Backend | Node.js, Express, Mongoose, Zod |
| Database | MongoDB Atlas |
| Authentication | JWT, bcrypt, HttpOnly cookies; encrypted mobile session storage |
| Testing | Node test runner, Supertest, Vitest, Testing Library, Flutter Test |

## Project structure

```text
Hisaab-Hoshiyaar/
├── web/
│   ├── client/src/          React screens and reusable components
│   ├── server/src/          Express APIs, models, authentication, calculations
│   ├── server/test/         Calculation and API tests
│   ├── scripts/             Optional data-import utilities
│   ├── docs/API.md          REST endpoint reference
│   ├── .env.example         Backend configuration template
│   └── package.json
├── mobile/
│   ├── lib/main.dart        Application entry point and session routing
│   ├── lib/api.dart         HTTP client and secure session handling
│   ├── lib/screens/         Authentication and business screens
│   ├── lib/widgets.dart     Forms, cards, and charts
│   ├── android/             Android permissions and Gradle configuration
│   ├── test/                Native-client automated tests
│   ├── run-oppo.ps1         USB run helper for physical Android devices
│   └── build-apk.ps1        APK build and optional installation helper
└── README.md
```

## Requirements

- Node.js 22.13 or later and npm.
- A MongoDB Atlas connection string.
- For Android: Flutter 3.50.0 / Dart 3.14.0, Android SDK Platform 36, NDK **28.2.13676358**, and a compatible Java installation. The tested setup uses Android Studio's bundled JBR with Gradle 9.5.0.
- An Android phone with USB debugging enabled. No emulator is required.

## Run the web application on Windows

Open CMD in the repository folder:

```cmd
cd web
copy .env.example .env
```

Edit `.env` and set:

```dotenv
PORT=5000
MONGODB_URI=mongodb+srv://USER:URL_ENCODED_PASSWORD@CLUSTER.mongodb.net/hisaab_hoshiyaar?retryWrites=true&w=majority
JWT_SECRET=REPLACE_WITH_A_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS
CLIENT_ORIGIN=http://127.0.0.1:5173
APP_URL=http://127.0.0.1:5173
NODE_ENV=development
```

Generate a secret locally:

```cmd
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Check backend/database availability at **http://127.0.0.1:5000/api/status**. Keep the terminal running. In PowerShell, `npm.cmd` can be used in place of `npm`.

In Atlas, create a database user, allow your development machine's IP, and include `hisaab_hoshiyaar` in the connection URL. URL-encode special characters in the database password. Register a new account after startup; no accounts or business records are preloaded.

## Run on an Android phone through USB

Keep the backend running in one CMD window:

```cmd
cd web
npm run dev:server
```

If `npm run dev` is already running, its backend is sufficient.

Connect the unlocked phone using a data cable, enable USB debugging, and accept the authorization prompt. In another CMD window, from the repository root:

```cmd
adb devices
adb reverse tcp:5000 tcp:5000
cd mobile
flutter pub get
flutter run -d YOUR_DEVICE_ID --debug --dart-define=API_URL=http://127.0.0.1:5000/api
```

Replace `YOUR_DEVICE_ID` with the identifier listed by `adb devices`. ADB and Flutter must be on PATH, or use their full executable paths. The development server remains on the laptop; USB forwarding allows the Android app to reach it. Repeat `adb reverse` after reconnecting USB.

Alternatively, use the PowerShell helper, which checks the backend, detects one authorized device, forwards the port, and launches Flutter:

```powershell
cd mobile
powershell -NoProfile -ExecutionPolicy Bypass -File .\run-oppo.ps1
```

The helpers resolve tool paths from parameters, environment variables, PATH, and standard installation locations. See [Android setup](mobile/README.md) for configuration options.

## Build an APK

```cmd
cd mobile
flutter build apk --debug --target-platform android-arm64 --dart-define=API_URL=http://127.0.0.1:5000/api
```

The APK is generated at `mobile/build/app/outputs/flutter-apk/app-debug.apk`. This debug build supports localhost HTTP for USB development. For independent use away from the laptop, deploy the backend over HTTPS and supply its `/api` URL through `API_URL` when building. A public release needs your own Android signing configuration; the checked-in release configuration currently uses the debug key for local testing.

Gradle uses one worker, disables parallel execution, and limits its Java heap to 1536 MB to reduce memory pressure.

## Financial rules

- **Current cash** = opening balance + settled income − settled expenses.
- **Expected/Overdue payments** affect projections, not current cash.
- **Forecast timing** uses due date plus expected delay.
- **Next shortage** is the first weekly projected balance below zero.
- **Safety limit** is a reserve threshold and does not alter cash.
- **Customer outstanding** includes linked pending incoming payments.
- **Simulations** return calculated scenarios without saving transactions.
- **Seasonal totals** add dated pending cash flows to the historical seasonal baseline. Pending amounts are not multiplied by seasonal uplift. Short histories are explicitly labeled.
- **Seasonal history** currently groups settled records by due date; actual settlement-date grouping is a future improvement. Records with future due dates do not contribute to historical estimates yet.
- **Health score** combines liquidity buffer (20), shortage risk (20), collections quality (20), obligation coverage (15), cash trend (10), and margin (15). The margin indicator uses recorded transaction totals and is not a full accounting profit calculation.

Amounts use whole currency units. Changing currency changes display formatting; it does not convert amounts.

## Optional integrations

Configure only the services you need in `web/.env`:

| Capability | Variables |
|---|---|
| Email reminders and recovery | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` |
| SMS reminders | `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM` |
| Optional cloud advisor | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |

WhatsApp opens a draft that the user sends externally; the app does not confirm WhatsApp delivery. Email/SMS report an error when their delivery provider is unconfigured. Without Anthropic credentials, Ollie uses the built-in advisor. Enabling the cloud advisor sends the signed-in account's relevant financial context to that provider when asking a question.

## Tests and production build

```cmd
cd web
npm test
npm run build
```

The validated web/backend suite contains **31 tests**. API tests use a disposable local MongoDB process; the first run may download its test binary. They do not require Atlas business data.

```cmd
cd mobile
flutter analyze lib test
flutter test
```

The native client has **5 automated tests** covering login, forecast display, errors/retry, currency formatting, and session persistence/invalidation. The Android debug APK has also been built and run on an OPPO CPH2667 physical device.

## Security and deployment

Backend credentials belong only in `web/.env` or your deployment's environment configuration. Never put MongoDB credentials or the JWT signing secret in Flutter assets or `VITE_*` variables. All business queries are scoped to the authenticated account. Passwords are hashed, requests are validated, and sensitive authentication endpoints are rate-limited.

For HTTPS deployment, set `NODE_ENV=production`, `APP_URL`, and `CLIENT_ORIGIN` to the deployed origin. Run `npm run build` followed by `npm start` in `web/` to serve the built dashboard and API together. If the clients use different hosts, configure the reverse proxy and origins accordingly. The repository excludes real environment files, private database exports, build artifacts, dependency caches, and APKs.

See [REST API reference](web/docs/API.md) for endpoint details.
