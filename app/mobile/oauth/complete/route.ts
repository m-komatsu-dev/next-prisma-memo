import { auth } from "@/auth";
import {
  createMobileOAuthCode,
  getMobileOAuthCallbackUrl,
} from "@/lib/mobile-oauth";
import { logServerError } from "@/lib/server-errors";
import { NextResponse } from "next/server";

function buildMobileRedirect(params: Record<string, string>) {
  const redirectUrl = new URL(getMobileOAuthCallbackUrl());

  for (const [key, value] of Object.entries(params)) {
    redirectUrl.searchParams.set(key, value);
  }

  return redirectUrl;
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect(
      buildMobileRedirect({ error: "not_authenticated" }),
    );
  }

  try {
    const code = await createMobileOAuthCode(
      session.user.id,
      request.headers.get("user-agent"),
    );

    return NextResponse.redirect(buildMobileRedirect({ code }));
  } catch (error) {
    logServerError(error, {
      action: "mobileOAuthComplete",
    });

    return NextResponse.redirect(
      buildMobileRedirect({ error: "code_issue_failed" }),
    );
  }
}
