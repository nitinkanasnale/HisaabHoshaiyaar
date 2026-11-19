import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { createHash } from "node:crypto";
import { today } from "../src/services/analytics.js";
process.env.JWT_SECRET =
  "test-only-secret-which-is-longer-than-thirty-two-characters";
const { app } = await import("../src/app.js");
const { User, Transaction } = await import("../src/models.js");
let mongo, a, b, cid, tid;
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await User.init();
  a = request.agent(app);
  b = request.agent(app);
});
after(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
const account = (email) => ({
  name: "Test Owner",
  email,
  password: "Correct123!",
  biz_name: "Real Test Business",
});
const bill = {
  name: "Invoice",
  type: "customer",
  dir: "in",
  amount: 50000,
  dueDate: "2026-11-17",
  delay: 0,
  status: "settled",
  method: "UPI",
};
test("authentication, cookie protection, empty accounts, duplicate and invalid registration", async () => {
  assert.equal((await a.get("/api/overview")).status, 401);
  let r = await a.post("/api/auth/register").send(account("one@example.com"));
  assert.equal(r.status, 201);
  assert.equal(r.body.user.passwordHash, undefined);
  assert.match(r.headers["set-cookie"][0], /HttpOnly/);
  assert.equal((await a.get("/api/transactions")).body.length, 0);
  assert.equal(
    (await b.post("/api/auth/register").send(account("two@example.com")))
      .status,
    201,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/auth/register")
        .send(account("one@example.com"))
    ).status,
    409,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/auth/register")
        .send({ ...account("bad@example.com"), password: "tiny" })
    ).status,
    400,
  );
  const u = await User.findOne({ email: "one@example.com" }).select(
    "+passwordHash",
  );
  assert.match(u.passwordHash, /^\$2[aby]\$/);
});
test("real CRUD, exact reconciliation, status reversals and customer ownership", async () => {
  let r = await a.post("/api/customers").send({
    name: "Customer A",
    email: "customer@example.com",
    phone: "+919800000001",
    history: [0, 4, 10],
  });
  assert.equal(r.status, 201);
  cid = r.body.id;
  r = await a.post("/api/transactions").send({ ...bill, cust: cid });
  assert.equal(r.status, 201);
  tid = r.body.id;
  assert.equal(
    (await b.post("/api/transactions").send({ ...bill, cust: cid })).status,
    400,
  );
  assert.equal(
    (await a.post("/api/balance").send({ balance: 100000 })).status,
    200,
  );
  let o = (await a.get("/api/overview")).body;
  assert.equal(o.cash_balance, 150000);
  assert.equal(o.weekly_balances[0], 150000);
  await a
    .put("/api/transactions/" + tid + "/status")
    .send({ status: "expected" });
  o = (await a.get("/api/overview")).body;
  assert.equal(o.cash_balance, 100000);
  assert.equal(o.totals.expected_inflows, 50000);
  r = await a
    .put("/api/transactions/" + tid)
    .send({ ...bill, cust: cid, amount: 60000 });
  assert.equal(r.status, 200);
  assert.equal((await a.get("/api/overview")).body.cash_balance, 160000);
  assert.equal((await a.delete("/api/customers/" + cid)).status, 409);
});
test("all data operations enforce ownership even with spoofed headers or body", async () => {
  assert.equal(
    (await b.get("/api/transactions").set("X-User-Id", "one@example.com")).body
      .length,
    0,
  );
  assert.equal(
    (await b.put("/api/transactions/" + tid).send(bill)).status,
    404,
  );
  assert.equal(
    (
      await b
        .put("/api/transactions/" + tid + "/status")
        .send({ status: "settled" })
    ).status,
    404,
  );
  assert.equal((await b.delete("/api/transactions/" + tid)).status, 404);
  assert.equal(
    (await b.get("/api/users/by-email/one@example.com")).status,
    404,
  );
  assert.equal(
    (
      await b
        .post("/api/reminders")
        .send({ customer_id: cid, channel: "whatsapp", message: "Hello" })
    ).status,
    404,
  );
  assert.equal(
    (
      await b
        .post("/api/scenario/simulate")
        .send({ user_id: "one@example.com" })
    ).body.baseline[0],
    0,
  );
});
test("validation prevents invalid amounts dates statuses selectors and cross-site writes", async () => {
  for (const extra of [
    { amount: -1 },
    { amount: 1.5 },
    { dueDate: "2026-02-30" },
    { status: "hacked" },
    { amount: { $gt: 0 } },
  ])
    assert.equal(
      (await a.post("/api/transactions").send({ ...bill, ...extra })).status,
      400,
    );
  assert.equal((await a.delete("/api/transactions/not-an-id")).status, 400);
  assert.equal(
    (await a.post("/api/scenario/simulate").send({ sales_pct: 101 })).status,
    400,
  );
  assert.equal((await a.get("/api/forecast/seasonal?months=999")).status, 400);
  assert.equal(
    (
      await a
        .post("/api/balance")
        .set("Origin", "https://evil.example")
        .send({ balance: 0 })
    ).status,
    403,
  );
});
test("analytics integration, simulations remain nonpersistent, all advisor branches use this account", async () => {
  const before = await Transaction.find({}).lean();
  for (const url of [
    "/api/overview",
    "/api/balance",
    "/api/customers/behaviour",
    "/api/health-score",
    "/api/fixes",
    "/api/forecast/seasonal",
    "/api/db/status",
  ])
    assert.equal((await a.get(url)).status, 200, url);
  const s = await a
    .post("/api/scenario/simulate")
    .send({ expense_amount: 999999, expense_day: 7 });
  assert.equal(s.status, 200);
  assert.equal(s.body.modified[8], s.body.baseline[8] - 999999);
  assert.equal(s.body.fixes.length, 3);
  assert.deepEqual(await Transaction.find({}).lean(), before);
  for (const message of [
    "Cash shortage",
    "Late customers",
    "Health score",
    "Fix payroll",
    "Diwali",
  ]) {
    const r = await a.post("/api/chat").send({ message });
    assert.equal(r.status, 200);
    assert.ok(r.body.reply.length > 0);
  }
  const r = await b.post("/api/chat").send({ message: "Cash balance" });
  assert.match(r.body.reply, /₹0/);
  assert.doesNotMatch(r.body.reply, /160,000/);
});

