# Local-First Workout Logging (Set Sync First Slice)

## 1) Architecture Spec

### Goals
- Logging stays responsive offline and during flaky network.
- Writes survive refresh/crash.
- Duplicate set rows are prevented across retries, resume, and race conditions.
- Existing routes and workout flow remain unchanged.

### Data Model
- Remote (`public.sets`):
  - `id uuid` (client-generated for new local sets).
  - `client_set_uuid uuid` (stable idempotency key per logical set).
  - `last_op_id uuid` (last applied client operation id).
  - Existing set fields remain unchanged.
- Local queue (IndexedDB):
  - Store: `set_operations`, key: `setId`.
  - One pending operation per set id (latest write wins locally).
  - Operation shape:
    - `kind`: `upsert | delete`
    - `setId`, `sessionId`, `sessionExerciseId`
    - `opId`, `attempts`, `nextRetryAt`, `lastError`
    - `payload` (for upsert)

### Queue Lifecycle
1. UI updates local state immediately (optimistic and local-first).
2. New set creation, edits, and deletes enqueue durable ops in IndexedDB immediately.
3. Queue attempts flush when online/visible.
4. On success: op is removed.
5. On failure: op is retained and retried with exponential backoff + jitter.
6. On refresh/resume: queue reloads from IndexedDB and continues flushing.
7. Session hydration overlays pending queued mutations on fetched DB session, preserving unsynced local edits.

### Idempotency Strategy
- Client generates stable `setId` UUID for new sets and uses it consistently.
- Upsert writes use `id` as deterministic conflict target; retries update same row.
- `client_set_uuid` is also stored and constrained unique per user for additional guardrails.
- `last_op_id` provides operation-level traceability and dedupe safety.

### Conflict Policy
- Single-device preferred:
  - Queue assumes one active logging device for in-progress sessions.
- Multi-device behavior:
  - Last-write-wins per set row (`upsert` on same `id`).
  - Independent set IDs created on different devices remain distinct rows.
  - In a future slice, session-level device lock/versioning can tighten this.

### Live Rest/Pacing Feedback
- All set edits remain local-first in Zustand.
- Rest/pacing UI uses local state only; network sync is asynchronous and non-blocking.

## 2) DB Migrations For Idempotency

- Added migration: `supabase/migrations/20260622000000_add_set_idempotency_keys.sql`
- Changes:
  - Adds `client_set_uuid uuid` and `last_op_id uuid`.
  - Backfills `client_set_uuid = id` for existing rows.
  - Sets `client_set_uuid` as `NOT NULL`.
  - Adds unique index on `(user_id, client_set_uuid)`.
  - Adds unique partial index on `(user_id, last_op_id)` where `last_op_id IS NOT NULL`.
  - Adds insert trigger to default `client_set_uuid` for legacy writers.

## 3) Incremental Plan

1. Add DB idempotency columns/indexes with backward-safe backfill.
2. Introduce isolated queue engine + IndexedDB store for set operations.
3. Swap `useSetPersistence` from direct writes to queue enqueue.
4. Add in-session sync status indicator in existing header.
5. Replay pending queue mutations on session hydration (refresh/resume safety).
6. Add tests for dedupe/retry/resume/overlay behavior.
7. Expand next slices:
   - Session creation queue/idempotency (`client_session_uuid`).
   - Optional session-level versioning/lock for stricter multi-device conflict handling.

## Risks And Fallback

### Risks
- Queue engine bug could delay sync.
- Multi-device concurrent editing still uses last-write-wins semantics.
- Legacy paths writing sets without queue rely on server defaults/trigger.

### Fallback Plan
- Keep optimistic local state independent from sync status.
- If queue fails hard, surface `error` status in-session and preserve local data.
- Existing server row constraints prevent duplicate set creation even under retries.
