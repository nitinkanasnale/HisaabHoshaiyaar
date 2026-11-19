import { test } from "node:test";
import assert from "node:assert/strict";
import * as A from "../src/services/analytics.js";
const t = (dir, amount, day, status = "expected", extra = {}) => ({
  id: String(Math.random()),
  dir,
  amount,
  day,
  status,
  delay: 0,
  type: dir === "in" ? "customer" : "supplier",
  ...extra,
});
test("reconcile exact original nine-record financial totals without counting settled cash twice", () => {
  const tx = [
    t("in", 50000, -1, "settled"),
    t("out", 20000, -1, "settled"),
    t("in", 30000, 7),
    t("in", 30000, 14),
    t("in", 30000, 21),
    t("out", 45000, 7),
    t("out", 45000, 14),
    t("out", 45000, 21),
    t("out", 45000, 28),
  ];
  assert.equal(A.sum(tx, "in"), 140000);
  assert.equal(A.sum(tx, "out"), 200000);
  const cash = A.currentCash(tx, 100000);
  assert.equal(cash, 130000);
  assert.deepEqual(
    A.forecast(tx, cash),
    [130000, 115000, 100000, 85000, 40000, 40000, 40000, 40000, 40000],
  );
});
test("forecast overdue, week boundaries and horizon", () => {
  assert.deepEqual(
    A.forecast(
      [
        t("in", 100, -3),
        t("out", 50, 7),
        t("out", 70, 8),
        t("out", 80, 56),
        t("out", 999, 57),
      ],
      0,
    ),
    [100, 50, -20, -20, -20, -20, -20, -20, -100],
  );
});
test("transaction shortage detects intraweek liquidity failure", () => {
  const tx = [t("out", 200, 1), t("in", 300, 2)],
    b = A.forecast(tx, 100),
    m = A.metrics(b, 50, tx, 100);
  assert.equal(m.s, null);
  assert.equal(m.shortage_date, 1);
  assert.equal(m.causing_transaction.amount, 200);
});
test("scenario is pure and changes only pending records", () => {
  const tx = [
      t("in", 1000, 7, "expected", { id: "a" }),
      t("in", 200, 0, "settled", { id: "s" }),
    ],
    snapshot = structuredClone(tx),
    out = A.applyScenario(tx, {
      delay_tx: "a",
      delay_days: 20,
      sales_pct: 10,
      expense_amount: 300,
      expense_day: 14,
    });
  assert.deepEqual(tx, snapshot);
  assert.equal(out[0].amount, 900);
  assert.equal(out[0].delay, 20);
  assert.equal(out[1].amount, 200);
  assert.equal(out.length, 3);
});
test("fixes preserve original 21/14 day strategies and loan cost", () => {
  const tx = [
      t("in", 200000, 47, "expected", { id: "c" }),
      t("out", 180000, 31, "expected", { id: "p" }),
    ],
    f = A.fixes(tx, 100000);
  assert.equal(f.fixes.length, 3);
  assert.equal(f.fixes[2].b[8], A.forecast(tx, 100000)[8] - 4500);
  assert.ok(f.best_index >= 0);
});
test("customer behaviour scoped to linked incoming pending payments", () => {
  const cs = [{ id: "a", history: [15, 20, 30], name: "A" }],
    tx = [
      t("in", 100, 7, "expected", { cust: "a" }),
      t("out", 900, 7, "expected", { cust: "a" }),
    ];
  assert.equal(A.behaviour(cs, tx)[0].outstanding, 100);
  assert.equal(A.behaviour(cs, tx)[0].status, "overdue");
});
test("health score uses actual margin, safe limit and six original weights", () => {
  const tx = [t("in", 1000, 0, "settled"), t("out", 500, 0, "settled")],
    h = A.health(tx, [], 500, 100);
  assert.equal(h.mg, 0.5);
  assert.equal(
    h.comps.reduce((s, c) => s + c.w, 0),
    100,
  );
  assert.ok(h.score >= 0 && h.score <= 100);
});
test("seasonality never fabricates financial history", () => {
  assert.equal(A.seasonal([], 100).forecast.length, 0);
  const s = A.seasonal(
    [
      { dir: "in", amount: 1000, dueDate: "2026-10-01", status: "settled" },
      { dir: "out", amount: 500, dueDate: "2026-10-10", status: "settled" },
    ],
    100,
    6,
    1,
    "2026-10-17",
  );
  assert.equal(s.forecast.length, 6);
  assert.equal(s.forecast[0].month_name, "Nov");
  assert.equal(s.forecast[0].income, 1000);
  assert.equal(s.history.length, 1);
  assert.equal(s.insufficientData, true);
});
test("calendar dates remain stable and advance independently of process timezone", () => {
  assert.equal(A.dayDiff("2026-11-18", "2026-11-17"), 1);
  assert.equal(A.addDays("2026-12-31", 1), "2027-01-01");
});

