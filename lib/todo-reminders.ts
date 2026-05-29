import { prisma } from "@/lib/prisma";
import { sendExpoPushMessages, type ExpoPushMessage } from "@/lib/expo-push";

const MAX_REMINDERS_PER_RUN = 100;

function buildReminderBody(todoText: string, postTitle: string, dueAt: Date | null) {
  const dueText = dueAt
    ? new Intl.DateTimeFormat("ja-JP", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(dueAt)
    : null;

  return dueText
    ? `${todoText}\n期限: ${dueText} / ${postTitle}`
    : `${todoText}\n${postTitle}`;
}

export async function sendDueTodoReminders(now = new Date()) {
  const todoItems = await prisma.todoItem.findMany({
    orderBy: [{ reminderAt: "asc" }, { id: "asc" }],
    take: MAX_REMINDERS_PER_RUN,
    where: {
      completed: false,
      reminderAt: { lte: now },
      reminderSentAt: null,
    },
    select: {
      dueAt: true,
      id: true,
      postId: true,
      text: true,
      post: {
        select: {
          authorId: true,
          title: true,
          author: {
            select: {
              pushSubscriptions: {
                where: { revokedAt: null },
                select: {
                  expoPushToken: true,
                  id: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const messages: ExpoPushMessage[] = [];
  const todoIdsWithMessages = new Set<number>();

  for (const todoItem of todoItems) {
    for (const subscription of todoItem.post.author.pushSubscriptions) {
      messages.push({
        body: buildReminderBody(todoItem.text, todoItem.post.title, todoItem.dueAt),
        channelId: "todo-reminders",
        data: {
          postId: todoItem.postId,
          todoItemId: todoItem.id,
          type: "todo-reminder",
        },
        sound: "default",
        title: "Todoリマインダー",
        to: subscription.expoPushToken,
      });
      todoIdsWithMessages.add(todoItem.id);
    }
  }

  if (messages.length > 0) {
    await sendExpoPushMessages(messages);
    await prisma.todoItem.updateMany({
      data: { reminderSentAt: now },
      where: { id: { in: Array.from(todoIdsWithMessages) } },
    });
  }

  return {
    candidateCount: todoItems.length,
    sentTodoCount: todoIdsWithMessages.size,
    sentMessageCount: messages.length,
  };
}

export async function sendTestPushToUser(userId: string) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { revokedAt: null, userId },
    select: { expoPushToken: true },
  });

  if (subscriptions.length === 0) {
    return { sentMessageCount: 0 };
  }

  await sendExpoPushMessages(
    subscriptions.map((subscription) => ({
      body: "My Memo Appからのテスト通知です。",
      channelId: "todo-reminders",
      data: { type: "test-notification" },
      sound: "default",
      title: "通知テスト",
      to: subscription.expoPushToken,
    })),
  );

  return { sentMessageCount: subscriptions.length };
}
