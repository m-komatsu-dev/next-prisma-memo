"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPublicErrorMessage, logServerError } from "@/lib/server-errors";
import {
  addPostShareFormSchema,
  getFirstZodErrorMessage,
  revokePostShareFormSchema,
  updatePostShareFormSchema,
} from "@/lib/zod";
import { revalidatePath } from "next/cache";

export type ShareActionState = {
  message: string;
  status: "idle" | "success" | "error";
};

function getShareActionError(message: string): ShareActionState {
  return {
    message,
    status: "error",
  };
}

function getShareActionSuccess(message: string): ShareActionState {
  return {
    message,
    status: "success",
  };
}

async function getOwnedPost(postId: number, userId: string) {
  return prisma.post.findFirst({
    where: { id: postId, authorId: userId },
    select: { id: true },
  });
}

function revalidatePostSharePaths(postId: number) {
  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);
}

export async function addPostShare(
  _state: ShareActionState,
  formData: FormData,
): Promise<ShareActionState> {
  const session = await auth();

  if (!session?.user?.id) {
    return getShareActionError("ログインが必要です。");
  }

  const validatedFields = addPostShareFormSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );

  if (!validatedFields.success) {
    return getShareActionError(getFirstZodErrorMessage(validatedFields.error));
  }

  const { email, id: postId, role } = validatedFields.data;

  try {
    const [post, targetUser] = await Promise.all([
      getOwnedPost(postId, session.user.id),
      prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true },
      }),
    ]);

    if (!post) {
      return getShareActionError("対象のメモが見つからないか、共有設定を変更する権限がありません。");
    }

    if (!targetUser) {
      return getShareActionError("指定したメールアドレスのユーザーが見つかりません。");
    }

    if (targetUser.id === session.user.id) {
      return getShareActionError("自分自身には共有できません。");
    }

    await prisma.postShare.upsert({
      where: {
        postId_userId: {
          postId,
          userId: targetUser.id,
        },
      },
      create: {
        postId,
        role,
        userId: targetUser.id,
      },
      update: {
        role,
      },
    });

    revalidatePostSharePaths(postId);
    return getShareActionSuccess(`${targetUser.email ?? email} に共有しました。`);
  } catch (error) {
    logServerError(error, {
      action: "addPostShare",
      userId: session.user.id,
      postId,
      details: { email },
    });
    return getShareActionError(getPublicErrorMessage(error, "共有設定を追加できませんでした。"));
  }
}

export async function updatePostShare(
  _state: ShareActionState,
  formData: FormData,
): Promise<ShareActionState> {
  const session = await auth();

  if (!session?.user?.id) {
    return getShareActionError("ログインが必要です。");
  }

  const validatedFields = updatePostShareFormSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );

  if (!validatedFields.success) {
    return getShareActionError(getFirstZodErrorMessage(validatedFields.error));
  }

  const { id: postId, role, shareId } = validatedFields.data;

  try {
    const result = await prisma.postShare.updateMany({
      where: {
        id: shareId,
        postId,
        post: {
          authorId: session.user.id,
        },
        userId: {
          not: session.user.id,
        },
      },
      data: { role },
    });

    if (result.count === 0) {
      return getShareActionError("対象の共有設定が見つからないか、変更する権限がありません。");
    }

    revalidatePostSharePaths(postId);
    return getShareActionSuccess("共有権限を更新しました。");
  } catch (error) {
    logServerError(error, {
      action: "updatePostShare",
      userId: session.user.id,
      postId,
      details: { shareId },
    });
    return getShareActionError(getPublicErrorMessage(error, "共有権限を更新できませんでした。"));
  }
}

export async function revokePostShare(
  _state: ShareActionState,
  formData: FormData,
): Promise<ShareActionState> {
  const session = await auth();

  if (!session?.user?.id) {
    return getShareActionError("ログインが必要です。");
  }

  const validatedFields = revokePostShareFormSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );

  if (!validatedFields.success) {
    return getShareActionError(getFirstZodErrorMessage(validatedFields.error));
  }

  const { id: postId, shareId } = validatedFields.data;

  try {
    const result = await prisma.postShare.deleteMany({
      where: {
        id: shareId,
        postId,
        post: {
          authorId: session.user.id,
        },
        userId: {
          not: session.user.id,
        },
      },
    });

    if (result.count === 0) {
      return getShareActionError("対象の共有設定が見つからないか、解除する権限がありません。");
    }

    revalidatePostSharePaths(postId);
    return getShareActionSuccess("共有を解除しました。");
  } catch (error) {
    logServerError(error, {
      action: "revokePostShare",
      userId: session.user.id,
      postId,
      details: { shareId },
    });
    return getShareActionError(getPublicErrorMessage(error, "共有を解除できませんでした。"));
  }
}
