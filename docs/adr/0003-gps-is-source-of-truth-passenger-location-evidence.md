# 0003. GPS kendaraan sumber kebenaran; lokasi passenger sebagai evidence

- Status: Accepted
- Tanggal: 2026-07-22 (dokumentasi keputusan yang sudah berjalan)
- Konteks terkait: services/telemetry-ingestion, services/api-gateway, apps/passenger-mobile

## Konteks
Aplikasi mobile mengirim lokasi user, dan kendaraan mengirim GPS. Perlu kejelasan mana yang jadi sumber kebenaran tracking agar tidak salah menuduh kendaraan.

## Keputusan
GPS kendaraan (`vehicle_positions` → `vehicle_latest`) adalah satu-satunya sumber kebenaran tracking. Lokasi user hanya evidence laporan, bukan sumber posisi kendaraan. Telemetry passenger memakai token tracking khusus (`X-Passenger-Tracking-Token`), terpisah dari session/cookie operator, dan ditampilkan ke operator dengan data-minimization (identitas dimasking secara default).

## Konsekuensi
- Positif: batas privasi jelas; laporan warga tidak otomatis menyalahkan kendaraan; endpoint telemetry passenger tidak memakai auth operator.
- Negatif: perlu dua jalur auth (JWT publik + tracking token) dan kebijakan retensi posisi passenger sebelum produksi.

## Alternatif dipertimbangkan
- Menggabungkan lokasi user sebagai tracking: ditolak karena tidak akurat dan berisiko privasi.
