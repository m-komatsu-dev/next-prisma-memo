import { beforeEach, describe, expect, it, vi } from "vitest";

const sendExpoPushMessagesMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  todoItem: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  pushSubscription: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/expo-push", () => ({
  sendExpoPushMessages: sendExpoPushMessagesMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("todo reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendExpoPushMessagesMock.mockResolvedValue({ failedTokenTails: [] });
    prismaMock.todoItem.updateMany.mockResolvedValue({ count: 1 });
  });

  it("sends due reminders and marks the todo as sent", async () => {
    const { sendDueTodoReminders } = await import("@/lib/todo-reminders");
    const now = new Date("2026-06-05T00:00:00.000Z");

    prismaMock.todoItem.findMany.mockResolvedValue([
      {
        dueAt: new Date("2026-06-05T01:00:00.000Z"),
        id: 10,
        postId: 20,
        text: "資料を送る",
        post: {
          title: "仕事メモ",
          author: {
            pushSubscriptions: [
              { expoPushToken: "ExponentPushToken[test-token]", id: "push-1" },
            ],
          },
        },
      },
    ]);

    const result = await sendDueTodoReminders(now);
    const findCall = prismaMock.todoItem.findMany.mock.calls[0]?.[0];
    const updateCall = prismaMock.todoItem.updateMany.mock.calls[0]?.[0];

    expect(result).toEqual({
      candidateCount: 1,
      sentMessageCount: 1,
      sentTodoCount: 1,
    });
    expect(findCall.where).toEqual({
      completed: false,
      reminderAt: { lte: now },
      reminderSentAt: null,
    });
    expect(
      findCall.select.post.select.author.select.pushSubscriptions.where,
    ).toEqual({ revokedAt: null });
    expect(sendExpoPushMessagesMock).toHaveBeenCalledWith([
      expect.objectContaining({
        data: {
          postId: 20,
          todoItemId: 10,
          type: "todo-reminder",
        },
        to: "ExponentPushToken[test-token]",
      }),
    ]);
    expect(updateCall).toEqual({
      data: { reminderSentAt: now },
      where: { id: { in: [10] } },
    });
  });

  it("sends reminders only to active push subscriptions returned by the revokedAt null query", async () => {
    const { sendDueTodoReminders } = await import("@/lib/todo-reminders");

    prismaMock.todoItem.findMany.mockResolvedValue([
      {
        dueAt: null,
        id: 11,
        postId: 21,
        text: "確認する",
        post: {
          title: "予定",
          author: {
            pushSubscriptions: [
              { expoPushToken: "ExponentPushToken[active-token]", id: "push-active" },
            ],
          },
        },
      },
    ]);

    const result = await sendDueTodoReminders(
      new Date("2026-06-05T00:00:00.000Z"),
    );

    expect(result.sentMessageCount).toBe(1);
    expect(sendExpoPushMessagesMock).toHaveBeenCalledWith([
      expect.objectContaining({
        to: "ExponentPushToken[active-token]",
      }),
    ]);
  });

  it("does not send or mark reminders when already-sent todos are excluded", async () => {
    const { sendDueTodoReminders } = await import("@/lib/todo-reminders");

    prismaMock.todoItem.findMany.mockResolvedValue([]);

    const result = await sendDueTodoReminders(
      new Date("2026-06-05T00:00:00.000Z"),
    );

    expect(result.sentMessageCount).toBe(0);
    expect(sendExpoPushMessagesMock).not.toHaveBeenCalled();
    expect(prismaMock.todoItem.updateMany).not.toHaveBeenCalled();
  });
});
