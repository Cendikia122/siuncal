# OCR Phase 10-12: Observability + deployment + Bogor production readiness

- **Status:** ready-for-human
- **Type:** task
- **Scope:** backend
- **Priority:** P0 (gate rilis OCR)
- **Doc status:** NOT-DONE
- **Component:** ml/plate-ocr, services/ocr-worker, infra

## Context
Monitoring kualitas/latency OCR, deployment reproducible, dan validasi dengan foto angkot Bogor nyata sebelum rilis. Butuh approval Dishub + legal review untuk data nyata → keputusan manusia.

## Acceptance Criteria
- [ ] Metrics latency P50/P95/P99, queue depth, match/mismatch/review rate, drift.
- [ ] Compose profile OCR worker + training; bucket bootstrap; runbook OCR.
- [ ] Kumpulkan 100-200 foto angkot Bogor (approval Dishub + legal, EXIF dihapus, di luar Git); re-evaluasi detector/recognizer/E2E; kalibrasi threshold dari 0.90.
- [ ] Benchmark CPU dulu; ONNX/GPU hanya bila target latency gagal; staging pilot low concurrency; review false confident manual.
- [ ] Target terpenuhi pada Bogor test set atau rilis diblokir dengan remediation plan.

## References
- `PLAN.md` Phase 10-12; backlog OCR-019..023

## Estimasi resource & rencana benchmark (ditambahkan 2026-07-22)

Referensi keputusan: ADR-0008 (isolasi resource & deployment worker OCR).

### Perkiraan awal (BELUM diverifikasi — wajib benchmark)
- **Aplikasi mobile:** ringan. Foto sudah dikurangi di client (`image_picker`: maks 1600x1600, quality 75, maks 3 foto, maks 5 MB/file). OCR jalan di server.
- **api-gateway:** ringan. Hanya enqueue job + respons (non-blocking).
- **Worker + Python inference (titik berat):** CPU-bound; perkiraan kasar ratusan ms - beberapa detik per foto per stage di CPU; RAM ~1-2 GB per worker untuk model + runtime. `OCR_WORKER_CONCURRENCY=1` sebagai default aman.
- **Postgres:** ringan (beberapa row metadata; gambar tidak di DB).
- **MinIO:** crop hanya untuk `NEEDS_OPERATOR_REVIEW`/`OCR_MISMATCHED`/sampling + retensi auto 30 hari.

### Rencana benchmark (jalankan sebelum memutuskan GPU)
- [ ] Ukur latency P50/P95/P99 per stage (detect, recognize, total) di CPU dengan gambar representatif (1600px, q75).
- [ ] Ukur RAM & CPU worker pada concurrency 1, 2, 4.
- [ ] Ukur throughput (foto/menit) dan queue depth pada beban puncak laporan yang diproyeksikan.
- [ ] Tentukan sizing worker (jumlah replica) untuk memenuhi SLA proses OCR.
- [ ] Putuskan ONNX/GPU HANYA jika target latency P95/P99 CPU tidak tercapai.
- [ ] Tempatkan worker di container/node terpisah dari api-gateway & Postgres, dengan CPU/RAM limit eksplisit.

### Catatan terkait upload
- Belum ada normalisasi/strip EXIF server-side (lihat issue `public-report-evidence-processing/01`). Pertimbangkan menambah langkah normalisasi ukuran sebelum inference untuk konsistensi latency.
