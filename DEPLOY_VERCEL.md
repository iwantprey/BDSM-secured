# Deploy Barangay DMMS to Vercel with Aiven MySQL

Deploy two Vercel projects from the same Git repository: the Express API first, then the Vite frontend. The frontend proxies `/api` calls to the API deployment, so the browser uses one origin and the secure session cookie works without cross-site cookies.

## 1. Deploy the API

Create a Vercel project connected to this repository and set **Root Directory** to `server`. Vercel detects the Express app exported by `src/index.ts` and deploys it as a Node.js Function. Use `npm ci` for install and `npm run build` for the build command. Leave the output directory unset; this is a serverless API, not a static build. The API TypeScript build emits `dist/` as a compile check, while Vercel serves the exported Express app.

Add these variables in the API project's Vercel settings for Production:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DB_HOST` | Hostname shown in your Aiven service connection details |
| `DB_PORT` | Port shown in Aiven (often not `3306`) |
| `DB_NAME` | The actual Aiven database name |
| `DB_USER` | Aiven database username |
| `DB_PASSWORD` | Aiven database password |
| `DB_SSL` | `true` |
| `DB_SSL_CA` | Contents of the Aiven service CA certificate (PEM) |
| `DB_POOL_MAX` | Start with `2` for serverless instances |
| `AUTH_SECRET` | A random secret of at least 32 characters |
| `FRONTEND_ORIGIN` | Exact production frontend origin, e.g. `https://your-site.vercel.app` |
| `SMTP_HOST` | `smtp.gmail.com` when using Gmail |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | Gmail address used to send reset codes |
| `SMTP_PASSWORD` | Gmail App Password |
| `SMTP_FROM` | Sender address, usually the same Gmail address |

Paste the full CA certificate as the value of `DB_SSL_CA`; if the Vercel variable editor requires a single line, replace line breaks with literal `\n`. Keep `AUTH_SECRET`, database credentials, the CA certificate, and SMTP credentials in Vercel's environment-variable settings. Never use a `VITE_` prefix for secrets.

Deploy the API and copy its production domain (not a preview deployment URL). Open `https://YOUR-API-DEPLOYMENT.vercel.app/api/health`; it should return `{"status":"ok","database":"connected"}`. A successful build alone does not confirm the runtime environment variables or database connection are correct. If your Aiven database has already been migrated and imported, do not run migrations again. If it has not, run `npm --prefix server run db:migrate` once from a trusted environment configured with the same Aiven connection variables.

## 2. Deploy the frontend

Create a second Vercel project from this repository with **Root Directory** set to the repository root. Use `npm ci` for install, `npm run build` for build, and `dist` for output. Before deploying the frontend, edit the root `vercel.json` and replace `YOUR-API-DEPLOYMENT.vercel.app` with the API project's production domain copied above. The placeholder is intentionally not a working API address; API requests will fail until it is replaced. The config proxies API requests and routes other paths to the Vite SPA:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR-API-DEPLOYMENT.vercel.app/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Deploy the frontend, then set `FRONTEND_ORIGIN` in the API project to the exact frontend production URL and redeploy the API. If you use a custom frontend domain, update the variable to that origin. The API accepts comma-separated exact origins if you also need to test Vercel preview deployments.

Leave `VITE_API_BASE_URL` unset; the frontend calls `/api/...` on its own origin, and the rewrite proxies the request while keeping the session cookie first-party.

## 3. Production checks

- Confirm `/api/health` reports a connected database, and confirm the frontend's API calls reach the API deployment.
- Test registration, login, role access, report CRUD, inspections, maintenance, and password reset.
- Check the API project's Vercel logs if a request returns an error.
- Vercel instances can start and stop independently. Login and password-reset rate limits currently use in-memory maps, so they can reset between function instances; replace them with a shared store before relying on those limits in production.
- Ensure Aiven allows the API's outbound connections. Do not use `localhost` or `127.0.0.1` as the database host.
- Never commit `.env` files or put database credentials or the CA certificate in frontend variables.
