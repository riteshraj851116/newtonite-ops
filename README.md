# Newtonite Ops — Operations Under Pressure

A production-minded, mission-critical operations and concurrency management web application built for the **Newtonite Software Engineering Challenge**.

Newtonite Ops provides resilient work-item triage, team-scoped role-based authorization, state machine workflow transitions with Lead approvals, atomic concurrent claiming, optimistic locking (OCC), idempotent write operations, transactional audit history, and a PostgreSQL-backed transactional outbox worker.

---

## Architecture Overview

```mermaid
graph TD
    Client[React + Vite Frontend\nTanStack Query & Axios] -->|REST API + JWT| Express[Node.js / Express Backend\nES Modules]
    
    subgraph Security & Middleware
        Express --> AuthMW[JWT Authentication & Member Hydration]
        AuthMW --> RbacMW[Team-Scoped Multi-Role RBAC]
        RbacMW --> IdemMW[Idempotency Middleware\nSHA-256 Hash Store]
        IdemMW --> ValMW[Zod Request Validation\nHTTP 422 Mapping]
    end

    subgraph Business Logic & Concurrency
        ValMW --> ItemController[Work Item Controller]
        ItemController --> WfEngine[Workflow State Machine Engine\nLead Approval Enforcement]
        ItemController --> OccEngine[Optimistic Concurrency Control\nAtomic Claim Engine]
    end

    subgraph Persistence Layer
        OccEngine --> Prisma[Prisma ORM Client]
        WfEngine --> Prisma
        Prisma -->|ACID Transaction| DB[(PostgreSQL 18\nIndexed Tables)]
        Prisma -->|Transactional Outbox| Outbox[(OutboxJob Table)]
    end

    subgraph Asynchronous Worker
        Outbox --> Worker[Transactional Outbox Worker\nExponential Backoff Retry]
        Worker -->|Audit Notifications| Events[Audit & Notification Stream]
    end
```

---

## Tech Stack

| Layer | Technology | Key Details |
| :--- | :--- | :--- |
| **Frontend** | React 18 + Vite | JavaScript, React Router v6, TanStack Query (`@tanstack/react-query`), Axios, Lucide Icons |
| **Styling** | Vanilla CSS | Modern Enterprise SaaS palette (clean light-grey, dark typography, restrained blue accent) |
| **Backend** | Node.js + Express.js | ES Modules (`"type": "module"`), REST API, JWT Auth, Zod Validation |
| **Database** | PostgreSQL 18 | Prisma ORM, migrations, foreign key constraints, composite query indexes |
| **Testing** | Vitest + Supertest | 15 integration tests covering concurrency, OCC, RBAC, workflows, outbox |
| **Infrastructure** | Docker Compose | Containerized PostgreSQL, embedded fallback daemon, `.env` configuration |

---

## Demo Credentials (Seeded Users)

> [!NOTE]
> All seeded accounts share the default password: `Password123!`  
> The login screen features a 1-click **Quick Demo Account Fill** switcher.

| Role | User Name | Email Address | Assigned Team(s) | Primary Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Elena Rostova | `admin@newtonite.io` | Global (All Teams) | Full administrative control across all teams |
| **Lead** | Marcus Vance | `lead.infra@newtonite.io` | Platform Infrastructure | Create, edit, claim, advance, and **Approve/Resolve** items |
| **Lead** | Sarah Chen | `lead.qa@newtonite.io` | SecOps & Compliance | Lead authority for security audits and approvals |
| **Lead** | David Kim | `lead.core@newtonite.io` | Core Payments | Lead authority for financial payment items |
| **Member** | Alex Rivera | `member.alex@newtonite.io` | Platform Infrastructure | Create, edit, claim, comment, move to Awaiting Approval |
| **Member** | Priya Sharma | `member.priya@newtonite.io` | Core Payments | Financial software engineer |
| **Member** | Leo Morales | `member.leo@newtonite.io` | SecOps & Compliance | Quality and compliance engineer |
| **Member** | Chloe Bennett | `member.chloe@newtonite.io` | Core Payments | FinTech developer |
| **Viewer** | Rachel Green | `viewer.rachel@newtonite.io` | Platform Infrastructure | **Read-only audit access**. Cannot create or mutate |
| **Viewer** | Tom Hanson | `viewer.tom@newtonite.io` | SecOps & Compliance | Read-only compliance auditor |

