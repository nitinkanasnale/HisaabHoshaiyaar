import { useState } from "react";
import { api } from "../api";
import { Owl, ErrorMessage } from "./UI";
export default function Chat() {
  const [open, setOpen] = useState(false),
    [messages, setMessages] = useState([]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function ask(q) {
    if (!q.trim() || busy) return;
    const old = messages;
    setMessages([...old, { role: "user", content: q }]);
    setText("");
    setBusy(true);
    setError("");
    try {
      const r = await api("/chat", {
        message: q,
        history: old.slice(-8).map(({ role, content }) => ({ role, content })),
      });
      setMessages([
        ...old,
        { role: "user", content: q },
        { role: "assistant", content: r.reply, source: r.source },
      ]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="btn chat-launcher"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <Owl size={32} /> Ask Ollie
      </button>
      {open && (
        <aside className="chat-panel" aria-label="Ask Ollie">
          <div className="between">
            <h3>Ask Ollie</h3>
            <button
              className="btn ghost sm"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>
          <div className="chat-history" aria-live="polite">
            {!messages.length && (
              <p>
                Ask about cash shortages, customers, payroll, health, or
                seasonal plans.
              </p>
            )}
            {messages.map((m, i) => (
              <div className={"chat-message " + m.role} key={i}>
                <b>{m.role === "user" ? "You" : "Ollie"}</b>
                <p>{m.content}</p>
                {m.source && <small>{m.source}</small>}
              </div>
            ))}
            {busy && <p>Calculating from your records…</p>}
          </div>
          <div className="flex flex-wrap gap-2 my-3">
            {["Cash shortage?", "Late customers?", "Financial health?"].map(
              (q) => (
                <button
                  className="btn ghost sm"
                  key={q}
                  disabled={busy}
                  onClick={() => ask(q)}
                >
                  {q}
                </button>
              ),
            )}
          </div>
          <ErrorMessage error={error} />
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              ask(text);
            }}
          >
            <input
              className="input"
              aria-label="Message Ollie"
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
              maxLength={3000}
            />
            <button className="btn sm" disabled={busy}>
              Send
            </button>
          </form>
        </aside>
      )}
    </>
  );
}
