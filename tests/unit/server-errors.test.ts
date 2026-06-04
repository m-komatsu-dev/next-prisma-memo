import { Prisma } from "@/app/generated/prisma";
import { getAuthErrorMessage } from "@/lib/auth-user-messages";
import { isPrismaUniqueConstraintError, logServerError } from "@/lib/server-errors";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("server error helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects Prisma P2002 unique constraint errors", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`email`)",
      {
        clientVersion: "test",
        code: "P2002",
        meta: { target: ["email"] },
      },
    );

    expect(isPrismaUniqueConstraintError(error)).toBe(true);
  });

  it("does not treat other Prisma errors as unique constraint errors", () => {
    const error = new Prisma.PrismaClientKnownRequestError("Not found", {
      clientVersion: "test",
      code: "P2025",
    });

    expect(isPrismaUniqueConstraintError(error)).toBe(false);
  });

  it("maps OAuthAccountNotLinked to a user-facing message", () => {
    expect(getAuthErrorMessage("OAuthAccountNotLinked")).toContain(
      "別のログイン方法",
    );
  });

  it("redacts secrets, tokens, and database URLs from server logs", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    logServerError(
      new Error(
        "Failed with Bearer very-secret-token and postgresql://user:pass@example.com:5432/db",
      ),
      {
        action: "testLogRedaction",
        details: {
          authorization: "Bearer another-secret-token",
          databaseUrl: "postgresql://user:pass@example.com:5432/db",
          safe: "visible",
        },
      },
    );

    const logged = consoleErrorSpy.mock.calls[0]?.[0] as string;

    expect(logged).toContain("visible");
    expect(logged).toContain("[redacted]");
    expect(logged).not.toContain("very-secret-token");
    expect(logged).not.toContain("another-secret-token");
    expect(logged).not.toContain("user:pass@example.com");
  });
});
