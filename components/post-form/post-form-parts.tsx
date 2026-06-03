"use client";

import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import type { AiMode } from "@/lib/ai-modes";
import type { SaveStatus } from "./types";

type PostEditorTopbarProps = {
  canChangePublished: boolean;
  mode: "new" | "edit";
  published: boolean;
  handlePublishedChange: (nextPublished: boolean) => void;
  title?: string;
};

type PostEditorToolbarProps = {
  aiOpen: boolean;
  setAiOpen: Dispatch<SetStateAction<boolean>>;
  status: SaveStatus;
  postId: number | null;
};

type PostEditorAiPanelProps = {
  aiMode: AiMode | null;
  handleAiTask: (taskMode: AiMode) => Promise<void>;
};

type PostEditorFooterProps = {
  canChangePublished: boolean;
  isPending: boolean;
  published: boolean;
  submitLabel?: string;
};

const aiTasks: [AiMode, string][] = [
  ["title", "タイトル生成"],
  ["tags", "タグ生成"],
  ["summarize", "要約を追加"],
  ["rewrite", "リライト"],
];

export function PostEditorTopbar({
  canChangePublished,
  mode,
  published,
  handlePublishedChange,
  title,
}: PostEditorTopbarProps) {
  return (
    <header className="post-editor__topbar">
      <div>
        <p className="post-editor__eyebrow">{mode === "new" ? "New memo" : "Edit memo"}</p>
        <h1>{title ?? (mode === "new" ? "新規メモ作成" : "メモを編集")}</h1>
      </div>

      {canChangePublished ? (
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
      ) : (
        <span className="publish-toggle publish-toggle--readonly">
          <span className={published ? "memo-badge memo-badge--public" : "memo-badge"}>
            {published ? "公開" : "非公開"}
          </span>
        </span>
      )}
    </header>
  );
}

export function PostEditorToolbar({
  aiOpen,
  setAiOpen,
  status,
  postId,
}: PostEditorToolbarProps) {
  return (
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
  );
}

export function PostEditorAiPanel({ aiMode, handleAiTask }: PostEditorAiPanelProps) {
  return (
    <div className="post-editor__ai-panel">
      {aiTasks.map(([taskMode, label]) => (
        <button
          key={taskMode}
          type="button"
          onClick={() => handleAiTask(taskMode)}
          disabled={Boolean(aiMode)}
        >
          {aiMode === taskMode ? "処理中..." : label}
        </button>
      ))}
    </div>
  );
}

export function PostEditorFooter({
  canChangePublished,
  isPending,
  published,
  submitLabel,
}: PostEditorFooterProps) {
  return (
    <footer className="post-editor__footer">
      <Link href="/posts" className="post-editor__secondary-action">
        キャンセル
      </Link>
      <button type="submit" className="post-editor__primary-action" disabled={isPending}>
        {isPending
          ? "保存中..."
          : submitLabel
            ? submitLabel
          : canChangePublished
            ? published
              ? "公開して保存"
              : "非公開で保存"
            : "変更を保存"}
      </button>
    </footer>
  );
}
