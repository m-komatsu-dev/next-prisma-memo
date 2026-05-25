import { getMobileAuthUser } from "@/lib/mobile-auth";
import { mobileCorsOptions, withMobileCors } from "@/lib/mobile-cors";
import { ACCOUNT_DELETE_CONFIRMATION } from "@/lib/account-delete-confirmation";
import { deleteAccountData } from "@/lib/account-deletion";
import { logServerError } from "@/lib/server-errors";
import { NextResponse } from "next/server";

export function OPTIONS(request: Request) {
  return mobileCorsOptions(request);
}

export async function DELETE(request: Request) {
  const authUser = await getMobileAuthUser(request);

  if (!authUser) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "ログインが必要です。" }, { status: 401 }),
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: "リクエスト本文の形式が正しくありません。" },
        { status: 400 },
      ),
    );
  }

  const confirmation =
    body && typeof body === "object" && "confirmation" in body
      ? (body as { confirmation?: unknown }).confirmation
      : null;

  if (confirmation !== ACCOUNT_DELETE_CONFIRMATION) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: "確認テキストに DELETE と入力してください。" },
        { status: 400 },
      ),
    );
  }

  try {
    const deleted = await deleteAccountData(authUser.id);

    if (!deleted) {
      return withMobileCors(
        request,
        NextResponse.json(
          { error: "アカウントが見つかりませんでした。" },
          { status: 404 },
        ),
      );
    }

    return withMobileCors(
      request,
      NextResponse.json({
        ok: true,
        deleted,
      }),
    );
  } catch (error) {
    logServerError(error, {
      action: "mobileDeleteAccount",
      userId: authUser.id,
    });

    return withMobileCors(
      request,
      NextResponse.json(
        { error: "アカウント削除に失敗しました。" },
        { status: 500 },
      ),
    );
  }
}
