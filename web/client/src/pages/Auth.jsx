import { useState } from "react";
import { api } from "../api";
import { useApp } from "../context";
import { Field, Owl, ErrorMessage } from "../components/UI";
export default function Auth({ mode, setMode, onLogin }) {
  const { t } = useApp(),
    [step, setStep] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [show, setShow] = useState(false),
    [data, setData] = useState({
      name: "",
      email: "",
      password: "",
      confirm: "",
      biz_name: "",
      biz_type: "Retail Store",
      biz_size: "Just me",
      country: "India",
      currency: "INR",
    }),
    [newPassword, setNewPassword] = useState("");
  const bind = (k) => ({
    value: data[k],
    onChange: (e) => setData({ ...data, [k]: e.target.value }),
  });
  async function submit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (mode === "register" && step === 1) {
      if (data.password !== data.confirm) {
        setError(t("eMatch"));
        return;
      }
      setStep(2);
      return;
    }
    setBusy(true);
    try {
      if (mode === "forgot") {
        const r = await api("/auth/forgot-password", { email: data.email });
        setMessage(r.message);
      } else if (mode === "reset") {
        await api("/auth/reset-password", {
          token: new URLSearchParams(location.search).get("reset"),
          new_password: newPassword,
        });
        history.replaceState(null, "", location.pathname);
        setMode("login");
        setMessage("Password reset. Please log in.");
      } else {
        const r = await api(
          "/auth/" + (mode === "register" ? "register" : "login"),
          data,
        );
        onLogin(r.user);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (mode === "landing")
    return (
      <section className="view hero">
        <div>
          <h1 className="big">
            Hisaab<b>Hoshiyaar</b>
          </h1>
          <p className="tag">{t("tag")}</p>
          <p>{t("intro")}</p>
          <div className="row gap-4">
            <button className="btn" onClick={() => setMode("login")}>
              {t("login")}
            </button>
            <button className="btn ghost" onClick={() => setMode("register")}>
              {t("start")}
            </button>
          </div>
        </div>
        <div className="center">
          <Owl size={220} />
          <div className="bubble">{t("olWelcome")}</div>
        </div>
      </section>
    );
  return (
    <section className="view auth">
      <div className="say">
        <Owl />
        <div className="bubble">{t("tag")}</div>
      </div>
      <form className="card" onSubmit={submit}>
        <h2>
          {mode === "register"
            ? t("create")
            : mode === "forgot"
              ? "Recover password"
              : mode === "reset"
                ? "Reset password"
                : t("login")}
        </h2>
        {mode === "register" && (
          <>
            <p>{t("step", { a: step })}</p>
            <div className="bar">
              <i style={{ width: step * 50 + "%" }} />
            </div>
          </>
        )}
        {mode !== "reset" && (
          <>
            {mode === "register" && step === 1 && (
              <Field
                label={t("ownerName")}
                required
                autoComplete="name"
                {...bind("name")}
              />
            )}
            {(mode !== "register" || step === 1) && (
              <Field
                label={t("email")}
                type="email"
                required
                autoComplete="email"
                {...bind("email")}
              />
            )}
            {(mode === "login" || (mode === "register" && step === 1)) && (
              <>
                <Field
                  label={t("pw")}
                  type={show ? "text" : "password"}
                  minLength={8}
                  maxLength={72}
                  required
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  {...bind("password")}
                />
                <label>
                  <input
                    type="checkbox"
                    checked={show}
                    onChange={(e) => setShow(e.target.checked)}
                  />{" "}
                  Show password
                </label>
              </>
            )}
            {mode === "register" && step === 1 && (
              <Field
                label={t("pw2")}
                type="password"
                minLength={8}
                required
                {...bind("confirm")}
              />
            )}
            {mode === "register" && step === 2 && (
              <>
                <Field label={t("bizName")} required {...bind("biz_name")} />
                <Field label={t("bizType")}>
                  <select {...bind("biz_type")}>
                    {[
                      "Retail Store",
                      "Wholesale",
                      "Services",
                      "Manufacturing",
                      "Other",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t("bizSize")}>
                  <select {...bind("biz_size")}>
                    {["Just me", "Micro", "Small", "Medium"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t("country")} {...bind("country")} />
                <Field label={t("currency")}>
                  <select {...bind("currency")}>
                    {["INR", "USD", "GBP", "EUR", "AED", "SGD"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </Field>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => setStep(1)}
                >
                  {t("back")}
                </button>
              </>
            )}
          </>
        )}
        {mode === "reset" && (
          <Field
            label="New password"
            type="password"
            minLength={8}
            maxLength={72}
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        )}
        <ErrorMessage error={error} />
        {message && <p role="status">{message}</p>}
        <button disabled={busy} className="btn block mt-4">
          {busy
            ? "Please wait…"
            : mode === "register" && step === 1
              ? t("next")
              : mode === "login"
                ? t("login")
                : mode === "register"
                  ? t("create")
                  : "Submit"}
        </button>
        <div className="flex flex-wrap gap-4 mt-4">
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setMode(mode === "register" ? "login" : "register");
              setError("");
              setMessage("");
              setStep(1);
            }}
          >
            {mode === "register" ? t("haveAcc") : t("newAcc")}
          </button>
          {mode === "login" && (
            <button
              type="button"
              className="text-link"
              onClick={() => setMode("forgot")}
            >
              {t("forgot")}
            </button>
          )}
          <button
            type="button"
            className="text-link"
            onClick={() => setMode("landing")}
          >
            Home
          </button>
        </div>
      </form>
    </section>
  );
}
