import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
import mongoose from "mongoose";
import { secret } from "./auth.js";
// Dynamic import ensures middleware configuration sees environment values.
try {
  secret();
  if (!process.env.MONGODB_URI)
    throw new Error("Set MONGODB_URI in the project root .env.");
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
  });
  const { app } = await import("./app.js");
  const server = app.listen(Number(process.env.PORT || 5000), () =>
    console.log(
      `HisaabHoshiyaar: http://127.0.0.1:${process.env.PORT || 5000}`,
    ),
  );
  async function stop() {
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  }
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
} catch (e) {
  console.error(
    "Startup failed:",
    e.message.replace(
      /mongodb(?:\+srv)?:\/\/[^\s]+/g,
      "[MongoDB URI redacted]",
    ),
  );
  process.exit(1);
}
