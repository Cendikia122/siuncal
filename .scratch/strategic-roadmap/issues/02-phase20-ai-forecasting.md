# Phase 20 — AI availability & demand forecasting

- **Status:** needs-triage
- **Type:** feature
- **Scope:** fullstack
- **Priority:** P2 (strategic)
- **Doc status:** NOT-DONE
- **Component:** api-gateway, operator-web, db

## Context
Forecast ketersediaan & demand per rute/stop. Output recommendation-only, human-reviewed. Mulai dari moving-average sederhana sebelum ML lanjut.

## Acceptance Criteria
- [ ] Feature store/aggregate tables untuk fitur forecast.
- [ ] Baseline availability forecast (5/15/30/60 menit) + demand per 15 menit.
- [ ] Model registry metadata (version, window, features, metrics, reason codes) + fallback rules.
- [ ] Panel forecast explainable di dashboard + report evaluasi bulanan (MAE/MAPE).
- [ ] Endpoint forecast: recommendation-only, human-reviewed; test fallback & response shape.

## References
- `docs/plans/2026-06-30-...unfinished-tasks.md` Phase 20
