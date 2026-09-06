# Sentra Angkot — Design Source of Truth

Dokumen ini adalah **single source of truth** untuk semua keputusan desain visual dan interaksi aplikasi passenger Sentra Angkot (Flutter). Setiap screen, komponen, dan transisi harus merujuk ke sini.

---

## Design Principles

1. **Trustworthy, not sterile** — Setiap pixel harus menyampaikan "ini reliable." Hierarchy jelas, whitespace abundant, pacing deliberate. Bukan government-app yang membosankan, bukan consumer-app yang lebay.

2. **Green as identity, not wallpaper** — Green (`#3D7A5A`) adalah anchor visual. Gunakan **sparingly**: primary buttons, active states, accent strips. Jangan tenggelamkan screen dengan green. Biarkan white & near-white surfaces yang dominan.

3. **Depth, not flatness** — Tidak ada flat cards di atas flat gray. Gunakan layered depth: elevated cards dengan precise shadows, surfaces yang tactile.

4. **Typography as architecture** — Manrope headings harus monumental, bukan dekoratif. Kontras weight ekstrem (ExtraBold headings vs Regular body). Body text line-height 1.6.

5. **Deliberate pacing** — Setiap screen punya satu focal point. Vertical whitespace 40–64px antar section. Jangan cram.

6. **Micro-polish is trust** — Smooth transitions, subtle tap feedback, shimmer loading, spring animations. Polish = competence.

---

## Color

### Brand Palette

| Token | Hex | Usage |
|---|---|---|
| `primaryGreen` | `#3D7A5A` | Primary buttons, active states, key accents |
| `darkGreen` | `#2E5040` | Angka/data penting, header sheets |
| `navy` | `#1B3A4B` | Accent sekunder — premium替代 yellow |
| `pageBg` | `#F8F7F4` | Background halaman — warm off-white |
| `surface` | `#FFFFFF` | Cards, sheets, containers |
| `border` | `#E8E4D8` | 60% opacity — borders, dividers |
| `textPrimary` | `#1A1A1A` | Body text, headings |
| `textSecondary` | `#5A5F6B` | Secondary text, labels |
| `textMuted` | `#9CA3AF` | Placeholder, disabled |
| `danger` | `#B94A48` | Error, hapus, warning |
| `dangerLight` | `#FBE8E6` | Error banner background |

### Route (Trayek) Colors

| Route | Hex |
|---|---|
| 01 Baranangsiang–Bubulak | `#C0392B` |
| 02 Ciawi–Bubulak | `#7D3C98` |
| 03 Cilebut–Stasiun Bogor | `#27AE60` |
| 05 Stasiun–Ciparigi | `#E67E22` |
| 06 Stasiun–Parung Banteng | `#2980B9` |

### Green Usage Rules

**Jangan:**
- Green full-width card backgrounds
- Light green (`#EBF3EE`) sebagai icon circle backgrounds
- Green filled bottom nav indicator pill
- Green sebagai background section

**Gunakan:**
- Primary buttons (white text, `#3D7A5A` bg)
- Active tab indicator (underline dot, not filled pill)
- Status badges (LIVE, ONLINE)
- Skeleton/shimmer loading animation
- Left accent strip (3px) pada cards

---

## Typography

Dual-font system via Google Fonts (locally bundled).

### Font Roles

| Role | Font | Weights |
|---|---|---|
| Display / Headings | **Manrope** | 700, 800 |
| Body / Labels / Data | **Inter** | 400, 500, 600, 700 |

### Text Style Hierarchy

| Style | Font | Size | Weight | Line H | Letter-Spacing | Usage |
|---|---|---|---|---|---|---|
| `displayLarge` | Manrope | 32 | 800 | 1.2 | +0.5 | Hero greeting, angka besar |
| `displayMedium` | Manrope | 28 | 800 | 1.2 | +0.5 | Screen titles |
| `headline` | Manrope | 22 | 700 | 1.3 | +0.3 | Section headers |
| `titleLarge` | Manrope | 18 | 700 | 1.3 | +0.2 | Card titles |
| `titleMedium` | Manrope | 16 | 600 | 1.4 | +0.2 | Subheaders |
| `bodyLarge` | Inter | 15 | 400 | 1.6 | +0.2 | Primary body text |
| `bodyMedium` | Inter | 14 | 400 | 1.6 | +0.2 | Secondary body |
| `bodySmall` | Inter | 12 | 500 | 1.4 | 0 | Captions |
| `labelLarge` | Inter | 14 | 600 | 1.2 | 0 | Button labels |
| `labelSmall` | Inter | 11 | 600 | 1.2 | +0.5 | Overline, uppercase |
| `tabularFigures` | Manrope | — | — | — | — | Angka, jam, jarak — `FontFeature.tabularFigures()` |

