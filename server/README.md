# MySQL API setup

The local API binds to `127.0.0.1:3001`. Configure `server/.env` with the MySQL credentials for `barangay_drainage_db` and a private `AUTH_SECRET` of at least 32 characters. Never put real secrets in `.env.example` or frontend `VITE_*` variables.

## Database setup

Run the migrations from the project root after the database exists and `server/.env` has the correct credentials:

```powershell
npm --prefix server run db:migrate
```

The migration runner applies the schema and seed migrations, then consolidates application accounts in `system_users`. On an existing database it copies accounts from the former `users` table into `system_users` without deleting the old rows. It tracks applied files and only runs against the `barangay_drainage_db` database.

The imported accounts have no password until one is set. Set the seeded administrator password from an interactive terminal:

```powershell
npm --prefix server run admin:set-password
```

Enter `admin@brgy.gov.ph` when prompted and choose a password of 6–72 characters. Sign into the Admin portal, then use Staff Accounts to set passwords for staff and other administrator accounts. Seeded resident accounts also need passwords set by an administrator; residents can instead register their own account.

## Run

```powershell
npm --prefix server install
npm --prefix server run dev
```

In another terminal, run `npm run dev` from the project root. The Vite proxy forwards `/api` requests to the local API.

## API

- Authentication: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- Profile: `PATCH /api/profile`
- Reports: `GET/POST /api/reports`, `GET/PATCH/DELETE /api/reports/:id`
- Users: `GET/POST /api/users`, `PATCH/DELETE /api/users/:id`
- Inspections: `GET/POST /api/inspections`, `PATCH/DELETE /api/inspections/:id`
- Maintenance: `GET /api/maintenance`, `PUT/DELETE /api/maintenance/:reportId`
- System settings: `GET/PUT /api/settings`

Passwords are securely protected. Authenticated sessions are signed, held in an HttpOnly, SameSite=Strict cookie, and checked against the active MySQL account on each request. API routes enforce roles server-side. The API binds to localhost; production deployment still needs HTTPS and a same-origin reverse proxy (or reviewed credentialed CORS settings).
