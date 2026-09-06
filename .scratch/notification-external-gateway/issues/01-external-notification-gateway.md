# External notification gateway (WhatsApp/SMS/email)

- **Status:** ready-for-human
- **Type:** feature
- **Scope:** backend
- **Priority:** P1
- **Doc status:** PARTIAL (log-only)
- **Component:** notification-service

## Context
`notification-service` saat ini log-only; gateway nyata (WhatsApp/SMS/email) belum diintegrasi. Dipakai untuk notifikasi sanksi ke pemilik dan eskalasi insiden. In-app notification sudah nyata. Butuh kredensial vendor → keputusan manusia.

## Acceptance Criteria
- [ ] Pilih provider (WhatsApp Business API / SMS gateway / email SMTP-API) dan dokumentasikan.
- [ ] Integrasikan pengiriman nyata di `notification-service` dengan retry/backoff & idempotency.
- [ ] Simpan kredensial via secret management, bukan Git.
- [ ] Fallback aman bila provider down (tetap log + queue retry).
- [ ] Test unit/contract untuk sukses/gagal kirim.

## References
- `README.md` (status "Partial")
- `docs/ROADMAP.md` Tahap 3 (Notifikasi eksternal)
- `docs/qa/final-demo-readiness.md` Known Limitations