### Typography Rules

- Headings: **ExtraBold (800) only**. Never use Regular or Light for headings — kills premium feel.
- Body text: **Regular (400)** weight. SemiBold for emphasis only.
- Semua angka, waktu, jarak, plat nomor: Manrope + tabular figures + warna `darkGreen`.
- Spacing antar paragraf: minimum 12px.
- Maksimum body text width: 640px (jika pada layar lebar).

---

## Spacing & Sizing

4-point scale.

### Spacing Tokens

| Token | px |
|---|---|
| `xs` | 4 |
| `sm` | 8 |
| `md` | 12 |
| `lg` | 16 |
| `xl` | 20 |
| `xxl` | 24 |
| `xxxl` | 32 |
| `xxxxl` | 48 |
| `screenPadding` | 20 |
| `cardGap` | 12 |
| `sectionGap` | 28 |
| `heroGap` | 40 |

### Border Radius

| Token | px | Usage |
|---|---|---|
| `card` | **12** | Cards, containers — lebih refined dari 16 |
| `sheet` | 24 | Bottom sheets top |
| `badge` | 10 | Icon containers, small elements |
| `fab` | 16 | FAB |
| `pill` | 999 | Pills, chips, search bar |

### Shadow System

| Token | Offset | Blur | Color | Usage |
|---|---|---|---|---|
| `elevationSm` | y 0.5 | 4 | `#0000000A` | Cards, small surfaces |
| `elevationMd` | y 1 | 8 | `#0000000F` | Sheets, dialogs, search bar |
| `elevationLg` | y 2 | 16 | `#00000014` | FAB, modals |

Jangan gunakan border + shadow bersamaan. Pilih salah satu.
Jangan gunakan glow, blur berlebihan, atau drop shadow yang tidak konsisten.

---

## Iconography

- **Style:** Outlined, stroke width 2px, konsisten. (Lucide atau Phosphor outline)
- **Size:** 24px (default), 20px (inline), 28px (bottom nav)
- **Color inactive:** `textSecondary` (`#5A5F6B`)
- **Color active:** `primaryGreen` (`#3D7A5A`)
- **Never** filled icons, duotone, atau multi-color (kecuali route badges)
- Route badges tetap solid sesuai warna trayek

---

## Bottom Navigation

3 tabs: **Beranda, Lapor, Profil**

- **Style:** Icon-only (28px), labels hanya visible di active tab
- **Background:** White (`#FFFFFF`), no shadow, 1px top border (`border` at 30%)
- **Active tab:** Outlined icon in `primaryGreen` + underline indicator: 20px wide, 4px height, `pill` radius, `primaryGreen` bg — positioned 4px below icon
- **Inactive tab:** Outlined icon in `textMuted` (`#9CA3AF`), no indicator
- **No** filled pill background. **No** label below inactive tabs.

---

## Components

### Primary Button
- Fill: `primaryGreen`, label: Manrope 15/700, color: white
- Height: 48px, radius: 12px
- Press: scale 0.97 + opacity 0.9
- Disabled: opacity 0.4
- Ripple: `darkGreen`

### Secondary Button
- Outline: border 1.5px `border` color
- Label: Inter 14/600, color `textPrimary`
- Height: 48px, radius: 12px
- Press: bg `#00000005`

### Ghost Button
- Label only, Inter 14/600, color `primaryGreen`
- Press: opacity 0.7

### Search Bar (Hero CTA)
- Full-width, height 52px, radius `pill` (999)
- Border: 1.5px solid `primaryGreen`
- Background: white
- Leading icon: map/search outline, `primaryGreen`
- Text: "Cari trayek atau jurusan...", Inter 15/400, `textMuted`
- Shadow: `elevationMd`

### Card
- Background: `surface` white
- Radius: 12px
- Padding: 16px
- Shadow: `elevationSm` ATAU border 1px `border` at 60%
- Optional: 3px left accent strip (untuk cards yang perlu penekanan)
- Never border + shadow simultaneously

### Quick Action Pill
- Outlined: border 1.5px `border`, bg white
- Pressed: bg `primaryGreen` at 8% opacity
- Radius: `pill` (999)
- Height: 72px, width: 80px
- Icon 24px `primaryGreen` (atas), label Inter 11/500 `textSecondary` (bawah)
- Horizontal scroll row, 4 items

