# Plate OCR ML Pipeline — PRD

Pipeline OCR plat nomor (evidence-only) untuk membantu operator memverifikasi laporan warga. Detector YOLOv8 + recognizer PaddleOCR, worker async Node.js + BullMQ memanggil internal Python inference service, hasil ke Postgres/MinIO.

**Status:** NOT-DONE — seluruh Phase 0-12 di `PLAN.md` masih proposal (belum diimplementasi). Basic OCR evidence dasar (queue `public-report-ocr`, tabel `public_report_ocr_results`) yang saat ini ada di api-gateway BERBEDA dari pipeline ML training penuh ini.

## Prinsip non-negosiabel
- OCR = evidence operator saja; tidak mengubah `plate_match_status`, tidak membuat incident, tidak memicu sanksi otomatis.
- Foto tidak dikirim ke OCR SaaS eksternal.
- Model/dataset/metrics tidak di Git; disimpan di MinIO/S3.
- Low-confidence/ambiguous → `NEEDS_OPERATOR_REVIEW`.

## Target
- Detection recall ≥ 98%, exact plate match ≥ 90%, false confident < 1%.
- Threshold awal 0.90, dikalibrasi dengan held-out test set angkot Bogor nyata (100-200 foto, perlu approval Dishub + legal, EXIF dihapus).

## Issue (fase besar; detail backlog OCR-001..023 ada di PLAN.md §8)
- 01 Foundation scaffold + DB migration (Phase 0-1)
- 02 Dataset audit + reproducible split (Phase 2-3)
- 03 Detector + recognizer training + E2E eval (Phase 4-6)
- 04 Worker integration + hardening + testing (Phase 7-9)
- 05 Observability + deployment + Bogor production readiness (Phase 10-12)

## Sumber
- `PLAN.md` (rencana lengkap, backlog, DoD)
- `docs/superpowers/specs/2026-05-31-public-report-local-ocr-design.md`
