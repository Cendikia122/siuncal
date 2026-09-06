# Comprehensive QA Report - Monitoring Angkot

Tanggal eksekusi: 2026-05-08
Tester: Codex QA
Environment: Docker Compose lokal, timezone repo Asia/Jakarta

## 1. Scope dan Basis Dokumen

Sumber utama yang dipakai:

- `doc1/PRD.md`: scope produk, persona, KPI, RBAC, non-functional requirements.
- `doc1/user-flow.md`: flow login, realtime monitoring, incident center, reporting, auth, rules engine.
- `doc1/task.md`: status phase MVP sampai Phase 16.
- `docs/00-mvp-core-and-rules.md`: keputusan scope gabungan `doc1` + `docs`.
- `docs/04-risk-scoring-and-anomaly-rules.md`: threshold rules, severity, risk scoring.
- `docs/08-api-contract-dashboard.md`: kontrak endpoint dashboard/intelligence.
- `docs/16-public-report-and-passenger-mobile.md`: public tracking, public report, MinIO evidence, passenger tracking.

Scope audit turn ini:

- Operator Web build/runtime readiness.
- API Gateway auth/RBAC/CSRF/public endpoints.
- Passenger tracking dan public report validation.
- Runtime Docker reproducibility.
- Security headers dan basic injection/auth negative tests.
- Performance smoke dengan concurrency kecil.

Out of scope karena blocker:

- UI/UX visual full-pass, screenshot browser, keyboard navigation, responsive viewport, dan WCAG runtime audit tidak bisa diselesaikan karena `operator-web` gagal build di Docker.
- Full load/stress/stability test tidak layak dilakukan sebelum build blocker dan migration drift ditangani.

## 2. User Persona dan Use Case

| Persona | Tujuan utama | Use case prioritas |
| --- | --- | --- |
| Operator Dishub (`OPERATOR`) | Monitoring armada dan tindak lanjut incident | Login, lihat realtime map, filter kendaraan, buka incident, acknowledge/assign/resolve/false alarm, lihat public report queue |
| Analis Dishub (`ANALISA`) | Konfigurasi, audit, reporting, data sensitif | Master data CRUD, audit logs, reports export, analytics, heatmap, sanction/compliance/network, sensitive owner details |
| Masyarakat (`PUBLIC_USER`) | Tracking publik dan kirim laporan | Lihat posisi angkot tanpa login; login untuk submit laporan dengan plate wajib, lokasi wajib, dan foto wajib |
| Device GPS / simulator | Mengirim sumber kebenaran lokasi kendaraan | Kirim telemetry kendaraan, update latest position, menjadi evidence rules engine |

## 3. Requirement Matrix

| ID | Requirement | Source | Expected | Actual | Status |
| --- | --- | --- | --- | --- | --- |
| FR-01 | Login operator/analisa | `doc1/user-flow.md` | `POST /auth/login` membuat session/cookie | Operator dan Analisa login `200 OK` | Pass |
| FR-02 | Protected dashboard API | `doc1/PRD.md` | Endpoint internal butuh auth | `/dashboard/summary` tanpa token `401` | Pass |
| FR-03 | RBAC export report | `doc1/PRD.md` | Export/report sensitif hanya `ANALISA` | Operator ke `/reports/rit/export` `403` | Pass |
| FR-04 | CSRF state mutation | `doc1/user-flow.md` | Mutating request cookie-based butuh `x-csrf-token` | Incident action tanpa CSRF `403 CSRF_ERROR` | Pass |
| FR-05 | Public tracking tanpa login | `docs/16-public-report-and-passenger-mobile.md` | `GET /public/vehicles` terbuka dan tidak bocor owner/driver/device | `200 OK`, data terbatas kendaraan/rute/last seen | Pass |
| FR-06 | Public report login-gated | `docs/16-public-report-and-passenger-mobile.md` | Submit report wajib auth `PUBLIC_USER` | Unauth `/public/reports` `401` | Pass |
| FR-07 | Public report required evidence | `docs/16-public-report-and-passenger-mobile.md` | `plate_no`, lokasi, `reported_at`, minimal satu foto wajib | Missing `reported_at` dan missing foto `400` | Pass |
| FR-08 | Passenger tracking token | `docs/16-public-report-and-passenger-mobile.md` | Mobile login mengembalikan tracking token/session | `auth/mobile/login` return token + session | Pass |
| FR-09 | Passenger telemetry session binding | `docs/16-public-report-and-passenger-mobile.md` | Token tidak boleh dipakai dengan session lain | Invalid session `401`; valid session `200` | Pass |
| FR-10 | Operator web Docker build | `AGENTS.md`, repo README | `operator-web` bisa build/start via Docker | Build gagal: missing `jose` | Fail |
| FR-11 | Full compose reproducible | `AGENTS.md`, repo README | `docker compose up -d --build` sukses semua service | Build gagal: `notification-service` tidak punya lockfile untuk `npm ci` | Fail |
| FR-12 | Heatmap status | `doc1/task.md` Phase 16 | Analisa bisa cek heatmap status tanpa 500 | `/analytics/heatmap/status` `500`, table `heatmap_data` missing | Fail |