test("seasonal API and ledger agree on an unlinked expected invoice and preserve persisted status", async () => {
  const d = new Date(today().slice(0, 7) + "-01T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  const dueDate = d.toISOString().slice(0, 7) + "-15",
    r = await b
      .post("/api/transactions")
      .send({
        ...bill,
        name: "Vishwa",
        amount: 15000,
        dueDate,
        status: "expected",
        cust: null,
      });
  assert.equal(r.status, 201);
  const id = r.body.id;
  try {
    const ledger = await b.get("/api/transactions?dir=in&status=expected"),
      overview = await b.get("/api/overview"),
      forecast = await b.get("/api/forecast/seasonal?months=6&uplift=1");
    assert.equal(ledger.body.find((t) => t.id === id).amount, 15000);
    assert.equal(overview.body.totals.expected_inflows, 15000);
    assert.equal(forecast.status, 200);
    assert.equal(forecast.body.forecast[0].income, 15000);
    assert.equal(forecast.body.forecast[0].scheduled_income, 15000);
    assert.equal(forecast.body.forecast[0].cash_after, 15000);
    assert.equal(forecast.body.forecast[1].income, 0);
    assert.equal((await Transaction.findById(id)).status, "expected");
    assert.equal((await Transaction.findById(id)).cust, null);
  } finally {
    await b.delete("/api/transactions/" + id);
  }
});
test("reminders are honest about delivery, communication log isolated", async () => {
  let r = await a
    .post("/api/reminders")
    .send({ customer_id: cid, channel: "whatsapp", message: "Please pay" });
  assert.equal(r.status, 200);
  assert.match(r.body.url, /^https:\/\/wa.me\/919800000001/);
  assert.match(r.body.status, /Prepared/);
  r = await a
    .post("/api/reminders")
    .send({ customer_id: cid, channel: "email", message: "Please pay" });
  assert.equal(r.status, 503);
  assert.equal((await a.get("/api/reminders")).body.length, 2);
  assert.equal((await b.get("/api/reminders")).body.length, 0);
  await a.delete("/api/reminders");
  assert.equal((await a.get("/api/reminders")).body.length, 0);
});
test("profile persists, password changes invalidate old sessions, logout revokes token", async () => {
  let r = await a.post("/api/users").send({
    name: "Updated",
    biz_name: "Updated Business",
    currency: "USD",
    safetyLimit: 200000,
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.safetyLimit, 200000);
  assert.equal((await a.get("/api/overview")).body.safety_limit, 200000);
  const old = request.agent(app);
  await old
    .post("/api/auth/login")
    .send({ email: "one@example.com", password: "Correct123!" });
  assert.equal(
    (
      await a
        .post("/api/auth/change-password")
        .send({ current_password: "Wrong", new_password: "NewCorrect123!" })
    ).status,
    401,
  );
  assert.equal(
    (
      await a.post("/api/auth/change-password").send({
        current_password: "Correct123!",
        new_password: "NewCorrect123!",
      })
    ).status,
    200,
  );
  assert.equal((await old.get("/api/auth/me")).status, 401);
  assert.equal(
    (
      await request(app)
        .post("/api/auth/login")
        .send({ email: "one@example.com", password: "Correct123!" })
    ).status,
    401,
  );
  const cookie = (
    await a
      .post("/api/auth/login")
      .send({ email: "one@example.com", password: "NewCorrect123!" })
  ).headers["set-cookie"];
  await a.post("/api/auth/logout").send({});
  assert.equal(
    (await request(app).get("/api/auth/me").set("Cookie", cookie)).status,
    401,
  );
});
test("secure reset cannot be performed using only an email address", async () => {
  assert.equal(
    (
      await request(app)
        .post("/api/auth/reset-password")
        .send({ email: "two@example.com", new_password: "Attack123!" })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/auth/reset-password")
        .send({ token: "a".repeat(64), new_password: "Attack123!" })
    ).status,
    400,
  );
});
test("single-use password reset accepts hashed unexpired token and revokes previous sessions", async () => {
  const token = "b".repeat(64);
  await User.updateOne(
    { email: "two@example.com" },
    {
      $set: {
        resetHash: createHash("sha256").update(token).digest("hex"),
        resetExpires: new Date(Date.now() + 60000),
      },
    },
  );
  assert.equal(
    (
      await request(app)
        .post("/api/auth/reset-password")
        .send({ token, new_password: "ResetCorrect123!" })
    ).status,
    200,
  );
  assert.equal((await b.get("/api/auth/me")).status, 401);
  assert.equal(
    (
      await request(app)
        .post("/api/auth/reset-password")
        .send({ token, new_password: "Again123!" })
    ).status,
    400,
  );
  assert.equal(
    (
      await b
        .post("/api/auth/login")
        .send({ email: "two@example.com", password: "ResetCorrect123!" })
    ).status,
    200,
  );
});
