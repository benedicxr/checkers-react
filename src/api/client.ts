export type ApiRequestInit = Omit<RequestInit, "body" | "headers"> & {
  headers?: HeadersInit;
  json?: unknown;
};

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api";

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

function joinUrl(base: string, path: string): string {
  if (path.startsWith("/")) return `${base}${path}`;
  return `${base}/${path}`;
}

export const API_BASE_URL = normalizeBaseUrl(
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL ??
    DEFAULT_API_BASE_URL,
);

export class ApiClientError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, opts: { status: number; payload: unknown }) {
    super(message);
    this.name = "ApiClientError";
    this.status = opts.status;
    this.payload = opts.payload;
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function extractBackendDetail(payload: unknown): string | null {
  if (!isRecord(payload)) return null;

  const err = payload.error;
  if (isRecord(err) && typeof err.detail === "string") return err.detail;

  if (typeof payload.detail === "string") return payload.detail;

  return null;
}

async function readJsonSafely(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const url = joinUrl(API_BASE_URL, path);
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");

  let body: BodyInit | undefined = undefined;
  if ("json" in init) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, body });
  } catch (e) {
    throw new ApiClientError("Network error: failed to reach backend", { status: 0, payload: e });
  }

  const payload = await readJsonSafely(res);

  if (!res.ok) {
    const detail = extractBackendDetail(payload);
    const msg = detail ?? `Request failed (${res.status})`;
    throw new ApiClientError(msg, { status: res.status, payload });
  }

  // For 204 etc
  if (res.status === 204) return undefined as T;
  return payload as T;
}

