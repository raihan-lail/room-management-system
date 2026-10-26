# Room Management System

A camp/room management system covering rooms, allocations, residents, bookings,
complaints, ratings, employees, roles and permissions.

- **Backend:** Bun + Express + TypeScript + PostgreSQL + Prisma 7
- **Frontend:** Bun + React + Vite + JavaScript + Bootstrap Icons
- **Realtime:** WebSocket notifications and live updates
- **Auth:** JWT stored in an `httpOnly` cookie, with employee and resident accounts

Everything in this repository is run with **Bun**. Do not use `npm`, `yarn` or
`pnpm`; the lockfiles are `bun.lock`.

## Repository Layout

```text
room-management-system/
├─ backend-express/           # Express API + Prisma
│  ├─ prisma/
│  │  ├─ schema.prisma        # Database models
│  │  ├─ migrations/          # SQL migrations
│  │  └─ seeders/             # Permission, site and superadmin seeders
│  ├─ src/
│  │  ├─ controllers/         # Request handlers
│  │  ├─ helpers/             # helper functions
│  │  ├─ routes/              # Express routers
│  │  ├─ middleware/          # Authentication and permission guards
│  │  ├─ lib/                 # JWT, Prisma client, permissions
│  │  ├─ services/            # Audit, notification services
│  │  ├─ utils/               # Shared helpers
│  │  ├─ websocket/           # Notification socket
│  │  ├─ generated/prisma/    # Generated Prisma client
│  │  └─ server.ts            # API entry point
│  ├─ prisma7.config.ts       # Prisma 7 configuration
│  └─ package.json
├─ frontend/                  # React application
│  ├─ src/
│  │  ├─ api/                 # API client
│  │  ├─ components/          # Layout, guards, modals
│  │  ├─ contexts/            # Auth context/provider
│  │  ├─ data/                # Sidebar and static data
│  │  ├─ pages/               # Employee and resident pages
│  │  └─ utils/               # Permission helpers
│  └─ package.json
├─ .github/workflows/ci.yml
└─ README.MD
```

## Prerequisites

Install the following before running the project:

- **Bun 1.3.11 or newer** — <https://bun.sh>
- **PostgreSQL 18 or newer**
- **Git**
- Optional: Docker / Docker Compose for a local database

Verify the tooling:

```bash
bun -v
psql --version
git --version
```

## Quick Start

### 1. Backend

```bash
cd backend-express
bun install
cp .env.example .env
# Edit .env and set DATABASE_URL and JWT_SECRET
```

Create the database if it does not exist yet:

```bash
psql -U postgres -c "CREATE DATABASE camp_management;"
```

Generate the Prisma client, apply migrations and seed the base data:

```bash
bun run db:generate
bun run db:migrate

bun prisma/seeders/permissionSeeder.ts
bun prisma/seeders/siteSeeder.ts
bun prisma/seeders/superAdminSeeder.ts
```

Start the API in watch mode:

```bash
bun run dev
```

The API is available at <http://localhost:5000> and returns
`{"message":"API is running"}` from `GET /`.

### 2. Frontend

Open a second terminal:

```bash
cd frontend
bun install
cp .env.example .env
bun run dev
```

Open <http://localhost:5173>.

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

## Frontend Guide

### Tech Stack

- Bun
- React 19
- Vite 8
- JavaScript (no TypeScript)
- React Router
- Bootstrap Icons
- Plain CSS in `src/App.css` and `src/index.css`

### Scripts

Run these inside `frontend/`:

| Command | Description |
| --- | --- |
| `bun run dev` | Start Vite in development with HMR |
| `bun run build` | Production build into `dist/` |
| `bun run lint` | Run ESLint |
| `bun run preview` | Preview the production build |

### Environment Variables

Copy `frontend/.env.example` to `frontend/.env`.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | No | `http://localhost:5000` | Backend API base URL. Also used to derive the notification WebSocket URL. |

### Page Access

- **Employee accounts** access employee pages: dashboard, frontdesk, bookings,
  rooms, residents, sites, employees, roles, permissions and audit logs,
  depending on their role/permissions.
- **Resident accounts** access only the resident front office:
  `/resident/history`, `/resident/rating/:bookingId`,
  `/resident/complaints/:bookingId`, and the shared `/change-password` page.
- Wrong-account access is redirected to that account's own home page.
- Sidebar entries are filtered from the user's permissions. Residents receive
  a separate resident menu.

