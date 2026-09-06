# Documentation Index

Folder ini berisi dokumen teknis pembanding dan strategi gabungan untuk MVP Monitoring Angkot.

## Dokumen Utama

- `00-mvp-core-and-rules.md`: keputusan scope gabungan. MVP core diambil dari `doc1/`, sementara rules/scoring diambil dari dokumen teknis di folder ini.
- `04-risk-scoring-and-anomaly-rules.md`: referensi rules, risk scoring, severity, decay, dan evidence.
- `05-mvp-roadmap-3-months.md`: referensi roadmap engineering 12 minggu.
- `12-implementation-sequence.md`: referensi urutan implementasi teknis.
- `13-master-data-registration.md`: field registrasi master data yang aktif dipakai MVP.
- `14-map-matching-spike.md`: hasil spike Phase 13A untuk snap GPS point ke route geometry sebelum full integration.
- `15-sentra-government-data-stakeholders.md`: kebutuhan data Pemerintah Bogor, stakeholder yang berkontribusi, dan pembagian tanggung jawab platform Sentra.
- `16-public-report-and-passenger-mobile.md`: scope Phase 14 untuk passenger mobile Android/iOS, public report wajib login, plate no/lokasi/foto wajib, MinIO attachment, dan operator review.

## Pembagian Sumber

- `doc1/`: dokumen asli project, dipakai sebagai sumber product scope.
- `docs/`: dokumen teknis pembanding, dipakai sebagai sumber rules, scoring, schema, API dashboard, dan engineering sequence.

## Keputusan MVP

MVP aktif:

- Monitoring Angkot Bogor.
- Operator pemerintah.
- GPS kendaraan.
- Route compliance.
- Incident center.
- Reporting dasar.
- RBAC Operator/Analisa.

Post-MVP aktif direncanakan:

- Passenger mobile Android/iOS dengan Expo React Native.
- Tracking angkot publik tanpa login dengan data terbatas.
- Public report wajib login, wajib plate no, wajib lokasi aktif, dan wajib foto bukti.
- Attachment public report disimpan di MinIO, sementara PostgreSQL menyimpan metadata/object key.

Rules MVP:

- `telemetry -> anomaly -> alert -> incident`.
- risk score 0-100.
- decay score.
- severity mapping.
- evidence telemetry.
- owner-level context sebagai fase lanjutan.
