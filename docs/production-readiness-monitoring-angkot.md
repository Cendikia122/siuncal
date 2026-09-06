# Production Readiness — Monitoring Angkot (Sentra)

> Dokumen ini adalah backlog production-readiness berbasis bukti repository.
> Jangan dieksekusi mentah-mentah tanpa membaca status setiap item: beberapa
> area sudah ada dan perlu dilengkapi/diuji, bukan dibuat ulang dari nol.

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Skor Kesiapan & Current State](#2-skor-kesiapan--current-state)
3. [Critical Blockers (P0) — Wajib Sebelum Rilis](#3-critical-blockers-p0--wajib-sebelum-rilis)
4. [Important Improvements (P1) — Minggu Pertama](#4-important-improvements-p1--minggu-pertama)
5. [Polish & Optimization (P2) — Minggu Kedua](#5-polish--optimization-p2--minggu-kedua)
6. [Scalability Roadmap](#6-scalability-roadmap)
7. [Monitoring & Observability](#7-monitoring--observability)
8. [Incident Response & Runbook](#8-incident-response--runbook)
9. [Security Audit Checklist](#9-security-audit-checklist)
10. [Database Migration Safety](#10-database-migration-safety)
11. [Deployment Checklist](#11-deployment-checklist)

---

## 1. Ringkasan Eksekutif

**Target:** Go-live monitoring angkot Dishub Kota Bogor.

**Scope:**
- Operator Web Dashboard (Next.js 16)
- API Gateway (Express + Postgres + Redis + MinIO)
- Rules Engine (anomaly detection)
- Notification Service
- Passenger Mobile App (Flutter — sentra_passenger)
- Telemetry Ingestion

**Current State per 30 Juni 2026:**

- Evidence readiness dari `node scripts/readiness-assessment.mjs --json`: **94%**
- Confidence operasional: **ready with conditions untuk pilot terbatas** setelah P0 di bawah selesai
- Confidence skala kota penuh: **belum ready** sebelum load test, SLO, observability, dan scale-out divalidasi

| Area | Skor | Status |
|---|---|---|
| Keamanan | 80/100 | Baseline kuat: JWT, CSRF, RBAC, rate limit, security headers; butuh security audit report dan secret review final |
| Infrastructure | 82/100 | Docker Compose, worker split, Caddy profile, PgBouncer, Redis Pub/Sub trigger, scale override, dan local multi-instance smoke sudah lulus; read replica belum |
| Testing | 55/100 | Backend unit/contract test ada; Playwright smoke wired ke script/CI dan lulus lokal Docker; load test real belum ada |
| Monitoring | 45/100 | `/health`, `/ready`, observability summary, Sentry optional; Prometheus/Grafana/alerting belum aktif |
| CI/CD | 45/100 | Quality gate mencakup service tests, operator-web lint/build, readiness, Flutter, dan API live integration; E2E masih manual serta release/deploy promotion belum otomatis |
| Dokumentasi Operasional | 65/100 | Scale-out/security/mobile runbook ada; incident response SOP dan deployment checklist final belum |

**Verdict:** **READY WITH CONDITIONS untuk pilot terbatas, NOT READY untuk skala kota penuh**
- Pilot terbatas (<100 angkot) boleh dipertimbangkan setelah P0 selesai dan diverifikasi
- Skala penuh Kota Bogor belum boleh dijalankan sebelum mitigasi P1 selesai dan load/SLO test lolos

---

## 2. Skor Kesiapan & Current State

### 2.1 Daftar Periksa

| Item | Status | Bukti |
|---|---|---|
| **Autentikasi** | ✅ Selesai | JWT + CSRF + session refresh, 2 role (OPERATOR, ANALISA) |
| **Otorisasi** | ✅ Selesai | Feature-level RBAC, role gate, auth guard, scope-based access |
| **Validasi Input** | ✅ Selesai | Zod schema, sanitized errors |
| **Rate Limiting** | ✅ Selesai | Redis-backed, 5 layer, in-memory fallback |
| **Caching** | ✅ Partial | Redis 3s TTL + `Cache-Control: public, max-age=3, s-maxage=5` + `Surrogate-Control` untuk `/public/vehicles`; CDN provider belum diprovision |
| **Pagination** | ✅ Selesai | Server-side LIMIT/OFFSET, cursor untuk audit-log |
| **Security Headers** | ✅ Partial | Security headers ada di API dan `next.config.ts`; HSTS hanya aktif saat `NODE_ENV=production` / TLS proxy |
| **Error Tracking** | ✅ Selesai | Sentry terintegrasi (opsional via env var) |
| **Docker** | ✅ Selesai | Multi-stage build, non-root user, standalone |
| **MOCK_MODE** | ✅ **P0 selesai** | `api.ts` dan `proxy.ts` force `MOCK_MODE=false` saat `NODE_ENV=production` |
| **CI/CD** | ✅ **P0 baseline selesai** | GitHub Actions mencakup service tests, operator-web lint/build, readiness assessment, mobile test, API live integration; E2E manual via `workflow_dispatch` |
| **Load Test** | ✅ **P0 scaffold selesai** | `scripts/load-test/load-test.mjs` menghasilkan report; hasil load test real tetap harus dijalankan sebelum go-live |
| **E2E Test** | ✅ **P2-1 lulus** | `playwright.config.ts`, `test:e2e`, workflow manual, dan smoke dashboard lulus lokal Docker |
| **WebSocket Fan-out** | ✅ Selesai | Redis Pub/Sub trigger + leader lock; smoke 2 replica lulus |
| **PgBouncer / Read Replica** | ✅ PgBouncer, ❌ read replica | Compose route service DB via PgBouncer; read replica belum |
| **Monitoring Metrics** | ⚠️ **Partial** | Health/readiness/observability summary ada; Prometheus metrics + alerting belum |

---

## 3. Critical Blockers (P0) — Wajib Sebelum Rilis

Empat blocker ini harus selesai SEBELUM aplikasi diakses oleh Dishub.

---

### P0-1: Matikan MOCK_MODE di Production

**Status:** ✅ Selesai — `apps/operator-web/src/lib/api.ts` dan `apps/operator-web/src/proxy.ts`.

**Akar Masalah:** `apps/operator-web/src/lib/api.ts` masih default mock `true`:
```typescript
export const MOCK_MODE = parseBooleanEnv(
  process.env.NEXT_PUBLIC_MOCK_MODE ?? process.env.MOCK_MODE, true
);
```
`apps/operator-web/src/proxy.ts` juga default mock `true`. Dockerfile dan compose sudah default
`NEXT_PUBLIC_MOCK_MODE=false`, tetapi production harus fail-closed dari source code, bukan hanya bergantung env build.

**Task untuk AI Agent:**

"""
Task: Production guard untuk MOCK_MODE

1. Baca file `apps/operator-web/src/lib/api.ts`
2. Ubah logika MOCK_MODE sehingga:
   - Di `process.env.NODE_ENV === 'production'`, MOCK_MODE SELALU false, tidak bisa di-override
   - Di development, biarkan default true (bisa di-override via env var)
3. Baca file `apps/operator-web/src/proxy.ts`
   - Pastikan logika yang sama diterapkan di proxy.ts
4. Baca file `Dockerfile` (`apps/operator-web/Dockerfile`)
   - Verifikasi `ARG NEXT_PUBLIC_MOCK_MODE=false` dan ENV sudah ada
   - Jangan ubah Dockerfile jika default false sudah benar
5. Baca `infra/docker-compose/docker-compose.yml`
   - Verifikasi build arg dan runtime env `NEXT_PUBLIC_MOCK_MODE` default false
6. Setelah perubahan:
   - Jalankan `cd apps/operator-web && npm run lint` — pastikan tidak ada error
   - Jalankan `cd apps/operator-web && npm run build` — pastikan build sukses

Dampak: Keamanan — mencegah data contoh tampil di production.
"""

**Estimasi:** 30 menit
**Risk if skipped:** **KRITIS** — Dashboard Dishub bisa menampilkan data angkot palsu

---

### P0-2: Perluas CI/CD Pipeline yang Sudah Ada

**Status:** ✅ Selesai untuk baseline P0 — `.github/workflows/ci.yml` sudah diperluas.

**Akar Masalah:** `.github/workflows/ci.yml` sudah ada, tetapi saat ini fokus ke API live integration.
Quality gate belum mencakup rules-engine, notification-service, operator-web lint/build,
readiness script, mobile test, dan E2E dashboard.

**Task untuk AI Agent:**

"""
Task: Lengkapi GitHub Actions CI/CD pipeline untuk Sentra

Update file `.github/workflows/ci.yml` yang sudah ada. Jangan overwrite job
`api-live-integration`; tambahkan job baru atau matrix job yang kecil dan mudah dibaca.

Job wajib:

1. `service-unit-tests`
   - Matrix:
     - `services/api-gateway`
     - `services/rules-engine`
     - `services/notification-service`
   - Steps:
     1. Checkout code
     2. Setup Node 20 dengan cache npm per `package-lock.json`
     3. `npm ci`
     4. `npm test`

2. `operator-web-quality`
   - Steps:
     1. Checkout code
     2. Setup Node 20 dengan cache `apps/operator-web/package-lock.json`
     3. `cd apps/operator-web && npm ci`
     4. `cd apps/operator-web && npm run lint`
     5. `cd apps/operator-web && npm run build`

3. `readiness-assessment`
   - Steps:
     1. Checkout code
     2. Setup Node 20
     3. `node --test scripts/readiness-assessment.test.mjs`
     4. `node scripts/readiness-assessment.mjs --json`

4. `operator-web-e2e` (boleh manual/conditional sampai dev server stabil di CI)
   - Gunakan Playwright spec existing di `apps/operator-web/e2e/smoke.spec.ts`
   - Jalankan setelah package script `test:e2e` tersedia

5. `passenger-mobile-test` (kalau Flutter tersedia di CI)
   - Setup Flutter stable
   - `cd apps/passenger-mobile && flutter pub get`
   - `cd apps/passenger-mobile && flutter test`

Trigger:
- `push` ke `main` dan `production`
- `pull_request`
- `workflow_dispatch`

Catatan penting:
- Tidak ada `npm run lint` untuk service backend karena package saat ini hanya punya `npm test`
- Jangan commit secrets ke workflow
- Jangan hapus Docker Compose validation dan API live integration yang sudah ada
- Jika job mobile/e2e terlalu berat, buat `workflow_dispatch` dulu, lalu promote ke PR gate setelah stabil

Verifikasi lokal sebelum push:
1. `docker compose --env-file infra/docker-compose/.env.example -f infra/docker-compose/docker-compose.yml config --quiet`
2. `cd services/api-gateway && npm test`
3. `cd services/rules-engine && npm test`
4. `cd services/notification-service && npm test`
5. `cd apps/operator-web && npm run lint && npm run build`
6. `node --test scripts/readiness-assessment.test.mjs`

Dampak: Setiap perubahan punya quality gate lint/test/build yang lebih representatif sebelum merge.
"""

**Estimasi:** 4-6 jam
**Risk if skipped:** **TINGGI** — CI ada, tapi masih bisa meloloskan regresi frontend/rules/mobile/e2e

---

### P0-3: Load Test — Simulasi 1000 Angkot

**Status:** ✅ Selesai sebagai scaffold executable — script dan dependency lokal tersedia di `scripts/load-test/`.

**Akar Masalah:** Tidak ada data performa. Tidak tahu apakah backend sanggup handle ribuan angkot real-time.

**Task untuk AI Agent:**

"""
Task: Load test untuk api-gateway dengan simulasi 1000 angkot

Buat folder `scripts/load-test/` dan script load test yang reproducible.
Jangan install dependency global di host. Jika memakai dependency seperti `autocannon`,
buat `scripts/load-test/package.json` kecil dan jalankan via `npm --prefix scripts/load-test`.

Buat 3 skenario:

Skenario 1: Public Vehicles Endpoint
- Target: `GET /public/vehicles`
- Durasi: 60 detik
- Connections: 50 concurrent
- Threshold: p95 < 300ms, error rate < 1%

Skenario 2: Dashboard Summary (authenticated)
- Target: endpoint dashboard yang benar-benar ada setelah membaca `services/api-gateway/src/server.js`
- Durasi: 60 detik
- Connections: 20 concurrent
- Threshold: p95 < 500ms

Skenario 3: WebSocket Broadcast Simulation
- Buat script yang mengirim telemetry untuk 1000 vehicle simultan via `/telemetry/vehicle`
- Ukur:
  - Waktu telemetry diterima sampai payload realtime terkirim ke client
  - CPU usage server
  - Memory usage

Cara menjalankan:
1. `docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml up -d --build postgres redis minio api-gateway worker rules-engine notification-service`
2. `npm --prefix scripts/load-test install`
3. `npm --prefix scripts/load-test start`
4. Catat hasilnya ke `scripts/load-test/results/` dengan timestamp

Output yang harus dihasilkan:
- File markdown `scripts/load-test/results/REPORT-{timestamp}.md`
- Berisi: target, duration, connections, p50/p75/p90/p95/max latency, error rate, throughput
- Kesimpulan: PASS / FAIL per skenario
- Rekomendasi jika FAIL

Dampak: Tahu batas kemampuan sistem sebelum go-live.
"""

**Estimasi:** 2 hari
**Risk if skipped:** **TINGGI** — Bisa down di hari pertama saat Dishub akses

---

### P0-4: Validasi Deployment Checklist dan Smoke Script

**Status:** ✅ Selesai — `scripts/health-check.sh` tersedia dan deployment checklist tidak lagi memakai command palsu.

**Akar Masalah awal:** Deployment checklist lama merujuk command/file yang tidak ada:
`node src/migrate.js`, `./scripts/health-check.sh`, dan `docker-compose-v21.yml`.

**Task untuk AI Agent:**

"""
Task: Buat deployment checklist yang executable dan smoke script yang benar-benar ada

1. Baca:
   - `README.md`
   - `infra/docker-compose/docker-compose.yml`
   - `infra/docker-compose/.env.example`
   - `scripts/status.sh`
   - `scripts/QUICK_START.md`
   - `services/api-gateway/src/server.js` untuk `/health` dan `/ready`
2. Buat `scripts/health-check.sh` jika belum ada:
   - Cek `http://localhost:4000/health`
   - Cek `http://localhost:4000/ready`
   - Cek `http://localhost:3000/auth/login`
   - Return non-zero jika salah satu gagal
3. Update deployment checklist di dokumen ini:
   - Hapus `node src/migrate.js` kecuali file migrasi runtime benar-benar dibuat
   - Gunakan initdb/migration flow yang benar dari README dan `infra/docker-compose/initdb/001_bootstrap.sql`
   - Hapus referensi `docker-compose-v21.yml` sampai ada rollback artifact nyata
4. Verifikasi:
   - `bash -n scripts/health-check.sh`
   - `docker compose --env-file infra/docker-compose/.env.example -f infra/docker-compose/docker-compose.yml config --quiet`

Dampak: Runbook deploy tidak mengarahkan operator menjalankan command palsu.
"""

**Estimasi:** 2-4 jam
**Risk if skipped:** **TINGGI** — Operator bisa gagal deploy/rollback karena runbook tidak sesuai repo

---

## 4. Important Improvements (P1) — Minggu Pertama

Setelah 4 P0 selesai, kerjakan P1 ini secara berurutan.

---

### P1-1: Setup PgBouncer + Connection Pooling

**Status:** ✅ Selesai — PgBouncer container smoke lulus dan service aplikasi sudah rebuild/recreate memakai `pgbouncer:6432`.

**Yang sudah diterapkan:**

1. `infra/docker-compose/docker-compose.yml` menambah service `pgbouncer` dengan image pinned `edoburu/pgbouncer:v1.25.2-p0`, `POOL_MODE=transaction`, healthcheck, dan port localhost `6432`.
2. `api-gateway`, `worker`, `rules-engine`, dan `notification-service` diarahkan ke `PGBOUNCER_HOST=pgbouncer` / `PGBOUNCER_PORT=6432`.
3. `services/api-gateway/src/db.js`, `services/rules-engine/src/rules-engine-config.js`, dan `services/notification-service/src/index.js` mendukung override `PGBOUNCER_HOST/PORT`.
4. `DB_SSL=false` diset eksplisit di Compose untuk koneksi private Docker network ke PgBouncer; direct production `DATABASE_URL` tetap SSL by default jika `DB_SSL` tidak dioverride.
5. `infra/docker-compose/.env.example` menambah parameter PgBouncer dan pool size.

**Bukti otomatis:**

- `docker compose --env-file infra/docker-compose/.env.example -f infra/docker-compose/docker-compose.yml config --quiet`
- `docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml up -d pgbouncer`
- `docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml exec -T pgbouncer sh -lc 'PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -p "$LISTEN_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT 1"'` → `1`
- `services/api-gateway`: `npm test -- test/db-config.test.js test/redis-pubsub.test.js test/realtime-broadcaster.test.js`
- `services/rules-engine`: `npm test -- test/rules-engine-config.test.js`

**Bukti runtime lokal:**

- `api-gateway`, `worker`, `rules-engine`, dan `notification-service` sudah rebuild/recreate.
- Runtime env check menunjukkan `api-gateway`, `rules-engine`, dan `notification-service` memakai `PGBOUNCER_HOST=pgbouncer` / `PGBOUNCER_PORT=6432`.
- `/ready`, `rules-engine /health`, dan `notification-service /health` return healthy setelah service aplikasi memakai PgBouncer.

---

### P1-2: WebSocket Fan-out dengan Redis Pub/Sub

**Status:** ✅ Selesai — Redis Pub/Sub fan-out dan smoke 2 replica lulus.

**Yang sudah diterapkan:**

1. `services/api-gateway/src/redis.js` menambah `createRedisClient`, `publishToChannel`, `subscribeToChannel`, dan `tryAcquireRedisLock` dengan client pub/sub terpisah dan error handling best-effort.
2. `services/api-gateway/src/realtime-broadcaster.js` menambah `instanceId`, publish event `REALTIME_TICK`, dan handler remote tick yang skip event dari instance sendiri serta menjalankan broadcast lokal tanpa re-publish.
3. `services/api-gateway/src/server.js` subscribe ke channel `REALTIME_BROADCAST_CHANNEL` default `realtime:broadcast` dan memakai Redis leader lock `REALTIME_BROADCAST_LOCK_KEY` agar hanya satu instance aktif yang publish trigger per interval.
4. Logic rate limiting/cache Redis tetap memakai client utama dan tidak diubah perilakunya.

**Catatan desain:**

- Event Redis yang dikirim adalah trigger kecil, bukan full payload kendaraan. Instance penerima mengambil state terbaru dari DB dan broadcast ke client lokalnya.
- Leader lock mencegah semua instance melakukan query dan publish bersamaan saat scale-out. Jika lock gagal karena Redis down, instance fallback ke broadcast lokal tanpa publish.
- Jika Redis pub/sub down, broadcast lokal tetap berjalan; cross-instance fan-out akan nonaktif sampai Redis/subscriber pulih.

**Bukti otomatis:**

- `services/api-gateway`: `npm test -- test/db-config.test.js test/redis-pubsub.test.js test/realtime-broadcaster.test.js`

**Bukti smoke lokal:**

1. Dua WebSocket client diarahkan langsung ke dua container berbeda `api-gateway-1` dan `api-gateway-2`.
2. Keduanya menerima `HELLO`, `NOTIFICATION_LIST`, dan `VEHICLE_LATEST`.
3. Payload `VEHICLE_LATEST` berisi 45 kendaraan pada kedua client.
4. WebSocket lewat Caddy `wss://api.localhost/realtime` juga menerima `VEHICLE_LATEST`.

---

### P1-3: Horizontal Scaling — Docker Compose Multi-Instance

**Status:** ✅ Selesai — local proxy scale smoke lulus; ulangi smoke setiap release production.

**Yang sudah diterapkan:**

1. `infra/docker-compose/docker-compose.scale.yml` menghapus fixed host port `api-gateway` dengan `ports: !reset []` untuk mode scale/proxy.
2. Service Caddy existing tetap dipakai melalui profile `proxy`; API route tetap `{$SENTRA_API_DOMAIN:api.localhost}` → `api-gateway:4000`.
3. `scripts/scale-up.sh <replicas>` menjalankan Compose base + scale override + profile proxy.
4. `services/api-gateway/src/server.js` sudah generate `instanceId` dan mencetak `instance_id` saat startup.

**Command:**

```bash
./scripts/scale-up.sh 2
curl -k https://api.localhost/health
curl -k https://api.localhost/ready
```

**Bukti smoke lokal:**

- `./scripts/scale-up.sh 2` equivalent command via Compose base + scale override + profile proxy.
- `docker compose ... ps` menunjukkan `api-gateway-1` dan `api-gateway-2` healthy.
- `curl -k https://api.localhost/health` dan `/ready` return 200.
- Direct `http://localhost:4000` tertutup di scale mode; akses API lewat Caddy.
- Restart `api-gateway-1` tidak memutus readiness Caddy; `/ready` tetap 200 via replica sehat.
- WebSocket lewat `wss://api.localhost/realtime` kembali menerima `VEHICLE_LATEST` setelah replica restart.

**VERIFY sebelum rollout:**

- `docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml -f infra/docker-compose/docker-compose.scale.yml --profile proxy ps`
- Minimal 2 container `api-gateway` berjalan.
- WebSocket connect lewat `wss://api.localhost/realtime` dan tetap menerima refresh setelah satu instance direstart.

---

### P1-4: Unit Test Coverage untuk Flutter App

**Status:** ✅ Selesai.

**Yang sudah diterapkan:**

1. `apps/passenger-mobile/test/auth/session_test.dart` menutup parsing session lengkap/minimal, tracking consent, getter `hasPassengerTracking`, dan `toStorageJson`.
2. `apps/passenger-mobile/test/report/draft_report_test.dart` menutup `DraftReport.fromJson`, 5 nilai `ReportCategory`, fallback kategori, dan `ReportHistoryItem.fromJson`.
3. `apps/passenger-mobile/test/nearby/nearby_test.dart` menutup estimasi jarak `NearbyAngkot` dan `LocationPermissionException`.
4. `apps/passenger-mobile/test/tracking/tracking_controller_test.dart` menutup klasifikasi error tracking: unauthorized, timeout, connection, server, dan fallback sync error.
5. `apps/passenger-mobile/test/widget_test.dart` menambah smoke tap bottom nav Beranda → Lapor → Profil → Beranda.
6. `DraftReport.fromJson` ditambahkan untuk contract parsing draft report.
7. Error classifier tracking diekstrak ke `features/tracking/tracking_error.dart` supaya foreground dan background tracking memakai logic yang sama.
8. `NearbyAngkot.estimateMinutes` memakai `ceil()` agar estimasi tidak under-estimate: 100m → 2 menit, 1000m → 14 menit.

**Bukti otomatis:**

- `cd apps/passenger-mobile && flutter test` → 26 tests pass.
- `cd apps/passenger-mobile && flutter analyze` → No issues found.

---

## 5. Polish & Optimization (P2) — Minggu Kedua

---

### P2-1: E2E Test dengan Playwright

**Status:** ✅ Selesai.

**Bukti implementasi:**

- `apps/operator-web/playwright.config.ts` tersedia dengan `testDir: "./e2e"`, retry CI, worker tunggal di CI, reporter HTML/list, dan `E2E_BASE_URL`.
- `apps/operator-web/package.json` sudah memiliki `test:e2e` dan `test:e2e:ui`.
- `.github/workflows/ci.yml` sudah memiliki job `operator-web-e2e` manual via `workflow_dispatch`.
- `apps/operator-web/e2e/smoke.spec.ts` disesuaikan ke DOM aktual dashboard: login ANALISA, dashboard, armada detail + playback, insiden, laporan, audit log, dan guard error client/500.

**Bukti verifikasi lokal 30 Juni 2026:**

- `docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml up -d --build --scale api-gateway=1 postgres redis minio pgbouncer api-gateway worker rules-engine notification-service operator-web` → service naik, API `localhost:4000` terpublish.
- `curl -fsS http://localhost:4000/ready` → `ok: true` untuk postgres, redis, dan object storage.
- `cd apps/operator-web && E2E_BASE_URL=http://localhost:3000 npm run test:e2e` → 1 test pass.
- `cd apps/operator-web && npm run lint` → pass.

**Catatan verifikasi:**

- Local Playwright browser install sempat macet di tahap ekstraksi cache; headless shell Chromium diekstrak manual dari zip yang sudah diunduh agar E2E bisa dijalankan.
- CI tetap memakai jalur standar `npx playwright install --with-deps chromium`.

**Task untuk AI Agent:**

"""
Task: Wire E2E Playwright yang sudah ada ke package script dan CI

Framework: Playwright sudah ada di devDependencies.
Spec awal sudah ada di `apps/operator-web/e2e/smoke.spec.ts`.
Jangan membuat test login baru sebelum membaca spec existing dan DOM login aktual.

Buat `apps/operator-web/playwright.config.ts`:
```typescript
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
});
```

Update `apps/operator-web/package.json` — tambah script:
```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

Jalankan:
```
docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml up -d --build postgres redis minio api-gateway worker rules-engine notification-service operator-web
cd apps/operator-web && npx playwright install --with-deps chromium && E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

Fix jika test fail. Pastikan semua pass. Setelah stabil, wire ke `.github/workflows/ci.yml`
sebagai job manual/conditional lebih dulu.

Dampak: Automated regression test untuk flow kritis.
"""

---

### P2-2: CDN untuk /public/vehicles

**Status:** ✅ Selesai.

**Bukti implementasi:**

- `services/api-gateway/src/server.js` menambahkan `PUBLIC_VEHICLES_CDN_CACHE_TTL_SEC` default 5 detik.
- Handler `GET /public/vehicles` sekarang mengirim `Cache-Control: public, max-age=3, s-maxage=5`.
- Handler yang sama juga mengirim `Surrogate-Control: max-age=5` untuk CDN/surrogate cache.
- `infra/docker-compose/docker-compose.yml` dan `.env.example` meneruskan `PUBLIC_VEHICLES_CACHE_TTL_SEC` dan `PUBLIC_VEHICLES_CDN_CACHE_TTL_SEC`.
- `infra/reverse-proxy/Caddyfile` tidak perlu override header karena origin API sudah mengirim header cache; ini menghindari konflik jika TTL diubah via env.

**Bukti verifikasi lokal 30 Juni 2026:**

- `cd services/api-gateway && node --test test/scale-phase1-contract.test.js test/smoke.test.js` → 10 tests pass.
- `docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml up -d --build api-gateway worker` → API/worker rebuilt dan healthy.
- `curl -I -fsS http://localhost:4000/public/vehicles` → `Cache-Control: public, max-age=3, s-maxage=5`, `Surrogate-Control: max-age=5`, dan `X-Cache: MISS`.

**Task untuk AI Agent:**

"""
Task: Konfigurasi CDN untuk endpoint public vehicles

Endpoint `/public/vehicles` adalah endpoint paling sering diakses (oleh semua
pengguna aplikasi mobile untuk tracking angkot).

Langkah:
1. Redis cache sudah ada dengan TTL 3 detik dan `Cache-Control: public, max-age=3`
2. Tambah `s-maxage=5` jika CDN dipakai
   - `max-age=3`: browser cache 3 detik
   - `s-maxage=5`: CDN cache 5 detik
3. Baca `services/api-gateway/src/server.js` — cari handler `GET /public/vehicles`
4. Ubah header existing menjadi:
   ```javascript
   res.setHeader('Cache-Control', `public, max-age=${PUBLIC_VEHICLES_CACHE_TTL_SEC}, s-maxage=5`);
   res.setHeader('Surrogate-Control', 'max-age=5');
   ```
5. Jika perlu edge header di reverse proxy, update `infra/reverse-proxy/Caddyfile`:
   ```
   @public_vehicles {
     path /public/vehicles*
   }
   header @public_vehicles Cache-Control "public, max-age=3, s-maxage=5"
   ```
6. Verifikasi dengan curl:
   ```bash
   curl -I http://localhost:4000/public/vehicles | grep -i cache
   # Harusnya muncul: Cache-Control: public, max-age=3, s-maxage=5
   ```

Dampak: Mengurangi beban backend untuk endpoint publik yang paling sering diakses.
"""

---

### P2-3: Monitoring Metrics & Dashboard

**Task untuk AI Agent:**

"""
Task: Setup monitoring metrics dengan Prometheus + Grafana

1. Buat file `services/api-gateway/src/metrics.js`:
   - Ekspor fungsi `incrementHttpRequest(method, path, statusCode)`
	   - Ekspor fungsi `observeHttpDuration(method, path, durationMs)`
	   - Ekspor fungsi `incrementWebSocketMessage(type)`
	   - Ekspor fungsi `gaugeActiveConnections(count)`
	   - Simpan metrics di Map in-memory untuk fase awal
	   - Jangan mengandalkan console log untuk Prometheus; Prometheus harus scrape endpoint `/metrics`

2. Baca `services/api-gateway/src/server.js`:
   - Tambah middleware untuk hit request count + duration
   - Tambah endpoint `GET /metrics` yang return Prometheus format:
     ```
     # HELP http_requests_total Total HTTP requests
     # TYPE http_requests_total counter
     http_requests_total{method="GET",path="/public/vehicles",status="200"} 1234
     ```

3. Tambah ke docker-compose:
   ```yaml
   prometheus:
     image: prom/prometheus:latest
     volumes:
       - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
     ports:
       - "127.0.0.1:9090:9090"

	   grafana:
	     image: grafana/grafana:latest
	     ports:
	       - "127.0.0.1:3001:3000"
	     volumes:
	       - grafana-data:/var/lib/grafana
	   ```
   Tambahkan `grafana-data:` ke bagian `volumes:` jika belum ada.

4. Buat `infra/docker-compose/prometheus/prometheus.yml`:
   ```yaml
   scrape_configs:
     - job_name: 'api-gateway'
       static_configs:
         - targets: ['api-gateway:4000']
   ```

5. Verifikasi:
   - `curl http://localhost:9090/api/v1/targets` → UP
   - `curl http://localhost:4000/metrics` → data muncul

Dampak: Visibility dasar untuk performa sistem; alerting dan dashboard detail tetap perlu iterasi lanjutan.
"""

---

### P2-4: Safety Net — Validation Contract Test

**Status: ✅ Selesai (2026-07-23)** — live HTTP contract test mencakup pagination, error envelope, dashboard 401/403, dan 429 dengan `Retry-After`; suite API gateway lulus 106/106.

**Task untuk AI Agent:**

"""
Task: Tambah integration contract test untuk API endpoints

Berdasarkan pattern yang sudah ada di:
- `services/api-gateway/test/mobile-lifecycle-contract.test.js`
- `services/api-gateway/test/scale-phase1-contract.test.js`
- `services/api-gateway/test/master-data-contract.test.js`

Buat file `services/api-gateway/test/production-contract.test.js`:

Test yang harus ada:
1. **Pagination contract** — semua endpoint list return format yang konsisten:
   ```javascript
   // Dari dashboard-list-scope.js
   // Response harus punya: { items, total, page, limit }
   ```
   Test dengan membaca source code dashboard-list-scope.js dan verifikasi
   bahwa response shape konsisten.

2. **Error response contract** — semua endpoint error return format:
   ```javascript
   // { error: { code: string, message: string } }
   ```

3. **Rate limit response contract** — 429 return header `Retry-After`

4. **Auth contract** — endpoint dashboard return 401 tanpa cookie, 403 tanpa role

Cara menjalankan:
```
cd services/api-gateway && npm test
```

Pastikan test baru pass bersama semua test existing.

Dampak: Jaminan backward compatibility API saat refactor.
"""

---

### P2-5: Offline-First Cache untuk Flutter

**Task untuk AI Agent:**

"""
Task: Implementasi offline cache untuk data vehicles di aplikasi Flutter

Baca file:
- `apps/passenger-mobile/lib/features/vehicles/data/vehicles_repository.dart`
- `apps/passenger-mobile/lib/features/vehicles/providers/vehicles_provider.dart`
- `apps/passenger-mobile/pubspec.yaml`

Masalah: Saat ini jika server tidak reachable, hanya fallback ke 3 data contoh.
Tidak ada cache lokal.

Solusi:
1. Gunakan `shared_preferences` yang sudah ada di `pubspec.yaml`; jangan tambah dependency baru kecuali perlu
2. Di `VehiclesRepository.fetchPublicVehicles()`:
   - Jika fetch sukses → simpan response ke local cache + return data
   - Jika fetch gagal → baca dari local cache jika masih tersedia
   - Jika cache kosong → baru fallback ke 3 data contoh
3. Tambah flag hasil yang membedakan:
   - live data
   - cached stale data
   - sample fallback data
4. Tampilkan indikasi "Data mungkin tidak terkini" jika pakai cache

Verifikasi:
1. Matikan server
2. Buka halaman All Angkot — harusnya tetap muncul data (dari cache)
3. Status badge menunjukkan "Data dari cache"
4. Jika belum pernah ada cache, status tetap "Data contoh — server tidak tersedia"

Dampak: User tetap bisa lihat data angkot meskipun offline/sinyal jelek.
"""

---

## 6. Scalability Roadmap

### Berdasarkan Jumlah Angkot

| Jumlah Angkot | Arsitektur | Action Items |
|---|---|---|
| **< 100** (pilot) | 1 instance api-gateway, 1 Postgres, 1 Redis | ✅ Current setup + P0 fixes |
| **100–500** | 2 instance api-gateway + PgBouncer + Redis Pub/Sub | P1-1, P1-2, P1-3 |
| **500–2000** | 3 instance api-gateway + read replica Postgres + Redis Cluster | P1-1 s/d P1-3 + read replica |
| **> 2000** | Full HA: load balancer, multi-AZ, CDN, Kafka untuk telemetry | Perubahan arsitektur mayor |

### Estimasi Resource per 1000 Angkot

| Resource | Estimasi | Notes |
|---|---|---|
| API Gateway | 2-3 instance (2 CPU, 2GB RAM) | Target awal: 1 instance ~400 telemetry/detik; wajib dibuktikan load test |
| PostgreSQL | 2 vCPU, 8GB RAM, 100GB disk | TimescaleDB compression efektif untuk time-series |
| Redis | 1 instance (2GB RAM) | Mostly rate limiting + pub/sub state |
| MinIO | 50GB awal | Evidence public report + playback recording |
| WebSocket | ~500 concurrent connections | Per operator yang buka dashboard |

---

## 7. Monitoring & Observability

### Minimum Viable Monitoring (MVP)

Sebelum investasi Prometheus/Grafana (P2-3), lakukan ini:

```bash
# 1. Health endpoint — sudah ada
curl http://localhost:4000/health    # {"ok":true,"service":"api-gateway"}
curl http://localhost:4000/ready     # {"ok":true,"service":"api-gateway","checks":{...}}

# 2. Log monitoring — pastikan log terpusat
docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml logs -f --tail=100 api-gateway
docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml logs -f --tail=100 rules-engine

# 3. Sentry — sudah terintegrasi, pastikan DSN di-set
# Environment: NEXT_PUBLIC_SENTRY_DSN, SENTRY_DSN

# 4. Database monitoring — query lambat
SELECT * FROM pg_stat_activity;
-- Jalankan hanya jika pg_stat_statements sudah diaktifkan.
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
```

### Alert Thresholds (Sementara)

| Metric | Warning | Critical | Action |
|---|---|---|---|
| API Response Time (p95) | > 500ms | > 2s | Scale out or investigate query |
| Error Rate | > 1% | > 5% | Rollback last deploy |
| DB Connection Usage | > 80% pool | > 95% pool | Add PgBouncer |
| WebSocket Connections | > 500 | > 1000 | Scale WebSocket instance |
| Disk Usage | > 70% | > 85% | Cleanup or expand volume |
| Telemetry Ingestion Lag | > 5s | > 30s | Check telemetry queue |

---

## 8. Incident Response & Runbook

### Sebelum Go-Live, buat file ini:

```markdown
# File: docs/runbooks/incident-response-sop.md

## Level Insiden

| Level | Definisi | Response Time |
|---|---|---|
| SEV1 | Down total, semua user tidak bisa akses | < 15 menit |
| SEV2 | Fitur utama rusak, ada workaround | < 1 jam |
| SEV3 | Bug minor, tidak blocking | < 24 jam |

## Runbook: API Gateway Down

1. Cek log: `docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml logs --tail=200 api-gateway`
2. Cek health: `curl http://localhost:4000/health`
3. Restart: `docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml restart api-gateway`
4. Jika tidak bisa: `docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml up -d --force-recreate api-gateway`
5. Jika database error: `docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml logs --tail=50 postgres`

## Runbook: Database Full

1. Cek disk: `docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml exec postgres df -h`
2. Cek table size: 
   ```sql
   SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
   FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC;
   ```
3. Archive old data dari `vehicle_positions` hypertable
4. Eksekusi compression TimescaleDB:
   ```sql
   SELECT add_compression_policy('vehicle_positions', INTERVAL '7 days');
   ```

## Runbook: High CPU / Slow Response

1. Identifikasi query lambat:
   ```sql
   -- Jalankan hanya jika pg_stat_statements sudah diaktifkan.
   SELECT query, total_time, calls, rows FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
   ```
2. Cek index yang missing:
   ```sql
   SELECT schemaname, tablename, indexname FROM pg_indexes WHERE tablename NOT LIKE 'pg_%';
   ```
3. Restart api-gateway jika perlu: `docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml restart api-gateway`
```

**Task untuk AI Agent:**

"""
Task: Buat file incident response SOP

Berdasarkan template di atas, buat file lengkap `docs/runbooks/incident-response-sop.md`
dengan konten yang sesuai dengan arsitektur proyek ini.

Baca file berikut untuk referensi:
- `docs/runbooks/scale-out.md`
- `infra/docker-compose/docker-compose.yml`
- `services/api-gateway/src/db.js`
- `services/api-gateway/src/redis.js`

Pastikan semua command SQL dan bash sesuai dengan environment nyata proyek.
"""

---

## 9. Security Audit Checklist

### Autentikasi
- [ ] JWT secret diganti dari default (`JWT_SECRET` di .env.example)
- [x] Refresh token rotation (`/auth/refresh` revoke token lama dan set `replaced_by`)
- [ ] Session timeout (ada di `auth-context.tsx`)
- [ ] Rate limiting login (✅ sudah)

### Otorisasi
- [ ] Role-based access (✅ 2 role: OPERATOR, ANALISA)
- [ ] Feature-level gate di frontend (✅ `canAccess()`)
- [ ] Backend authorization (✅ `requireRoles()` middleware)
- [ ] Scope-based data access (✅ `dashboard-list-scope.js`)

### Data Protection
- [x] Password hashing via PostgreSQL `crypt(..., gen_salt('bf'))`
- [ ] PII masking untuk non-ANALISA (✅ `passenger-location-access.js`)
- [ ] HTTPS only di production (Caddy profile ada; wajib verifikasi domain, `COOKIE_SECURE=true`, dan HSTS)
- [ ] CSRF protection (✅ cookie-based)

### Infrastructure
- [ ] CORS terbatas (✅ di server.js)
- [ ] Security headers (✅ di next.config.ts)
- [ ] Docker non-root user (✅ di Dockerfile)
- [ ] Secret management (❌ env file, butuh vault untuk production)

### Checklist AI Agent Task:

"""
Task: Security audit — verifikasi semua item di atas sudah diimplementasi

Baca file:
1. `services/api-gateway/src/server.js` — cari CORS, helmet, rate limiter
2. `apps/operator-web/next.config.ts` — security headers
3. `services/api-gateway/src/db.js` — SSL production guard
4. `services/api-gateway/src/validation.js` — Zod schema
5. `apps/operator-web/src/lib/api.ts` — CSRF logic
6. `services/api-gateway/src/dashboard-list-scope.js` — RBAC scope

Buat laporan `docs/security-audit-report.md`:
- Setiap item checklist: ✅ Aman / ⚠️ Perlu Perbaikan / ❌ Tidak Ada
- Untuk yang ⚠️ atau ❌, berikan rekomendasi perbaikan
- Prioritaskan: P0 (critical), P1 (important), P2 (nice-to-have)
"""

---

## 10. Database Migration Safety

### Golden Rules untuk Migration

```bash
# SELALU backup sebelum migrate
docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml exec -T postgres \
  pg_dump -U monitoring Sentra > backup_$(date +%Y%m%d_%H%M%S).sql
```

```sql
-- JANGAN pernah DROP column di production tanpa testing
-- Gunakan 2-phase migration:
-- Phase 1: ADD column, update code to use new column
-- Phase 2 (next deploy): DROP old column

-- JANGAN pernah ALTER COLUMN type yang punya data
-- Buat column baru, migrate data, drop column lama

-- Test migration di transaksi jika operasi mendukung rollback:
BEGIN;
  -- migration script here
ROLLBACK; -- harus bisa rollback
```

### Migration Checklist

| # | Check | Keterangan |
|---|---|---|
| 1 | Backup database sebelum migrate | Wajib |
| 2 | Migration sudah di-test di staging | Wajib |
| 3 | Tidak ada DROP COLUMN tanpa 2-phase | Wajib |
| 4 | NOT NULL column punya DEFAULT value | Wajib |
| 5 | Index untuk foreign key yang sering di-join | Wajib |
| 6 | Migration dalam transaksi explicit | Wajib |
| 7 | Rollback script tersedia | Recommended |

---

## 11. Deployment Checklist

### Pre-Deployment

- [ ] `MOCK_MODE=false` di production environment
- [ ] `JWT_SECRET` diganti (bukan default)
- [ ] `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_ROOT_PASSWORD` diganti
- [ ] SSL/HTTPS certificate terpasang
- [ ] Sentry DSN terisi
- [ ] DNS domain mengarah ke server
- [ ] Backup database terbaru sudah di-download
- [ ] Load test PASS untuk skenario yang direncanakan

### Deployment Steps

```bash
# 1. Pull latest
git pull origin production

# 2. Build images
docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml build

# 3. Backup database
docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml exec -T postgres \
  pg_dump -U monitoring Sentra > backup_$(date +%Y%m%d_%H%M%S).sql

# 4. Run migrations (jika ada file migration baru)
# Untuk volume baru, initdb/001_bootstrap.sql menjalankan bootstrap otomatis.
# Untuk volume existing, apply migration SQL eksplisit via psql setelah review.
# Contoh:
# docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml exec -T postgres \
#   psql -v ON_ERROR_STOP=1 -U monitoring -d Sentra -f /db/migrations/0XX_new_migration.sql

# 5. Start services
docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml up -d --remove-orphans

# 6. Health check
./scripts/health-check.sh

# 7. Rollback jika health check fail
# Rollback harus memakai image/tag/commit sebelumnya yang sudah dipublikasikan.
# Jangan mengandalkan docker-compose-v21.yml karena file itu belum ada di repo.
git log --oneline -5
```

### Post-Deployment

- [ ] Health endpoint return 200
- [ ] WebSocket connect sukses
- [ ] Login flow sukses
- [ ] Dashboard render dengan data real
- [ ] Public vehicles endpoint return data
- [ ] Sentry tidak ada error spike
- [ ] Log tidak ada ERROR/WARN aneh

---

## Ringkasan Timeline

| Minggu | Item | Prioritas |
|---|---|---|
| **Minggu 1** | P0-1: MOCK_MODE guard | **P0** |
| | P0-2: Perluas CI/CD pipeline | **P0** |
| | P0-3: Load test | **P0** |
| | P0-4: Deployment checklist + smoke script | **P0** |
| **Minggu 2** | P1-1: PgBouncer | ✅ Selesai |
| | P1-2: WebSocket fan-out | ✅ Selesai |
| | P1-3: Horizontal scaling | ✅ Selesai |
| | P1-4: Flutter unit test | ✅ Selesai |
| **Minggu 3** | P2-1: E2E Playwright | ✅ Selesai |
| | P2-2: CDN caching | ✅ Selesai |
| | P2-3: Metrics & dashboard | P2 |
| | P2-4: Contract test | ✅ Selesai |
| | P2-5: Offline cache Flutter | P2 |
| | Security audit report | P1 |
| | Incident response SOP | P1 |

---

## Cara Pakai Dokumen Ini dengan AI Agent

### Setiap task di atas bisa dipakai sebagai prompt agent setelah status item dibaca.

Format untuk Codex CLI:
```
codex "Kerjakan task berikut: [paste task dari dokumen ini]"
```

Format prompt yang digunakan:
```
Role: Senior software engineer untuk Sentra monitoring angkot.
Task: [paste task description]
Files to read: [copy dari task]
Files to change: [copy dari task]
Verification: [copy dari task]
```

### Tips untuk AI Agent:

1. **Beri konteks project dulu**: Sebelum kirim task, kirim dulu:
   ```
   Baca file README.md dan AGENTS.md untuk paham project
   ```
2. **Satu task per sesi**: Jangan gabung 2 task besar dalam satu prompt
3. **Minta rencana dulu**: "Baca file X, Y, Z dan berikan rencana implementasi sebelum coding"
4. **Verifikasi selalu**: "Setelah perubahan, jalankan test/lint/build"
5. **Commit hanya jika diminta**: Jangan minta agent commit otomatis kecuali memang sudah waktunya membuat commit terpisah

---

> **Dokumen ini hidup — update setiap kali ada perubahan arsitektur atau temuan baru.**
>
> Versi: 1.0 — 30 Juni 2026
> Dibuat berdasarkan analisis kode langsung terhadap project monitoring-angkot.
