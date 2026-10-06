import "dotenv/config";
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import helmet from "helmet/index.cjs";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { pool } from "./db.js";
import { isEmailConfigured, sendPasswordResetCode } from "./mailer.js";

const port = Number(process.env.PORT ?? 3001);
const frontendOrigins = (process.env.FRONTEND_ORIGIN ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
const authSecret = process.env.AUTH_SECRET;
if (!authSecret || authSecret.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters");
const sessionSecret = authSecret;

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: frontendOrigins.length ? frontendOrigins : false, credentials: true, methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] }));
app.use(express.json({ limit: "100kb" }));

type AuthUser = { id: string; name: string; email: string; role: "resident" | "staff" | "admin"; barangay: string; address: string | null; phone: string | null };
declare global {
  namespace Express { interface Request { authUser?: AuthUser } }
}

function signSession(user: AuthUser) {
  const payload = Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 })).toString("base64url");
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function clearSession(res: express.Response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `dmms_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
}

async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const token = req.headers.cookie?.split(";").map((item) => item.trim()).find((item) => item.startsWith("dmms_session="))?.slice("dmms_session=".length);
    if (!token) return res.status(401).json({ error: "Sign in required" });
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return res.status(401).json({ error: "Invalid session" });
    const expected = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
    const suppliedBytes = Buffer.from(signature);
    const expectedBytes = Buffer.from(expected);
    if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) return res.status(401).json({ error: "Invalid session" });
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: string; exp?: number };
    if (!claims.sub || !claims.exp || claims.exp <= Date.now() / 1000) return res.status(401).json({ error: "Session expired" });
    const [rows] = await pool.execute("SELECT id, name, email, role, barangay, address, phone FROM system_users WHERE id = ? AND status = 'active'", [claims.sub]);
    const user = (rows as AuthUser[])[0];
    if (!user) return res.status(401).json({ error: "Account unavailable" });
    req.authUser = user;
    next();
  } catch (error) { respondWithError(error, res); }
}

function requireRole(...allowed: AuthUser["role"][]): express.RequestHandler {
  return (req, res, next) => {
    if (!req.authUser || !allowed.includes(req.authUser.role)) return res.status(403).json({ error: "You do not have permission for this action" });
    next();
  };
}

const loginAttempts = new Map<string, { count: number; windowStartedAt: number; blockedUntil: number }>();
const captchaChallenges = new Map<string, { answerHash: string; expiresAt: number }>();
const passwordResetRequests = new Map<string, { count: number; startedAt: number }>();
const passwordResetIpRequests = new Map<string, { count: number; startedAt: number }>();
const LOGIN_WINDOW_MS = 5 * 60_000;
const CAPTCHA_AFTER_FAILURES = 3;
const CAPTCHA_TTL_MS = 2 * 60_000;

function loginKey(req: express.Request, email: string) {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  return createHmac("sha256", sessionSecret).update(`${ip}:${email.trim().toLowerCase()}`).digest("hex");
}

function activeLoginAttempt(key: string, now: number) {
  const current = loginAttempts.get(key);
  if (!current || now - current.windowStartedAt >= LOGIN_WINDOW_MS) {
    const fresh = { count: 0, windowStartedAt: now, blockedUntil: 0 };
    loginAttempts.set(key, fresh);
    return fresh;
  }
  return current;
}

function issueCaptcha() {
  const left = randomInt(2, 10);
  const right = randomInt(2, 10);
  const id = randomUUID();
  const answerHash = createHmac("sha256", sessionSecret).update(`${id}:${left + right}`).digest("hex");
  captchaChallenges.set(id, { answerHash, expiresAt: Date.now() + CAPTCHA_TTL_MS });
  return { id, question: `What is ${left} + ${right}?` };
}

function consumeCaptcha(id: string, answer: string) {
  const challenge = captchaChallenges.get(id);
  captchaChallenges.delete(id);
  if (!challenge || challenge.expiresAt <= Date.now()) return false;
  const providedHash = createHmac("sha256", sessionSecret).update(`${id}:${answer.trim()}`).digest("hex");
  const expected = Buffer.from(challenge.answerHash);
  const provided = Buffer.from(providedHash);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, attempt] of loginAttempts) if (now - attempt.windowStartedAt >= LOGIN_WINDOW_MS) loginAttempts.delete(key);
  for (const [id, challenge] of captchaChallenges) if (challenge.expiresAt <= now) captchaChallenges.delete(id);
  for (const [key, attempt] of passwordResetRequests) if (now - attempt.startedAt >= 15 * 60_000) passwordResetRequests.delete(key);
  for (const [key, attempt] of passwordResetIpRequests) if (now - attempt.startedAt >= 15 * 60_000) passwordResetIpRequests.delete(key);
}, 60_000).unref();

const reportStatuses = ["pending", "verified", "in-progress", "resolved", "rejected"] as const;
const priorities = ["low", "medium", "high"] as const;
const roles = ["resident", "staff", "admin"] as const;
const reportCreateSchema = z.object({
  location: z.string().trim().min(1).max(255),
  type: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(5000),
  priority: z.enum(priorities).default("medium"),
});
const reportUpdateSchema = reportCreateSchema.partial().extend({
  status: z.enum(reportStatuses).optional(),
  assignedToUserId: z.string().max(50).nullable().optional(),
});
const userSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  role: z.enum(roles),
  barangay: z.string().trim().min(1).max(160).optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]).default("active"),
});
const accountPasswordSchema = z.string().min(6).max(72)
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be at most 72 UTF-8 bytes");
const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72) });
const registrationSchema = z.object({
  name: z.string().trim().min(2).max(50).regex(/^[\p{L}\p{M} .'-]+$/u, "Use letters, spaces, hyphens, apostrophes, or periods only"),
  email: z.string().trim().toLowerCase().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address").max(254),
  password: accountPasswordSchema,
  confirmPassword: z.string(),
  role: z.enum(["resident"]),
  address: z.string().trim().min(1, "Home address is required").max(255),
  phone: z.string().trim().max(40).default(""),
}).refine((value) => value.password === value.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
const profileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  address: z.string().trim().min(1).max(255).optional(),
  phone: z.string().trim().max(40).optional(),
});
const settingsSchema = z.object({
  system_name: z.string().trim().min(1).max(160),
  barangay_name: z.string().trim().min(1).max(160),
  contact_email: z.string().trim().email().max(254),
  report_prefix: z.string().trim().regex(/^[A-Z0-9]{1,8}$/),
  notifications_enabled: z.boolean(),
}).strict();
const inspectionCreateSchema = z.object({
  reportId: z.string().min(1).max(20),
  inspectionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  inspectionTime: z.string().regex(/^\d{2}:\d{2}$/),
  inspectorUserId: z.string().min(1).max(50),
  notes: z.string().max(5000).default(""),
});
const maintenanceSchema = z.object({
  assignedToUserId: z.string().max(50).nullable().default(null),
  estimatedCost: z.preprocess((value) => value === "" || value === null ? null : value, z.coerce.number().min(0).max(9999999999).nullable()).default(null),
  materials: z.string().max(5000).default(""),
  notes: z.string().max(5000).default(""),
});

function makeId(prefix: string) {
  return `${prefix}-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function respondWithError(error: unknown, res: express.Response) {
  const code = (error as { code?: string })?.code;
  if (code === "ER_DUP_ENTRY") return res.status(409).json({ error: "A record with that unique value already exists" });
  if (code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ error: "Referenced report does not exist" });
  if (code === "ER_ROW_IS_REFERENCED_2") return res.status(409).json({ error: "This account is linked to existing reports. Deactivate it instead of deleting it." });
  console.error("API request failed", error);
  return res.status(500).json({ error: "Internal server error" });
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.execute("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json({ status: "error", database: "unavailable" });
  }
});

