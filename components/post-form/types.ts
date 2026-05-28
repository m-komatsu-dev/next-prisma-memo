import type { PostDraftPayloadInput, PostSavePayloadInput } from "@/lib/zod";

export type PostFormPayload = PostSavePayloadInput;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type PostFormTodoItem = {
  completed: boolean;
  dueAt: string | null;
  id: number;
  position: number;
  text: string;
};

export type PostFormProps = {
  mode: "new" | "edit";
  canChangePublished?: boolean;
  initialPost?: {
    id: number;
    title: string;
    content: string;
    tags: string;
    published: boolean;
    todoNowIso: string;
    todoItems?: PostFormTodoItem[];
  };
  autoSaveAction: (data: PostDraftPayloadInput) => Promise<{
    success: boolean;
    id?: number;
    message?: string;
  }>;
  saveAction: (data: PostSavePayloadInput) => Promise<void>;
};
