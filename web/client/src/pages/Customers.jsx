import { useEffect, useState } from "react";
import { api } from "../api";
import { useApp } from "../context";
import { Field, Modal, ErrorMessage, Table, Card } from "../components/UI";
function CustomerForm({ customer, onClose, onSaved }) {
  const [d, setD] = useState(
      customer
        ? { ...customer, history: customer.history.join(", ") }
        : { name: "", email: "", phone: "", history: "" },
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    bind = (k) => ({
      value: d[k],
      onChange: (e) => setD({ ...d, [k]: e.target.value }),
    });
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(
        "/customers" + (d.id ? "/" + d.id : ""),
        {
          ...d,
          history: d.history.trim()
            ? d.history.split(",").map((v) => Number(v.trim()))
            : [],
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
      title={customer ? "Edit customer" : "Add customer"}
      onClose={onClose}
    >
      <form onSubmit={save}>
        <Field label="Name" required {...bind("name")} />
        <Field label="Email" type="email" {...bind("email")} />
        <Field label="Phone (include country code)" {...bind("phone")} />
        <Field
          label="Payment delay history in days (comma separated)"
          {...bind("history")}
        />
        <ErrorMessage error={error} />
        <button className="btn" disabled={busy}>
          Save customer
        </button>
      </form>
    </Modal>
  );
}
function ReminderForm({ customer, onClose, onSaved }) {
  const { lang, money, notify } = useApp(),
    [channel, setChannel] = useState("whatsapp"),
    [locale, setLocale] = useState(lang),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [url, setUrl] = useState("");
  useEffect(() => {
    setMessage(
      locale === "hi"
        ? `नमस्ते ${customer.name}, ${money(customer.outstanding)} का भुगतान बकाया है। कृपया भुगतान की तारीख बताएं। धन्यवाद।`
        : locale === "kn"
          ? `ನಮಸ್ಕಾರ ${customer.name}, ${money(customer.outstanding)} ಪಾವತಿ ಬಾಕಿ ಇದೆ. ದಯವಿಟ್ಟು ಪಾವತಿಯ ದಿನಾಂಕ ತಿಳಿಸಿ. ಧನ್ಯವಾದಗಳು.`
          : `Hello ${customer.name}, ${money(customer.outstanding)} is outstanding. Please confirm your payment date. Thank you.`,
    );
  }, [locale]);
  async function send(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("/reminders", {
        customer_id: customer.id,
        channel,
        message,
      });
      setUrl(r.url || "");
      notify(r.status);
      await onSaved();
      if (!r.url) onClose();
    } catch (e) {
      setError(e.message);
      await onSaved();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={"Payment reminder · " + customer.name} onClose={onClose}>
      <form onSubmit={send}>
        <Field label="Language">
          <select value={locale} onChange={(e) => setLocale(e.target.value)}>
            <option value="en">English</option>
            <option value="hi">हिंदी</option>
            <option value="kn">ಕನ್ನಡ</option>
          </select>
        </Field>
        <Field label="Channel">
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
        </Field>
        <Field label="Message">
          <textarea
            rows={5}
            required
            maxLength={3000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>
        <ErrorMessage error={error} />
        <button className="btn" disabled={busy}>
          {busy
            ? "Preparing…"
            : channel === "whatsapp"
              ? "Prepare WhatsApp message"
              : "Send reminder"}
        </button>
        {url && (
          <p>
            <a className="btn" href={url} target="_blank" rel="noreferrer">
              Open WhatsApp to send
            </a>
          </p>
        )}
      </form>
    </Modal>
  );
}
export default function Customers({ revision, refresh }) {
  const { t, money, notify } = useApp(),
    [rows, setRows] = useState([]),
    [log, setLog] = useState([]),
    [editor, setEditor] = useState(null),
    [reminder, setReminder] = useState(null),
    [error, setError] = useState("");
  async function load() {
    try {
      const [a, b] = await Promise.all([
        api("/customers/behaviour"),
        api("/reminders"),
      ]);
      setRows(a);
      setLog(b);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [revision]);
  async function saved() {
    await refresh();
    await load();
  }
  async function remove(c) {
    if (!confirm("Delete " + c.name + "?")) return;
    try {
      await api("/customers/" + c.id, null, "DELETE");
      await saved();
    } catch (e) {
      notify(e.message);
    }
  }
  return (
    <div className="grid gap-6">
      <div className="stats-grid">
        {["regular", "late", "overdue"].map((s) => (
          <Card
            key={s}
            label={s}
            value={rows.filter((c) => c.status === s).length}
          />
        ))}
      </div>
      <div>
        <button className="btn" onClick={() => setEditor({})}>
          + Add customer
        </button>
      </div>
      <ErrorMessage error={error} />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {rows.map((c) => (
          <div className="card" key={c.id}>
            <span className="badge">{c.status}</span>
            <h3>{c.name}</h3>
            <p>
              {c.email}
              <br />
              {c.phone}
            </p>
            <p>
              Average delay:{" "}
              <b>
                {c.avg_delay} {t("days")}
              </b>{" "}
              · {c.trend}
            </p>
            <p>On time: {c.on_time_pct}%</p>
            <p>
              Outstanding: <b>{money(c.outstanding)}</b>
            </p>
            <div
              className="flex gap-1 h-12 items-end"
              aria-label="Historical payment delays"
            >
              {c.history.map((v, i) => (
                <span
                  key={i}
                  style={{
                    height: Math.max(4, Math.min(48, v + 4)),
                    width: 14,
                    background: "var(--teal)",
                  }}
                  title={v + " days"}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <button className="btn sm" onClick={() => setReminder(c)}>
                Remind
              </button>
              <button className="btn ghost sm" onClick={() => setEditor(c)}>
                Edit
              </button>
              <button className="btn ghost sm" onClick={() => remove(c)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      {!rows.length && (
        <p>Add customers to track receivables and payment behaviour.</p>
      )}
      <div className="card">
        <div className="between">
          <h3>Communication log</h3>
          <button
            className="btn ghost sm"
            onClick={async () => {
              if (confirm("Clear your reminder log?"))
                try {
                  await api("/reminders", null, "DELETE");
                  await load();
                } catch (e) {
                  notify(e.message);
                }
            }}
          >
            Clear log
          </button>
        </div>
        <Table
          headers={["Customer", "Channel", "Message", "Status", "Time"]}
          empty={!log.length ? "No reminders yet." : null}
        >
          {log.map((r) => (
            <tr key={r.id}>
              <td>{r.cust}</td>
              <td>{r.ch}</td>
              <td className="max-w-sm whitespace-pre-wrap">{r.msg}</td>
              <td>{r.status}</td>
              <td>{new Date(r.ts).toLocaleString()}</td>
            </tr>
          ))}
        </Table>
      </div>
      {editor && (
        <CustomerForm
          customer={editor.id ? editor : null}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      )}{" "}
      {reminder && (
        <ReminderForm
          customer={reminder}
          onClose={() => setReminder(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
