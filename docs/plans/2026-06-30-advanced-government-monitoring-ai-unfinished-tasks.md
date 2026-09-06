# Advanced Government Monitoring AI - Unfinished Tasks

Generated: 2026-06-30  
Source roadmap: `docs/plans/2026-05-08-advanced-government-monitoring-ai-roadmap.md`  
Scope: unfinished strategic work from Phase 18 through Phase 23, plus production governance items.

## Reading Rule

This is a snapshot from a repository evidence scan, not a full production audit.

Status labels:

- `Partial`: foundation exists, but the roadmap requirement is not fully implemented.
- `Completed`: implementation evidence was found or added for all listed tasks in the phase.
- `Not started`: no clear implementation evidence was found in the current repo scan.
- `Operational`: requires real pilot, policy, vendor, or government process evidence outside code.

## Current Foundation Already Present

The roadmap is not starting from zero. The current repo already has these foundations:

- Realtime vehicle monitoring dashboard.
- Telemetry ingestion with token/HMAC support.
- Raw GPS storage and matched telemetry via `telemetry_matched_positions`.
- Rules engine for NGETEM, OFF_ROUTE, OVERSPEED, LOST_SIGNAL, and WRONG_DIRECTION.
- Incident center with acknowledge/assign/resolve/false alarm flow.
- Public report flow with photo evidence and rules-assisted review.
- Passenger tracking layer.
- Heatmap, network view, sanctions, compliance, audit log, RBAC, CSRF, rate limits.

These foundations reduce implementation risk for Phase 18 and Phase 19, but they do not complete the strategic roadmap.

---

## P1 - Must Finish Before Serious Pilot Scale

### Phase 18 - Precision Tracking and Data Quality

Status: `Completed`

Existing evidence:

- Telemetry ingestion exists.
- HMAC/token telemetry auth exists.
- Raw + matched telemetry exists.
- Map matching and anomaly rules already use matched telemetry.

Unfinished tasks:

- [x] Enforce and document pilot GPS interval target of 5 seconds end to end.
- [x] Add a data quality dashboard for missing telemetry, stale vehicles, GPS drift, invalid device identity, assignment mismatch, and duplicate payloads.
- [x] Add telemetry quality scoring by vehicle, route, owner, and device.
- [x] Add operational SLA reporting for tracking validity `>= 99.5%`.
- [x] Decide whether production device auth needs mTLS in addition to HMAC.
- [x] Add device tamper detection: power disconnect followed by lost signal, impossible movement, repeated identity mismatch.
- [x] Add data quality export/report for monthly pilot review.

Acceptance criteria:

- Dashboard shows quality metrics per route and vehicle.
- Operators can identify bad device/data sources without querying the database.
- Monthly report can show tracking valid percentage and top data quality issues.
- HMAC production path is documented; mTLS is either implemented or explicitly deferred with risk acceptance.

Suggested verification:

- API tests for telemetry quality aggregation.
- Operator-web route smoke for the data quality page.
- Live Docker check with simulator data showing stale/missing/drift counters.

### Phase 19 - Emergency Response and Field Operations

Status: `Completed`

Existing evidence:

- Incident center exists.
- Incident action flow exists.
- Public reports exist.
- SOS labels/status appear in UI/domain language.
- Passenger mobile SOS screen exists.
- API supports passenger SOS and driver/device panic button intake.
- Operator emergency board exists with SLA timer, escalation state, assignment, proof upload, and resolution notes.
- `PETUGAS_LAPANGAN` role exists in demo seed and can update assigned incidents.
- Emergency drill runbook exists at `docs/runbooks/emergency-drill.md`.

Unfinished tasks:

- [x] Implement passenger SOS flow in mobile app.
- [x] Implement driver SOS or device panic-button intake.
- [x] Create `EMERGENCY` incident flow with severity `CRITICAL`.
- [x] Add emergency board with SLA timer, nearest vehicle/responder context, and escalation state.
- [x] Add field officer role or equivalent `PETUGAS_LAPANGAN` workflow.
- [x] Add responder assignment, navigation context, proof upload, and resolution notes.
- [x] Add escalation matrix when acknowledge or assignment exceeds SLA.
- [x] Add emergency anti-abuse controls: rate limit, duplicate detection, trust signal, manual override.
- [x] Add emergency drill documentation and monthly drill result template.

Acceptance criteria:

- SOS creates a critical emergency incident with location, reporter/session, vehicle context, and audit log.
- Operator can acknowledge and assign a responder within the UI.
- SLA timers are visible and tested.
- Emergency flow has automated tests and at least one manual drill checklist.

