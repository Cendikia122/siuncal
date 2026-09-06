# Flutter Passenger App Rebuild Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Arsipkan aplikasi passenger React Native/Expo dan bangun ulang sebagai aplikasi **Flutter** baru (UI lebih premium) yang terhubung ke backend Sentra yang sama, dengan paritas fitur: tracking publik, lapor insiden+foto, dan passenger telemetry background.

**Architecture:** Flutter app di `apps/passenger-mobile/` (org `id.sentra`, bundle `id.sentra.passenger`). State pakai **Riverpod**, peta **flutter_map** (OSM, gratis tanpa API key), HTTP **dio**, lokasi **geolocator** + **flutter_foreground_task**, foto **image_picker**, token **flutter_secure_storage**. Tracking penumpang dimulai hanya setelah consent eksplisit dan berjalan best-effort pada iOS. Backend menyediakan lifecycle akun, consent, revoke token, dan riwayat laporan server-side.

**Tech Stack:** Flutter 3.44 / Dart 3.12, Riverpod, dio, flutter_map + latlong2, geolocator, flutter_foreground_task, image_picker, flutter_secure_storage.

**Konvensi verifikasi:** Flutter belum punya backend mock — verifikasi pakai `flutter analyze` (lint/type), `flutter test` (unit/widget), dan uji integrasi manual ke stack lokal (`http://localhost:4000`, jalankan via `docker compose ... up -d`). Commit per task.

**Prasyarat:** Flutter 3.44 + Dart 3.12 + Xcode 26.5 sudah terpasang (terverifikasi). Backend stack lokal harus hidup untuk uji integrasi. **Referensi kontrak API** diambil dari app RN yang diarsipkan (`archive/passenger-mobile-rn/src/api.ts`) — sumber kebenaran field/endpoint.

---

## Kontrak Backend (acuan, dari RN `src/api.ts` + `server.js`)

| Endpoint | Method | Auth | Payload kunci |
|----------|--------|------|---------------|
| `/public/vehicles` | GET | — | resp `{vehicles:[{vehicle_id,plate_no,route_name,latest_lat,latest_lon,status,last_seen_at}]}` (kini ada cache + `Cache-Control`) |
| `/auth/mobile/login` | POST | — | body `{email,password}` → `{access_token, passenger_tracking_token, passenger_tracking_session_id, user:{full_name,email}}` |
| `/public/reports` | POST | `Authorization: Bearer <access_token>` | multipart: `plate_no, category, description, lat, lon, reported_at, accuracy_m?, attachments[]` (foto) → `201 {public_report_id,status,plate_match_status}` |
| `/telemetry/passenger` | POST | header `X-Passenger-Tracking-Token` | `{session_id, lat, lon, accuracy?, timestamp, app_state}` |

Base URL: dev `http://localhost:4000`; prod HTTPS via Caddy (`docs/runbooks/security-hardening.md`). Flutter pakai `--dart-define=API_BASE_URL=...` per environment.

---

## Phase 0 — Arsipkan RN

### Task 0.1: Pindahkan RN app ke archive
**Files:** move `apps/passenger-mobile/` → `archive/passenger-mobile-rn/`

**Steps:**
1. `git mv apps/passenger-mobile archive/passenger-mobile-rn`
2. Hapus `node_modules` ter-track bila ada (seharusnya gitignored).
3. Verifikasi: `git status` menunjukkan rename; `ls archive/passenger-mobile-rn/App.tsx` ada.
4. Commit: `chore(mobile): archive React Native passenger app before Flutter rebuild`

### Task 0.2: Catatan arsip
**Files:** Create `archive/README.md`

Isi: kenapa diarsipkan (pindah ke Flutter, alasan UI premium), versi (Expo SDK 55/RN 0.83), cara menghidupkan kembali (`cd archive/passenger-mobile-rn && npm i && npx expo start`), dan bahwa kontrak API di `src/api.ts` jadi acuan rebuild. Commit.

### Task 0.3: Update dokumen yang mereferensikan RN
**Files:** Modify `README.md`, `docs/ROADMAP.md`, `AGENTS.md`, `docs/runbooks/mobile-eas-build.md` (tandai DEPRECATED — diganti Flutter build), `doc1/task.md` (catatan mobile pindah Flutter).
Sebut: passenger app kini Flutter di `apps/passenger-mobile/`; EAS runbook diganti runbook build Flutter (Task P.3). Commit.

---

## Phase 1 — Scaffold Flutter + dependencies

