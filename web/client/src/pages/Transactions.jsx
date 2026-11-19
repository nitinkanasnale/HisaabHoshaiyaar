import { useState } from "react";
import { api } from "../api";
import { useApp } from "../context";
import { Card, Table, Field } from "../components/UI";
export function TransactionTable({ rows, edit, refresh }) {
  const { t, money, notify } = useApp();
  async function change(row) {
    try {
      await api(
        "/transactions/" + row.id + "/status",
        { status: row.status === "settled" ? "expected" : "settled" },
        "PUT",
      );
      await refresh();
    } catch (e) {
      notify(e.message);
    }
  }
  async function remove(row) {
    if (!confirm("Delete " + row.name + "?")) return;
    try {
      await api("/transactions/" + row.id, null, "DELETE");
      await refresh();
    } catch (e) {
      notify(e.message);
    }
  }
  return (
    <Table
      headers={[
        t("name"),
        t("amount"),
        t("due"),
        t("status"),
        ...(edit ? ["Actions"] : []),
      ]}
      empty={!rows.length ? t("empty") : null}
    >
      {rows.map((r) => (
        <tr key={r.id}>
          <td>
            <b>{r.name}</b>
            <div className="sub">
              {r.type} · {r.method || "UPI"}
            </div>
          </td>
          <td className={r.dir === "in" ? "pos" : "neg"}>
            {r.dir === "in" ? "+" : "−"}
            {money(r.amount)}
          </td>
          <td>
            {r.dueDate}
            {r.delay > 0 && (
              <div className="sub">
                +{r.delay} {t("days")}
              </div>
            )}
          </td>
          <td>
            <span className={"badge " + (r.status === "overdue" ? "red" : "")}>
              {r.status === "settled"
                ? r.dir === "in"
                  ? t("rec")
                  : t("paid")
                : r.status === "overdue"
                  ? t("over")
                  : t("exp")}
            </span>
          </td>
          {edit && (
            <td>
              <div className="flex flex-wrap gap-2">
                <button className="btn ghost sm" onClick={() => edit(r)}>
                  Edit
                </button>
                <button className="btn ghost sm" onClick={() => change(r)}>
                  {r.status === "settled" ? "Mark pending" : "Settle"}
                </button>
                <button className="btn ghost sm" onClick={() => remove(r)}>
                  Delete
                </button>
              </div>
            </td>
          )}
        </tr>
      ))}
    </Table>
  );
}
export default function Transactions({ tx, overview, edit, refresh }) {
  const { t, money } = useApp(),
    [q, setQ] = useState(""),
    [dir, setDir] = useState(""),
    [status, setStatus] = useState(""),
    [cat, setCat] = useState(""),
    [sort, setSort] = useState("due"),
    [month, setMonth] = useState("");
  const rows = tx
    .filter(
      (r) =>
        (!q || r.name.toLowerCase().includes(q.toLowerCase())) &&
        (!dir || r.dir === dir) &&
        (!status || r.status === status) &&
        (!cat || r.type === cat) &&
        (!month || r.dueDate.startsWith(month)),
    )
    .toSorted((a, b) =>
      sort === "amount"
        ? b.amount - a.amount
        : a.dueDate.localeCompare(b.dueDate),
    );
  const actual = tx.filter(
      (r) => r.status === "settled" && (!month || r.dueDate.startsWith(month)),
    ),
    income = actual
      .filter((r) => r.dir === "in")
      .reduce((s, r) => s + r.amount, 0),
    expenses = actual
      .filter((r) => r.dir === "out")
      .reduce((s, r) => s + r.amount, 0);
  function exportCsv() {
    const quote = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"',
      content = [
        [
          "Name",
          "Direction",
          "Category",
          "Amount",
          "Due date",
          "Delay",
          "Status",
          "Method",
        ],
        ...rows.map((r) => [
          r.name,
          r.dir,
          r.type,
          r.amount,
          r.dueDate,
          r.delay,
          r.status,
          r.method,
        ]),
      ]
        .map((r) => r.map(quote).join(","))
        .join("\r\n"),
      url = URL.createObjectURL(
        new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="grid">
      <div className="stats-grid">
        <Card
          label={t("eIn")}
          value={money(overview.totals.expected_inflows)}
        />
        <Card
          label={t("eOut")}
          value={money(overview.totals.expected_outflows)}
        />
        <Card label={t("tRecv")} value={money(overview.totals.received)} />
        <Card label={t("tPaid")} value={money(overview.totals.paid)} />
      </div>
      <div className="card">
        <div className="filters-grid">
          <Field
            label="Search"
            placeholder={t("search")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Field label={t("dir")}>
            <select value={dir} onChange={(e) => setDir(e.target.value)}>
              <option value="">{t("all")}</option>
              <option value="in">{t("in")}</option>
              <option value="out">{t("out")}</option>
            </select>
          </Field>
          <Field label={t("status")}>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t("all")}</option>
              {["expected", "settled", "overdue"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label={t("type")}>
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">{t("all")}</option>
              {[...new Set(tx.map((r) => r.type))].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <Field label="Sort">
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="due">{t("sDue")}</option>
              <option value="amount">{t("sAmt")}</option>
            </select>
          </Field>
        </div>
        <div className="row">
          <button
            className="btn ghost sm"
            onClick={() => {
              setQ("");
              setDir("");
              setStatus("");
              setCat("");
              setMonth("");
            }}
          >
            {t("clear")}
          </button>
          <button className="btn ghost sm" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
        <p>
          Settled {month || "all-time"}: income {money(income)} · expenses{" "}
          {money(expenses)} · net {money(income - expenses)}
        </p>
        <TransactionTable rows={rows} edit={edit} refresh={refresh} />
      </div>
    </div>
  );
}
