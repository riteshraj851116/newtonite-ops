# Newtonite Ops — Engineering Decisions & Architecture Log

This document details the architectural decisions, trade-offs, and design rationale behind **Newtonite Ops — Operations Under Pressure**, a mission-critical operations and concurrency management platform.

---

## 1. Concurrency Control: Concurrent Claiming & Optimistic Locking

### Context
In high-stress operations environments, multiple engineers often view incoming incidents or tasks simultaneously. Two high-risk race conditions occur frequently:
1. **Concurrent Claiming (Blind Race Condition):** Two engineers click "Claim" on an unassigned work item at the exact same millisecond. Without strict isolation, both could receive a success message, leading to duplicate ownership or split-brain triage.
2. **Stale Overwrites (Lost Update Problem):** Operator A opens an incident at `v1`, begins drafting notes, while Operator B transitions the incident to `Awaiting_Approval` at `v2`. If Operator A subsequently saves their form without concurrency checks, Operator B's status update is silently overwritten.

### Options Considered
1. **Pessimistic Locking (`SELECT FOR UPDATE`):**
   - *Pros:* Holds an exclusive row-level lock on the PostgreSQL row during reading until transaction completion.
   - *Cons:* Induces thread blocking, drastically limits query throughput, risks database connection pool exhaustion, and introduces distributed deadlock hazards when web clients hold connections.
2. **Optimistic Concurrency Control (OCC) with Integer Version Numbers:**
   - *Pros:* Zero locking overhead on reads. Safe, atomic conditional statements (`UPDATE ... WHERE id = :id AND version = :version`) ensure that only the request with the expected version commits. Version increments monotonically (`version = version + 1`).
   - *Cons:* Conflicts must be caught and gracefully resolved at the application/client level with actionable conflict dialogs.
3. **Atomic Conditional Updates for Claims (`UPDATE ... WHERE id = :id AND assigneeId IS NULL`):**
   - *Pros:* Directly leverages PostgreSQL row-level locks only during the atomic write cycle. Exactly one transaction modifies the row; subsequent concurrent transactions find 0 matching rows and fail cleanly.

### Chosen Approach
- **Claim Operations:** Atomic update conditioned on `assigneeId IS NULL`. The database evaluates the condition atomically inside a transaction. If `updateResult.count === 0`, the losing transaction throws an error with `statusCode: 409` and payload `{ conflictType: 'CONCURRENT_CLAIM', currentAssignee: ... }`. The losing frontend receives HTTP 409 and prompts the user with the identity of the engineer who claimed it.
- **General Work Item Updates:** Optimistic Locking via a required integer `version` field. The client must supply its last-read `version`. If `currentItem.version !== submittedVersion`, the server aborts before making changes and returns HTTP 409 with the fresh server item and current version.

### Trade-offs & Mitigations
- *Trade-off:* Requires client coordination and robust UI error handling.
- *Mitigation:* The frontend implements a dedicated `ConflictModal` that alerts the user whether the conflict was an OCC version collision or a simultaneous claim race, displaying server diffs and an instant "Reload State" action.

---

## 2. Idempotency for Work Item Creation

### Context
Mobile or intermittent network disconnects often trigger automatic client retries or duplicate user clicks on "Create Work Item" buttons. Without idempotency protection, network timeouts where the server committed the record but the client never received the 201 response result in duplicate incidents and duplicate alert notifications.

### Options Considered
1. **Client-side Debouncing / Disable Buttons:**
   - *Pros:* Trivial to implement.
   - *Cons:* Entirely client-dependent. Does not protect against browser reloads, automated scripts, double submissions across tabs, or network retry proxies.
2. **Database Deduplication via Natural Keys:**
   - *Pros:* No extra tables needed.
   - *Cons:* Operational work items often share titles, types, and teams legitimately (e.g., recurring daily tasks), making natural keys infeasible.
3. **Transactional Idempotency Key Store (`IdempotencyKey` Table):**
   - *Pros:* Server-enforced, RFC-compliant architecture. Client sends `Idempotency-Key: <UUID>`. The server atomically records the key, computes a SHA-256 hash of the request path and payload, executes the operation, and caches the HTTP status code and response body for repeat replay.

### Chosen Approach
- Implemented dedicated Express middleware (`src/middleware/idempotency.js`) with an `IdempotencyKey` PostgreSQL table.
- **Workflow:**
  1. If no `Idempotency-Key` header is present on non-POST endpoints, pass through.
  2. If present, lookup existing key scoped to the authenticated user.
  3. If found and status is `COMPLETED`, return the cached response immediately (`X-Cache: IDEMPOTENT-HIT`) with the identical HTTP status and body.
  4. If found and status is `IN_PROGRESS`, return HTTP 409 Conflict indicating a concurrent identical request is in flight.
  5. If not found, insert key with `status: IN_PROGRESS` and 24-hour expiration (`expiresAt: now() + 24h`).
  6. Intercept `res.json` to persist the completed response body and HTTP status code atomically.

### Trade-offs
- *Trade-off:* Extra database write on first request; requires background cleanup of expired keys.
- *Mitigation:* Storage is capped with indexing on `[key, userId]` and `[expiresAt]`. Cleanup is automated or purged periodically.

---

## 3. Team-Scoped Multi-Role Authorization Matrix

