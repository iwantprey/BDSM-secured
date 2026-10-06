# Publish Barangay DMMS with Vercel

The project has two applications: a Vite frontend at the repository root and an Express API in `server/`. Deploy them as separate Vercel projects from the same Git repository. Vercel can run the Express API as a function; the API now exports its Express app for that runtime.

## 1. Prepare the database

The MySQL database on your computer is not reachable by a deployed Vercel app. Use a managed MySQL provider or a MySQL server hosted on a network that accepts secure connections from Vercel.

Before moving the database, make a backup and import `barangay_drainage_db` into the hosted MySQL instance. Keep the current database name if possible. Configure the hosted database's TLS and network access according to its provider. Never put database credentials in frontend variables or commit them to Git.

## 2. Deploy the API

In Vercel, import the Git repository as a new project and set **Root Directory** to `server`. Use the Express framework preset if detected. The API entry point is `src/index.ts`; the build command is `npm run build`.

Add these variables in the API project's Vercel settings for Production (and Preview if needed):

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DB_HOST` | Hostname from the managed MySQL provider |
| `DB_PORT` | Provider's MySQL port, usually `3306` |
| `DB_NAME` | `barangay_drainage_db` |
| `DB_USER` | A dedicated app database user |
| `DB_PASSWORD` | That database user's password |
| `DB_POOL_MAX` | Start with `2` for serverless instances |
| `AUTH_SECRET` | A random secret of at least 32 characters |
| `FRONTEND_ORIGIN` | Exact production frontend origin, such as `https://your-site.vercel.app` |
| `SMTP_HOST` | `smtp.gmail.com` when using Gmail |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | Gmail address used to send reset codes |
| `SMTP_PASSWORD` | Gmail App Password |
| `SMTP_FROM` | Sender address, usually the same Gmail address |

Keep `AUTH_SECRET`, database credentials, and SMTP credentials in Vercel's environment-variable settings. Do not use a `VITE_` prefix for secrets.

After deploying the API, open `https://YOUR-API-URL/api/health`. It should return `{"status":"ok","database":"connected"}`. Run the database migrations against the hosted database once, using its connection settings; do not run migrations on each API startup.

## 3. Deploy the frontend

Create another Vercel project from the same Git repository. Set **Root Directory** to the repository root. Vercel should detect Vite; the build command is `npm run build` and the output directory is `dist`.

For production, add a root `vercel.json` that proxies API requests to the API project's URL. Replace the destination hostname with the actual API deployment hostname:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR-API-URL.vercel.app/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

This keeps browser API requests and the session cookie on the frontend's origin. Set `FRONTEND_ORIGIN` in the API project to the exact frontend production URL. If you use a custom domain, update that variable to the custom origin and redeploy the API.

The frontend can leave `VITE_API_BASE_URL` unset when using this proxy; it calls `/api/...` on its own origin. The API client includes credentials for the session cookie.

## 4. Production checks

- Test registration, login, role access, report CRUD, inspections, maintenance, and password reset on the deployed URLs.
- Check the API project's Vercel logs if a request returns an error.
- Vercel instances can start and stop independently. Login and password-reset rate limits currently use in-memory maps, so they can reset between function instances; replace them with a shared store before relying on those limits in production.
- Never deploy against your local-only MySQL address such as `localhost` or `127.0.0.1`.
