# Sentra — Roadmap & Scope Rilis

Dokumen ini memisahkan dengan jelas apa yang **sudah jadi** (scope rilis lomba 8 Juni 2026) dari apa yang **direncanakan** (tahap lanjutan). Tujuannya transparansi untuk juri dan stakeholder.

## Tahap 1–2 — SUDAH JADI (scope rilis lomba)

Seluruh Phase 1–16 di `doc1/task.md` selesai dan terhubung ke data nyata (lihat tabel Status Fitur di `README.md` dan verifikasi di `docs/qa/final-demo-readiness.md`):

- Realtime monitoring + peta trayek 01/02/03, map-matching OSRM/PostGIS.
- Rules engine: NGETEM, OFF_ROUTE, OVERSPEED, LOST_SIGNAL, WRONG_DIRECTION.
- Incident center penuh (ack/assign/resolve/false-alarm) + audit log + SLA.
- Playback, reporting harian (RIT/KPI) + export CSV (RBAC).
- Master data lengkap; RBAC OPERATOR/ANALISA + CSRF + rate limit + audit log.
- Public report (mobile) + evidence MinIO + tinjauan otomatis (rules-assisted) + OCR plat lokal asynchronous sebagai evidence operator.
- Passenger tracking live, network view, collective anomaly, sanction, fleet compliance, heatmap operasional.

## Tahap 3 — DIRENCANAKAN (di luar scope rilis lomba)

Fitur berikut **belum diimplementasi** dan sengaja ditunda karena membutuhkan integrasi eksternal berbayar dan waktu di luar jendela rilis:

### Phase 17 — Social Media Intelligence
- Monitoring Twitter/X, Instagram, Facebook, TikTok via API resmi (berbayar).
- Sentiment analysis (NLP/AI service), viral post detector, influencer mapping.
- Auto-ticketing dari sosmed → `public_reports` (source `SOCIAL_MEDIA`).
- WhatsApp Business API: webhook laporan masyarakat + auto-reply tiket.

Prasyarat: kredensial & kuota API platform, tabel `social_media_posts` + `influencers`, job fetch periodik, layanan sentiment.

### Notifikasi eksternal
- Integrasi WhatsApp/SMS/email nyata pada `notification-service` (saat ini log-only). Dipakai untuk notifikasi sanksi ke pemilik dan eskalasi insiden.

### Passenger safety lanjutan
- SOS / panic button dan Safety Trip pada aplikasi mobile.

### Operasional produksi
- Deployment Kubernetes produksi, dashboard observability produksi penuh.
- HSTS + pengetatan CSP (hapus `unsafe-inline`) untuk TLS produksi.

## Catatan integritas

- Telemetry pada demo berasal dari **simulator GPS**, bukan device fisik di lapangan.
- Tinjauan laporan otomatis bersifat **rules-assisted** (deterministik + skor kepercayaan yang dapat dijelaskan), bukan model bahasa (LLM). Keputusan akhir tetap pada operator/Analisa.
