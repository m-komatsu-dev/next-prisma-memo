export default function PostDetailLoading() {
  return (
    <main className="post-detail-page">
      <div className="post-detail-shell">
        <div className="post-breadcrumb post-breadcrumb--skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="post-floating-toolbar post-floating-toolbar--skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <article className="post-article post-article--loading" aria-label="メモを読み込み中">
          <header className="post-article__header">
            <div className="post-skeleton post-skeleton--title" />
            <div className="post-skeleton-grid">
              <span />
              <span />
              <span />
              <span />
            </div>
          </header>

          <aside className="post-ai-summary">
            <span className="post-skeleton post-skeleton--label" />
            <span className="post-skeleton post-skeleton--line" />
            <span className="post-skeleton post-skeleton--line post-skeleton--short" />
          </aside>

          <div className="post-content">
            <span className="post-skeleton post-skeleton--line" />
            <span className="post-skeleton post-skeleton--line" />
            <span className="post-skeleton post-skeleton--line post-skeleton--short" />
            <span className="post-skeleton post-skeleton--line" />
          </div>
        </article>
      </div>
    </main>
  );
}
