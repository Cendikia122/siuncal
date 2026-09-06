# Offline-first cache untuk /public/vehicles (Flutter)

- **Status:** ready-for-agent
- **Type:** feature
- **Scope:** frontend
- **Priority:** P2
- **Doc status:** NOT-DONE
- **Component:** passenger-mobile

## Context
Saat server tidak reachable, app hanya fallback ke 3 data contoh. Tidak ada cache lokal untuk data kendaraan publik terakhir.

## Acceptance Criteria
- [ ] Pakai `shared_preferences` yang sudah ada (hindari dependency baru bila tidak perlu).
- [ ] Cache response `/public/vehicles` yang sukses; saat gagal, kembalikan cache stale bila ada; bila kosong, fallback contoh.
- [ ] State flag membedakan live / cached-stale / sample-fallback.
- [ ] UI badge: "Data dari cache" / "Data mungkin tidak terkini" saat pakai cache stale.
- [ ] Test: live success, network failure with cache, network failure without cache.

## Verification
- `cd apps/passenger-mobile && flutter test`
- Manual: matikan backend setelah satu fetch sukses.

## References
- `docs/production-readiness-monitoring-angkot.md` P2-5
- `apps/passenger-mobile/lib/features/vehicles/data/vehicles_repository.dart`
