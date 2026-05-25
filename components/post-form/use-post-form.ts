"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { generateAiContent } from "@/app/posts/[id]/edit/ai-actions";
import type { AiMode } from "@/lib/ai-modes";
import type { PostFormPayload, PostFormProps, SaveStatus } from "./types";

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

  const handleAutoSave = useCallback(async () => {
    if (mode === "new" && !hasDraftContent) return;
    if (currentSignature === lastSavedSignatureRef.current) return;
    if (mode === "edit" && currentSignature === initialSignature) return;

    setStatus("saving");
    const result = await autoSaveAction(payload);

    if (result.success) {
      if (typeof result.id === "number") setPostId(result.id);
      lastSavedSignatureRef.current = currentSignature;
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      setStatus("error");
    }
  }, [autoSaveAction, currentSignature, hasDraftContent, initialSignature, mode, payload]);

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
    startTransition(() => {
      saveAction({
        id: postId,
        title: String(formData.get("title") || ""),
        content: String(formData.get("content") || ""),
        tags: String(formData.get("tags") || ""),
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
    canChangePublished,
  };
}