### Task 1.1: flutter create
**Files:** Create `apps/passenger-mobile/` (Flutter project)

**Steps:**
1. `flutter create --org id.sentra --project-name sentra_passenger --platforms ios,android apps/passenger-mobile`
   (bundle id jadi `id.sentra.sentraPassenger`; sesuaikan ke `id.sentra.passenger` di Task 1.3 bila diperlukan kontinuitas store)
2. `cd apps/passenger-mobile && flutter analyze` → 0 issue (template bersih).
3. `flutter test` → template test lulus.
4. Commit: `feat(mobile): scaffold Flutter passenger app`

### Task 1.2: Tambah dependencies
**Files:** Modify `apps/passenger-mobile/pubspec.yaml`

```yaml
dependencies:
  flutter_riverpod: ^2.6.0
  dio: ^5.7.0
  flutter_map: ^7.0.0
  latlong2: ^0.9.1
  geolocator: ^13.0.0
  flutter_foreground_task: ^9.2.2
  image_picker: ^1.1.2
  flutter_secure_storage: ^9.2.2
  google_fonts: ^6.2.1   # Manrope (heading) + Inter (body/data)
  freezed_annotation: ^2.4.4
  json_annotation: ^4.9.0
dev_dependencies:
  build_runner: ^2.4.13
  freezed: ^2.5.7
  json_serializable: ^6.8.0
```
Run `flutter pub get`; `flutter analyze`. Commit: `chore(mobile): add core dependencies`.

### Task 1.3: Bundle id, nama app, permissions
**Files:** Modify `ios/Runner/Info.plist`, `android/app/src/main/AndroidManifest.xml`, `android/app/build.gradle`
- Nama tampilan: "Sentra Angkot".
- (Opsional) set bundle/applicationId `id.sentra.passenger` untuk kontinuitas store.
- iOS Info.plist: `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`, `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `UIBackgroundModes` (location) — copy maksud dari RN `app.json`.
- Android manifest: `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `CAMERA`, `INTERNET`, foreground service location.
- Verifikasi `flutter analyze`. Commit.

---

## Phase 2 — Core infra (non-visual, dibangun sekarang)

### Task 2.1: Config base URL per environment
**Files:** Create `lib/core/config/app_config.dart`
```dart
class AppConfig {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL', defaultValue: 'http://localhost:4000');
}
```
Jalankan dev: `flutter run --dart-define=API_BASE_URL=http://localhost:4000`. Prod build pakai domain HTTPS. **Unit test** memastikan default benar. Commit.

### Task 2.2: Model data (freezed/json)
**Files:** Create `lib/features/*/models/*.dart` — `PublicVehicle`, `Session`, `DraftReport`, `ReportCategory`, `RouteInfo`.
- Tulis test serialisasi JSON dari contoh respons backend (lihat kontrak di atas) → `flutter test`. 
- `dart run build_runner build`. Commit per model atau sekaligus.

### Task 2.3: API client (dio)
**Files:** Create `lib/core/api/api_client.dart`, `lib/features/.../*_repository.dart`
- `dio` dengan baseUrl `AppConfig.apiBaseUrl`, interceptor error→pesan ID.
- Method: `fetchPublicVehicles()` (+ fallback list seperti RN saat offline, **dilabeli "data contoh"**), `mobileLogin(email,password)`, `submitPublicReport(DraftReport, token)` (multipart `attachments`), `sendPassengerTelemetry(...)` (header `X-Passenger-Tracking-Token`).
- **Test** dengan `dio` MockAdapter (http_mock_adapter) untuk tiap method (status, mapping field). `flutter test`. Commit.

### Task 2.4: Port data statis (rute + kategori)
**Files:** Create `lib/features/routes/data/route_polylines.dart`, `routes.dart`, `lib/features/report/data/report_categories.dart`
- Port dari `archive/passenger-mobile-rn/src/data/routePolylines.ts`, `routes.ts`, `reportCategories.ts` ke Dart (`List<LatLng>` dll). Data besar tapi mekanis.
- Test: jumlah titik polyline cocok dengan sumber. Commit.