---

## Core Engineering Features

### 1. Atomic Concurrent Claim (Requirement 6.A)
- When two operators attempt to claim an unassigned work item simultaneously, the request executes an atomic conditional update (`UPDATE ... WHERE id = :id AND assigneeId IS NULL`).
- **Result:** Exactly one request succeeds with HTTP 200. The competing request receives **HTTP 409 Conflict** with payload `{ conflictType: 'CONCURRENT_CLAIM', currentAssignee: ... }`.
- Verified via automated test `10. should handle concurrent claims: exactly one request succeeds and competing request receives HTTP 409`.

### 2. Optimistic Concurrency Control (Requirement 6.B)
- Every work item maintains a monotonically increasing integer `version` number.
- Update requests must supply the client's last-read `version`.
- If the server version has advanced, the update aborts with **HTTP 409 Conflict** (`STALE_UPDATE`), preventing the lost-update anomaly.
- Verified via automated test `11. should reject stale update with HTTP 409 Conflict when client sends an outdated version number`.

### 3. Idempotent Work Item Creation (Requirement 6.C)
- Creation requests accept an `Idempotency-Key` HTTP header.
- The server records the key, computes a SHA-256 payload hash, and executes the operation.
- Repeated requests with the identical key return the cached HTTP status code and response payload with header `X-Cache: IDEMPOTENT-HIT`, guaranteeing no duplicate items are created.
- Verified via automated test `12. should prevent duplicate work items when repeat requests submit the same Idempotency-Key`.

### 4. Resource-Level Authorization (Requirement 6.D)
- Multi-team membership model ensures users can only read or modify work items belonging to teams where they hold active membership.
- Cross-team queries or edits return **HTTP 403 Forbidden**.
- Verified via automated test `4. should reject cross-team resource access when user lacks membership in the target team`.

### 5. Transactional Activity History (Requirement 6.E)
- Every item creation, status transition, priority change, assignment, and comment is appended to the `ActivityEvent` table within the **same atomic database transaction**.
- Verified via automated test `13. should create ActivityEvent in the same transaction when creating or modifying a work item`.

### 6. Transactional Outbox Pattern & Background Worker (Requirement 8)
- Important events insert jobs into the `OutboxJob` table inside the transaction.
- An autonomous polling worker picks up pending jobs, executes handlers idempotently, and manages retries with exponential backoff (`2^attempts * 1000ms`) up to 3 attempts.
- Verified via automated test `15. should process outbox jobs, support retries with backoff, and mark completed jobs`.

---

## Quickstart & Local Setup

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- Docker & Docker Compose (or local PostgreSQL 14+)

### 1. Clone & Install Dependencies
```bash
# Clone the repository
git clone https://github.com/riteshraj851116/newtonite-ops.git
cd newtonite-ops

# Install root, backend, and frontend dependencies
npm run install:all
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Default `.env` configuration:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/newtonite_ops?schema=public"
JWT_SECRET="newtonite-super-secure-production-jwt-key-2026"
JWT_EXPIRES_IN="7d"
CORS_ORIGIN="http://localhost:5173"
```

### 3. Start Database via Docker Compose
```bash
# Start PostgreSQL container
docker-compose up -d

# Verify container is healthy
docker-compose ps
```

*(Alternatively, an embedded PostgreSQL daemon can be started via `npm run db:start`)*

### 4. Database Schema Migration & Seeding
```bash
# Push Prisma schema to PostgreSQL
npm run db:push

# Seed teams, demo users, scenarios, and 2,100+ bulk work items
npm run db:seed
```

### 5. Start Application
```bash
# Terminal 1: Start Backend API server (runs on http://localhost:5000)
npm run dev:backend

# Terminal 2: Start Frontend Development server (runs on http://localhost:5173)
npm run dev:frontend
```

Open your browser to: **http://localhost:5173**

---

## Automated Test Execution