app.post("/api/auth/captcha", (req, res) => {
  const parsed = z.object({ email: z.string().trim().email().max(254) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid email address" });
  const key = loginKey(req, parsed.data.email);
  const attempt = activeLoginAttempt(key, Date.now());
  if (attempt.blockedUntil > Date.now()) return res.status(429).json({ error: "Too many sign-in attempts. Try again in five minutes." });
  if (attempt.count < CAPTCHA_AFTER_FAILURES) return res.json({ data: { required: false } });
  res.json({ data: { required: true, ...issueCaptcha() } });
});

app.post("/api/auth/password-reset/request", async (req, res) => {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(254) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid email address" });
  if (!isEmailConfigured()) return res.status(503).json({ error: "Password reset email is not configured. Contact the system administrator." });
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const ipKey = createHmac("sha256", sessionSecret).update(ip).digest("hex");
  const rateKey = createHmac("sha256", sessionSecret).update(`${ip}:${parsed.data.email}`).digest("hex");
  const now = Date.now();
  const rate = passwordResetRequests.get(rateKey);
  const ipRate = passwordResetIpRequests.get(ipKey);
  if (ipRate && now - ipRate.startedAt < 15 * 60_000 && ipRate.count >= 10) return res.status(429).json({ error: "Too many reset requests from this network. Try again in 15 minutes." });
  if (rate && now - rate.startedAt < 15 * 60_000 && rate.count >= 3) return res.status(429).json({ error: "Too many reset requests. Try again in 15 minutes." });
  passwordResetRequests.set(rateKey, rate && now - rate.startedAt < 15 * 60_000 ? { ...rate, count: rate.count + 1 } : { count: 1, startedAt: now });
  passwordResetIpRequests.set(ipKey, ipRate && now - ipRate.startedAt < 15 * 60_000 ? { ...ipRate, count: ipRate.count + 1 } : { count: 1, startedAt: now });
  try {
    const email = parsed.data.email;
    const [rows] = await pool.execute("SELECT id FROM system_users WHERE email = ? AND status = 'active' LIMIT 1", [email]);
    const user = (rows as { id: string }[])[0];
    if (user) {
      const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
      const otpHash = createHmac("sha256", sessionSecret).update(`${user.id}:${email}:${code}`).digest("hex");
      const id = randomUUID();
      await pool.execute("UPDATE password_reset_otps SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL", [user.id]);
      await pool.execute("INSERT INTO password_reset_otps (id, user_id, email, otp_hash, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 10 MINUTE))", [id, user.id, email, otpHash]);
      try {
        await sendPasswordResetCode(email, code);
      } catch (error) {
        await pool.execute("UPDATE password_reset_otps SET used_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
        console.error("Password reset email delivery failed", error);
        const details = String((error as { message?: string })?.message ?? "");
        let message = "Check the API terminal and SMTP settings.";
        if (/\b(534|535)\b|authentication|username and password/i.test(details)) {
          message = "Gmail rejected SMTP sign-in. Use the sending Gmail address and its 16-character Google App Password, not the normal account password.";
        } else if (/\b(550|553)\b|sender.*reject/i.test(details)) {
          message = "Gmail rejected the sender address. Set SMTP_FROM to the same address as SMTP_USER.";
        } else if (/ECONN|ETIMEDOUT|ENOTFOUND|TLS|certificate|timed out/i.test(details)) {
          message = "Could not connect securely to Gmail SMTP on port 465. Check the network, SMTP_HOST, and SMTP_PORT.";
        }
        return res.status(502).json({ error: `The reset email could not be delivered. ${message}` });
      }
    }
    res.json({ message: "If an active account uses that email, a six-digit reset code has been sent." });
  } catch (error) { respondWithError(error, res); }
});

app.post("/api/auth/password-reset/confirm", async (req, res) => {
  const parsed = z.object({
    email: z.string().trim().toLowerCase().email().max(254),
    otp: z.string().regex(/^\d{6}$/, "Enter the six-digit code"),
    password: accountPasswordSchema,
    confirmPassword: z.string(),
  }).refine((value) => value.password === value.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map((issue) => issue.message).join(" ") });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute("SELECT id, user_id AS userId, otp_hash AS otpHash, attempts FROM password_reset_otps WHERE email = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1 FOR UPDATE", [parsed.data.email]);
    const reset = (rows as { id: string; userId: string; otpHash: string; attempts: number }[])[0];
    if (!reset || reset.attempts >= 5) {
      await connection.commit();
      return res.status(400).json({ error: "The code is invalid or expired. Request a new code." });
    }
    const suppliedHash = createHmac("sha256", sessionSecret).update(`${reset.userId}:${parsed.data.email}:${parsed.data.otp}`).digest("hex");
    const expected = Buffer.from(reset.otpHash);
    const supplied = Buffer.from(suppliedHash);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      await connection.execute("UPDATE password_reset_otps SET used_at = IF(attempts >= 4, CURRENT_TIMESTAMP, used_at), attempts = attempts + 1 WHERE id = ?", [reset.id]);
      await connection.commit();
      return res.status(400).json({ error: "The code is invalid or expired. Request a new code." });
    }
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await connection.execute("UPDATE system_users SET password_hash = ? WHERE id = ? AND status = 'active'", [passwordHash, reset.userId]);
    await connection.execute("UPDATE password_reset_otps SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL", [reset.userId]);
    await connection.commit();
    res.json({ message: "Password reset successfully. You can now sign in with your new password." });
  } catch (error) { await connection.rollback(); respondWithError(error, res); }
  finally { connection.release(); }
});

