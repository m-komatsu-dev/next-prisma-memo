import { isOAuthProviderConfigured } from "@/auth";
import { isMobileOAuthProvider } from "@/lib/mobile-oauth";
import { NextResponse } from "next/server";

export function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");

  if (!isMobileOAuthProvider(provider)) {
    return NextResponse.json(
      { error: "providerの形式が正しくありません。" },
      { status: 400 },
    );
  }

  if (!isOAuthProviderConfigured(provider)) {
    return NextResponse.json(
      { error: "OAuth providerが設定されていません。" },
      { status: 503 },
    );
  }

  const callbackUrl = new URL("/mobile/oauth/complete", url.origin);
  const signInUrl = new URL(`/api/auth/signin/${provider}`, url.origin);
  signInUrl.searchParams.set("callbackUrl", callbackUrl.toString());

  return NextResponse.redirect(signInUrl);
}
