# Sentra Angkot — Mobile Design System & Build Brief (Flutter)

Dokumen acuan tunggal untuk membangun UI aplikasi passenger **Sentra Angkot** (Flutter),
mengadaptasi gaya **BISKITA Trans Pakuan** tanpa menjiplak. Bisa diserahkan langsung ke
AI agent / engineer. Backend tidak berubah; mobile hanya konsumen API.

## Keputusan terkunci
- Framework **Flutter** · state **Riverpod** · peta **flutter_map + OpenStreetMap (gratis, tanpa API key)** ·
  HTTP **Dio** · GPS **geolocator** + background **flutter_background_geolocation** · foto **image_picker** ·
  token **flutter_secure_storage**.
- Bundle id **id.sentra.passenger** · platform iOS + Android · base URL via `--dart-define=API_BASE_URL`.
- **5 trayek** ditampilkan: 01 Baranangsiang→Bubulak, 02 Ciawi→Bubulak, 03 Cilebut→Stasiun Bogor,
  05 Stasiun→Ciparigi, 06 Stasiun→Parung Banteng. (UI baca dari data; simulator demo backend menjalankan 01/02/03.)
- Font: **Manrope** (display/heading) + **Inter** (body/data/angka) via `google_fonts`.
- **Out-of-scope:** SOS/panic, Safety Trip eksplisit, AR Shelter, Google Maps. Snap-to-road TIDAK di device
  (pakai polyline trayek statis hasil OSRM pre-fetch). Estimasi nearby = haversine, dilabeli "estimasi".

## Sumber kebenaran (port dari RN arsip)
`archive/passenger-mobile-rn/src/`: `data/routes.ts` (5 trayek: nama/destination/warna/jam/headway/stops),
`data/routePolylines.ts` (~1.475 titik snap-to-road, key 01/02/03/05/06), `data/reportCategories.ts`
(5 kategori), `types.ts` (PublicVehicle, DraftReport, Session), `api.ts` (kontrak 4 endpoint).

## Kontrak API (dev http://localhost:4000)
- `GET /public/vehicles` → `{vehicles:[{vehicle_id,plate_no,route_name,latest_lat,latest_lon,status,last_seen_at}]}` (cache + Cache-Control).
- `POST /auth/mobile/login {email,password}` → `{access_token,passenger_tracking_token,passenger_tracking_session_id,user{full_name,email}}`.
- `POST /public/reports` (Bearer) multipart: `plate_no,category,description,lat,lon,reported_at,accuracy_m?,attachments[]` → 201 `{public_report_id,status,plate_match_status}`.
- `POST /telemetry/passenger` (header `X-Passenger-Tracking-Token`) `{session_id,lat,lon,accuracy?,timestamp,app_state}`.
- Akun demo: `warga@sentra.id` / `password123`.

---

## 1. Design System

**Color** — primary `#4A7C59`, light `#EBF3EE`, dark `#2E5040`, accent `#C8A23E`, pageBg `#F4F4F4`,
surface `#FFFFFF`, text `#1A1A1A` / `#6C7280` / `#9CA3AF`, danger `#B94A48`, border `#E5E0D4`.
**Warna trayek** (polyline + badge): 01 `#C0392B`, 02 `#7D3C98`, 03 `#27AE60`, 05 `#E67E22`, 06 `#2980B9`.
`ColorScheme.fromSeed(seedColor: #4A7C59)`, Material 3.

**Typography** (google_fonts) —
- Display/H1: Manrope 28/800 · H2: Manrope 20/700 · Title: Manrope 16/600.
- Body: Inter 14/400 (lh 1.4) · Caption: Inter 12/500 · Overline: Inter 10/700 UPPER, spacing 0.8.
- Angka/jam/jarak: Inter `fontFeatures: tabular figures`.

