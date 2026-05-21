import type { Prisma } from "@/app/generated/prisma";

export function buildTagsConnectOrCreate(
  tagNames: string[],
): Prisma.TagCreateOrConnectWithoutPostsInput[] {
  return tagNames.map((name) => ({// 既存のタグがあれば接続し、なければ新規作成するためのオブジェクトを返します。
    where: { name },
    create: { name },
  }));
}
