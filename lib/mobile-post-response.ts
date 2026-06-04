import type { PostShareRole } from "@/app/generated/prisma";
import { getPostAccessRole } from "@/lib/post-permissions";
import { serializeTodoItem, type SerializableTodoItem } from "@/lib/todo-item-response";

type SerializableMobilePost = {
  _count?: { todoItems: number };
  authorId: string;
  content: string;
  createdAt: Date;
  id: number;
  kind: string;
  published: boolean;
  shares?: { role: PostShareRole }[];
  tags: { id: number; name: string }[];
  title: string;
  todoListDueAt: Date | null;
  todoItems?: SerializableTodoItem[];
  updatedAt: Date;
};

export function serializeMobilePost(post: SerializableMobilePost, userId: string) {
  return {
    accessRole: getPostAccessRole(post, userId),
    authorId: post.authorId,
    id: post.id,
    kind: post.kind,
    title: post.title,
    todoListDueAt: post.todoListDueAt?.toISOString() ?? null,
    content: post.content,
    todoItems: post.todoItems?.map(serializeTodoItem) ?? [],
    todoItemsCount: post._count?.todoItems ?? post.todoItems?.length ?? 0,
    published: post.published,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    tags: post.tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
    })),
  };
}