app.post("/api/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid email and password" });
  const email = parsed.data.email.trim().toLowerCase();
  const key = loginKey(req, email);
  const now = Date.now();
  const attempt = activeLoginAttempt(key, now);
  if (attempt.blockedUntil > now) return res.status(429).json({ error: "Too many sign-in attempts. Try again in five minutes." });
  const needsCaptcha = attempt.count >= CAPTCHA_AFTER_FAILURES;
  const captchaSchema = z.object({ captchaId: z.string().uuid(), captchaAnswer: z.string().trim().min(1).max(20) });
  const captcha = captchaSchema.safeParse(req.body);
  if (needsCaptcha && (!captcha.success || !consumeCaptcha(captcha.data.captchaId, captcha.data.captchaAnswer))) {
    attempt.count += 1;
    if (attempt.count >= 10) attempt.blockedUntil = now + LOGIN_WINDOW_MS;
    return res.status(400).json({ error: "Complete the CAPTCHA challenge to continue.", captchaRequired: true });
  }
  try {
    const [rows] = await pool.execute("SELECT id, name, email, role, barangay, address, phone, password_hash AS passwordHash FROM system_users WHERE email = ? AND status = 'active' LIMIT 1", [email]);
    const row = (rows as (AuthUser & { passwordHash: string | null })[])[0];
    const valid = !!row?.passwordHash && await bcrypt.compare(parsed.data.password, row.passwordHash);
    if (!valid) {
      attempt.count += 1;
      if (attempt.count >= 10) attempt.blockedUntil = now + LOGIN_WINDOW_MS;
      return res.status(401).json({ error: "Invalid email or password" });
    }
    loginAttempts.delete(key);
    const user: AuthUser = { id: row.id, name: row.name, email: row.email, role: row.role, barangay: row.barangay, address: row.address, phone: row.phone };
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader("Set-Cookie", `dmms_session=${signSession(user)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`);
    res.json({ data: user });
  } catch (error) { respondWithError(error, res); }
});

