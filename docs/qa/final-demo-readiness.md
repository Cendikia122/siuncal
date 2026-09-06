# Final Demo Readiness Audit

Audit date: 2026-05-21 (original) · re-verified 2026-05-29

Branch: `production`

Commit audited: `b8b9576` (original) · re-verified after hardening commits were committed (`5c8869a` + test/schema-check work).

## Production-Grade Hardening 2026-05-30 (WS1–WS8)

Verified on prod-like stack (Caddy TLS + separated worker + Redis-backed limiting):

- **Security (WS1):** API CSP tanpa `unsafe-inline`; telemetry HMAC plumbing; `api-gateway` `npm audit` → 0 vuln; runbook `docs/runbooks/security-hardening.md`.
- **Rate limit → Redis (WS2):** limiter login/global/public/telemetry pakai counter atomik Redis (konsisten lintas instance); `/public/vehicles` di-cache (Redis 3s) + `Cache-Control` + `X-Cache: HIT`. Verifikasi: 8 `rl:*` keys di Redis, cache HIT.
- **Worker terpisah (WS3):** `api-gateway` `RUN_WORKERS=false` (0 worker), container `worker` memproses job; verifikasi log + job enqueue 200.
- **HTTPS (WS6):** Caddy reverse proxy (profile `proxy`) → `https://localhost` (dashboard) 200, `https://api.localhost/health` 200, TLS1.3 Caddy CA, HTTP→HTTPS 308; `trust proxy` aktif (req.ip dari X-Forwarded-For).
- **E2E (WS7):** `services/api-gateway/test/e2e.test.js` — RBAC, incident+CSRF, public report vertical (submit foto→review), heatmap. **23/23 pass live**, 13 pass + 10 skip tanpa server.
- **GPS (WS5):** ingest `/telemetry/vehicle` by `imei_or_serial` → 200 (runbook `docs/runbooks/gps-gt06-integration.md`).
- **Docs:** `docs/architecture/feature-code-analysis.md`, runbook scale-out & EAS.

Scale-out besar (read replica, PgBouncer, TimescaleDB retention/compression, EAS build) didokumentasikan sebagai runbook siap-eksekusi (`docs/runbooks/scale-out.md`, `mobile-eas-build.md`).

## Re-verification 2026-05-29

Full stack rebuilt and re-verified from a clean `docker compose up -d --build`:

- All services up; `api-gateway` healthy (its startup `verifyRequiredSchema()` passed, confirming the schema-check gate works and the schema is complete).
- `/health` → `200`; operator-web `/auth/login` → `200`.
- Live telemetry from `vehicle-simulator`: `vehicle_positions=66`, `vehicle_latest=9`, `telemetry_matched_positions=12` (map-matching active); geofences `43` (BASE=3, HALTE=1, ROUTE_CORRIDOR=3, STOP=33, TERMINAL=3).
- Daily report generated for `2026-05-29`: `report_kpi_daily=6`, `report_rit_daily=18`.
- Live RBAC/CSRF: operator `/reports/rit/export` → `403`; mutating incident action without CSRF → `403`; ANALISA export → `200 text/csv`; unauthenticated `/dashboard/summary` → `401`; invalid telemetry token → `401`.
- `npm test` (api-gateway): **17 pass, 0 fail** with the stack up (13 pass + 4 smoke skipped when no server is reachable). The previous "0 test files" limitation is resolved.

## Docker Commands Run

```sh
docker compose -f infra/docker-compose/docker-compose.yml config --quiet
docker compose -f infra/docker-compose/docker-compose.yml up -d --build
docker compose -f infra/docker-compose/docker-compose.yml --profile simulator up -d --build vehicle-simulator
curl -i http://localhost:4000/health
docker compose -f infra/docker-compose/docker-compose.yml run --rm api-gateway npm test
docker run --rm -v "$PWD/apps/operator-web:/app" -v sentra_operator_web_node_modules:/app/node_modules -w /app node:22-alpine sh -lc "npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund && npm run lint"
docker run --rm -v "$PWD/apps/passenger-mobile:/app" -v sentra_passenger_mobile_node_modules:/app/node_modules -w /app node:22-alpine sh -lc "npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund && npm run lint"
docker compose -f infra/docker-compose/docker-compose.yml run --rm api-gateway npm run report:today
```

## Services

Required stack is running through Docker Compose:

- `api-gateway`: healthy on `http://localhost:4000`
- `operator-web`: running on `http://localhost:3000`
- `postgres`: healthy
- `redis`: healthy, `maxmemory-policy=noeviction`
- `minio`: healthy
- `rules-engine`: healthy via formal Compose healthcheck, internal health `{"ok":true,"service":"rules-engine"}`
- `notification-service`: healthy via formal Compose healthcheck, internal health `{"ok":true,"service":"notification-service"}`
- `vehicle-simulator`: running through the `simulator` profile

## Demo Accounts

- Operator: `operator@pemda.go.id` / `password123`
- Analisa: `analisa@pemda.go.id` / `password123`
- Public user: `warga@sentra.id` / `password123`

