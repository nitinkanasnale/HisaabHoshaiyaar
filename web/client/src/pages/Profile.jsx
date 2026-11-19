import { useState } from "react";
import { api } from "../api";
import { useApp } from "../context";
import { Field, ErrorMessage } from "../components/UI";
export default function Profile({ user, onSaved }) {
  const { t, notify } = useApp(),
    [d, setD] = useState(user),
    [pw, setPw] = useState({ current_password: "", new_password: "" }),
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
      const r = await api("/users", {
        ...d,
        safetyLimit: Number(d.safetyLimit),
      });
      await onSaved(r.user);
      notify("Profile saved.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function password(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/auth/change-password", pw);
      setPw({ current_password: "", new_password: "" });
      notify("Password updated.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <form className="card" onSubmit={save}>
        <h2>Business profile</h2>
        <Field label={t("ownerName")} required {...bind("name")} />
        <Field label={t("email")} value={user.email} readOnly />
        <Field label={t("bizName")} required {...bind("biz_name")} />
        <Field label={t("bizType")} {...bind("biz_type")} />
        <Field label={t("bizSize")} {...bind("biz_size")} />
        <Field label={t("country")} {...bind("country")} />
        <Field label={t("currency")}>
          <select {...bind("currency")}>
            {["INR", "USD", "GBP", "EUR", "AED", "SGD"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
        <p>
          Currency changes display labels; it does not convert saved amounts.
        </p>
        <Field
          label={t("safety")}
          type="number"
          min="0"
          max="1000000000000"
          required
          {...bind("safetyLimit")}
        />
        <button className="btn" disabled={busy}>
          Save profile
        </button>
      </form>
      <div>
        <form className="card" onSubmit={password}>
          <h2>Change password</h2>
          <Field
            label="Current password"
            type="password"
            required
            autoComplete="current-password"
            value={pw.current_password}
            onChange={(e) => setPw({ ...pw, current_password: e.target.value })}
          />
          <Field
            label="New password"
            type="password"
            minLength={8}
            maxLength={72}
            required
            autoComplete="new-password"
            value={pw.new_password}
            onChange={(e) => setPw({ ...pw, new_password: e.target.value })}
          />
          <button className="btn" disabled={busy}>
            Update password
          </button>
        </form>
        <ErrorMessage error={error} />
      </div>
    </div>
  );
}
