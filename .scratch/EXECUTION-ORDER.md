# Urutan Pengerjaan Issue (Execution Order)

Urutan global `#1 → #31` untuk seluruh backlog di `.scratch/`. Nomor global = urutan bila hanya **1 pengerjaan** (single worker). Bila ada **beberapa pengerjaan paralel**, ikuti **lane** di tiap gelombang — item pada lane berbeda dalam satu gelombang boleh jalan bersamaan.

Legenda status: `[done]` selesai · `[agent]` ready-for-agent · `[human]` ready-for-human · `[triage]` needs-triage · `[blocked]` needs-info.
Legenda lane: 🟦 Backend/Infra · 🟩 Frontend/Mobile · 🟨 OCR · 🟧 Human/Keputusan (kebijakan, vendor, approval).

## Cara membaca nomor dan identitas issue

Nomor pada roadmap dan nomor pada nama file adalah dua hal berbeda:

- **Nomor global** (`#1` sampai `#31`) hanya menunjukkan urutan pengerjaan lintas seluruh folder `.scratch/`.
- **Nomor lokal** (`01`, `02`, dan seterusnya pada nama file) dimulai ulang dari `01` di setiap folder feature.
- Karena nomor lokal dapat berulang, identitas issue yang benar harus selalu dibaca sebagai **folder + nama file + judul issue**.
- Jangan merujuk issue hanya sebagai `issues/01`; gunakan path lengkap, misalnya `governance-policies/issues/01-governance-and-retention-policies.md`.

Contoh:

- Global **#16** → folder `governance-policies` → file lokal `01-governance-and-retention-policies.md`.
- Global **#17** → folder `plate-ocr-ml-pipeline` → file lokal `01-foundation-scaffold-migration.md`.
- Keduanya memakai nomor lokal `01`, tetapi merupakan issue yang berbeda karena folder dan nama filenya berbeda.

## Indeks identitas lengkap

Kolom **Global** adalah nomor roadmap. Kolom **File issue lokal** adalah file sumber kebenaran yang harus dibuka, dikerjakan, dan dicentang acceptance criteria-nya.

