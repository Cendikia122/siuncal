const API_URL = process.env.API_URL || "http://localhost:4000";
const INTERVAL_MS = Number(process.env.PASSENGER_INTERVAL_MS || 30000);
const MOVE_FACTOR = Number(process.env.PASSENGER_MOVE_FACTOR || 0.25);
const configuredPassword = process.env.PASSENGER_SEED_PASSWORD || "";
const PASSWORD = configuredPassword.startsWith("CHANGE_ME_") ? "password123" : (configuredPassword || "password123");

const ROUTES = {
  cipaku: [
    { lat: -6.635827, lon: 106.815472 },
    { lat: -6.626900, lon: 106.810200 },
    { lat: -6.619900, lon: 106.805250 },
    { lat: -6.615059, lon: 106.803684 },
    { lat: -6.603900, lon: 106.797900 },
    { lat: -6.594078, lon: 106.790822 },
    { lat: -6.589167, lon: 106.787778 }
  ],
  bubulak: [
    { lat: -6.569672, lon: 106.754339 },
    { lat: -6.574900, lon: 106.756700 },
    { lat: -6.581500, lon: 106.762000 },
    { lat: -6.587600, lon: 106.772000 },
    { lat: -6.591900, lon: 106.783900 },
    { lat: -6.594078, lon: 106.790822 },
    { lat: -6.603900, lon: 106.797900 }
  ],
  baranangsiang: [
    { lat: -6.604274, lon: 106.806157 },
    { lat: -6.601289, lon: 106.805358 },
    { lat: -6.603900, lon: 106.797900 },
    { lat: -6.594078, lon: 106.790822 },
    { lat: -6.591900, lon: 106.783900 },
    { lat: -6.587600, lon: 106.772000 },
    { lat: -6.569672, lon: 106.754339 }
  ]
};

const PASSENGERS = [
  {
    email: "warga@sentra.id",
    name: "Warga Bogor",
    routeKey: "bubulak",
    startIndex: 5,
    battery: 0.89
  },
  {
    email: "warga.cipaku@sentra.id",
    name: "Warga Cipaku",
    routeKey: "cipaku",
    startIndex: 0,
    battery: 0.83
  },
  {
    email: "warga.bubulak@sentra.id",
    name: "Warga Bubulak",
    routeKey: "bubulak",
    startIndex: 0,
    battery: 0.76
  },
  {
    email: "warga.baranangsiang@sentra.id",
    name: "Warga Baranangsiang",
    routeKey: "baranangsiang",
    startIndex: 0,
    battery: 0.81
  }
];

class PassengerSimulator {
  constructor(passenger) {
    this.passenger = passenger;
    this.route = ROUTES[passenger.routeKey] || [];
    this.targetIndex = passenger.startIndex % this.route.length;
    this.lat = this.route[this.targetIndex].lat;
    this.lon = this.route[this.targetIndex].lon;
    this.battery = passenger.battery;
    this.session = null;
  }

  async login() {
    const response = await fetch(`${API_URL}/auth/mobile/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: this.passenger.email,
        password: PASSWORD
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${this.passenger.email} login failed: HTTP ${response.status} ${text}`);
    }

    const payload = await response.json();
    const consentResponse = await fetch(`${API_URL}/me/passenger-tracking/consent`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${payload.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        policy_version: "demo-simulator-v1",
        platform: "OTHER",
        app_version: "1.0.0"
      })
    });

    if (!consentResponse.ok) {
      const text = await consentResponse.text();
      throw new Error(`${this.passenger.email} tracking consent failed: HTTP ${consentResponse.status} ${text}`);
    }

    const consent = await consentResponse.json();
    this.session = {
      token: consent.passenger_tracking_token,
      sessionId: consent.passenger_tracking_session_id
    };
  }

  nextPosition() {
    const target = this.route[this.targetIndex];
    const latDiff = target.lat - this.lat;
    const lonDiff = target.lon - this.lon;
    const distance = Math.sqrt((latDiff * latDiff) + (lonDiff * lonDiff));

    if (distance < 0.00008) {
      this.targetIndex = (this.targetIndex + 1) % this.route.length;
      return { lat: target.lat, lon: target.lon };
    }

    this.lat += latDiff * MOVE_FACTOR;
    this.lon += lonDiff * MOVE_FACTOR;
    return { lat: this.lat, lon: this.lon };
  }

  buildTelemetry() {
    const position = this.nextPosition();
    this.battery = Math.max(0.1, this.battery - 0.0008);
    return {
      session_id: this.session.sessionId,
      lat: Number(position.lat.toFixed(6)),
      lon: Number(position.lon.toFixed(6)),
      accuracy: Math.round((7 + Math.random() * 5) * 10) / 10,
      battery_level: Math.round(this.battery * 100) / 100,
      timestamp: new Date().toISOString(),
      app_state: Math.random() > 0.35 ? "BACKGROUND" : "FOREGROUND"
    };
  }

  async sendTelemetry() {
    if (!this.session) await this.login();
    const telemetry = this.buildTelemetry();
    const response = await fetch(`${API_URL}/telemetry/passenger`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Passenger-Tracking-Token": this.session.token
      },
      body: JSON.stringify(telemetry)
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 401) {
        this.session = null;
      }
      throw new Error(`${this.passenger.email} telemetry failed: HTTP ${response.status} ${text}`);
    }

    return telemetry;
  }
}

const formatTimestamp = () => new Date().toISOString().replace("T", " ").substring(0, 19);

async function startSimulation() {
  const simulators = PASSENGERS.map((passenger) => new PassengerSimulator(passenger));

  console.log("\n=== Passenger Location Simulator Started ===");
  console.log(`API URL: ${API_URL}`);
  console.log(`Interval: ${INTERVAL_MS / 1000} seconds`);
  console.log(`Passengers: ${simulators.length}`);
  console.log("===========================================\n");

  async function sendUpdate() {
    console.log(`[${formatTimestamp()}] Sending passenger location updates...`);
    for (const simulator of simulators) {
      try {
        const telemetry = await simulator.sendTelemetry();
        console.log(`  ok ${simulator.passenger.name}: lat=${telemetry.lat}, lon=${telemetry.lon}, state=${telemetry.app_state}`);
      } catch (error) {
        console.error(`  fail ${simulator.passenger.email}: ${error.message}`);
      }
    }
    console.log("");
  }

  await sendUpdate();
  const intervalId = setInterval(sendUpdate, INTERVAL_MS);

  const stop = () => {
    console.log("\n=== Stopping passenger simulator ===");
    clearInterval(intervalId);
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

startSimulation().catch((error) => {
  console.error(error);
  process.exit(1);
});