app.post("/api/auth/register", async (req, res) => {
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) {
    const labels: Record<string, string> = { name: "Full name", email: "Email address", password: "Password", confirmPassword: "Confirm password", role: "Role", address: "Home address", phone: "Phone" };
    const errors = parsed.error.issues.map((issue) => `${labels[String(issue.path[0])] ?? "Registration"}: ${issue.message}`);
    return res.status(400).json({ error: errors.join(" ") });
  }
  try {
    const input = parsed.data;
    const [settings] = await pool.execute("SELECT setting_value AS barangayName FROM system_settings WHERE setting_key = 'barangay_name' LIMIT 1");
    const barangayName = (settings as { barangayName: string }[])[0]?.barangayName;
    if (!barangayName) return res.status(503).json({ error: "The system barangay has not been configured. Contact the administrator." });
    const id = randomUUID();
    const passwordHash = await bcrypt.hash(input.password, 12);
    await pool.execute("INSERT INTO system_users (id, name, email, password_hash, role, barangay, address, phone, status, joined_at) VALUES (?, ?, ?, ?, 'resident', ?, ?, ?, 'active', CURRENT_DATE())", [id, input.name, input.email, passwordHash, barangayName, input.address, input.phone]);
    res.status(201).json({ message: "Account created. Sign in to continue." });
  } catch (error) {
    if ((error as { code?: string })?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Email address: this email is already registered. Sign in or use another email." });
    respondWithError(error, res);
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => res.json({ data: req.authUser }));
app.post("/api/auth/logout", (_req, res) => { clearSession(res); res.status(204).end(); });
app.patch("/api/profile", requireAuth, async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) return res.status(400).json({ error: "Invalid profile update" });
  const columns: Record<string, string> = { name: "name", address: "address", phone: "phone" };
  const entries = Object.entries(parsed.data).filter(([key]) => columns[key]);
  try {
    await pool.execute(`UPDATE system_users SET ${entries.map(([key]) => `${columns[key]} = ?`).join(", ")} WHERE id = ?`, [...entries.map(([, value]) => value), req.authUser!.id]);
    const [rows] = await pool.execute("SELECT id, name, email, role, barangay, address, phone FROM system_users WHERE id = ?", [req.authUser!.id]);
    res.json({ data: (rows as AuthUser[])[0] });
  } catch (error) { respondWithError(error, res); }
});

app.get("/api/settings", requireAuth, requireRole("admin"), async (_req, res) => {
  try {
    const [rows] = await pool.execute("SELECT setting_key AS settingKey, setting_value AS settingValue FROM system_settings");
    const settings = Object.fromEntries((rows as { settingKey: string; settingValue: string }[]).map((row) => [row.settingKey, row.settingKey === "notifications_enabled" ? row.settingValue === "true" : row.settingValue]));
    res.json({ data: settings });
  } catch (error) { respondWithError(error, res); }
});

