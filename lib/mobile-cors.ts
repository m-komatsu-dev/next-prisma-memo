import { NextResponse } from "next/server";

const ALLOWED_MOBILE_DEV_ORIGINS = new Set([
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://192.168.11.8:8081",
]);

function getAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin || !ALLOWED_MOBILE_DEV_ORIGINS.has(origin)) {
    return null;
  }

  return origin;
}

function applyMobileCorsHeaders(request: Request, response: NextResponse) {
  const origin = getAllowedOrigin(request);

  if (!origin) {
    return response;
  }

  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,DELETE,OPTIONS",
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Accept, Authorization, Content-Type",
  );
  response.headers.set("Vary", "Origin");

  return response;
}

export function withMobileCors(request: Request, response: NextResponse) {
  return applyMobileCorsHeaders(request, response);
}

export function mobileCorsOptions(request: Request) {
  return applyMobileCorsHeaders(
    request,
    new NextResponse(null, { status: 204 }),
  );
}
