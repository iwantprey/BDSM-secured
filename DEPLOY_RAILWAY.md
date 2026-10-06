# Move Barangay DMMS to Railway

This setup runs the Vite frontend and Express API in one Railway service and uses a Railway MySQL service. Keeping the frontend and API on one origin lets the existing secure session cookie work without a separate CORS or cookie-domain setup.

## 1. Create the Railway project and MySQL service

1. Sign in to Railway and create a project.
2. Add a **MySQL** database service.
3. In its Variables tab, note the generated `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, and `MYSQLDATABASE` values. Keep these private.
4. Railway databases are private by default. The app will use Railway's private network; only enable a public TCP Proxy temporarily when importing from your computer.

Railway's MySQL service provides these connection variables and supports external access through a TCP Proxy when enabled. See [Railway MySQL documentation](https://docs.railway.com/databases/mysql).

## 2. Back up and import the local database

Before changing anything, make a full SQL backup of the local `barangay_drainage_db` in SQLyog. Include **structure and data** for every table, including `schema_migrations` and `password_reset_otps`. Keep this backup private.

1. In Railway MySQL service settings, enable **Networking → TCP Proxy** temporarily.
2. In SQLyog, create a connection using Railway's public TCP proxy hostname and port, plus the Railway MySQL username and password.
3. Import the SQL backup into the database configured for the app. If the dump contains a `USE barangay_drainage_db` statement, make sure the target database is named `barangay_drainage_db` or change that statement to the target database name before importing.
4. Compare table and row counts in Railway with the local database. Check that users, reports, inspections, maintenance records, and settings are present.
5. Disable the public TCP Proxy after the import. The deployed app will use private networking.

The migration runner now uses the configured `DB_NAME` and the migration files no longer switch databases with a hard-coded `USE` statement. If the imported `schema_migrations` table is present, already-applied migrations will be skipped.

## 3. Deploy the app service

Connect the GitHub repository to a new Railway service. Set its **Root Directory** to the repository root (`/`) so the build includes both `src/` and `server/`.

Set these service commands:

- **Install:** `npm ci`
- **Build:** `npm run build:railway`
- **Start:** `npm start`
- **Healthcheck path:** `/api/health`

The build command installs the API dependencies, builds the Vite frontend, and compiles the API. The API serves the built frontend and uses Railway's injected `PORT`.

Add these variables to the app service. Replace `MySQL` in the references with the actual name of your Railway database service if it differs:

```text
NODE_ENV=production
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_POOL_MAX=5
AUTH_SECRET=<a random secret with at least 32 characters>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=<sending Gmail address>
SMTP_PASSWORD=<Gmail App Password>
SMTP_FROM=<sending Gmail address>
```

Do not set `VITE_API_BASE_URL` for this single-origin setup. The frontend calls `/api` on the same Railway service. `FRONTEND_ORIGIN` is also unnecessary for same-origin requests; if you later host the frontend separately, set it to the exact frontend origin.

Generate a public domain for the app service. Railway injects `PORT`; the server listens on it and serves the frontend at the generated HTTPS URL. The API health check is available at `/api/health`.

## 4. Run/verify database migrations

If your import included `schema_migrations`, the app's migration runner will skip applied migrations. Run it once using the Railway service variables after the import:

```powershell
railway login
railway link
railway run --service <app-service-name> npm --prefix server run db:migrate
```

Then open the Railway app URL and verify registration, login, role-specific pages, reports, inspections, maintenance, and password reset. Check Railway deployment logs if the health check or a database request fails.

## Notes

- The MySQL template is a database service that you are responsible for backing up and monitoring. Enable Railway backups before using this for important records.
- Keep the local SQL backup until the Railway copy has been checked and the live app works.
- Never commit `.env` files or paste database credentials into chat.
