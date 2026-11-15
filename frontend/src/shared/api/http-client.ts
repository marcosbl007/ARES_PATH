import { API_BASE_URL } from "@/shared/config/runtime";

import type { z } from "zod";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(message: string, options: { status?: number; code?: string; details?: unknown } = {}) {
    super(message);
    this.name = "ApiClientError";
    this.status = options.status ?? 0;
    this.code = options.code ?? "API_ERROR";
    this.details = options.details ?? {};
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorFromPayload(status: number, payload: unknown): ApiClientError {
  const root = isRecord(payload) ? payload : {};
  const detail = isRecord(root.detail) ? root.detail : root;

  return new ApiClientError(
    typeof detail.message === "string" ? detail.message : "The backend request failed.",
    {
      status,
      code: typeof detail.code === "string" ? detail.code : "HTTP_ERROR",
      details: detail.details ?? {},
    },
  );
}

export async function requestJson<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  const requestBody = options.body === undefined ? undefined : JSON.stringify(options.body);
  if (requestBody !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      body: requestBody,
      headers,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new ApiClientError("The backend could not be reached.", {
      code: "NETWORK_ERROR",
      details: error instanceof Error ? error.message : {},
    });
  }

  const rawBody = await response.text();
  let payload: unknown = {};
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      throw new ApiClientError("The backend returned a non-JSON response.", {
        status: response.status,
        code: "INVALID_JSON",
      });
    }
  }

  if (!response.ok) {
    throw errorFromPayload(response.status, payload);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiClientError("The backend response did not match the API contract.", {
      status: response.status,
      code: "INVALID_RESPONSE",
      details: parsed.error.flatten(),
    });
  }

  return parsed.data;
}

export function getJson<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal) {
  return requestJson(path, schema, { method: "GET", signal });
}

export function postJson<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
) {
  return requestJson(path, schema, { method: "POST", body, signal });
}
