"use server";

import { auth } from "@/auth";
import { getEditablePostWhere } from "@/lib/post-permissions";
import { prisma } from "@/lib/prisma";
import { serializeTodoItem } from "@/lib/todo-item-response";
import {
  getFirstZodErrorMessage,
  createTodoItemSchema,
  deleteTodoItemSchema,
  toggleTodoItemSchema,
  updateTodoItemSchema,
} from "@/lib/zod";
import { revalidatePath } from "next/cache";

type TodoActionResult = {
  message?: string;
  success: boolean;
  todoItem?: ReturnType<typeof serializeTodoItem>;
  todoItemId?: number;
};

function readTodoFormData(formData: FormData) {
  return {
    completed: formData.get("completed"),
    dueAt: formData.get("dueAt"),
    id: formData.get("postId"),
    reminderAt: formData.get("reminderAt"),
    text: formData.get("text"),
    todoItemId: formData.get("todoItemId"),
  };
}

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("ログインが必要です。");
  }

  return session.user.id;
}

async function assertEditablePost(postId: number, userId: string) {
  const post = await prisma.post.findFirst({
    where: getEditablePostWhere(postId, userId),
    select: { id: true },
  });

  if (!post) {
    throw new Error("対象のメモが見つからないか、編集する権限がありません。");
  }

  return post;
}

function revalidateTodoPaths(postId: number) {
  revalidatePath("/posts");
  revalidatePath("/todos");
  revalidatePath(`/posts/${postId}`);
  revalidatePath(`/posts/${postId}/edit`);
}

export async function createTodoItem(
  _previousState: TodoActionResult,
  formData: FormData,
): Promise<TodoActionResult> {
  const userId = await requireUserId();
  const validatedFields = createTodoItemSchema.safeParse(readTodoFormData(formData));

  if (!validatedFields.success) {
    return {
      success: false,
      message: getFirstZodErrorMessage(validatedFields.error),
    };
  }

  const payload = validatedFields.data;

  try {
    const todoItem = await prisma.$transaction(async (tx) => {
      const post = await tx.post.findFirst({
        where: getEditablePostWhere(payload.id, userId),
        select: { id: true },
      });

      if (!post) {
        throw new Error("対象のメモが見つからないか、編集する権限がありません。");
      }

      const lastTodo = await tx.todoItem.findFirst({
        where: { postId: post.id },
        orderBy: { position: "desc" },
        select: { position: true },
      });

      return tx.todoItem.create({
        data: {
          postId: post.id,
          text: payload.text,
          dueAt: payload.dueAt,
          reminderAt: payload.reminderAt,
          position: (lastTodo?.position ?? -1) + 1,
        },
      });
    });

    revalidateTodoPaths(payload.id);
    return { success: true, todoItem: serializeTodoItem(todoItem) };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Todoを追加できませんでした。",
    };
  }
}

export async function updateTodoItem(
  _previousState: TodoActionResult,
  formData: FormData,
): Promise<TodoActionResult> {
  const userId = await requireUserId();
  const validatedFields = updateTodoItemSchema.safeParse(readTodoFormData(formData));

  if (!validatedFields.success) {
    return {
      success: false,
      message: getFirstZodErrorMessage(validatedFields.error),
    };
  }

  const payload = validatedFields.data;

  try {
    await assertEditablePost(payload.id, userId);

    const result = await prisma.todoItem.updateMany({
      where: {
        id: payload.todoItemId,
        postId: payload.id,
      },
      data: {
        text: payload.text,
        dueAt: payload.dueAt,
        ...(payload.reminderAt !== undefined
          ? { reminderAt: payload.reminderAt, reminderSentAt: null }
          : {}),
      },
    });

    if (result.count === 0) {
      throw new Error("対象のTodoが見つかりません。");
    }

    const todoItem = await prisma.todoItem.findFirstOrThrow({
      where: {
        id: payload.todoItemId,
        postId: payload.id,
      },
    });

    revalidateTodoPaths(payload.id);
    return { success: true, todoItem: serializeTodoItem(todoItem) };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Todoを更新できませんでした。",
    };
  }
}

export async function toggleTodoItem(formData: FormData): Promise<TodoActionResult> {
  const userId = await requireUserId();
  const validatedFields = toggleTodoItemSchema.safeParse(readTodoFormData(formData));

  if (!validatedFields.success) {
    return {
      success: false,
      message: getFirstZodErrorMessage(validatedFields.error),
    };
  }

  const payload = validatedFields.data;
  try {
    await assertEditablePost(payload.id, userId);

    const result = await prisma.todoItem.updateMany({
      where: {
        id: payload.todoItemId,
        postId: payload.id,
      },
      data: { completed: payload.completed === "true" },
    });

    if (result.count === 0) {
      throw new Error("対象のTodoが見つかりません。");
    }

    const todoItem = await prisma.todoItem.findFirstOrThrow({
      where: {
        id: payload.todoItemId,
        postId: payload.id,
      },
    });

    revalidateTodoPaths(payload.id);
    return { success: true, todoItem: serializeTodoItem(todoItem) };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Todoを更新できませんでした。",
    };
  }
}

export async function deleteTodoItem(formData: FormData): Promise<TodoActionResult> {
  const userId = await requireUserId();
  const validatedFields = deleteTodoItemSchema.safeParse(readTodoFormData(formData));

  if (!validatedFields.success) {
    return {
      success: false,
      message: getFirstZodErrorMessage(validatedFields.error),
    };
  }

  const payload = validatedFields.data;
  try {
    await assertEditablePost(payload.id, userId);

    const result = await prisma.todoItem.deleteMany({
      where: {
        id: payload.todoItemId,
        postId: payload.id,
      },
    });

    if (result.count === 0) {
      throw new Error("対象のTodoが見つかりません。");
    }

    revalidateTodoPaths(payload.id);
    return { success: true, todoItemId: payload.todoItemId };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Todoを削除できませんでした。",
    };
  }
}
