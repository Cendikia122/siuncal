# Phase 17 — Social Media Intelligence

- **Status:** needs-triage
- **Type:** feature
- **Scope:** fullstack
- **Priority:** P3 (deferred, di luar scope rilis lomba)
- **Doc status:** NOT-DONE (planned)
- **Component:** api-gateway, operator-web, db

## Context
Monitoring X/IG/FB/TikTok via API resmi berbayar, sentiment analysis, viral/influencer, auto-ticketing sosmed → `public_reports` (source `SOCIAL_MEDIA`), WhatsApp Business API. Butuh kredensial & kuota API platform.

## Acceptance Criteria
- [ ] Prasyarat: kredensial & kuota API platform, layanan sentiment.
- [ ] Tabel `social_media_posts` + `influencers`, job fetch periodik.
- [ ] Auto-ticketing ke `public_reports` dengan source `SOCIAL_MEDIA`.
- [ ] WhatsApp Business API webhook + auto-reply tiket.

## References
- `docs/ROADMAP.md` Tahap 3 Phase 17
