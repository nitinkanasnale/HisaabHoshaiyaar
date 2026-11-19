import mongoose from "mongoose";
const { Schema } = mongoose;
const opts = {
  timestamps: true,
  toJSON: {
    transform(_doc, ret) {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.__v;
      delete ret.passwordHash;
      delete ret.resetHash;
      delete ret.resetExpires;
      delete ret.tokenVersion;
      return ret;
    },
  },
};
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    biz_name: { type: String, required: true },
    biz_type: { type: String, default: "" },
    biz_size: { type: String, default: "" },
    country: { type: String, default: "India" },
    currency: { type: String, default: "INR" },
    openingBalance: { type: Number, default: 0 },
    safetyLimit: { type: Number, default: 100000 },
    tokenVersion: { type: Number, default: 0 },
    resetHash: { type: String, select: false },
    resetExpires: { type: Date, select: false },
  },
  opts,
);
const owned = {
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
};
const customerSchema = new Schema(
  {
    ...owned,
    name: { type: String, required: true },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    history: { type: [Number], default: [] },
    legacyId: String,
  },
  opts,
);
const txSchema = new Schema(
  {
    ...owned,
    name: { type: String, required: true },
    cust: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    type: {
      type: String,
      enum: [
        "customer",
        "supplier",
        "expense",
        "payroll",
        "loan",
        "tax",
        "sales",
        "other",
      ],
      required: true,
    },
    dir: { type: String, enum: ["in", "out"], required: true },
    amount: { type: Number, required: true, min: 1 },
    dueDate: { type: String, required: true },
    delay: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["expected", "settled", "overdue"],
      default: "expected",
    },
    method: { type: String, default: "UPI" },
    settledAt: Date,
    note: { type: String, default: "" },
    legacyId: String,
  },
  opts,
);
txSchema.index({ owner: 1, dueDate: 1 });
const reminderSchema = new Schema(
  {
    ...owned,
    customer: { type: Schema.Types.ObjectId, ref: "Customer" },
    cust: String,
    ch: String,
    msg: String,
    status: String,
    ts: Number,
  },
  opts,
);
export const User = mongoose.model("User", userSchema);
export const Customer = mongoose.model("Customer", customerSchema);
export const Transaction = mongoose.model("Transaction", txSchema);
export const Reminder = mongoose.model("Reminder", reminderSchema);
