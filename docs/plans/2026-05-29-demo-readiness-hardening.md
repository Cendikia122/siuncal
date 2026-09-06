# Sentra Angkot — Demo Readiness Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Matangkan Sentra Angkot (Phase 1–16) agar benar-benar siap demo lomba 8 Juni 2026 — mengamankan kerja yang belum di-commit, menutup schema-drift, memperbaiki temuan UI/UX (kontras WCAG, konsistensi token, dead code), dan menyiapkan dokumentasi + framing jujur untuk juri.

**Architecture:** Tiga workstream paralel-aman: (A) Hardening kesiapan demo, (B) Perbaikan UI/UX dari audit Hal lmark+Impeccable, (C) Dokumentasi & framing. Phase 17 (Social Media Intelligence) **di-drop dari scope** dan didokumentasikan sebagai roadmap Tahap 3. Tidak menambah fitur baru.

**Tech Stack:** Next.js 16 + React 19 + Tailwind 4 (operator-web), Node/Express (api-gateway), PostgreSQL+PostGIS, Redis, MinIO, Docker Compose.

**Konvensi verifikasi:** Karena belum ada test suite, verifikasi tiap task pakai: `npm run lint` / `npm run build` (operator-web), `docker compose ... config --quiet`, `curl` ke endpoint, atau inspeksi visual screenshot. Commit sering, satu task = satu commit.

**Prasyarat sebelum mulai:** Pastikan branch kerja bersih dari kebingungan — saat ini di branch `production` dengan banyak perubahan working tree yang BELUM di-commit. Task A1 mengamankan ini lebih dulu.

---

## Workstream A — Hardening Kesiapan Demo

### Task A1: Amankan & commit working tree yang ada

**Files:**
- Commit: semua perubahan working tree saat ini (lihat `git status`)

**Step 1: Tinjau perubahan**

