# Sentra — Feature Status Index

Snapshot dibangun dari dokumentasi repo (README status table, ROADMAP, READINESS_ASSESSMENT, production-readiness, plans, API, feature-code-analysis, PLAN, QA). Tanggal scan: 2026-07-22. Ini snapshot dari dokumen, bukan audit produksi penuh — verifikasi ulang kode sebelum eksekusi.

Legenda: **DONE** = selesai per dokumen · **PARTIAL** = fondasi ada, belum lengkap · **NOT-DONE** = belum dimulai.

Issue hanya dibuat untuk item **PARTIAL** dan **NOT-DONE** (lihat folder `.scratch/<feature-slug>/`).

## DONE (tidak dibuatkan issue)

- Realtime map monitoring (trayek 01/02/03, cluster, filter) — operator-web
- Map-matching PostGIS/OSRM (`telemetry_matched_positions`) — telemetry-ingestion
- Rules engine: NGETEM, OFF_ROUTE, OVERSPEED, LOST_SIGNAL, WRONG_DIRECTION (+DEADHEAD) — rules-engine
- Incident center (ack/assign/resolve/false-alarm + SLA + audit) — operator-web/api-gateway
- Playback riwayat kendaraan — operator-web
- Reporting harian RIT/KPI + export CSV (RBAC ANALISA) — operator-web/api-gateway
- Master data (owner/vehicle/driver/device/route/stop/geofence) — operator-web
- RBAC + CSRF + rate limit + audit log + JWT refresh rotation + Zod validation + PII masking — cross-cutting
- Public report + evidence MinIO + checksum — api-gateway/passenger-mobile
- Automated public-report review (rules-assisted, deterministik, BullMQ) — api-gateway
- Local async OCR evidence dasar (queue `public-report-ocr`, `public_report_ocr_results`) — api-gateway
- Passenger tracking layer (operator view, masked) — api-gateway/operator-web
- Heatmap, network view, sanctions, fleet compliance, collective anomaly — api-gateway/operator-web
- In-app notifications — notification-service
- Emergency/SOS (Phase 19): SOS mobile, driver/device panic, emergency board, PETUGAS_LAPANGAN — cross-cutting
- Telemetry quality + device health/tamper (Phase 18) — api-gateway
- E2E Playwright smoke — operator-web
- PgBouncer, Redis pub/sub WS fan-out, horizontal scaling (local smoke) — infra
- MOCK_MODE production guard — operator-web
- Flutter app scaffold + unit/widget tests (26 tests) — passenger-mobile
- Migrations 001-015, Docker Compose full stack, Caddy TLS profile (local) — db/infra

## PARTIAL & NOT-DONE (dibuatkan issue)

| Feature | Status | Slug |
|---|---|---|
| Security audit report | NOT-DONE | production-readiness |
| Incident response SOP (sistem) | NOT-DONE | production-readiness |
| Real load test execution | PARTIAL | production-readiness |
| Prometheus/Grafana metrics + `/metrics` | NOT-DONE | production-readiness |
| Production contract test | DONE | production-readiness |
| Secret management (vault) | NOT-DONE | production-readiness |
| Production TLS/HSTS/CSP validation | PARTIAL | production-readiness |
| CDN provider provisioning | PARTIAL | production-readiness |
| Postgres read replica | NOT-DONE | production-readiness |
| CI/CD coverage expansion | DONE | production-readiness |
| Deployment go-live checklist execution | PARTIAL (operational) | production-readiness |
| External notifications (WA/SMS/email) | PARTIAL (log-only) | notification-external-gateway |
| Flutter offline-first cache `/public/vehicles` | NOT-DONE | passenger-mobile-resilience |
| Fix map/nearby lint warnings | PARTIAL | passenger-mobile-resilience |
| Physical GT06 device integration verification | PARTIAL (simulator only) | telemetry-device-hardening |
| mTLS device auth decision | NOT-DONE | telemetry-device-hardening |
| Formal compose healthchecks (rules-engine/notification-service) | DONE | telemetry-device-hardening |
| Governance/retention/AI-approval policies | NOT-DONE (operational) | governance-policies |
| Public-report evidence-processing worker | NOT-DONE | public-report-evidence-processing |
| Advanced ML OCR pipeline (YOLOv8 + PaddleOCR) | NOT-DONE | plate-ocr-ml-pipeline |
| Phase 17 Social Media Intelligence | NOT-DONE (deferred) | strategic-roadmap |
| Phase 20 AI availability/demand forecasting | NOT-DONE | strategic-roadmap |
| Phase 21 IoT vehicle health/predictive maintenance | NOT-DONE | strategic-roadmap |
| Phase 22 ML route optimization simulation | NOT-DONE | strategic-roadmap |
| Phase 23 Public transparency portal / open data | NOT-DONE | strategic-roadmap |
| P3 Integrated urban mobility intelligence | NOT-DONE | strategic-roadmap |
| Kubernetes production deployment | NOT-DONE (documented path) | strategic-roadmap |
