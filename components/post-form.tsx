"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { generateAiContent, type AiMode } from "@/app/posts/[id]/edit/ai-actions";
import type { PostDraftPayloadInput, PostSavePayloadInput } from "@/lib/zod";//import type と書くことで、JavaScriptに変換された後はこの行が完全に消去され、軽量化されます。
import { TodoListEditor } from "./todo-list";

export type PostFormPayload = PostSavePayloadInput;

type SaveStatus = "idle" | "saving" | "saved" | "error";

type PostFormProps = {
  mode: "new" | "edit";
  initialPost?: {
    id: number;
    title: string;
    content: string;
    tags: string;
    published: boolean;
  };
  autoSaveAction: (data: PostDraftPayloadInput) => Promise<{ success: boolean; id?: number; message?: string }>;//PostDraftPayloadInputは、下書き保存のためのデータ構造を定義しています。これには、投稿のタイトル、内容、タグ、公開状態などが含まれますが、IDは必須ではありません（新規作成の場合はまだIDがないため）。
  saveAction: (data: PostSavePayloadInput) => Promise<void>;//PostSavePayloadInputは、サーバーに送信される最終的な保存用のデータ構造を定義しています。これには、投稿のID、タイトル、内容、タグ、公開状態などが含まれます。
};

export default function PostForm({ mode, initialPost, autoSaveAction, saveAction }: PostFormProps) {
  const [postId, setPostId] = useState<number | null>(initialPost?.id ?? null);
  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [content, setContent] = useState(initialPost?.content ?? "");
  const [tags, setTags] = useState(initialPost?.tags ?? "");
  const [published, setPublished] = useState(initialPost?.published ?? false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState<AiMode | null>(null);
  const [isPending, startTransition] = useTransition();
  const lastSavedSignatureRef = useRef(
    JSON.stringify({
      title: initialPost?.title ?? "",
      content: initialPost?.content ?? "",
      tags: initialPost?.tags ?? "",
      published: initialPost?.published ?? false,
    }),
  );

  //パフォーマンスを最適化しつつ「下書きの中身があるか」「前回保存した内容から変更があるか」を判定するためのデータを算出しています。
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
        // setContent((prev) => `${prev}\n\n要約\n${response.result}`);
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
    if (nextPublished && !published) {
      const confirmed = window.confirm("このメモを一般に公開してもよろしいですか？");
      if (!confirmed) return;
    }

    setPublished(nextPublished);
  };

  return (
    <form action={handleSubmit} className="post-editor" noValidate>
      <header className="post-editor__topbar">
        <div>
          <p className="post-editor__eyebrow">{mode === "new" ? "New memo" : "Edit memo"}</p>
          <h1>{mode === "new" ? "新規メモ作成" : "メモを編集"}</h1>
        </div>

        <label className="publish-toggle">
          <input
            type="checkbox"
            checked={published}
            onChange={(event) => handlePublishedChange(event.target.checked)}
          />
          <span className="publish-toggle__track" aria-hidden="true">
            <span className="publish-toggle__thumb" />
          </span>
          <span className="publish-toggle__text">{published ? "公開" : "非公開"}</span>
        </label>
      </header>

      <section className="post-editor__sheet" aria-label="投稿エディタ">
        <input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="post-editor__title"
          placeholder="タイトル"
          required
          minLength={1}
        />

        <div className="post-editor__toolbar">
          <button
            type="button"
            className="post-editor__ai-button"
            onClick={() => setAiOpen((current) => !current)}
            aria-expanded={aiOpen}
          >
            AI Assistant
          </button>

          <span className={`post-editor__status post-editor__status--${status}`}>
            {status === "saving" && "下書き保存中..."}
            {status === "saved" && "下書き保存済み"}
            {status === "error" && "保存に失敗しました"}
            {status === "idle" && (postId ? "自動保存オン" : "入力すると自動保存")}
          </span>
        </div>

        {aiOpen && (
          <div className="post-editor__ai-panel">
            {[
              ["title", "タイトル生成"],
              ["tags", "タグ生成"],
              ["summarize", "要約を追加"],
              ["rewrite", "リライト"],
            ].map(([taskMode, label]) => (
              <button
                key={taskMode}
                type="button"
                onClick={() => handleAiTask(taskMode as AiMode)}
                disabled={Boolean(aiMode)}
              >
                {aiMode === taskMode ? "処理中..." : label}
              </button>
            ))}
          </div>
        )}

        <TodoListEditor
          name="content"
          value={content}
          onChange={setContent}
          placeholder="本文を書き始める"
        />

        <input
          name="tags"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          className="post-editor__tags"
          placeholder="タグ: React, 勉強, アイデア"
        />
      </section>

      <footer className="post-editor__footer">
        <Link href="/posts" className="post-editor__secondary-action">
          キャンセル
        </Link>
        <button type="submit" className="post-editor__primary-action" disabled={isPending}>
          {isPending ? "保存中..." : published ? "公開して保存" : "非公開で保存"}
        </button>
      </footer>
    </form>
  );
}
