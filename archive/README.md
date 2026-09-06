# Archive

Kode yang diarsipkan (tidak aktif, disimpan untuk referensi/riwayat).

## passenger-mobile-rn

Aplikasi passenger **React Native / Expo** (versi lama). Diarsipkan **2026-05-30**
saat aplikasi mobile dibangun ulang dengan **Flutter** (di `apps/passenger-mobile/`).

- Stack: Expo SDK 55, React Native 0.83, React 19, react-native-maps (PROVIDER_DEFAULT / Apple Maps gratis).
- Alasan arsip: pindah ke Flutter untuk UI yang lebih premium (keputusan produk). Bukan karena rusak — app ini berfungsi (tracking publik, lapor insiden+foto, passenger telemetry background; typecheck hijau).
- **Acuan rebuild:** kontrak API + data ada di sini dan menjadi sumber kebenaran:
  - `src/api.ts` — kontrak 4 endpoint backend.
  - `src/data/routes.ts`, `src/data/routePolylines.ts` (snap-to-road OSRM), `src/data/reportCategories.ts`.
  - `src/types.ts` — model (PublicVehicle, DraftReport, Session).

### Menghidupkan kembali (bila perlu)
```sh
cd archive/passenger-mobile-rn
npm install
npx expo start            # Expo Go / dev build
# atau iOS: npx expo run:ios
```

Rebuild Flutter: lihat `docs/plans/2026-05-30-flutter-passenger-app-rebuild.md` dan
`docs/design/sentra-mobile-design-system.md`.
