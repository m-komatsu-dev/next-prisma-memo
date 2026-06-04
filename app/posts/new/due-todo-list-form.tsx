"use client";

import { useMemo, useState, useTransition } from "react";
import { createDueTodoListPost } from "./actions";

type TodoDraftItem = {
  dueAt: string;
  id: string;
  text: string;
};

function createDraftItem(): TodoDraftItem {
  return {
    dueAt: "",
    id: crypto.randomUUID(),
    text: "",
  };
}

export default function DueTodoListForm() {
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [todoListDueAt, setTodoListDueAt] = useState("");
  const [items, setItems] = useState<TodoDraftItem[]>([createDraftItem()]);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const canSubmit = useMemo(
    () =>
      Boolean(
        title.trim() &&
          todoListDueAt &&
          items.some((item) => item.text.trim()) &&
          items.every((item) => !item.text.trim() || item.dueAt),
      ),
    [items, title, todoListDueAt],
  );

  function updateItem(id: string, patch: Partial<TodoDraftItem>) {
    setItems((currentItems) =>
      currentItems.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function removeItem(id: string) {
    setItems((currentItems) =>
      currentItems.length === 1
        ? [createDraftItem()]
        : currentItems.filter((item) => item.id !== id),
    );
  }

  function handleSubmit() {
    const normalizedItems = items
      .map((item) => ({
        text: item.text.trim(),
        dueAt: item.dueAt,
      }))
      .filter((item) => item.text.length > 0);

    if (!title.trim()) {
      setError("Todoリストのタイトルを入力してください。");
      return;
    }

    if (!todoListDueAt) {
      setError("Todoリスト全体の期限を選択してください。");
      return;
    }

    if (normalizedItems.length === 0) {
      setError("Todo項目を1件以上入力してください。");
      return;
    }

    if (normalizedItems.some((item) => !item.dueAt)) {
      setError("各Todo項目の期限を選択してください。");
      return;
    }

    setError("");
    startTransition(async () => {
      const result = await createDueTodoListPost({
        title,
        tags,
        todoListDueAt,
        items: normalizedItems,
      });

      if (result && !result.success) {
        setError(result.message ?? "期限付きTodoの作成に失敗しました。");
      }
    });
  }

  return (
    <section className="due-todo-form" aria-labelledby="due-todo-form-title">
      <header className="post-editor__topbar">
        <div>
          <p className="post-editor__eyebrow">Due Todo</p>
          <h1 id="due-todo-form-title">期限付きTodo作成</h1>
        </div>
      </header>

      <div className="post-editor__sheet due-todo-form__sheet">
        <label className="post-editor__field">
          <span>Todoリストのタイトル</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Todoリストのタイトル"
            maxLength={120}
          />
        </label>

        <label className="post-editor__field">
          <span>Todoリスト全体の期限</span>
          <input
            type="datetime-local"
            value={todoListDueAt}
            onChange={(event) => setTodoListDueAt(event.target.value)}
          />
        </label>

        <label className="post-editor__field">
          <span>タグ</span>
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="タグ: 仕事, 買い物, 期限"
            maxLength={500}
          />
        </label>

        <div className="due-todo-form__items">
          <div className="due-todo-form__items-header">
            <h2>Todo項目</h2>
            <button
              type="button"
              className="todo-items__button todo-items__button--ghost"
              onClick={() => setItems((currentItems) => [...currentItems, createDraftItem()])}
            >
              項目を追加
            </button>
          </div>

          {items.map((item, index) => (
            <div className="due-todo-form__item" key={item.id}>
              <label>
                <span>Todo項目 {index + 1}</span>
                <input
                  value={item.text}
                  onChange={(event) => updateItem(item.id, { text: event.target.value })}
                  placeholder="やること"
                  maxLength={500}
                />
              </label>
              <label>
                <span>項目の期限</span>
                <input
                  type="datetime-local"
                  value={item.dueAt}
                  onChange={(event) => updateItem(item.id, { dueAt: event.target.value })}
                />
              </label>
              <button
                type="button"
                className="todo-items__icon-button todo-items__icon-button--danger"
                onClick={() => removeItem(item.id)}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p className="todo-items__message" role="alert">
          {error}
        </p>
      )}

      <footer className="post-editor__footer">
        <button
          type="button"
          className="post-editor__primary-action"
          onClick={handleSubmit}
          disabled={isPending || !canSubmit}
        >
          {isPending ? "保存中..." : "期限付きTodoを保存"}
        </button>
      </footer>
    </section>
  );
}
