# 0005. OCR plat lokal asynchronous, evidence-only

- Status: Accepted
- Tanggal: 2026-07-22 (dokumentasi keputusan yang sudah berjalan)
- Konteks terkait: services/api-gateway, services/ocr-worker (rencana), ml/plate-ocr (rencana)

## Konteks
OCR plat pada foto laporan dapat mempercepat verifikasi, tetapi berisiko bila dijadikan dasar sanksi otomatis atau bila foto dikirim ke layanan eksternal.

## Keputusan
OCR berjalan **lokal dan asynchronous** setelah attachment tersimpan di MinIO (queue `public-report-ocr`), hasil ke `public_report_ocr_results`. OCR hanya evidence operator: tidak mengubah `plate_match_status`, tidak membuat incident, tidak memicu sanksi. Confidence `>= 0.90` → `OCR_MATCHED`/`OCR_MISMATCHED`; di bawah threshold/tak terbaca/gagal → `NEEDS_OPERATOR_REVIEW`. Foto tidak dikirim ke OCR SaaS eksternal. Model/dataset/metrics disimpan di MinIO/S3, bukan Git.

Pipeline ML penuh (YOLOv8 detector + PaddleOCR recognizer, training/eval/worker) direncanakan terpisah dan belum diimplementasi (lihat `PLAN.md` dan `.scratch/plate-ocr-ml-pipeline/`).

## Konsekuensi
- Positif: privasi terjaga, tidak ada auto-enforcement, submit laporan tidak diblokir OCR.
- Negatif: butuh worker + infra model; validasi produksi butuh held-out test set angkot Bogor nyata (approval Dishub + legal).

## Alternatif dipertimbangkan
- OCR sinkron saat submit / OCR SaaS eksternal / OCR on-device: ditolak (latency, privasi, kompleksitas update model).
