import { z } from "zod";
const text = z.string().trim().min(1).max(200);
const integer = (min, max) => z.number().int().min(min).max(max);
export const password = z
  .string()
  .min(8)
  .max(72)
  .refine(
    (v) => Buffer.byteLength(v, "utf8") <= 72,
    "Password must fit in 72 UTF-8 bytes",
  );
export const profile = z.object({
  name: text,
  biz_name: text,
  biz_type: z.string().max(100).optional(),
  biz_size: z.string().max(100).optional(),
  country: z.string().max(80).optional(),
  currency: z.enum(["INR", "USD", "GBP", "EUR", "AED", "SGD"]).optional(),
  safetyLimit: integer(0, 1e12).optional(),
});
export const register = profile.extend({
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password,
});
export const login = z.object({
  email: z.email().transform((s) => s.toLowerCase()),
  password: z.string().min(1).max(200),
});
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v);
    return !isNaN(d) && d.toISOString().slice(0, 10) === v;
  }, "Invalid calendar date");
export const transaction = z.object({
  name: text,
  type: z.enum([
    "customer",
    "supplier",
    "expense",
    "payroll",
    "loan",
    "tax",
    "sales",
    "other",
  ]),
  dir: z.enum(["in", "out"]),
  amount: integer(1, 1e12),
  dueDate: date,
  delay: integer(0, 3650).default(0),
  status: z.enum(["expected", "settled", "overdue"]).default("expected"),
  cust: z
    .string()
    .regex(/^[a-f0-9]{24}$/i)
    .nullable()
    .optional(),
  method: z.string().max(50).default("UPI"),
  note: z.string().max(2000).default(""),
});
export const customer = z.object({
  name: text,
  email: z.union([z.email(), z.literal("")]).default(""),
  phone: z
    .string()
    .max(30)
    .regex(/^[+\d\s()-]*$/)
    .default(""),
  history: z.array(integer(0, 3650)).max(1000).default([]),
});
export const scenario = z.object({
  delay_tx: z.string().optional(),
  delay_days: integer(0, 30).default(0),
  supplier_tx: z.string().optional(),
  supplier_shift: integer(0, 90).default(0),
  sales_pct: z.number().min(0).max(100).default(0),
  expense_amount: integer(0, 1e12).default(0),
  expense_day: integer(0, 365).default(30),
  pred: z.boolean().default(false),
});
export const parse = (schema, data) => schema.parse(data);
