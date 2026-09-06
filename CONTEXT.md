# CONTEXT — Sentra (Monitoring Angkot Bogor)

Glosarium & overview domain lintas-sistem. Ini konteks tingkat sistem; bahasa domain spesifik per komponen ada di `CONTEXT.md` masing-masing konteks (lihat `CONTEXT-MAP.md`). Keputusan arsitektur ada di `docs/adr/`.

> Gunakan istilah di sini secara konsisten pada issue, PRD, hipotesis, dan nama test. Jika sebuah konsep belum ada di glosarium, itu sinyal: mungkin bahasa baru yang tidak dipakai proyek (pertimbangkan ulang) atau gap nyata (catat untuk `grill-with-docs`).

## Tujuan sistem
Monitoring angkot untuk Pemerintah Kota Bogor (Dishub): menekan tindak kriminal di angkot dan menegakkan kepatuhan operasional armada (ngetem, off-route, putar arah liar), dengan dashboard operator, aplikasi masyarakat, dan tinjauan laporan yang dapat diaudit.

## Aktor & Role
- **PUBLIC_USER** — masyarakat pengguna app mobile; tracking tanpa login, submit laporan wajib login.
- **OPERATOR** — Dishub; monitoring realtime, incident, review laporan; melihat passenger termasuk lokasi dengan identitas dimasking default.
- **ANALISA** — analis Dishub; akses data sensitif/aggregate, export CSV, identitas lebih lengkap untuk audit.
- **PETUGAS_LAPANGAN** — field officer; hanya emergency/incident yang di-assign ke dirinya.
- **Internal service / worker** — auth via service credential/token/HMAC, bukan JWT publik.

## Istilah domain inti
- **Angkot** — angkutan kota; unit kendaraan yang dimonitor.
- **Trayek / Route** — jalur resmi (mis. 01/02/03) dengan koridor PostGIS.
- **Telemetry** — ping GPS kendaraan (`POST /telemetry/vehicle`) → `vehicle_positions` (hypertable) → `vehicle_latest`. Sumber kebenaran tracking (ADR-0003). Pada demo, telemetry berasal dari **simulator GPS**, bukan device fisik.
- **Map-matching** — snapping posisi ke koridor rute → `telemetry_matched_positions`; dasar deteksi OFF_ROUTE/WRONG_DIRECTION.
- **Anomaly / Alert** — output rules engine; sumber pembuatan incident.
- **Rule anomali** — NGETEM (berhenti lama di luar stop resmi), OFF_ROUTE, OVERSPEED, LOST_SIGNAL, WRONG_DIRECTION; pengecualian DEADHEAD_TO_BASE.
- **Incident** — kejadian yang ditindaklanjuti; aksi ACKNOWLEDGE/ASSIGN/RESOLVE/FALSE_ALARM; mutasi butuh CSRF; tercatat di `incident_actions` + `audit_logs`; punya SLA.
- **Emergency** — incident severity `CRITICAL` dari SOS passenger (`POST /me/sos`) atau driver/device panic (`POST /telemetry/driver-panic`); punya emergency board + escalation.
- **Public report** — laporan warga (`POST /public/reports`) wajib `plate_no` + lokasi + minimal 1 foto; evidence di MinIO, metadata di Postgres; status awal `PENDING_REVIEW`.
- **plate_match_status** — hasil pencocokan plat input warga ke master data: `MATCHED_VEHICLE` / `UNMATCHED_PLATE` / `MULTIPLE_MATCH_CANDIDATES`.
- **Automated review** — tinjauan laporan **rules-assisted deterministik** (`review_mode: rules_assisted_summary`, BUKAN LLM, ADR-0004); verdict `CONFIRMED`/`LIKELY`/`INCONCLUSIVE`/`REJECT_SUSPECTED_SPAM` + confidence + reason summary; auto-escalate hanya untuk `CONFIRMED`.
- **OCR evidence** — OCR plat lokal asynchronous (queue `public-report-ocr` → `public_report_ocr_results`), **evidence-only** (ADR-0005); tidak mengubah `plate_match_status`, tidak memicu sanksi; `OCR_MATCHED`/`OCR_MISMATCHED`/`NEEDS_OPERATOR_REVIEW`.
- **Passenger tracking** — layer internal operator; mobile kirim posisi via `X-Passenger-Tracking-Token` (terpisah dari session operator); ditampilkan dengan data-minimization.
- **Heatmap / Network view / Sanction / Fleet compliance** — analitik operasional (STOP_DENSITY/NGETEM_ZONE/SPEED_ZONE, graph entitas, sanksi manual ter-audit, kepatuhan armada).
- **Master data** — owner, vehicle, driver, device, route, stop, geofence.
- **Device / Assignment** — perangkat GPS (mis. GT06) dan penugasannya ke kendaraan; sinyal tamper (power disconnect + lost signal, impossible movement, identity mismatch).

## Prinsip lintas-fitur
- GPS kendaraan = sumber kebenaran; lokasi user = evidence (ADR-0003).
- Keputusan otomatis bersifat evidence/recommendation; sanksi & keputusan akhir tetap manusia (operator/Analisa).
- Data sensitif (NIK, alamat, IMEI, identitas passenger/reporter) dibatasi role + audit log + masking.
- Auth: JWT + refresh rotation + CSRF (double-submit cookie `sentra_csrf`); telemetry via token statis/HMAC.

## Tumpukan teknologi (ringkas)
- Datastore tunggal Postgres + PostGIS + TimescaleDB (ADR-0002); Redis (rate limit, cache, pub/sub, BullMQ); MinIO/S3 (evidence). Monorepo multi-service (ADR-0001).

## Status
Kematangan fitur & pekerjaan yang belum selesai: lihat `.scratch/FEATURE-STATUS.md` dan issue di `.scratch/<feature-slug>/`.
