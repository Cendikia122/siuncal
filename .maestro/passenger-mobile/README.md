# Maestro Flows — Sentra Passenger Mobile

Automated smoke tests untuk Flutter passenger app (`apps/passenger-mobile`).

## Prasyarat

1. Maestro sudah terinstall dan tersedia di PATH. Jika OpenJDK dipasang via Homebrew `openjdk@17`, aktifkan Java + Maestro CLI:
   ```sh
   export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
   export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"
   maestro --version
   ```
2. iPhone Simulator atau Android Emulator sudah berjalan.
3. App sudah ter-install ke simulator/emulator. Untuk iPhone Simulator:
   ```sh
   cd apps/passenger-mobile
   flutter run -d <ios-simulator-id> --dart-define=API_BASE_URL=http://localhost:4000
   ```

## Jalankan semua baseline flow

Dari root project:

```sh
maestro test .maestro/passenger-mobile
```

Catatan: flow full E2E backend/mobile berada di folder terpisah `.maestro/passenger-mobile-e2e` karena membutuhkan backend lokal, akun seed, lokasi simulator, dan media foto.

## Jalankan per flow

```sh
maestro test .maestro/passenger-mobile/smoke_home.yaml
maestro test .maestro/passenger-mobile/smoke_navigation.yaml
maestro test .maestro/passenger-mobile/routes.yaml
```

## Scope saat ini

Flow baseline ini sengaja tidak membutuhkan backend, login, lokasi, atau foto picker:

- `smoke_home.yaml`: app launch dan home content.
- `smoke_navigation.yaml`: bottom navigation Beranda/Lapor/Profil dan login gates.
- `routes.yaml`: buka informasi trayek dari home dan cek 5 trayek.

## Next flow yang direkomendasikan

Setelah baseline stabil:

1. `auth_login.yaml` — login mobile memakai akun test non-production.
2. `report_submit.yaml` — submit laporan dengan backend lokal.
3. `tracking_consent.yaml` — consent passenger tracking.
4. `nearby_location.yaml` — nearby angkot dengan mocked/simulator location.

Jangan simpan password/secret di file Maestro. Gunakan env var Maestro atau input runtime untuk credential test.
