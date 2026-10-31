# IssueBuddy — Unified Full-Stack Issue Tracking System

A single Docker-first application that combines the CRUD and DevOps learning objectives in the supplied VNRVJIET report with the expanded full-stack Phase 2 feature set. **Run one application, not separate Phase 1 and Phase 2 projects.** The UI follows the dark navy/purple IssueBuddy reference screenshot on page 12 of the supplied PDF. Reference images are in `docs/`.

## What is included

### Core CRUD (Phase 1 objectives, retained in the unified app)
- Create, list, retrieve, update, partially update and delete issues.
- Status values: `OPEN`, `IN_PROGRESS`, `REVIEW`, `CLOSED`.
- Priority values: `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
- Search, status/priority filtering and pagination.
- List/table and Kanban views.
- Postman collection for the original CRUD exercise retained under `postman/`.

### Full-stack capabilities (Phase 2)
- React + Vite frontend.
- Node.js 22 + Express REST API.
- PostgreSQL 16 + Prisma schema and checked-in SQL migration.
- JWT login, bcrypt password hashing and role-based access control.
- Global roles: `ADMIN`, `MANAGER`, `DEVELOPER`, `VIEWER`.
- Project creation, membership and project-specific roles.
- Issue comments and activity timeline.
- In-app notifications.
- Authenticated attachment upload/download (PNG, JPEG, WEBP, PDF, TXT; max 10 MB).
- Dashboard analytics.
- Docker Compose for all services.
- GitHub Actions CI workflow, API tests and Postman collection.

## Requirements

- Docker Engine
- Docker Compose v2 plugin
- A modern browser

You do not need to install Node.js, npm or PostgreSQL on Fedora/host. Dependencies are installed in Docker image builds.

## Quick start (Fedora/Linux)

1. Extract this ZIP.
2. Open a terminal in the extracted `issuebuddy-unified` directory.
3. Start all services:

   ```bash
   docker compose up --build -d
   ```

4. Check containers and logs:

   ```bash
   docker compose ps
   docker compose logs -f backend
   ```

5. Open **http://localhost:5173**. API health: **http://localhost:8080/health**.

Compose waits for PostgreSQL health, applies migrations, seeds the admin and demo project, then starts the API. The frontend waits for API health.

### First login

Local demo defaults (override in `.env`):

- Email: `admin@issuebuddy.local`
- Password: `ChangeMe123!`

The seed creates the administrator only if the email does not exist; it does not reset an existing password on restart. Change the demo password and secrets before any use beyond a local demonstration.

### Configure secrets

For local evaluation, Compose has development defaults and `.env` is optional. To customize them:

```bash
cp .env.example .env
```

Set a strong `POSTGRES_PASSWORD`, a random `JWT_SECRET` of at least 32 characters, and a strong `ADMIN_PASSWORD`. Use URL-safe characters for the database password because it is embedded in `DATABASE_URL`. Never commit `.env`.

## Docker commands

```bash
# Build and start
docker compose up --build -d

# Follow all logs
docker compose logs -f

# Backend logs only
docker compose logs -f backend

# Show status
docker compose ps

# Stop containers (preserves named data volumes)
docker compose down

# DESTRUCTIVE: also deletes PostgreSQL and uploaded-file data
docker compose down -v
```

PostgreSQL data is stored in `postgres_data`; uploaded files are stored in `uploads_data`. Do not use `down -v` unless you intend to erase those data volumes.

## Services

| Service | Host address | Purpose |
|---|---|---|
| Frontend | http://localhost:5173 | React + Vite UI |
| Backend | http://localhost:8080 | Express API |
| PostgreSQL | localhost:5432 | Relational database |

## Repository structure

```text
issuebuddy-unified/
├── .github/workflows/ci.yml
├── backend/
│   ├── prisma/              # schema, migration and seed
│   ├── src/                 # routes, middleware, services and API
│   ├── test/                # backend tests
│   └── Dockerfile
├── frontend/
│   ├── src/                 # React application and styles
│   └── Dockerfile
├── docs/                    # API guide, design references, phase mapping
├── postman/                 # Phase 1 reference + unified API collections
├── docker-compose.yml
├── .env.example
└── README.md
```

## API overview

See `docs/API.md` and import `postman/IssueBuddy-Phase2.postman_collection.json` into Postman. Main routes:

| Area | Endpoints |
|---|---|
| Health | `GET /health` |
| Authentication | `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` |
| Users | `GET/POST /api/users`, `PATCH /api/users/:id/active` |
| Projects | `GET/POST /api/projects`, `GET /api/projects/:projectId` |
| Project members | `/api/projects/:projectId/members` |
| Issues (CRUD) | `GET/POST /api/issues`, `GET/PATCH/DELETE /api/issues/:issueId` |
| Bulk issues | `POST /api/issues/bulk` |
| Comments/activity | `/api/issues/:issueId/comments`, `/api/issues/:issueId/activity` |
| Attachments | `/api/attachments/issues/:issueId/attachments`, `/api/attachments/:attachmentId/download` |
| Notifications | `/api/notifications` |
| Analytics | `GET /api/analytics/projects/:projectId/analytics` |

All application routes other than login and health require a bearer token.

## Run checks inside Docker

```bash
docker compose exec backend npm test
docker compose exec backend npx prisma validate
docker compose exec frontend npm run build
```

## Phase 1 JSON data compatibility

The original report used `db.json` for its initial CRUD exercise. In this unified application, those CRUD capabilities are retained but run on PostgreSQL so the project has one source of truth. Existing Phase 1 `db.json` records are **not automatically imported**. Back up any old Docker volume before removing it; data migration requires an explicit export/transform/import step. Details are in `docs/PHASE-1-TO-PHASE-2.md`.

## Security and production limitations

This is an academic/local development project, not a security-audited production service. Change example credentials, use TLS, production-grade secrets, database backups, restricted network access and a production server process before public deployment. Upload MIME checks are not a substitute for file-signature validation and malware scanning. JWT logout is client-side token removal; tokens expire after 12 hours.