Suggested verification:

- API contract tests for SOS create/ack/assign/resolve.
- Mobile widget/repository tests for SOS submit failure/success.
- Playwright smoke for emergency board.
- Manual drill against Docker stack.

### Governance and Production Policy

Status: `Operational`

Unfinished tasks:

- [ ] Write data classification policy.
- [ ] Write GPS, passenger tracking, public report, evidence, and audit-log retention policy.
- [ ] Write sensitive data access SOP.
- [ ] Write cyber incident response SOP.
- [ ] Write emergency transport response SOP.
- [ ] Write owner/driver data correction and dispute SOP.
- [ ] Write AI model approval and rollback SOP.
- [ ] Define policy that AI/risk scores are supporting evidence, not automatic sanctions.
- [ ] Define legal/government review path for route changes, public dashboards, and open data.

Acceptance criteria:

- Each policy has owner, approval status, last reviewed date, and operational procedure.
- Production readiness document links to the approved policy/SOP files.
- Sensitive data and AI decision boundaries are explicit enough for handover.

Suggested verification:

- Documentation review.
- Security/readiness checklist update.
- Stakeholder sign-off outside code.

---

## P2 - Strategic Capability Buildout

### Phase 20 - AI Availability and Demand Forecasting

Status: `Not started`

Unfinished tasks:

- [ ] Create feature store or aggregate tables for forecast features.
- [ ] Build baseline availability forecast per route/stop for 5, 15, 30, and 60 minute horizons.
- [ ] Build demand forecast per route/stop per 15 minutes.
- [ ] Add model registry metadata: model version, training window, features, metrics, reason codes.
- [ ] Add fallback rules when external traffic/weather/event data is unavailable.
- [ ] Add explainable forecast panel in operator/analyst dashboard.
- [ ] Add monthly model evaluation report with MAE/MAPE per route and peak hour.

Acceptance criteria:

- Forecast endpoint returns route/stop forecast with model version and reason code.
- Dashboard shows forecast and fallback state.
- Model output is explicitly recommendation-only and human-reviewed.
- Tests cover fallback behavior and response shape.

Suggested verification:

- Unit tests for feature aggregation.
- API contract tests for forecast endpoint.
- UI smoke for forecast panel.
- Report sample generated from seeded/demo data.

### Phase 21 - IoT Vehicle Health and Predictive Maintenance

Status: `Not started`

Unfinished tasks:

- [ ] Define sensor payload contract for fuel, engine temperature, odometer, battery, power, and DTC.
- [ ] Add `vehicle_sensor_readings` time-series table.
- [ ] Add `vehicle_health_latest` snapshot table/view.
- [ ] Add `maintenance_predictions` table.
- [ ] Add `maintenance_actions` table.
- [ ] Add rules for high engine temperature, abnormal fuel drop, odometer mismatch, and power disconnect.
- [ ] Add maintenance risk score.
- [ ] Add maintenance schedule automation.
- [ ] Add owner compliance dashboard for maintenance actions.

Acceptance criteria:

- Sensor telemetry can be ingested and queried per vehicle.
- Dashboard shows latest vehicle health and maintenance risk.
- Maintenance prediction produces explainable evidence, not opaque decisions.
- Owner action workflow is audited.

Suggested verification:

- DB migration tests.
- API contract tests for sensor ingest and health latest.
- Dashboard smoke for fleet health panel.

### Phase 22 - ML Route Optimization Simulation

Status: `Not started`

Unfinished tasks:

- [ ] Add headway and dispatch recommendation model or rules baseline.
- [ ] Add no-stopping/ngetem zone recommendation based on telemetry and incident evidence.
- [ ] Add fuel and congestion efficiency simulation.
- [ ] Add route optimization scenario model with baseline vs recommendation comparison.
- [ ] Add policy review workflow before any route recommendation can become operational.
- [ ] Add confidence, estimated impact, and evidence trail to every recommendation.

Acceptance criteria:

- Route optimization runs in simulation mode only.
- Output clearly states recommendation, confidence, expected impact, and legal/policy review status.
- No route change can be applied automatically.

Suggested verification:

- Simulation test from seeded telemetry.
- UI review flow test.
- Documentation of human approval guardrail.

### Phase 23 - Public Transparency and Open Data

Status: `Not started`

Unfinished tasks:

- [ ] Build public KPI portal.
- [ ] Publish sanitized route performance data.
- [ ] Publish public report status without PII or attachment exposure.
- [ ] Add open data aggregate CSV/API.
- [ ] Add public satisfaction feedback loop.
- [ ] Add privacy review for every public field.
- [ ] Add cache/CDN strategy for public read endpoints.

