import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const databaseName = process.env.DB_NAME;
if (!databaseName) throw new Error("DB_NAME is required");

const caCertificate = process.env.DB_SSL_CA?.replace(/\\n/g, "\n");
const ssl = process.env.DB_SSL === "true" || caCertificate
  ? { rejectUnauthorized: true, ...(caCertificate ? { ca: caCertificate } : {}) }
  : undefined;

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  database: databaseName,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl,
  multipleStatements: false,
});

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");
try {
  await connection.execute("CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(190) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const [applied] = await connection.execute("SELECT name FROM schema_migrations WHERE name = ?", [file]);
    if ((applied as unknown[]).length) continue;

    const contents = await readFile(path.join(directory, file), "utf8");
    const statements = contents.split(";").map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      const alterMatch = statement.match(/^ALTER\s+TABLE\s+(system_users|drainage_reports|inspections|maintenance_records)\b/i);
      if (alterMatch) {
        const table = alterMatch[1].toLowerCase();
        const [columns] = await connection.execute("SELECT column_name AS name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?", [table]);
        const present = new Set((columns as { name: string }[]).map((column) => column.name));
        const [idMetadata] = await connection.execute("SELECT character_set_name AS characterSet, collation_name AS collation FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'system_users' AND column_name = 'id'");
        const idType = (idMetadata as { characterSet: string | null; collation: string | null }[])[0];
        const userIdType = `VARCHAR(50)${idType?.characterSet ? ` CHARACTER SET ${idType.characterSet}` : ""}${idType?.collation ? ` COLLATE ${idType.collation}` : ""} NULL`;
        const additions: Record<string, readonly (readonly [string, string])[]> = {
          system_users: [
            ["password_hash", "ADD COLUMN password_hash VARCHAR(255) NULL AFTER email"],
            ["address", "ADD COLUMN address VARCHAR(255) NULL AFTER barangay"],
            ["phone", "ADD COLUMN phone VARCHAR(40) NULL AFTER address"],
          ],
          drainage_reports: [
            ["resident_email", "ADD COLUMN resident_email VARCHAR(254) NULL"],
            ["resident_user_id", `ADD COLUMN resident_user_id ${userIdType}`],
            ["assigned_to_user_id", `ADD COLUMN assigned_to_user_id ${userIdType}`],
          ],
          inspections: [
            ["inspection_date", "ADD COLUMN inspection_date DATE NULL"],
            ["inspection_time", "ADD COLUMN inspection_time TIME NULL"],
            ["inspector", "ADD COLUMN inspector VARCHAR(120) NULL"],
            ["inspector_user_id", `ADD COLUMN inspector_user_id ${userIdType}`],
          ],
          maintenance_records: [["assigned_to_user_id", `ADD COLUMN assigned_to_user_id ${userIdType}`]],
        };
        const missing = additions[table].filter(([name]) => !present.has(name)).map(([, sql]) => sql);
        if (missing.length) await connection.query(`ALTER TABLE ${table} ${missing.join(", ")}`);
        if (table === "system_users") {
          await connection.query("ALTER TABLE system_users MODIFY COLUMN name VARCHAR(150) NOT NULL, MODIFY COLUMN email VARCHAR(254) NOT NULL, MODIFY COLUMN barangay VARCHAR(160) NOT NULL");
          const [emailIndexes] = await connection.execute("SELECT index_name AS name FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'system_users' AND column_name = 'email' AND non_unique = 0");
          if (!(emailIndexes as unknown[]).length) await connection.query("ALTER TABLE system_users ADD UNIQUE KEY uq_system_users_email (email)");
        }
        if (table === "inspections" && present.has("inspection_date_time")) {
          await connection.query("ALTER TABLE inspections MODIFY COLUMN inspection_date_time DATETIME NULL");
        }
        if (table === "drainage_reports") {
          await connection.query("ALTER TABLE drainage_reports MODIFY COLUMN resident_name VARCHAR(120) NULL, MODIFY COLUMN resident_email VARCHAR(254) NULL");
        }
        if (table === "inspections") {
          for (const [name, sql] of [
            ["report_type", "MODIFY COLUMN report_type VARCHAR(100) NULL"],
            ["location", "MODIFY COLUMN location VARCHAR(255) NULL"],
            ["inspector", "MODIFY COLUMN inspector VARCHAR(120) NULL"],
          ] as const) {
            if (present.has(name)) await connection.query(`ALTER TABLE inspections ${sql}`);
          }
        }
        const foreignKeyToDrop = statement.match(/\bDROP\s+FOREIGN\s+KEY\s+([A-Za-z0-9_]+)/i)?.[1];
        if (foreignKeyToDrop) {
          const [constraints] = await connection.execute("SELECT constraint_name AS name FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = ? AND constraint_type = 'FOREIGN KEY'", [table, foreignKeyToDrop]);
          if ((constraints as unknown[]).length) await connection.query(statement);
          continue;
        }
        const columnToDrop = statement.match(/\bDROP\s+COLUMN\s+([A-Za-z0-9_]+)/i)?.[1];
        if (columnToDrop) {
          if (present.has(columnToDrop)) await connection.query(statement);
          continue;
        }
        const constraintName = statement.match(/\bADD\s+CONSTRAINT\s+([A-Za-z0-9_]+)/i)?.[1];
        if (constraintName) {
          const [constraints] = await connection.execute("SELECT constraint_name AS name FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = ? AND constraint_type = 'FOREIGN KEY'", [table, constraintName]);
          if (!(constraints as unknown[]).length) await connection.query(statement);
        }
        continue;
      }
      if (/^INSERT\s+IGNORE\s+INTO\s+system_users\b/i.test(statement) && /\bFROM\s+users\b/i.test(statement)) {
        const [tables] = await connection.execute("SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'");
        if ((tables as unknown[]).length) await connection.query(statement);
        continue;
      }
      if (/^UPDATE\s+drainage_reports\s+r\s+JOIN\s+system_users\s+u\s+ON\s+u\.id\s*=\s*r\.resident_id\b/i.test(statement)) {
        const [legacyColumns] = await connection.execute("SELECT column_name AS name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'drainage_reports' AND column_name = 'resident_id'");
        if (!(legacyColumns as unknown[]).length) continue;
      }
      await connection.query(statement);
    }
    await connection.execute("INSERT INTO schema_migrations (name) VALUES (?)", [file]);
    console.log(`Applied ${file}`);
  }
  console.log("Database migrations are current.");
} finally {
  await connection.end();
}
