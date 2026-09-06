# Services

Backend dibagi menjadi beberapa service agar mudah di-deploy dan diskalakan:
- `api-gateway/`: auth, RBAC, REST/GraphQL entrypoint
- `telemetry-ingestion/`: menerima ping lokasi dari device
- `rules-engine/`: deteksi anomali (off-route/ngetem/overspeed/lost-signal)
- `notification-service/`: push/WA/SMS/email (sesuai kebutuhan)

