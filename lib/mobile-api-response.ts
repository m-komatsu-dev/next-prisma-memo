import { withMobileCors } from "@/lib/mobile-cors";
import { NextResponse } from "next/server";

type MobileJsonBody = Record<string, unknown>;

export function mobileJson(
  request: Request,
  body: MobileJsonBody,
  init?: ResponseInit,
) {
  return withMobileCors(request, NextResponse.json(body, init));
}

export function mobileError(
  request: Request,
  message: string,
  status: number,
) {
  return mobileJson(request, { error: message }, { status });
}
