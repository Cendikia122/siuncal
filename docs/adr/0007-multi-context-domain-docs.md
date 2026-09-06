# 0007. Dokumentasi domain multi-context

- Status: Accepted
- Tanggal: 2026-07-22
- Konteks terkait: cross-cutting (dokumentasi domain)

## Konteks
Monorepo punya beberapa konteks berbeda (dashboard operator, app Flutter, dan empat backend service) dengan bahasa domain yang sebagian tumpang tindih namun punya istilah spesifik per konteks.

## Keputusan
Gunakan layout dokumentasi domain **multi-context**:
- `CONTEXT-MAP.md` di root menunjuk ke `CONTEXT.md` per konteks (per app/service).
- `CONTEXT.md` di root berisi glosarium/overview domain lintas sistem.
- ADR skala sistem di `docs/adr/`; ADR spesifik konteks boleh di `<context>/docs/adr/`.
- Aturan konsumsi untuk skill ada di `docs/agents/domain.md`. Per-context `CONTEXT.md` dibuat lazily oleh `grill-with-docs` saat istilah/keputusan benar-benar diperlukan.

## Konsekuensi
- Positif: istilah domain per konteks tidak saling menabrak; skill tahu di mana mencari bahasa domain.
- Negatif: butuh disiplin menjaga `CONTEXT-MAP.md` tetap sinkron; per-context `CONTEXT.md` belum semuanya ada.

## Alternatif dipertimbangkan
- Single-context (`CONTEXT.md` tunggal): ditolak karena monorepo punya konteks yang jelas terpisah.
