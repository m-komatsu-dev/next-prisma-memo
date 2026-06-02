import { beforeEach, describe, expect, it, vi } from "vitest";

const sendDueTodoRemindersMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/todo-reminders", () => ({
  sendDueTodoReminders: sendDueTodoRemindersMock,
}));

describe("todo reminder cron route", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret";
    sendDueTodoRemindersMock.mockReset();
  });

  it("rejects requests without CRON_SECRET", async () => {
    const { GET } = await import("@/app/api/cron/send-todo-reminders/route");

    const response = await GET(
      new Request("http://localhost:3000/api/cron/send-todo-reminders"),
    );

    expect(response.status).toBe(401);
    expect(sendDueTodoRemindersMock).not.toHaveBeenCalled();
  });

  it("runs with a valid bearer token", async () => {
    const { GET } = await import("@/app/api/cron/send-todo-reminders/route");
    sendDueTodoRemindersMock.mockResolvedValue({
      candidateCount: 1,
      sentMessageCount: 1,
      sentTodoCount: 1,
    });

    const response = await GET(
      new Request("http://localhost:3000/api/cron/send-todo-reminders", {
        headers: { Authorization: "Bearer test-cron-secret" },
      }),
    );
    const data = (await response.json()) as { success?: boolean };

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(sendDueTodoRemindersMock).toHaveBeenCalledTimes(1);
  });
});