## Backend Guide

### Tech Stack

- Bun 1.3.11
- Express 5
- TypeScript
- PostgreSQL 18
- Prisma 7 with the PostgreSQL driver adapter
- Argon2 password hashing
- JWT authentication via `httpOnly` cookies
- `ws` WebSocket server for notifications

### 1. Clone and Install

```bash
git clone https://github.com/FuTour-App/room-management-system
cd room-management-system/backend-express
bun install
```

For a reproducible install (same as CI):

```bash
bun install --frozen-lockfile
```

### 2. Configure the Environment

```bash
cp .env.example .env
```

Edit `backend-express/.env`:

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string, e.g. `postgresql://user:password@localhost:5432/camp_management` |
| `JWT_SECRET` | Yes | — | Secret used to sign access tokens. The API fails to start without it. |
| `PORT` | No | `5000` | HTTP/WebSocket port |
| `CORS_ORIGINS` | No | Empty | Comma-separated allowed origins, e.g. `http://localhost:5173,http://localhost:8080`. Must include the frontend origin. |
| `SUPERADMIN_EMAIL` | No | `superadmin@example.com` | Email created by `superAdminSeeder.ts` |
| `SUPERADMIN_PASSWORD` | No | `ChangeMe123!` | Password created by `superAdminSeeder.ts` |
| `SUPERADMIN_NAME` | No | `Super Admin` | Employee name created by `superAdminSeeder.ts` |
| `JWT_ALGORITHM` | No | `HS256` | Reserved. The current JWT helper always uses HS256. |
| `JWT_EXPIRES_HOURS` | No | `8` | Reserved. Tokens currently expire in 1 hour, or 30 days with "Remember me". |

Never commit the real `.env` file.

### 3. Database Setup

Create the database:

```bash
psql -U postgres -c "CREATE DATABASE camp_management;"
```

Prisma reads its configuration from `prisma7.config.ts`, which points to
`prisma/schema.prisma`. The generated client is written to
`src/generated/prisma`, so generate it after cloning or after changing the
schema:

```bash
bun run db:generate
```

Apply migrations:

```bash
bun run db:migrate
```

`db:migrate` runs `prisma migrate dev`. On a fresh database it applies all
existing migrations; when the schema changes it creates a new migration and
asks for a name.

For an existing environment where migrations should only be applied:

```bash
bunx prisma migrate deploy
```

Prisma workflow after editing `prisma/schema.prisma`:

```bash
bun run db:migrate
bun run db:generate
```

### 4. Seed the Database

Seeders live in `prisma/seeders/` and are idempotent (`upsert` based).

```bash
bun prisma/seeders/permissionSeeder.ts
bun prisma/seeders/siteSeeder.ts
bun prisma/seeders/superAdminSeeder.ts
```

| Seeder | What it creates |
| --- | --- |
| `permissionSeeder.ts` | All application permissions (`rooms.read`, `resident.manage`, `audit.logs`, etc.) |
| `siteSeeder.ts` | The default site `DSLNG` (`SITE0001`) |
| `superAdminSeeder.ts` | User, employee and global `superadmin` role from the `SUPERADMIN_*` variables |

`superAdminSeeder.ts` hashes the password with Argon2 and updates it on every
run, which makes it convenient for resetting the superadmin password.

### 5. Run the API

Development (watch mode):

```bash
bun run dev
```

Production-style start:

```bash
bun run build   # Type-check and emit to dist/
bun run start   # Runs src/server.ts directly with Bun
```

Bun executes TypeScript directly, so `start` runs the source entry point.
`build` is used to type-check the project and produce `dist/`.

### Scripts

Run these inside `backend-express/`:

| Command | Description |
| --- | --- |
| `bun run dev` | Start with `bun --watch src/server.ts` |
| `bun run start` | Start with `bun src/server.ts` |
| `bun run build` | Type-check and compile with `tsc` |
| `bun run db:generate` | Generate the Prisma client |
| `bun run db:migrate` | Create/apply migrations in development |
| `bun run test` | Placeholder; no automated tests are configured yet |

### Authentication and Access Model

Every account is a `User`. A user has exactly one profile:

- `Employee` — belongs to a site (optional), has roles, direct permissions and
  can access the employee application.
- `Resident` — belongs to a site and can access only the resident front office.

