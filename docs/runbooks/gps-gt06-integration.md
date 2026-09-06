# Runbook — Integrasi GPS Tracker GT06 ke Dashboard Realtime

Panduan menghubungkan **GPS tracker fisik berprotokol GT06** (Concox GT06N, GT02, TR06, dan kompatibel — termasuk banyak tracker murah di pasaran) ke dashboard monitoring angkot Sentra. Ditujukan untuk pembelian & pemasangan perangkat baru.

## 1. Kenapa butuh gateway (jangan lewati)

Dashboard Sentra menerima telemetry lewat **HTTP POST JSON** ke `POST /telemetry/vehicle` (lihat `services/api-gateway/src/server.js` + kontrak `telemetry-contract.js`).

Tracker GT06 **TIDAK** bicara HTTP/JSON. Ia membuka koneksi **TCP biner** ke server dan mengirim paket protokol GT06 (login berisi IMEI, lalu paket lokasi). Jadi diperlukan **gateway penerjemah**:

```
[GPS GT06] --TCP biner (protokol GT06)--> [Traccar: gateway]
   --position forwarding (JSON/HTTP)--> [Adapter kecil] --HTTPS POST--> [Sentra /telemetry/vehicle]
```

Kita pakai **Traccar** (open-source, mendukung 200+ protokol termasuk GT06) sebagai dekoder, lalu fitur *position forwarding* Traccar mengirim posisi ter-dekode ke adapter kecil yang memetakannya ke kontrak Sentra.

## 2. Kontrak telemetry Sentra (target adapter)

`POST {API}/telemetry/vehicle` — JSON, header auth wajib. Field (dari `telemetry-contract.js`):

| Field | Wajib | Catatan |
|-------|-------|---------|
| `lat`, `lon` | ✅ | desimal derajat |
| `speed_kmh` | opsional | 0–200 |
| `heading` (atau `heading_deg`) | opsional | 0–360 |
| `status` (atau `mode`) | opsional | `IN_SERVICE`/`DEADHEAD_TO_BASE`/`OUT_OF_SERVICE`/`MAINTENANCE`/`EMERGENCY` |
| `device.battery`, `device.signal_dbm`, `device.power_connected` | opsional | dipakai untuk health/tamper signal |
| `ts` (atau `timestamp`) | opsional | **String ISO-8601 wajib** jika dikirim; default `now()`. Unix epoch ms **tidak diterima**. |
| identitas kendaraan | ✅ salah satu | `vehicle_id` **atau** `plate_no` **atau** `imei_or_serial`/`device_id` |

**Resolusi kendaraan** (`server.js`): `vehicle_id` → `plate_no` → `imei_or_serial`/`device_id` → tabel `devices` → `assignments` aktif → `vehicle`. Jika tak ada yang cocok → `404`. **Untuk GT06 kita pakai `imei_or_serial` = IMEI tracker.**

> **Format waktu GT06N**: Protokol binary GT06N mengirimkan waktu sebagai field terpisah (Year, Month, Day, Hour, Minute, Second) — **bukan Unix epoch ms**. Traccar mendekode field-field tersebut dan mengeksposnya sebagai `deviceTime` dalam format ISO-8601 di position forwarding JSON. Adapter cukup meneruskan `position.deviceTime` ke field `ts` Sentra — tidak perlu konversi tambahan.

Header auth (pilih satu, `verifyTelemetryAuth`):
- **Token statis** (dev/sederhana): `x-telemetry-token: <TELEMETRY_INGEST_TOKEN>`.
- **HMAC (disarankan produksi)**: `x-telemetry-timestamp: <ISO>` + `x-telemetry-signature: sha256=<hmac>` dengan `HMAC-SHA256(secret, "<timestamp>.<rawJsonBody>")`. Window 5 menit (anti-replay).

## 3. Beli & setup perangkat GT06

1. **Beli**: tracker GT06-compatible (mis. Concox GT06N) + **kartu SIM** data (operator dengan sinyal baik di rute angkot). Catat **IMEI** tiap unit (di body/box).
2. **Pasang** di angkot (kabel ke aki 12–24V; pasang tersembunyi).
3. **Konfigurasi via SMS** ke nomor SIM tracker (perintah bervariasi per firmware; contoh umum Concox):
   - APN: `APN,<apn-operator>#`
   - Server (IP publik + port GT06 Traccar, default 5023): `SERVER,1,<IP_PUBLIK>,5023,0#`
   - Interval upload (mis. 10 dtk saat bergerak): `TIMER,10,30#`
   - Cek status: `STATUS#` / `WHERE#`
   > Catatan: gunakan **IP publik/domain** server Traccar, bukan localhost. Buka port 5023/TCP di firewall.

## 4. Jalankan gateway Traccar

Tambahkan ke deployment (contoh service compose terpisah, jangan di stack demo lomba):

