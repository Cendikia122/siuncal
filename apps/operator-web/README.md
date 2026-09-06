# Operator Web

Next.js dashboard untuk operator Monitoring Angkot Bogor.

## Local Development

Install dependency jika belum ada:

```bash
npm install
```

Jalankan dashboard:

```bash
npm run dev
```

Dashboard berjalan di [http://localhost:3000](http://localhost:3000). API gateway default dibaca dari `NEXT_PUBLIC_API_BASE_URL` dan fallback ke `http://localhost:4000`.

## Quality Gate

```bash
npm run lint
npm run build
```

Build memakai font system lokal agar tidak bergantung pada fetch Google Fonts. Sentry build wrapper hanya aktif jika `NEXT_PUBLIC_SENTRY_DSN` atau `SENTRY_DSN` diset.
