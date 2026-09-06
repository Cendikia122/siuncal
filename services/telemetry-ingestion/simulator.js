import { VEHICLES, ROUTES, CONFIG } from './config.js';

function calculateBearing(from, to) {
  const toRadians = (value) => value * Math.PI / 180;
  const toDegrees = (value) => value * 180 / Math.PI;
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLon = toRadians(to.lon - from.lon);
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

class VehicleSimulator {
  constructor(vehicle) {
    this.vehicle = vehicle;
    this.route = ROUTES[vehicle.route_id] || [];
    const initialOffset = this.route.length > 0 ? (vehicle.route_offset || 0) % this.route.length : 0;
    this.currentRouteIndex = Math.floor(initialOffset);
    this.segmentProgress = initialOffset - this.currentRouteIndex;
    this.moveStep = vehicle.move_step || 0.2;
    this.currentLat = vehicle.start_lat;
    this.currentLon = vehicle.start_lon;
    this.currentHeading = vehicle.heading;
    this.battery = vehicle.battery;
    this.isPaused = false;
  }

  getPosition() {
    if (this.route.length === 0) {
      return {
        lat: this.currentLat,
        lon: this.currentLon
      };
    }

    const fromPoint = this.route[this.currentRouteIndex];
    const nextPoint = this.route[(this.currentRouteIndex + 1) % this.route.length] || fromPoint;
    this.currentLat = fromPoint.lat + ((nextPoint.lat - fromPoint.lat) * this.segmentProgress);
    this.currentLon = fromPoint.lon + ((nextPoint.lon - fromPoint.lon) * this.segmentProgress);
    this.currentHeading = typeof fromPoint.heading === 'number'
      ? fromPoint.heading
      : calculateBearing(fromPoint, nextPoint);
    this.segmentProgress += this.moveStep;
    while (this.segmentProgress >= 1) {
      this.segmentProgress -= 1;
      this.currentRouteIndex = (this.currentRouteIndex + 1) % this.route.length;
    }

    return {
      lat: this.currentLat,
      lon: this.currentLon,
      heading: this.currentHeading
    };
  }

  getTelemetryData() {
    const position = this.getPosition();
    const now = new Date();

    this.battery = Math.max(0.1, this.battery - 0.001);
    const signalDbm = -70 - Math.random() * 20;
    const speedVariation = (Math.random() - 0.5) * 10;
    const currentSpeed = Math.max(0, this.vehicle.speed_kmh + speedVariation);
    const headingVariation = (Math.random() - 0.5) * 8;
    const currentHeading = ((position.heading ?? this.vehicle.heading) + headingVariation + 360) % 360;

    const telemetry = {
      plate_no: this.vehicle.plate_no,
      ts: now.toISOString(),
      lat: position.lat,
      lon: position.lon,
      speed_kmh: Math.round(currentSpeed * 10) / 10,
      heading: Math.round(currentHeading * 10) / 10,
      accuracy_m: CONFIG.ACCURACY_M,
      status: this.vehicle.status,
      device: {
        battery: Math.round(this.battery * 100) / 100,
        signal_dbm: Math.round(signalDbm),
        power_connected: true
      }
    };

    if (this.vehicle.vehicle_id) telemetry.vehicle_id = this.vehicle.vehicle_id;
    if (this.vehicle.device_id) {
      telemetry.device_id = this.vehicle.device_id;
      telemetry.device.device_id = this.vehicle.device_id;
    }
    if (this.vehicle.imei_or_serial) {
      telemetry.imei_or_serial = this.vehicle.imei_or_serial;
      telemetry.device.imei_or_serial = this.vehicle.imei_or_serial;
    }

    return telemetry;
  }

  reset() {
    this.currentLat = this.vehicle.start_lat;
    this.currentLon = this.vehicle.start_lon;
    const initialOffset = this.route.length > 0 ? (this.vehicle.route_offset || 0) % this.route.length : 0;
    this.currentRouteIndex = Math.floor(initialOffset);
    this.segmentProgress = initialOffset - this.currentRouteIndex;
    this.currentHeading = this.vehicle.heading;
    this.battery = this.vehicle.battery;
  }
}

async function sendTelemetry(telemetry) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (CONFIG.TELEMETRY_TOKEN) {
      headers['x-telemetry-token'] = CONFIG.TELEMETRY_TOKEN;
    }
    const response = await fetch(`${CONFIG.API_URL}${CONFIG.API_ENDPOINT}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(telemetry)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function formatTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function startSimulation() {
  const simulators = VEHICLES.map(v => new VehicleSimulator(v));
  
  console.log(`\n=== GPS Telemetry Simulator Started ===`);
  console.log(`API URL: ${CONFIG.API_URL}${CONFIG.API_ENDPOINT}`);
  console.log(`Interval: ${CONFIG.INTERVAL_MS / 1000} seconds`);
  console.log(`Vehicles: ${simulators.length}`);
  console.log(`====================================\n`);

  async function sendUpdate() {
    const timestamp = formatTimestamp();
    console.log(`[${timestamp}] Sending telemetry updates...`);

    for (const simulator of simulators) {
      const telemetry = simulator.getTelemetryData();
      const result = await sendTelemetry(telemetry);
      
      if (result.success) {
        console.log(`  ✓ ${telemetry.plate_no}: lat=${telemetry.lat.toFixed(6)}, lon=${telemetry.lon.toFixed(6)}, speed=${telemetry.speed_kmh} km/h`);
      } else {
        console.error(`  ✗ ${telemetry.plate_no}: ${result.error}`);
      }
    }

    console.log('');
  }

  sendUpdate();

  const intervalId = setInterval(sendUpdate, CONFIG.INTERVAL_MS);

  process.on('SIGINT', () => {
    console.log('\n\n=== Stopping simulator ===');
    clearInterval(intervalId);
    console.log('Simulator stopped. Goodbye!');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n\n=== Stopping simulator ===');
    clearInterval(intervalId);
    console.log('Simulator stopped. Goodbye!');
    process.exit(0);
  });
}

startSimulation();