```yaml
traccar:
  image: traccar/traccar:latest
  ports:
    - "5023:5023"          # protokol GT06 (TCP)
    - "8082:8082"          # web admin Traccar (amankan / jangan publik)
  volumes:
    - ./traccar.xml:/opt/traccar/conf/traccar.xml:ro
    - traccar-data:/opt/traccar/data
```

Di `traccar.xml` aktifkan **position forwarding** ke adapter:

```xml
<entry key='forward.enable'>true</entry>
<entry key='forward.url'>http://telemetry-adapter:8090/forward</entry>
<entry key='forward.type'>json</entry>
```

Daftarkan tiap tracker di Traccar (admin) dengan **uniqueId = IMEI**.

## 5. Adapter penerjemah (Traccar JSON → kontrak Sentra)

Traccar mem-forward JSON per posisi: `{ device: { uniqueId }, position: { latitude, longitude, speed (knot), course, deviceTime, attributes } }`. Adapter kecil (Node/Express) memetakan & meneruskan:

```js
// telemetry-adapter (pseudo, inti pemetaan)
app.post("/forward", async (req, res) => {
  const { device, position } = req.body;
  const body = {
    imei_or_serial: device.uniqueId,                 // IMEI -> resolusi devices/assignments
    lat: position.latitude,
    lon: position.longitude,
    speed_kmh: (position.speed ?? 0) * 1.852,         // knot -> km/jam
    heading: position.course ?? 0,
    ts: position.deviceTime,
    status: position.attributes?.ignition === false ? "OUT_OF_SERVICE" : "IN_SERVICE",
    device: {
      power_connected: position.attributes?.charge === true,
      battery: position.attributes?.batteryLevel,
      signal_dbm: position.attributes?.rssiDbm,
    },
  };
  // Auth: HMAC (produksi)
  const timestamp = new Date().toISOString();
  const raw = JSON.stringify(body);
  const sig = crypto.createHmac("sha256", process.env.TELEMETRY_HMAC_SECRET)
                    .update(`${timestamp}.${raw}`).digest("hex");
  await fetch(`${process.env.SENTRA_API}/telemetry/vehicle`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telemetry-timestamp": timestamp,
      "x-telemetry-signature": `sha256=${sig}`,
    },
    body: raw,
  });
  res.sendStatus(204);
});
```

(Untuk dev cepat: ganti header HMAC dengan `x-telemetry-token: <TELEMETRY_INGEST_TOKEN>`.)

## 6. Registrasi di Sentra (master data)

Sebelum data masuk, daftarkan lewat dashboard **Analisa**:
1. **Devices** → tambah perangkat, isi **`imei_or_serial` = IMEI tracker**.
2. **Assignments** → buat assignment **aktif** device→kendaraan (`is_active = true`).
   Tanpa assignment aktif, telemetry by-IMEI akan `404` (kendaraan tak ter-resolve).

## 7. Uji end-to-end

Simulasikan satu paket (token statis) tanpa perangkat fisik:

```sh
curl -i -X POST http://localhost:4000/telemetry/vehicle \
  -H "content-type: application/json" \
  -H "x-telemetry-token: $TELEMETRY_INGEST_TOKEN" \
  -d '{"imei_or_serial":"<IMEI_TERDAFTAR>","lat":-6.595,"lon":106.816,"speed_kmh":22,"heading":120,"status":"IN_SERVICE"}'
```

Verifikasi:
```sh
# baris masuk vehicle_positions + vehicle_latter ter-update
docker compose ... exec -T postgres psql -U monitoring -d Sentra -c \
  "SELECT vehicle_id, ts, speed_kmh FROM vehicle_positions ORDER BY ts DESC LIMIT 3;"
```
Lalu marker kendaraan akan bergerak di dashboard realtime (peta) dan rules-engine mulai mengevaluasi anomali.

## 8. Produksi & keamanan

- Pakai **HMAC** (`TELEMETRY_HMAC_SECRET`), bukan token statis.
- Letakkan Sentra di belakang **HTTPS** (lihat `docs/runbooks/security-hardening.md` + Caddy) → adapter POST ke `https://`.
- **mTLS decision:** untuk pilot tertutup, Sentra menerima HMAC + HTTPS sebagai baseline produksi dan mTLS didefer dengan risk acceptance bila adapter/gateway dikelola sendiri serta ingress dibatasi lewat jaringan/reverse proxy. Naikkan ke mTLS/client certificate sebelum membuka telemetry langsung ke internet publik, menerima gateway vendor pihak ketiga, atau menjalankan multi-vendor gateway.
- Batasi akses admin Traccar (8082) — jangan diekspos publik.
- Rate limit telemetry sudah aktif (`TELEMETRY_RATE_LIMIT_MAX`, kini berbasis Redis). Sesuaikan dengan jumlah armada × frekuensi ping.
- Skala: ratusan tracker × ping 10 dtk = pertumbuhan cepat `vehicle_positions` → terapkan retention/compression TimescaleDB (`docs/runbooks/scale-out.md`).