## Demo Script

1. Start the full stack:
   ```sh
   docker compose -f infra/docker-compose/docker-compose.yml up -d --build
   ```
2. Start GPS simulator:
   ```sh
   docker compose -f infra/docker-compose/docker-compose.yml --profile simulator up -d --build vehicle-simulator
   ```
3. Verify API health:
   ```sh
   curl -i http://localhost:4000/health
   ```
4. Login operator at `http://localhost:3000/auth/login`.
5. Open dashboard and confirm vehicles `F 1901 AK`, `F 2001 SB`, and `F 3001 BB` update from live telemetry.
6. Open incident detail, run acknowledge, assign, resolve, and false-alarm actions.
7. Login as public user and submit a public report with `plate_no`, location, and one photo.
8. Open operator public report queue, review the report, and run automated rules-first review.
9. Generate daily report and export CSV as ANALISA.

## Telemetry Result

Live simulator telemetry was verified through API and database:

- `vehicle_positions`: receives raw GPS rows.
- `vehicle_latest`: updates latest vehicle state.
- `telemetry_matched_positions`: receives matched rows for every checked telemetry row.
- After simulator heading alignment marker `2026-05-21T14:11:54Z`, final checked window result was 18 raw positions, 18 matched positions, `MATCHED=18`, `OFF_ROUTE=0`, `NGETEM=0`, `WRONG_DIRECTION=0`.
- Geofence restore check: `BASE=3`, `HALTE=1`, `ROUTE_CORRIDOR=3`, `STOP=33`, `TERMINAL=3`.

## Incident Workflow Result

Incident API was verified with operator cookie and CSRF token:

- `ACKNOWLEDGE` moved an incident into `IN_PROGRESS`.
- `ASSIGN` stored PIC user `12f1d7cc-01a7-4d16-be5b-25ca27043bc5`.
- `RESOLVE` moved the incident into `RESOLVED`.
- `FALSE_ALARM` moved another incident into `FALSE_ALARM`.
- `incident_actions` recorded all actions.
- `audit_logs` recorded `INCIDENT_ACKNOWLEDGE`, `INCIDENT_ASSIGN`, `INCIDENT_RESOLVE`, and `INCIDENT_FALSE_ALARM`.

## Public Report Result

Public report vertical slice was verified:

- Unauthenticated report submit returned `401`.
- Authenticated submit without photo returned `400`.
- Authenticated submit without `plate_no` returned `400`.
- Valid report created `public_reports` row `3fd0dd85-177b-4f6a-a14a-ec8f9ded3be2`.
- Evidence object was stored in MinIO bucket `public-report-evidence`.
- Metadata was stored in `public_report_attachments`.
- Operator queue/detail returned the report and attachment.
- Automated review created `public_report_reviews` row `d500053b-a2d4-4b18-96a9-dfffb507e215` with deterministic verdict `REJECT_SUSPECTED_SPAM`, confidence `0.740`, and no operator-final decision bypass.

## Security Smoke

- Unauthenticated dashboard API returned `401`.
- Operator sensitive report export returned `403`.
- Mutating incident request without CSRF returned `403`.
- Public report submit without login returned `401`.
- Invalid telemetry token returned `401`.

## Reports

Daily report generation was run from Docker:

```sh
docker compose -f infra/docker-compose/docker-compose.yml run --rm api-gateway npm run report:today
```

Result: report generation completed for `2026-05-21`. `report_kpi_daily` and `report_rit_daily` were populated from simulator data. ANALISA CSV export returned `200` with `Content-Type: text/csv`; OPERATOR export returned `403`.

## Evidence Paths

- `docs/qa/evidence/dashboard-desktop.png`
- `docs/qa/evidence/dashboard-mobile.png`
- `docs/qa/evidence/incident-detail-desktop.png`
- `docs/qa/evidence/public-reports-desktop.png`
- `docs/qa/evidence/reports-desktop.png`

## Known Limitations

- `passenger-mobile` lint exits `0` but still reports 5 warnings in map/nearby screens.
- `notification-service` only logs notifications (no real WhatsApp/SMS/email gateway). In-app notifications are real.
- Automated public report review is deterministic (`rules_assisted_summary`), not an LLM. Present it as rules-assisted, not "AI".

## Resolved Since Original Audit

- `api-gateway npm test` now ships real tests (smoke + contract): **17 pass / 0 fail** with the stack up; smoke tests auto-skip without a server. (Was: "0 test files".)
- Reused-volume schema drift is now caught loudly: `verifyRequiredSchema()` runs before `server.listen` and exits with a clear message listing missing tables, instead of serving broken endpoints. Apply migrations `001`–`015` + seed `004_restore_geofences.sql` if it reports missing objects.
- Docker Compose defines formal `/health` probes for `rules-engine` and `notification-service`; runtime verification on 2026-07-23 confirmed both `healthy` with the database available and `unhealthy` when database access fails.
