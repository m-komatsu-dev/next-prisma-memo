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
  creationKind = "text",
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
  } = usePostForm({
    mode,
    canChangePublished,
    creationKind,
    initialPost,
    autoSaveAction,
    saveAction,
  });
  const isTodoCreation = mode === "new" && creationKind === "todo";

  return (
    <form action={handleSubmit} className="post-editor" noValidate>
      <PostEditorTopbar
        canChangePublished={isTodoCreation ? false : (canChangePublished ?? true)}
        mode={mode}
        published={published}
        handlePublishedChange={handlePublishedChange}
        title={isTodoCreation ? "期限付きTodo作成" : undefined}
      />

      <section className="post-editor__sheet" aria-label="投稿エディタ">
        {isTodoCreation ? (
          <>
            <input type="hidden" name="title" value={title} />
            <input type="hidden" name="content" value={content} />
            <input type="hidden" name="tags" value={tags} />
          </>
        ) : (
          <input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="post-editor__title"
            placeholder="タイトル"
            required
            minLength={1}
          />
        )}

        {!isTodoCreation && (
          <PostEditorToolbar
            aiOpen={aiOpen}
            setAiOpen={setAiOpen}
            status={status}
            postId={postId}
          />
        )}

        {!isTodoCreation && aiOpen && (
          <PostEditorAiPanel aiMode={aiMode} handleAiTask={handleAiTask} />
        )}

        <TodoItemsPanel
          canEdit
          embedded
          forceDueTodo={isTodoCreation}
          nowIso={initialPost?.todoNowIso ?? new Date().toISOString()}
          onEnsurePostId={ensureDraftPost}
          postId={postId}
          todoItems={initialPost?.todoItems ?? []}
        />

        {!isTodoCreation && (
          <TodoListEditor
            name="content"
            value={content}
            onChange={setContent}
            placeholder="本文を書き始める"
          />
        )}

        {!isTodoCreation && (
          <input
            name="tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            className="post-editor__tags"
            placeholder="タグ: React, 勉強, アイデア"
          />
        )}
      </section>

      <PostEditorFooter
        canChangePublished={isTodoCreation ? false : (canChangePublished ?? true)}
        isPending={isPending}
        published={published}
        submitLabel={isTodoCreation ? "Todo作成を完了" : undefined}
      />
    </form>
  );
}
