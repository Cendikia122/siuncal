import { DraftReport, PublicVehicle, Session } from "./types";

const fallbackVehicles: PublicVehicle[] = [
  {
    vehicle_id: "demo-angkot-01",
    plate_no: "F 1234 BO",
    route_name: "Baranangsiang - Bubulak",
    latest_lat: -6.595,
    latest_lon: 106.816,
    status: "ACTIVE",
    last_seen_at: new Date().toISOString()
  },
  {
    vehicle_id: "demo-angkot-02",
    plate_no: "F 2211 CK",
    route_name: "Ciawi - Sukasari",
    latest_lat: -6.613,
    latest_lon: 106.845,
    status: "IDLE",
    last_seen_at: new Date(Date.now() - 8 * 60 * 1000).toISOString()
  },
  {
    vehicle_id: "demo-angkot-03",
    plate_no: "F 9050 AA",
    route_name: "Cilebut - Merdeka",
    latest_lat: -6.557,
    latest_lon: 106.802,
    status: "OFFLINE",
    last_seen_at: new Date(Date.now() - 54 * 60 * 1000).toISOString()
  }
];

const getBaseUrl = () =>
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:4000";

const jsonFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request gagal dengan status ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export const fetchPublicVehicles = async (): Promise<{
  vehicles: PublicVehicle[];
  usingFallback: boolean;
}> => {
  try {
    const payload = await jsonFetch<{ vehicles?: PublicVehicle[]; data?: PublicVehicle[] }>(
      "/public/vehicles"
    );

    return {
      vehicles: payload.vehicles ?? payload.data ?? [],
      usingFallback: false
    };
  } catch {
    return {
      vehicles: fallbackVehicles,
      usingFallback: true
    };
  }
};

export const submitPublicReport = async (report: DraftReport, session: Session) => {
  const form = new FormData();

  form.append("plate_no", report.plateNo.trim().toUpperCase());
  form.append("category", report.category);
  form.append("description", report.description.trim());
  form.append("lat", String(report.lat));
  form.append("lon", String(report.lon));
  form.append("reported_at", report.reportedAt);

  if (typeof report.accuracyM === "number") {
    form.append("accuracy_m", String(Math.round(report.accuracyM)));
  }

  for (const attachment of report.attachments) {
    form.append("attachments", {
      uri: attachment.uri,
      name: attachment.fileName,
      type: attachment.contentType
    } as unknown as Blob);
  }

  return jsonFetch<{ public_report_id?: string; status?: string }>("/public/reports", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.token}`
    },
    body: form
  });
};

export const sendPassengerTelemetry = async ({
  session,
  lat,
  lon,
  accuracy,
  timestamp,
  appState
}: {
  session: Pick<Session, "passengerTrackingToken" | "passengerTrackingSessionId">;
  lat: number;
  lon: number;
  accuracy?: number | null;
  timestamp: string;
  appState: "FOREGROUND" | "BACKGROUND";
}) => {
  return jsonFetch<{ ok: boolean; position_id?: string; ts?: string }>("/telemetry/passenger", {
    method: "POST",
    headers: {
      "X-Passenger-Tracking-Token": session.passengerTrackingToken
    },
    body: JSON.stringify({
      session_id: session.passengerTrackingSessionId,
      lat,
      lon,
      accuracy,
      timestamp,
      app_state: appState
    })
  });
};

export const mobileLogin = async ({ email, password }: { email: string; password: string }): Promise<Session> => {
  const payload = await jsonFetch<{
    access_token: string;
    passenger_tracking_token: string;
    passenger_tracking_session_id: string;
    user: {
      full_name?: string;
      email?: string;
    };
  }>("/auth/mobile/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  return {
    token: payload.access_token,
    passengerTrackingToken: payload.passenger_tracking_token,
    passengerTrackingSessionId: payload.passenger_tracking_session_id,
    userName: payload.user.full_name || payload.user.email || email
  };
};
