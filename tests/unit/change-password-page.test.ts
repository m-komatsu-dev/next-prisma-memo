import { describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

function includesText(node: unknown, text: string): boolean {
  if (typeof node === "string") {
    return node.includes(text);
  }

  if (!node || typeof node !== "object") {
    return false;
  }

  if (Array.isArray(node)) {
    return node.some((child) => includesText(child, text));
  }

  const props = (node as { props?: { children?: unknown } }).props;

  return includesText(props?.children, text);
}

describe("ChangePasswordPage", () => {
  it("shows a clear message for OAuth-only users", async () => {
    const { default: ChangePasswordPage } = await import(
      "@/app/account/password/page"
    );

    authMock.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.user.findUnique.mockResolvedValue({
      email: "oauth@example.com",
      name: "OAuth User",
      password: null,
    });

    const page = await ChangePasswordPage();

    expect(includesText(page, "パスワード変更できません")).toBe(true);
  });
});
