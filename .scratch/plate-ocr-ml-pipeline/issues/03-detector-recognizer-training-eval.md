# OCR Phase 4-6: Detector + recognizer training + E2E eval

- **Status:** ready-for-human
- **Type:** task
- **Scope:** backend
- **Priority:** P1
- **Doc status:** NOT-DONE
- **Component:** ml/plate-ocr

## Context
Training YOLOv8 detector + PaddleOCR recognizer dalam Docker, lalu evaluasi end-to-end. Butuh sumber daya training & keputusan ML.

## Acceptance Criteria
- [ ] Detector: Dockerfile + train script + config; recall validasi/test ≥ 98% atau gap didokumentasikan; weights + metrics ke MinIO.
- [ ] Recognizer: dictionary Indonesia A-Z/0-9/max 10; sequence accuracy tercatat; weights + metrics ke MinIO.
- [ ] E2E eval: exact match, false confident, confusion matrix, latency per stage; threshold awal 0.90.

## Verification
- Smoke run fixture kecil; metrics parser test.

## References
- `PLAN.md` Phase 4-6; backlog OCR-007..013
