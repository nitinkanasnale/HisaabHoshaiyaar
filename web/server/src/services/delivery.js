import nodemailer from "nodemailer";
export const mailConfigured = () =>
  !!(process.env.SMTP_HOST && process.env.MAIL_FROM);
export async function sendMail(to, subject, text) {
  if (!mailConfigured())
    throw Object.assign(
      new Error(
        "Email delivery is not configured. Set SMTP_HOST and MAIL_FROM.",
      ),
      { status: 503 },
    );
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === "465",
    ...(process.env.SMTP_USER
      ? {
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        }
      : {}),
  });
  await transport.sendMail({ from: process.env.MAIL_FROM, to, subject, text });
}
export async function sendSms(to, body) {
  const {
    TWILIO_SID: sid,
    TWILIO_TOKEN: token,
    TWILIO_FROM: from,
  } = process.env;
  if (!sid || !token || !from)
    throw Object.assign(new Error("SMS delivery is not configured."), {
      status: 503,
    });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: to, Body: body }),
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!res.ok) throw new Error("SMS provider rejected delivery");
}