Acceptance criteria:

- Public data excludes passenger, reporter, driver, owner, device identity, evidence attachments, and raw tracking that could expose sensitive behavior.
- Public portal can show route-level aggregate KPI safely.
- Open data has documented schema and refresh cadence.

Suggested verification:

- Data minimization tests.
- Public endpoint contract tests.
- Manual privacy review checklist.

---

## P3 - Longer-Term Government Integration

### Integrated Urban Mobility Intelligence

Status: `Not started`

Unfinished tasks:

- [ ] Integrate ATCS or traffic provider data.
- [ ] Integrate weather and city event data.
- [ ] Integrate Bappeda, police, call center, and licensing system data where legally permitted.
- [ ] Define master data steward and cross-agency synchronization process.
- [ ] Add MoU/data-sharing documentation requirements.

Acceptance criteria:

- External data source has owner, schema, refresh cadence, legal basis, and failure mode.
- System can operate safely when external sources are unavailable.

---

## Production Readiness Backlog

Source: `docs/production-readiness-monitoring-angkot.md`

This section tracks unfinished production-readiness work that is more immediate than the long-range AI roadmap. Items marked `Done in readiness doc` are not repeated here unless they still have a remaining operational gap.

### PR-P1 - Security Audit Report and Secret Review

Status: `Not started`

Why this matters:

- The production readiness document marks security baseline as strong, but still requires a final security audit report and secret review.
- Secrets are still expected to be environment-based for local/compose use; production needs a real secret management decision.

Unfinished tasks:

- [ ] Create `docs/security-audit-report.md`.
- [ ] Verify JWT/session behavior, refresh token rotation, CSRF, RBAC, feature gates, and backend authorization.
- [ ] Verify production TLS settings: HTTPS domain, `COOKIE_SECURE=true`, HSTS behavior, and reverse proxy headers.
- [ ] Verify CORS allowlist for production domains only.
- [ ] Verify database SSL behavior for production direct DB vs private PgBouncer connection.
- [ ] Verify PII masking for non-ANALISA roles.
- [ ] Verify no secrets are logged, committed, or documented in reports.
- [ ] Decide production secret management: vault/managed secrets vs `.env` file.
- [ ] Produce findings with severity labels: P0, P1, P2, P3.

Acceptance criteria:

- `docs/security-audit-report.md` exists and lists each checked item as safe, needs fix, or missing.
- Any P0/P1 security issue has a linked fix plan.
- Production secret handling is explicitly documented.

Suggested verification:

- `cd services/api-gateway && npm test`
- `cd apps/operator-web && npm run lint && npm run build`
- Manual review of `.env.example`, compose env, Caddy profile, and auth/security files.

### PR-P1 - Incident Response SOP

Status: `Not started`

Why this matters:

- The production readiness document still requires a final incident response SOP before go-live.
- This is separate from the transport emergency workflow in Phase 19; this one is for system operations incidents.

Unfinished tasks:

- [ ] Create `docs/runbooks/incident-response-sop.md`.
- [ ] Define SEV1, SEV2, SEV3, response times, escalation owner, and communication channel.
- [ ] Add runbook for API gateway down.
- [ ] Add runbook for database full or database unavailable.
- [ ] Add runbook for Redis down or rate-limit/cache degraded.
- [ ] Add runbook for MinIO/object storage unavailable.
- [ ] Add runbook for slow response or high CPU.
- [ ] Add runbook for WebSocket/realtime degradation.
- [ ] Add rollback procedure based on actual image/tag/commit, not a nonexistent compose file.
- [ ] Add post-incident review template.

Acceptance criteria:

- Runbook commands match the current Docker Compose layout.
- SOP can be used by an operator without reading source code.
- Rollback procedure is concrete and reversible.

Suggested verification:

- Dry-run non-destructive commands such as `docker compose ps`, `/health`, `/ready`, and log commands.
- Review against `docs/runbooks/scale-out.md` and `infra/docker-compose/docker-compose.yml`.

### PR-P1 - Real Load Test Execution

Status: `Partial`

Existing evidence:

- Load-test scaffold exists in `scripts/load-test/`.

Unfinished tasks:

