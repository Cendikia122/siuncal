# Telemetry Simulator (GPS Simulation)

Script simulasi GPS untuk mengirim data posisi kendaraan secara berkala ke server. Berguna untuk testing sebelum memasang GPS hardware sungguhan.

## Fitur

- Simulasi 45 kendaraan aktif dari 10 pemilik demo pada trayek 01/02/03
- Simulasi 4 passenger publik yang bergerak di rute Bogor
- Pengiriman data GPS default setiap 5 detik sesuai target interval pilot (dapat diubah)
- Pergerakan kendaraan mengikuti rute yang ditentukan
- Data realistis: speed, heading, battery, signal
- Auto-retry jika gagal kirim

## Instalasi

```bash
cd services/telemetry-ingestion
npm install
```

## Penggunaan

### Jalankan dengan interval default (5 detik)

```bash
npm run simulate
```

### Jalankan dengan interval pilot (5 detik)

```bash
npm run simulate:quick
```

### Jalankan passenger location simulator

Simulator ini login sebagai user seed `PUBLIC_USER`, mengambil `passenger_tracking_token`, lalu mengirim lokasi ke `POST /telemetry/passenger`. Dashboard operator akan menerima update lewat `PASSENGER_LATEST`; aktifkan tombol `Tampilkan passenger` di monitoring dashboard untuk melihat marker `P` bergerak.

```bash
npm run simulate:passenger
```

Interval cepat untuk demo:

```bash
npm run simulate:passenger:quick
```

### Jalankan dengan custom interval (dalam milidetik)

```bash
INTERVAL_MS=120000 node simulator.js
```

### Tentukan API URL server

```bash
API_URL=http://localhost:4000 node simulator.js
```

### Jalankan via Docker network compose

Jika stack dijalankan lewat `infra/docker-compose/docker-compose.yml`, simulator bisa dijalankan sebagai container sementara:

```bash
docker run --rm --network monitoring-angkot_monitoring-network \
  -v "$PWD/services/telemetry-ingestion:/app" \
  -w /app \
  node:20-alpine \
  sh -lc 'npm install --ignore-scripts && API_URL=http://api-gateway:4000 npm run simulate:quick'
```

Passenger simulator juga tersedia sebagai Docker Compose profile:

```bash
docker compose -f infra/docker-compose/docker-compose.yml --profile simulator up -d passenger-location-simulator
docker compose -f infra/docker-compose/docker-compose.yml logs -f passenger-location-simulator
```

## Konfigurasi

File `config.js` berisi:

- `VEHICLES`: Daftar kendaraan yang disimulasikan
- `ROUTES`: Rute per trayek (koordinat lat/lon)
- `CONFIG`: Pengaturan API dan interval
- `passenger-simulator.js`: daftar seed passenger dan rute gerak live untuk layer passenger dashboard

### Menambah kendaraan baru

Edit `config.js` dan tambahkan ke array `VEHICLES`:

```javascript
{
  vehicle_id: null,
  plate_no: 'F 9999 ZZ',
  route_id: '99',
  route_name: 'Trayek Baru',
  start_lat: -6.5900,
  start_lon: 106.8100,
  speed_kmh: 25,
  heading: 0,
  status: 'IN_SERVICE',
  device_id: null,
  imei_or_serial: '86753090999',
  battery: 0.90,
  signal_dbm: -75
}
```

### Menambah rute baru

Tambahkan ke object `ROUTES`:

```javascript
'99': [
  { lat: -6.5900, lon: 106.8100 },
  { lat: -6.5910, lon: 106.8110 },
  ...
]
```

## Output

Contoh output di console:

```
=== GPS Telemetry Simulator Started ===
API URL: http://localhost:4000/telemetry/vehicle
Interval: 300 seconds
Vehicles: 45
====================================

[2026-01-31 10:00:00] Sending telemetry updates...
  ✓ F 1923 AB: lat=-6.603866, lon=106.796538, speed=30.2 km/h
  ✓ F 1102 CD: lat=-6.607318, lon=106.801546, speed=25.5 km/h
  ✓ F 1234 ZZ: lat=-6.589166, lon=106.792999, speed=34.8 km/h

[2026-01-31 10:05:00] Sending telemetry updates...
  ✓ F 1923 AB: lat=-6.597629, lon=106.799568, speed=29.8 km/h
  ...
```

## Payload Telemetry

Simulator mengirim payload ke `POST /telemetry/vehicle` dengan kontrak berikut:

```json
{
  "vehicle_id": null,
  "plate_no": "F 1901 AK",
  "device_id": null,
  "imei_or_serial": "86753090101",
  "ts": "2026-01-25T10:15:30.123Z",
  "lat": -6.595038,
  "lon": 106.816635,
  "speed_kmh": 23.5,
  "heading": 120,
  "accuracy_m": 8,
  "status": "IN_SERVICE",
  "device": {
    "device_id": null,
    "imei_or_serial": "86753090101",
    "battery": 0.87,
    "signal_dbm": -85
  }
}
```

Response sukses dari API:

```json
{ "ok": true }
```

## Stop Simulation

Tekan `Ctrl+C` untuk menghentikan simulator.

## Catatan

- Pastikan server API sudah berjalan sebelum menjalankan simulator
- Simulator default memakai `plate_no` dan `imei_or_serial` dari seed DB agar kendaraan bisa di-resolve tanpa UUID hardcoded
- Untuk development, gunakan interval 30 detik untuk melihat perubahan lebih cepat
- Untuk produksi, gunakan interval 5 menit (default)
