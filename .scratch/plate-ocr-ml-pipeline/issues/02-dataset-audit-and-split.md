# OCR Phase 2-3: Dataset audit + reproducible split

- **Status:** ready-for-human
- **Type:** task
- **Scope:** backend
- **Priority:** P1
- **Doc status:** NOT-DONE
- **Component:** ml/plate-ocr

## Context
Validasi dataset baseline publik `linkgish/indonesian-plate-number-from-multi-sources` dan buat split deterministik 70/15/15 (seed 42) tanpa leakage. Butuh dataset & keputusan ML → sebagian input manusia.

## Acceptance Criteria
- [ ] Script audit: corrupt image, empty/invalid bbox, duplicate hash, format plat, distribusi, sample visual.
- [ ] Report audit ada; sample invalid dikarantina; tidak training sebelum audit lulus.
- [ ] Split 70/15/15 seed 42; duplicate hash tidak lintas split; manifest/checksum di MinIO.

## Verification
- Unit test helper audit + fixture; re-run split identik.

## References
- `PLAN.md` Phase 2-3; backlog OCR-004..006
