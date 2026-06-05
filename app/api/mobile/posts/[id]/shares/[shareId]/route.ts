import { getMobileAuthUser } from "@/lib/mobile-auth";
import {
  mobilePostShareSelect,
  serializeMobilePostShare,
} from "@/lib/mobile-post-shares";
import { mobileCorsOptions, withMobileCors } from "@/lib/mobile-cors";
import { ensurePostShareNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-errors";
import {
  getFirstZodErrorMessage,
  mobileUpdatePostShareSchema,
  postIdValueSchema,
  postShareIdValueSchema,
} from "@/lib/zod";
import { NextResponse } from "next/server";

type MobilePostShareRouteContext = {
  params: Promise<{
    id: string;
    shareId: string;
  }>;
};

export function OPTIONS(request: Request) {
  return mobileCorsOptions(request);
}

async function validateParams(params: MobilePostShareRouteContext["params"]) {
  const { id, shareId } = await params;
  const validatedPostId = postIdValueSchema.safeParse(id);
  const validatedShareId = postShareIdValueSchema.safeParse(shareId);

  if (!validatedPostId.success || !validatedShareId.success) {
    return null;
  }

  return {
    postId: validatedPostId.data,
    shareId: validatedShareId.data,
  };
}

export async function PATCH(request: Request, { params }: MobilePostShareRouteContext) {
  const authUser = await getMobileAuthUser(request);

  if (!authUser) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "ログインが必要です。" }, { status: 401 }),
    );
  }

  const validatedParams = await validateParams(params);

  if (!validatedParams) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: "共有設定IDの形式が正しくありません。" },
        { status: 400 },
      ),
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

  const validatedFields = mobileUpdatePostShareSchema.safeParse(body);

  if (!validatedFields.success) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: getFirstZodErrorMessage(validatedFields.error) },
        { status: 400 },
      ),
    );
  }

  const { postId, shareId } = validatedParams;

  try {
    const share = await prisma.$transaction(async (tx) => {
      const result = await tx.postShare.updateMany({
        where: {
          id: shareId,
          postId,
          post: { authorId: authUser.id },
          userId: { not: authUser.id },
        },
        data: { role: validatedFields.data.role },
      });

      if (result.count === 0) {
        return null;
      }

      await ensurePostShareNotification(shareId, authUser.id, tx);

      return tx.postShare.findFirst({
        where: { id: shareId, postId },
        select: mobilePostShareSelect,
      });
    });

    if (!share) {
      return withMobileCors(
        request,
        NextResponse.json(
          { error: "対象の共有設定が見つからないか、変更する権限がありません。" },
          { status: 403 },
        ),
      );
    }

    return withMobileCors(
      request,
      NextResponse.json({ share: serializeMobilePostShare(share) }),
    );
  } catch (error) {
    logServerError(error, {
      action: "mobileUpdatePostShare",
      userId: authUser.id,
      postId,
      details: { shareId },
    });

    return withMobileCors(
      request,
      NextResponse.json(
        { error: "共有権限を更新できませんでした。" },
        { status: 500 },
      ),
    );
  }
}

export async function DELETE(request: Request, { params }: MobilePostShareRouteContext) {
  const authUser = await getMobileAuthUser(request);

  if (!authUser) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "ログインが必要です。" }, { status: 401 }),
    );
  }

  const validatedParams = await validateParams(params);

  if (!validatedParams) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: "共有設定IDの形式が正しくありません。" },
        { status: 400 },
      ),
    );
  }

  const { postId, shareId } = validatedParams;

  try {
    const result = await prisma.postShare.deleteMany({
      where: {
        id: shareId,
        postId,
        post: { authorId: authUser.id },
        userId: { not: authUser.id },
      },
    });

    if (result.count === 0) {
      return withMobileCors(
        request,
        NextResponse.json(
          { error: "対象の共有設定が見つからないか、解除する権限がありません。" },
          { status: 403 },
        ),
      );
    }

    return withMobileCors(request, NextResponse.json({ success: true }));
  } catch (error) {
    logServerError(error, {
      action: "mobileRevokePostShare",
      userId: authUser.id,
      postId,
      details: { shareId },
    });

    return withMobileCors(
      request,
      NextResponse.json(
        { error: "共有を解除できませんでした。" },
        { status: 500 },
      ),
    );
  }
}
