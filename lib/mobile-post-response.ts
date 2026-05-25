import type { PostShareRole } from "@/app/generated/prisma";
import { getPostAccessRole } from "@/lib/post-permissions";

type SerializableMobilePost = {
  authorId: string;
  content: string;
  createdAt: Date;
  id: number;
  published: boolean;
  shares?: { role: PostShareRole }[];
  tags: { id: number; name: string }[];
  title: string;
  updatedAt: Date;
};

export function serializeMobilePost(post: SerializableMobilePost, userId: string) {
  return {
    accessRole: getPostAccessRole(post, userId),
    authorId: post.authorId,
    id: post.id,
    title: post.title,
    content: post.content,
    // TodoはDBモデルではなく、既存どおりcontentからパースする設計です。
    published: post.published,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    tags: post.tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
    })),
  };
}
