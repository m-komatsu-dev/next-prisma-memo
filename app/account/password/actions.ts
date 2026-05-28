"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-errors";
import { changePasswordSchema } from "@/lib/zod";
import bcrypt from "bcrypt";

export type ChangePasswordActionState = {
  error: string;
  success: string;
  fieldErrors?: {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };
};

export async function changePasswordAction(
  _prevState: ChangePasswordActionState,
  formData: FormData,
): Promise<ChangePasswordActionState> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      error: "ログインが必要です。",
      success: "",
    };
  }

  const validatedFields = changePasswordSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );

  if (!validatedFields.success) {
    const fieldErrors = validatedFields.error.flatten().fieldErrors;

    return {
      error: "入力内容を確認してください。",
      success: "",
      fieldErrors: {
        confirmPassword: fieldErrors.confirmPassword?.[0],
        currentPassword: fieldErrors.currentPassword?.[0],
        newPassword: fieldErrors.newPassword?.[0],
      },
    };
  }

  const { currentPassword, newPassword } = validatedFields.data;

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        password: true,
      },
    });

    if (!user) {
      return {
        error: "アカウントが見つかりませんでした。再度ログインしてください。",
        success: "",
      };
    }

    if (!user.password) {
      return {
        error: "パスワード変更できません。",
        success: "",
      };
    }

    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isValidPassword) {
      return {
        error: "現在のパスワードが違います。",
        success: "",
        fieldErrors: {
          currentPassword: "現在のパスワードが違います。",
        },
      };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const revokedAt = new Date();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      prisma.apiSession.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: { revokedAt },
      }),
    ]);

    return {
      error: "",
      success: "パスワードを変更しました",
    };
  } catch (error) {
    logServerError(error, {
      action: "changePassword",
      userId: session.user.id,
    });

    return {
      error:
        "パスワード変更に失敗しました。時間をおいてもう一度お試しください。",
      success: "",
    };
  }
}