- [ ] Run a real load test for the intended pilot scenario.
- [ ] Define target scenario: number of vehicles, telemetry interval, public polling, dashboard users, report upload rate.
- [ ] Capture p50/p95/p99 latency, error rate, CPU/memory, DB connections, Redis memory, and queue depth.
- [ ] Record whether 1 API instance can sustain the target.
- [ ] Record scaling threshold for 2-3 API instances.
- [ ] Store results under `docs/qa/` or another agreed report location.
- [ ] Update production readiness score/status based on actual result.

Acceptance criteria:

- A dated load-test report exists.
- The report states pass/fail against an explicit pilot target.
- Any bottleneck has a follow-up issue/task.

Suggested verification:

- `node scripts/load-test/load-test.mjs ...` with documented parameters.
- Docker stats or equivalent resource capture during the run.
- `/ready` remains healthy during and after the test.

### PR-P1 - Deployment Go-Live Checklist Execution

Status: `Operational`

Unfinished tasks:

- [ ] Confirm `MOCK_MODE=false` in production runtime.
- [ ] Replace `JWT_SECRET` from any default/example value.
- [ ] Replace `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, and `MINIO_ROOT_PASSWORD`.
- [ ] Install and verify SSL/HTTPS certificate.
- [ ] Confirm DNS domains point to the production server.
- [ ] Set Sentry DSN if Sentry is part of the production monitoring plan.
- [ ] Download and verify latest database backup before deployment.
- [ ] Run load test and attach PASS evidence.
- [ ] Run `scripts/health-check.sh` after deployment.
- [ ] Verify WebSocket connection.
- [ ] Verify login flow.
- [ ] Verify dashboard renders real data.
- [ ] Verify `/public/vehicles` returns data.
- [ ] Verify no error spike in Sentry/logs.

Acceptance criteria:

- Every pre-deployment and post-deployment checkbox is completed with timestamp/evidence.
- Any exception is explicitly accepted as a deployment risk.

Suggested verification:

- `./scripts/health-check.sh`
- Browser smoke for operator dashboard.
- API curl smoke for `/health`, `/ready`, `/public/vehicles`.

### PR-P2 - Monitoring Metrics and Dashboard

Status: `Not started`

Unfinished tasks:

- [ ] Add `services/api-gateway/src/metrics.js`.
- [ ] Add HTTP request counter by method, path, and status.
- [ ] Add HTTP duration observation.
- [ ] Add WebSocket message counter.
- [ ] Add active WebSocket connection gauge.
- [ ] Add `GET /metrics` endpoint in Prometheus text format.
- [ ] Add Prometheus service to Docker Compose.
- [ ] Add `infra/docker-compose/prometheus/prometheus.yml`.
- [ ] Add Grafana service and `grafana-data` volume.
- [ ] Verify Prometheus target is UP.
- [ ] Add starter dashboard or document manual Grafana panels.

Acceptance criteria:

- `curl http://localhost:4000/metrics` returns Prometheus metrics.
- `curl http://localhost:9090/api/v1/targets` shows API gateway target UP.
- Metrics are not based on console logs.

Suggested verification:

- API unit tests for metrics formatting if practical.
- Docker Compose smoke for Prometheus target status.
- Manual Grafana screenshot or documented panel list.

### PR-P2 - Production Contract Test

Status: `Partial`

Existing evidence:

- Several contract tests already exist.
- Production readiness still asks for a dedicated production contract safety net.

Unfinished tasks:

- [ ] Create `services/api-gateway/test/production-contract.test.js`.
- [ ] Assert list endpoints use consistent pagination shape: `{ items, total, page, limit }` where applicable.
- [ ] Assert error responses use `{ error: { code, message } }`.
- [ ] Assert 429 responses include `Retry-After`.
- [ ] Assert dashboard endpoints return 401 without auth.
- [ ] Assert role-protected endpoints return 403 for insufficient role.
- [ ] Include source-level checks only when live integration is too expensive.

Acceptance criteria:

- `cd services/api-gateway && npm test` passes with the new test.
- The test guards API compatibility during refactors.

Suggested verification:

- `cd services/api-gateway && npm test`

### PR-P2 - Offline-First Cache for Flutter Public Vehicles

Status: `Not started`

Unfinished tasks:

- [ ] Read `apps/passenger-mobile/lib/features/vehicles/data/vehicles_repository.dart`.
- [ ] Read `apps/passenger-mobile/lib/features/vehicles/providers/vehicles_provider.dart`.
- [ ] Use existing `shared_preferences` if already present; avoid new dependency unless required.
- [ ] Cache successful `/public/vehicles` response locally.
- [ ] On fetch failure, return cached stale data when available.
- [ ] If cache is empty, keep existing sample fallback behavior.
- [ ] Add state flag to distinguish live, cached stale, and sample fallback data.
- [ ] Show UI badge/text: `Data dari cache` or `Data mungkin tidak terkini` when stale cache is used.
- [ ] Add tests for live success, network failure with cache, and network failure without cache.

