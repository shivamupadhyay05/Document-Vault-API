# Document Vault GraphQL API

A schema-first GraphQL API for organizing documents into collections, built with Bun, TypeScript, GraphQL Yoga, PostgreSQL, and Prisma. The application provides collection management, document CRUD operations, movement between collections, case-insensitive substring search, state filtering, and cursor-based pagination.

---

## Features

- **Collection Management**: Create collections with validated names and URL-friendly kebab-case slugs. Query all collections or fetch a single collection with its nested documents.
- **Document Management**: Create documents within collections, perform partial updates (`title`, `content`, `tags`, `isArchived`), delete documents permanently, and move documents between collections.
- **Search & Filtering**: Perform case-insensitive substring searches across document titles and content, filter documents by collection, and filter by archived state (`true` / `false`).
- **Cursor-Based Pagination**: Paginate through document result sets using Relay-style GraphQL connection semantics (`first` and `after` opaque base64 cursors).
- **Validation & Error Handling**: Rigorous input validation throwing structured `GraphQLError` exceptions with clean user-facing messages.
- **Automated Testing**: Unit test suite (46 tests) using `bun:test` and a mocked Prisma context, plus an end-to-end integration test running real HTTP queries against Dockerized PostgreSQL.

---

## Tech Stack

| Technology | Role | Version |
| --- | --- | --- |
| **Bun** | Runtime & Package Manager | `v1.4.0` |
| **TypeScript** | Primary Language (Strict Mode) | `v5.7.0` |
| **GraphQL Yoga** | Schema-first GraphQL Server | `v5.22.0` |
| **PostgreSQL** | Relational Database Engine | `16-alpine` |
| **Prisma** | Object-Relational Mapping (ORM) | `v6.4.0` |
| **Docker Compose** | Database Container Orchestration | `v2.x` |
| **bun:test** | Native Unit & Integration Test Runner | Built-in |

---

## Project Structure

```
document-vault-api/
├── docker-compose.yml       # PostgreSQL 16 container definition & volume setup
├── package.json             # Bun scripts and dependency configuration
├── tsconfig.json            # TypeScript compiler configuration (strict mode)
├── .env.example             # Template for environment configuration
├── prisma/
│   ├── schema.prisma        # Prisma schema defining Collection and Document models
│   └── migrations/          # Real SQL database migrations
│       └── 20260822070427_init/
│           └── migration.sql
├── src/
│   ├── index.ts             # Application entry point & Bun HTTP server initialization
│   ├── graphql/
│   │   ├── schema.graphql   # Schema-first GraphQL SDL definition
│   │   ├── context.ts       # GraphQL Context definition containing Prisma Client
│   │   └── resolvers.ts     # Query, Mutation, and Type field resolvers
│   ├── lib/
│   │   └── prisma.ts        # Reusable PrismaClient instance
│   └── utils/
│       ├── validation.ts    # Name, slug, and input validation functions
│       └── cursor.ts        # Base64 cursor encoding and decoding utilities
└── tests/
    ├── graphql/
    │   └── resolvers.test.ts        # Resolver unit test suite (mocked Prisma)
    └── integration/
        └── document-vault.test.ts   # E2E integration test against PostgreSQL
```

---

## Prerequisites

Before running the project, ensure you have the following installed on your system:

- **Bun**: `v1.4.0` or higher ([Install Bun](https://bun.sh))
- **Docker Desktop / Docker Engine**: `v20.10+` with **Docker Compose**
- **Git**: `v2.x`

> [!NOTE]
> PostgreSQL is provided through Docker Compose, so a local PostgreSQL installation is not required.

---

## Environment Variables

Copy the `.env.example` file to create a local `.env` configuration file:

```bash
cp .env.example .env
```

The environment variables configured in `.env` are:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/document_vault?schema=public"
PORT=4000
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=document_vault
POSTGRES_PORT=5432
```

---

## One-Command Setup

To start PostgreSQL, install dependencies, generate the Prisma client, and launch the development server in a single command, run:

```bash
docker compose up -d && bun install && bun run gendb && bun run dev
```

### Command Breakdown

- `docker compose up -d`: Starts the PostgreSQL 16 database container in background detached mode.
- `bun install`: Installs project dependencies defined in `package.json`.
- `bun run gendb`: Runs `prisma generate` to generate the TypeScript Prisma client matching `prisma/schema.prisma`.
- `bun run dev`: Launches the GraphQL Yoga server in watch mode using `bun --watch src/index.ts`.

---

## Running the API

Once the server is running, the GraphQL API is available at:

```
http://localhost:4000/graphql
```

You can open `http://localhost:4000/graphql` in your browser to access the interactive **GraphiQL IDE** for testing queries and mutations.

---

## Database & Prisma Workflow

Database persistence is managed through PostgreSQL and Prisma ORM.

### Key Prisma Commands

```bash
# Generate Prisma Client (after schema changes)
bun run gendb

# Apply database migrations to PostgreSQL
bun run db:migrate
```

> [!IMPORTANT]
> All database schema changes are managed via real Prisma migrations (`prisma migrate dev`). `prisma db push` and hand-written SQL are not used.

---

## GraphQL API Reference

### Queries

#### 1. Fetch All Collections
```graphql
query GetCollections {
  collections {
    id
    name
    slug
    createdAt
  }
}
```

#### 2. Fetch Single Collection with Nested Documents
```graphql
query GetCollection($id: ID!) {
  collection(id: $id) {
    id
    name
    slug
    createdAt
    documents {
      id
      title
      content
      tags
      isArchived
      createdAt
    }
  }
}
```

#### 3. Search & Filter Documents with Cursor Pagination
```graphql
query SearchDocuments($collectionId: ID, $search: String, $isArchived: Boolean, $first: Int, $after: String) {
  documents(
    collectionId: $collectionId
    search: $search
    isArchived: $isArchived
    first: $first
    after: $after
  ) {
    totalCount
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    edges {
      cursor
      node {
        id
        title
        content
        tags
        collectionId
        isArchived
        createdAt
      }
    }
  }
}
```

### Mutations

#### 1. Create Collection
```graphql
mutation CreateCollection {
  createCollection(input: {
    name: "Engineering Specs"
    slug: "engineering-specs"
  }) {
    id
    name
    slug
    createdAt
  }
}
```

#### 2. Create Document
```graphql
mutation CreateDocument($collectionId: ID!) {
  createDocument(input: {
    title: "GraphQL Architecture Guidelines"
    content: "Schema-first design guidelines for Yoga and Prisma."
    tags: ["graphql", "architecture", "v1"]
    collectionId: $collectionId
  }) {
    id
    title
    content
    tags
    collectionId
    isArchived
    createdAt
  }
}
```

#### 3. Update Document (Partial Update)
```graphql
mutation UpdateDocument($id: ID!) {
  updateDocument(
    id: $id
    input: {
      title: "Updated GraphQL Guidelines"
      tags: ["graphql", "v2"]
      isArchived: true
    }
  ) {
    id
    title
    content
    tags
    isArchived
  }
}
```

#### 4. Move Document to Another Collection
```graphql
mutation MoveDocument($id: ID!, $collectionId: ID!) {
  moveDocument(id: $id, collectionId: $collectionId) {
    id
    title
    collectionId
  }
}
```

#### 5. Delete Document
```graphql
mutation DeleteDocument($id: ID!) {
  deleteDocument(id: $id)
}
```

---

## Validation & Error Handling

Invalid user input returns clear, structured `GraphQLError` exceptions:

| Validation Rule | Error Message |
| --- | --- |
| Empty / whitespace collection name | `"Collection name cannot be empty"` |
| Malformed slug (uppercase, spaces, leading/trailing hyphens) | `"Invalid slug format. Use lowercase letters, numbers, and single hyphens (e.g. engineering-docs)."` |
| Duplicate collection slug | `"A collection with this slug already exists."` |
| Empty / whitespace document title | `"Document title cannot be empty"` |
| Empty / whitespace document content | `"Document content cannot be empty"` |
| Target collection not found | `"Collection not found"` |
| Document not found for update / delete / move | `"Document not found"` |
| `first <= 0` | `"first must be greater than 0"` |
| `first > 100` | `"first cannot be greater than 100"` |
| Malformed base64 cursor or non-existent cursor document | `"Invalid cursor"` |

---

## Cursor Pagination

Document pagination follows Relay connection semantics:

- **`first`**: Number of documents to fetch (default: `20`, max: `100`).
- **`after`**: Opaque base64 cursor encoding the document ID.
- **`totalCount`**: Total number of documents matching the search/filter criteria across all pages.
- **`pageInfo`**:
  - `hasNextPage`: `true` if more records exist beyond the current page.
  - `startCursor`: Base64 cursor of the first returned edge.
  - `endCursor`: Base64 cursor of the last returned edge.

### Fetching Next Page Example

1. Request page 1: `documents(first: 5)`
2. Extract `endCursor` from response `pageInfo.endCursor`.
3. Request page 2: `documents(first: 5, after: "YOUR_END_CURSOR")`.

---

## Testing

### Running Unit Tests

Unit tests directly exercise resolver logic using a mocked Prisma client context (no database or Docker required):

```bash
bun test
```

### Running Integration Tests

Integration tests execute end-to-end HTTP requests against the live Dockerized PostgreSQL container:

```bash
# Ensure Docker container is up
docker compose up -d

# Run test suite
bun test
```

### TypeScript Type Checking

To verify strict static typing across the project:

```bash
bun run typecheck
```

---

## Development Workflow

1. Start PostgreSQL container: `docker compose up -d`
2. Install dependencies: `bun install`
3. Generate Prisma client: `bun run gendb`
4. Start dev server: `bun run dev`
5. Run unit & integration tests: `bun test`
6. Run TypeScript typecheck: `bun run typecheck`

---

## Design Decisions & Tradeoffs

- **Schema-First GraphQL**: Defining `schema.graphql` keeps the API contract explicitly documented and cleanly decoupled from resolver code.
- **Prisma ORM**: Ensures compile-time safety and simplified database querying without writing raw SQL.
- **Opaque Cursor Pagination**: Uses base64 encoded document IDs to prevent performance degradation on large result sets while keeping cursors decoupled from database internals.
- **PostgreSQL Substring Search**: Utilizes Prisma's `mode: "insensitive"` substring search (`ILIKE`) to provide robust case-insensitive search across title and content without introducing heavy external search engine dependencies.
- **Lightweight Architecture**: Prefers direct, readable resolver code and clean utility functions over heavy controller/repository abstractions.

---

## Extending the Design

Future enhancements outside the scope of this assignment could include:

- **Authentication & RBAC**: JWT / OAuth2 authentication with role-based document access permissions.
- **Full-Text Search**: Upgrading from substring search to PostgreSQL `tsvector` / `tsquery` or Elasticsearch for relevance scoring and indexing.
- **Audit Logging & Revision History**: Tracking document version history and edit logs.
- **File Attachment Storage**: Integrating S3 / Cloud Storage for binary file attachments.
- **Rate Limiting & Caching**: Redis-backed rate limiting and query caching.

---

## API Limitations & Scope

The current implementation intentionally excludes authentication, RBAC, GraphQL Federation, Redis caching, and cloud deployment in accordance with the assignment parameters.

---

## Walkthrough

A 5–10 minute evaluation walkthrough covers:

1. **Architecture & Project Layout**: Project structure, TypeScript strict mode, and Bun environment setup.
2. **Prisma & Database Setup**: Dockerized PostgreSQL, Prisma schema, and migrations.
3. **GraphQL API & Resolvers**: Queries, mutations, error handling, and field resolvers.
4. **Search, Filtering & Pagination**: Case-insensitive search, combined AND filters, base64 cursors, and `totalCount`.
5. **Testing & Quality Assurance**: Unit test suite using `bun:test` with mocked Prisma context, E2E PostgreSQL integration tests, and typecheck.
