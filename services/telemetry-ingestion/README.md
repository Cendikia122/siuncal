{
  "vehicle_id": "string | null",
  "plate_no": "string",
  "device_id": "string | null",
  "imei_or_serial": "string",
  "ts": "ISO8601",
  "lat": number,
  "lon": number,
  "speed_kmh": number,
  "heading": number,
  "status": "string",
  "raw_data": {}
}
```

**Response:**

```json
{
  "ok": true
}
```

## Dependencies

- nodejs >= 20
- npm
- redis (optional, for stream publishing)

# Build
npm run build

# Start
npm start
