import { getMobileAuthUser } from "@/lib/mobile-auth";
import { mobileCorsOptions, withMobileCors } from "@/lib/mobile-cors";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-errors";
import {
  getFirstZodErrorMessage,
  mobilePushSubscriptionSchema,
  mobileRevokePushSubscriptionSchema,
} from "@/lib/zod";
import { NextResponse } from "next/server";

export function OPTIONS(request: Request) {
  return mobileCorsOptions(request);
}

export async function POST(request: Request) {
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

  const validatedFields = mobilePushSubscriptionSchema.safeParse(body);

  if (!validatedFields.success) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: getFirstZodErrorMessage(validatedFields.error) },
        { status: 400 },
      ),
    );
  }

  const payload = validatedFields.data;

  try {
    const now = new Date();
    const existingSubscription = await prisma.pushSubscription.findUnique({
      where: { expoPushToken: payload.expoPushToken },
      select: {
        id: true,
        revokedAt: true,
        userId: true,
      },
    });

    if (
      existingSubscription &&
      existingSubscription.userId !== authUser.id &&
      !existingSubscription.revokedAt
    ) {
      return withMobileCors(
        request,
        NextResponse.json(
          { error: "このPush Tokenは別のユーザーに登録済みです。" },
          { status: 409 },
        ),
      );
    }

    const subscription = await prisma.pushSubscription.upsert({
      create: {
        deviceName: payload.deviceName?.slice(0, 120) ?? null,
        expoPushToken: payload.expoPushToken,
        platform: payload.platform ?? null,
        userId: authUser.id,
      },
      update: {
        deviceName: payload.deviceName?.slice(0, 120) ?? null,
        platform: payload.platform ?? null,
        revokedAt: null,
        updatedAt: now,
        userId: authUser.id,
      },
      where: { expoPushToken: payload.expoPushToken },
      select: { id: true, platform: true, updatedAt: true },
    });

    return withMobileCors(
      request,
      NextResponse.json({
        pushSubscription: {
          id: subscription.id,
          platform: subscription.platform,
          updatedAt: subscription.updatedAt.toISOString(),
        },
      }),
    );
  } catch (error) {
    logServerError(error, {
      action: "mobileRegisterPushSubscription",
      userId: authUser.id,
    });

    return withMobileCors(
      request,
      NextResponse.json(
        { error: "Push Tokenの登録に失敗しました。" },
        { status: 500 },
      ),
    );
  }
}

export async function DELETE(request: Request) {
  const authUser = await getMobileAuthUser(request);

  if (!authUser) {
    return withMobileCors(
      request,
      NextResponse.json({ error: "ログインが必要です。" }, { status: 401 }),
    );
  }

  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const validatedFields = mobileRevokePushSubscriptionSchema.safeParse(body);

  if (!validatedFields.success) {
    return withMobileCors(
      request,
      NextResponse.json(
        { error: getFirstZodErrorMessage(validatedFields.error) },
        { status: 400 },
      ),
    );
  }

  try {
    const now = new Date();
    const result = await prisma.pushSubscription.updateMany({
      data: { revokedAt: now },
      where: {
        userId: authUser.id,
        revokedAt: null,
        ...(validatedFields.data.expoPushToken
          ? { expoPushToken: validatedFields.data.expoPushToken }
          : {}),
      },
    });

    return withMobileCors(
      request,
      NextResponse.json({ revokedCount: result.count, success: true }),
    );
  } catch (error) {
    logServerError(error, {
      action: "mobileRevokePushSubscription",
      userId: authUser.id,
    });

    return withMobileCors(
      request,
      NextResponse.json(
        { error: "Push Tokenの無効化に失敗しました。" },
        { status: 500 },
      ),
    );
  }
}
