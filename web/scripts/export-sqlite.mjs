// Node 22.13+ provides node:sqlite. Source database is opened read-only.
import { DatabaseSync } from "node:sqlite";
import { writeFileSync } from "node:fs";
const [, , source, destination] = process.argv;
if (!source || !destination) {
  console.error(
    "Usage: node scripts/export-sqlite.mjs path/to/hh.db path/to/export.json",
  );
  process.exit(1);
}
const db = new DatabaseSync(source, { readOnly: true }),
  data = {};
try {
  for (const name of ["users", "customers", "transactions", "comms"]) {
    const exists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(name);
    data[name] = exists ? db.prepare(`SELECT * FROM ${name}`).all() : [];
  }
  writeFileSync(destination, JSON.stringify(data, null, 2));
  console.log(
    "Exported source tables. Treat the export as private financial data.",
  );
} finally {
  db.close();
}