## 4. Test Plan

### Approach

- Docs-first analysis untuk menyusun requirement matrix.
- Docker-first runtime validation sesuai instruksi repo.
- API smoke, positive, negative, RBAC, CSRF, dan validation tests via `curl`.
- Security smoke: auth boundary, SQL injection negative login, security headers.
- Performance smoke: 100 request, concurrency 20, dijalankan dari container API.

### Test Data

- `operator@pemda.go.id / password123`
- `analisa@pemda.go.id / password123`
- `warga@sentra.id / password123`
- Seed kendaraan: `F 1901 AK`, `F 1902 AK`, route `01/02/03`

### Commands

```bash
docker compose -f infra/docker-compose/docker-compose.yml up -d --build
docker compose -f infra/docker-compose/docker-compose.yml up -d --build postgres redis minio rules-engine api-gateway operator-web
docker compose -f infra/docker-compose/docker-compose.yml up -d --build postgres redis minio rules-engine api-gateway
curl -i http://localhost:4000/health
curl -i http://localhost:4000/public/vehicles
```

## 5. Test Execution Summary

| Area | Executed | Pass | Fail | Blocked |
| --- | ---: | ---: | ---: | ---: |
| Documentation/requirements analysis | 12 | 12 | 0 | 0 |
| Docker/build/runtime readiness | 3 | 1 | 2 | 0 |
| API functional smoke | 12 | 10 | 2 | 0 |
| Security smoke | 8 | 7 | 1 | 0 |
| Performance smoke | 2 | 1 | 1 | 0 |
| UI/UX runtime audit | 0 | 0 | 0 | 1 |

Overall status: **Not ready for QA sign-off**.

## 6. Bug Reports

### BUG-001 - Full Docker Compose Build Fails on `notification-service`

Severity: Critical
Priority: P0
Area: Reproducible environment

Evidence:

```text
docker compose -f infra/docker-compose/docker-compose.yml up -d --build
target notification-service: failed to solve
RUN npm ci --only=production
The `npm ci` command can only install with an existing package-lock.json
```

Code reference:

- `services/notification-service/Dockerfile:6-9`
- `services/notification-service/package.json` exists, but `services/notification-service/package-lock.json` is missing.

Impact:

- Full stack cannot be built from a clean Docker workflow.
- Violates repo instruction that runtime/build tasks should be reproducible via Docker.
- Blocks full end-to-end QA and demo readiness.

Suggested fix:

- Add a committed `package-lock.json` for `notification-service`, or change the Dockerfile install strategy consistently if this service intentionally does not use npm lockfiles.
- Prefer `npm ci --omit=dev` once lockfile exists.

### BUG-002 - Operator Web Docker Build Fails Because `jose` Is Missing

