# 0001. Arsitektur monorepo multi-service

- Status: Accepted
- Tanggal: 2026-07-22 (dokumentasi keputusan yang sudah berjalan)
- Konteks terkait: cross-cutting

## Konteks
Sentra terdiri dari dashboard operator, aplikasi mobile masyarakat, beberapa backend service, database, dan infra. Perlu batas modul yang jelas namun tetap mudah dikembangkan bersama dalam satu repo.

## Keputusan
Gunakan monorepo tunggal dengan pemisahan:
- `apps/operator-web` — dashboard operator (Next.js).
- `apps/passenger-mobile` — aplikasi masyarakat (Flutter; versi RN/Expo lama diarsipkan di `archive/`).
- `services/` — `api-gateway`, `telemetry-ingestion`, `rules-engine`, `notification-service`.
- `db/` migration & seed; `infra/` docker-compose, k8s, monitoring.

## Konsekuensi
- Positif: satu API gateway, satu database, satu MinIO; boot order jelas via docker-compose; developer bisa lihat seluruh sistem.
- Negatif: butuh disiplin agar concern tidak bocor antar service; CI harus meng-cover banyak workspace.

## Alternatif dipertimbangkan
- Polyrepo per service: ditolak karena menambah friksi koordinasi kontrak API dan schema DB pada tim kecil.
