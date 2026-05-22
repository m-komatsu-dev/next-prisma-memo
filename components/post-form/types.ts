import type { PostDraftPayloadInput, PostSavePayloadInput } from "@/lib/zod";

export type PostFormPayload = PostSavePayloadInput;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type PostFormProps = {
  mode: "new" | "edit";
  initialPost?: {
    id: number;
    title: string;
    content: string;
    tags: string;
    published: boolean;
  };
  autoSaveAction: (data: PostDraftPayloadInput) => Promise<{
    success: boolean;
    id?: number;
    message?: string;
  }>;
  saveAction: (data: PostSavePayloadInput) => Promise<void>;
};
