# Run Barangay DMMS on Windows

This project has a portable Node.js and npm runtime in `.tools/node`. Run the commands below from the project folder (`bdsm1`). They call the local `node.exe` directly, so you do not need Node in the system `PATH` or a PowerShell execution-policy change.

## One-time setup

1. Start MySQL and make sure the `barangay_drainage_db` database exists.
2. Make sure `server/.env` contains your MySQL `DB_USER` and `DB_PASSWORD`, an `AUTH_SECRET` of at least 32 characters, and SMTP settings for password reset email. Keep this file private.
3. Install dependencies (repeat only if dependencies change or `node_modules` is removed):

```powershell
& ".\.tools\node\npm.cmd" install
& ".\.tools\node\npm.cmd" --prefix server install
```

4. Apply database migrations and starter records:

```powershell
Set-Location server
$env:PATH = (Resolve-Path "..\.tools\node").Path + ";" + $env:PATH
& "..\.tools\node\node.exe" ".\node_modules\tsx\dist\cli.mjs" ".\scripts\migrate.ts"
Set-Location ..
```

5. Set the initial administrator password. The password prompt is visible while typing; choose at least 12 characters:

```powershell
Set-Location server
$env:PATH = (Resolve-Path "..\.tools\node").Path + ";" + $env:PATH
& "..\.tools\node\node.exe" ".\node_modules\tsx\dist\cli.mjs" ".\scripts\set-admin-password.ts"
Set-Location ..
```

Enter `admin@brgy.gov.ph` when asked for the administrator email.

## Start the system

Keep MySQL running. Open **two PowerShell terminals** in the `bdsm1` folder.

**Terminal 1: API server**

```powershell
Set-Location server
$env:PATH = (Resolve-Path "..\.tools\node").Path + ";" + $env:PATH
& "..\.tools\node\node.exe" ".\node_modules\tsx\dist\cli.mjs" watch ".\src\index.ts"
```

**Terminal 2: React/Vite frontend**

```powershell
$env:PATH = (Resolve-Path ".\.tools\node").Path + ";" + $env:PATH
& ".\.tools\node\node.exe" ".\node_modules\vite\bin\vite.js" --host 0.0.0.0
```

Open the URL printed by Vite (normally `http://localhost:8443`). Keep both terminals and MySQL running while using the app. Vite forwards `/api` requests to the local API on port 3001.

## Stop the system

Press `Ctrl+C` in both terminals. MySQL can be stopped separately when you are finished.

## Troubleshooting

- If a local executable is not found, check that `.tools\node\node.exe`, `.\node_modules\vite\bin\vite.js`, or `server\node_modules\tsx\dist\cli.mjs` exists as appropriate.
- If the API reports that `AUTH_SECRET` is too short, set `AUTH_SECRET` in `server/.env` to a private random string of at least 32 characters.
- If database access is denied, check `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in `server/.env`. The database name should be `barangay_drainage_db`.
- If port 3001 is already in use, stop the other process using it before starting the API.
- If an account has no password yet, an administrator can set it from Staff Accounts. Residents can also register through the Resident portal.
- Password reset needs an SMTP mailbox that supports implicit TLS on port 465. Set `SMTP_HOST`, `SMTP_PORT=465`, `SMTP_USER`, and `SMTP_PASSWORD` in `server/.env`; `SMTP_FROM` is optional and defaults to `SMTP_USER`. For Gmail, `SMTP_PASSWORD` must be a Google App Password (not the account password); Google requires 2-Step Verification and may restrict app passwords for some accounts. The API never sends the OTP in its response; the user receives it by email.
- The `008_password_reset_otps.sql` migration creates the table used to store hashed, expiring, single-use reset codes. Rerun the migration command after updating this project.

The `.tools` folder is local and excluded from Git because it contains the Node.js runtime. If you copy or clone this project to another computer, install Node.js there or add a compatible portable runtime to `.tools/node`.
