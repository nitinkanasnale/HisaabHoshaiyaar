// Pure calculations ported from main.py. Amounts retain the original integer currency units.
export const H = 8;
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const dayDiff = (date, base = today()) =>
  Math.round(
    (Date.parse(date + "T00:00:00Z") - Date.parse(base + "T00:00:00Z")) /
      86400000,
  );
export const addDays = (date, days) =>
  new Date(Date.parse(date + "T00:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
export const sum = (tx, dir, status) =>
  tx
    .filter(
      (t) =>
        t.dir === dir &&
        (status === undefined ||
          (status === "pending"
            ? t.status !== "settled"
            : t.status === status)),
    )
    .reduce((s, t) => s + t.amount, 0);
export function normalize(rows, base = today()) {
  return rows.map((t) => ({
    ...t,
    id: String(t.id || t._id),
    cust: t.cust ? String(t.cust) : null,
    day: t.dueDate ? dayDiff(t.dueDate, base) : t.day,
    delay: t.delay || 0,
  }));
}
export const currentCash = (tx, opening) =>
  opening + sum(tx, "in", "settled") - sum(tx, "out", "settled");
export function forecast(tx, cash) {
  const d = Array(H + 1).fill(0);
  for (const t of tx) {
    if (t.status === "settled") continue;
    const w = Math.max(0, Math.ceil((t.day + t.delay) / 7));
    if (w <= H) d[w] += t.dir === "in" ? t.amount : -t.amount;
  }
  return d.map((v) => (cash += v));
}
export function metrics(b, safe = 100000, tx = [], cash = b[0]) {
  const lowest = Math.min(...b),
    s = b.findIndex((v) => v < 0);
  let balance = cash,
    causing = null;
  for (const t of tx
    .filter((t) => t.status !== "settled")
    .toSorted((a, b) => a.day + a.delay - b.day - b.delay)) {
    if (t.day + t.delay > 56) continue;
    balance += t.dir === "in" ? t.amount : -t.amount;
    if (balance < 0) {
      causing = { ...t, eff_day: t.day + t.delay };
      break;
    }
  }
  return {
    lowest,
    lowest_week: b.indexOf(lowest),
    shortage_week: s < 0 ? null : s,
    weeks_below_zero: b.filter((v) => v < 0).length,
    weeks_below_safety: b.filter((v) => v < safe).length,
    shortage_date: causing?.eff_day ?? null,
    causing_transaction: causing,
    lo: lowest,
    s: s < 0 ? null : s,
    z: b.filter((v) => v < 0).length,
    sf: b.filter((v) => v < safe).length,
  };
}
const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
export function behaviour(customers, tx) {
  return customers.map((c) => {
    const h = c.history || [],
      op = tx.filter(
        (t) =>
          t.cust === String(c.id || c._id) &&
          t.dir === "in" &&
          t.status !== "settled",
      ),
      a = avg(h),
      trend = h.length >= 3 ? avg(h.slice(-3)) - avg(h.slice(0, 3)) : 0,
      status =
        op.some((t) => t.status === "overdue" || t.day < 0) || a > 14
          ? "overdue"
          : a > 3
            ? "late"
            : "regular";
    return {
      ...c,
      id: String(c.id || c._id),
      avg_delay: Math.round(a * 10) / 10,
      on_time_pct: h.length
        ? Math.round((h.filter((v) => v <= 2).length / h.length) * 100)
        : 100,
      trend: trend > 1 ? "slower" : trend < -1 ? "improving" : "steady",
      status,
      outstanding: op.reduce((s, t) => s + t.amount, 0),
    };
  });
}
export function applyScenario(tx, s, customers = []) {
  let out = tx.map((t) => ({ ...t }));
  for (const t of out) {
    if (t.status === "settled") continue;
    if (t.id === s.delay_tx) t.delay += s.delay_days || 0;
    if (t.id === s.supplier_tx) t.day += s.supplier_shift || 0;
    if (t.type === "customer" && s.sales_pct)
      t.amount = Math.round(t.amount * (1 - s.sales_pct / 100));
    if (s.pred) {
      const c = customers.find((c) => String(c.id || c._id) === t.cust);
      if (c) t.delay = Math.max(t.delay, Math.round(avg(c.history || [])));
    }
  }
  if (s.expense_amount)
    out.push({
      id: "scenario-expense",
      name: "Unexpected expense",
      type: "expense",
      dir: "out",
      amount: s.expense_amount,
      day: s.expense_day ?? 30,
      delay: 0,
      status: "expected",
    });
  return out;
}
export function fixes(tx, cash, safe = 100000) {
  const early = tx
    .filter((t) => t.type === "customer" && t.status !== "settled")
    .toSorted((a, b) => b.day - a.day)[0];
  const supplier = tx
    .filter((t) => t.type === "supplier" && t.status !== "settled")
    .toSorted((a, b) => b.amount - a.amount)[0];
  const variants = [
    {
      name: "Collect an invoice earlier",
      desc: early
        ? `${early.name} collected 21 days earlier`
        : "No eligible pending customer invoice",
      eligible: !!early,
      tx: tx.map((t) =>
        t.id === early?.id ? { ...t, day: Math.max(0, t.day - 21) } : t,
      ),
    },
    {
      name: "Delay a supplier payment",
      desc: supplier
        ? `${supplier.name} delayed 14 days`
        : "No eligible pending supplier payment",
      eligible: !!supplier,
      tx: tx.map((t) =>
        t.id === supplier?.id ? { ...t, day: t.day + 14 } : t,
      ),
    },
    {
      name: "Short-term loan",
      desc: "150,000 received on day 28; 154,500 repaid on day 56 (3% fee).",
      eligible: true,
      tx: [
        ...tx,
        {
          id: "li",
          name: "Loan receipt",
          dir: "in",
          amount: 150000,
          day: 28,
          delay: 0,
          status: "expected",
        },
        {
          id: "lo",
          name: "Loan repayment + fee",
          dir: "out",
          amount: 154500,
          day: 56,
          delay: 0,
          status: "expected",
        },
      ],
    },
  ];
  const f = variants.map((v, i) => {
    const b = forecast(v.tx, cash);
    return {
      id: i + 1,
      name: v.name,
      desc: v.desc,
      eligible: v.eligible,
      b,
      m: metrics(b, safe, v.tx, cash),
    };
  });
  const ranked = f
    .map((v, i) => ({ ...v, i }))
    .filter((v) => v.eligible)
    .sort((a, b) => b.m.lo - a.m.lo || a.m.z - b.m.z);
  return { fixes: f, best_index: ranked[0]?.i ?? null };
}
export function health(tx, customers, cash, safe) {
  const b = forecast(tx, cash),
    m = metrics(b, safe, tx, cash),
    cs = behaviour(customers, tx),
    rec = sum(tx, "in", "pending") || 1,
    outs = sum(tx, "out", "pending") || 1,
    risk = cs.reduce(
      (s, c) =>
        s +
        c.outstanding *
          (c.status === "overdue" ? 1 : c.status === "late" ? 0.5 : 0),
      0,
    ),
    income = sum(tx, "in"),
    expenses = sum(tx, "out"),
    margin = income ? 1 - expenses / income : 0,
    cl = (x) => Math.max(0, Math.min(1, x));
  const comps = [
    ["liq", "Liquidity buffer", 20, cl(m.lo / Math.max(safe, 1))],
    ["short", "Shortage risk", 20, 1 - cl(m.z / 3)],
    ["coll", "Collections quality", 20, 1 - cl((risk / rec) * 1.5)],
    ["obl", "Obligation coverage", 15, cl((cash + rec) / outs / 1.2)],
    ["trend", "Cash trend", 10, cl(0.5 + (b[H] - cash) / (cash || 1))],
    ["margin", "Profit margin", 15, cl(margin / 0.25)],
  ].map(([k, name, w, s]) => ({ k, name, w, s }));
  const score = Math.round(comps.reduce((s, c) => s + c.w * c.s, 0));
  return {
    score,
    label:
      score >= 75
        ? "Strong"
        : score >= 55
          ? "Stable"
          : score >= 35
            ? "Needs attention"
            : "At risk",
    comps,
    m,
    risk,
    mg: margin,
    b,
    recommendations: comps
      .filter((c) => c.s < 0.65)
      .map((c) => `Improve ${c.name.toLowerCase()}.`),
    hasData: tx.length > 0,
  };
}
export const FESTIVALS = {
  0: "Sankranti / Pongal",
  2: "Holi",
  3: "Ugadi / Baisakhi",
  7: "Onam / Ganesh Chaturthi",
  9: "Dussehra",
  10: "Diwali",
  11: "Christmas & New Year",
};
// Historical seasonal baseline plus dated pending cash movements. Settled records
// are already included in current cash; they are never added again as scheduled cash.
export function seasonal(tx, cash, n = 6, uplift = 1, base = today()) {
  const end = base.slice(0, 7) + "-01",
    beginning = new Date(end + "T00:00:00Z");
  beginning.setUTCMonth(beginning.getUTCMonth() + 1);
  const first = beginning.toISOString().slice(0, 10),
    last = new Date(first + "T00:00:00Z");
  last.setUTCMonth(last.getUTCMonth() + n);
  const until = last.toISOString().slice(0, 10),
    settled = tx.filter(
      (t) =>
        t.status === "settled" && t.dueDate?.slice(0, 7) <= base.slice(0, 7),
    ),
    scheduled = new Map();
  for (const t of tx) {
    if (!["expected", "overdue"].includes(t.status) || !t.dueDate) continue;
    // ISO date-only input and UTC arithmetic avoid local timezone month shifts.
    const effective = addDays(t.dueDate, t.delay || 0);
    if (effective < first || effective >= until) continue;
    const month = effective.slice(0, 7),
      row = scheduled.get(month) || { income: 0, expenses: 0 };
    if (t.dir === "in") row.income += t.amount;
    if (t.dir === "out") row.expenses += t.amount;
    scheduled.set(month, row);
  }
  if (!settled.length && !scheduled.size)
    return {
      forecast: [],
      history: [],
      insufficientData: true,
      message:
        "Add settled history or expected income and expenses due in the forecast period to generate a projection.",
    };
  const start = settled.length
      ? settled
          .map((t) => t.dueDate)
          .sort()[0]
          .slice(0, 7) + "-01"
      : end,
    history = [];
  let cursor = settled.length ? start : end;
  // Pending-only accounts have a zero historical baseline, not invented history.
  while (settled.length && cursor <= end && history.length < 1200) {
    const month = +cursor.slice(5, 7) - 1,
      rows = settled.filter(
        (t) => t.dueDate.slice(0, 7) === cursor.slice(0, 7),
      );
    history.push({
      i: history.length,
      m: month,
      y: +cursor.slice(0, 4),
      month_name: new Date(cursor).toLocaleString("en", {
        month: "short",
        timeZone: "UTC",
      }),
      rev: sum(rows, "in"),
      exp: sum(rows, "out"),
      festival: FESTIVALS[month] || "",
    });
    const d = new Date(cursor + "T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + 1);
    cursor = d.toISOString().slice(0, 10);
  }
  const fit = (k) => {
    const len = history.length,
      mx = (len - 1) / 2,
      my = avg(history.map((r) => r[k])),
      den = history.reduce((s, r) => s + (r.i - mx) ** 2, 0),
      b = den
        ? history.reduce((s, r) => s + (r.i - mx) * (r[k] - my), 0) / den
        : 0,
      a = my - b * mx,
      idx = Array(12).fill(0),
      counts = Array(12).fill(0);
    history.forEach((r) => {
      const trend = a + b * r.i;
      if (trend > 0) {
        idx[r.m] += r[k] / trend;
        counts[r.m]++;
      }
    });
    return { a, b, idx: idx.map((v, m) => (counts[m] ? v / counts[m] : 1)) };
  };
  const R = fit("rev"),
    E = fit("exp"),
    rows = [];
  for (let j = 0; j < n; j++) {
    const d = new Date(end + "T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + j + 1);
    const m = d.getUTCMonth(),
      i = history.length + j,
      trR = Math.round(R.a + R.b * i),
      trE = Math.round(E.a + E.b * i),
      seasonal_income = Math.max(
        0,
        Math.round(trR * (1 + (R.idx[m] - 1) * uplift)),
      ),
      seasonal_expenses = Math.max(0, Math.round(trE * E.idx[m])),
      pending = scheduled.get(d.toISOString().slice(0, 7)) || {
        income: 0,
        expenses: 0,
      },
      rev = seasonal_income + pending.income,
      exp = seasonal_expenses + pending.expenses;
    cash += rev - exp;
    rows.push({
      m,
      month: m,
      month_name: d.toLocaleString("en", { month: "short", timeZone: "UTC" }),
      year: d.getUTCFullYear(),
      rev,
      income: rev,
      exp,
      expenses: exp,
      seasonal_income,
      seasonal_expenses,
      scheduled_income: pending.income,
      scheduled_expenses: pending.expenses,
      net: rev - exp,
      cash_after: cash,
      seasonal_index: Math.round(R.idx[m] * 100) / 100,
      festival: FESTIVALS[m] || "",
      trR,
      trE,
    });
  }
  return {
    forecast: rows,
    history,
    insufficientData: history.length < 24,
    message: !history.length
      ? "Scheduled payments only: no settled history is available to estimate seasonal patterns."
      : history.length < 24
        ? "Limited history: 24 months are recommended to estimate seasonal patterns."
        : "",
  };
}
