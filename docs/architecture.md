# Architecture

Champions API replaces Supabase as the backend for the [Champions Flutter app](https://github.com/The-Champion-Awards/champions), an annual awards platform where users rank media, results aggregate into leaderboards, and top entries are seeded into bracket tournaments.

This doc covers the target design and the decisions behind it. The move off Supabase is tracked separately in [supabase-migration.md](supabase-migration.md).

## Target architecture

| Layer    | Technology                                                                |
| -------- | ------------------------------------------------------------------------- |
| Client   | Flutter (existing) + React admin dashboard (new)                          |
| API      | Node.js / TypeScript / Express, layered: routes → services → repositories |
| Database | PostgreSQL on AWS RDS, migrations via node-pg-migrate or Prisma           |
| Auth     | JWT access + refresh rotation, bcrypt, role-based access control          |
| Jobs     | Scheduled TMDB refresh: queue, retry with backoff, dead-letter handling   |
| Cache    | Redis on the hot read path                                                |
| Tests    | Vitest (unit) · Supertest (integration) · Playwright (end-to-end)         |
| Infra    | Docker · GitHub Actions · AWS (EC2 or ECS, RDS, S3) · CloudWatch          |

## Code structure

```
src/
  server.ts        starts the HTTP server and handles graceful shutdown
  config.ts        reads environment variables and validates them with zod at startup
  app.ts           builds the Express app (middleware + routes); no listening, so tests can import it
  routes/          HTTP layer: paths, input validation, response shape
  services/        business logic; no HTTP or SQL
  repositories/    data access; the only layer that talks to Postgres
```

A request flows `route → service → repository → database` and back. Each layer only calls the one below it, so business rules can be tested without HTTP, and queries can change without touching routes.

Configuration comes only from environment variables, never hardcoded values. `config.ts` validates them once at startup and the app refuses to start if any are missing or invalid, so a bad deploy fails immediately with a clear message. Locally, `npm run dev` and `npm start` load them from a gitignored `.env` file (copied from `.env.example`); in production the platform sets them directly.

Tests sit next to the code they cover (`health.routes.ts` → `health.routes.test.ts`). `tsconfig.build.json` leaves them out of `dist/`.

## Decisions

Numbered in the order they came up. Open ones stay listed until settled.

### 1. Migration strategy: big-bang rewrite

Avoid dual-write and split reads between Supabase and AWS. Supabase stays in production until a one-time cutover.

### 2. Repository layout: separate repo (`champions-api`)

Frontend and backend deploy, test, and version independently.

### 3. Database access: _open_

Prisma vs. node-pg-migrate + raw SQL. Due before phase 1.

### 4. Test runner: Vitest (not Jest)

Native ESM and TypeScript with no extra config; Jest's ESM support is still experimental. Same `describe`/`it`/`expect` API.

### 5. Configuration: zod + Node's `--env-file`

`config.ts` validates env vars with zod at startup, so a bad deploy fails fast. Node 24 reads `.env` natively, so no `dotenv`.