test("seasonal forecast includes Vishwa's unlinked expected December income without changing status", () => {
  const history = [
      { dir: "out", amount: 5000, dueDate: "2026-11-01", status: "settled" },
    ],
    vishwa = {
      id: "vishwa",
      name: "Vishwa",
      dir: "in",
      type: "customer",
      amount: 15000,
      dueDate: "2026-12-15",
      delay: 0,
      status: "expected",
      cust: null,
    },
    tx = [...history, vishwa],
    before = structuredClone(tx),
    baseline = A.seasonal(history, 395000, 6, 1, "2026-11-18"),
    result = A.seasonal(tx, 395000, 6, 1, "2026-11-18");
  assert.equal(result.forecast[0].month_name, "Dec");
  assert.equal(result.forecast[0].income, 15000);
  assert.equal(result.forecast[0].scheduled_income, 15000);
  assert.equal(result.forecast[0].expenses, 5000);
  assert.equal(result.forecast[0].net, 10000);
  assert.equal(result.forecast[0].cash_after, 405000);
  assert.equal(Math.min(...result.forecast.map((r) => r.cash_after)), 380000);
  for (let i = 0; i < 6; i++) {
    assert.equal(
      result.forecast[i].income - baseline.forecast[i].income,
      i === 0 ? 15000 : 0,
    );
    assert.equal(
      result.forecast[i].cash_after - baseline.forecast[i].cash_after,
      15000,
    );
  }
  assert.deepEqual(tx, before);
});

test("scheduled-only seasonal forecast uses real pending amounts and no fabricated history", () => {
  const result = A.seasonal(
    [
      {
        dir: "in",
        amount: 15000,
        dueDate: "2026-12-15",
        status: "expected",
        cust: null,
      },
      { dir: "out", amount: 3000, dueDate: "2026-12-20", status: "expected" },
    ],
    100000,
    6,
    3,
    "2026-11-18",
  );
  assert.deepEqual(result.history, []);
  assert.equal(result.forecast.length, 6);
  assert.equal(result.forecast[0].income, 15000);
  assert.equal(result.forecast[0].expenses, 3000);
  assert.equal(result.forecast[0].cash_after, 112000);
  assert.equal(result.forecast[1].income, 0);
  assert.equal(result.forecast[1].cash_after, 112000);
  assert.equal(result.insufficientData, true);
});

test("seasonal scheduling uses due date plus delay across year, leap-day and horizon boundaries", () => {
  const tx = [
      {
        dir: "in",
        amount: 10,
        dueDate: "2026-12-31",
        delay: 0,
        status: "expected",
      },
      {
        dir: "in",
        amount: 20,
        dueDate: "2026-12-31",
        delay: 1,
        status: "expected",
      },
      { dir: "out", amount: 5, dueDate: "2027-01-01", status: "overdue" },
      { dir: "in", amount: 900, dueDate: "2026-11-30", status: "expected" },
      { dir: "in", amount: 800, dueDate: "2027-02-01", status: "expected" },
      { dir: "in", amount: 700, dueDate: "2026-12-01", status: "settled" },
    ],
    before = structuredClone(tx),
    result = A.seasonal(tx, 100, 2, 1, "2026-11-18");
  assert.deepEqual(
    result.forecast.map((r) => [
      r.year,
      r.month_name,
      r.income,
      r.expenses,
      r.cash_after,
    ]),
    [
      [2026, "Dec", 10, 0, 110],
      [2027, "Jan", 20, 5, 125],
    ],
  );
  assert.deepEqual(tx, before);
  const leap = A.seasonal(
    [
      {
        dir: "in",
        amount: 42,
        dueDate: "2028-02-28",
        delay: 1,
        status: "expected",
      },
    ],
    0,
    2,
    1,
    "2028-01-31",
  );
  assert.equal(leap.forecast[0].income, 42);
  assert.equal(leap.forecast[1].income, 0);
});

test("seasonal uplift changes the historical estimate but never scales a scheduled invoice", () => {
  const history = [
      { dir: "in", amount: 1000, dueDate: "2026-11-01", status: "settled" },
    ],
    pending = {
      dir: "in",
      amount: 15000,
      dueDate: "2026-12-15",
      status: "expected",
    };
  for (const uplift of [0, 1, 3]) {
    const baseline = A.seasonal(history, 0, 6, uplift, "2026-11-18"),
      result = A.seasonal([...history, pending], 0, 6, uplift, "2026-11-18");
    assert.equal(
      result.forecast[0].income - baseline.forecast[0].income,
      15000,
    );
    assert.equal(
      result.forecast[0].seasonal_income,
      baseline.forecast[0].income,
    );
  }
});