| Global | Folder feature | File issue lokal | Nama issue | Status |
| --- | --- | --- | --- | --- |
| **#1** | `public-report-evidence-processing` | [02-server-side-image-normalization-exif-strip.md](public-report-evidence-processing/issues/02-server-side-image-normalization-exif-strip.md) | Server-side image normalization + EXIF strip untuk evidence laporan | `done` |
| **#2** | `telemetry-device-hardening` | [03-compose-healthchecks-services.md](telemetry-device-hardening/issues/03-compose-healthchecks-services.md) | Formal compose healthchecks (rules-engine & notification-service) | `done` |
| **#3** | `production-readiness` | [10-cicd-coverage-expansion.md](production-readiness/issues/10-cicd-coverage-expansion.md) | CI/CD coverage expansion | `done` |
| **#4** | `production-readiness` | [05-production-contract-test.md](production-readiness/issues/05-production-contract-test.md) | Dedicated production contract test | `done` |
| **#5** | `production-readiness` | [06-secret-management-vault.md](production-readiness/issues/06-secret-management-vault.md) | Production secret management decision (vault vs .env) | `ready-for-human` |
| **#6** | `production-readiness` | [07-production-tls-hsts-csp-validation.md](production-readiness/issues/07-production-tls-hsts-csp-validation.md) | Production TLS, HSTS, and security headers validation | `ready-for-agent` |
| **#7** | `production-readiness` | [04-prometheus-grafana-metrics.md](production-readiness/issues/04-prometheus-grafana-metrics.md) | Prometheus metrics endpoint + Grafana dashboard | `ready-for-agent` |
| **#8** | `production-readiness` | [03-real-load-test-execution.md](production-readiness/issues/03-real-load-test-execution.md) | Real load test execution (bukan hanya scaffold) | `ready-for-agent` |
| **#9** | `production-readiness` | [01-security-audit-report.md](production-readiness/issues/01-security-audit-report.md) | Security audit report + secret review | `ready-for-agent` |
| **#10** | `production-readiness` | [02-incident-response-sop.md](production-readiness/issues/02-incident-response-sop.md) | Incident response SOP (operasional sistem) | `ready-for-agent` |
| **#11** | `production-readiness` | [11-deployment-go-live-checklist.md](production-readiness/issues/11-deployment-go-live-checklist.md) | Deployment go-live checklist execution | `ready-for-human` |
| **#12** | `public-report-evidence-processing` | [01-evidence-processing-worker.md](public-report-evidence-processing/issues/01-evidence-processing-worker.md) | Public-report evidence processing worker (thumbnail/quality) | `ready-for-agent` |
| **#13** | `passenger-mobile-resilience` | [01-offline-first-cache-vehicles.md](passenger-mobile-resilience/issues/01-offline-first-cache-vehicles.md) | Offline-first cache untuk /public/vehicles (Flutter) | `ready-for-agent` |
| **#14** | `passenger-mobile-resilience` | [02-fix-map-nearby-lint-warnings.md](passenger-mobile-resilience/issues/02-fix-map-nearby-lint-warnings.md) | Fix map/nearby lint warnings (Flutter) | `ready-for-agent` |
| **#15** | `notification-external-gateway` | [01-external-notification-gateway.md](notification-external-gateway/issues/01-external-notification-gateway.md) | External notification gateway (WhatsApp/SMS/email) | `ready-for-human` |
| **#16** | `governance-policies` | [01-governance-and-retention-policies.md](governance-policies/issues/01-governance-and-retention-policies.md) | Governance, retention & AI-approval policies | `ready-for-human` |
| **#17** | `plate-ocr-ml-pipeline` | [01-foundation-scaffold-migration.md](plate-ocr-ml-pipeline/issues/01-foundation-scaffold-migration.md) | OCR Phase 0-1: Foundation scaffold + DB migration | `ready-for-agent` |
| **#18** | `plate-ocr-ml-pipeline` | [02-dataset-audit-and-split.md](plate-ocr-ml-pipeline/issues/02-dataset-audit-and-split.md) | OCR Phase 2-3: Dataset audit + reproducible split | `ready-for-human` |
| **#19** | `plate-ocr-ml-pipeline` | [03-detector-recognizer-training-eval.md](plate-ocr-ml-pipeline/issues/03-detector-recognizer-training-eval.md) | OCR Phase 4-6: Detector + recognizer training + E2E eval | `ready-for-human` |
| **#20** | `plate-ocr-ml-pipeline` | [04-worker-integration-hardening-testing.md](plate-ocr-ml-pipeline/issues/04-worker-integration-hardening-testing.md) | OCR Phase 7-9: Worker integration + hardening + testing | `needs-triage` |
| **#21** | `plate-ocr-ml-pipeline` | [05-observability-deploy-bogor-readiness.md](plate-ocr-ml-pipeline/issues/05-observability-deploy-bogor-readiness.md) | OCR Phase 10-12: Observability + deployment + Bogor production readiness | `ready-for-human` |
| **#22** | `telemetry-device-hardening` | [02-mtls-device-auth-decision.md](telemetry-device-hardening/issues/02-mtls-device-auth-decision.md) | Keputusan mTLS device auth (di atas HMAC) | `needs-triage` |
| **#23** | `production-readiness` | [08-cdn-provider-provisioning.md](production-readiness/issues/08-cdn-provider-provisioning.md) | CDN provider provisioning for /public/vehicles | `ready-for-human` |
| **#24** | `production-readiness` | [09-postgres-read-replica.md](production-readiness/issues/09-postgres-read-replica.md) | Postgres read replica & read/write split | `needs-triage` |
| **#25** | `telemetry-device-hardening` | [01-physical-gt06-integration-verification.md](telemetry-device-hardening/issues/01-physical-gt06-integration-verification.md) | Verifikasi integrasi GPS fisik GT06 (bukan simulator) | `needs-info` |
| **#26** | `strategic-roadmap` | [02-phase20-ai-forecasting.md](strategic-roadmap/issues/02-phase20-ai-forecasting.md) | Phase 20 — AI availability & demand forecasting | `needs-triage` |
| **#27** | `strategic-roadmap` | [03-phase21-iot-maintenance.md](strategic-roadmap/issues/03-phase21-iot-maintenance.md) | Phase 21 — IoT vehicle health & predictive maintenance | `needs-triage` |
| **#28** | `strategic-roadmap` | [05-phase23-public-transparency.md](strategic-roadmap/issues/05-phase23-public-transparency.md) | Phase 23 — Public transparency portal & open data | `needs-triage` |
| **#29** | `strategic-roadmap` | [04-phase22-route-optimization.md](strategic-roadmap/issues/04-phase22-route-optimization.md) | Phase 22 — ML route optimization simulation | `needs-triage` |
| **#30** | `strategic-roadmap` | [01-phase17-social-media-intelligence.md](strategic-roadmap/issues/01-phase17-social-media-intelligence.md) | Phase 17 — Social Media Intelligence | `needs-triage` |
| **#31** | `strategic-roadmap` | [06-p3-urban-mobility-and-k8s.md](strategic-roadmap/issues/06-p3-urban-mobility-and-k8s.md) | P3 — Integrated urban mobility intelligence + K8s production deploy | `needs-triage` |