Run the complete integration and unit test suites:

```bash
# Run backend integration tests (15 comprehensive scenarios)
npm test --prefix backend

# Run frontend component tests
npm test --prefix frontend
```

### Backend Test Results:
```
✓ tests/api.test.js (15 tests)
  ✓ 1. should successfully authenticate seeded credentials and return a signed JWT
  ✓ 2. should reject invalid login credentials with HTTP 401
  ✓ 3. should reject requests to protected endpoints without authorization token with HTTP 401
  ✓ 4. should reject cross-team resource access when user lacks membership in the target team
  ✓ 5. should enforce team role permissions: Viewers cannot create work items
  ✓ 6. should allow a Member to create a new work item and return HTTP 201
  ✓ 7. should accept valid workflow transition from Open to In_Progress
  ✓ 8. should reject invalid workflow jump from In_Progress directly to Resolved with HTTP 403
  ✓ 9. should enforce that ONLY an authorized Team Lead or Admin can approve an item into Resolved
  ✓ 10. should handle concurrent claims: exactly one request succeeds and competing request receives HTTP 409
  ✓ 11. should reject stale update with HTTP 409 Conflict when client sends an outdated version number
  ✓ 12. should prevent duplicate work items when repeat requests submit the same Idempotency-Key
  ✓ 13. should create ActivityEvent in the same transaction when creating or modifying a work item
  ✓ 14. should perform server-side filtering, sorting, and pagination across thousands of items
  ✓ 15. should process outbox jobs, support retries with backoff, and mark completed jobs
```

---

## API Reference

### Authentication
- `POST /api/auth/login` — Authenticate seeded user credentials; returns JWT token.
- `GET /api/auth/me` — Return authenticated user profile and team memberships.

### Teams
- `GET /api/teams` — Retrieve all teams where authenticated user has membership.
- `GET /api/teams/:id` — Retrieve team details and roster.

### Work Items
- `GET /api/items` — Paginated, filtered, sorted work items scoped to authorized teams.
  - Query parameters: `page`, `limit`, `status`, `priority`, `type`, `teamId`, `assigneeId`, `search`, `sortBy`, `sortOrder`, `awaitingMyApproval`.
- `POST /api/items` — Create new work item. Accepts `Idempotency-Key` header.
- `GET /api/items/:id` — Retrieve work item details with resource-level auth check.
- `PATCH /api/items/:id` — Update work item fields with Optimistic Concurrency Control (`version`).
- `POST /api/items/:id/claim` — Atomically claim unassigned item with 409 conflict handling.
- `POST /api/items/:id/transition` — Advance workflow state machine with Lead approval checks.
- `GET /api/items/:id/activity` — Retrieve transactional audit timeline.
- `GET /api/items/:id/comments` — Retrieve discussion comments.
- `POST /api/items/:id/comments` — Post a new comment.

### Dashboard & System
- `GET /api/dashboard/summary` — Operational metrics (total open, in progress, urgent unassigned, awaiting approval, priority distribution).
- `GET /api/health` — System and database health status.

---

## Production Build Verification

To verify the production build bundle:
```bash
npm run build --prefix frontend
```
Output:
```
dist/index.html                   0.94 kB │ gzip:   0.50 kB
dist/assets/index-OOU6i4p5.css   28.20 kB │ gzip:   5.90 kB
dist/assets/index-BMPG2_o2.js   431.72 kB │ gzip: 130.57 kB
✓ built in 665ms
```

---

## Known Limitations & Production Enhancements
1. **Idempotency Key Retention:** The demo environment stores keys with a 24-hour expiration. In a multi-region deployment, an automated cron or PostgreSQL partition drop should purge expired keys daily.
2. **Real-time Push:** Polling and TanStack Query cache invalidation are currently used for UI updates. In a higher-concurrency production setting, PostgreSQL `LISTEN/NOTIFY` or WebSockets can be paired with TanStack Query.
3. **Outbox Message Broker:** The PostgreSQL transactional outbox worker is intentionally self-contained with no external dependencies (Kafka/RabbitMQ), making it resilient and zero-config for standard cloud environments.
