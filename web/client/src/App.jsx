import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { L } from "./translations";
import { AppContext } from "./context";
import Auth from "./pages/Auth";
import Transactions, { TransactionTable } from "./pages/Transactions";
import Scenario from "./pages/Scenario";
import Customers from "./pages/Customers";
import { Health, Seasonal } from "./pages/Insights";
import Profile from "./pages/Profile";
import Chat from "./components/Chat";
import TransactionForm from "./components/TransactionForm";
import {
  Owl,
  Card,
  CashChart,
  Modal,
  Field,
  ErrorMessage,
} from "./components/UI";
function BalanceForm({ opening, onClose, refresh }) {
  const [balance, setBalance] = useState(opening),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Edit opening balance" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("/balance", { balance: Number(balance) });
            await refresh();
            onClose();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          Current cash = opening balance + settled income − settled expenses.
        </p>
        <Field
          label="Opening balance"
          type="number"
          step="1"
          min="-1000000000000"
          max="1000000000000"
          required
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
        />
        <ErrorMessage error={error} />
        <button className="btn" disabled={busy}>
          Save balance
        </button>
      </form>
    </Modal>
  );
}
export default function App() {
  const [lang, setLang] = useState(localStorage.getItem("hh_lang") || "en"),
    [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [mode, setMode] = useState(
      new URLSearchParams(location.search).has("reset") ? "reset" : "landing",
    ),
    [tab, setTab] = useState("ov"),
    [data, setData] = useState(null),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [editor, setEditor] = useState(null),
    [balance, setBalance] = useState(false),
    [db, setDb] = useState(null);
  const t = (k, vars = {}) =>
      Object.entries(vars).reduce(
        (s, [k, v]) => s.replaceAll("{" + k + "}", v),
        L[lang]?.[k] || L.en[k] || k,
      ),
    money = (n) =>
      new Intl.NumberFormat(
        { en: "en-IN", hi: "hi-IN", kn: "kn-IN" }[lang] || "en-IN",
        {
          style: "currency",
          currency: user?.currency || "INR",
          maximumFractionDigits: 0,
        },
      ).format(n),
    notify = useCallback((s) => setMessage(s), []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    api("/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => {})
      .finally(() => setReady(true));
    const unauthorized = () => {
      setUser(null);
      setData(null);
      setMode("login");
    };
    window.addEventListener("hh:unauthorized", unauthorized);
    return () => window.removeEventListener("hh:unauthorized", unauthorized);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const [overview, tx, customers] = await Promise.all([
        api("/overview"),
        api("/transactions"),
        api("/customers"),
      ]);
      setData({ overview, tx, customers });
      setRevision((r) => r + 1);
      setError("");
    } catch (e) {
      setError(e.message);
      throw e;
    }
  }, []);
  useEffect(() => {
    if (user) refresh().catch(() => {});
  }, [user?.id]);
  useEffect(() => {
    localStorage.setItem("hh_lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);
  const overview = data?.overview;
  async function logout() {
    try {
      await api("/auth/logout", {});
      setUser(null);
      setData(null);
      setMode("landing");
      setTab("ov");
    } catch (e) {
      notify(e.message);
    }
  }
  return (
    <AppContext.Provider value={{ t, lang, money, notify }}>
      <header className="hdr">
        <button
          className="brand"
          onClick={() => (user ? setTab("ov") : setMode("landing"))}
        >
          <Owl size={34} />
          <span>
            Hisaab<b>Hoshiyaar</b>
          </span>
        </button>
        <div className="row flex-wrap">
          <button
            className="badge"
            onClick={async () => {
              try {
                setDb(await api(user ? "/db/status" : "/status"));
              } catch (e) {
                notify(e.message);
              }
            }}
          >
            ● MongoDB
          </button>
          <select
            aria-label="Language"
            className="input w-auto"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
          >
            <option value="en">English</option>
            <option value="hi">हिंदी</option>
            <option value="kn">ಕನ್ನಡ</option>
          </select>
          {user ? (
            <button className="btn ghost sm" onClick={logout}>
              {t("logout")}
            </button>
          ) : (
            <>
              <button className="btn ghost sm" onClick={() => setMode("login")}>
                {t("login")}
              </button>
              <button className="btn sm" onClick={() => setMode("register")}>
                {t("start")}
              </button>
            </>
          )}
        </div>
      </header>
      {!ready ? (
        <main className="wrap">
          <p>Checking session…</p>
        </main>
      ) : !user ? (
        <Auth
          key={mode}
          mode={mode}
          setMode={setMode}
          onLogin={(u) => {
            setUser(u);
            setTab("ov");
          }}
        />
      ) : (
        <main className="view wrap">
          <div className="between">
            <p>
              {t("biz")}: <b>{user.biz_name}</b>
            </p>
            <button className="btn ghost sm" onClick={() => setTab("pr")}>
              👤 {user.name}
            </button>
          </div>
          <nav className="tabs" aria-label="Main">
            {["ov", "mo", "si", "fx", "cu", "hl", "se", "pr"].map((v, i) => (
              <button
                key={v}
                className={"tab " + (tab === v ? "on" : "")}
                aria-current={tab === v ? "page" : undefined}
                onClick={() => setTab(v)}
              >
                {t("n" + (i + 1))}
              </button>
            ))}
          </nav>
          <div className="between my-5">
            <h1>
              {t(
                "n" +
                  (["ov", "mo", "si", "fx", "cu", "hl", "se", "pr"].indexOf(
                    tab,
                  ) +
                    1),
              )}
            </h1>
            <div className="row flex-wrap">
              {["ov", "mo"].includes(tab) && (
                <>
                  <button
                    className="btn ghost sm"
                    onClick={() => setBalance(true)}
                  >
                    ✎ Edit Balance
                  </button>
                  <button className="btn sm" onClick={() => setEditor({})}>
                    + Add Transaction
                  </button>
                </>
              )}
              <button
                className="btn ghost sm"
                onClick={() => refresh().catch(() => {})}
              >
                Refresh
              </button>
            </div>
          </div>
          <ErrorMessage error={error} />
          {!data ? (
            <p>Loading your business records…</p>
          ) : (
            <>
              {tab === "ov" && (
                <div className="grid gap-6">
                  <div className="stats-grid">
                    <Card
                      label={t("cash")}
                      value={money(overview.cash_balance)}
                      sub={"Opening: " + money(overview.open_balance)}
                    />
                    <Card
                      label={t("lowest")}
                      value={money(overview.metrics.lo)}
                      color={overview.metrics.lo < 0 ? "neg" : ""}
                    />
                    <Card
                      label={t("short")}
                      value={
                        overview.metrics.s === null
                          ? t("none")
                          : t("week") + " " + overview.metrics.s
                      }
                    />
                    <Card
                      label={t("upc")}
                      value={money(
                        overview.upcoming_transactions.find(
                          (r) => r.dir === "out",
                        )?.amount || 0,
                      )}
                      sub={
                        overview.upcoming_transactions.find(
                          (r) => r.dir === "out",
                        )?.name || t("none")
                      }
                    />
                  </div>
                  <div
                    className={
                      "card " + (overview.metrics.sf ? "amber" : "mint")
                    }
                  >
                    <div className="flex gap-4 items-center">
                      <Owl />
                      <div>
                        <h3>{overview.metrics.sf ? t("aTitle") : t("aOk")}</h3>
                        <p>
                          {overview.metrics.s !== null
                            ? t("aShort", { w: overview.metrics.s })
                            : overview.metrics.sf
                              ? t("aWarn", {
                                  w: overview.weekly_balances.findIndex(
                                    (v) => v < overview.safety_limit,
                                  ),
                                })
                              : t("olDash")}
                        </p>
                        {overview.metrics.causing_transaction && (
                          <p>
                            First transaction causing a shortage:{" "}
                            {overview.metrics.causing_transaction.name} ·{" "}
                            {money(overview.metrics.causing_transaction.amount)}
                          </p>
                        )}
                        <button
                          className="btn ghost sm"
                          onClick={() => setTab("fx")}
                        >
                          {t("explore")}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="card">
                    <h3>{t("chartT")}</h3>
                    <CashChart
                      safe={overview.safety_limit}
                      series={[
                        { name: t("base"), data: overview.weekly_balances },
                      ]}
                    />
                  </div>
                  <div className="card">
                    <div className="between">
                      <h3>{t("upTx")}</h3>
                      <button
                        className="btn ghost sm"
                        onClick={() => setTab("mo")}
                      >
                        {t("viewAll")}
                      </button>
                    </div>
                    <TransactionTable rows={overview.upcoming_transactions} />
                  </div>
                </div>
              )}
              {tab === "mo" && (
                <Transactions
                  tx={data.tx}
                  overview={overview}
                  edit={setEditor}
                  refresh={refresh}
                />
              )}
              {(tab === "si" || tab === "fx") && (
                <Scenario
                  key={tab}
                  tx={data.tx}
                  baseline={overview.weekly_balances}
                  safe={overview.safety_limit}
                  revision={revision}
                  fixOnly={tab === "fx"}
                />
              )}
              {tab === "cu" && (
                <Customers revision={revision} refresh={refresh} />
              )}
              {tab === "hl" && <Health revision={revision} />}
              {tab === "se" && <Seasonal revision={revision} />}
              {tab === "pr" && (
                <Profile
                  user={user}
                  onSaved={async (u) => {
                    setUser(u);
                    await refresh();
                  }}
                />
              )}
            </>
          )}
          {editor && data && (
            <TransactionForm
              transaction={editor.id ? editor : null}
              customers={data.customers}
              onClose={() => setEditor(null)}
              onSaved={refresh}
            />
          )}{" "}
          {balance && overview && (
            <BalanceForm
              opening={overview.open_balance}
              refresh={refresh}
              onClose={() => setBalance(false)}
            />
          )}
          <Chat />
        </main>
      )}
      {db && (
        <Modal title="Database status" onClose={() => setDb(null)}>
          <dl>
            {Object.entries(db).map(([k, v]) => (
              <div className="between" key={k}>
                <dt>{k}</dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
      {message && (
        <div className="hh-toast" role="status">
          {message}
        </div>
      )}
      <footer className="center py-8">HisaabHoshiyaar · {t("tag")}</footer>
    </AppContext.Provider>
  );
}
