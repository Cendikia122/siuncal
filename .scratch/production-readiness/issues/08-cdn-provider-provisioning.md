# CDN provider provisioning for /public/vehicles

- **Status:** ready-for-human
- **Type:** task
- **Scope:** backend
- **Priority:** P2
- **Doc status:** PARTIAL
- **Component:** infra, api-gateway

## Context
Origin `/public/vehicles` sudah mengirim `Cache-Control: public, max-age=3, s-maxage=5` + `Surrogate-Control: max-age=5`. Provider CDN produksi belum dipilih/diprovision (butuh keputusan vendor/akun).

## Acceptance Criteria
- [ ] Pilih konfigurasi CDN/provider untuk domain produksi.
- [ ] Konfirmasi CDN menghormati `s-maxage` origin untuk `/public/vehicles`.
- [ ] Pastikan endpoint terautentikasi tidak di-cache.
- [ ] Tambah panduan purge/bypass CDN untuk emergency rollback.
- [ ] Verifikasi cache dari luar Docker lokal.

## Verification
- `curl -I https://<cdn-host>/public/vehicles` (cek header cache + status).

## References
- `docs/production-readiness-monitoring-angkot.md` P2-2
- `docs/plans/2026-06-30-...unfinished-tasks.md` PR-P2 CDN
