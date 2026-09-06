# docker-compose

Stack dependency untuk local development.

Jalankan:
```sh
docker compose -f infra/docker-compose/docker-compose.yml up -d
```

Service yang tersedia:
- Postgres + TimescaleDB/PostGIS: `localhost:5433`
- Redis: `localhost:6379`
- MinIO API untuk record playback: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`
