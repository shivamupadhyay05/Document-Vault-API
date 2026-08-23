# Document Vault API - Submission Notes

## Scope

The project implements the complete "Document Vault - GraphQL API" assignment requirements using Bun, TypeScript, GraphQL Yoga, PostgreSQL, and Prisma. It provides collection management, document CRUD operations, movement between collections, case-insensitive substring search, archived state filtering, and Relay-style cursor-based pagination.

## Verification

- **Unit & Integration Testing**: `bun test` — 47 tests passed (46 unit tests + 1 E2E integration test)
- **Static Type Checking**: `bun run typecheck` — 0 TypeScript errors
- **PostgreSQL Integration**: Real end-to-end integration test running HTTP GraphQL queries against Dockerized PostgreSQL

## Design Tradeoffs

- **Schema-First GraphQL**: Cleanly decouples the GraphQL SDL contract from TypeScript resolver logic.
- **Prisma ORM**: Provides strict TypeScript types and safe database query generation without raw SQL.
- **Cursor-Based Pagination**: Employs opaque base64 cursors (`first` / `after`) to prevent offset pagination performance issues on large datasets.
- **PostgreSQL Substring Search**: Uses Prisma `contains` with `mode: "insensitive"` (`ILIKE`) for search without adding external search engine complexity.
- **Explicit Scope Boundaries**: Intentionally excluded authentication/RBAC, Redis/caching, GraphQL Federation, and cloud deployment in accordance with the assignment parameters.

## Walkthrough

The 5–10 minute evaluation walkthrough demonstrates:

1. **Project Structure**: Workspace layout, TypeScript configuration, and Bun setup.
2. **Prisma Schema & Migrations**: PostgreSQL database schema and SQL migrations.
3. **GraphQL Schema**: Schema-first GraphQL definition (`schema.graphql`).
4. **Collection & Document Operations**: Creation, queries, updates, deletion, and document movement.
5. **Search & Filters**: Title/content substring search, archived state filtering, and combined AND filters.
6. **Cursor Pagination**: Relay connection pattern, page size limits (`first`), opaque base64 cursors (`after`), and `totalCount`.
7. **Unit Tests**: Isolated resolver unit tests via `bun:test` with mocked Prisma context.
8. **PostgreSQL Integration Test**: End-to-end HTTP tests running against live Dockerized PostgreSQL.
9. **Design Tradeoffs**: Architecture decisions and scope boundary rationale.
