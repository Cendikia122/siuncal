# Server-side image normalization + EXIF strip untuk evidence laporan

- **Status:** done
- **Type:** feature
- **Scope:** backend
- **Priority:** P1 (privasi/keamanan) / P2 (performa)
- **Doc status:** DONE
- **Component:** api-gateway (public report upload), db (opsional)

## Context
Issue ini dibuat karena foto laporan hanya diketahui dikurangi di sisi client (Flutter `image_picker`: maks 1600x1600, quality 75, maks 3 foto, maks 5 MB/file), sedangkan perlindungan server-side belum terbukti lengkap. Kondisi tersebut menimbulkan dua risiko:

1. **Privasi:** EXIF bisa memuat GPS/perangkat pelapor. Re-encode di client sering (tapi tidak dijamin) menghapus metadata; server tidak boleh bergantung pada itu. Foto bisa juga diupload lewat client lain/versi lama tanpa reduksi.
2. **Konsistensi/performa:** ukuran tidak seragam membuat latency OCR/preview bervariasi.

Temuan awal issue menyatakan jalur server belum memiliki normalisasi. Saat diagnosis 2026-07-23, decode/re-encode, EXIF strip, validasi, dan checksum sanitized buffer ternyata sudah ada; gap yang masih dapat direproduksi adalah belum adanya clamp sisi terpanjang 1600 px.

## Acceptance Criteria
- [x] Pada jalur `POST /public/reports`, sebelum menyimpan ke MinIO: strip metadata EXIF (terutama GPS) dari JPEG/PNG/WebP.
- [x] Normalisasi ukuran maksimum server-side (mis. clamp sisi terpanjang ~1600px) dan re-encode dengan kualitas terkendali — idempotent, tidak merusak gambar yang sudah kecil.
- [x] Validasi tipe/ukuran tetap ditegakkan; tolak file yang bukan gambar valid.
- [x] Simpan checksum atas file yang SUDAH dinormalisasi.
- [x] Tidak memblokir submit secara signifikan (normalisasi ringan/sinkron OK; berat → serahkan ke evidence-processing worker di issue 01).
- [x] Test: EXIF GPS hilang setelah upload; gambar besar ter-clamp; gambar kecil tidak di-upscale; file non-gambar ditolak.

## Verification
- `cd services/api-gateway && npm test`
- Manual: upload foto ber-EXIF GPS → verifikasi metadata hilang di object MinIO.

## Catatan keterkaitan
- Melengkapi issue `01-evidence-processing-worker.md` (thumbnail/quality async). Issue ini fokus pada normalisasi + privasi di jalur upload; thumbnail berat tetap di worker.
- Terkait ADR-0005 (privasi evidence) dan ADR-0008 (konsistensi input OCR).

## References
- `services/api-gateway/src` (jalur `POST /public/reports`, `object-storage.js`)
- `apps/passenger-mobile/lib/features/report/presentation/report_screen.dart`
- `docs/16-public-report-and-passenger-mobile.md` (Security dan Privacy)

## Comments

- 2026-07-23 — Selesai. Implementasi existing sudah melakukan magic-byte/MIME check, decode/re-encode, EXIF strip, output-size limit, dan checksum sanitized buffer. Gap clamp ditutup dengan resize `fit: inside` maksimum 1600 px dan `withoutEnlargement`.
- Verifikasi: `cd services/api-gateway && npm test` → 102 test, 92 pass, 10 integration smoke skip karena server live tidak aktif, 0 fail.
- Regression coverage: GPS EXIF hilang untuk JPEG/PNG/WebP; gambar 2000×1000 menjadi 1600×800; gambar 800×400 tidak di-upscale; spoofed/truncated image ditolak; checksum dikontrak memakai `validation.buffer`.
- 2026-07-23 — Live Docker/MinIO verification lulus: upload `201`, object download `200`, GPS EXIF hilang, gambar 2000×1000 tersimpan sebagai 1600×800, checksum object cocok dengan metadata attachment, ukuran object cocok dengan database, dan spoofed JPEG ditolak `400 VALIDATION_ERROR`.
- 2026-07-23 — Verifikasi ulang setelah penyelesaian: test terarah `node --test test/image-validation.test.js test/report-security-contract.test.js` lulus 18/18; suite penuh `npm test` lulus 102/102 tanpa fail atau skip. Seluruh acceptance criteria tetap terpenuhi.
