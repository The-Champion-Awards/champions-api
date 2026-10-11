# Architecture

Champions API replaces Supabase as the backend for the [Champions Flutter app](https://github.com/The-Champion-Awards/champions), an annual awards platform where users rank media, results aggregate into leaderboards, and top entries are seeded into bracket tournaments.

This doc covers the target design and the decisions behind it. The move off Supabase is tracked separately in [supabase-migration.md](supabase-migration.md).

## Target architecture

| Layer | Technology |
|---|---|
| Client | Flutter (existing) + React admin dashboard (new) |
| API | Node.js / TypeScript / Express, layered: routes → services → repositories |
| Database | PostgreSQL on AWS RDS, migrations via node-pg-migrate or Prisma |
| Auth | JWT access + refresh rotation, bcrypt, role-based access control |
| Jobs | Scheduled TMDB refresh: queue, retry with backoff, dead-letter handling |
| Cache | Redis on the hot read path |
| Tests | Jest (unit) · Supertest (integration) · Playwright (end-to-end) |
| Infra | Docker · GitHub Actions · AWS (EC2 or ECS, RDS, S3) · CloudWatch |

## Decisions

| # | Decision | Choice | Why |
|---|---|---|---|
| 1 | Migration strategy | Big-bang rewrite | Avoid dual-write and split reads between Supabase and AWS. Supabase stays in production until a one-time cutover. |
| 2 | Repository layout | Separate repo (`champions-api`) | Frontend and backend deploy, test, and version independently. |
| 3 | Database access | _Open:_ Prisma vs. node-pg-migrate + raw SQL | |
