export type SerializableTodoItem = {
  completed: boolean;
  createdAt: Date;
  dueAt: Date | null;
  id: number;
  position: number;
  postId: number;
  reminderAt: Date | null;
  reminderSentAt: Date | null;
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
    reminderAt: todoItem.reminderAt?.toISOString() ?? null,
    reminderSentAt: todoItem.reminderSentAt?.toISOString() ?? null,
    text: todoItem.text,
    updatedAt: todoItem.updatedAt.toISOString(),
  };
}
