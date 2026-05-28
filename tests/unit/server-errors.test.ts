import { Prisma } from "@/app/generated/prisma";
import { getAuthErrorMessage } from "@/lib/auth-user-messages";
import { isPrismaUniqueConstraintError } from "@/lib/server-errors";
import { describe, expect, it } from "vitest";

describe("server error helpers", () => {
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
});
