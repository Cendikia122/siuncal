export type VehicleStatus = "ACTIVE" | "IDLE" | "OFFLINE" | "UNKNOWN";

export type PublicVehicle = {
  vehicle_id: string;
  plate_no: string;
  route_id?: string | null;
  route_name?: string | null;
  latest_lat?: number | null;
  latest_lon?: number | null;
  status?: VehicleStatus | string | null;
  last_seen_at?: string | null;
};

export type ReportCategory =
  | "NGETEM"
  | "RECKLESS_DRIVING"
  | "SECURITY"
  | "SERVICE"
  | "OTHER";

export type ReportAttachment = {
  uri: string;
  fileName: string;
  contentType: string;
  fileSize?: number;
};

export type DraftReport = {
  plateNo: string;
  category: ReportCategory;
  description: string;
  lat: number;
  lon: number;
  accuracyM?: number;
  reportedAt: string;
  attachments: ReportAttachment[];
};

export type ReportHistoryItem = {
  id: string;
  plateNo: string;
  category: ReportCategory;
  status: "DRAFT" | "SUBMITTED" | "PENDING_REVIEW" | "FAILED";
  submittedAt: string;
  message: string;
};

export type Session = {
  token: string;
  passengerTrackingToken: string;
  passengerTrackingSessionId: string;
  userName: string;
};

export type ScreenKey = "tracking" | "report" | "history";
