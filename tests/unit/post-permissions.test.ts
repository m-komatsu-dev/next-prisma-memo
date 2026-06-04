import { describe, expect, it } from "vitest";
import {
  canDeletePost,
  canEditPost,
  canManagePostShares,
  canReadPost,
  getEditablePostWhere,
  getMobileReadablePostWhere,
  getPostAccessRole,
  type PostAccessRole,
} from "@/lib/post-permissions";

describe("post permissions", () => {
  it("resolves owner, editor, viewer, and public access roles", () => {
    expect(getPostAccessRole({ authorId: "user-1" }, "user-1")).toBe("owner");
    expect(
      getPostAccessRole(
        { authorId: "user-1", shares: [{ role: "editor" }] },
        "user-2",
      ),
    ).toBe("editor");
    expect(
      getPostAccessRole(
        { authorId: "user-1", shares: [{ role: "viewer" }] },
        "user-2",
      ),
    ).toBe("viewer");
    expect(getPostAccessRole({ authorId: "user-1", shares: [] }, "user-2")).toBe(
      "public",
    );
  });

  it.each([
    ["owner", true, true, true, true],
    ["editor", true, true, false, false],
    ["viewer", true, false, false, false],
  ] as const)(
    "%s has the expected permissions",
    (role, canRead, canEdit, canDelete, canManageShares) => {
      expect(canReadPost(role)).toBe(canRead);
      expect(canEditPost(role)).toBe(canEdit);
      expect(canDeletePost(role)).toBe(canDelete);
      expect(canManagePostShares(role)).toBe(canManageShares);
    },
  );

  it("allows public read access but denies privileged actions", () => {
    expect(canReadPost("public")).toBe(true);
    expect(canEditPost("public")).toBe(false);
    expect(canDeletePost("public")).toBe(false);
    expect(canManagePostShares("public")).toBe(false);
  });

  it("denies access when there is no role", () => {
    expect(canReadPost(null)).toBe(false);
    expect(canReadPost(undefined)).toBe(false);
  });

  it("builds editable post filters for owners and shared editors only", () => {
    expect(getEditablePostWhere(42, "user-1")).toEqual({
      id: 42,
      OR: [
        { authorId: "user-1" },
        { shares: { some: { userId: "user-1", role: "editor" } } },
      ],
    });
  });

  it("builds mobile readable filters without public-post access", () => {
    expect(getMobileReadablePostWhere(42, "user-1")).toEqual({
      id: 42,
      OR: [{ authorId: "user-1" }, { shares: { some: { userId: "user-1" } } }],
    });
  });

  it("matches the documented role matrix", () => {
    const matrix: Record<
      PostAccessRole,
      { delete: boolean; edit: boolean; manageShares: boolean; read: boolean }
    > = {
      editor: { read: true, edit: true, delete: false, manageShares: false },
      owner: { read: true, edit: true, delete: true, manageShares: true },
      public: { read: true, edit: false, delete: false, manageShares: false },
      viewer: { read: true, edit: false, delete: false, manageShares: false },
    };

    for (const [role, expected] of Object.entries(matrix) as [
      PostAccessRole,
      (typeof matrix)[PostAccessRole],
    ][]) {
      expect({
        delete: canDeletePost(role),
        edit: canEditPost(role),
        manageShares: canManagePostShares(role),
        read: canReadPost(role),
      }).toEqual(expected);
    }
  });
});
