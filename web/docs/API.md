# REST API

Base `/api`. JSON requests, same-origin HttpOnly JWT cookie (or Authorization Bearer for programmatic clients). Owner is always taken from verified JWT. Caller-provided IDs/headers cannot choose another account. Validation errors: 400, authentication: 401, foreign origin: 403, missing owned record: 404, conflict: 409, unconfigured delivery: 503. No financial-route mock fallback.

| Method | Path | Purpose |
|---|---|---|
| GET | /status, /health | Public process/database health |
| POST | /auth/register | name, email, password, biz_name, optional business profile |
| POST | /auth/login | email, password; sets 8-hour cookie |
| GET | /auth/me | Current public user profile |
| POST | /auth/logout | Revoke account's sessions and clear cookie |
| POST | /auth/forgot-password | email; send reset link if configured |
| POST | /auth/reset-password | token, new_password; revoke old sessions |
| POST | /auth/change-password | current_password, new_password |
| GET | /users | Current user only |
| GET | /users/by-email/:email | Current user only |
| POST | /users | name, biz_name, optional biz_type/biz_size/country/currency/safetyLimit |
| GET | /balance | Reconciled balance and opening_balance |
| POST/PUT | /balance | balance (opening balance, integer) |
| GET | /overview | Cash, totals, metrics, upcoming records, 9 weekly values |
| GET | /transactions | Optional q, dir, status filters |
| POST | /transactions | name, type, dir, amount, dueDate; optional delay, cust, status, method, note |
| PUT | /transactions/:id | Complete editable transaction fields |
| PUT | /transactions/:id/status | status: expected / settled / overdue |
| DELETE | /transactions/:id | Remove owned transaction |
| GET/POST | /customers | List or create (name, email, phone, history array) |
| PUT/DELETE | /customers/:id | Update or delete; linked transactions prevent delete |
| GET | /customers/behaviour | Delay, trend, status, on-time and receivable stats |
| POST | /scenario/simulate | delay_tx, delay_days, supplier_tx, supplier_shift, sales_pct, expense_amount, expense_day, pred |
| GET | /fixes | Three variants, eligible flags, b/m results, best_index |
| GET | /health-score | Score, six components, recommendations |
| GET | /forecast/seasonal | months 1–24, uplift 0–3; object with forecast, history, insufficientData, message |
| GET | /db/status | Connection state and current owner's counts |
| GET/DELETE | /reminders | List or clear own communication log |
| POST | /reminders | customer_id, channel (email/sms/whatsapp), message |
| POST | /chat | message, optional last eight history entries ({role,content}); reply, source |

Transactions use positive integer amounts up to 1e12, `dir` in/out, ISO `dueDate` YYYY-MM-DD, nonnegative integer delay. Types: customer, supplier, expense, payroll, loan, tax, sales, other. Empty accounts return empty arrays/zero totals. No API allows reading password hashes or secrets.
