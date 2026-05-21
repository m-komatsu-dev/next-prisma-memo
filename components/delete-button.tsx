import { prisma } from "@/lib/prisma"; // lib/prisma.ts を経由してインポート
import { auth } from "@/auth";
import { logServerError, throwLoggedActionError } from "@/lib/server-errors";
import { getFirstZodErrorMessage, postIdValueSchema } from "@/lib/zod";
import { revalidatePath } from "next/cache";// キャッシュをクリアして最新のデータを表示させるための関数

interface DeleteButtonProps {
  id: number;
}

export function DeleteButton({ id }: DeleteButtonProps) {
  // サーバーアクション: データベースから削除を実行する
  async function deletePost() {
    "use server";

    const session = await auth();

    if (!session?.user?.id) {
      logServerError(new Error("Unauthenticated DeleteButton action"), {
        action: "deleteButtonDeletePost",// どの処理で起きたエラーかを示します。
        postId: id,
      });
      throw new Error("ログインが必要です。");
    }

    const validatedId = postIdValueSchema.safeParse(id);
    if (!validatedId.success) {
      throw new Error(getFirstZodErrorMessage(validatedId.error));
    }

    let deletedCount = 0;

    try {
      const result = await prisma.post.deleteMany({
        where: {
          id: validatedId.data,
          authorId: session.user.id,
        },
      });
      deletedCount = result.count;
    } catch (error) {
      throwLoggedActionError(
        error,
        {
          action: "deleteButtonDeletePost",
          userId: session.user.id,
          postId: validatedId.data,
        },
        "削除できませんでした。",
      );
    }

    if (deletedCount === 0) {
      throwLoggedActionError(
        new Error("DeleteButton post delete affected 0 rows"),
        {
          action: "deleteButtonDeletePost",
          userId: session.user.id,
          postId: validatedId.data,
        },
        "対象のメモが見つからないか、操作する権限がありません。",
      );
    }

    revalidatePath("/posts");
  }
  return (
    <form action={deletePost}>
      <button
        type="submit"
        className="text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded-md transition-colors border border-red-100"
      >
        削除
      </button>
    </form>
  );
}
