# Emergency Response Drill

Owner: Dishub command center  
Status: Draft operational runbook  
Last reviewed: 2026-07-01

## Scope

Runbook ini dipakai untuk drill bulanan alur transport emergency Phase 19:

- passenger SOS dari aplikasi mobile,
- driver/device panic button intake,
- emergency board operator,
- acknowledge dan responder assignment,
- bukti lapangan,
- resolution notes,
- escalation saat SLA terlewati.

## SLA

| Step | Target |
| --- | ---: |
| SOS diterima sampai operator acknowledge | <= 60 detik |
| SOS diterima sampai responder assigned | <= 180 detik |
| Emergency aktif tanpa acknowledge | Eskalasi ke supervisor |
| Emergency aktif tanpa assignment | Eskalasi ke koordinator lapangan |

## Pre-Drill Environment Check

Untuk volume Postgres baru, `infra/docker-compose/initdb/001_bootstrap.sql` sudah menjalankan migration Phase 19 dan seed demo saat init pertama.

Untuk volume Docker lama atau environment yang sudah berjalan sebelum Phase 19, jalankan preflight non-destruktif ini sebelum drill:

```sh
./scripts/apply-phase19-emergency-runtime.sh
```

Script ini menerapkan `db/migrations/022_phase19_emergency_response.sql`, memverifikasi kolom emergency workflow, dan memastikan ada user aktif dengan role `PETUGAS_LAPANGAN`.

Jika environment lokal/demo belum punya petugas lapangan, buat user demo secara eksplisit:

```sh
SEED_DEMO_FIELD_OFFICER=true ./scripts/apply-phase19-emergency-runtime.sh
```

Jangan gunakan seed demo ini untuk produksi. Untuk staging/produksi, provision user petugas lapangan lewat proses admin resmi, lalu jalankan script tanpa `SEED_DEMO_FIELD_OFFICER`.

## Drill Steps

1. Login mobile sebagai `warga@sentra.id`.
2. Aktifkan tracking consent bila diminta.
3. Buka `SOS Darurat` dari Beranda mobile.
4. Kirim SOS kategori keamanan.
5. Login operator web sebagai `operator@pemda.go.id`.
6. Buka `/dashboard/emergencies`.
7. Pastikan emergency baru muncul dengan severity `CRITICAL`, source, trust level, lokasi, timer SLA, dan nearest vehicle.
8. Klik `Akui`.
9. Pilih `Petugas Lapangan Bogor`, lalu klik `Assign`.
10. Upload file bukti JPEG/PNG/WebP.
11. Isi catatan resolusi.
12. Klik `Selesai`.
13. Buka detail incident dan pastikan action trail berisi `SOS_RECEIVED`, `ACKNOWLEDGE`, `ASSIGN`, `PROOF_UPLOAD`, dan `RESOLVE`.

## Monthly Drill Result Template

| Field | Value |
| --- | --- |
| Bulan drill | |
| Tanggal/jam | |
| Operator | |
| Petugas lapangan | |
| Sumber SOS | Passenger app / driver panic / device panic |
| Incident ID | |
| Ack time | |
| Assignment time | |
| Ack SLA met | Ya / Tidak |
| Assignment SLA met | Ya / Tidak |
| Bukti uploaded | Ya / Tidak |
| Resolution notes complete | Ya / Tidak |
| Escalation triggered | Tidak / Supervisor / Koordinator lapangan |
| Issue found | |
| Follow-up owner | |
| Target selesai | |

## Failure Handling

- Jika SOS tidak muncul di board, cek API `/me/sos`, `/telemetry/driver-panic`, dan websocket/event log.
- Jika upload bukti gagal, cek MinIO/S3 readiness dan ukuran/format file.
- Jika field officer tidak bisa update incident, cek assignment dan role `PETUGAS_LAPANGAN`.
- Jika SLA timer tidak sesuai, cek env `EMERGENCY_ACK_SLA_SECONDS` dan `EMERGENCY_ASSIGNMENT_SLA_SECONDS`.
