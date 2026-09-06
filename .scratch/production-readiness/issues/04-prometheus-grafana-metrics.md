# Prometheus metrics endpoint + Grafana dashboard

- **Status:** ready-for-agent
- **Type:** feature
- **Scope:** backend
- **Priority:** P2
- **Doc status:** NOT-DONE
- **Component:** api-gateway, infra

## Context
Observability masih terbatas ke `/health`, `/ready`, observability summary, dan Sentry opsional. Belum ada Prometheus/Grafana/alerting.

## Acceptance Criteria
- [ ] Buat `services/api-gateway/src/metrics.js` (HTTP request counter by method/path/status, duration observation, WS message counter, active connection gauge).
- [ ] Tambah endpoint `GET /metrics` format Prometheus text.
- [ ] Tambah service Prometheus + Grafana di Docker Compose + `infra/docker-compose/prometheus/prometheus.yml` + volume `grafana-data`.
- [ ] Metrics tidak berbasis console log.

## Verification
- `curl http://localhost:4000/metrics` → metrics muncul.
- `curl http://localhost:9090/api/v1/targets` → target api-gateway UP.

## References
- `docs/production-readiness-monitoring-angkot.md` P2-3
- `docs/plans/2026-06-30-...unfinished-tasks.md` PR-P2 Monitoring Metrics
