# Runbook — Build & Rilis Mobile Flutter

Runbook ini menggantikan runbook Expo/EAS lama untuk aplikasi passenger Flutter di `apps/passenger-mobile/`.

## Prasyarat

1. Flutter SDK stabil, Xcode/Android Studio, CocoaPods, dan akun Apple Developer/Google Play Console.
2. API staging/production wajib HTTPS publik; jangan gunakan HTTP cleartext untuk build rilis.
3. Bundle identifier/package: `id.sentra.passenger`.
4. Secret/API base URL dikelola lewat `--dart-define`, CI secret, atau konfigurasi build aman.

## Verifikasi lokal sebelum build

```bash
cd apps/passenger-mobile
flutter pub get
flutter analyze
flutter test
```

## Build Android

```bash
cd apps/passenger-mobile
flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://staging.sentra.example.go.id
```

Artefak: `build/app/outputs/bundle/release/app-release.aab`.

## Build iOS

```bash
cd apps/passenger-mobile
flutter build ipa --release \
  --dart-define=API_BASE_URL=https://staging.sentra.example.go.id
```

Artefak: `build/ios/ipa/*.ipa`.

## Checklist QA Device Nyata

- Login dan session refresh berjalan.
- Tracking publik menampilkan kendaraan aktif dan fallback error state.
- Background/foreground location permission tidak membingungkan pengguna.
- Report warga bisa dikirim dengan validasi kategori, deskripsi, dan bukti.
- Battery impact tracking diuji minimal 1 jam perjalanan simulasi.
- Offline/poor network state memberi pesan yang jelas.
- Font lokal Inter/Manrope termuat tanpa download runtime.

## Checklist Rilis Pemerintah

- Gunakan domain resmi HTTPS, HSTS, dan certificate monitoring.
- Pastikan privacy policy menjelaskan lokasi, laporan warga, retensi data, dan kontak pengelola.
- Jalankan smoke test terhadap staging yang memakai data mirip produksi.
- Simpan mapping versi app, commit SHA, environment API, dan tanggal rilis.
- Siapkan rollback: unpublish staged rollout Android atau stop TestFlight build bermasalah.
# Mobile Flutter Release Runbook

## Product Rules

- Tracking angkot publik dapat digunakan tanpa login.
- Laporan warga membutuhkan akun `PUBLIC_USER` terverifikasi.
- Tracking lokasi penumpang baru dimulai setelah consent eksplisit.
- Logout menghentikan foreground task dan merevoke token tracking.
- Detail `passenger_positions` memiliki retention policy TimescaleDB 30 hari.
- Sinkronisasi background iOS bersifat best-effort; jangan menjanjikan interval absolut.

## Environment

Gunakan `--dart-define=API_BASE_URL=https://api.example.go.id` untuk staging dan
production. Build Android release menonaktifkan cleartext HTTP melalui manifest
placeholder. Debug build tetap mengizinkan HTTP untuk pengembangan lokal.

Konfigurasi SMTP notification service:

```dotenv
PUBLIC_APP_URL=https://sentra.example.go.id
SMTP_HOST=smtp.example.go.id
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Sentra Angkot <no-reply@example.go.id>
```

## Android

Sebelum store submission, ganti debug signing pada
`apps/passenger-mobile/android/app/build.gradle.kts` dengan release keystore yang
disimpan di secret CI. Jangan commit file keystore atau password.

```bash
flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://api.example.go.id
```

## iOS

Build `.ipa` hanya dapat dilakukan pada runner macOS dengan Xcode, Apple
Distribution certificate, provisioning profile, dan App Store Connect access.

```bash
flutter build ipa --release \
  --dart-define=API_BASE_URL=https://api.example.go.id
```

## Store Checklist

- Siapkan app icon, splash screen, screenshot, deskripsi, support contact, dan data deletion URL.
- Publikasikan Privacy Policy dan Syarat Layanan sebelum review store.
- Isi disclosure lokasi background, laporan warga, foto, dan retensi lokasi 30 hari.
- Jalankan Android Internal Testing dan TestFlight staging sebelum closed beta.
- Uji device nyata: consent, background, force-close, reboot, logout, airplane mode,
  perpindahan Wi-Fi ke seluler, kamera, galeri, dan battery test minimal 3 jam.
