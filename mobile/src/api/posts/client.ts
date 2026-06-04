import type { MobileApiErrorResponse } from "../../types/posts";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export class MobileApiRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "MobileApiRequestError";
  }
}

export type MobileApiResponse = {
  bodyPreview: string;
  contentType: string | null;
  data: unknown;
  endpoint: string;
  response: Response;
};

export type MobileListOptions = {
  limit?: number;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMobileApiErrorResponse(
  value: unknown,
): value is MobileApiErrorResponse {
  return isRecord(value) && "error" in value && typeof value.error === "string";
}

function getApiBaseUrl() {
  const baseUrl = API_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL が設定されていません。");
  }

  return baseUrl.replace(/\/+$/, "");
}

function getBodyPreview(body: string) {
  return body
    .replace(/"accessToken"\s*:\s*"[^"]*"/gi, '"accessToken":"[redacted]"')
    .replace(/"refreshToken"\s*:\s*"[^"]*"/gi, '"refreshToken":"[redacted]"')
    .replace(/"password"\s*:\s*"[^"]*"/gi, '"password":"[redacted]"')
    .replace(/"secret"\s*:\s*"[^"]*"/gi, '"secret":"[redacted]"')
    .replace(/"DATABASE_URL"\s*:\s*"[^"]*"/gi, '"DATABASE_URL":"[redacted]"')
    .replace(/"AUTH_SECRET"\s*:\s*"[^"]*"/gi, '"AUTH_SECRET":"[redacted]"')
    .replace(/"CRON_SECRET"\s*:\s*"[^"]*"/gi, '"CRON_SECRET":"[redacted]"')
    .replace(/"expoPushToken"\s*:\s*"[^"]*"/gi, '"expoPushToken":"[redacted]"')
    .slice(0, 200);
}

function parseJsonResponse(body: string) {
  if (!body.trim()) {
    return null;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

export function getErrorMessage(data: unknown, fallback: string) {
  return isMobileApiErrorResponse(data) ? data.error : fallback;
}

export async function requestMobileApi(
  path: string,
  accessToken: string,
  options: Omit<RequestInit, "headers"> & {
    headers?: Record<string, string>;
  } = {},
): Promise<MobileApiResponse> {
  const endpoint = `${getApiBaseUrl()}${path}`;
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });
  const body = await response.text();

  return {
    bodyPreview: getBodyPreview(body),
    contentType: response.headers.get("content-type"),
    data: parseJsonResponse(body),
    endpoint,
    response,
  };
}

export function getResponseFormatError(
  label: string,
  { bodyPreview, contentType, endpoint, response }: MobileApiResponse,
) {
  return new Error(
    `${label}のレスポンス形式が正しくありません。 endpoint=${endpoint} status=${response.status} content-type=${contentType ?? "unknown"} body=${bodyPreview || "(empty)"}`,
  );
}

export function readDirectNormalizedArray<T>(
  data: unknown,
  normalize: (value: unknown) => T | null,
) {
  if (!Array.isArray(data)) {
    return null;
  }

  const normalizedItems = data.flatMap((item) => {
    const normalizedItem = normalize(item);
    return normalizedItem ? [normalizedItem] : [];
  });

  return normalizedItems.length === data.length ? normalizedItems : null;
}

export function readNormalizedArrayField<T>(
  data: unknown,
  fieldName: string,
  normalize: (value: unknown) => T | null,
) {
  if (!isRecord(data) || !(fieldName in data) || !Array.isArray(data[fieldName])) {
    return null;
  }

  return readDirectNormalizedArray(data[fieldName], normalize);
}

export function readNormalizedObjectField<T>(
  data: unknown,
  fieldName: string,
  normalize: (value: unknown) => T | null,
) {
  if (!isRecord(data) || !(fieldName in data)) {
    return null;
  }

  return normalize(data[fieldName]);
}

export function buildListQuery(options?: MobileListOptions) {
  const params = new URLSearchParams();

  if (options?.limit) {
    params.set("limit", String(options.limit));
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}
