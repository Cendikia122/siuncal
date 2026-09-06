# Wireframe dan Alur UI Dashboard Monitoring Angkot

## Tujuan

Dokumen ini menjabarkan struktur halaman, wireframe konseptual, dan alur interaksi frontend untuk dashboard monitoring angkot dan intelijen armada.

Dokumen ini fokus pada organisasi informasi dan flow investigasi, bukan desain visual final.

## Prinsip UI

- informasi kritis tampil di atas,
- peta menjadi pusat navigasi operasional,
- investigasi bisa dilakukan tanpa berpindah terlalu banyak halaman,
- panel kanan dipakai untuk detail cepat,
- tabel dan chart selalu bisa difilter.

## Halaman Utama

Dashboard frontend disarankan memiliki 4 view utama:

1. `Command Center`
2. `Fleet Intelligence`
3. `Device Fraud`
4. `Investigation Desk`

## 1. Command Center

### Tujuan

Memberi gambaran situasi real-time dan menjadi titik masuk ke investigasi.

### Struktur Layout

```text
+----------------------------------------------------------------------------------+
| Top Nav: Logo | Command Center | Fleet Intelligence | Device Fraud | Investigation |
+----------------------------------------------------------------------------------+
| Filter Bar: Time | Trayek | Pemilik | Risk | Status | Search                     |
+----------------------------------------------------------------------------------+
| KPI 1 | KPI 2 | KPI 3 | KPI 4 | KPI 5 | KPI 6                                        |
+----------------------------------------------------------------------------------+
| Alert Banner Prioritas                                                           |
+----------------------------------------------+-----------------------------------+
| Main Map                                     | Active Alerts Panel               |
| - marker angkot                              | - alert list                      |
| - route corridor                             | - severity badge                  |
| - anomaly overlays                           | - quick actions                   |
+----------------------------------------------+-----------------------------------+
| Bottom Insights: High-Risk Vehicles | Priority Owners | Collective Anomalies     |
+----------------------------------------------------------------------------------+
```

### Komponen Utama

- top navigation
- filter bar global
- KPI cards
- alert banner prioritas
- peta utama
- side panel alert aktif
- ringkasan kendaraan high-risk
- ringkasan pemilik prioritas
- ringkasan anomali kolektif

## 2. Interaksi Marker Angkot

Saat operator klik marker kendaraan pada peta:

```text
+----------------------------------------------+-----------------------------------+
| Main Map                                     | Vehicle Detail Drawer            |
|                                              | - foto kendaraan                 |
|                                              | - plat nomor                     |
|                                              | - kode armada                    |
|                                              | - trayek                         |
|                                              | - nama pemilik                   |
|                                              | - alamat pemilik                 |
|                                              | - status realtime                |
|                                              | - risk score                     |
|                                              | - pelanggaran terbaru            |
|                                              | - tombol playback                |
|                                              | - tombol incident history        |
|                                              | - tombol network view            |
+----------------------------------------------+-----------------------------------+
```

### Aksi Cepat

- `Lihat Playback`
- `Lihat Riwayat`
- `Buka Incident`
- `Buka Network View`

## 3. Fleet Intelligence View

### Tujuan

Menganalisis pemilik armada, pola pelanggaran, risk propagation, dan outlier.

### Struktur Layout

```text
+----------------------------------------------------------------------------------+
| Header + Filter Intelligence                                                     |
+----------------------------------------------------------------------------------+
| Priority Owners Table                    | Risk Propagation Panel                |
+------------------------------------------+---------------------------------------+
| Organized Violation Cases                | Collective Anomaly Feed               |
+------------------------------------------+---------------------------------------+
| Outlier Vehicles Table                   | Trend Chart                           |
+----------------------------------------------------------------------------------+
```

### Widget Kunci

- `Priority Owners Table`
- `Risk Propagation Panel`
- `Organized Violation Cases`
- `Collective Anomaly Feed`
- `Outlier Vehicles Table`
- `Trend Chart`

### Priority Owners Table

Kolom minimum:

- nama pemilik
- kendaraan aktif
- kendaraan high-risk
- avg risk score
- incident terbuka
- sanction aktif
- prioritas

## 4. Device Fraud View

### Tujuan

Memonitor integritas GPS device dan mendeteksi pola fraud.

### Struktur Layout

```text
+----------------------------------------------------------------------------------+
| Header + Filter Device                                                           |
+----------------------------------------------------------------------------------+
| Suspicious Devices Table                | Fraud Trend Chart                     |
+-----------------------------------------+----------------------------------------+
| Device Reassignment List                | Identity Events Feed                  |
+----------------------------------------------------------------------------------+
```

