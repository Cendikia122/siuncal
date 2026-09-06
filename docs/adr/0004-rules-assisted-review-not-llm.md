# 0004. Tinjauan laporan otomatis bersifat rules-assisted, bukan LLM

- Status: Accepted
- Tanggal: 2026-07-22 (dokumentasi keputusan yang sudah berjalan)
- Konteks terkait: services/api-gateway, cross-cutting

## Konteks
Laporan warga perlu triase cepat, tetapi keputusan yang menyalahkan kendaraan/pengemudi punya konsekuensi hukum dan reputasi.

## Keputusan
Tinjauan otomatis laporan publik memakai mesin **deterministik berbasis rules** (`review_mode: rules_assisted_summary`) yang menghasilkan verdict (`CONFIRMED`/`LIKELY`/`INCONCLUSIVE`/`REJECT_SUSPECTED_SPAM`) + confidence + reason summary dari bukti monitoring (jarak, telemetry window, anomaly/alert/incident). AI/LLM hanya membantu ringkasan/penjelasan, bukan dasar auto-escalation. Auto-escalation ke incident hanya untuk `CONFIRMED` dengan evidence kuat. Keputusan akhir tetap pada operator/Analisa.

## Konsekuensi
- Positif: dapat diaudit, dapat dijelaskan, dan jujur dipresentasikan sebagai "rules-assisted" bukan "AI".
- Negatif: aturan harus dirawat manual; tidak menangkap pola yang tak ter-encode.

## Alternatif dipertimbangkan
- Klasifikasi berbasis LLM sebagai dasar keputusan: ditolak demi akuntabilitas dan menghindari sanksi otomatis yang keliru.
