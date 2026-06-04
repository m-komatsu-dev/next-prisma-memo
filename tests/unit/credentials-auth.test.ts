import { beforeEach, describe, expect, it, vi } from "vitest";

const bcryptCompareMock = vi.hoisted(() => vi.fn());
const logServerErrorMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/server-errors", () => ({
  logServerError: logServerErrorMock,
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: bcryptCompareMock,
  },
}));

describe("verifyCredentialsUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the safe user fields when the password hash matches", async () => {
    const { verifyCredentialsUser } = await import("@/lib/credentials-auth");

    prismaMock.user.findUnique.mockResolvedValue({
      email: "user@example.com",
      id: "user-1",
      image: null,
      name: "User",
      password: "hashed-password",
    });
    bcryptCompareMock.mockResolvedValue(true);

    const user = await verifyCredentialsUser({
      email: " USER@example.COM ",
      password: "password",
    });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
      select: {
        email: true,
        id: true,
        image: true,
        name: true,
        password: true,
      },
    });
    expect(bcryptCompareMock).toHaveBeenCalledWith("password", "hashed-password");
    expect(user).toEqual({
      email: "user@example.com",
      id: "user-1",
      image: null,
      name: "User",
    });
  });

  it("rejects OAuth-only users without a password hash", async () => {
    const { verifyCredentialsUser } = await import("@/lib/credentials-auth");

    prismaMock.user.findUnique.mockResolvedValue({
      email: "oauth@example.com",
      id: "user-1",
      image: null,
      name: "OAuth User",
      password: null,
    });

    await expect(
      verifyCredentialsUser({
        email: "oauth@example.com",
        password: "password",
      }),
    ).resolves.toBeNull();
    expect(bcryptCompareMock).not.toHaveBeenCalled();
  });

  it("rejects invalid passwords without exposing the reason to callers", async () => {
    const { verifyCredentialsUser } = await import("@/lib/credentials-auth");

    prismaMock.user.findUnique.mockResolvedValue({
      email: "user@example.com",
      id: "user-1",
      image: null,
      name: "User",
      password: "hashed-password",
    });
    bcryptCompareMock.mockResolvedValue(false);

    await expect(
      verifyCredentialsUser({
        email: "user@example.com",
        password: "wrong-password",
      }),
    ).resolves.toBeNull();
  });

  it("logs database errors and returns null", async () => {
    const { verifyCredentialsUser } = await import("@/lib/credentials-auth");
    const error = new Error("database unavailable");

    prismaMock.user.findUnique.mockRejectedValue(error);

    await expect(
      verifyCredentialsUser({
        email: "user@example.com",
        password: "password",
      }),
    ).resolves.toBeNull();
    expect(logServerErrorMock).toHaveBeenCalledWith(error, {
      action: "verifyCredentialsUser",
      details: { provider: "credentials" },
    });
  });
});