### Suspicious Devices Table

Kolom minimum:

- IMEI
- model device
- fraud score
- latest event
- reassignment count
- vehicle aktif

### Device Detail Drawer

Saat operator klik device:

- identitas device,
- kendaraan aktif,
- histori pemasangan,
- anomaly terkait,
- incident terkait,
- fraud risk summary.

## 5. Investigation Desk

### Tujuan

Memberi ruang kerja untuk analisis mendalam berbasis kasus.

### Struktur Layout

```text
+----------------------------------------------------------------------------------+
| Case Selector | Search Incident | Search Vehicle | Search Owner                  |
+----------------------------------------------------------------------------------+
| Network View Graph                          | Evidence and Timeline              |
| - owner                                     | - anomaly timeline                 |
| - vehicle                                   | - alerts                           |
| - device                                    | - incidents                        |
| - incident                                  | - sanctions                        |
+---------------------------------------------+------------------------------------+
| Action Panel                                                                      |
| - acknowledge | escalate | assign review | add note | recommend sanction         |
+----------------------------------------------------------------------------------+
```

### Action Panel

Tombol minimum:

- `Acknowledge`
- `Escalate to Incident`
- `Open Fleet Pattern Case`
- `Flag Device for Inspection`
- `Add Investigation Note`
- `Recommend Warning`
- `Recommend Sanction`

## 6. Navigation Flow

### Flow 1: Dari Peta ke Investigasi

1. Operator melihat marker merah di peta.
2. Operator klik marker.
3. Drawer detail kendaraan terbuka.
4. Operator klik `Lihat Riwayat` atau `Buka Network View`.
5. Sistem pindah ke `Investigation Desk`.

### Flow 2: Dari Priority Owner ke Fleet Pattern Case

1. Operator membuka `Fleet Intelligence`.
2. Operator melihat pemilik dengan beberapa kendaraan high-risk.
3. Operator klik baris pemilik.
4. Panel detail pemilik terbuka.
5. Operator buka `fleet pattern case`.

### Flow 3: Dari Suspicious Device ke Inspeksi

1. Operator membuka `Device Fraud`.
2. Operator melihat device dengan fraud score tinggi.
3. Operator klik device.
4. Drawer device detail terbuka.
5. Operator klik `Flag Device for Inspection`.

## 7. Filter dan State UI

### Filter Global

- waktu
- trayek
- pemilik armada
- risk level
- severity
- status online/offline

### Filter Khusus Intelligence

- collective anomaly type
- fleet pattern case type
- propagation level
- sanction status

### Filter Khusus Device

- device model
- fraud score range
- latest event type

## 8. Komponen Frontend yang Disarankan

### Shared Components

- `FilterBar`
- `KpiCard`
- `StatusBadge`
- `SeverityBadge`
- `RiskBadge`
- `DataTable`
- `DrawerPanel`
- `MapLegend`
- `TimelinePanel`

### Monitoring Components

- `VehicleMap`
- `VehicleMarker`
- `VehicleDetailDrawer`
- `AlertListPanel`
- `CollectiveAnomalyLayer`

### Intelligence Components

- `PriorityOwnerTable`
- `RiskPropagationCard`
- `PatternCaseList`
- `OutlierVehicleTable`

### Fraud Components

- `SuspiciousDeviceTable`
- `DeviceDetailDrawer`
- `FraudTrendChart`

### Investigation Components

- `NetworkGraph`
- `EvidenceTimeline`
- `ActionPanel`

## 9. Mobile dan Responsive Behavior

Fokus utama tetap desktop, tetapi UI perlu tetap usable pada tablet.

### Desktop

- peta dan drawer tampil berdampingan,
- tabel dan chart tampil grid dua kolom,
- network view mendapatkan ruang besar.

### Tablet

- drawer berubah menjadi slide-over,
- tabel menjadi satu kolom,
- KPI tetap dua baris.

### Mobile

- hanya untuk monitoring ringan,
- peta satu layar,
- detail melalui bottom sheet,
- investigasi mendalam tetap diarahkan ke desktop.

## 10. Tahap Implementasi UI

### Fase 1

- Command Center
- marker kendaraan
- vehicle detail drawer
- alert list
- KPI cards

### Fase 2

- Fleet Intelligence
- priority owners
- risk propagation
- collective anomaly panels
- outlier tables

### Fase 3

- Device Fraud
- Investigation Desk
- Network Graph
- action workflow penuh

## Ringkasan

Wireframe ini dirancang agar frontend berkembang dari dashboard monitoring real-time menjadi pusat investigasi operasional yang mendukung pengawasan kepatuhan angkot secara sistematis dan dapat ditindaklanjuti.
