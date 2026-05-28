"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { generateAiContent } from "@/app/posts/[id]/edit/ai-actions";
import type { AiMode } from "@/lib/ai-modes";
import type { PostFormPayload, PostFormProps, SaveStatus } from "./types";

type AutoSaveResult = {
  success: boolean;
  id?: number;
  message?: string;
};

export function usePostForm({
  mode,
  canChangePublished = true,
  initialPost,
  autoSaveAction,
  saveAction,
}: PostFormProps) {
  const [postId, setPostId] = useState<number | null>(initialPost?.id ?? null);
  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [content, setContent] = useState(initialPost?.content ?? "");
  const [tags, setTags] = useState(initialPost?.tags ?? "");
  const [published, setPublished] = useState(initialPost?.published ?? false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState<AiMode | null>(null);
  const [isPending, startTransition] = useTransition();
  const draftCreatePromiseRef = useRef<Promise<AutoSaveResult> | null>(null);
  // Autosave compares the same fields as the persisted draft payload to skip no-op writes.
  const lastSavedSignatureRef = useRef(
    JSON.stringify({
      title: initialPost?.title ?? "",
      content: initialPost?.content ?? "",
      tags: initialPost?.tags ?? "",
      published: initialPost?.published ?? false,
    }),
  );

  const hasDraftContent = useMemo(
    () => Boolean(title.trim() || content.trim() || tags.trim()),
    [content, tags, title],
  );

  const payload = useMemo<PostFormPayload>(
    () => ({
      id: postId,
      title,
      content,
      tags,
      published,
    }),
    [content, postId, published, tags, title],
  );

  const initialSignature = useMemo(() => {
    if (!initialPost) return "";
    return JSON.stringify({
      title: initialPost.title,
      content: initialPost.content,
      tags: initialPost.tags,
      published: initialPost.published,
    });
  }, [initialPost]);

  const currentSignature = useMemo(
    () => JSON.stringify({ title, content, tags, published }),
    [content, published, tags, title],
  );

  const runAutoSaveAction = useCallback(
    (data: PostFormPayload) => {
      if (mode !== "new" || data.id) {
        return autoSaveAction(data);
      }

      if (!draftCreatePromiseRef.current) {
        draftCreatePromiseRef.current = autoSaveAction(data).finally(() => {
          draftCreatePromiseRef.current = null;
        });
      }

      return draftCreatePromiseRef.current;
    },
    [autoSaveAction, mode],
  );

  const handleAutoSave = useCallback(async () => {
    if (mode === "new" && !hasDraftContent) return;
    if (currentSignature === lastSavedSignatureRef.current) return;
    if (mode === "edit" && currentSignature === initialSignature) return;

    setStatus("saving");
    const result = await runAutoSaveAction(payload);

    if (result.success) {
      if (typeof result.id === "number") setPostId(result.id);
      lastSavedSignatureRef.current = currentSignature;
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      setStatus("error");
    }
  }, [currentSignature, hasDraftContent, initialSignature, mode, payload, runAutoSaveAction]);

  const ensureDraftPost = useCallback(async () => {
    if (postId) return postId;

    setStatus("saving");
    const result = await runAutoSaveAction(payload);

    if (result.success && typeof result.id === "number") {
      setPostId(result.id);
      lastSavedSignatureRef.current = currentSignature;
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
      return result.id;
    }

    setStatus("error");
    throw new Error(result.message ?? "下書きメモの作成に失敗しました。");
  }, [currentSignature, payload, postId, runAutoSaveAction]);

  useEffect(() => {
    const timer = setTimeout(handleAutoSave, 1800);
    return () => clearTimeout(timer);
  }, [handleAutoSave]);

  const handleAiTask = async (taskMode: AiMode) => {
    setAiMode(taskMode);
    const response = await generateAiContent(content, taskMode);
    setAiMode(null);

    if (response.success) {
      if (taskMode === "title") setTitle(response.result);
      if (taskMode === "tags") setTags(response.result);
      if (taskMode === "summarize") {
        setContent((prev) => `${prev.trimEnd()}\n\n\n--- AIによる要約 ---\n${response.result}`);
      }
      if (taskMode === "rewrite") {
        setContent((prev) => `${prev.trimEnd()}\n\n\n--- AIによるリライト ---\n${response.result}`);
      }
      return;
    }

    setStatus("error");
    window.alert(response.result);
  };

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      let savePostId = postId;
      const nextPayload = {
        id: postId,
        title: String(formData.get("title") || ""),
        content: String(formData.get("content") || ""),
        tags: String(formData.get("tags") || ""),
        published,
      };

      if (mode === "new" && !savePostId) {
        const draftResult = await runAutoSaveAction(nextPayload);
        if (draftResult.success && typeof draftResult.id === "number") {
          savePostId = draftResult.id;
          setPostId(draftResult.id);
        }
      }

      saveAction({
        ...nextPayload,
        id: savePostId,
        published,
      });
    });
  };

  const handlePublishedChange = (nextPublished: boolean) => {
    if (!canChangePublished) return;

    // Confirmation is only needed when moving from private to public.
    if (nextPublished && !published) {
      const confirmed = window.confirm("このメモを一般に公開してもよろしいですか？");
      if (!confirmed) return;
    }

    setPublished(nextPublished);
  };

  return {
    postId,
    title,
    setTitle,
    content,
    setContent,
    tags,
    setTags,
    published,
    status,
    aiOpen,
    setAiOpen,
    aiMode,
    isPending,
    handleAiTask,
    handleSubmit,
    handlePublishedChange,
    ensureDraftPost,
    canChangePublished,
  };
}
