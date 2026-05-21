// このファイルの関数をサーバー側で実行する Server Action として扱う指定です。
"use server";

// データベースを操作するための Prisma Client を読み込みます。
import { prisma } from "@/lib/prisma";
// 現在ログインしているユーザー情報を取得するための auth 関数を読み込みます。
import { auth } from "@/auth";
// 入力されたタグを、既存タグへの接続または新規作成用の形に変換する関数を読み込みます。
import { buildTagsConnectOrCreate } from "@/lib/post-tags";
// サーバーエラーを扱いやすくするための関数群を読み込みます。
import {
  // ユーザーに見せても安全なエラーメッセージを作る関数です。
  getPublicErrorMessage,
  // サーバー側のログに詳しいエラー情報を残す関数です。
  logServerError,
  // エラーをログに残してから、画面側へ例外として投げる関数です。
  throwLoggedActionError,
} from "@/lib/server-errors";
// 入力値の検証に使う Zod スキーマや型を読み込みます。
import {
  // Zod の検証エラーから最初のメッセージだけを取り出す関数です。
  getFirstZodErrorMessage,
  // 自動保存用データを検証するスキーマです。
  postDraftPayloadSchema,
  // 通常保存用データを検証するスキーマです。
  postSavePayloadSchema,
  // 投稿 ID が正しい値か検証するスキーマです。
  postIdValueSchema,
  // 自動保存用データの TypeScript の型です。
  type PostDraftPayloadInput,
  // 通常保存用データの TypeScript の型です。
  type PostSavePayloadInput,
} from "@/lib/zod";
// Next.js のキャッシュを更新し、古い画面が表示され続けないようにする関数です。
import { revalidatePath } from "next/cache";
// 処理後に別ページへ移動させるための関数です。
import { redirect } from "next/navigation";

// 編集画面で、ユーザーが入力中の内容を下書きとして自動保存する関数です。
export async function autoSaveEditPost(data: PostDraftPayloadInput) {
  // 現在のログイン状態を取得します。
  const session = await auth();
  // ログインしていない場合は、保存せずに失敗結果を返します。
  if (!session?.user?.id) return { success: false, message: "ログインが必要です。" };

  // 受け取ったデータが、自動保存に必要な形式として正しいか検証します。
  const validatedFields = postDraftPayloadSchema.safeParse(data);
  // 検証に失敗した場合は、データベースを触らずにエラーメッセージを返します。
  if (!validatedFields.success) {
    // 画面側で扱いやすいように、成功/失敗とメッセージをセットで返します。
    return {
      // success が false なので、この処理は失敗したことを表します。
      success: false,
      // Zod のエラーから、ユーザーに見せる最初のエラーメッセージを入れます。
      message: getFirstZodErrorMessage(validatedFields.error),
    };
  }

  // 検証に成功した、安全に使えるデータを payload として取り出します。
  const payload = validatedFields.data;
  // 更新する投稿 ID がなければ、どのメモを更新するか分からないので失敗を返します。
  if (!payload.id) return { success: false, message: "更新対象のメモが見つかりません。" };

  // 入力されたタグ文字列を、Prisma の connectOrCreate で使える形に変換します。
  const tagsData = buildTagsConnectOrCreate(payload.tags);

  // データベース更新でエラーが起きる可能性があるため、try/catch で囲みます。
  try {
    // 条件に合う投稿をデータベース上で更新します。
    await prisma.post.update({
      // 更新対象は、投稿 ID とログイン中ユーザーの ID が両方一致する投稿です。
      where: { id: payload.id, authorId: session.user.id },
      // ここに書いた内容で投稿を更新します。
      data: {
        // タイトルは前後の空白を消し、空なら「無題の下書き」にします。
        title: payload.title.trim() || "無題の下書き",
        // 本文は自動保存なので、入力途中の空白も含めてそのまま保存します。
        content: payload.content,
        // published が未指定なら false、つまり未公開として保存します。
        published: payload.published ?? false,
        // 投稿に紐づくタグを更新します。
        tags: {
          // いったん既存のタグとの紐づけをすべて外します。
          set: [],
          // 入力されたタグを、既存なら接続し、なければ作成して接続します。
          connectOrCreate: tagsData,
        },
      },
    });
    // 投稿一覧ページのキャッシュを更新対象にして、最新内容が表示されるようにします。
    revalidatePath("/posts");
    // 更新した投稿の詳細ページのキャッシュも更新対象にします。
    revalidatePath(`/posts/${payload.id}`);
    // 画面側へ、自動保存が成功したことを返します。
    return { success: true };
  // データベース更新などでエラーが起きた場合は、ここで受け取ります。
  } catch (error) {
    // 開発者が原因を追えるように、詳しいエラー情報をサーバーログへ残します。
    logServerError(error, {
      // どの Server Action で起きたエラーか分かるように名前を残します。
      action: "autoSaveEditPost",
      // どのユーザーの操作だったかをログに残します。
      userId: session.user.id,
      // どの投稿を更新しようとしていたかをログに残します。
      postId: payload.id,
    });
    // 画面側には、内部情報を出しすぎない安全なエラーメッセージを返します。
    return {
      // success が false なので、自動保存は失敗したことを表します。
      success: false,
      // エラー内容に応じた公開用メッセージか、既定の文言を返します。
      message: getPublicErrorMessage(error, "下書き保存に失敗しました。"),
    };
  }
}

