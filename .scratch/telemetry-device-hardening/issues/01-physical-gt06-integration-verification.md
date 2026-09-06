# Verifikasi integrasi GPS fisik GT06 (bukan simulator)

- **Status:** needs-info
- **Type:** task
- **Scope:** backend
- **Priority:** P1
- **Doc status:** PARTIAL (simulator only)
- **Component:** telemetry-ingestion, api-gateway

## Context
Telemetry live saat ini dari simulator. Integrasi device fisik GT06 terdokumentasi sebagai runbook tapi belum terbukti di lapangan/produksi. Butuh hardware nyata → blocked on info/akses.

## Acceptance Criteria
- [ ] Sediakan minimal 1 device GT06 nyata + adapter Traccar untuk end-to-end test.
- [ ] Verifikasi ingest `/telemetry/vehicle` by `imei_or_serial` dengan konversi `deviceTime` → ISO-8601.
- [ ] Ukur latency end-to-end GPS → ingestion → state → dashboard.
- [ ] Dokumentasikan hasil di runbook GT06.

## Blocked on
- Ketersediaan device fisik & akses lapangan.

## References
- `docs/runbooks/gps-gt06-integration.md`
- `docs/architecture/feature-code-analysis.md` §2
- `README.md` catatan jujur (simulator)
