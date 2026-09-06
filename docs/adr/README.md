# Architecture Decision Records (ADR)

Folder ini menyimpan **setiap keputusan arsitektur** untuk Sentra (Monitoring Angkot). Satu keputusan = satu file.

## Konvensi

- Nama file: `NNNN-judul-singkat.md` (nomor urut 4 digit, mulai `0001`).
- Status: `Proposed` | `Accepted` | `Superseded by ADR-XXXX` | `Deprecated`.
- Jangan mengubah keputusan lama secara diam-diam. Bila keputusan berubah, buat ADR baru dan tandai ADR lama `Superseded`.
- Keputusan skala sistem disimpan di sini (`docs/adr/`). Keputusan spesifik per konteks boleh disimpan di `<context>/docs/adr/` (lihat `docs/agents/domain.md`).

## Template

```markdown
# NNNN. Judul keputusan

- Status: Accepted
- Tanggal: YYYY-MM-DD
- Konteks terkait: <apps/operator-web | apps/passenger-mobile | services/* | db | infra | cross-cutting>

## Konteks
Masalah/latar belakang yang memaksa keputusan.

## Keputusan
Apa yang diputuskan.

## Konsekuensi
Trade-off, dampak positif/negatif, tindak lanjut.

## Alternatif dipertimbangkan
Opsi lain dan alasan ditolak.
```

## Index

- [0001](0001-monorepo-multi-service-architecture.md) — Arsitektur monorepo multi-service
- [0002](0002-postgres-postgis-timescaledb-single-datastore.md) — Postgres + PostGIS + TimescaleDB sebagai datastore tunggal
- [0003](0003-gps-is-source-of-truth-passenger-location-evidence.md) — GPS kendaraan sumber kebenaran; lokasi passenger = evidence
- [0004](0004-rules-assisted-review-not-llm.md) — Tinjauan laporan rules-assisted deterministik, bukan LLM
- [0005](0005-ocr-evidence-only-local-async.md) — OCR plat lokal asynchronous, evidence-only
- [0006](0006-local-markdown-issue-tracker.md) — Issue tracker berbasis local markdown
- [0007](0007-multi-context-domain-docs.md) — Dokumentasi domain multi-context
- [0008](0008-ocr-worker-deployment-resource-isolation.md) — Isolasi resource & deployment worker OCR