An account with both or neither profile is rejected at login.

#### Login flow

1. `POST /api/auth/login` with `{ email, password, rememberMe }`.
2. The API verifies the password with Argon2, checks `isActive`, resolves the
   profile and returns:
   - `user` with `accountType: "employee" | "resident"`
   - employee users: `roles`, `permissions`, `isSuperadmin`, `employee`
   - resident users: `resident` profile and empty `roles`/`permissions`
   - `redirectTo` (`/dashboard` for employees, `/resident/history` for residents)
3. An `access_token` JWT is stored in an `httpOnly`, `SameSite=Lax` cookie.
   It lasts 1 hour, or 30 days when "Remember me" is selected.
4. `GET /api/auth/me` restores the session for both account types.
5. `POST /api/auth/logout` clears the cookie.

#### Authorization

- `authenticate` verifies the JWT and sets `req.userId`.
- `requirePermission("name")` requires an **employee** profile and checks the
  effective permissions from the employee's roles plus direct permissions.
- A global `superadmin` role (`siteId = null`) bypasses ordinary permission
  checks. Site-scoped roles named `superadmin` do not.
- A resident calling an employee endpoint receives `403 Employee access required`.

#### Default superadmin

After running `superAdminSeeder.ts`, log in with the configured
`SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD`.

### API Overview

All routes are prefixed with `/api`, except the root health route.

| Route group | Purpose |
| --- | --- |
| `/api/auth` | `POST /login`, `POST /logout`, `GET /me` |
| `/api/employee` | Employee CRUD, employee permissions |
| `/api/role` | Role CRUD, role permissions |
| `/api/site` | Site CRUD |
| `/api/permission` | List available permissions |
| `/api/location` | Locations and floors |
| `/api/rooms` | Rooms, room import/export |
| `/api/bed` | Beds |
| `/api/room-allocation` | Room allocations |
| `/api/resident` | Resident CRUD, Excel import/export |
| `/api/notification` | List/read notifications, WebSocket ticket |
| `/api/audit` | Audit logs |

Most employee routes require authentication and a specific permission. See the
router files in `src/routes/` for exact methods and guards.

### Realtime Notifications

1. The client calls `POST /api/notification/socket-ticket` while authenticated.
2. The API returns a single-use ticket.
3. The client connects to:

```text
ws://localhost:5000/ws/notifications?ticket=<ticket>
```

4. New notifications are pushed as `notification:new` events.

Set `CORS_ORIGINS` correctly when the frontend is served from a different
origin or port.

## Database Notes

- Models include users, employees, residents, sites, roles, permissions,
  locations, floors, rooms, beds, room allocations, notifications and audit
  logs.
- Resident accounts are linked one-to-one to `User` through `Resident.userId`.
- Employee accounts are linked one-to-one to `User` through `Employee.userId`.
- Every important mutation is written to the audit log with actor, action,
  resource and optional before/after values.

## CI

The GitHub Actions workflow in `.github/workflows/ci.yml` runs on pushes and
pull requests to `main`.

- Uses Bun `1.3.11`.
- Frontend: `bun install --frozen-lockfile`, `bun run lint`, `bun run build`.
- Backend: `bun install --frozen-lockfile`, `bun run db:generate`,
  `bun run build`.

Run the same checks locally before opening a pull request:

```bash
# frontend
cd frontend
bun run lint
bun run build

# backend
cd ../backend-express
bun run db:generate
bun run build
```

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `DATABASE_URL is not defined` | Create `backend-express/.env` from `.env.example` and set `DATABASE_URL`. |
| `JWT_SECRET is not defined` | Set `JWT_SECRET` in `backend-express/.env`. |
| Prisma client import fails | Run `bun run db:generate` in `backend-express/`. |
| `PrismaClientInitializationError` / connection refused | Verify PostgreSQL is running, the database exists and `DATABASE_URL` is correct. |
| CORS error or cookies not sent | Add the exact frontend origin to `CORS_ORIGINS`; requests use `credentials: "include"`. |
| `EADDRINUSE` on port 5000 | Stop the process using the port or set another `PORT`. |
| Frontend cannot reach the API | Set `VITE_API_BASE_URL` in `frontend/.env` and restart Vite. |
| Logger shows `bun.lock` changed unexpectedly | Use Bun for all installs and commit `bun.lock`. |

## License

ISC
