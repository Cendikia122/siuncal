# Runbook — Build & Rilis Mobile (Expo EAS)

> **DEPRECATED (2026-05-30):** Aplikasi mobile dipindah ke **Flutter** (`apps/passenger-mobile/`).
> Runbook ini hanya relevan untuk versi **React Native/Expo yang diarsipkan** di `archive/passenger-mobile-rn/`.
> Build Flutter memakai `flutter build appbundle/ipa` (runbook Flutter menyusul, lihat plan rebuild).

Untuk merilis `apps/passenger-mobile` (Expo SDK 55, RN 0.83) ke TestFlight/Play Store. Status: **belum disiapkan** (tidak ada `eas.json`/projectId). Eksekusi saat siap distribusi.

## Prasyarat (WAJIB sebelum build device nyata)

1. **API HTTPS publik.** App memakai `EXPO_PUBLIC_API_BASE_URL` (fallback `http://localhost:4000`). Build device nyata **diblokir** oleh iOS ATS & Android cleartext bila API masih HTTP. Sediakan domain HTTPS (lihat `docs/runbooks/security-hardening.md` + Caddy). Jangan akali dengan mengizinkan cleartext.
2. Akun **Apple Developer** ($99/th) + **Google Play Console** ($25 sekali).
3. `npm i -g eas-cli` lalu `eas login`. Jalankan `eas init` di `apps/passenger-mobile` (mengisi `extra.eas.projectId`).
4. Identitas app sudah ada di `app.json`: `ios.bundleIdentifier` & `android.package` = `id.sentra.passenger`.

## `eas.json`

Buat `apps/passenger-mobile/eas.json`:

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_BASE_URL": "https://staging.sentra.example.go.id" }
    },
    "preview": {
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_BASE_URL": "https://staging.sentra.example.go.id" }
    },
    "production": {
      "autoIncrement": true,
      "env": { "EXPO_PUBLIC_API_BASE_URL": "https://sentra.example.go.id" }
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "<apple-id>", "ascAppId": "<app-store-connect-id>", "appleTeamId": "<team-id>" },
      "android": { "serviceAccountKeyPath": "./play-service-account.json", "track": "internal" }
    }
  }
}
```
> `distribution` default `store` untuk profil produksi. `env` per profil mengatur `EXPO_PUBLIC_*` saat build (Context7 · eas-cli: `env` adalah map string per build profile).

## Build & submit

```sh
cd apps/passenger-mobile
# build kedua platform untuk store
eas build -p all --profile production
# submit binary terbaru ke App Store + Play Store
eas submit -p ios  --profile production --latest
eas submit -p android --profile production --latest
# atau gabung: build lalu auto-submit
eas build -p all --profile production --auto-submit
```

Verifikasi sebelum submit:
- `expo-doctor` bersih; `npm run typecheck` & `expo lint` hijau (saat ini lint 0 error, 5 warning di map/nearby — tindak lanjuti).
- App menunjuk **HTTPS** (cek `extra.apiBaseUrl`/env), bukan localhost.
- Permission strings (`NSLocationWhenInUse*`, `NSCamera*`) terisi (sudah di `app.json`).

## Catatan fitur

- Fitur live: tracking publik (peta/trayek/terdekat), lapor insiden + foto, profil.
- **SOS / Safety Trip belum diimplementasi** (permission lokasi-background & kamera sudah dideklarasi). Ini fitur keamanan pembeda — pertimbangkan sebelum rilis publik. Lihat `docs/ROADMAP.md`.