app.put("/api/settings", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid settings", details: parsed.error.flatten() });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const [key, value] of Object.entries(parsed.data)) {
      await connection.execute("INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)", [key, String(value)]);
    }
    await connection.execute("UPDATE system_users SET barangay = ? WHERE barangay <> ?", [parsed.data.barangay_name, parsed.data.barangay_name]);
    await connection.commit();
    res.json({ data: parsed.data });
  } catch (error) { await connection.rollback(); respondWithError(error, res); }
  finally { connection.release(); }
});

app.use("/api/reports", requireAuth);
app.get("/api/reports", async (req, res) => {
  const query = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(100),
    status: z.enum(reportStatuses).optional(),
    residentEmail: z.string().email().optional(),
  }).safeParse(req.query);
  if (!query.success) return res.status(400).json({ error: "Invalid query parameters" });
  try {
    const clauses: string[] = [];
    const values: (string | number)[] = [];
    if (query.data.status) { clauses.push("r.status = ?"); values.push(query.data.status); }
    if (req.authUser?.role === "resident") { clauses.push("r.resident_id = ?"); values.push(req.authUser.id); }
    else if (query.data.residentEmail) { clauses.push("resident_user.email = ?"); values.push(query.data.residentEmail); }
    values.push(query.data.limit);
    const [rows] = await pool.execute(
      `SELECT r.id, r.resident_id AS residentUserId, COALESCE(resident_user.name, r.resident_name) AS residentName, COALESCE(resident_user.email, r.resident_email) AS residentEmail, r.location, r.type, r.description, r.priority, r.status, r.assigned_to AS assignedToUserId, assignee.name AS assignedTo, DATE_FORMAT(r.submitted_at, '%Y-%m-%d') AS submittedAt, DATE_FORMAT(r.updated_at, '%Y-%m-%d') AS updatedAt FROM drainage_reports r LEFT JOIN system_users resident_user ON resident_user.id = r.resident_id LEFT JOIN system_users assignee ON assignee.id = r.assigned_to ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY r.submitted_at DESC LIMIT ?`,
      values,
    );
    res.json({ data: rows });
  } catch (error) { respondWithError(error, res); }
});

app.get("/api/reports/:id", async (req, res) => {
  try {
    const ownerClause = req.authUser?.role === "resident" ? " AND r.resident_id = ?" : "";
    const values = req.authUser?.role === "resident" ? [req.params.id, req.authUser.id] : [req.params.id];
    const [rows] = await pool.execute(
      `SELECT r.id, r.resident_id AS residentUserId, COALESCE(resident_user.name, r.resident_name) AS residentName, COALESCE(resident_user.email, r.resident_email) AS residentEmail, r.location, r.type, r.description, r.priority, r.status, r.assigned_to AS assignedToUserId, assignee.name AS assignedTo, DATE_FORMAT(r.submitted_at, '%Y-%m-%d') AS submittedAt, DATE_FORMAT(r.updated_at, '%Y-%m-%d') AS updatedAt FROM drainage_reports r LEFT JOIN system_users resident_user ON resident_user.id = r.resident_id LEFT JOIN system_users assignee ON assignee.id = r.assigned_to WHERE r.id = ?${ownerClause}`,
      values,
    );
    const report = (rows as unknown[])[0];
    if (!report) return res.status(404).json({ error: "Report not found" });
    res.json({ data: report });
  } catch (error) { respondWithError(error, res); }
});

app.post("/api/reports", requireRole("resident"), async (req, res) => {
  const parsed = reportCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid report data", details: parsed.error.flatten() });
  try {
    const id = makeId("RPT");
    const report = parsed.data;
    await pool.execute(
      "INSERT INTO drainage_reports (id, resident_id, location, type, description, priority, status, submitted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', CURRENT_DATE(), CURRENT_DATE())",
      [id, req.authUser!.id, report.location, report.type, report.description, report.priority],
    );
    res.status(201).json({ data: { id, ...report, status: "pending", submittedAt: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString().slice(0, 10) } });
  } catch (error) { respondWithError(error, res); }
});

