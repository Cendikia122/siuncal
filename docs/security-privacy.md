# Sentra — Security & Privacy Tracking

Dokumen ini melacak konsen keamanan dan privasi Sentra, baik yang **global** (lintas fitur)
maupun **per-fitur**. Tujuannya agar setiap keputusan privasi/keamanan mudah dilacak: apa yang
sudah diimplementasi, apa yang masih rencana, dan di mana buktinya di codebase atau issue.

- **Audit terakhir:** 2026-07-23
- **Sumber otoritatif:** `CONTEXT.md`, `docs/adr/`, `docs/16-public-report-and-passenger-mobile.md`, `.scratch/`
- **Cakupan:** monorepo Sentra, deployment Docker Compose, API gateway, aplikasi operator/mobile, telemetry, dan evidence storage

## Legenda Status

| Simbol | Arti |
| --- | --- |
| ✅ Implemented | Sudah ada di codebase dan terverifikasi (test/build) |
| 🟡 Partial | Sebagian terimplementasi; sisanya tercatat di issue |
| 🟠 Planned | Belum dibangun; masih hidup sebagai issue lokal |
| 🔴 Gap | Risiko diketahui, belum ada issue/keputusan |

Tingkat risiko: **High** (dampak besar / sulit dibalik), **Medium**, **Low**.

---

## 1. Konsen Global

### 1.1 Identity & Authentication

- **Konsen:** pengambilalihan akun operator/public user serta replay session atau refresh token.
- **Keputusan/aturan:** role dan aktor didefinisikan di `CONTEXT.md`; internal service tidak memakai JWT publik.
- **Implementasi:** JWT production/staging wajib kuat dan non-default; refresh token disimpan sebagai hash, dirotasi, dan dapat direvoke; mutasi cookie-session memakai CSRF double-submit. Bukti: `services/api-gateway/src/server.js`, `db/migrations/003_auth_security.sql`, `db/migrations/016_mobile_public_release.sql`.
- **Catatan risiko:** audit produksi final belum selesai. Raw verification/reset token masih disalin ke payload `account_email_outbox`.
- **Status:** 🟡 Partial.

### 1.2 Authorization & Multi-Tenancy (scope/tenant isolation)

- **Konsen:** akses role yang terlalu luas terhadap identitas, lokasi, laporan, atau attachment.
- **Keputusan/aturan:** data sensitif dibatasi role, diaudit, dan dimasking; GPS kendaraan adalah sumber kebenaran (ADR-0003).
- **Implementasi:** backend memakai `requireRole`, ownership pada `/me/public-reports`, masking passenger untuk OPERATOR, serta download attachment khusus OPERATOR/ANALISA. Bukti: `services/api-gateway/src/server.js`, `services/api-gateway/src/passenger-location-access.js`, `services/api-gateway/test/operator-authorization-contract.test.js`.
- **Catatan risiko:** response public-report operator masih dapat memuat identitas reporter dan lokasi lengkap. Scope kebutuhan OPERATOR versus ANALISA harus diputuskan dalam security audit.
- **Status:** 🟡 Partial.

### 1.3 Media & Object Storage

- **Konsen:** evidence menjadi publik, metadata lokasi bocor, file berbahaya tersimpan, atau binary masuk ke database.
- **Keputusan/aturan:** binary evidence disimpan di MinIO/S3; PostgreSQL hanya menyimpan metadata/pointer (ADR-0002). Attachment tidak memakai URL publik permanen (`docs/16-public-report-and-passenger-mobile.md`).
- **Implementasi:** evidence diakses melalui API role-gated; upload memakai magic-byte/MIME check, decode, re-encode, EXIF strip, clamp 1600 px, batas output, serta checksum sanitized buffer. Bukti: `services/api-gateway/src/image-validation.js`, `services/api-gateway/src/object-storage.js`, `services/api-gateway/src/server.js`, `services/api-gateway/test/image-validation.test.js`.
- **Catatan risiko:** private bucket policy dan least-privilege service credential belum diverifikasi sebagai deployment contract; compose masih memakai kredensial root MinIO.
- **Status:** 🟡 Partial secara global; normalisasi evidence ✅ Implemented.

### 1.4 Perlindungan Kredensial & Secret

