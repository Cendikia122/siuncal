# Production Readiness — Remaining Backlog

Kumpulan pekerjaan production-readiness yang masih PARTIAL/NOT-DONE agar Sentra siap dari pilot terbatas menuju skala kota. Verdict dokumen saat ini: "READY WITH CONDITIONS untuk pilot terbatas (<100 angkot), NOT READY untuk skala kota penuh".

## Tujuan
Menutup gap keamanan, observability, testing beban, dan kesiapan deployment sebelum rollout lebih luas.

## Issue
- 01 Security audit report (P1)
- 02 Incident response SOP (P1)
- 03 Real load test execution (P1)
- 04 Prometheus/Grafana metrics (P2)
- 05 Production contract test (P2)
- 06 Secret management vault (P1)
- 07 Production TLS/HSTS/CSP validation (P2)
- 08 CDN provider provisioning (P2)
- 09 Postgres read replica (P2)
- 10 CI/CD coverage expansion (P2)
- 11 Deployment go-live checklist execution (P1)

## Urutan disarankan
Security audit → incident SOP → load test → monitoring metrics → contract test → sisanya.

## Sumber
- `docs/production-readiness-monitoring-angkot.md`
- `docs/plans/2026-06-30-advanced-government-monitoring-ai-unfinished-tasks.md`
- `docs/READINESS_ASSESSMENT.md`
