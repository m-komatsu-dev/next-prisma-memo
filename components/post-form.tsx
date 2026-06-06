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
    todoListDueAt,
    setTodoListDueAt,
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
  const isDueTodoPost = isTodoCreation || initialPost?.kind === "dueTodo";
  const shouldShowTodoItemsPanel = isDueTodoPost;

  return (
    <form action={handleSubmit} className="post-editor" noValidate>
      <PostEditorTopbar
        canChangePublished={isDueTodoPost ? false : (canChangePublished ?? true)}
        mode={mode}
        published={published}
        handlePublishedChange={handlePublishedChange}
        title={isDueTodoPost ? "期限付きTodoリスト" : undefined}
      />

      <section className="post-editor__sheet" aria-label="投稿エディタ">
        {isDueTodoPost ? (
          <>
            <input type="hidden" name="content" value={content} />
            <input type="hidden" name="kind" value="dueTodo" />
            <input type="hidden" name="todoListDueAt" value={todoListDueAt} />
            <label className="post-editor__field">
              <span>Todoリストのタイトル</span>
              <input
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="post-editor__title post-editor__title--compact"
                placeholder="Todoリストのタイトル"
                required
                minLength={1}
              />
            </label>
            <label className="post-editor__field post-editor__field--inline">
              <span>Todoリスト全体の期限</span>
              <input
                type="datetime-local"
                value={todoListDueAt}
                onChange={(event) => setTodoListDueAt(event.target.value)}
                required
              />
            </label>
            <label className="post-editor__field">
              <span>タグ</span>
              <input
                name="tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                className="post-editor__tags"
                placeholder="タグ: 仕事, 買い物, 期限"
              />
            </label>
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

        {!isDueTodoPost && (
          <PostEditorToolbar
            aiOpen={aiOpen}
            setAiOpen={setAiOpen}
            status={status}
            postId={postId}
          />
        )}

        {!isDueTodoPost && aiOpen && (
          <PostEditorAiPanel aiMode={aiMode} handleAiTask={handleAiTask} />
        )}

        {shouldShowTodoItemsPanel && (
          <TodoItemsPanel
            canEdit
            embedded
            forceDueTodo={isDueTodoPost}
            nowIso={initialPost?.todoNowIso ?? new Date().toISOString()}
            onEnsurePostId={ensureDraftPost}
            postId={postId}
            todoItems={initialPost?.todoItems ?? []}
          />
        )}

        {!isDueTodoPost && (
          <TodoListEditor
            name="content"
            value={content}
            onChange={setContent}
            placeholder="本文を書き始める"
          />
        )}

        {!isDueTodoPost && (
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
        canChangePublished={isDueTodoPost ? false : (canChangePublished ?? true)}
        isPending={isPending}
        published={published}
        submitLabel={isDueTodoPost ? "期限付きTodoを保存" : undefined}
      />
    </form>
  );
}
