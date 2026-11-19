import { useState } from "react";
import { api } from "../api";
import { useApp } from "../context";
import { Modal, Field, ErrorMessage } from "./UI";
export const localDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export default function TransactionForm({
  transaction,
  customers,
  onClose,
  onSaved,
}) {
  const { t } = useApp(),
    [d, setD] = useState(
      transaction || {
        name: "",
        dir: "in",
        type: "customer",
        amount: "",
        dueDate: localDate(),
        delay: 0,
        status: "expected",
        cust: "",
        method: "UPI",
        note: "",
      },
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    bind = (k) => ({
      value: d[k] ?? "",
      onChange: (e) => setD({ ...d, [k]: e.target.value }),
    });
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(
        "/transactions" + (d.id ? "/" + d.id : ""),
        {
          ...d,
          amount: Number(d.amount),
          delay: Number(d.delay),
          cust: d.cust || null,
        },
        d.id ? "PUT" : "POST",
      );
      await onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={transaction ? "Edit transaction" : "Add transaction"}
      onClose={onClose}
    >
      <form onSubmit={save}>
        <div className="two">
          <Field label={t("name")} required maxLength={200} {...bind("name")} />
          <Field label={t("dir")}>
            <select {...bind("dir")}>
              <option value="in">{t("in")}</option>
              <option value="out">{t("out")}</option>
            </select>
          </Field>
          <Field label={t("type")}>
            <select {...bind("type")}>
              {[
                "customer",
                "supplier",
                "expense",
                "payroll",
                "loan",
                "tax",
                "sales",
                "other",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field
            label={t("amount")}
            type="number"
            min="1"
            max="1000000000000"
            step="1"
            required
            {...bind("amount")}
          />
          <Field label={t("due")} type="date" required {...bind("dueDate")} />
          <Field
            label={t("delay")}
            type="number"
            min="0"
            max="3650"
            required
            {...bind("delay")}
          />
          <Field label={t("status")}>
            <select {...bind("status")}>
              <option value="expected">{t("exp")}</option>
              <option value="settled">{t("done")}</option>
              <option value="overdue">{t("over")}</option>
            </select>
          </Field>
          <Field label="Customer">
            <select {...bind("cust")}>
              <option value="">No customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Payment method">
            <select {...bind("method")}>
              {["UPI", "Cash", "Bank transfer", "Card", "Cheque", "Other"].map(
                (v) => (
                  <option key={v}>{v}</option>
                ),
              )}
            </select>
          </Field>
          <Field label="Notes" maxLength={2000} {...bind("note")} />
        </div>
        <ErrorMessage error={error} />
        <button className="btn" disabled={busy}>
          {busy ? "Saving…" : "Save transaction"}
        </button>
      </form>
    </Modal>
  );
}
