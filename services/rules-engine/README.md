# rules-engine

Rules engine untuk deteksi anomali sederhana (overspeed, lost signal, off-route, wrong direction, ngetem).
Alur utama MVP adalah `telemetry -> anomaly -> alert -> incident`: rule membuka `anomalies`,
membuat `alerts`, lalu hanya mengeskalasi alert menjadi `incidents` jika severity/frekuensi
memenuhi kriteria.

## Menjalankan
```sh
cd services/rules-engine
cp .env.example .env
npm install
npm run dev
```

## Konfigurasi
- `OVERSPEED_KMH` (default 60)
- `OVERSPEED_WINDOW_POINTS` (default 3)
- `OVERSPEED_MIN_POINTS` (default 2, mencegah spike GPS tunggal)
- `LOST_SIGNAL_MINUTES` (default 3)
- `LOST_SIGNAL_CRITICAL_MINUTES` (default 10)
- `OFF_ROUTE_METERS` (default 30)
- `OFF_ROUTE_GRACE_MINUTES` (default 3)
- `OFF_ROUTE_MIN_POINTS` (default 3, grace period untuk drift GPS)
- `MAP_MATCHING_MIN_CONFIDENCE` (default 0.35)
- `WRONG_DIRECTION_GRACE_MINUTES` (default 3)
- `WRONG_DIRECTION_MIN_POINTS` (default 3)
- `WRONG_DIRECTION_HEADING_DIFF_DEGREES` (default 120)
- `WRONG_DIRECTION_MIN_SPEED_KMH` (default 5)
- `NGETEM_MINUTES` (default 10)
- `NGETEM_MAX_DISTANCE_METERS` (default 15)
- `NGETEM_MAX_AVG_SPEED` (default 3)
- `OFFICIAL_STOP_RADIUS_METERS` (default 120)
- `BASE_RADIUS_METERS` (default 150)
- `REPEAT_ESCALATION_COUNT` (default 3)
- `RISK_DAILY_DECAY_PERCENT` (default 5)
- `RISK_WEEKLY_DECAY_POINTS` (default 10)

## Rule MVP
- `LOST_SIGNAL`: membuka anomaly/alert saat kendaraan tidak ping lebih dari threshold, severity `HIGH`, naik `CRITICAL` setelah threshold critical, dan auto-resolve saat ping kembali.
- `OFF_ROUTE`: hanya untuk kendaraan `IN_SERVICE`; memakai matched point jika confidence cukup, fallback ke raw distance jika matching belum ada/low confidence, dan dikecualikan jika kendaraan berada di sekitar base/pool.
- `WRONG_DIRECTION`: memakai `matched_heading` dari map matching untuk membandingkan arah GPS dengan arah geometry route, dengan grace window agar tidak trigger dari satu spike.
- `NGETEM`: butuh speed rata-rata rendah, durasi window terpenuhi, dan perpindahan kecil; tidak trigger di route stop, terminal, halte, atau stop resmi.
- `OVERSPEED`: butuh minimal beberapa titik dalam window pendek, bukan satu spike GPS.

Setiap anomaly menyimpan evidence JSONB berisi vehicle, route, rule, severity, window waktu, jumlah point, lokasi, threshold, dan metrik rule.

## Risk Scoring MVP
- Risk score disimpan di `risk_scores` dengan rentang `0-100`.
- Riwayat perubahan disimpan di `risk_score_events`.
- Delta awal: `NGETEM +8`, `OFF_ROUTE +12`, `WRONG_DIRECTION +10`, `LOST_SIGNAL +10`, `OVERSPEED +6`, dan planned `DEVICE_TAMPER +25`.
- Level risiko: `LOW 0-19`, `MEDIUM 20-39`, `HIGH 40-69`, `CRITICAL 70-100`.
- Decay harian menurunkan 5% setelah 24 jam tanpa anomaly baru, minimal 1 poin bila score di atas 0.
- Decay mingguan menurunkan 10 poin bila 7 hari tanpa anomaly `HIGH` atau `CRITICAL`.
- Risk score hanya indikator monitoring, bukan dasar sanksi otomatis.
