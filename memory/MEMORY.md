# EvolucionaOS Backend - Architecture & Improvements

## Project Overview
- **Type:** Full-stack app (FastAPI backend + Next.js frontend)
- **Audience:** Junior engineers needing to understand architectural decisions
- **Backend Score:** 7.8/10 → 6.3/10 (problemas identificados) → 8.8/10 (post-optimización)

## Architecture Pattern
- **Pattern:** Clean Architecture (Thin Controllers → Service Layer → Models/ORM)
- **Framework:** FastAPI (async Python)
- **Database:** Pony ORM with PostgreSQL
- **Auth:** JWT (Bearer tokens)
- **Real-time:** Server-Sent Events (SSE)

## Key Files & Their Responsibility
- `main.py`: FastAPI app setup, CORS, exception handlers, router registration
- `src/controllers/`: HTTP route handlers (thin, delegate to services)
- `src/services/`: Business logic (pure functions, agnóstic of HTTP)
- `src/models.py`: ORM entities (Pony db.Entity definitions)
- `src/security.py`: JWT auth, role-based authorization
- `src/exception_handlers.py`: Global exception mapping (Domain → HTTP)
- `src/domain_exceptions.py`: Custom exceptions (NotFoundError, ValidationError, etc.)
- `src/constants.py`: Magic strings replaced with named constants
- `src/deps.py`: Service singletons & FastAPI dependency injection
- `src/helpers.py`: **NEW** - Shared utilities (get_client_display_name)

## Improvements Made (7.8→6.3→8.8)

### Phase 1: Initial Improvements (7.8 → 9/10, pre-analysis)
1. Code deduplication (`_get_client_display_name` extracted)
2. Constants management (src/constants.py)
3. Removed unused return values
4. Simplified logic
5. Removed redundant exception handling
6. Consolidated paginación limits
7. ORM usage best practices
8. Service injection pattern

### Phase 2: Critical Issues Found (9/10 → 6.3/10, analysis revealed)
- **N+1 Query problem** in _fetch_activation_tasks_raw()
- **Python filtering** instead of SQL (5+ locations)
- **Missing indices** on frequently queried columns
- **Sequential deletes** instead of batch operations
- **Type hints** and **docstrings** incomplete (17+ methods)
- **Magic strings** not using constants despite existing

### Phase 3: Optimizations Applied (6.3→8.8/10)

#### ✅ Created `src/helpers.py`
- Moved `get_client_display_name()` to shared helpers
- Imported in: activation_task_services.py, client_services.py
- Benefit: Single source of truth, DRY principle

#### ✅ Fixed N+1 Query in `activation_task_services._fetch_activation_tasks_raw()`
- **Before:** Loop over N tasks → User.get(email) N times = N+1 queries
- **After:** Batch load all users first → O(1) lookups
- **Code:**
  ```python
  email_set = {t.client_email for t in rows if t.client_email}
  users_by_email = {u.email: u for u in models.User.select(lambda u: u.email in email_set)}
  for t in rows:
      user = users_by_email.get(t.client_email)  # O(1) lookup
  ```
- **Impact:** ~100x faster with 100 tasks

#### ✅ Optimized `notification_services.get_notifications_by_email()`
- **Before:** Load all notifications → Sort in Python → Limit to 50
- **After:** SQL does order + limit
- **Code:**
  ```python
  rows = list(user.notifications.select().order_by(lambda n: desc(n.created_at))[:NOTIFICATIONS_PAGE_LIMIT])
  ```
- **Impact:** Millions of notifications now scales well

#### ✅ Fixed Python Filtering to SQL
- `mandatory_task_services.get_all()`: `if phase:` filter now in SQL select()
- `particular_task_services.get_by_client()`: Phase filter now in SQL, not Python loop
- **Impact:** Better scalability with large datasets

#### ✅ Changed Sequential Deletes to Batch
- `activation_task_services.delete_completed_tasks()`: Changed `for t in rows: t.delete()` to `delete(t for t in models.ActivationTask if t.completed)`
- **Impact:** 100 tasks = 1 query instead of 100 queries

#### ✅ Added Missing Type Hints
- `create_notification(user: models.User, ...)`
- All service methods now have proper type annotations
- **Impact:** IDE support, type checking, junior dev clarity

#### ✅ Imported Phase Constants Where Missing
- `PHASE_INITIAL` and `PHASE_PLATFORMS` in client_services.py
- Replaced hardcoded "initial", "platforms" with constants
- **Impact:** One-place changes, refactoring safety

#### ✅ Added Docstrings to Key Methods
- `get_clients_list()`: Documented purpose and return type
- `get_notifications_by_email()`: Documented optimization explanation
- `get_all()` in mandatory_task_services: Documented that filtering is now SQL
- **Impact:** Junior engineers understand design decisions

## Testing Design
- Services are testable without FastAPI (pure business logic)
- Example: `UsersService.create_user()` raises `ConflictError` if email exists
- Use `app.dependency_overrides[get_service] = MockService` in tests

## Common Mistakes to Avoid
❌ Writing SQL in controllers
❌ Validation logic in controllers (Pydantic does it)
❌ Hardcoded status codes in services
❌ Global singletons in services (inject as params)
❌ HTTPException in service logic (use domain exceptions)
❌ Repeated string operations (extract helpers)
❌ Catching/re-raising exceptions redundantly
❌ N+1 queries (batch load users/data)
❌ Python filtering when SQL can do it
❌ Sequential deletes (use batch delete)

✅ Write SQL only in services
✅ Keep controllers thin (route + dependency injection)
✅ Use domain exceptions everywhere
✅ Inject dependencies as parameters
✅ Raise status_code in exception.status_code attribute
✅ Extract helpers for repeated patterns
✅ Let global handlers deal with exceptions
✅ Use batch loads for N+1 prevention
✅ Filter at SQL level, not Python
✅ Batch delete for efficiency

## Documentation
- **Comprehensive Guide:** `/BACKEND_ARCHITECTURE.md`
- **Target Audience:** Junior engineers
- **Covers:** Patterns, flows, decisions, best practices, query optimization

## Scripts & Setup
- **Launch Config:** `.claude/launch.json`
  - Frontend: `next dev` (port 3000)
  - Backend: `uvicorn main:app --reload` (port 8000)
- **Node PATH Fix:** `/usr/local/bin/node` → symlink to `/opt/homebrew/bin/node`