Run: `git status && git diff --stat`
Expected: melihat `M` pada README, incidents/[id], vehicles/[id], .env.example, docker-compose.yml, 001_bootstrap.sql, public-report-review.js, server.js, telemetry config/simulator; `D middleware.ts`; `??` proxy.ts, 004_restore_geofences.sql, docs/qa/*.

**Step 2: Tinjau isi perubahan kunci sebelum commit**

Run: `git diff apps/operator-web/src/middleware.ts apps/operator-web/src/proxy.ts services/api-gateway/src/server.js`
Konfirmasi migrasi `middleware.ts` → `proxy.ts` (Next 16) benar dan tidak ada secret ter-hardcode di server.js.

**Step 3: Commit secara logis terpisah**

```bash
git add apps/operator-web/src/proxy.ts apps/operator-web/src/middleware.ts
git commit -m "refactor(web): migrate edge middleware to proxy.ts (Next 16)"

git add db/seeds/004_restore_geofences.sql infra/docker-compose/docker-compose.yml infra/docker-compose/.env.example infra/docker-compose/initdb/001_bootstrap.sql
git commit -m "fix(infra): restore geofences seed + simulator profile env"

git add services/
git commit -m "chore(services): telemetry token + public report review hardening"

git add docs/ README.md apps/operator-web/src/app/dashboard
git commit -m "docs(qa): final demo readiness evidence + minor UI tweaks"
```

**Step 4: Verifikasi tree bersih**

Run: `git status`
Expected: `nothing to commit, working tree clean` (kecuali `.claude/worktrees/` yang boleh di-gitignore).

---

### Task A2: Tambahkan startup schema-check di api-gateway

Mencegah endpoint diam-diam 500 saat volume Postgres lama kehilangan migration (BUG-003 di QA report: `heatmap_data does not exist`).

**Files:**
- Modify: `services/api-gateway/src/server.js` (dekat blok startup/listen)

**Step 1: Tulis fungsi cek tabel kritis**

Tambahkan sebelum `app.listen(...)`:

```javascript
async function assertSchemaReady() {
  const required = [
    "vehicle_positions", "vehicle_latest", "telemetry_matched_positions",
    "incidents", "public_reports", "public_report_reviews",
    "sanctions", "heatmap_data", "geofences",
  ];
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [required]
  );
  const present = new Set(rows.map((r) => r.table_name));
  const missing = required.filter((t) => !present.has(t));
  if (missing.length) {
    console.error(`[schema] FATAL: missing tables: ${missing.join(", ")}. ` +
      `Apply pending migrations (014, 015) + seed 004.`);
    process.exit(1);
  }
  console.log("[schema] all required tables present");
}
```

Panggil di startup: `await assertSchemaReady();` sebelum `app.listen`.

**Step 2: Verifikasi gagal-keras saat tabel hilang**

Run (lingkungan disposable): drop tabel `heatmap_data` di volume test, lalu start api-gateway.
Expected: log `[schema] FATAL: missing tables: heatmap_data` dan exit code 1 (bukan 200 lalu 500 saat request).

**Step 3: Verifikasi lolos saat schema lengkap**

Run: `docker compose -f infra/docker-compose/docker-compose.yml up -d --build api-gateway && docker compose ... logs api-gateway | grep schema`
Expected: `[schema] all required tables present`.

**Step 4: Commit**

```bash
git add services/api-gateway/src/server.js
git commit -m "feat(api): fail-fast schema check for required tables on startup"
```

---

### Task A3: Smoke test minimal endpoint kritis

Memberi bukti kredibel "tervalidasi" tanpa test suite penuh. Pakai Node built-in test runner (sudah dipakai `npm test`).

**Files:**
- Create: `services/api-gateway/test/smoke.test.js`

**Step 1: Tulis smoke test**

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:4000";

test("health returns ok", async () => {
  const res = await fetch(`${BASE}/health`);
  assert.equal(res.status, 200);
});

test("protected endpoint rejects unauthenticated", async () => {
  const res = await fetch(`${BASE}/dashboard/summary`);
  assert.equal(res.status, 401);
});

test("public vehicles endpoint is reachable", async () => {
  const res = await fetch(`${BASE}/public/vehicles`);
  assert.ok([200, 429].includes(res.status)); // 429 jika rate-limited
});
```

**Step 2: Jalankan saat stack hidup**

Run: `docker compose ... up -d && SMOKE_BASE_URL=http://localhost:4000 node --test services/api-gateway/test/`
Expected: 3 test PASS.

**Step 3: Commit**

```bash
git add services/api-gateway/test/smoke.test.js
git commit -m "test(api): add smoke tests for health, auth, public endpoints"
```

---

## Workstream B — Perbaikan UI/UX (dari audit Hallmark + Impeccable)

> Catatan: jalankan `npm run lint` setelah tiap task UI. Bila stack hidup, ambil ulang screenshot ke `docs/qa/evidence/` untuk bukti before/after.

### Task B1: Perbaiki 4 kontras `gray-on-color` (WCAG AA)

**Files (dari detektor impeccable):**
- Modify: `apps/operator-web/src/app/dashboard/intelligence/page.tsx:170`
- Modify: `apps/operator-web/src/app/dashboard/network/page.tsx:104`
- Modify: `apps/operator-web/src/app/dashboard/owners/[id]/page.tsx:437`
- Modify: `apps/operator-web/src/app/dashboard/page.tsx:755`

**Step 1: Lihat tiap lokasi**

Run: `grep -n "text-zinc-400\|text-zinc-500" apps/operator-web/src/app/dashboard/intelligence/page.tsx apps/operator-web/src/app/dashboard/network/page.tsx apps/operator-web/src/app/dashboard/owners/\[id\]/page.tsx apps/operator-web/src/app/dashboard/page.tsx`

**Step 2: Ganti teks abu di atas bg berwarna**

Untuk `text-zinc-400/500` di atas `bg-red-500`/`bg-emerald-500`: ganti ke `text-white` (atau `text-zinc-50`). Pertahankan teks abu HANYA di atas surface gelap netral.

**Step 3: Verifikasi**

Run: `cd apps/operator-web && npm run lint`
Expected: lint pass. Lalu `npx impeccable --json apps/operator-web/src/app/dashboard` → 0 temuan `gray-on-color`.

**Step 4: Commit**

```bash
git add apps/operator-web/src/app/dashboard
git commit -m "fix(ui): correct gray-on-color contrast for WCAG AA (4 locations)"
```

---

### Task B2: Samakan kosakata token warna (konsistensi)

Halaman `sanctions` hardcode `bg-zinc-900 border-white/10`; halaman lain pakai token semantik (`bg-secondary`, `border-input`, `bg-card`). Samakan.

**Files:**
- Modify: `apps/operator-web/src/app/dashboard/sanctions/page.tsx`
- Reference: `apps/operator-web/src/app/dashboard/owners/page.tsx` (contoh pemakaian token yang benar)

**Step 1: Audit pemakaian zinc hardcode**

Run: `grep -nE "zinc-[0-9]{3}|white/[0-9]" apps/operator-web/src/app/dashboard/sanctions/page.tsx`

**Step 2: Ganti ke token semantik**

Petakan: `bg-zinc-900` → `bg-card` atau `bg-secondary/50`; `border-white/10` → `border-input` atau `border-border`; `text-zinc-300` → `text-foreground`/`text-muted-foreground`. Sesuaikan dengan token yang dipakai `owners/page.tsx`.

**Step 3: Verifikasi visual**

Run: `npm run lint && npm run build`
Cek visual halaman sanctions konsisten dengan halaman lain (sama gelap, sama border).

**Step 4: Commit**

```bash
git add apps/operator-web/src/app/dashboard/sanctions/page.tsx
git commit -m "refactor(ui): use semantic color tokens in sanctions page for consistency"
```

---

### Task B3: Bersihkan dead code & tell visual ringan

**Files:**
- Delete: `apps/operator-web/src/lib/mock-data.ts` (tidak diimpor di mana pun — sudah diverifikasi)
- Delete/clean: `apps/operator-web/src/components/layout/navbar.tsx` (dead — `page.tsx` langsung redirect ke login) — DAN `apps/operator-web/src/proxy.ts.bak`
- Modify: `apps/operator-web/src/components/ui/button.tsx:13-28` (kurangi shadow-glow + gradient `glow` variant bila masih dipakai di login)

**Step 1: Konfirmasi mock-data & navbar tidak terpakai**

Run: `grep -rn "mock-data\|from.*navbar\|Navbar" apps/operator-web/src --include="*.ts" --include="*.tsx"`
Expected: kosong (atau hanya definisi navbar itu sendiri).

**Step 2: Hapus dead files**

```bash
git rm apps/operator-web/src/lib/mock-data.ts apps/operator-web/src/components/layout/navbar.tsx apps/operator-web/src/proxy.ts.bak
```

**Step 3: Cek pemakaian button variant `glow`/`default` di login**

Run: `grep -rn "variant=\"glow\"\|variant=\"default\"\|<Button" apps/operator-web/src/app/auth/login/page.tsx`
Jika login pakai glow gradient: ganti ke variant solid (`default` tanpa shadow-glow berlebih). Kurangi `shadow-[0_0_20px...]` jadi shadow biasa atau hapus. (Opsional — diskusikan jika ingin pertahankan brand glow.)

**Step 4: Verifikasi build masih jalan tanpa dead imports**

Run: `cd apps/operator-web && npm run build`
Expected: build sukses tanpa error module-not-found.

**Step 5: Commit**

```bash
git add -A apps/operator-web/src
git commit -m "chore(ui): remove dead mock-data + landing chrome, tone down glow"
```

---

### Task B4 (opsional polish): Keyboard shortcut aksi insiden + empty-state

Hanya jika waktu cukup setelah B1–B3 & Workstream A/C beres.

**Files:**
- Modify: `apps/operator-web/src/app/dashboard/incidents/[id]/page.tsx` (tambah keydown handler: `a`=acknowledge, `r`=resolve, `f`=false-alarm)
- Modify: halaman analytics/network/heatmap — tambah empty-state yang mengajari saat data kosong (bukan layar kosong)

**Step 1–4:** Implementasi handler keyboard dengan `useEffect` + `addEventListener("keydown")`, hormati focus pada input (jangan trigger saat mengetik). Empty-state: komponen kecil dengan ikon + kalimat penjelas + CTA. Verifikasi manual + lint. Commit per perubahan.

---

## Workstream C — Dokumentasi & Framing Jujur

### Task C1: README quick-start lengkap + status fitur

**Files:**
- Modify: `README.md`

**Step 1: Tambah bagian "Status Fitur" (Ready/Partial/Planned)**

Tabel jujur: Phase 1–16 = Ready; Notifikasi eksternal WA/SMS = Partial (stub log); Review otomatis = Ready (rules-assisted, bukan LLM); Telemetry = simulasi GPS device; Phase 17 Social Media = Planned (Roadmap Tahap 3).

**Step 2: Tambah urutan menjalankan + credential seed lokal + troubleshooting PostGIS/schema-drift**

Sertakan: urutan `up -d --build` → simulator profile → report:today; akun demo; perintah re-apply migration 014/015 + seed 004 (sudah ada sebagian di README, lengkapi).

**Step 3: Verifikasi**

Ikuti README dari nol di shell bersih: `docker compose ... up -d --build` → `curl http://localhost:4000/health` 200 → login web. Pastikan langkah akurat.

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: complete quick-start, feature status, troubleshooting"
```

---

### Task C2: Dokumentasikan Phase 17 sebagai Roadmap Tahap 3

**Files:**
- Modify: `doc1/task.md` (tandai Phase 17 sebagai "DEFERRED — Roadmap Tahap 3, di luar scope rilis lomba")
- Create: `docs/ROADMAP.md` (ringkas: apa yang sudah jadi vs rencana lanjutan)

**Step 1:** Tambah catatan eksplisit di header Phase 17 task.md. **Step 2:** Buat ROADMAP.md singkat. **Step 3:** Commit.

```bash
git add doc1/task.md docs/ROADMAP.md
git commit -m "docs: defer Phase 17 to Tahap 3 roadmap, clarify release scope"
```

---

### Task C3: Sinkronkan label "AI" → "rules-assisted" di UI public-reports

Memastikan framing jujur ke juri — review bukan LLM.

**Files:**
- Modify: `apps/operator-web/src/app/dashboard/public-reports/page.tsx` (cari teks "Automated Review"/"AI")

**Step 1:** Run `grep -niE "AI|otomatis|automated" apps/operator-web/src/app/dashboard/public-reports/page.tsx`
**Step 2:** Pastikan copy menyebut "Tinjauan Otomatis (berbasis rules)" atau serupa, bukan klaim "AI". Confidence score tetap ditampilkan (nyata).
**Step 3:** Lint + commit.

```bash
git add apps/operator-web/src/app/dashboard/public-reports/page.tsx
git commit -m "docs(ui): clarify automated review is rules-assisted, not LLM"
```

---

## Urutan Eksekusi yang Disarankan

1. **A1** dulu (amankan kerja) — kritis, jangan ditunda.
2. **A2, A3** (schema-check + smoke test) — fondasi anti-gagal-demo.
3. **B1, B2, B3** (UI fixes berdampak langsung ke first impression juri).
4. **C1, C2, C3** (dokumentasi & framing).
5. **B4** terakhir, hanya jika ada sisa waktu sebelum 8 Juni.

## Definition of Done (untuk 8 Juni)

- [ ] Working tree ter-commit, tree bersih.
- [ ] `docker compose up -d --build` sukses dari nol; `/health` 200; schema-check lolos.
- [ ] Smoke test 3/3 pass.
- [ ] 0 temuan `gray-on-color` di detektor impeccable; token konsisten.
- [ ] Dead code (mock-data, navbar) terhapus; build sukses.
- [ ] README quick-start akurat diikuti dari nol.
- [ ] Phase 17 jelas di-defer; label review jujur.
- [ ] Screenshot evidence before/after diperbarui di `docs/qa/evidence/`.