app.patch("/api/reports/:id", requireRole("staff", "admin"), async (req, res) => {
  const parsed = reportUpdateSchema.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) return res.status(400).json({ error: "Invalid report update" });
  const columns: Record<string, string> = { location: "location", type: "type", description: "description", priority: "priority", status: "status", assignedToUserId: "assigned_to" };
  const entries = Object.entries(parsed.data).filter(([key]) => columns[key]);
  try {
    if (parsed.data.assignedToUserId) {
      const [staff] = await pool.execute("SELECT id FROM system_users WHERE id = ? AND role IN ('staff', 'admin') AND status = 'active'", [parsed.data.assignedToUserId]);
      if (!(staff as unknown[]).length) return res.status(400).json({ error: "Choose an active staff member for this assignment" });
    }
    const assignments = entries.map(([key]) => `${columns[key]} = ?`);
    const [result] = await pool.execute(
      `UPDATE drainage_reports SET ${assignments.join(", ")} WHERE id = ?`,
      [...entries.map(([, value]) => value), req.params.id],
    );
    if ((result as { affectedRows: number }).affectedRows === 0) {
      const [rows] = await pool.execute("SELECT id FROM drainage_reports WHERE id = ?", [req.params.id]);
      if (!(rows as unknown[]).length) return res.status(404).json({ error: "Report not found" });
    }
    const [rows] = await pool.execute("SELECT r.id, r.resident_id AS residentUserId, COALESCE(resident_user.name, r.resident_name) AS residentName, COALESCE(resident_user.email, r.resident_email) AS residentEmail, r.location, r.type, r.description, r.priority, r.status, r.assigned_to AS assignedToUserId, assignee.name AS assignedTo, DATE_FORMAT(r.submitted_at, '%Y-%m-%d') AS submittedAt, DATE_FORMAT(r.updated_at, '%Y-%m-%d') AS updatedAt FROM drainage_reports r LEFT JOIN system_users resident_user ON resident_user.id = r.resident_id LEFT JOIN system_users assignee ON assignee.id = r.assigned_to WHERE r.id = ?", [req.params.id]);
    res.json({ data: (rows as unknown[])[0] });
  } catch (error) { respondWithError(error, res); }
});

app.delete("/api/reports/:id", requireRole("resident", "admin"), async (req, res) => {
  try {
    const [result] = req.authUser?.role === "resident"
      ? await pool.execute("DELETE FROM drainage_reports WHERE id = ? AND resident_id = ? AND status = 'pending'", [req.params.id, req.authUser.id])
      : await pool.execute("DELETE FROM drainage_reports WHERE id = ?", [req.params.id]);
    if ((result as { affectedRows: number }).affectedRows === 0) return res.status(404).json({ error: "Report not found" });
    res.status(204).end();
  } catch (error) { respondWithError(error, res); }
});

app.get("/api/users", requireAuth, requireRole("staff", "admin"), async (req, res) => {
  const role = z.enum(roles).optional().safeParse(req.query.role);
  if (!role.success) return res.status(400).json({ error: "Invalid role filter" });
  try {
    const selectedRole = req.authUser?.role === "staff" ? "staff" : role.data;
    const [rows] = selectedRole
      ? await pool.execute("SELECT id, name, email, role, barangay, status, DATE_FORMAT(joined_at, '%Y-%m-%d') AS joinedAt FROM system_users WHERE role = ? ORDER BY name", [selectedRole])
      : await pool.execute("SELECT id, name, email, role, barangay, status, DATE_FORMAT(joined_at, '%Y-%m-%d') AS joinedAt FROM system_users ORDER BY name");
    res.json({ data: rows });
  } catch (error) { respondWithError(error, res); }
});