### Context
Newtonite Ops serves multiple functional teams (e.g., Platform Infrastructure, SecOps Compliance, Core Payments). An engineer may serve as a `Lead` in Platform Infrastructure, a regular `Member` in SecOps, and a read-only `Viewer` in Core Payments. Global user roles fail to represent this reality.

### Options Considered
1. **Global Role per User (Admin / Manager / Member):**
   - *Pros:* Simple schema.
   - *Cons:* Violates team isolation. A developer in Team A would gain write access to Team B's sensitive compliance items.
2. **Team-Scoped Membership Model (`Membership` Table with Enum Role):**
   - *Pros:* True multi-tenant team scoping. Permissions are calculated dynamically per resource using `(userId, teamId)`.
   - *Cons:* Requires joining or hydrating team memberships on every protected request.

### Chosen Approach
- Implemented `Membership` model linking `User` and `Team` with role enum: `Viewer`, `Member`, `Lead`, `Admin`.
- Authentication middleware hydrates active memberships onto `req.user.memberships`.
- Resource-level middleware checks:
  1. Is the user a member of the requested team? (If not -> HTTP 403 Forbidden).
  2. What is the user's role in this specific team?
  3. Does that role possess the required privilege?

### Permission Matrix

| Capability | Viewer | Member | Lead | Admin |
| :--- | :---: | :---: | :---: | :---: |
| Read items and activity in authorized team | ✅ | ✅ | ✅ | ✅ |
| Read items in non-member teams | ❌ | ❌ | ❌ | ❌ |
| Create new work item in team | ❌ | ✅ | ✅ | ✅ |
| Edit permitted item fields | ❌ | ✅ | ✅ | ✅ |
| Claim unassigned item | ❌ | ✅ | ✅ | ✅ |
| Post comments | ❌ | ✅ | ✅ | ✅ |
| Advance `Open` → `In_Progress` | ❌ | ✅ | ✅ | ✅ |
| Advance `In_Progress` → `Awaiting_Approval` | ❌ | ✅ | ✅ | ✅ |
| **Approve & Resolve (`Awaiting_Approval` → `Resolved`)** | ❌ | ❌ | ✅ | ✅ |
| Close item (`Resolved` → `Closed`) | ❌ | ❌ | ✅ | ✅ |

---

## 4. Transactional Activity History & Outbox Pattern

### Context
Operations systems require an append-only, tamper-evident audit trail for every action: creation, status transitions, priority updates, assignments, and notes. Furthermore, asynchronous side-effects (such as assignee notifications) must never execute if the primary database transaction aborts (dual-write hazard).

### Options Considered
1. **Fire-and-Forget Side Effects:**
   - *Pros:* Quick to code (`axios.post` or event emitter inside controller).
   - *Cons:* Vulnerable to silent data loss if the server crashes before sending, or ghost notifications if the database write rolls back.
2. **PostgreSQL-backed Transactional Outbox Pattern:**
   - *Pros:* ACID guarantees. The work item update, the `ActivityEvent` audit record, and the `OutboxJob` entry are all committed within the **same atomic database transaction**. An asynchronous worker polls the outbox, processes jobs safely, and retries with exponential backoff.
   - *Cons:* Requires a worker loop and job state tracking.

### Chosen Approach
- Used Prisma interactive transactions (`prisma.$transaction(async (tx) => { ... })`).
- Whenever a state change occurs:
  1. `tx.workItem.update(...)`
  2. `tx.activityEvent.create(...)`
  3. If assignment changed: `queueOutboxJob(tx, 'ASSIGNMENT_NOTIFICATION', { ... })`
- Outbox worker polls `OutboxJob` with status `PENDING`, increments attempts, executes handler idempotently, and updates status to `COMPLETED` or schedules retry via `nextRunAt: now() + 2^attempts * 1000ms`. Permanent failures transition to `FAILED` after reaching `maxAttempts: 3`.

---

## 5. Server-Side Pagination, Filtering & Indexing

### Context
Operational systems scale to tens or hundreds of thousands of work items. Client-side filtering crashes web browsers and exposes unauthorized records.

### Options Considered
1. **Client-side Filtering:**
   - *Cons:* Fetches entire database tables into frontend memory; massive security and performance failure.
2. **Server-Side Cursor-based Pagination:**
   - *Pros:* Excellent for infinite scroll.
   - *Cons:* Difficult to jump to specific page numbers in enterprise tables.
3. **Server-Side Offset & Limit Pagination with Composite Database Indexes:**
   - *Pros:* Allows direct page selection (`Page 1 of 141`), total count reporting, multi-column sorting, and server-side text searching.
   - *Cons:* Offset queries can slow down if appropriate B-tree indexes are missing.

### Chosen Approach
- Implemented server-side pagination (`skip`, `take`, `total`, `pages`).
- Added composite PostgreSQL indexes in `schema.prisma`:
  - `@@index([teamId, status])`
  - `@@index([assigneeId, status])`
  - `@@index([priority, status])`
  - `@@index([status, updatedAt])`
  - `@@index([createdAt])`
- All queries scope to the authenticated user's authorized team IDs: `WHERE teamId IN (myTeamIds)`.
- Text search uses case-insensitive `contains` across `title` and `description`.
