import "dotenv/config";
import mysql from "mysql2/promise";

for (const key of ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"]) {
  if (!process.env[key]) throw new Error(`${key} is required`);
}

const caCertificate = process.env.DB_SSL_CA?.replace(/\\n/g, "\n");
const ssl = process.env.DB_SSL === "true" || caCertificate
  ? { rejectUnauthorized: true, ...(caCertificate ? { ca: caCertificate } : {}) }
  : undefined;

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_MAX ?? 10),
  queueLimit: 0,
  enableKeepAlive: true,
});