### Route Badge
- Square, radius 10px
- Background: route color (solid)
- Text: Manrope 16/800, white
- Size: 36x36

### Vehicle Chip
- Pill shape, border 1px `border`
- Icon bus + plat number
- Selected: border `primaryGreen`, bg `primaryGreen` at 6%

### Angkot Marker (Map)
- Circle 28px, route color bg, white bus icon
- User location: blue dot + accuracy halo (40% opacity)

### Empty State
- Icon: outlined 48px, `textMuted`
- Title: headline 20/700
- Body: bodyLarge 15/400, `textSecondary`
- Optional: 1 CTA button (secondary style)

### Skeleton / Loading
- Blok shimmer, radius 12px
- Color: `#E8E4D8` base, white shimmer sweep
- **No centered spinners** (kecuali untuk full-page loading)

### Error Banner
- Background: `dangerLight`
- Text: Inter 13/500, `danger`
- Icon: danger outline 16px
- Dismissible, atau "Coba lagi" action

### Bottom Sheet
- `DraggableScrollableSheet`
- Top radius: 24px
- Handle: 36px wide, 4px tall, `border` color
- Drag threshold: 60% to dismiss
- Spring animation

---

## Screen Specs

### 1. Home / Beranda

**Layout (top to bottom):**

1. **App Bar**
   - Minimal: teks "Sentra" di Manrope 20/800, `primaryGreen`
   - Right: notification bell icon, 24px, outlined, red badge dot (3px) jika ada notif
   - No shadow, no divider

2. **Hero Greeting**
   - Single line: "Mau ke mana?" — `displayLarge` (Manrope 32/800)
   - Padding top: 8px
   - No subtitle

3. **Search Bar (Primary CTA)**
   - Full-width search bar, pill shape, green border
   - Leading icon: search/map outline
   - Placeholder: "Cari trayek atau jurusan..."

4. **Quick Actions (4 items)**
   - Horizontal scroll row: All Angkot, Trayek Info, Nearby Angkot, Report
   - Each: pill-shaped (72x80), outlined style, icon + label
   - Tap → navigate ke respective screen

5. **Live Feed Card**
   - White card, 3px `primaryGreen` left border, radius 12px
   - Header row: "Langsung" + pulsing green dot (animasi opacity 1.0→0.4→1.0, 2s cycle)
   - Body: nearest active angkot info — trayek name, plat, ETA (haversine, label "estimasi")
   - Empty state: "Belum ada angkot aktif"

6. **Info Links** (minimal)
   - 2 rows: "Cara pakai" + chevron, "Bantuan & FAQ" + chevron
   - Inter 14/500 `textPrimary`, icon chevron `textMuted`
   - No big guide cards

**Tidak ada:**
- Green banner full-width
- Light green icon containers
- Grid 4 shortcut cards (ganti dengan pill row)

---

### 2. All Angkot (Map)

**Layout:**

1. **Map** — `flutter_map` OSM full screen
   - 5 polyline trayek (warna trayek, 3px stroke)
   - Marker semua angkot aktif (`/public/vehicles`)
   - User location marker

2. **Overlay bar** (top)
   - Back button + "Angkot" title
   - Badge "Live" (green pill) atau "Data contoh" (gray pill)
   - Minimal, transparan bg

3. **FABs** (bottom-right, stacked)
   - Current location (target icon)
   - Refresh

4. **Tap marker** → mini-card bottom sheet
   - Plat number (tabular, darkGreen)
   - Trayek name + route badge
   - "Terakhir X menit lalu"
   - Tap → detail

**Tidak ada:**
- Search bar di map
- Daftar list di atas map

---

### 3. Trayek Info

**Layout:**

1. **Header** — "Trayek Angkot Bogor" + subtitle "5 trayek aktif"
2. **List** — 5 cards, masing-masing:
   - Route badge (kiri)
   - Nama trayek: "Baranangsiang › Bubulak"
   - Jam operasional (bodySmall, textSecondary)
   - Tap → Detail Trayek
   - 3px left color rail (warna trayek)

---

### 4. Detail Trayek

**Layout:**

1. **Map** (top 40%) — polyline trayek terpilih, marker
2. **Bottom sheet** (DraggableScrollableSheet):
   - Header: "TRAYEK 01" + jam operasional, bg `darkGreen` text white
   - Card asal→tujuan + swap direction icon
   - Vehicle chips horizontal scroll (plat aktif; tap → highlight marker di map)
   - Timeline: vertical line + dots (navy) + halte names dari `stops`