> Tugas **#0** bukan file issue lokal: revoke token GitHub yang bocor dari `git remote origin`. Status: **selesai 2026-07-23**.

> **Dua track panjang yang boleh dimulai paralel sejak awal** (non-blocking, lintas gelombang):
> - 🟧 **#16 Governance policies** — long-running; hanya memblokir #21/#28/#29. Mulai kapan saja.
> - 🟨 **#17 OCR foundation** — murah & non-blocking; boleh dikerjakan berbarengan Gelombang A-C.

---

## Gelombang A — Quick win risiko/privasi & higiene
Semua item di sini **independen → boleh paralel penuh**.

- 🟦 **#1** Server-side image normalization + EXIF strip untuk evidence laporan `[done]` — [public-report-evidence-processing / 02-server-side-image-normalization-exif-strip.md](public-report-evidence-processing/issues/02-server-side-image-normalization-exif-strip.md)
- 🟦 **#2** Formal compose healthchecks (rules-engine & notification-service) `[done]` — [telemetry-device-hardening / 03-compose-healthchecks-services.md](telemetry-device-hardening/issues/03-compose-healthchecks-services.md)
- 🟦 **#3** CI/CD coverage expansion `[done]` — [production-readiness / 10-cicd-coverage-expansion.md](production-readiness/issues/10-cicd-coverage-expansion.md)
- 🟦 **#4** Dedicated production contract test `[done]` — [production-readiness / 05-production-contract-test.md](production-readiness/issues/05-production-contract-test.md)
- 🟩 **#14** Fix map/nearby lint warnings (Flutter) `[agent]` — [passenger-mobile-resilience / 02-fix-map-nearby-lint-warnings.md](passenger-mobile-resilience/issues/02-fix-map-nearby-lint-warnings.md) (trivial; ditarik ke sini agar lane FE terisi)

