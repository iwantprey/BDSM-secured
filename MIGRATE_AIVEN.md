# Move the Barangay DMMS MySQL database to Aiven

This project uses MySQL through `mysql2`. The API connection pool and the migration runner support TLS with Aiven's CA certificate. Keep Aiven credentials private; don't paste them into chat, commit them, or put them in any `VITE_` variable.

## 1. Get the Aiven connection details

In the Aiven Console, open your MySQL service and its **Overview** or **Connection information**. Record the hostname, port, database name, username, and password. Download the service CA certificate from the service's connection details. Aiven requires TLS for secure connections; use its CA to verify the server certificate.

## 2. Back up the local database

In SQLyog, export `barangay_drainage_db` with both **structure and data**. Include every table, especially `schema_migrations` and `password_reset_otps`. Save the SQL dump somewhere private. Keep the original local database and backup until the hosted copy is verified.

## 3. Import the backup into Aiven

Create a SQLyog connection using Aiven's host, port, username, and password. Enable SSL and select the downloaded CA certificate. Connect to the database name shown by Aiven.

Import the dump into that database. If the dump includes `CREATE DATABASE` or `USE barangay_drainage_db`, either create/use that exact database name on Aiven or adjust those statements to the Aiven database name before importing. Do not import an empty schema over the only copy of your data.

## 4. Configure this project's API locally

Copy the Aiven values into `server/.env` (edit it locally; do not share it):

```dotenv
DB_HOST=<Aiven hostname>
DB_PORT=<Aiven port>
DB_NAME=<Aiven database name>
DB_USER=<Aiven username>
DB_PASSWORD=<Aiven password>
DB_SSL=true
DB_SSL_CA="-----BEGIN CERTIFICATE-----\n...certificate contents...\n-----END CERTIFICATE-----"
```

Keep `DB_SSL_CA` as a single line with literal `\n` between PEM lines; the API converts those into newlines. Alternatively, use a multiline value if your local dotenv setup accepts it. `DB_NAME` must be the actual database name on Aiven, which may differ from `barangay_drainage_db`.

## 5. Verify the database and migrations

From the repository root, run the migration runner once with the project Node executable. In PowerShell:

```powershell
Set-Location server
$env:PATH = (Resolve-Path "..\.tools\node").Path + ";" + $env:PATH
& "..\.tools\node\node.exe" ".\node_modules\tsx\dist\cli.mjs" ".\scripts\migrate.ts"
Set-Location ..
```

The migration runner now uses the configured database name and TLS settings. When the imported `schema_migrations` table is present, previously applied migrations are skipped. Review the command output; if it reports a SQL error, stop and inspect the imported schema instead of dropping/recreating tables.

In SQLyog, refresh the Aiven connection and compare table names and row counts with the local database. Then start the API and check `http://localhost:3001/api/health`; test login and the report, inspection, and maintenance screens. The health endpoint should report a connected database.

## 6. Point a deployed API at Aiven

In the backend host's secret/environment settings, add the same `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`, plus `DB_SSL=true` and `DB_SSL_CA` containing the Aiven CA PEM. Also configure `AUTH_SECRET`, `FRONTEND_ORIGIN`, and SMTP settings as described in [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md) if deploying there. Redeploy and check `/api/health`.

Never expose database credentials or the CA in frontend code, browser storage, or variables prefixed with `VITE_`. Restrict Aiven's allowed IPs/network access when your hosting provider has stable outbound IPs. Keep a separate backup before any future schema or data changes.
