# Phase 21 — IoT vehicle health & predictive maintenance

- **Status:** needs-triage
- **Type:** feature
- **Scope:** fullstack
- **Priority:** P2 (strategic)
- **Doc status:** NOT-DONE
- **Component:** api-gateway, db, operator-web

## Context
Sensor kendaraan (fuel, engine temp, odometer, battery, power, DTC), health snapshot, prediksi maintenance. Butuh kontrak data device/vendor lebih dulu.

## Acceptance Criteria
- [ ] Kontrak payload sensor; tabel `vehicle_sensor_readings`, `vehicle_health_latest`, `maintenance_predictions`, `maintenance_actions`.
- [ ] Rules: engine temp tinggi, fuel drop abnormal, odometer mismatch, power disconnect; maintenance risk score + schedule automation.
- [ ] Dashboard compliance maintenance owner; prediksi explainable; action ter-audit.

## References
- `docs/plans/2026-06-30-...unfinished-tasks.md` Phase 21
