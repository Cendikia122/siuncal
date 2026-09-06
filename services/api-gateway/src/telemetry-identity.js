export const resolveVehicleIdFromTelemetryIdentity = async (telemetry, query) => {
  if (telemetry.vehicleId) {
    const vehicleResult = await query("SELECT vehicle_id FROM vehicles WHERE vehicle_id = $1", [telemetry.vehicleId]);
    if (vehicleResult.rows[0]?.vehicle_id) return vehicleResult.rows[0].vehicle_id;
  }

  if (telemetry.plateNo) {
    const vehicleResult = await query("SELECT vehicle_id FROM vehicles WHERE plate_no = $1", [telemetry.plateNo]);
    if (vehicleResult.rows[0]?.vehicle_id) return vehicleResult.rows[0].vehicle_id;
  }

  if (telemetry.deviceId || telemetry.imei_or_serial) {
    const deviceResult = await query(
      `SELECT device_id
       FROM devices
       WHERE ($1::text IS NOT NULL AND device_id::text = $1::text)
          OR ($2::text IS NOT NULL AND imei_or_serial = $2::text)
       LIMIT 1`,
      [telemetry.deviceId, telemetry.imei_or_serial]
    );
    const resolvedDeviceId = deviceResult.rows[0]?.device_id;
    if (resolvedDeviceId) {
      const assignmentResult = await query(
        "SELECT vehicle_id FROM assignments WHERE device_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1",
        [resolvedDeviceId]
      );
      if (assignmentResult.rows[0]?.vehicle_id) return assignmentResult.rows[0].vehicle_id;
    }
  }

  return null;
};
