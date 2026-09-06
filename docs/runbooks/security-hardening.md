# Runbook — Security Hardening (Production)

Checklist pengerasan keamanan sebelum Sentra dipakai publik (warga Bogor) di belakang HTTPS. Item bertanda ✅ sudah diberlakukan di kode/konfig; ⚠️ perlu aksi operator saat deploy.

## Rahasia & kredensial

- ✅ **Tidak ada fallback `dev-secret`.** `JWT_SECRET` di `docker-compose.yml` memakai `${JWT_SECRET:?...}` — compose menolak start bila tidak diset. Generate: `openssl rand -base64 48`. Nilai HARUS sama di `api-gateway` dan `operator-web` (proxy edge memverifikasi token).
- ✅ **api-gateway fail-fast di produksi** bila `JWT_SECRET` kosong, `= "dev-secret"`, atau < 32 char (`server.js` CRIT-01), dan bila kredensial DB tidak diset (`db.js` HIGH-06).
- ⚠️ **Ganti SEMUA `CHANGE_ME_*`** di `.env` (`POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`, `TELEMETRY_*`, `MINIO_ROOT_*`, `PASSENGER_SEED_PASSWORD`).
- ⚠️ **MinIO**: ganti `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` dari default; jangan ekspos console (9001) ke publik.
- ⚠️ Simpan `.env` di secret manager / di luar VCS (sudah di-`.gitignore`).
- ⚠️ **GOTCHA `.env` tidak auto-load dari repo root.** Compose memuat `.env` dari *current working directory*. `.env` ada di `infra/docker-compose/.env`, jadi jalankan dari sana **atau** pakai `--env-file`:
  ```sh
  docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml up -d
  ```
  Tanpa ini, compose memakai default fallback (mis. `POSTGRES_PASSWORD=monitoring`, `JWT_SECRET=dev-secret`) — aman untuk dev (api-gateway menolak boot di prod dengan secret default), tapi BUKAN nilai `.env` Anda.

## Transport & cookie

- ⚠️ **HTTPS wajib** lewat reverse proxy (Caddy + Let's Encrypt) — lihat `infra/reverse-proxy/Caddyfile`. Tanpa TLS, mobile (ATS/cleartext) & cookie `Secure` tidak jalan.
- ⚠️ Set `NODE_ENV=production` + `COOKIE_SECURE=true` → cookie `Secure`, HSTS aktif (`server.js` HIGH-07).
- ✅ Cookie auth `HttpOnly` + `SameSite` + CSRF double-submit (`sentra_csrf` + header `x-csrf-token`).

## Header & CSP

- ✅ Header API: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS (prod), CSP `frame-ancestors 'none'`.
- ✅ CSP API **tanpa `'unsafe-inline'`** pada `style-src` (API hanya serve JSON).
- ⚠️ **CSP operator-web (HTML)** belum diperketat — Next + Leaflet + framer-motion memakai inline style/transform. Untuk memperketat butuh strategi nonce di Next config + uji menyeluruh. Item lanjutan, jangan dipaksakan tanpa pengujian (risiko UI rusak).

## Telemetry device (GPS)

- ✅ `/telemetry/vehicle` menolak request bila tak ada auth dikonfigurasi (CRIT-02), validasi token statis atau HMAC.
- ⚠️ **Produksi: gunakan HMAC** (`TELEMETRY_HMAC_SECRET`) — bertanda tangan sha256 + window timestamp 5 mnt (anti-replay) > token statis. Lihat `docs/runbooks/gps-gt06-integration.md`.
- ✅ **Keputusan mTLS untuk pilot produksi:** mTLS **didefer** untuk pilot awal dan tidak menjadi blocker selama semua syarat berikut terpenuhi: endpoint telemetry hanya lewat HTTPS, HMAC aktif, token statis dinonaktifkan untuk device produksi, admin gateway/Traccar tidak publik, rate limit aktif, dan ingress telemetry dibatasi lewat VPN/IP allowlist/reverse proxy bila perangkat/gateway berada di jaringan terkelola. Risk acceptance ini hanya berlaku untuk pilot tertutup dengan adapter/gateway terkontrol.
- ⚠️ **Trigger wajib mTLS:** implementasikan mTLS atau sertifikat client per-gateway sebelum membuka ingress telemetry langsung ke internet publik, menerima device dari vendor pihak ketiga yang tidak sepenuhnya dikelola, mengoperasikan multi-vendor gateway, atau bila audit pemerintah mensyaratkan identitas cryptographic client. Catat persetujuan risk acceptance di checklist go-live sebelum pilot dimulai.

## RBAC, rate limit, audit

- ✅ RBAC OPERATOR/ANALISA + data sensitif hanya ANALISA + audit log tiap akses sensitif (terverifikasi e2e).
- ✅ Rate limit login/global/telemetry/public — **berbasis Redis** (konsisten multi-instance, WS2). Sesuaikan `*_RATE_LIMIT_MAX` untuk NAT operator seluler.
- ✅ Body limit `1mb`, upload evidence dibatasi tipe/jumlah/ukuran.

## Dependency & infra

- ✅ **api-gateway: 0 kerentanan** setelah `npm audit fix` (bump `ws` ke versi aman).
- ⚠️ **operator-web: vuln transitif `jspdf` → `dompurify` (XSS, high/critical).** `npm audit fix` gagal (ERESOLVE, proyek pakai `--legacy-peer-deps`). **Risiko praktis rendah**: `jspdf` hanya dipakai untuk export PDF *incident* dari data server (`dashboard/incidents/page.tsx`), bukan merender HTML untrusted; export reports sudah server-side. Remediasi: bump `jspdf` saat rilis kompatibel tersedia, atau pindahkan export PDF incident ke server-side (seperti CSV `apiDownload`). Pantau, jangan paksa `--force` tanpa uji build.
- ⚠️ Postgres: pakai user aplikasi least-privilege (bukan superuser) di produksi; jangan ekspos port 5433 ke publik.
- ⚠️ Redis: `REDIS_PASSWORD` wajib di produksi; jangan ekspos 6379 ke publik; `maxmemory-policy noeviction` (sudah).

## Verifikasi cepat

```sh
docker compose -f infra/docker-compose/docker-compose.yml config --quiet
curl -I https://<host>/            # cek HSTS + CSP, TLS valid
# tanpa JWT_SECRET di .env -> `docker compose up` harus GAGAL (bukan pakai dev-secret)
```