**Spacing** 4pt: 4/8/12/16/20/24/32 · screen padding 16–20 · card gap 12 · section gap 24.
**Radius** card 16 · sheet-top 24 · pill/chip 999 · badge 12 · FAB 16.
**Shadow** satu level: `#000 @0.06, blur 12, offset y4` (jangan glow, jangan dobel border+shadow).

**Komponen**
- **PrimaryButton** filled hijau h48 r14 label Manrope 15/700 (ripple darkGreen); Secondary outline `#E5E0D4`; Ghost teks hijau.
- **SentraCard** surface r16 pad14–16, hairline `#E5E0D4` ATAU shadow halus.
- **RouteBadge** kotak r12 warna-trayek, nomor putih 18/800.
- **VehicleChip** surface pill, ikon bus + plat; selected = fill lightGreen + border primary.
- **AngkotMarker** lingkaran 28 warna-trayek + ikon bus putih; user-location dot biru + halo akurasi.
- **EmptyState** ikon line 48 muted + judul 16/700 + body 14 + 1 CTA.
- **Skeleton** shimmer blok r12 (bukan spinner tengah); map loading = overlay "memuat posisi…".
- **Error** banner danger-light + "Coba lagi".
- **BottomSheet** `DraggableScrollableSheet` rounded-top 24 + handle 36×4; header darkGreen pada Detail Trayek.

---

## 2. Screen Specs

**Home/Beranda** — header (logo+nama Sentra, chip user/Tamu) · greeting "Halo, mau naik angkot ke mana hari ini?" + subtext "Lihat posisi angkot, cek trayek, dan laporkan kejadian langsung dari aplikasi." · grid 4 shortcut [All Angkot, Angkot Trayek Info, Nearby Angkot, Report] · banner hijau "Pantau Angkot Real-time" · list "Quick Info & Guide" [Cara menggunakan, Laporkan kejadian, Informasi trayek, Bantuan & FAQ] · bottom nav [Beranda, Lapor, Profil].

**All Angkot** — `flutter_map` OSM full · 5 polyline trayek (warna-trayek) · marker semua angkot aktif (`/public/vehicles`) · FAB back / current-location / refresh · badge "Live" atau "Data contoh — koneksi server tidak tersedia" · tap marker → mini-card (plat, trayek, last seen).

**Angkot Trayek Info** — header "Angkot Trayek Info" · card "Trayek Angkot Bogor" · list card 5 trayek: RouteBadge + "Asal › Tujuan" + jam operasional + color-rail kiri 4px · tap → Detail Trayek.

**Detail Trayek** — peta atas (hanya polyline+marker trayek terpilih) · DraggableScrollableSheet: header darkGreen (jam + "TRAYEK 0X") · card asal→tujuan + swap arah · chip kendaraan horizontal (plat aktif; tap → highlight marker) · scroll → timeline halte (titik `#C8A23E`, garis tipis, dari `stops`).

**Nearby Angkot** — peta (lokasi user + angkot sekitar) · bottom sheet list: RouteBadge + estimasi menit (haversine, label "estimasi") + plat + "→ tujuan" + "update X lalu" · empty: "Aktifkan lokasi untuk melihat angkot terdekat." / "Belum ada angkot terdekat di sekitar lokasi kamu."

**Report/Lapor** — form: 5 kategori-chip (Ngetem, Berkendara Bahaya, Keamanan, Pelayanan Buruk, Lainnya) + plat + deskripsi + GPS otomatis + foto wajib (image_picker) · butuh login (Tamu → login dulu) · submit `/public/reports` → status + riwayat.

**Profile/Profil** — Tamu: tombol Login. Login: nama + riwayat laporan (status) + info berbagi lokasi (background tracking) + Logout.

## 3. UX Flow
Home→AllAngkot (load vehicles, skeleton→data, gagal→fallback berlabel, tap marker→mini-card) ·
Home→TrayekInfo (list statis→tap→DetailTrayek) · TrayekInfo→DetailTrayek (filter by route, hanya polyline itu, sheet chip+timeline, tap chip→highlight) ·
Home→Nearby (izin lokasi→GPS→sort haversine→list; tanpa izin/hasil→empty) ·
Home→Report (Tamu→login→form→GPS+foto→submit→konfirmasi+riwayat).

