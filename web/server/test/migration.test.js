import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
test("SQLite export is read-only and legacy dry-run validates without credentials", () => {
  const dir = mkdtempSync(join(tmpdir(), "hh-migrate-"));
  try {
    const dbfile = join(dir, "source.db"),
      out = join(dir, "export.json"),
      db = new DatabaseSync(dbfile);
    db.exec(
      "CREATE TABLE customers(id TEXT,name TEXT,email TEXT,phone TEXT,history TEXT); CREATE TABLE transactions(id TEXT,name TEXT,cust TEXT,type TEXT,dir TEXT,amount INTEGER,day INTEGER,delay INTEGER,status TEXT,note TEXT); INSERT INTO customers VALUES('c','Actual customer','','','[0,4]'); INSERT INTO transactions VALUES('t','Actual invoice','c','customer','in',2500,7,0,'expected','uid:u1');",
    );
    db.close();
    const before = readFileSync(dbfile);
    let r = spawnSync(
      process.execPath,
      ["scripts/export-sqlite.mjs", dbfile, out],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(readFileSync(dbfile), before);
    const data = JSON.parse(readFileSync(out));
    assert.equal(data.transactions[0].amount, 2500);
    r = spawnSync(
      process.execPath,
      [
        "scripts/import-legacy.js",
        "--file",
        out,
        "--email",
        "target@example.com",
        "--source-user",
        "u1",
        "--anchor-date",
        "2026-11-17",
      ],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /1 linked customers and 1 transactions/);
    assert.match(r.stdout, /Dry run only/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
