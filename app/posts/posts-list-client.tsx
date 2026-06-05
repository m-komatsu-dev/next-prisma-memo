"use client";

import { TodoListPreview } from "@/components/todo-list";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  type ReactNode,
  useMemo,
  useState,
  useTransition,
} from "react";

export type MemoCardPost = {
  accessRole: "owner" | "editor" | "viewer" | "public";
  id: number;
  title: string;
  content: string;
  contentTruncated: boolean;
  kind: string;
  todoListDueAt: string | null;
  published: boolean;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  tags: { id: number; name: string }[];
  todoItems: {
    completed: boolean;
    dueAt: string | null;
    id: number;
    position: number;
    text: string;
  }[];
  todoItemsCount: number;
};

type ServerAction = (formData: FormData) => Promise<void>;
type StatusFilter = "all" | "published" | "private" | "mine" | "shared";
type SortMode = "updated-desc" | "created-desc" | "title-asc";
type ViewMode = "cards" | "list";

type PostsListClientProps = {
  posts: MemoCardPost[];
  accessiblePostsCount: number;
  filteredPostsCount: number;
  hasMorePosts: boolean;
  currentUserId: string;
  nextLimit: number;
  selectedFilter: StatusFilter;
  selectedLimit: number;
  selectedQuery: string;
  selectedSort: SortMode;
  userName: string;
  deletePostAction: ServerAction;
  togglePublishedAction: ServerAction;
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "short",
  day: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
});
const todoPreviewDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "2-digit",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
});

