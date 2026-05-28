import type { PostShareRole } from "@/app/generated/prisma";
import { getPostAccessRole } from "@/lib/post-permissions";
import { serializeTodoItem, type SerializableTodoItem } from "@/lib/todo-item-response";

type SerializableMobilePost = {
  authorId: string;
  content: string;
  createdAt: Date;
  id: number;
  published: boolean;
  shares?: { role: PostShareRole }[];
  tags: { id: number; name: string }[];
  title: string;
  todoItems?: SerializableTodoItem[];
  updatedAt: Date;
};

export function serializeMobilePost(post: SerializableMobilePost, userId: string) {
  return {
    accessRole: getPostAccessRole(post, userId),
    authorId: post.authorId,
    id: post.id,
    title: post.title,
    content: post.content,
    todoItems: post.todoItems?.map(serializeTodoItem) ?? [],
    published: post.published,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    tags: post.tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
    })),
  };
}