- **Konsen:** secret tersimpan di Git/remote URL atau runtime memakai nilai default.
- **Implementasi:** `.env` di-ignore; non-development menolak `JWT_SECRET` kosong/default/lemah; key material direferensikan melalui environment. Pada 2026-07-23 token yang tertanam di `origin` telah dikirim ke endpoint revocation GitHub, pengujian autentikasinya menghasilkan `401`, dan URL `origin` dibersihkan.
- **Catatan risiko:** production masih berbasis `.env`; pemilihan secret manager, rotasi secret, dan kredensial MinIO non-root belum selesai. Security log GitHub tetap perlu ditinjau untuk aktivitas selama token terekspos.
- **Status:** 🟠 Planned untuk secret management (#5), dengan tindakan revoke token sudah selesai.

### 1.5 PII & Data Minimization

- **Konsen:** lokasi passenger/reporter, identitas owner/driver/device, dan evidence disimpan atau ditampilkan melebihi kebutuhan.
- **Implementasi:** masking passenger dan field sensitif berbasis role; account deletion menghapus posisi passenger dan menganonimkan user; retention telemetry tertentu didefinisikan di `db/migrations/019_timescale_policies.sql`.
- **Catatan risiko:** retensi public report, attachment, audit log, incident, dan outbox belum disahkan.
- **Status:** 🟡 Partial; kebijakan lanjutan 🟠 Planned (#16).

### 1.6 Consent

- **Konsen:** passenger tracking berjalan tanpa persetujuan aktif atau pencabutan tidak tercatat lengkap.
- **Implementasi:** consent tracking dicatat sebelum token tracking diterbitkan; token tracking terpisah dari session operator (ADR-0003). Bukti: `services/api-gateway/src/server.js`, `db/migrations/016_mobile_public_release.sql`.
- **Catatan risiko:** revoke session menghentikan token tetapi belum mengisi `passenger_tracking_consents.revoked_at`.
- **Status:** 🟡 Partial; keputusan operasional masuk #16.

### 1.7 Audit Logging

- **Konsen:** akses atau perubahan data sensitif tidak dapat ditelusuri.
- **Implementasi:** audit log menyimpan actor, action, entity, IP, user-agent, dan metadata; banyak operasi passenger/report/master-data diaudit. Bukti: `db/migrations/004_audit_log.sql`, `services/api-gateway/src/server.js`, `services/api-gateway/test/audit-log-contract.test.js`.
- **Catatan risiko:** download attachment belum menulis audit event dan retensi audit belum diputuskan.
- **Status:** 🟡 Partial (#9/#16).

### 1.8 Input Validation & File Upload Safety

- **Konsen:** MIME spoofing, gambar rusak/decompression bomb, payload sangat besar, dan EXIF GPS.
- **Implementasi:** allowlist JPEG/PNG/WebP, magic-byte check, container integrity, Sharp decode dengan pixel limit, resize tanpa upscale, re-encode tanpa metadata, output-size limit, dan validasi ulang hasil. Checksum dihitung dari buffer yang sudah disanitasi.
- **Verifikasi:** `services/api-gateway/test/image-validation.test.js` dan `services/api-gateway/test/report-security-contract.test.js`; seluruh API gateway suite lulus pada 2026-07-23.
- **Status:** ✅ Implemented untuk public-report evidence dan emergency proof.

### 1.9 External Services (AI, Email, Storage)

- **Konsen:** PII/evidence keluar ke vendor, keputusan otomatis menjadi sanksi, atau kredensial vendor bocor.
- **Keputusan/aturan:** automated review berbasis rules, bukan LLM (ADR-0004); OCR lokal, asynchronous, evidence-only, dan tidak memicu sanksi (ADR-0005/ADR-0008).
- **Catatan risiko:** external notification gateway, pipeline OCR penuh, approval dataset nyata, dan kebijakan vendor belum selesai. Raw account token dalam email outbox adalah gap yang belum memiliki issue khusus.
- **Status:** 🟠 Planned, dengan 🔴 Gap pada perlindungan payload token email.

### 1.10 Network Exposure & Rate Limiting

- **Implementasi:** CORS wildcard ditolak, security headers/HSTS tersedia, Redis-backed rate limiting memiliki fallback, serta Caddy menyediakan jalur TLS. Bukti: `services/api-gateway/src/server.js`, `infra/reverse-proxy/Caddyfile`, `services/api-gateway/test/report-security-contract.test.js`.
- **Catatan risiko:** TLS profile masih opt-in; default development mengizinkan cookie non-secure/DB non-SSL dan API direct HTTP. Domain produksi belum divalidasi.
- **Status:** 🟡 Partial (#6 lalu #9).

---

## 2. Konsen Per-Fitur

| Fitur | Issue | Status build | Konsen privasi/keamanan utama | Risiko | Status konsen |
| --- | --- | --- | --- | --- | --- |
| Server-side image normalization + EXIF strip | `.scratch/public-report-evidence-processing/issues/02-server-side-image-normalization-exif-strip.md` (#1) | done | EXIF GPS, file integrity, ukuran/dimensi, checksum sanitized buffer | High | ✅ |
| Evidence-processing worker | `.scratch/public-report-evidence-processing/issues/01-evidence-processing-worker.md` (#12) | ready-for-agent | Async thumbnail/quality, checksum, retry, observability | Medium | 🟡 |
| Passenger tracking & retention | `.scratch/governance-policies/issues/01-governance-and-retention-policies.md` (#16) | ready-for-human | Exact location, consent, masking, retention | High | 🟡/🟠 |
| Security audit | `.scratch/production-readiness/issues/01-security-audit-report.md` (#9) | ready-for-agent | Reporter masking, attachment audit, TLS/CORS/secrets | High | 🟠 |
| Secret management | `.scratch/production-readiness/issues/06-secret-management-vault.md` (#5) | ready-for-human | Runtime injection, rotation, least privilege | High | 🟠 |
| TLS/HSTS/CSP validation | `.scratch/production-readiness/issues/07-production-tls-hsts-csp-validation.md` (#6) | ready-for-agent | HTTPS, secure cookie, headers, production domain | High | 🟡 |
| OCR ML pipeline | `.scratch/plate-ocr-ml-pipeline/` (#17–#21) | planned/mixed | Foto sensitif, local-only, no auto-enforcement, legal approval | High | 🟠 |
| External notification gateway | `.scratch/notification-external-gateway/issues/01-external-notification-gateway.md` (#15) | ready-for-human | Vendor credentials, PII destination, retry/idempotency | High | 🟠 |
| Telemetry device auth | `.scratch/telemetry-device-hardening/issues/02-mtls-device-auth-decision.md` (#22) | needs-triage | Static token/HMAC, mTLS, credential rotation | Medium | 🟡/🟠 |
| Public transparency | `.scratch/strategic-roadmap/issues/05-phase23-public-transparency.md` (#28) | needs-triage | Mencegah PII, attachment, dan raw tracking menjadi publik | High | 🟠 |

---

## 3. Backlog Keamanan (Actionable)

1. **[High] Jalankan security audit final** — tutup scope reporter identity untuk non-ANALISA, audit attachment download, private bucket policy, TLS/CORS/DB SSL, dan secret review melalui #9.
2. **[High] Putuskan secret manager dan rotasi seluruh secret produksi** — gunakan service credential MinIO non-root melalui #5.
3. **[High] Tetapkan retention dan governance** — public report/evidence/audit/outbox/incident, sinkronkan consent revocation ledger, dan tetapkan owner/review date melalui #16.
4. **[High] Lindungi raw account token di email outbox** — buat issue khusus untuk scrub payload setelah `SENT`, purge token kedaluwarsa, dan evaluasi encryption-at-rest. Saat ini 🔴 Gap.
5. **[High] Validasi TLS produksi** — `COOKIE_SECURE=true`, HSTS/CSP/CORS allowlist, DB SSL, dan pencegahan direct HTTP exposure melalui #6 lalu #9.
6. **[Medium] Verifikasi bucket evidence private lewat deployment test/policy-as-code** — private-by-design belum menjadi kontrol deployment yang dapat diuji.
7. **[Medium] Rekonsiliasi tracker evidence worker/OCR dengan kode aktual** — jangan klaim pipeline OCR implemented sebelum worker/model/test-nya benar-benar ada.

---

## 4. Referensi

- **ADR:** `docs/adr/0002-postgres-postgis-timescaledb-single-datastore.md`, `0003-gps-is-source-of-truth-passenger-location-evidence.md`, `0004-rules-assisted-review-not-llm.md`, `0005-ocr-evidence-only-local-async.md`, `0008-ocr-worker-deployment-resource-isolation.md`.
- **Domain rules:** `CONTEXT.md`, `CONTEXT-MAP.md`, `docs/16-public-report-and-passenger-mobile.md`.
- **Issue tracker:** `.scratch/EXECUTION-ORDER.md`, `.scratch/<feature>/issues/*.md`.
- **Riwayat relevan:** commit `428c836`, `60e1be4`, `536719e`, `ffd7598`, `b90607b`.
- **Kode kunci:**
  - Auth/authz: `services/api-gateway/src/server.js`
  - Storage: `services/api-gateway/src/object-storage.js`
  - Credential/secret: `.gitignore`, `infra/docker-compose/.env.example`, `infra/docker-compose/docker-compose.yml`
  - Media/upload: `services/api-gateway/src/image-validation.js`, `services/api-gateway/test/image-validation.test.js`

> Dokumen ini harus diperbarui setiap kali fitur baru menyentuh PII, media, kredensial, atau
> boundary authorization. Perbarui status per-fitur saat issue terkait berpindah dari
> `ready-for-agent` → `done`.
