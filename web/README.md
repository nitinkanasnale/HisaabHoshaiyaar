# Hisaab Hoshiyaar — Web and API

React dashboard and Express API with MongoDB Atlas persistence.

From this directory:

```cmd
copy .env.example .env
npm ci
npm run dev
```

Set `MONGODB_URI` and a random `JWT_SECRET` in `.env` before startup. Open `http://127.0.0.1:5173`; backend status is available at `http://127.0.0.1:5000/api/status`.

Use `npm run dev:server` to run just the API for the Android app. Use `npm test` for the calculation/API/React tests and `npm run build` for the web production build.

See the [project README](../README.md) for features, environment settings, business rules, mobile setup, testing, and deployment. See [API reference](docs/API.md) for routes.
