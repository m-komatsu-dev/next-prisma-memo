import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const bcryptCompareMock = vi.hoisted(() => vi.fn());
const bcryptHashMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  apiSession: {
    updateMany: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/server-errors", () => ({
  logServerError: vi.fn(),
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: bcryptCompareMock,
    hash: bcryptHashMock,
  },
}));

function createFormData(values: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return formData;
}

const validFormData = {
  confirmPassword: "new-password",
  currentPassword: "current-password",
  newPassword: "new-password",
};

describe("changePasswordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.$transaction.mockResolvedValue([]);
    prismaMock.user.update.mockReturnValue(Promise.resolve({}));
    prismaMock.apiSession.updateMany.mockReturnValue(Promise.resolve({ count: 2 }));
  });

  it("rejects mismatched confirmation passwords", async () => {
    const { changePasswordAction } = await import(
      "@/app/account/password/actions"
    );

    const result = await changePasswordAction(
      { error: "", success: "" },
      createFormData({
        ...validFormData,
        confirmPassword: "different-password",
      }),
    );

    expect(result.error).toBe("入力内容を確認してください。");
    expect(result.fieldErrors?.confirmPassword).toBe(
      "新しいパスワードと確認用パスワードが一致しません。",
    );
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a wrong current password", async () => {
    const { changePasswordAction } = await import(
      "@/app/account/password/actions"
    );

    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      password: "hashed-current-password",
    });
    bcryptCompareMock.mockResolvedValue(false);

    const result = await changePasswordAction(
      { error: "", success: "" },
      createFormData(validFormData),
    );

    expect(bcryptCompareMock).toHaveBeenCalledWith(
      "current-password",
      "hashed-current-password",
    );
    expect(result.error).toBe("現在のパスワードが違います。");
    expect(result.fieldErrors?.currentPassword).toBe(
      "現在のパスワードが違います。",
    );
    expect(bcryptHashMock).not.toHaveBeenCalled();
  });

  it("rejects users without a password hash", async () => {
    const { changePasswordAction } = await import(
      "@/app/account/password/actions"
    );

    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      password: null,
    });

    const result = await changePasswordAction(
      { error: "", success: "" },
      createFormData(validFormData),
    );

    expect(result.error).toBe("パスワード変更できません。");
    expect(bcryptCompareMock).not.toHaveBeenCalled();
  });

  it("updates the password and revokes active ApiSessions", async () => {
    const { changePasswordAction } = await import(
      "@/app/account/password/actions"
    );

    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      password: "hashed-current-password",
    });
    bcryptCompareMock.mockResolvedValue(true);
    bcryptHashMock.mockResolvedValue("hashed-new-password");

    const result = await changePasswordAction(
      { error: "", success: "" },
      createFormData(validFormData),
    );
    const updateManyCall = prismaMock.apiSession.updateMany.mock.calls[0]?.[0];

    expect(result).toEqual({
      error: "",
      success: "パスワードを変更しました",
    });
    expect(bcryptHashMock).toHaveBeenCalledWith("new-password", 10);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { password: "hashed-new-password" },
    });
    expect(updateManyCall.where).toEqual({
      revokedAt: null,
      userId: "user-1",
    });
    expect(updateManyCall.data.revokedAt).toBeInstanceOf(Date);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });
});
