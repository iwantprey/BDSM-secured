import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import bcrypt from "bcryptjs";
import { pool } from "../src/db.js";

const terminal = createInterface({ input: stdin, output: stdout });
try {
  const email = (await terminal.question("Seeded administrator email: ")).trim().toLowerCase();
  const password = await terminal.question("New password (6-72 characters; input will be visible): ");
  if (password.length < 12 || password.length > 72 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Password must be 6-72 characters and no more than 72 UTF-8 bytes");
  }
  const hash = await bcrypt.hash(password, 12);
  const [result] = await pool.execute("UPDATE system_users SET password_hash = ? WHERE email = ? AND role = 'admin'", [hash, email]);
  if (!(result as { affectedRows: number }).affectedRows) throw new Error("No administrator found with that email");
  console.log("Administrator password set. Sign in with this email and password.");
} finally {
  terminal.close();
  await pool.end();
}

