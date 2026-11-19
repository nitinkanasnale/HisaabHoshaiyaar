import { useEffect, useState } from "react";
import { api } from "../api";
import { useApp } from "../context";
import { Field, Card, CashChart, ErrorMessage } from "../components/UI";
const initial = {
  delay_tx: "",
  delay_days: 0,
  supplier_tx: "",
  supplier_shift: 0,
  sales_pct: 0,
  expense_amount: 0,
  expense_day: 30,
  pred: false,
};
export function FixCards({ result, onSelect, selected }) {
  const { t, money } = useApp();
  return (
    <div className="grid md:grid-cols-3 gap-5">
      {result.fixes.map((f, i) => (
        <div
          key={f.id}
          className={"card " + (i === result.best_index ? "mint" : "")}
        >
          <span className="badge">
            {i === result.best_index ? t("best") : "Option " + f.id}
          </span>
          <h3>{t("fx" + f.id)}</h3>
          <p>{f.desc}</p>
          <p>
            {t("lowest")}: <b>{money(f.m.lo)}</b>
          </p>
          <p>
            {t("wb0")}: {f.m.z}
          </p>
          <button
            className="btn ghost sm"
            disabled={!f.eligible}
            onClick={() => onSelect(i)}
          >
            {selected === i ? t("showing") : t("show")}
          </button>
        </div>
      ))}
    </div>
  );
}
export default function Scenario({
  tx,
  baseline,
  safe,
  revision,
  fixOnly = false,
}) {
  const { t, money } = useApp(),
    [s, setS] = useState(initial),
    [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(null);
  const bind = (k) => ({
    value: s[k],
    onChange: (e) =>
      setS({
        ...s,
        [k]: k.endsWith("_tx") ? e.target.value : Number(e.target.value),
      }),
  });
  async function run(values = s) {
    setBusy(true);
    setError("");
    try {
      const r = fixOnly
        ? await api("/fixes")
        : await api("/scenario/simulate", values);
      setResult(r);
      setSelected(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    run();
  }, [revision, fixOnly]);
  const pending = tx.filter((r) => r.status !== "settled"),
    fixResult = result
      ? {
          fixes: result.fixes,
          best_index: fixOnly ? result.best_index : result.best_fix_index,
        }
      : null;
  return (
    <div className="grid gap-6">
      {!fixOnly && (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <h3>{t("cDelay")}</h3>
              <Field label={t("inv")}>
                <select {...bind("delay_tx")}>
                  <option value="">{t("choose")}</option>
                  {pending
                    .filter((r) => r.dir === "in")
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field
                label={t("extra")}
                type="number"
                min="0"
                max="30"
                required
                {...bind("delay_days")}
              />
            </div>
            <div>
              <h3>{t("unexp")}</h3>
              <Field
                label={t("expAmt")}
                type="number"
                min="0"
                step="1"
                required
                {...bind("expense_amount")}
              />
              <Field
                label={t("expIn")}
                type="number"
                min="0"
                max="365"
                required
                {...bind("expense_day")}
              />
            </div>
            <div>
              <h3>{t("sales")}</h3>
              <Field
                label="%"
                type="number"
                min="0"
                max="100"
                required
                {...bind("sales_pct")}
              />
              <p>{t("salesH")}</p>
              <label>
                <input
                  type="checkbox"
                  checked={s.pred}
                  onChange={(e) => setS({ ...s, pred: e.target.checked })}
                />{" "}
                Use customer delay history
              </label>
            </div>
            <div>
              <h3>{t("supT")}</h3>
              <Field label={t("supPay")}>
                <select {...bind("supplier_tx")}>
                  <option value="">{t("choose")}</option>
                  {pending
                    .filter((r) => r.type === "supplier")
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field
                label={t("shift")}
                type="number"
                min="0"
                max="90"
                required
                {...bind("supplier_shift")}
              />
            </div>
          </div>
          <div className="row">
            <button className="btn" disabled={busy}>
              {busy ? "Calculatingâ€¦" : t("apply")}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setS(initial);
                run(initial);
              }}
            >
              {t("reset")}
            </button>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => {
                const v = {
                  ...initial,
                  delay_tx: pending.find((r) => r.dir === "in")?.id || "",
                  delay_days: 20,
                };
                setS(v);
                run(v);
              }}
            >
              20-day delay preset
            </button>
          </div>
        </form>
      )}
      <ErrorMessage error={error} />
      {result && (
        <>
          {!fixOnly && (
            <div className="stats-grid">
              <Card
                label={t("lowest")}
                value={money(result.modified_metrics.lo)}
              />
              <Card
                label={t("sw")}
                value={result.modified_metrics.s ?? t("none")}
              />
              <Card label={t("wb0")} value={result.modified_metrics.z} />
              <Card
                label={t("diff")}
                value={money(
                  result.modified_metrics.lo - result.baseline_metrics.lo,
                )}
              />
            </div>
          )}
          <div className="card">
            <CashChart
              safe={safe}
              series={
                fixOnly
                  ? [
                      { name: t("base"), data: baseline || [] },
                      ...(selected !== null
                        ? [
                            {
                              name: t("fx" + (selected + 1)),
                              data: result.fixes[selected].b,
                            },
                          ]
                        : result.fixes.map((f, i) => ({
                            name: t("fx" + (i + 1)),
                            data: f.b,
                          }))),
                    ]
                  : [
                      { name: t("base"), data: result.baseline },
                      { name: t("mod"), data: result.modified },
                      ...(selected !== null
                        ? [
                            {
                              name: t("fx" + (selected + 1)),
                              data: result.fixes[selected].b,
                            },
                          ]
                        : []),
                    ]
              }
            />
          </div>
          <p>{t("bestN")}</p>
          <FixCards
            result={fixResult}
            selected={selected}
            onSelect={setSelected}
          />
        </>
      )}
    </div>
  );
}
