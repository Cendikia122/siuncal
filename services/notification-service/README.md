# notification-service

Service notifikasi sederhana berbasis polling incidents (logging + status update).
Dashboard web menerima notifikasi real-time melalui API gateway `WS /realtime`; service ini tetap menjadi fallback worker untuk membuat dan memproses row `notifications` dari incident yang belum dibuatkan notifikasi.

## Menjalankan
```sh
cd services/notification-service
cp .env.example .env
npm install
npm run dev
```