// 編集画面で、ユーザーが明示的に保存ボタンを押したときに投稿を更新する関数です。
export async function saveEditPost(data: PostSavePayloadInput) {
  // 現在のログイン状態を取得します。
  const session = await auth();
  // ログインしていない場合は、トップページへ移動させます。
  if (!session?.user?.id) redirect("/");

  // 受け取ったデータが、通常保存に必要な形式として正しいか検証します。
  const validatedFields = postSavePayloadSchema.safeParse(data);
  // 検証に失敗した場合は、保存せずにエラーとして画面側へ伝えます。
  if (!validatedFields.success) {
    // Zod のエラーから最初のメッセージを取り出して例外にします。
    throw new Error(getFirstZodErrorMessage(validatedFields.error));
  }

  // 検証に成功した、安全に使えるデータを payload として取り出します。
  const payload = validatedFields.data;
  // 更新対象の投稿 ID がない場合は、保存できないのでエラーにします。
  if (!payload.id) throw new Error("更新対象のメモが見つかりません。");

  // データベース更新でエラーが起きる可能性があるため、try/catch で囲みます。
  try {
    // 条件に合う投稿をデータベース上で更新します。
    await prisma.post.update({
      // 更新対象は、投稿 ID とログイン中ユーザーの ID が両方一致する投稿です。
      where: { id: payload.id, authorId: session.user.id },
      // ここに書いた内容で投稿を更新します。
      data: {
        // タイトルの前後の空白を消して保存します。
        title: payload.title.trim(),
        // 本文の前後の空白を消して保存します。
        content: payload.content.trim(),
        // 公開状態を、送られてきた値のまま保存します。
        published: payload.published,
        // 投稿に紐づくタグを更新します。
        tags: {
          // いったん既存のタグとの紐づけをすべて外します。
          set: [],
          // 入力されたタグを、既存なら接続し、なければ作成して接続します。
          connectOrCreate: buildTagsConnectOrCreate(payload.tags),
        },
      },
    });
  // データベース更新などでエラーが起きた場合は、ここで受け取ります。
  } catch (error) {
    // エラーをログに残し、画面側には安全なメッセージとして投げ直します。
    throwLoggedActionError(
      // 実際に発生したエラー本体です。
      error,
      // ログに追加する、調査用の補足情報です。
      {
        // どの Server Action で起きたエラーか分かるように名前を残します。
        action: "saveEditPost",
        // どのユーザーの操作だったかをログに残します。
        userId: session.user.id,
        // どの投稿を更新しようとしていたかをログに残します。
        postId: payload.id,
      },
      // ユーザーに見せる既定のエラーメッセージです。
      "メモの更新に失敗しました。",
    );
  }

  // 投稿一覧ページのキャッシュを更新対象にして、最新内容が表示されるようにします。
  revalidatePath("/posts");
  // 更新した投稿の詳細ページのキャッシュも更新対象にします。
  revalidatePath(`/posts/${payload.id}`);
  // 保存後は投稿一覧ページへ移動します。
  redirect("/posts");
}

// 投稿 ID と入力データを別々に受け取り、自動保存用の形式に整えて保存する関数です。
export async function autoSavePost(
  // URL などから渡される投稿 ID です。
  id: number,
  // 画面から送られてくるタイトル、本文、タグ、公開状態のデータです。
  data: { title: string; content: string; tags: string; published?: boolean },
) {
  // 投稿 ID が正しい数値として使えるか検証します。
  const validatedId = postIdValueSchema.safeParse(id);
  // ID の検証に失敗した場合は、自動保存せずにエラーメッセージを返します。
  if (!validatedId.success) {
    // 画面側で扱いやすいように、成功/失敗とメッセージをセットで返します。
    return { success: false, message: getFirstZodErrorMessage(validatedId.error) };
  }

  // ID とデータを autoSaveEditPost が受け取れる形にまとめて、自動保存処理へ渡します。
  return autoSaveEditPost({
    // 検証済みの投稿 ID を使います。
    id: validatedId.data,
    // 入力されたタイトルをそのまま渡します。
    title: data.title,
    // 入力された本文をそのまま渡します。
    content: data.content,
    // 入力されたタグ文字列をそのまま渡します。
    tags: data.tags,
    // published が未指定なら false、つまり未公開として扱います。
    published: data.published ?? false,
  });
}
