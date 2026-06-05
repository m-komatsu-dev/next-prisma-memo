import { beforeEach, describe, expect, it, vi } from "vitest";

const mobileAuthUserMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  post: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/mobile-auth", () => ({
  getMobileAuthUser: mobileAuthUserMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("mobile post search API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mobileAuthUserMock.mockResolvedValue({ id: "user-1" });
    prismaMock.post.findMany.mockResolvedValue([]);
  });

  it("rejects unauthenticated list requests", async () => {
    const { GET } = await import("@/app/api/mobile/posts/route");
    mobileAuthUserMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost:3000/api/mobile/posts?q=alpha"));

    expect(response.status).toBe(401);
    expect(prismaMock.post.findMany).not.toHaveBeenCalled();
  });

  it("combines search with owner-or-shared authorization", async () => {
    const { GET } = await import("@/app/api/mobile/posts/route");

    await GET(new Request("http://localhost:3000/api/mobile/posts?q=alpha&limit=12"));

    expect(prismaMock.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 12,
        where: {
          AND: [
            {
              OR: [
                { authorId: "user-1" },
                { shares: { some: { userId: "user-1" } } },
              ],
            },
            {
              OR: [
                { title: { contains: "alpha", mode: "insensitive" } },
                { content: { contains: "alpha", mode: "insensitive" } },
                {
                  tags: {
                    some: {
                      name: { contains: "alpha", mode: "insensitive" },
                    },
                  },
                },
                {
                  todoItems: {
                    some: {
                      text: { contains: "alpha", mode: "insensitive" },
                    },
                  },
                },
              ],
            },
          ],
        },
      }),
    );
  });
});