function highlightText(text: string, query: string): ReactNode {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return text;

  const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");// クエリに正規表現の特殊文字が含まれている場合に備えてエスケープ
  const parts = text.split(new RegExp(`(${escapedQuery})`, "gi"));// クエリにマッチする部分でテキストを分割（大文字小文字を区別しない）

  return parts.map((part, index) =>
    part.toLowerCase() === trimmedQuery.toLowerCase() ? (
      <mark key={`${part}-${index}`} className="memo-highlight">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}

function MemoContentPreview({
  content,
  isTruncated,
  query,
}: {
  content: string;
  isTruncated: boolean;
  query: string;
}) {
  const previewClassName = isTruncated
    ? "memo-preview memo-preview--overflowing"
    : "memo-preview";

  return (
    <div className={previewClassName}>
      <TodoListPreview
        content={content}
        renderText={(text) => highlightText(text, query)}
      />
    </div>
  );
}

function TodoItemsPreview({
  query,
  todoItems,
  todoItemsCount,
}: {
  query: string;
  todoItems: MemoCardPost["todoItems"];
  todoItemsCount: number;
}) {
  const visibleItems = todoItems.slice(0, 4);

  if (visibleItems.length === 0) {
    return <p className="memo-todo-preview__empty">Todo項目なし</p>;
  }

  return (
    <ul className="memo-todo-preview" aria-label="Todo項目プレビュー">
      {visibleItems.map((todoItem) => (
        <li
          className={[
            "memo-todo-preview__item",
            todoItem.completed ? "memo-todo-preview__item--completed" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          key={todoItem.id}
        >
          <span className="memo-todo-preview__check" aria-hidden="true">
            {todoItem.completed ? "✓" : ""}
          </span>
          <span className="memo-todo-preview__text">
            {highlightText(todoItem.text, query)}
          </span>
          {todoItem.dueAt && (
            <span className="memo-todo-preview__due">
              期限 {todoPreviewDateFormatter.format(new Date(todoItem.dueAt))}
            </span>
          )}
        </li>
      ))}
      {todoItemsCount > visibleItems.length && (
        <li className="memo-todo-preview__more">
          他 {todoItemsCount - visibleItems.length} 件
        </li>
      )}
    </ul>
  );
}

function isTodoListPost(post: MemoCardPost) {
  return (
    post.kind === "dueTodo" ||
    post.todoListDueAt !== null ||
    post.content.trim() === "期限付きTodo"
  );
}

export default function PostsListClient({
  posts,
  accessiblePostsCount,
  filteredPostsCount,
  hasMorePosts,
  currentUserId,
  nextLimit,
  selectedFilter,
  selectedLimit,
  selectedQuery,
  selectedSort,
  userName,
  deletePostAction,
  togglePublishedAction,
}: PostsListClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(selectedQuery);
  const [isPending, startTransition] = useTransition();
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  function updateListParams({
    filter = selectedFilter,
    limit,
    q = selectedQuery,
    sort = selectedSort,
  }: {
    filter?: StatusFilter;
    limit?: number;
    q?: string;
    sort?: SortMode;
  }) {
    const params = new URLSearchParams(searchParams.toString());

    params.set("filter", filter);
    params.set("sort", sort);

    const normalizedQuery = q.trim();
    if (normalizedQuery) {
      params.set("q", normalizedQuery);
    } else {
      params.delete("q");
    }

    if (limit) {
      params.set("limit", String(limit));
    } else {
      params.delete("limit");
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function updateStatusFilter(filter: StatusFilter) {
    updateListParams({ filter });
  }

  function updateSortMode(sortMode: SortMode) {
    updateListParams({ sort: sortMode });
  }

  const counts = useMemo(
    () => ({
      myMemo: posts.filter((post) => post.authorId === currentUserId).length,
      private: posts.filter((post) => !post.published && post.authorId === currentUserId).length,
      published: posts.filter((post) => post.published).length,
      shared: posts.filter((post) => post.accessRole === "viewer" || post.accessRole === "editor").length,
    }),
    [currentUserId, posts],
  );
  const isFiltering =
    selectedQuery.length > 0 ||
    selectedFilter !== "all" ||
    selectedSort !== "updated-desc";
  const loadMoreParams = new URLSearchParams({
    filter: selectedFilter,
    limit: String(nextLimit),
    sort: selectedSort,
  });

  if (selectedQuery) {
    loadMoreParams.set("q", selectedQuery);
  }

  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm("本当にこのメモを削除してもよろしいですか？")) {
      event.preventDefault();
    }
  }

  function confirmPublishToggle(event: FormEvent<HTMLFormElement>, published: boolean) {
    if (!published && !window.confirm("このメモを一般に公開してもよろしいですか？")) {
      event.preventDefault();
    }
  }

  return (
    <div className="posts-shell">
      <header className="posts-toolbar">
        <div>
          <p className="posts-eyebrow">Memo workspace</p>
          <h1>{userName}さんのメモ一覧</h1>
          <p className="posts-summary">
            表示中 {posts.length}件 / 対象 {filteredPostsCount}件 / 全体 {accessiblePostsCount}件 / 自分 {counts.myMemo}件 / 共有 {counts.shared}件 / 公開 {counts.published}件 / 非公開 {counts.private}件
          </p>
        </div>
        <Link className="posts-primary-action" href="/posts/new">
          新規作成
        </Link>
      </header>

      {accessiblePostsCount === 0 ? (
        <section className="posts-empty-state">
          <p className="posts-empty-kicker">No memos yet</p>
          <h2>最初のメモを作成しましょう</h2>
          <p>思いついたことをすぐ残せるように、新しいメモから始められます。</p>
          <Link className="posts-primary-action" href="/posts/new">
            メモを作成
          </Link>
        </section>
      ) : (
        <>
          <section className="posts-controls" aria-label="メモの検索と絞り込み">
            <form
              className="posts-search"
              onSubmit={(event) => {
                event.preventDefault();
                updateListParams({ q: query });
              }}
            >
              <label>
              <span>検索</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="タイトル、本文、タグ、Todoで検索"
                type="search"
              />
              </label>
              <button type="submit">検索</button>
            </form>

            <label>
              <span>表示</span>
              <select value={selectedFilter} onChange={(event) => updateStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">すべて</option>
                <option value="mine">自分のメモ</option>
                <option value="shared">共有されたメモ</option>
                <option value="published">公開のみ</option>
                <option value="private">非公開のみ</option>
              </select>
            </label>

            <label>
              <span>並び替え</span>
              <select value={selectedSort} onChange={(event) => updateSortMode(event.target.value as SortMode)}>
                <option value="updated-desc">更新日が新しい順</option>
                <option value="created-desc">作成日が新しい順</option>
                <option value="title-asc">タイトル順</option>
              </select>
            </label>

            <div className="posts-view-toggle" aria-label="表示形式">
              <button
                aria-pressed={viewMode === "cards"}
                onClick={() => setViewMode("cards")}
                type="button"
              >
                カード
              </button>
              <button
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
                type="button"
              >
                リスト
              </button>
            </div>
          </section>

          <div className="posts-active-filters" aria-live="polite">
            {isPending ? <span>検索中...</span> : null}
            {isFiltering ? <span>絞り込み中</span> : <span>すべて表示</span>}
            {selectedQuery ? <span>検索: {selectedQuery}</span> : null}
            {selectedFilter !== "all" ? <span>表示: {selectedFilter}</span> : null}
            {selectedSort !== "updated-desc" ? <span>並び替え変更中</span> : null}
          </div>

          {posts.length === 0 ? (
            <section className="posts-empty-state posts-empty-state--compact">
              <h2>該当するメモが見つかりませんでした</h2>
              <p>
                タイトル・本文・タグ・Todo項目を検索しましたが、一致するメモはありませんでした。
              </p>
              <button
                className="posts-secondary-action"
                onClick={() => {
                  setQuery("");
                  updateListParams({ filter: "all", q: "", sort: "updated-desc" });
                }}
                type="button"
              >
                条件をリセット
              </button>
            </section>
          ) : (
            <section className={viewMode === "cards" ? "memo-grid" : "memo-list"} aria-live="polite">
              {posts.map((post) => {
                const isAuthor = post.accessRole === "owner";
                const canEdit = post.accessRole === "owner" || post.accessRole === "editor";

                return (
                  <article className="memo-card" key={post.id}>
                    <div className="memo-card-main">
                      <div className="memo-card-header">
                        <span className={post.published ? "memo-badge memo-badge--public" : "memo-badge"}>
                          {post.published ? "公開" : "非公開"}
                        </span>
                        {post.accessRole === "viewer" && (
                          <span className="memo-badge memo-badge--shared">viewer</span>
                        )}
                        {post.accessRole === "editor" && (
                          <span className="memo-badge memo-badge--shared">editor</span>
                        )}
                      </div>

                      <h2>
                        <Link href={`/posts/${post.id}`}>{highlightText(post.title, selectedQuery)}</Link>
                      </h2>

                      {isTodoListPost(post) ? (
                        <TodoItemsPreview
                          query={selectedQuery}
                          todoItems={post.todoItems}
                          todoItemsCount={post.todoItemsCount}
                        />
                      ) : (
                        <MemoContentPreview
                          content={post.content}
                          isTruncated={post.contentTruncated}
                          query={selectedQuery}
                        />
                      )}

                      {isTodoListPost(post) && post.todoListDueAt && (
                        <p className="memo-card__due">
                          リスト期限 {dateTimeFormatter.format(new Date(post.todoListDueAt))}
                        </p>
                      )}

                      {post.tags.length > 0 && (
                        <div className="memo-tags">
                          {post.tags.map((tag) => (
                            <button
                              key={tag.id}
                              onClick={() => {
                                setQuery(tag.name);
                                updateListParams({ q: tag.name });
                              }}
                              type="button"
                            >
                              #{tag.name}
                            </button>
                          ))}
                        </div>
                      )}

                      <dl className="memo-dates">
                        <div>
                          <dt>更新</dt>
                          <dd>{dateFormatter.format(new Date(post.updatedAt))}</dd>
                        </div>
                        <div>
                          <dt>作成</dt>
                          <dd>{dateFormatter.format(new Date(post.createdAt))}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="memo-card-actions">
                      <Link href={`/posts/${post.id}`}>詳細</Link>
                      {canEdit && <Link href={`/posts/${post.id}/edit`}>編集</Link>}
                      {isAuthor && (
                        <>
                          <Link href={`/posts/${post.id}#share-settings`}>共有</Link>
                          <form
                            action={togglePublishedAction}
                            onSubmit={(event) => confirmPublishToggle(event, post.published)}
                          >
                            <input name="id" type="hidden" value={post.id} />
                            <input name="published" type="hidden" value={String(post.published)} />
                            <button type="submit">{post.published ? "非公開にする" : "公開する"}</button>
                          </form>
                          <form action={deletePostAction} onSubmit={confirmDelete}>
                            <input name="id" type="hidden" value={post.id} />
                            <button className="memo-danger-action" type="submit">
                              削除
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          )}
          {hasMorePosts && posts.length > 0 && (
            <div className="posts-pagination">
              <Link
                className="posts-secondary-action"
                href={`/posts?${loadMoreParams.toString()}`}
              >
                もっと見る
              </Link>
              <span>
                {Math.min(nextLimit, filteredPostsCount)}件まで表示
                {selectedLimit >= filteredPostsCount ? "" : "できます"}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
