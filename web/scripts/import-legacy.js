import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { User, Customer, Transaction, Reminder } from "../server/src/models.js";
import { customer, transaction } from "../server/src/validation.js";
import { addDays } from "../server/src/services/analytics.js";
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });
const args = process.argv.slice(2),
  get = (k) => args[args.indexOf(k) + 1];
const required = ["--file", "--email", "--source-user", "--anchor-date"];
if (
  required.some((k) => !args.includes(k) || !get(k) || get(k).startsWith("--"))
) {
  console.error(
    "Usage: npm run import:legacy -- --file export.json --email target@example.com --source-user legacy-user-id --anchor-date YYYY-MM-DD [--include-shared] [--apply]",
  );
  process.exit(1);
}
const base = get("--anchor-date");
if (
  !/^\d{4}-\d{2}-\d{2}$/.test(base) ||
  isNaN(Date.parse(base)) ||
  addDays(base, 0) !== base
)
  throw new Error("Invalid anchor date.");
const source = JSON.parse(readFileSync(get("--file"), "utf8")),
  sourceId = get("--source-user"),
  includeShared = args.includes("--include-shared");
const scoped = (t) =>
  t.user_id === sourceId ||
  t.note === `uid:${sourceId}` ||
  (includeShared && !t.user_id && !t.note);
const txs = (source.transactions || []).filter(scoped),
  allCustomers = source.customers || [],
  needed = new Set(txs.map((t) => t.cust).filter(Boolean));
const customers = allCustomers.filter((c) => needed.has(c.id));
const types = {
  cust: "customer",
  sup: "supplier",
  pay: "payroll",
  exp: "expense",
};
const prepared = txs.map((t) => ({
  legacyId: String(t.id),
  data: transaction.parse({
    name: t.name,
    type: types[t.type] || t.type,
    dir: t.dir,
    amount: Number(t.amount),
    dueDate: t.dueDate || addDays(base, Number(t.day || 0)),
    delay: Number(t.delay || 0),
    status: t.status,
    method: t.method || "UPI",
    note: (t.note || "").replace(/^uid:[^\s]+\s*/, ""),
  }),
}));
const preparedCustomers = customers.map((c) => ({
  legacyId: String(c.id),
  data: customer.parse({
    name: c.name,
    email: c.email || "",
    phone: c.phone || "",
    history:
      typeof c.history === "string" ? JSON.parse(c.history) : c.history || [],
  }),
}));
console.log(
  `Selected ${preparedCustomers.length} linked customers and ${prepared.length} transactions. Unowned shared records ${includeShared ? "explicitly included" : "excluded"}.`,
);
if (!args.includes("--apply")) {
  console.log(
    "Validation succeeded. Dry run only; add --apply to write to MongoDB. Existing imported records are skipped.",
  );
  process.exit(0);
}
if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI.");
try {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ email: get("--email").toLowerCase() });
  if (!user) throw new Error("Register the target account first.");
  const map = new Map();
  for (const c of preparedCustomers) {
    let doc = await Customer.findOne({ owner: user._id, legacyId: c.legacyId });
    if (!doc)
      doc = await Customer.create({
        ...c.data,
        legacyId: c.legacyId,
        owner: user._id,
      });
    map.set(c.legacyId, doc._id);
  }
  let created = 0;
  for (let i = 0; i < prepared.length; i++) {
    const row = prepared[i],
      original = txs[i];
    if (await Transaction.exists({ owner: user._id, legacyId: row.legacyId }))
      continue;
    if (original.cust && !map.has(String(original.cust)))
      throw new Error(
        "Missing customer mapping for legacy transaction " + row.legacyId,
      );
    await Transaction.create({
      ...row.data,
      cust: original.cust ? map.get(String(original.cust)) : null,
      owner: user._id,
      legacyId: row.legacyId,
    });
    created++;
  }
  console.log(
    `Imported ${created} transactions. Passwords and global communication logs are not imported. Set the target opening balance to the original opening balance in the UI.`,
  );
} finally {
  await mongoose.disconnect();
}
