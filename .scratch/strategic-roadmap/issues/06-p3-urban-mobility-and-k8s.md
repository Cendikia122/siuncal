# P3 — Integrated urban mobility intelligence + K8s production deploy

- **Status:** needs-triage
- **Type:** feature
- **Scope:** fullstack
- **Priority:** P3 (long-term)
- **Doc status:** NOT-DONE (K8s: documented path)
- **Component:** infra, api-gateway

## Context
Integrasi lintas-instansi (ATCS/traffic, weather/event, Bappeda/polisi/licensing) + deployment Kubernetes produksi penuh dan observability produksi. K8s sudah terdokumentasi sebagai path (belum dieksekusi).

## Acceptance Criteria
- [ ] Tiap sumber data eksternal punya owner, schema, cadence, dasar legal, failure mode; sistem tetap aman saat sumber eksternal down.
- [ ] Master data steward & proses sinkronisasi lintas-instansi; dokumentasi MoU/data-sharing.
- [ ] Eksekusi deployment Kubernetes produksi + dashboard observability produksi penuh; HSTS + pengetatan CSP (hapus `unsafe-inline`) untuk TLS produksi.

## References
- `docs/plans/2026-06-30-...unfinished-tasks.md` P3
- `docs/ROADMAP.md` Tahap 3 (Operasional produksi)