## 4. Flutter struktur (feature-first)
`lib/{main,app}.dart` · `core/{config/app_config, api/api_client, theme/*, widgets/*}` ·
`features/{vehicles,routes,map,nearby,report,auth,tracking,home,profile}/...`
Providers: vehiclesProvider (FutureProvider.autoDispose+polling+fallback flag), routesProvider (static),
selectedRouteProvider, nearbyProvider (geolocator+haversine sort), sessionProvider (StateNotifier+secure storage),
reportSubmitProvider, reportHistoryProvider, locationPermissionProvider.
Tiap layar data: `AsyncValue.when(data/loading→skeleton/error→banner)`; empty-state khusus.
flutter_map: TileLayer OSM (`tile.openstreetmap.org/{z}/{x}/{y}.png`, userAgent `id.sentra.passenger`),
PolylineLayer (route_polylines + route_colors), MarkerLayer; center BOGOR_CENTER (-6.5951,106.7980).
Fallback: `/public/vehicles` gagal → fallbackVehicles + `usingFallback=true` → label "Data contoh".

## 5. Prompt final untuk generate UI
> Desain UI Flutter "Sentra Angkot" (warga Bogor: posisi angkot real-time, info trayek, angkot terdekat,
> lapor kejadian). Adaptasi gaya BISKITA Trans Pakuan (layout, card, bottom-sheet, timeline, chip kendaraan)
> TANPA menjiplak, TANPA ungu. Hijau civic: primary #4A7C59, light #EBF3EE, dark #2E5040, accent #C8A23E,
> bg #F4F4F4, surface #FFF, text #1A1A1A/#6C7280, border #E5E0D4, danger #B94A48. Material 3, font Manrope
> (heading) + Inter (body), radius 16–24, shadow halus, premium & clean (bukan template default). 5 trayek
> (01 merah, 02 ungu-tua, 03 hijau, 05 oranye, 06 biru). 7 screen: Home (greeting + grid 4 shortcut [All
> Angkot, Angkot Trayek Info, Nearby Angkot, Report] + banner real-time + Quick Info & Guide + bottom nav
> Beranda/Lapor/Profil); All Angkot (peta OSM full, polyline per trayek, marker angkot, FAB back/locate/refresh,
> badge Live atau "Data contoh — koneksi server tidak tersedia"); Angkot Trayek Info (list card: badge nomor +
> Asal›Tujuan + jam + color-rail); Detail Trayek (peta trayek terpilih + bottom-sheet header darkGreen, card
> asal→tujuan+swap, chip kendaraan horizontal pakai plat, timeline halte titik #C8A23E); Nearby Angkot (peta
> lokasi user + bottom-sheet list angkot terdekat: badge trayek, estimasi menit, plat, →tujuan, last update;
> empty-state izin lokasi / tidak ada angkot); Report (form 5 kategori + plat + deskripsi + GPS + foto wajib,
> butuh login); Profile (login/riwayat/logout). Sertakan loading skeleton, empty, error tiap layar. JANGAN SOS,
> JANGAN Google Maps, JANGAN AR Shelter. Map gratis OSM via flutter_map. Kode kendaraan = plat (mis. "F 1901 AK").
> Jelaskan setiap asumsi.

## Catatan / asumsi yang harus dikonfirmasi saat implementasi
- Estimasi waktu nearby = haversine (bukan ETA rute). ETA berbasis jalur = out-of-scope (butuh data tambahan).
- `route_name` dari API mungkin tak persis "01".."06"; pakai `findRouteForVehicle()` (port dari routes.ts) untuk mencocokkan vehicle→trayek.
- App Flutter belum di-scaffold; eksekusi mengikuti `docs/plans/2026-05-30-flutter-passenger-app-rebuild.md` (arsip RN → scaffold → infra → screen sesuai dokumen ini).
