# 0008. Isolasi resource & deployment worker OCR

- Status: Accepted
- Tanggal: 2026-07-22
- Konteks terkait: services/ocr-worker (rencana), services/api-gateway, infra

## Konteks
Inference OCR (YOLOv8 detektor + PaddleOCR recognizer) bersifat CPU/RAM-intensif dan tidak deterministik latensinya. Kalau dijalankan di dalam proses api-gateway atau satu node dengan Postgres realtime, lonjakan OCR bisa menurunkan dashboard/telemetry. Foto yang diupload sudah dikurangi di sisi client (`image_picker`: maks 1600x1600, quality 75, maks 3 foto, maks 5 MB/file), sehingga beban inference sudah ditekan sejak awal.

## Keputusan
- OCR berjalan **asynchronous** via BullMQ; api-gateway hanya enqueue job dan langsung merespons submit laporan (non-blocking).
- Worker OCR + Python inference service berjalan sebagai **container/proses terpisah** dari api-gateway dan database, dengan **resource limit CPU/RAM eksplisit** di compose/orchestrator.
- **CPU-first**: mulai `OCR_WORKER_CONCURRENCY=1`; ONNX/GPU hanya diadopsi bila benchmark menunjukkan target latency P95/P99 tidak tercapai.
- Feature flag `OCR_ENABLED=false` memungkinkan OCR dimatikan total tanpa mengganggu alur laporan.
- Skala via jumlah worker (horizontal), bukan menaikkan beban api-gateway.
- Retry/backoff untuk kegagalan transient; worker down → job pending di antrian, tidak memblokir submit.

## Konsekuensi
- Positif: aplikasi mobile ringan (OCR di server), jalur API tetap ringan, lonjakan OCR terisolasi, biaya GPU dihindari sampai terbukti perlu.
- Negatif: perlu container tambahan + monitoring worker; butuh benchmark nyata untuk menentukan sizing (belum ada angka di repo).
- Normalisasi/strip EXIF server-side sudah diterapkan sebelum object disimpan: JPEG/PNG/WebP di-decode, di-re-encode tanpa metadata, di-clamp maksimum 1600 px tanpa upscale, lalu checksum dihitung dari buffer hasil sanitasi. Benchmark resource OCR tetap dicatat di issue OCR Phase 10-12.

## Alternatif dipertimbangkan
- Inference sinkron di api-gateway: ditolak (blocking, blast radius besar).
- On-device OCR / OCR SaaS eksternal: ditolak di ADR-0005 (berat/privasi).
- GPU wajib sejak awal: ditolak (mahal, belum terbukti perlu untuk MVP).
