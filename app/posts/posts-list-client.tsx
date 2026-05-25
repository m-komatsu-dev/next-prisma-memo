"use client";

import { TodoListPreview } from "@/components/todo-list";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

export type MemoCardPost = {
  accessRole: "owner" | "editor" | "viewer" | "public";
  id: number;
  title: string;
  content: string;
  published: boolean;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  tags: { id: number; name: string }[];
};

type ServerAction = (formData: FormData) => Promise<void>;
type StatusFilter = "all" | "published" | "private" | "mine" | "shared";
type SortMode = "updated-desc" | "created-desc" | "title-asc";
type ViewMode = "cards" | "list";

type PostsListClientProps = {
  posts: MemoCardPost[];
  accessiblePostsCount: number;
  currentUserId: string;
  selectedFilter: StatusFilter;
  userName: string;
  deletePostAction: ServerAction;
  togglePublishedAction: ServerAction;
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const PREVIEW_LINE_LIMIT = 14;
const PREVIEW_APPROX_CHARS_PER_LINE = 42;

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

function isPreviewLikelyOverflowing(content: string) {
  const normalized = content.trim();
  if (!normalized) return false;

  const lines = normalized.split("\n");
  if (lines.length > PREVIEW_LINE_LIMIT) return true;

  const estimatedWrappedLines = lines.reduce((total, line) => {
    return total + Math.max(1, Math.ceil(line.length / PREVIEW_APPROX_CHARS_PER_LINE));
  }, 0);

  return estimatedWrappedLines > PREVIEW_LINE_LIMIT;
}

function MemoContentPreview({ content, query }: { content: string; query: string }) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(() => isPreviewLikelyOverflowing(content));
  const previewClassName = isOverflowing
    ? "memo-preview memo-preview--overflowing"
    : "memo-preview";

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    const measureOverflow = () => {
      const nextIsOverflowing = preview.scrollHeight - preview.clientHeight > 1;
      setIsOverflowing((current) => (current === nextIsOverflowing ? current : nextIsOverflowing));
    };

    measureOverflow();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureOverflow);
      return () => window.removeEventListener("resize", measureOverflow);
    }

    const resizeObserver = new ResizeObserver(measureOverflow);
    resizeObserver.observe(preview);

    return () => resizeObserver.disconnect();
  }, [content, query]);

  return (
    <div ref={previewRef} className={previewClassName}>
      <TodoListPreview
        content={content}
        renderText={(text) => highlightText(text, query)}
      />
    </div>
  );
}

export default function PostsListClient({
  posts,
  accessiblePostsCount,
  currentUserId,
  selectedFilter,
  userName,
  deletePostAction,
  togglePublishedAction,
}: PostsListClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("updated-desc");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  function updateStatusFilter(filter: StatusFilter) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("filter", filter);
    router.push(`${pathname}?${params.toString()}`);
  }

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return posts
      .filter((post) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          post.title.toLowerCase().includes(normalizedQuery) ||
          post.content.toLowerCase().includes(normalizedQuery) ||
          post.tags.some((tag) => tag.name.toLowerCase().includes(normalizedQuery));

        const matchesStatus =
          selectedFilter === "all" ||
          (selectedFilter === "published" && post.published) ||
          (selectedFilter === "private" && !post.published && post.authorId === currentUserId) ||
          (selectedFilter === "mine" && post.authorId === currentUserId) ||
          (selectedFilter === "shared" &&
            (post.accessRole === "viewer" || post.accessRole === "editor"));

        return matchesQuery && matchesStatus;
      })
      .sort((a, b) => {
        if (sortMode === "title-asc") {
          return a.title.localeCompare(b.title, "ja");// タイトルを日本語ロケールで昇順にソート
        }

        const left = sortMode === "created-desc" ? a.createdAt : a.updatedAt;
        const right = sortMode === "created-desc" ? b.createdAt : b.updatedAt;
        return new Date(right).getTime() - new Date(left).getTime();
      });
  }, [currentUserId, posts, query, selectedFilter, sortMode]);

  const publishedCount = posts.filter((post) => post.published).length;
  const privateCount = posts.filter((post) => !post.published && post.authorId === currentUserId).length;
  const myMemoCount = posts.filter((post) => post.authorId === currentUserId).length;
  const sharedCount = posts.filter((post) => post.accessRole === "viewer" || post.accessRole === "editor").length;

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
            {posts.length}件のメモ / 自分 {myMemoCount}件 / 共有 {sharedCount}件 / 公開 {publishedCount}件 / 非公開 {privateCount}件
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
            <label className="posts-search">
              <span>検索</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="タイトル、本文、タグで検索"
                type="search"
              />
            </label>

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
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
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

          {filteredPosts.length === 0 ? (
            <section className="posts-empty-state posts-empty-state--compact">
              <h2>該当するメモが見つかりませんでした</h2>
              <p>検索キーワードや公開ステータスを変えると、別のメモが見つかるかもしれません。</p>
              <button
                className="posts-secondary-action"
                onClick={() => {
                  setQuery("");
                  updateStatusFilter("all");
                }}
                type="button"
              >
                条件をリセット
              </button>
            </section>
          ) : (
            <section className={viewMode === "cards" ? "memo-grid" : "memo-list"} aria-live="polite">
              {filteredPosts.map((post) => {
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
                        <Link href={`/posts/${post.id}`}>{highlightText(post.title, query)}</Link>
                      </h2>

                      <MemoContentPreview content={post.content} query={query} />

                      {post.tags.length > 0 && (
                        <div className="memo-tags">
                          {post.tags.map((tag) => (
                            <button
                              key={tag.id}
                              onClick={() => setQuery(tag.name)}
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
        </>
      )}
    </div>
  );
}