Severity: Critical
Priority: P0
Area: Frontend build

Evidence:

```text
target operator-web: failed to solve
./src/middleware.ts:3:1 Module not found: Can't resolve 'jose'
```

Code reference:

- `apps/operator-web/src/middleware.ts:3`
- `apps/operator-web/package.json:11-39` has no `jose` dependency.

Impact:

- Website cannot be built/run in Docker.
- Blocks UI/UX audit, visual regression, responsive testing, accessibility testing, and browser-based functional flow.
- Also shows a Next.js 16 warning: `middleware` convention is deprecated; Context7 docs confirm Next.js 16 prefers `proxy.ts`/`proxy` unless edge runtime is intentionally needed.

Suggested fix:

- Add `jose` to `apps/operator-web/package.json` and lockfile, or remove the dependency and validate token through an API/session check.
- Migrate `middleware.ts` to `proxy.ts` if compatible with current runtime behavior.

### BUG-003 - Heatmap Status Endpoint Returns 500 Due Missing `heatmap_data`

Severity: High
Priority: P1
Area: Analytics / database migration drift

Evidence:

```text
GET /analytics/heatmap/status
HTTP/1.1 500 Internal Server Error
{"error":{"code":"INTERNAL_ERROR","message":"Unexpected server error"}}

api-gateway log:
relation "heatmap_data" does not exist

psql:
to_regclass('public.heatmap_data') = null
```

Code reference:

- `services/api-gateway/src/server.js:4345-4352`
- `db/migrations/015_heatmap_data.sql:3-22`

Impact:

- Analisa heatmap/status page will fail at runtime if the existing Docker volume does not have migration 015.
- Confirms known schema-drift risk from reused Postgres volumes.

Suggested fix:

- Apply pending migrations to the running volume or add a repeatable migration runner.
- Add startup/schema check for Phase 16 tables so the API fails loudly before serving broken endpoints.

### BUG-004 - Redis Uses `allkeys-lru`, API Logs Warn It Should Be `noeviction`

Severity: Medium
Priority: P2
Area: Infrastructure reliability

Evidence:

```text
api-gateway log:
IMPORTANT! Eviction policy is allkeys-lru. It should be "noeviction"
```

Code reference:

- `infra/docker-compose/docker-compose.yml` Redis command uses `--maxmemory-policy allkeys-lru`.

Impact:

- Session/rate-limit/cache semantics can become unreliable under memory pressure.
- This is especially risky for auth/session-adjacent data and public endpoint rate limiting.

Suggested fix:

- Use `noeviction` for local parity with the Redis client expectation, or explicitly document which keys are safe to evict and adjust the client warning.

### BUG-005 - Public Endpoint Rate Limit Makes Small Concurrency Smoke Return 429

Severity: Medium
Priority: P2
Area: Performance / public tracking

Evidence:

```json
{"path":"/public/vehicles","total":100,"concurrency":20,"ok":0,"failed":100}
```

Follow-up single request immediately after test:

```text
HTTP/1.1 429 Too Many Requests
```

Impact:

- Rate limit is effective, but the current threshold may be too low for public tracking if many mobile clients poll through the same NAT/network.
- Needs product decision: public tracking should likely be cached and rate-limited differently from telemetry submit.

Suggested fix:

- Separate read-only public tracking rate limit from write-heavy telemetry/report endpoints.
- Add cache headers or short-lived server-side cache for `/public/vehicles`.

## 7. Security Testing

