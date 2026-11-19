import jwt from "jsonwebtoken";
import { User } from "./models.js";
export function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32 || s.startsWith("REPLACE_"))
    throw new Error(
      "Configure a random JWT_SECRET with at least 32 characters.",
    );
  return s;
}
export const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
});
export function issue(res, user) {
  const token = jwt.sign({ ver: user.tokenVersion }, secret(), {
    subject: String(user._id),
    expiresIn: "8h",
    issuer: "hisaab-hoshiyaar",
    audience: "hh-client",
  });
  res.cookie("hh_session", token, { ...cookieOptions(), maxAge: 8 * 3600000 });
}
export async function authenticate(req, res, next) {
  try {
    const token =
      req.cookies.hh_session ||
      req.headers.authorization?.replace(/^Bearer /, "");
    if (!token) return res.status(401).json({ detail: "Please log in." });
    const p = jwt.verify(token, secret(), {
      algorithms: ["HS256"],
      issuer: "hisaab-hoshiyaar",
      audience: "hh-client",
    });
    const user = await User.findById(p.sub);
    if (!user || p.ver !== user.tokenVersion)
      return res.status(401).json({ detail: "Session expired." });
    req.user = user;
    next();
  } catch (e) {
    if (
      e.name === "JsonWebTokenError" ||
      e.name === "TokenExpiredError" ||
      e.name === "CastError"
    )
      return res.status(401).json({ detail: "Invalid or expired session." });
    next(e);
  }
}
