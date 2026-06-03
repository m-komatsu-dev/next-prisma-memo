"use client";

import PostForm from "@/components/post-form";
import { useState } from "react";
import { autoSaveNewPost, saveNewPost } from "./actions";

export default function NewPostForm() {
  const [creationKind, setCreationKind] = useState<"text" | "todo" | null>(null);

  if (!creationKind) {
    return (
      <div className="new-post-choice" aria-labelledby="new-post-choice-title">
        <div>
          <p className="post-editor__eyebrow">New</p>
          <h1 id="new-post-choice-title">新規作成</h1>
        </div>
        <div className="new-post-choice__grid">
          <button
            type="button"
            className="new-post-choice__card"
            onClick={() => setCreationKind("text")}
          >
            <span>テキスト</span>
            <strong>メモ帳として作成</strong>
            <small>タイトル、本文、タグ、公開設定、AI Assistantを使えます。</small>
          </button>
          <button
            type="button"
            className="new-post-choice__card"
            onClick={() => setCreationKind("todo")}
          >
            <span>Todo</span>
            <strong>期限付きTodoを作成</strong>
            <small>Todo本文、期限日時、リマインダーだけを入力します。</small>
          </button>
        </div>
      </div>
    );
  }

  return (
    <PostForm
      mode="new"
      creationKind={creationKind}
      autoSaveAction={autoSaveNewPost}
      saveAction={saveNewPost}
    />
  );
}