app.post("/api/users", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = userSchema.extend({ password: accountPasswordSchema }).safeParse(req.body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${String(issue.path[0] ?? "User data")}: ${issue.message}`);
    return res.status(400).json({ error: `Invalid user data: ${details.join(" ")}` });
  }
  try {
    const id = randomUUID();
    const { password, ...user } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 12);
    const [settings] = await pool.execute("SELECT setting_value AS barangayName FROM system_settings WHERE setting_key = 'barangay_name' LIMIT 1");
    const barangayName = (settings as { barangayName: string }[])[0]?.barangayName;
    if (!barangayName) return res.status(503).json({ error: "The system barangay has not been configured." });
    await pool.execute("INSERT INTO system_users (id, name, email, password_hash, role, barangay, status, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_DATE())", [id, user.name, user.email.toLowerCase(), passwordHash, user.role, barangayName, user.status]);
    res.status(201).json({ data: { id, ...user, barangay: barangayName, joinedAt: new Date().toISOString().slice(0, 10) } });
  } catch (error) { respondWithError(error, res); }
});

app.patch("/api/users/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = userSchema.partial().extend({ password: accountPasswordSchema.optional() }).safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) return res.status(400).json({ error: "Invalid user update" });
  const { password, ...userUpdates } = parsed.data;
  const columns: Record<string, string> = { name: "name", email: "email", role: "role", status: "status" };
  const entries = Object.entries(userUpdates).filter(([key]) => columns[key]);
  if (password) entries.push(["passwordHash", await bcrypt.hash(password, 12)]);
  columns.passwordHash = "password_hash";
  try {
    const [result] = await pool.execute(`UPDATE system_users SET ${entries.map(([key]) => `${columns[key]} = ?`).join(", ")} WHERE id = ?`, [...entries.map(([, value]) => value), req.params.id]);
    if ((result as { affectedRows: number }).affectedRows === 0) {
      const [exists] = await pool.execute("SELECT id FROM system_users WHERE id = ?", [req.params.id]);
      if (!(exists as unknown[]).length) return res.status(404).json({ error: "User not found" });
    }
    const [rows] = await pool.execute("SELECT id, name, email, role, barangay, status, DATE_FORMAT(joined_at, '%Y-%m-%d') AS joinedAt FROM system_users WHERE id = ?", [req.params.id]);
    res.json({ data: (rows as unknown[])[0] });
  } catch (error) { respondWithError(error, res); }
});

app.delete("/api/users/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const [result] = await pool.execute("DELETE FROM system_users WHERE id = ?", [req.params.id]);
    if ((result as { affectedRows: number }).affectedRows === 0) return res.status(404).json({ error: "User not found" });
    res.status(204).end();
  } catch (error) { respondWithError(error, res); }
});

app.use("/api/inspections", requireAuth, requireRole("staff", "admin"));
app.get("/api/inspections", async (_req, res) => {
  try {
    const [rows] = await pool.execute("SELECT i.id, i.report_id AS reportId, COALESCE(i.report_type, r.type) AS reportType, COALESCE(i.location, r.location) AS location, DATE_FORMAT(i.inspection_date, '%Y-%m-%d') AS date, TIME_FORMAT(i.inspection_time, '%H:%i') AS time, i.inspector_id AS inspectorUserId, COALESCE(inspector_user.name, i.inspector) AS inspector, i.notes, i.status FROM inspections i JOIN drainage_reports r ON r.id = i.report_id LEFT JOIN system_users inspector_user ON inspector_user.id = i.inspector_id ORDER BY i.inspection_date, i.inspection_time");
    res.json({ data: rows });
  } catch (error) { respondWithError(error, res); }
});

app.post("/api/inspections", async (req, res) => {
  const parsed = inspectionCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid inspection data", details: parsed.error.flatten() });
  try {
    const id = makeId("INS");
    const inspection = parsed.data;
    const [reports] = await pool.execute("SELECT type, location FROM drainage_reports WHERE id = ?", [inspection.reportId]);
    const report = (reports as { type: string; location: string }[])[0];
    if (!report) return res.status(400).json({ error: "Referenced report does not exist" });
    const [inspectors] = await pool.execute("SELECT id, name FROM system_users WHERE id = ? AND role IN ('staff', 'admin') AND status = 'active'", [inspection.inspectorUserId]);
    const inspector = (inspectors as { id: string; name: string }[])[0];
    if (!inspector) return res.status(400).json({ error: "Choose an active staff member as the inspector" });
    const dateTime = `${inspection.inspectionDate} ${inspection.inspectionTime}:00`;
    await pool.execute("INSERT INTO inspections (id, report_id, report_type, location, inspection_date_time, inspection_date, inspection_time, inspector_id, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')", [id, inspection.reportId, report.type, report.location, dateTime, inspection.inspectionDate, `${inspection.inspectionTime}:00`, inspector.id, inspection.notes]);
    res.status(201).json({ data: { id, reportId: inspection.reportId, date: inspection.inspectionDate, time: inspection.inspectionTime, inspectorUserId: inspector.id, inspector: inspector.name, notes: inspection.notes, status: "scheduled" } });
  } catch (error) { respondWithError(error, res); }
});

app.patch("/api/inspections/:id", async (req, res) => {
  const parsed = z.object({ inspectorUserId: z.string().max(50).optional(), inspectionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), inspectionTime: z.string().regex(/^\d{2}:\d{2}$/).optional(), notes: z.string().max(5000).optional(), status: z.enum(["scheduled", "completed", "cancelled"]).optional() }).safeParse(req.body);
  const columns: Record<string, string> = { inspectorUserId: "inspector_id", inspectionDate: "inspection_date", inspectionTime: "inspection_time", notes: "notes", status: "status" };
  const entries = parsed.success ? Object.entries(parsed.data) : [];
  if (!parsed.success || entries.length === 0) return res.status(400).json({ error: "Invalid inspection update" });
  try {
    const [result] = await pool.execute(`UPDATE inspections SET ${entries.map(([key]) => `${columns[key]} = ?`).join(", ")} WHERE id = ?`, [...entries.map(([, value]) => value), req.params.id]);
    if (!(result as { affectedRows: number }).affectedRows) {
      const [exists] = await pool.execute("SELECT id FROM inspections WHERE id = ?", [req.params.id]);
      if (!(exists as unknown[]).length) return res.status(404).json({ error: "Inspection not found" });
    }
    res.json({ data: { id: req.params.id, ...parsed.data } });
  } catch (error) { respondWithError(error, res); }
});

app.delete("/api/inspections/:id", async (req, res) => {
  try {
    const [result] = await pool.execute("DELETE FROM inspections WHERE id = ?", [req.params.id]);
    if (!(result as { affectedRows: number }).affectedRows) return res.status(404).json({ error: "Inspection not found" });
    res.status(204).end();
  } catch (error) { respondWithError(error, res); }
});

app.use("/api/maintenance", requireAuth, requireRole("staff", "admin"));
app.get("/api/maintenance", async (_req, res) => {
  try {
    const [rows] = await pool.execute("SELECT r.id AS reportId, r.type AS reportType, r.location, COALESCE(m.assigned_to, r.assigned_to) AS assignedToUserId, assignee.name AS assignedTo, m.estimated_cost AS estimatedCost, COALESCE(m.materials, '') AS materials, COALESCE(m.notes, '') AS notes FROM drainage_reports r LEFT JOIN maintenance_records m ON m.report_id = r.id LEFT JOIN system_users assignee ON assignee.id = COALESCE(m.assigned_to, r.assigned_to) WHERE r.status IN ('verified', 'in-progress') ORDER BY r.submitted_at DESC");
    res.json({ data: rows });
  } catch (error) { respondWithError(error, res); }
});

app.put("/api/maintenance/:reportId", async (req, res) => {
  const parsed = maintenanceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid maintenance data", details: parsed.error.flatten() });
  const connection = await pool.getConnection();
  try {
    const record = parsed.data;
    if (record.assignedToUserId) {
      const [staff] = await connection.execute("SELECT id FROM system_users WHERE id = ? AND role IN ('staff', 'admin') AND status = 'active'", [record.assignedToUserId]);
      if (!(staff as unknown[]).length) return res.status(400).json({ error: "Choose an active staff member for this maintenance assignment" });
    }
    await connection.beginTransaction();
    await connection.execute("INSERT INTO maintenance_records (report_id, assigned_to, estimated_cost, materials, notes) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE assigned_to = VALUES(assigned_to), estimated_cost = VALUES(estimated_cost), materials = VALUES(materials), notes = VALUES(notes)", [req.params.reportId, record.assignedToUserId, record.estimatedCost, record.materials, record.notes]);
    await connection.execute("UPDATE drainage_reports SET assigned_to = ? WHERE id = ?", [record.assignedToUserId, req.params.reportId]);
    await connection.commit();
    const [rows] = await connection.execute("SELECT s.name FROM system_users s WHERE s.id = ?", [record.assignedToUserId]);
    const assignedTo = (rows as { name: string }[])[0]?.name ?? "";
    res.json({ data: { reportId: req.params.reportId, ...record, assignedTo } });
  } catch (error) {
    await connection.rollback();
    respondWithError(error, res);
  } finally { connection.release(); }
});

app.delete("/api/maintenance/:reportId", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute("DELETE FROM maintenance_records WHERE report_id = ?", [req.params.reportId]);
    if (!(result as { affectedRows: number }).affectedRows) {
      await connection.rollback();
      return res.status(404).json({ error: "Maintenance record not found" });
    }
    await connection.execute("UPDATE drainage_reports SET assigned_to = NULL WHERE id = ?", [req.params.reportId]);
    await connection.commit();
    res.status(204).end();
  } catch (error) {
    await connection.rollback();
    respondWithError(error, res);
  } finally { connection.release(); }
});

const frontendBuild = path.resolve(process.cwd(), "dist");
if (!process.env.VERCEL && existsSync(path.join(frontendBuild, "index.html"))) {
  app.use(express.static(frontendBuild));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "API endpoint not found" });
    res.sendFile(path.join(frontendBuild, "index.html"), (error) => { if (error) next(error); });
  });
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => respondWithError(error, res));

export default app;

if (!process.env.VERCEL) {
  const server = app.listen(port, "0.0.0.0", () => console.log(`API listening on port ${port}`));
  async function shutdown() {
    server.close();
    await pool.end();
  }
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

