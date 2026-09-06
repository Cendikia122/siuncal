import { getMockApiResponse } from "@/lib/mock-data";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

const parseBooleanEnv = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true" || value === "1" || value.toLowerCase() === "yes";
};

// Development can use mock data, but production must always hit the real API.
// Catatan Next.js: frontend/browser harus memakai NEXT_PUBLIC_MOCK_MODE; proxy/server juga membaca MOCK_MODE.
export const MOCK_MODE = process.env.NODE_ENV === "production"
  ? false
  : parseBooleanEnv(process.env.NEXT_PUBLIC_MOCK_MODE ?? process.env.MOCK_MODE, true);

export const apiUrl = (path: string) => {
  if (MOCK_MODE && (path === "#" || path.startsWith("data:") || path.startsWith("http"))) return path;
  return `${API_BASE_URL}${path}`;
};

export const ACTION_FEEDBACK_EVENT = "sentra:action-feedback";

export type ActionFeedback = {
  type: "success" | "error" | "info";
  title: string;
  message?: string;
};

export const emitActionFeedback = (feedback: ActionFeedback) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ActionFeedback>(ACTION_FEEDBACK_EVENT, { detail: feedback }));
};

export type ApiDefaultResponse = {
  [key: string]: unknown;
  date?: string;
  items?: never[];
  user?: {
    roles?: string[];
    [key: string]: unknown;
  };
};

const getCsrfToken = () => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )sentra_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

const refreshSession = async () => {
  const csrfToken = getCsrfToken();
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined
  });
  return response.ok;
};

// --- MED-06: CSRF token fail-safe — refuse state-changing requests without token ---
const isStateMutating = (method?: string) => {
  const m = (method || "GET").toUpperCase();
  return m === "POST" || m === "PATCH" || m === "PUT" || m === "DELETE";
};

// --- LOW-03: Sanitize error messages — map known codes to user-friendly messages ---
const sanitizeErrorMessage = (payload: Record<string, unknown> | null, status: number): string => {
  const code = (payload?.error as Record<string, unknown>)?.code as string | undefined;
  const message = (payload?.error as Record<string, unknown>)?.message as string | undefined;
  const safeMessages: Record<string, string> = {
    UNAUTHORIZED: "Sesi Anda telah berakhir. Silakan login kembali.",
    FORBIDDEN: "Anda tidak memiliki akses untuk melakukan tindakan ini.",
    VALIDATION_ERROR: message || "Data yang dikirim tidak valid.",
    NOT_FOUND: "Data tidak ditemukan.",
    RATE_LIMITED: "Terlalu banyak permintaan. Silakan coba beberapa saat lagi.",
    CSRF_ERROR: "Sesi keamanan tidak valid. Silakan refresh halaman.",
    INTERNAL_ERROR: "Terjadi kesalahan server. Silakan coba lagi nanti.",
  };
  if (code && safeMessages[code]) return safeMessages[code];
  if (message && message.length < 200 && !message.includes("Error:") && !message.includes("at ")) return message;
  return `Permintaan gagal (${status})`;
};

export const apiFetch = async <T = ApiDefaultResponse>(
  path: string,
  options: RequestInit & { _retry?: boolean } = {}
): Promise<T> => {
  if (MOCK_MODE) {
    return getMockApiResponse<T>(path, options);
  }

  const csrfToken = getCsrfToken();

  // --- MED-06: Fail-safe — reject mutating requests without CSRF token ---
  if (isStateMutating(options.method) && !csrfToken && !path.startsWith("/auth/login")) {
    console.warn("CSRF token missing for state-changing request. Attempting session refresh...");
    const refreshed = await refreshSession();
    const newCsrfToken = getCsrfToken();
    if (!refreshed || !newCsrfToken) {
      throw new Error("Sesi keamanan tidak valid. Silakan login kembali.");
    }
  }

  const currentCsrfToken = getCsrfToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
    ...(currentCsrfToken ? { "x-csrf-token": currentCsrfToken } : {})
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include"
  });

  if (response.status === 401 && !options._retry && !path.startsWith("/auth/")) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiFetch<T>(path, { ...options, _retry: true });
    }
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(sanitizeErrorMessage(payload, response.status));
  }

  return payload as T;
};

export const apiDownload = async (path: string, filename: string, retry = true): Promise<void> => {
  if (MOCK_MODE) {
    const content = `SI UNCAL mock export\nPath,${path}\nGenerated,${new Date().toISOString()}\n`;
    const blob = new Blob([content], { type: filename.endsWith(".pdf") ? "application/pdf" : "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    emitActionFeedback({ type: "success", title: "Export mock berhasil", message: `${filename} mulai diunduh.` });
    return;
  }

  const csrfToken = getCsrfToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined
  });

  if (response.status === 401 && retry) {
    const refreshed = await refreshSession();
    if (refreshed) return apiDownload(path, filename, false);
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : null;
    const message = payload?.error?.message || `Download failed (${response.status})`;
    emitActionFeedback({ type: "error", title: "Export gagal", message });
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  emitActionFeedback({ type: "success", title: "Export berhasil", message: `${filename} mulai diunduh.` });
};

export const getRealtimeUrl = () =>
  process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000/realtime";

// --- HIGH-04: Helper to build authenticated WebSocket URL ---
export const getAuthenticatedRealtimeUrl = () => {
  const base = getRealtimeUrl();
  // Pass CSRF token as query param for WS auth since cookies may not cross-origin
  const csrfToken = getCsrfToken();
  const url = new URL(base);
  if (csrfToken) url.searchParams.set("csrf", csrfToken);
  return url.toString();
};
