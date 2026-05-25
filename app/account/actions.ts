"use server";

import { auth, signOut } from "@/auth";
import { ACCOUNT_DELETE_CONFIRMATION } from "@/lib/account-delete-confirmation";
import { deleteAccountData } from "@/lib/account-deletion";
import { isRedirectError, logServerError } from "@/lib/server-errors";

export type DeleteAccountActionState = {
  error: string;
};

export async function deleteAccountAction(
  _prevState: DeleteAccountActionState,
  formData: FormData,
): Promise<DeleteAccountActionState> {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "ログインが必要です。" };
  }

  const confirmation = formData.get("confirmation");

  if (confirmation !== ACCOUNT_DELETE_CONFIRMATION) {
    return { error: "確認テキストに DELETE と入力してください。" };
  }

  try {
    const deleted = await deleteAccountData(session.user.id);

    if (!deleted) {
      return { error: "アカウントが見つかりませんでした。再度ログインしてください。" };
    }
  } catch (error) {
    logServerError(error, {
      action: "deleteAccount",
      userId: session.user.id,
    });

    return {
      error:
        "アカウント削除に失敗しました。時間をおいてもう一度お試しください。",
    };
  }

  try {
    await signOut({ redirectTo: "/" });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    logServerError(error, {
      action: "deleteAccountSignOut",
      userId: session.user.id,
    });

    return {
      error:
        "アカウントは削除されましたが、ログアウト処理に失敗しました。ブラウザを再読み込みしてください。",
    };
  }

  return { error: "" };
}
