import { useEffect, useState } from "react";
import { api } from "../api";
import { useApp } from "../context";
import {
  Card,
  Field,
  SeasonalChart,
  Table,
  ErrorMessage,
} from "../components/UI";
export function Health({ revision }) {
  const { money } = useApp(),
    [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("/health-score")
      .then(setData)
      .catch((e) => setError(e.message));
  }, [revision]);
  return (
    <>
      <ErrorMessage error={error} />
      {data && (
        <div className="grid gap-6">
          <div className="card mint center">
            <div className="val">{data.score}/100</div>
            <h2>{data.label}</h2>
            {!data.hasData && (
              <p>Add transactions to build a meaningful health score.</p>
            )}
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {data.comps.map((c) => (
              <div className="card" key={c.k}>
                <h3>{c.name}</h3>
                <p>
                  {Math.round(c.w * c.s)} / {c.w} points
                </p>
                <div className="bar">
                  <i style={{ width: c.s * 100 + "%" }} />
                </div>
              </div>
            ))}
          </div>
          <div className="card">
            <h3>Suggested actions</h3>
            {data.recommendations.length ? (
              data.recommendations.map((r) => <p key={r}>{r}</p>)
            ) : (
              <p>Your financial indicators are healthy.</p>
            )}
            <p>
              At-risk receivables: {money(data.risk)} · Operating margin:{" "}
              {Math.round(data.mg * 100)}%
            </p>
          </div>
        </div>
      )}
    </>
  );
}
export function Seasonal({ revision }) {
  const { money } = useApp(),
    [months, setMonths] = useState(6),
    [uplift, setUplift] = useState(1),
    [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    api(`/forecast/seasonal?months=${months}&uplift=${uplift}`)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [revision, months, uplift]);
  return (
    <div className="grid gap-6">
      <div className="card two">
        <Field label="Forecast horizon">
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
          >
            {[3, 6, 12, 24].map((v) => (
              <option key={v} value={v}>
                {v} months
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={"Seasonal uplift × " + uplift}
          type="range"
          min="0"
          max="3"
          step="0.1"
          value={uplift}
          onChange={(e) => setUplift(Number(e.target.value))}
        />
      </div>
      <ErrorMessage error={error} />
      {!data && !error && <p role="status">Loading seasonal forecast…</p>}
      {data && (
        <>
          <p role="status">{data.message}</p>
          <p>
            Forecast totals combine the historical seasonal estimate with
            expected and overdue payments scheduled in each month, using due
            date plus delay. Scheduled amounts are included once and keep their
            status.
          </p>
          {!!data.forecast.length && (
            <>
              <div className="stats-grid">
                <Card
                  label="Lowest projected cash"
                  value={money(
                    Math.min(...data.forecast.map((r) => r.cash_after)),
                  )}
                />
                <Card
                  label="Forecast income"
                  value={money(data.forecast.reduce((s, r) => s + r.income, 0))}
                />
                <Card
                  label="Forecast expenses"
                  value={money(
                    data.forecast.reduce((s, r) => s + r.expenses, 0),
                  )}
                />
              </div>
              <div className="card">
                <SeasonalChart rows={data.forecast} />
                <Table
                  headers={[
                    "Month",
                    "Income",
                    "Expenses",
                    "Net",
                    "Cash after",
                    "Festival / season",
                  ]}
                >
                  {data.forecast.map((r, i) => (
                    <tr key={i}>
                      <td>
                        {r.month_name} {r.year}
                      </td>
                      <td>{money(r.income)}</td>
                      <td>{money(r.expenses)}</td>
                      <td>{money(r.net)}</td>
                      <td>{money(r.cash_after)}</td>
                      <td>{r.festival || "—"}</td>
                    </tr>
                  ))}
                </Table>
              </div>
            </>
          )}
          <details className="card">
            <summary>
              Actual monthly history ({data.history.length} months)
            </summary>
            <Table headers={["Month", "Income", "Expenses"]}>
              {data.history.map((r) => (
                <tr key={r.i}>
                  <td>
                    {r.month_name} {r.y}
                  </td>
                  <td>{money(r.rev)}</td>
                  <td>{money(r.exp)}</td>
                </tr>
              ))}
            </Table>
          </details>
        </>
      )}
    </div>
  );
}