Acceptance criteria:

- Passenger app can show last known public vehicle data after the server becomes unreachable.
- User can tell whether data is live, cached, or sample fallback.
- `cd apps/passenger-mobile && flutter test` passes.

Suggested verification:

- Flutter repository/provider tests.
- Manual test with backend stopped after one successful fetch.

### PR-P2 - Read Replica and Larger Scale Path

Status: `Not started`

Unfinished tasks:

- [ ] Decide whether 500-2000 vehicle scale requires Postgres read replica in the current deployment target.
- [ ] Document read/write split strategy for API endpoints.
- [ ] Identify read-heavy endpoints safe to route to replica.
- [ ] Add environment variables for replica connection if approved.
- [ ] Add health/readiness checks for replica lag.
- [ ] Add failover behavior when replica is unavailable.

Acceptance criteria:

- Scale-out runbook clearly states when and how read replica is introduced.
- No endpoint reads stale data where real-time correctness is required.

Suggested verification:

- Architecture review before implementation.
- DB integration tests after implementation.

### PR-P2 - CDN Provider Provisioning

Status: `Partial`

Existing evidence:

- `/public/vehicles` origin now sends `Cache-Control: public, max-age=3, s-maxage=5` and `Surrogate-Control: max-age=5`.

Unfinished tasks:

- [ ] Choose CDN/provider configuration for production domain.
- [ ] Confirm CDN respects origin `s-maxage` for `/public/vehicles`.
- [ ] Ensure authenticated endpoints are not cached.
- [ ] Add CDN purge/bypass guidance for emergency rollback.
- [ ] Verify cache behavior from outside local Docker.

Acceptance criteria:

- CDN serves `/public/vehicles` with intended short TTL.
- No private/authenticated endpoint is publicly cached.

Suggested verification:

- `curl -I` against production/staging CDN hostname.
- Check CDN cache status header if provider exposes one.

### PR-P2 - Production TLS, HSTS, and Security Headers Validation

Status: `Partial`

Existing evidence:

- Security headers exist in API/operator-web.
- Caddy TLS profile exists.

Unfinished tasks:

- [ ] Verify production domain uses HTTPS.
- [ ] Verify HSTS is active only when safe on production domain.
- [ ] Verify `COOKIE_SECURE=true` in HTTPS production.
- [ ] Verify API and web CSP do not block required production assets.
- [ ] Verify Caddy forwards expected `X-Forwarded-*` headers.

Acceptance criteria:

- Browser and curl header checks prove TLS/security header behavior on production/staging.
- Any exception is documented in security audit report.

Suggested verification:

- `curl -I https://<domain>`
- Browser login smoke over HTTPS.

---

## Recommended Implementation Order

1. **PR-P1 security audit report and secret review.** This protects go-live from silent security gaps.
2. **PR-P1 incident response SOP.** Operators need a system incident runbook before production use.
3. **PR-P1 real load test execution.** The scaffold is not enough; pilot capacity needs evidence.
4. **PR-P2 monitoring metrics and dashboard.** Prometheus/Grafana closes the biggest observability gap.
5. **PR-P2 production contract test.** Cheap safety net before more refactor and feature work.
6. **PR-P2 offline-first Flutter cache.** Improves public app resilience under weak network conditions.
7. **Phase 18 data quality dashboard.** This directly improves trust in current telemetry and is prerequisite for AI.
8. **Phase 19 SOS/emergency flow.** This is the most visible safety gap and already appears as planned in repo status.
9. **Governance policies.** Needed before broader pilot or public launch.
10. **Phase 20 baseline forecasts.** Start with simple, explainable moving averages before advanced ML.
11. **Phase 21 IoT maintenance.** Requires device/vendor data, so contract and schema should come first.
12. **Phase 23 public transparency portal.** Only after privacy/data minimization rules are settled.
13. **Phase 22 route optimization simulation.** Keep last because it has policy and public-service implications.

## Notes for Future Agents

- Do not treat this document as proof that an item is impossible or absent forever. It is a snapshot from the repo state on 2026-06-30.
- Before implementing any item, inspect current code and docs again because the roadmap may have progressed.
- Keep changes small. For Phase 18 and Phase 19, prefer vertical slices with tests over broad platform rewrites.
- AI output must remain recommendation-only unless the governance documents explicitly change that policy.
