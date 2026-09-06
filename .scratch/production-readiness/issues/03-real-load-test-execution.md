# Real load test execution (bukan hanya scaffold)

- **Status:** ready-for-agent
- **Type:** task
- **Scope:** backend
- **Priority:** P1
- **Doc status:** PARTIAL
- **Component:** api-gateway, infra, scripts/load-test

## Context
Scaffold load test sudah ada di `scripts/load-test/`, tapi belum ada eksekusi load test nyata untuk skenario pilot. Tidak ada data performa aktual.

## Acceptance Criteria
- [ ] Definisikan target skenario pilot: jumlah kendaraan, interval telemetry, public polling, dashboard users, report upload rate.
- [ ] Jalankan load test dan tangkap p50/p95/p99 latency, error rate, CPU/memory, DB connections, Redis memory, queue depth.
- [ ] Catat apakah 1 instance API sanggup target + threshold scaling 2-3 instance.
- [ ] Simpan report bertanggal di `docs/qa/` atau `scripts/load-test/results/`.
- [ ] Update skor/status production readiness sesuai hasil nyata; bottleneck punya follow-up issue.

## Verification
- `npm --prefix scripts/load-test install && npm --prefix scripts/load-test start`
- Capture `docker stats`; `/ready` tetap sehat selama & setelah test.

## References
- `docs/production-readiness-monitoring-angkot.md` P0-3
- `docs/plans/2026-06-30-...unfinished-tasks.md` PR-P1 Real Load Test
