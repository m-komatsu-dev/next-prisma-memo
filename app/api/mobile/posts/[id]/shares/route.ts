import { getMobileAuthUser } from "@/lib/mobile-auth";
import {
  mobilePostShareSelect,
  serializeMobilePostShare,
} from "@/lib/mobile-post-shares";
import { mobileCorsOptions, withMobileCors } from "@/lib/mobile-cors";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-errors";
import {
  getFirstZodErrorMessage,
  mobileAddPostShareSchema,
  postIdValueSchema,
} from "@/lib/zod";
import { NextResponse } from "next/server";

type MobilePostSharesRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export function OPTIONS(request: Request) {
  return mobileCorsOptions(request);
}

async function getOwnedPost(postId: number, userId: string) {
  return prisma.post.findFirst({
    where: { id: postId, authorId: userId },
    select: { id: true },
  });
}

export async function GET(request: Request, { params }: MobilePostSharesRouteContext) {
  const authUser = await getMobileAuthUser(request);

  if (!authUser) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "ログインが必要です。" }, { status: 401 }),
    );
  }

  const { id } = await params;
  const validatedPostId = postIdValueSchema.safeParse(id);

  if (!validatedPostId.success) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: "メモIDの形式が正しくありません。" },
        { status: 400 },
      ),
    );
  }

  const postId = validatedPostId.data;

  try {
    const post = await getOwnedPost(postId, authUser.id);

    if (!post) {
      return withMobileCors(
        request,
        NextResponse.json(
          { error: "共有設定を表示する権限がありません。" },
          { status: 403 },
        ),
      );
    }

    const shares = await prisma.postShare.findMany({
      where: { postId },
      select: mobilePostShareSelect,
      orderBy: { updatedAt: "desc" },
    });

    return withMobileCors(
      request,
      NextResponse.json({
        shares: shares.map(serializeMobilePostShare),
      }),
    );
  } catch (error) {
    logServerError(error, {
      action: "mobileListPostShares",
      userId: authUser.id,
      postId,
    });

    return withMobileCors(
      request,
      NextResponse.json(
        { error: "共有設定の取得に失敗しました。" },
        { status: 500 },
      ),
    );
  }
}

export async function POST(request: Request, { params }: MobilePostSharesRouteContext) {
  const authUser = await getMobileAuthUser(request);

  if (!authUser) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "ログインが必要です。" }, { status: 401 }),
    );
  }

  const { id } = await params;
  const validatedPostId = postIdValueSchema.safeParse(id);

  if (!validatedPostId.success) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: "メモIDの形式が正しくありません。" },
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

  const validatedFields = mobileAddPostShareSchema.safeParse(body);

  if (!validatedFields.success) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: getFirstZodErrorMessage(validatedFields.error) },
        { status: 400 },
      ),
    );
  }

  const postId = validatedPostId.data;
  const { email, role } = validatedFields.data;

  try {
    const [post, targetUser] = await Promise.all([
      getOwnedPost(postId, authUser.id),
      prisma.user.findUnique({
        where: { email },
        select: { id: true },
      }),
    ]);

    if (!post) {
      return withMobileCors(
        request,
        NextResponse.json(
          { error: "共有設定を変更する権限がありません。" },
          { status: 403 },
        ),
      );
    }

    if (!targetUser) {
      return withMobileCors(
        request,
        NextResponse.json(
          { error: "指定したメールアドレスのユーザーが見つかりません。" },
          { status: 404 },
        ),
      );
    }

    if (targetUser.id === authUser.id) {
      return withMobileCors(
        request,
        NextResponse.json(
          { error: "自分自身には共有できません。" },
          { status: 400 },
        ),
      );
    }

    const share = await prisma.postShare.upsert({
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
      update: { role },
      select: mobilePostShareSelect,
    });

    return withMobileCors(
      request,
      NextResponse.json({ share: serializeMobilePostShare(share) }),
    );
  } catch (error) {
    logServerError(error, {
      action: "mobileAddPostShare",
      userId: authUser.id,
      postId,
      details: { email },
    });

    return withMobileCors(
      request,
      NextResponse.json(
        { error: "共有設定を追加できませんでした。" },
        { status: 500 },
      ),
    );
  }
}