### Task 2.5: Design tokens (tema)
**Files:** Create `lib/core/theme/app_theme.dart`, `app_colors.dart`, `app_spacing.dart`
- Port palet hijau dari RN `theme/colors.ts` (primaryGreen #4A7C59, lightGreen #EBF3EE, darkGreen #2E5040, accentYellow #C8A23E, dst), spacing/radius dari `theme/layout.ts`, shadow.
- `ThemeData` Material 3 + `ColorScheme.fromSeed(seedColor: primaryGreen)`. Tipografi **Manrope (heading) + Inter (body/data)** via `google_fonts`, tabular-nums untuk angka. **5 trayek** (01/02/03/05/06). Spec lengkap (komponen, screen, prompt UI) di `docs/design/sentra-mobile-design-system.md` — Phase 3 UI mengikuti dokumen itu.
- Commit.

### Task 2.6: State (Riverpod) + navigasi skeleton
**Files:** Create `lib/main.dart` (ProviderScope), `lib/app.dart`, `lib/core/router/` atau bottom-nav `Scaffold`, providers: `vehiclesProvider`, `sessionProvider` (+ secure storage), `reportHistoryProvider`.
- Bottom nav 3 tab: Beranda / Lapor / Profil (placeholder screens). Modal routes: allbus/buslane/nearby/routes (placeholder).
- **Widget test**: app build, 3 tab tampil, tap tab pindah. `flutter test`. Commit.

### Task 2.7: Background passenger telemetry
**Files:** Create `lib/features/tracking/background_tracking.dart`
- Konfigurasi `flutter_foreground_task`: mulai setelah consent aktif, stop saat logout, tampilkan foreground-service notification Android, kirim ke `/telemetry/passenger`, dan tampilkan `last sync`. iOS berjalan best-effort mengikuti batas sistem operasi; jangan menjanjikan interval absolut.
- Uji manual di device/simulator (background location sulit di-unit-test). Dokumentaslikan langkah uji. Commit.

---

## Phase 3 — UI screens (MENUNGGU REFERENSI VISUAL USER)

> **GATE:** Jangan mulai sebelum user mengirim referensi visual. Saat referensi masuk, gunakan skill `hallmark`/`impeccable` untuk menerjemahkan ke widget Flutter premium. Tiap screen: 1 task, dengan state loading (skeleton), error, empty.

Screens (paritas RN): **Home/Beranda**, **AllBusMap** (peta semua angkot, flutter_map), **NearbyAngkot**, **BusLane/Info Trayek**, **Routes**, **Report/Lapor** (form + image_picker + submit), **Profile/Profil** (login, riwayat laporan, logout).

Tiap task: bangun widget sesuai referensi → `flutter analyze` → widget test dasar → uji manual ke backend → commit.

---

## Phase P — Produksi & rilis

### Task P.1: Ikon & splash
**Files:** `flutter_launcher_icons` + `flutter_native_splash` config; aset dari brand Sentra. Generate, verifikasi build. Commit.

### Task P.2: Build per environment
- Dokumentasikan: `flutter build apk/appbundle --dart-define=API_BASE_URL=https://...`, `flutter build ipa --dart-define=...`.
- Pastikan API prod HTTPS (ATS/cleartext otomatis aman karena HTTPS). Commit.

### Task P.3: Runbook build Flutter (ganti EAS runbook)
**Files:** Create `docs/runbooks/mobile-flutter-build.md` (build appbundle/ipa, signing, upload Play/TestFlight via fastlane/manual). Tandai `mobile-eas-build.md` DEPRECATED. Commit.

### Task P.4: Verifikasi akhir
- `flutter analyze` 0 issue, `flutter test` hijau.
- Uji integrasi end-to-end ke stack lokal: tracking publik tampil, login, submit laporan+foto → muncul di dashboard operator queue, background telemetry → passenger marker di dashboard.
- Update `docs/ROADMAP.md` / `final-demo-readiness` status mobile.

---

## Urutan & catatan
1. Phase 0 (arsip) → 1 (scaffold) → 2 (infra non-visual) bisa langsung dikerjakan **tanpa** referensi visual.
2. Phase 3 (UI) **menunggu** referensi visual user.
3. Phase P paralel/akhir.
4. **YAGNI:** SOS/Safety Trip TIDAK termasuk (tetap di-defer per ROADMAP) — fokus paritas + premium UI. Maps tetap gratis (flutter_map/OSM).
5. RN app diarsipkan utuh; bisa dihidupkan kembali kapan saja dari `archive/`.

## Definition of Done
- [ ] RN diarsipkan, dokumen diperbarui.
- [ ] Flutter app scaffold, deps, permissions, bundle id beres.
- [ ] API client + model + data + tema + Riverpod + nav + background-location: `flutter test` hijau.
- [ ] (Setelah referensi) semua screen premium dibangun, paritas fitur tercapai.
- [ ] Build per-environment + ikon/splash + runbook.
- [ ] Uji integrasi e2e ke backend lulus.
