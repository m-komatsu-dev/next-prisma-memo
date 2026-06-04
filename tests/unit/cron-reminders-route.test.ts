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

  it("runs with a valid x-cron-secret header", async () => {
    const { GET } = await import("@/app/api/cron/send-todo-reminders/route");
    sendDueTodoRemindersMock.mockResolvedValue({
      candidateCount: 1,
      sentMessageCount: 1,
      sentTodoCount: 1,
    });

    const response = await GET(
      new Request("http://localhost:3000/api/cron/send-todo-reminders", {
        headers: { "x-cron-secret": "test-cron-secret" },
      }),
    );
    const data = (await response.json()) as { success?: boolean };

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(sendDueTodoRemindersMock).toHaveBeenCalledTimes(1);
  });

  it("rejects requests without a secret header", async () => {
    const { GET } = await import("@/app/api/cron/send-todo-reminders/route");

    const response = await GET(
      new Request("http://localhost:3000/api/cron/send-todo-reminders"),
    );

    expect(response.status).toBe(401);
    expect(sendDueTodoRemindersMock).not.toHaveBeenCalled();
  });

  it("rejects requests with an invalid secret header", async () => {
    const { GET } = await import("@/app/api/cron/send-todo-reminders/route");

    const response = await GET(
      new Request("http://localhost:3000/api/cron/send-todo-reminders", {
        headers: { Authorization: "Bearer wrong-secret" },
      }),
    );

    expect(response.status).toBe(401);
    expect(sendDueTodoRemindersMock).not.toHaveBeenCalled();
  });

  it("rejects requests that only provide the deprecated query secret", async () => {
    const { GET } = await import("@/app/api/cron/send-todo-reminders/route");

    const response = await GET(
      new Request(
        "http://localhost:3000/api/cron/send-todo-reminders?secret=test-cron-secret",
      ),
    );

    expect(response.status).toBe(401);
    expect(sendDueTodoRemindersMock).not.toHaveBeenCalled();
  });

  it("rejects requests safely when CRON_SECRET is not configured", async () => {
    const { GET } = await import("@/app/api/cron/send-todo-reminders/route");
    delete process.env.CRON_SECRET;

    const response = await GET(
      new Request("http://localhost:3000/api/cron/send-todo-reminders", {
        headers: { Authorization: "Bearer test-cron-secret" },
      }),
    );

    expect(response.status).toBe(401);
    expect(sendDueTodoRemindersMock).not.toHaveBeenCalled();
  });
});
