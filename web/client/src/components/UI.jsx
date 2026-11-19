import React, { useEffect, useRef, useId } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { useApp } from "../context";
export function Owl({ size = 80 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Ollie the Owl"
    >
      <path d="M26 42L20 12 48 30ZM94 42L100 12 72 30Z" fill="#10243A" />
      <ellipse cx="60" cy="72" rx="40" ry="40" fill="#009688" />
      <ellipse cx="60" cy="88" rx="24" ry="22" fill="#D9F5EF" />
      <circle cx="44" cy="56" r="17" fill="white" />
      <circle cx="76" cy="56" r="17" fill="white" />
      <circle cx="44" cy="57" r="8" fill="#10243A" />
      <circle cx="76" cy="57" r="8" fill="#10243A" />
      <path d="M60 62L53 73H67Z" fill="#FFB000" />
      <path d="M44 112h12M64 112h12" stroke="#FFB000" strokeWidth="5" />
    </svg>
  );
}
export function Field({ label, children, ...props }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children ? (
        React.cloneElement(children, {
          id,
          className: "input " + (children.props.className || ""),
        })
      ) : (
        <input id={id} className="input" {...props} />
      )}
    </div>
  );
}
export function Card({ label, value, sub, color = "" }) {
  return (
    <div className="card">
      <div className="lbl">{label}</div>
      <div className={"val " + color}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
export function Modal({ title, onClose, children }) {
  const ref = useRef();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog ref={ref} className="hh-modal" onCancel={onClose}>
      <div className="between">
        <h2>{title}</h2>
        <button
          className="btn ghost sm"
          onClick={onClose}
          aria-label="Close dialog"
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ErrorMessage({ error }) {
  return error ? (
    <p className="err" role="alert">
      {error}
    </p>
  ) : null;
}
export function CashChart({ series, safe }) {
  const { money, t } = useApp(),
    data = (series[0]?.data || []).map((_, i) => ({
      week: i,
      ...Object.fromEntries(series.map((s) => [s.name, s.data[i]])),
    }));
  return (
    <div className="chart-frame" role="img" aria-label={t("chartT")}>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart
          data={data}
          margin={{ top: 20, right: 24, bottom: 10, left: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="week"
            tickFormatter={(v) => (v === 0 ? t("now") : t("week") + " " + v)}
          />
          <YAxis
            tickFormatter={(v) =>
              new Intl.NumberFormat("en-IN", { notation: "compact" }).format(v)
            }
          />
          <Tooltip formatter={(v) => money(v)} />
          <Legend />
          <ReferenceLine y={0} stroke="#DC2626" />
          <ReferenceLine
            y={safe}
            stroke="#B58B00"
            strokeDasharray="6 4"
            label={t("safety")}
          />
          {series.map((s, i) => (
            <Line
              key={s.name}
              type="linear"
              dataKey={s.name}
              stroke={
                s.color || ["#009688", "#7C3AED", "#2563EB", "#DC2626"][i]
              }
              strokeWidth={3}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
export function SeasonalChart({ rows }) {
  const { money } = useApp();
  return (
    <div className="chart-frame">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={rows.map((r) => ({ ...r, label: r.month_name + " " + r.year }))}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis
            tickFormatter={(v) =>
              new Intl.NumberFormat("en", { notation: "compact" }).format(v)
            }
          />
          <Tooltip formatter={(v) => money(v)} />
          <Legend />
          <Bar dataKey="income" fill="#009688" />
          <Bar dataKey="expenses" fill="#FF4D4D" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function Table({ headers, children, empty }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty && <p className="center py-6">{empty}</p>}
    </div>
  );
}
