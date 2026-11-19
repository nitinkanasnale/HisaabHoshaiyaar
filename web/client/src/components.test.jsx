import React from "react";
import { test, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { AppContext } from "./context";
import Auth from "./pages/Auth";
import TransactionForm from "./components/TransactionForm";
import Chat from "./components/Chat";
import { api } from "./api";
import { Seasonal } from "./pages/Insights";
vi.mock("./api", () => ({ api: vi.fn() }));
const wrap = (ui) =>
  render(
    <AppContext.Provider
      value={{
        t: (k) => k,
        money: (n) => "₹" + n,
        lang: "en",
        notify: vi.fn(),
      }}
    >
      {ui}
    </AppContext.Provider>,
  );
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
test("login submits actual credentials and reports authentication response", async () => {
  api.mockResolvedValue({ user: { name: "Owner" } });
  const onLogin = vi.fn();
  wrap(<Auth mode="login" setMode={vi.fn()} onLogin={onLogin} />);
  fireEvent.change(screen.getByLabelText("email"), {
    target: { value: "owner@example.com" },
  });
  fireEvent.change(screen.getByLabelText("pw"), {
    target: { value: "Password123" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "login" }).closest("form"),
  );
  await waitFor(() => expect(onLogin).toHaveBeenCalledWith({ name: "Owner" }));
  expect(api).toHaveBeenCalledWith(
    "/auth/login",
    expect.objectContaining({
      email: "owner@example.com",
      password: "Password123",
    }),
  );
});
test("transaction form saves numeric data and refreshes before closing", async () => {
  api.mockResolvedValue({ id: "t1" });
  const onSaved = vi.fn(),
    onClose = vi.fn();
  wrap(<TransactionForm customers={[]} onSaved={onSaved} onClose={onClose} />);
  fireEvent.change(screen.getByLabelText("name"), {
    target: { value: "Invoice" },
  });
  fireEvent.change(screen.getByLabelText("amount"), {
    target: { value: "2500" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Save transaction" }).closest("form"),
  );
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(api).toHaveBeenCalledWith(
    "/transactions",
    expect.objectContaining({ amount: 2500, name: "Invoice", cust: null }),
    "POST",
  );
  expect(onSaved).toHaveBeenCalled();
});
test("API errors remain visible and do not close transaction form", async () => {
  api.mockRejectedValue(new Error("Database unavailable"));
  const onClose = vi.fn();
  wrap(<TransactionForm customers={[]} onSaved={vi.fn()} onClose={onClose} />);
  fireEvent.submit(
    screen.getByRole("button", { name: "Save transaction" }).closest("form"),
  );
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe("Database unavailable"),
  );
  expect(onClose).not.toHaveBeenCalled();
});
test("Ollie calls API and renders model output as text, preventing injected HTML", async () => {
  api.mockResolvedValue({
    reply: "<img src=x onerror=alert(1)>",
    source: "Built-in live-data advisor",
  });
  wrap(<Chat />);
  fireEvent.click(screen.getByRole("button", { name: /Ask Ollie/ }));
  fireEvent.change(screen.getByLabelText("Message Ollie"), {
    target: { value: "Cash balance" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Send" }).closest("form"),
  );
  await waitFor(() =>
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy(),
  );
  expect(document.querySelector(".chat-message img")).toBeNull();
});

const seasonalResponse = (income = 15000) => ({
  message: "Limited history",
  history: [],
  forecast: [
    {
      month_name: "Dec",
      year: 2026,
      income,
      expenses: 5000,
      net: income - 5000,
      cash_after: 395000 + income - 5000,
      festival: "",
    },
  ],
});

test("seasonal cards and monthly table display the API's expected income and recomputed cash", async () => {
  api.mockResolvedValue(seasonalResponse());
  wrap(<Seasonal revision={0} />);
  const row = await screen.findByRole("row", { name: /Dec 2026/ });
  expect(
    within(row)
      .getAllByRole("cell")
      .map((c) => c.textContent),
  ).toEqual(["Dec 2026", "₹15000", "₹5000", "₹10000", "₹405000", "—"]);
  expect(api).toHaveBeenCalledWith("/forecast/seasonal?months=6&uplift=1");
  expect(screen.getAllByText("₹15000")).toHaveLength(2);
});

test("seasonal refresh replaces previous values and ignores a late stale response", async () => {
  let finishOld;
  api
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    )
    .mockResolvedValueOnce(seasonalResponse());
  const view = wrap(<Seasonal revision={0} />);
  view.rerender(
    <AppContext.Provider value={{ money: (n) => "₹" + n }}>
      <Seasonal revision={1} />
    </AppContext.Provider>,
  );
  await screen.findByRole("row", { name: /Dec 2026/ });
  finishOld(seasonalResponse(0));
  await waitFor(() => expect(screen.getAllByText("₹15000")).toHaveLength(2));
  expect(screen.queryByText("₹0")).toBeNull();
});

test("failed seasonal refresh hides stale totals and a successful retry clears the error", async () => {
  api
    .mockResolvedValueOnce(seasonalResponse())
    .mockRejectedValueOnce(new Error("Database unavailable"))
    .mockResolvedValueOnce(seasonalResponse());
  const view = wrap(<Seasonal revision={0} />),
    renderRevision = (r) => (
      <AppContext.Provider value={{ money: (n) => "₹" + n }}>
        <Seasonal revision={r} />
      </AppContext.Provider>
    );
  await screen.findByRole("row", { name: /Dec 2026/ });
  view.rerender(renderRevision(1));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Database unavailable",
  );
  expect(screen.queryByText("Forecast income")).toBeNull();
  view.rerender(renderRevision(2));
  await screen.findByRole("row", { name: /Dec 2026/ });
  expect(screen.queryByRole("alert")).toBeNull();
});