---

### 5. Nearby Angkot

**Layout:**

1. **Map** (top 50%) — user location + angkot markers
2. **Bottom sheet** — list angkot terdekat, sorted haversine:
   - Route badge + estimasi "X menit" (label "estimasi" kecil)
   - Plat + "→ tujuan" + "update X menit lalu"
3. **Empty states:**
   - No location permission: "Aktifkan lokasi untuk melihat angkot terdekat"
   - No nearby angkot: "Belum ada angkot terdekat"

---

### 6. Report / Lapor

**Layout:**

1. **Form:**
   - 5 category pills (Ngetem, Berkendara Bahaya, Keamanan, Pelayanan Buruk, Lainnya)
   - Plate number input
   - Deskripsi textarea
   - GPS otomatis (read-only, ditampilkan)
   - Photo attachment (wajib, `image_picker`)
   - Submit button
2. **If not logged in:** overlay "Login untuk melapor" → redirect ke Login
3. **After submit:** confirmation + report history list

---

### 7. Profile / Profil

**Layout:**

**If guest (Tamu):**
- Icon person large (outlined 64px)
- "Masuk untuk melacak laporan"
- "Login" button (primary style)

**If logged in:**
- Nama lengkap (headline)
- Email (bodySmall)
- Report history list (status badge + category + date)
- Location sharing toggle
- Logout button (ghost style, `danger`)

---

## Animations & Micro-interactions

| Element | Animation | Duration |
|---|---|---|
| Page transition (tab switch) | Shared-axis: horizontal slide, 16px offset | 250ms easeOut |
| Card entrance | Vertical stagger, 50ms delay antar card, slide up 12px + fade | 300ms easeOut |
| Skeleton shimmer | Gradient sweep kiri→kanan | 1.5s infinite |
| Bottom sheet | Spring (gravity: 0.8, damping: 0.9) | 300ms |
| Button press | Scale 0.97 + opacity 0.9 | 100ms |
| Green dot (LIVE) | Pulse opacity 1.0 → 0.4 → 1.0 | 2s infinite |
| FAB press | Scale 0.92 + subtle rotation | 150ms |
| Search bar focus | Border color `primaryGreen`, shadow `elevationMd` | 200ms |
| Marker tap | Scale up 1.1 → 1.0 + color shift | 150ms |
| Route badge press | Scale 0.95 | 100ms |

### Haptic Feedback

- Button taps: `HapticFeedback.lightImpact()`
- Successful submit: `HapticFeedback.mediumImpact()`
- Error: `HapticFeedback.heavyImpact()`

---

## Navigation & UX Flow

```
Home
├── Search bar → All Angkot (filtered)
├── All Angkot → marker tap → mini-card → Detail Trayek
├── Trayek Info → tap → Detail Trayek
├── Nearby Angkot
├── Report → (if guest) Login → form → submit
└── Notification bell → (future)

Bottom Nav:
  Beranda (default)
  Lapor → Report screen
  Profil → Profile / Login
```

### Transition Rules

- **Tab switches** (bottom nav): shared-axis horizontal slide
- **Push screens** (list → detail): shared-axis vertical (slide up)
- **Modals / sheets**: spring bottom sheet
- **Alert / confirmation**: fade dialog with scale backdrop

---

## Do's and Don'ts

| ✅ Do | ❌ Don't |
|---|---|
| White space yang lega | Cramming informasi |
| Green sebagai accent sparingly | Green sebagai background card |
| 12px card radius | 16px card radius (terlalu bulat) |
| Outlined icons | Filled icons |
| Skeleton shimmer | Centered spinner |
| Warm off-white bg (`#F8F7F4`) | Flat gray bg (`#F4F4F4`) |
| Navy sebagai accent sekunder | Yellow sebagai accent |
| 3 shadow levels | 1 shadow fits all |
| Bottom sheet spring | Bottom sheet linear |
| Tab underline indicator | Tab filled pill |

---

## Technical Implementation Notes

- Semua warna, spacing, radius, shadow sebagai constants di Flutter (`AppColors`, `AppSpacing`, `AppRadius`, `AppShadows`)
- Typography via `TextTheme` extension
- Animations via `AnimationController` atau implicit animations (`AnimatedContainer`, `AnimatedOpacity`, etc.)
- Theme: Material 3 (`useMaterial3: true`), `ColorScheme.fromSeed(seedColor: AppColors.primaryGreen)`
- Scaffold background: `AppColors.pageBg`
- Splash: `InkSparkle.splashFactory`