| Test | Expected | Actual | Status |
| --- | --- | --- | --- |
| Missing auth on internal endpoint | `401` | `/dashboard/summary` returned `401 Missing token` | Pass |
| Operator blocked from Analisa export | `403` | `/reports/rit/export` returned `403 Insufficient role` | Pass |
| CSRF missing on mutating cookie request | `403` | Incident action returned `403 CSRF_ERROR` | Pass |
| SQL injection-style login payload | no bypass | Login returned `401 Invalid credentials` | Pass |
| Public tracking data minimization | no owner/driver/device sensitive fields | `/public/vehicles` returned vehicle/route/latest only | Pass |
| Security headers | CSP/XFO/nosniff/referrer present | Present on API responses | Pass |
| HSTS | Required in production TLS | Not present on local HTTP | Risk accepted for local; required before production |
| CSP inline style | Prefer no unsafe inline per OWASP | API CSP includes `style-src 'unsafe-inline'` | Review |

Reference: OWASP HTTP Headers Cheat Sheet recommends anti-clickjacking via CSP `frame-ancestors`/`X-Frame-Options`, `Referrer-Policy`, and careful CSP tuning.

## 8. Performance Smoke

Executed inside `api-gateway` container with 100 requests, concurrency 20:

| Endpoint | OK | Failed | p50 | p95 | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| `/health` | 99 | 1 | 9 ms | 23 ms | One failure likely transient during concurrent local container run; rerun needed after blockers fixed |
| `/public/vehicles` | 0 | 100 | 8 ms | 13 ms | All counted failed because rate limiter returned 429 |

Interpretation:

- API latency is fast for lightweight endpoints under small local load.
- Public tracking load behavior cannot be evaluated meaningfully until rate-limit policy is separated from performance testing strategy.

## 9. UI/UX and Accessibility Audit

Runtime UI audit status: **blocked**.

Reason:

- `operator-web` Docker build fails before container can start.
- No reliable `http://localhost:3000` target exists for screenshot, responsive viewport, keyboard navigation, screen reader/ARIA, or microinteraction checks.

Static observations:

- The app uses a shadcn-like component set under `apps/operator-web/src/components/ui`.
- Auth guards and role capability maps exist in frontend state/context.
- Next.js 16 docs indicate `middleware.ts` is deprecated in favor of `proxy.ts`; current file is still `middleware.ts`.

Deferred UI test cases once build is fixed:

| ID | Scenario | Viewports | Expected |
| --- | --- | --- | --- |
| UI-01 | Login page visual/accessibility | 1440, 1024, 390 | No overflow, labels visible, keyboard submit works |
| UI-02 | Operator dashboard map | 1440, 1024, 390 | Map renders, marker/filter/sidebar usable |
| UI-03 | Incident list/detail | 1440, 390 | Filters and actions visible, no clipped text |
| UI-04 | Analisa-only pages | 1440, 390 | Operator cannot access; Analisa can access |
| UI-05 | Public reports queue | 1440, 390 | Review status, attachments, actions clear |
| A11Y-01 | Keyboard navigation | desktop | Focus order logical, no traps |
| A11Y-02 | Screen-reader semantics | desktop | Buttons/inputs have accessible names |
| A11Y-03 | Color contrast | all | WCAG AA for text and state indicators |

## 10. Recommended Next Steps

1. Fix P0 build blockers:
   - add/fix `notification-service` lockfile or Docker install command;
   - add `jose` dependency or refactor middleware token validation.
2. Re-run full `docker compose -f infra/docker-compose/docker-compose.yml up -d --build`.
3. Apply pending migration `015_heatmap_data.sql` to the active Docker volume or implement migration runner.
4. Re-run browser QA for:
   - desktop/tablet/mobile screenshots;
   - login dashboard flow;
   - incident actions;
   - role-based navigation;
   - public reports queue;
   - accessibility keyboard pass.
5. Separate public read endpoint rate limits from write endpoints and rerun load test with realistic polling assumptions.

## 11. QA Sign-Off

Decision: **Rejected / Not ready for release**.

Rationale:

- Full Docker build fails.
- Operator Web cannot build, so the website cannot be verified visually or functionally through browser.
- One Analisa analytics endpoint returns 500 due schema drift.
- Public tracking performance behavior is dominated by rate limiting, so capacity is not yet measurable.

Release risk: **High** until P0/P1 issues are fixed and browser-based regression testing passes.
