# Design Direction Prompt — Sentra Angkot Passenger Mobile App

## Context

Civic-tech app untuk tracking angkot di Bogor. Target user: commuters harian (mahasiswa, pekerja, lansia). Current design terlalu generic "card-on-gray" — feels like AI slop, no trust signals, no soul.

Target feel: **Premium & Trustworthy** — think DBS digibank meets Singapore's MyTransport.sg. Authoritative yet warm, clean yet characterful. Bukan government-app yang membosankan, bukan juga consumer-app yang lebay.

## Design Principles

1. **Trustworthy, not sterile** — Setiap pixel harus bilang "ini reliable". Hierarchy jelas, whitespace abundant, pacing deliberate.
2. **Green as identity, not wallpaper** — Sage green (#4A7C59) adalah anchor. Jangan tenggelamkan screen pake green. Pake sparingly untuk actions, active states, meaningful accents. Biarkan white & near-white surfaces yang dominan.
3. **Depth, not flatness** — No more flat cards on flat gray. Subtle layered depth: elevated cards dengan precise shadows, surfaces yang tactile.
4. **Typography as architecture** — Manrope headings harus monumental, bukan dekoratif. Extreme weight contrast (ExtraBold headings vs Regular body) untuk scannable hierarchy. Body text line-height 1.6+.
5. **Deliberate pacing** — Setiap screen harus punya clear focal point. Vertical whitespace 40-64px antar section. Jangan cram. Biarkan user bernapas.
6. **Micro-polish** — Smooth page transitions, subtle tap feedback, skeleton loading dengan green shimmer, bottom sheets spring animation, haptic feedback di key actions.

## Palette Adjustments

| Token | Current | New | Notes |
|---|---|---|---|
| Background | `#F4F4F4` | `#F8F7F4` | Warm off-white, kayak premium paper stock |
| Surface (cards) | `#FFFFFF` | `#FFFFFF` | Keep, refined shadow |
| Primary green | `#4A7C59` | `#3D7A5A` | Shift 5% ke teal biar lebih modern |
| Dark green | `#2E5040` | `#2E5040` | Keep untuk text/data |
| Light green | `#EBF3EE` | — | Hapus sebagai background icon. Ganti minimal |
| Accent yellow | `#C8A23E` | `#1B3A4B` (navy) | Navy sebagai accent sekunder — lebih premium |
| Danger | `#B94A48` | `#B94A48` | Keep |
| Text primary | `#1A1A1A` | `#1A1A1A` | Keep |
| Text secondary | `#6C7280` | `#5A5F6B` | Sedikit lebih gelap untuk readability |
| Border | `#E5E0D4` | `#E8E4D8` at 60% | Lebih subtle |

## Shadow System

- `elevation-sm`: 0.5px offset, blur 4, color `#0000000A`
- `elevation-md`: 1px offset, blur 8, color `#0000000F`
- `elevation-lg`: 2px offset, blur 16, color `#00000014`

## Typography Refinement

- Display/Headings: Manrope, letter-spacing +0.5~1px (premium feel)
- Body: Inter 15px, line-height 1.6, letter-spacing 0.2px
- Numbers/data: Manrope with tabular figures, warna dark green `#2E5040`
- Stat/ticker: Manrope ExtraBold 32px, leading 1.1 — buat key numbers (wait time, distance)

## Iconography

- **Outlined style** konsisten — Lucide atau Phosphor outline, stroke 2px, size 24px
- Inactive: `#5A5F6B`, Active: `#3D7A5A`
- Never filled icons except bottom nav active tab

## Bottom Navigation

- Active tab: outlined icon + green underline indicator (4px height, 20px width, rounded) di bawah icon
- Inactive tab: outlined icon di `#9CA3AF`, no indicator
- Hapus filled green indicator pill background — terlalu loud
- Labels: muncul di active tab aja, atau hidden semua (icon-only 28px)

## Home Screen Layout (Key Screen)

**App Bar:**
- Minimal — cuma "Sentra" di Manrope ExtraBold, green `#3D7A5A`
- Notification bell icon with red badge dot (kanan)

**Greeting:**
- Single line "Mau ke mana?" di `displayMedium` (32px Manrope ExtraBold)
- No subtitle — less text = more impact

**Primary CTA:**
- "Cari Angkot" search bar — green border (`#3D7A5A`), prefix icon (search/map), hint text "Cari trayek atau jurusan..."
- Ini hero action, harus visible pertama

**Quick Actions (4 items):**
- All Angkot, Trayek Info, Nearby Angkot, Report
- **Pill-shaped buttons** horizontal row (bukan stacked cards)
- Outlined style: white bg, green border 1.5px, green icon, label below
- Press state: subtle green fill (`#3D7A5A` at 8% opacity)
- Harus terasa seperti quick-access tools, bukan marketing cards

**Live Feed Section:**
- White card dengan 3px green left border (`#3D7A5A`)
- Header: "Langsung" dengan pulsing green dot (animasi)
- Body: nearest angkot info — trayek name, ETA, destination
- Ini **pengganti** green banner — jangan ada green full-width card

**Info Section (minimal):**
- "Cara pakai" — text row with chevron
- "Bantuan" — text row with chevron
- No big guide cards — terlalu berat secara visual

## Animations & Transitions

- Page transitions: shared-axis (horizontal slide untuk tab switch)
- Cards: subtle vertical stagger entrance, 50ms delay antar card
- Loading: green shimmer skeleton, gradient pulse
- Bottom sheet: spring animation, 60% drag to dismiss
- Buttons: press scale 0.97 + opacity 0.9
- Green dot (LIVE): slow pulse opacity 1.0 → 0.4, duration 2s

## Green Usage Rules (JANGAN)

| ❌ Jangan | ✅ Ganti dengan |
|---|---|
| Green full-width card backgrounds | White card + green accent strip/border |
| Light green (`#EBF3EE`) icon circles | White icon container + green border |
| Green filled bottom nav indicator | Green underline dot/line |
| Green sebagai background section | Green sebagai accent/sparing |

---

## Implementation Priority

1. Theme/color/token updates di Flutter (`AppColors`, `AppTheme`)
2. Shadow system constants
3. Bottom navigation bar redesign
4. Home screen restructure (layout, quick actions, search bar)
5. Animations & transitions
6. Typography scale refinement
7. Icon swap ke outlined style