Paralel awal: {#1, #2, #3, #4} ∥ {#14}. **#1, #2, #3, dan #4 sudah selesai**; lane backend Gelombang A selesai dan pekerjaan berikutnya adalah #14 di lane frontend. Kickoff track panjang #16 & #17 dapat dilakukan di sini juga.

Verifikasi penyelesaian #1 (2026-07-23): seluruh acceptance criteria dicentang; 18/18 test terarah dan 102/102 suite API gateway lulus.

Verifikasi penyelesaian #2 (2026-07-23): compose config valid; kedua service terbukti `healthy` saat dependency tersedia dan `unhealthy` saat database tidak terjangkau; 45 test rules-engine dan 2 test notification-service lulus.

Verifikasi penyelesaian #3 (2026-07-23): seluruh job wajib tersedia; plain `npm ci` Node 20, 149 service tests, 10 readiness tests, operator-web lint/build, 28 Flutter tests, Compose validation, dan discovery Playwright smoke lulus.

Verifikasi penyelesaian #4 (2026-07-23): production contract test live lulus 4/4 dan seluruh suite API gateway lulus 106/106; pagination, error envelope, dashboard 401/403, serta 429 dengan `Retry-After` terverifikasi.

---

## Gelombang B — Gate go-live pilot (P1)
Tiga lane berjalan bersamaan; lalu titik gabung sebelum penutup.

- 🟧 Lane keputusan: **#5** Production secret management decision (vault vs .env) `[human]` — [production-readiness / 06-secret-management-vault.md](production-readiness/issues/06-secret-management-vault.md) (mulai awal; memblokir #9 & #11)
- 🟦 Lane observability, berurutan:
  - **#6** Production TLS, HSTS, and security headers validation `[agent]` — [production-readiness / 07-production-tls-hsts-csp-validation.md](production-readiness/issues/07-production-tls-hsts-csp-validation.md)
  - → **#7** Prometheus metrics endpoint + Grafana dashboard `[agent]` — [production-readiness / 04-prometheus-grafana-metrics.md](production-readiness/issues/04-prometheus-grafana-metrics.md)
  - → **#8** Real load test execution (bukan hanya scaffold) `[agent]` — [production-readiness / 03-real-load-test-execution.md](production-readiness/issues/03-real-load-test-execution.md) (butuh #7)
- 🟦 Lane runbook: **#10** Incident response SOP (operasional sistem) `[agent]` — [production-readiness / 02-incident-response-sop.md](production-readiness/issues/02-incident-response-sop.md) (independen → paralel dengan lane observability)

Titik gabung:
- **#9** Security audit report + secret review `[agent]` — [production-readiness / 01-security-audit-report.md](production-readiness/issues/01-security-audit-report.md) (butuh #5, #6, #7)
- **#11** Deployment go-live checklist execution `[human]` — [production-readiness / 11-deployment-go-live-checklist.md](production-readiness/issues/11-deployment-go-live-checklist.md) (butuh #8, #9, #5) → **pilot terbatas <100 angkot siap dievaluasi**

Paralel: {#5} ∥ {#6→#7→#8} ∥ {#10} → #9 → #11.

---

## Gelombang C — Kelengkapan fitur & resiliensi (P2)
Semua **independen → paralel** (lane BE / FE / Human).

- 🟦 **#12** Public-report evidence processing worker (thumbnail/quality) `[agent]` — [public-report-evidence-processing / 01-evidence-processing-worker.md](public-report-evidence-processing/issues/01-evidence-processing-worker.md) (butuh #1)
- 🟩 **#13** Offline-first cache untuk /public/vehicles (Flutter) `[agent]` — [passenger-mobile-resilience / 01-offline-first-cache-vehicles.md](passenger-mobile-resilience/issues/01-offline-first-cache-vehicles.md)
- 🟧 **#15** External notification gateway (WhatsApp/SMS/email) `[human]` — [notification-external-gateway / 01-external-notification-gateway.md](notification-external-gateway/issues/01-external-notification-gateway.md) (butuh vendor)

Paralel: {#12} ∥ {#13} ∥ {#15}. (#14 sudah di Gelombang A.)

---

## Gelombang D — Tata kelola (track panjang 🟧)

- 🟧 **#16** Governance, retention & AI-approval policies `[human]` — [governance-policies / 01-governance-and-retention-policies.md](governance-policies/issues/01-governance-and-retention-policies.md)
  - Boleh dimulai sejak Gelombang A dan berjalan paralel. Wajib selesai sebelum #21, #28, #29.

---

## Gelombang E — Pipeline OCR ML (track 🟨, sebagian paralel di awal)

- 🟨 **#17** OCR Phase 0-1: Foundation scaffold + DB migration `[agent]` — [plate-ocr-ml-pipeline / 01-foundation-scaffold-migration.md](plate-ocr-ml-pipeline/issues/01-foundation-scaffold-migration.md) (non-blocking; boleh paralel dgn Gelombang A-C)
- Berurutan ketat setelahnya:
  - 🟨 **#18** OCR Phase 2-3: Dataset audit + reproducible split `[human]` — [plate-ocr-ml-pipeline / 02-dataset-audit-and-split.md](plate-ocr-ml-pipeline/issues/02-dataset-audit-and-split.md) (butuh dataset)
  - 🟨 **#19** OCR Phase 4-6: Detector + recognizer training + E2E eval `[human]` — [plate-ocr-ml-pipeline / 03-detector-recognizer-training-eval.md](plate-ocr-ml-pipeline/issues/03-detector-recognizer-training-eval.md) (butuh #18)
  - 🟨 **#20** OCR Phase 7-9: Worker integration + hardening + testing `[triage]` — [plate-ocr-ml-pipeline / 04-worker-integration-hardening-testing.md](plate-ocr-ml-pipeline/issues/04-worker-integration-hardening-testing.md) (butuh #17 & #19)
  - 🟨 **#21** OCR Phase 10-12: Observability + deployment + Bogor production readiness `[human]` — [plate-ocr-ml-pipeline / 05-observability-deploy-bogor-readiness.md](plate-ocr-ml-pipeline/issues/05-observability-deploy-bogor-readiness.md) (butuh #20 + approval Dishub/legal + #16)

Paralel: #17 lebih awal; #18→#19→#20→#21 seri.

---

## Gelombang F — Skala & strategis (deferred, perlu triase produk)
Sebagian besar **independen → paralel**, tapi prioritas rendah.

- 🟦 **#22** Keputusan mTLS device auth (di atas HMAC) `[triage]` — [telemetry-device-hardening / 02-mtls-device-auth-decision.md](telemetry-device-hardening/issues/02-mtls-device-auth-decision.md)
- 🟧 **#23** CDN provider provisioning for /public/vehicles `[human]` — [production-readiness / 08-cdn-provider-provisioning.md](production-readiness/issues/08-cdn-provider-provisioning.md) (butuh domain produksi)
- 🟦 **#24** Postgres read replica & read/write split `[triage]` — [production-readiness / 09-postgres-read-replica.md](production-readiness/issues/09-postgres-read-replica.md) (hanya skala 500-2000)
- 🟦 **#25** Verifikasi integrasi GPS fisik GT06 (bukan simulator) `[blocked]` — [telemetry-device-hardening / 01-physical-gt06-integration-verification.md](telemetry-device-hardening/issues/01-physical-gt06-integration-verification.md) (menunggu hardware)
- 🟨 **#26** Phase 20 — AI availability & demand forecasting `[triage]` — [strategic-roadmap / 02-phase20-ai-forecasting.md](strategic-roadmap/issues/02-phase20-ai-forecasting.md) (setelah #16)
- 🟦 **#27** Phase 21 — IoT vehicle health & predictive maintenance `[triage]` — [strategic-roadmap / 03-phase21-iot-maintenance.md](strategic-roadmap/issues/03-phase21-iot-maintenance.md)
- 🟩 **#28** Phase 23 — Public transparency portal & open data `[triage]` — [strategic-roadmap / 05-phase23-public-transparency.md](strategic-roadmap/issues/05-phase23-public-transparency.md) (butuh #16)
- 🟨 **#29** Phase 22 — ML route optimization simulation `[triage]` — [strategic-roadmap / 04-phase22-route-optimization.md](strategic-roadmap/issues/04-phase22-route-optimization.md) (butuh #16)
- 🟩 **#30** Phase 17 — Social Media Intelligence `[triage]` — [strategic-roadmap / 01-phase17-social-media-intelligence.md](strategic-roadmap/issues/01-phase17-social-media-intelligence.md) (butuh kredensial API berbayar)
- 🟦 **#31** P3 — Integrated urban mobility intelligence + K8s production deploy `[triage]` — [strategic-roadmap / 06-p3-urban-mobility-and-k8s.md](strategic-roadmap/issues/06-p3-urban-mobility-and-k8s.md)

Paralel: #22–#31 sebagian besar bisa dikerjakan bebas urutan, kecuali {#26,#28,#29} menunggu #16.

---

## Ringkas paralelisme lintas-gelombang
- 🟦 Track backend go-live (#1-#11) ∥ 🟩 track frontend/mobile (#13, #14) ∥ 🟧 track keputusan (#5, #15, #16) ∥ 🟨 track OCR (#17 ...).
- Untuk **1 worker**: ikuti nomor #1→#31.
- Untuk **2 worker**: worker-1 di lane 🟦 backend go-live, worker-2 di 🟩/🟨 (#14 → #13 → #17 → #12 ...).
- Untuk **3 worker**: tambah 1 worker di 🟧/🟨 (#16 & #17) sejak awal.

## Dependensi keras (tidak boleh dilanggar)
- #7 → #8 · {#5,#6,#7} → #9 → #11 · #1 → #12 · #16 → {#21,#28,#29} · OCR: #17 → #18 → #19 → #20 → #21.
