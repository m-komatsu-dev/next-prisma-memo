export type SerializableTodoItem = {
  completed: boolean;
  createdAt: Date;
  dueAt: Date | null;
  id: number;
  position: number;
  postId: number;
  text: string;
  updatedAt: Date;
};

export function serializeTodoItem(todoItem: SerializableTodoItem) {
  return {
    completed: todoItem.completed,
    createdAt: todoItem.createdAt.toISOString(),
    dueAt: todoItem.dueAt?.toISOString() ?? null,
    id: todoItem.id,
    position: todoItem.position,
    postId: todoItem.postId,
    text: todoItem.text,
    updatedAt: todoItem.updatedAt.toISOString(),
  };
}
