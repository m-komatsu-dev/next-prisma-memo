"use client";

import {
  PostEditorAiPanel,
  PostEditorFooter,
  PostEditorToolbar,
  PostEditorTopbar,
} from "./post-form/post-form-parts";
import type { PostFormProps } from "./post-form/types";
import { usePostForm } from "./post-form/use-post-form";
import TodoItemsPanel from "./todo-items";
import { TodoListEditor } from "./todo-list";

export type { PostFormPayload } from "./post-form/types";

export default function PostForm({
  mode,
  canChangePublished,
  initialPost,
  autoSaveAction,
  saveAction,
}: PostFormProps) {
  const {
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
  } = usePostForm({ mode, canChangePublished, initialPost, autoSaveAction, saveAction });

  return (
    <form action={handleSubmit} className="post-editor" noValidate>
      <PostEditorTopbar
        canChangePublished={canChangePublished ?? true}
        mode={mode}
        published={published}
        handlePublishedChange={handlePublishedChange}
      />

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

        <PostEditorToolbar
          aiOpen={aiOpen}
          setAiOpen={setAiOpen}
          status={status}
          postId={postId}
        />

        {aiOpen && <PostEditorAiPanel aiMode={aiMode} handleAiTask={handleAiTask} />}

        <TodoItemsPanel
          canEdit
          embedded
          nowIso={initialPost?.todoNowIso ?? new Date().toISOString()}
          onEnsurePostId={ensureDraftPost}
          postId={postId}
          todoItems={initialPost?.todoItems ?? []}
        />

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

      <PostEditorFooter
        canChangePublished={canChangePublished ?? true}
        isPending={isPending}
        published={published}
      />
    </form>
  );
}
