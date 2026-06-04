"use server";

import { auth } from "@/auth";
import { buildTagsConnectOrCreate } from "@/lib/post-tags";
import { prisma } from "@/lib/prisma";
import {
  getPublicErrorMessage,
  logServerError,
  throwLoggedActionError,
} from "@/lib/server-errors";
import {
  getFirstZodErrorMessage,
  dueTodoListCreateSchema,
  postDraftPayloadSchema,
  postSavePayloadSchema,
  type PostDraftPayloadInput,
  type PostSavePayloadInput,
} from "@/lib/zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function autoSaveNewPost(data: PostDraftPayloadInput) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: "ログインが必要です。" };

  const validatedFields = postDraftPayloadSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      success: false,
      message: getFirstZodErrorMessage(validatedFields.error),
    };
  }

  const payload = validatedFields.data;
  const title = payload.title.trim() || "無題の下書き";
  const content = payload.content;
  const tagsData = buildTagsConnectOrCreate(payload.tags);

  try {
    const post = payload.id
      ? await prisma.post.update({
          where: { id: payload.id, authorId: session.user.id },
          data: {
            title,
            content,
            published: false,
            kind: payload.kind,
            todoListDueAt: payload.kind === "dueTodo" ? payload.todoListDueAt : null,
            tags: {
              set: [],
              connectOrCreate: tagsData,
            },
          },
          select: { id: true },
        })
      : await prisma.post.create({
          data: {
            title,
            content,
            published: false,
            kind: payload.kind,
            todoListDueAt: payload.kind === "dueTodo" ? payload.todoListDueAt : null,
            authorId: session.user.id,
            tags: {
              connectOrCreate: tagsData,
            },
          },
          select: { id: true },
        });

    revalidatePath("/posts");
    return { success: true, id: post.id };
  } catch (error) {
    logServerError(error, {
      action: "autoSaveNewPost",
      userId: session.user.id,
      postId: payload.id ?? undefined,
    });
    return {
      success: false,
      message: getPublicErrorMessage(error, "下書き保存に失敗しました。"),
    };
  }
}

export async function saveNewPost(data: PostSavePayloadInput) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const validatedFields = postSavePayloadSchema.safeParse(data);
  if (!validatedFields.success) {
    throw new Error(getFirstZodErrorMessage(validatedFields.error));
  }

  const payload = validatedFields.data;
  const title = payload.title.trim();
  const content = payload.content.trim();
  const tagsData = buildTagsConnectOrCreate(payload.tags);

  try {
    if (payload.id) {
      await prisma.post.update({
        where: { id: payload.id, authorId: session.user.id },
        data: {
          title,
          content,
          published: payload.published,
          kind: payload.kind,
          todoListDueAt: payload.kind === "dueTodo" ? payload.todoListDueAt : null,
          tags: {
            set: [],
            connectOrCreate: tagsData,
          },
        },
      });
    } else {
      await prisma.post.create({
        data: {
          title,
          content,
          published: payload.published,
          kind: payload.kind,
          todoListDueAt: payload.kind === "dueTodo" ? payload.todoListDueAt : null,
          authorId: session.user.id,
          tags: {
            connectOrCreate: tagsData,
          },
        },
      });
    }
  } catch (error) {
    throwLoggedActionError(
      error,
      {
        action: "saveNewPost",
        userId: session.user.id,
        postId: payload.id ?? undefined,
      },
      "メモの保存に失敗しました。",
    );
  }

  revalidatePath("/posts");
  redirect("/posts");
}

export async function createDueTodoListPost(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const validatedFields = dueTodoListCreateSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      success: false,
      message: getFirstZodErrorMessage(validatedFields.error),
    };
  }

  const payload = validatedFields.data;
  const tagsData = buildTagsConnectOrCreate(payload.tags);

  try {
    await prisma.post.create({
      data: {
        title: payload.title,
        content: "期限付きTodo",
        published: false,
        kind: "dueTodo",
        todoListDueAt: payload.todoListDueAt,
        authorId: session.user.id,
        tags: {
          connectOrCreate: tagsData,
        },
        todoItems: {
          create: payload.items.map((item, index) => ({
            text: item.text,
            dueAt: item.dueAt,
            position: index,
          })),
        },
      },
    });
  } catch (error) {
    logServerError(error, {
      action: "createDueTodoListPost",
      userId: session.user.id,
    });
    return {
      success: false,
      message: getPublicErrorMessage(error, "期限付きTodoの作成に失敗しました。"),
    };
  }

  revalidatePath("/posts");
  revalidatePath("/todos");
  revalidatePath("/todos/calendar");
  redirect("/posts");
}
