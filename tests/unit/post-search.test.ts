import { describe, expect, it } from "vitest";
import { getMobileAccessiblePostsWhere } from "@/lib/post-permissions";
import {
  buildPostSearchWhere,
  resolvePostSearchQuery,
  withPostSearchWhere,
} from "@/lib/post-search";

describe("post search where builder", () => {
  it("normalizes search text", () => {
    expect(resolvePostSearchQuery("  alpha   beta  ")).toBe("alpha beta");
  });

  it("searches post titles", () => {
    expect(buildPostSearchWhere("alpha")).toMatchObject({
      OR: expect.arrayContaining([
        { title: { contains: "alpha", mode: "insensitive" } },
      ]),
    });
  });

  it("searches post bodies", () => {
    expect(buildPostSearchWhere("body")).toMatchObject({
      OR: expect.arrayContaining([
        { content: { contains: "body", mode: "insensitive" } },
      ]),
    });
  });

  it("searches tags", () => {
    expect(buildPostSearchWhere("tag")).toMatchObject({
      OR: expect.arrayContaining([
        { tags: { some: { name: { contains: "tag", mode: "insensitive" } } } },
      ]),
    });
  });

  it("searches Todo items", () => {
    expect(buildPostSearchWhere("todo")).toMatchObject({
      OR: expect.arrayContaining([
        {
          todoItems: {
            some: { text: { contains: "todo", mode: "insensitive" } },
          },
        },
      ]),
    });
  });

  it("keeps shared memos searchable for mobile users", () => {
    expect(withPostSearchWhere(getMobileAccessiblePostsWhere("user-1"), "shared")).toEqual({
      AND: [
        {
          OR: [
            { authorId: "user-1" },
            { shares: { some: { userId: "user-1" } } },
          ],
        },
        buildPostSearchWhere("shared"),
      ],
    });
  });

  it("does not search outside the accessible-post authorization scope", () => {
    const where = withPostSearchWhere(getMobileAccessiblePostsWhere("user-1"), "private");

    expect(where).toMatchObject({
      AND: [
        {
          OR: [
            { authorId: "user-1" },
            { shares: { some: { userId: "user-1" } } },
          ],
        },
        expect.objectContaining({ OR: expect.any(Array) }),
      ],
    });
  });
});
