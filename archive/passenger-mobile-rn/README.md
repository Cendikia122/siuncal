# Passenger Mobile

Aplikasi masyarakat untuk Phase 14 Sentra. Stack saat ini Expo React Native dengan TypeScript strict.

## Scope MVP

- Tracking angkot bisa dibuka tanpa login dari endpoint `GET /public/vehicles`.
- Kirim laporan masyarakat wajib login sebagai user publik.
- Submit laporan wajib menyertakan `plate_no`, kategori, deskripsi, lokasi aktif, dan minimal satu foto bukti.
- Attachment dikirim sebagai `multipart/form-data` ke `POST /public/reports`; backend Phase 14 menyimpan binary ke MinIO dan metadata ke PostgreSQL.
- Jika endpoint publik belum tersedia, layar tracking memakai data contoh dan menampilkan notice agar demo mobile tetap bisa dibuka.

## Konfigurasi

Salin `.env.example` jika perlu mengganti API gateway:

```sh
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
```

Untuk device fisik, gunakan IP host yang bisa diakses dari perangkat, bukan `localhost`.

## Perintah

Semua verifikasi bisa dijalankan via container:

```sh
docker run --rm -v "$PWD:/app" -w /app node:22-bookworm-slim npm ci
docker run --rm -v "$PWD:/app" -w /app node:22-bookworm-slim npm run typecheck
docker run --rm -v "$PWD:/app" -w /app node:22-bookworm-slim npm run lint
```

Menjalankan Expo dev server:

```sh
docker build -t sentra-passenger-mobile .
docker run --rm -it -p 8081:8081 -v "$PWD:/app" -w /app sentra-passenger-mobile
```

Detail desain ada di `../../docs/16-public-report-and-passenger-mobile.md`.
