"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { buildTagsConnectOrCreate } from "@/lib/post-tags";// 入力されたタグを、既存タグへの接続または新規作成用の形に変換する関数を読み込みます。
import { getEditablePostWhere } from "@/lib/post-permissions";
import {  
  getPublicErrorMessage,// ユーザーに見せても安全なエラーメッセージを作る関数です。
  logServerError,// サーバー側のログに詳しいエラー情報を残す関数です。
  throwLoggedActionError,// エラーをログに残してから、画面側へ例外として投げる関数です。
} from "@/lib/server-errors";
import {
  getFirstZodErrorMessage,// Zod の検証エラーから最初のメッセージだけを取り出す関数です。
  postDraftPayloadSchema,  // 自動保存用データを検証するスキーマです。
  postSavePayloadSchema,  // 通常保存用データを検証するスキーマです。
  postIdValueSchema,  // 投稿 ID が正しい値か検証するスキーマです。
  type PostDraftPayloadInput,  // 自動保存用データの TypeScript の型です。
  type PostSavePayloadInput,  // 通常保存用データの TypeScript の型です。
} from "@/lib/zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// 編集画面で、ユーザーが入力中の内容を下書きとして自動保存する関数です。
export async function autoSaveEditPost(data: PostDraftPayloadInput) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "ログインが必要です。" };
  const userId = session.user.id;

  const validatedFields = postDraftPayloadSchema.safeParse(data);// 受け取ったデータが、自動保存に必要な形式として正しいか検証します。
  if (!validatedFields.success) {
    return {
      success: false,
      message: getFirstZodErrorMessage(validatedFields.error),// Zod のエラーから、ユーザーに見せる最初のエラーメッセージを入れます。
    };
  }

  const payload = validatedFields.data;// 検証に成功した、安全に使えるデータを payload として取り出します。
  if (!payload.id) return { success: false, message: "更新対象のメモが見つかりません。" };// 更新する投稿 ID がなければ、どのメモを更新するか分からないので失敗を返します。

  const postId = payload.id;
  const tagsData = buildTagsConnectOrCreate(payload.tags);  // 入力されたタグ文字列を、Prisma の connectOrCreate で使える形に変換します。

  try {
    await prisma.$transaction(async (tx) => {
      const editablePost = await tx.post.findFirst({
        where: getEditablePostWhere(postId, userId),
        select: { authorId: true, id: true },
      });

      if (!editablePost) {
        throw new Error("対象のメモが見つからないか、編集する権限がありません。");
      }

      await tx.post.update({
        where: { id: editablePost.id },
        data: {
          title: payload.title.trim() || "無題の下書き",
          content: payload.content,
          kind: payload.kind,
          todoListDueAt: payload.kind === "dueTodo" ? payload.todoListDueAt : null,
          ...(editablePost.authorId === userId
            ? { published: payload.published ?? false }
            : {}),
          // 投稿に紐づくタグを更新します。
          tags: {
            set: [],// いったん既存のタグとの紐づけをすべて外します。
            connectOrCreate: tagsData,// 入力されたタグを、既存なら接続し、なければ作成して接続します。
          },
        },
      });
    });
    revalidatePath("/posts");
    revalidatePath(`/posts/${postId}`);
    return { success: true };
  } catch (error) {
    // 開発者が原因を追えるように、詳しいエラー情報をサーバーログへ残します。
    logServerError(error, {
      action: "autoSaveEditPost",
      userId,
      postId,
    });
    return {
      success: false,
      message: getPublicErrorMessage(error, "下書き保存に失敗しました。"),
    };
  }
}

// 編集画面で、ユーザーが明示的に保存ボタンを押したときに投稿を更新する関数です。
export async function saveEditPost(data: PostSavePayloadInput) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const validatedFields = postSavePayloadSchema.safeParse(data);// 受け取ったデータが、通常保存に必要な形式として正しいか検証します。
  if (!validatedFields.success) {
    throw new Error(getFirstZodErrorMessage(validatedFields.error));// Zod のエラーから最初のメッセージを取り出して例外にします。
  }

  const payload = validatedFields.data;
  if (!payload.id) throw new Error("更新対象のメモが見つかりません。");

  const postId = payload.id;
  // データベース更新でエラーが起きる可能性があるため、try/catch で囲みます。
  try {
    await prisma.$transaction(async (tx) => {
      const editablePost = await tx.post.findFirst({
        where: getEditablePostWhere(postId, userId),
        select: { authorId: true, id: true },
      });

      if (!editablePost) {
        throw new Error("対象のメモが見つからないか、編集する権限がありません。");
      }

      await tx.post.update({
        where: { id: editablePost.id },
        data: {
          title: payload.title.trim(),
          content: payload.content.trim(),
          kind: payload.kind,
          todoListDueAt: payload.kind === "dueTodo" ? payload.todoListDueAt : null,
          ...(editablePost.authorId === userId
            ? { published: payload.published }
            : {}),
          // 投稿に紐づくタグを更新します。
          tags: {
            set: [],// いったん既存のタグとの紐づけをすべて外します。
            connectOrCreate: buildTagsConnectOrCreate(payload.tags),// 入力されたタグを、既存なら接続し、なければ作成して接続します。
          },
        },
      });
    });
  } catch (error) {
    // エラーをログに残し、画面側には安全なメッセージとして投げ直します。
    throwLoggedActionError(
      error,
      // ログに追加する、調査用の補足情報です。
      {
        action: "saveEditPost",
        userId,
        postId,
      },
      "メモの更新に失敗しました。",
    );
  }

  revalidatePath("/posts");
  // 更新した投稿の詳細ページのキャッシュも更新対象にします。
  revalidatePath(`/posts/${postId}`);
  redirect("/posts");
}

// 投稿 ID と入力データを別々に受け取り、自動保存用の形式に整えて保存する関数です。
export async function autoSavePost(
  id: number,// URL などから渡される投稿 ID です。
  data: { title: string; content: string; tags: string; published?: boolean }, // 画面から送られてくるタイトル、本文、タグ、公開状態のデータです。
) {
  const validatedId = postIdValueSchema.safeParse(id);
  if (!validatedId.success) {
    return { success: false, message: getFirstZodErrorMessage(validatedId.error) };
  }

  // ID とデータを autoSaveEditPost が受け取れる形にまとめて、自動保存処理へ渡します。
  return autoSaveEditPost({
    id: validatedId.data,
    title: data.title,
    content: data.content,
    tags: data.tags,
    published: data.published ?? false,
  });
}
