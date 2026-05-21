"use client";

import { generateAiContent } from "@/app/posts/[id]/edit/ai-actions";
import { Sparkles } from "lucide-react";
import { useState } from "react";

type PostAiSummaryProps = {
  content: string;
};

export default function PostAiSummary({ content }: PostAiSummaryProps) {
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleGenerateSummary() {
    setIsLoading(true);
    setError("");

    const response = await generateAiContent(content, "summarize");
    setIsLoading(false);

    if (response.success) {
      setSummary(response.result);
      return;
    }

    setError(response.result);
  }

  return (
    <aside className="post-ai-summary" aria-label="AIによるこのメモの要約">
      <div className="post-ai-summary__header">
        <p className="post-ai-summary__label">AIによるこのメモの要約</p>
        <button
          className="post-ai-summary__button"
          disabled={isLoading || !content.trim()}
          onClick={handleGenerateSummary}
          type="button"
        >
          <Sparkles aria-hidden="true" size={16} />
          {isLoading ? "生成中..." : summary ? "再生成" : "要約を生成"}
        </button>
      </div>

      {summary ? (
        <p>{summary}</p>
      ) : (
        <p className="post-ai-summary__empty">
          {error || "本文をAIで短く整理して、読み返しや共有の入口にできます。"}
        </p>
      )}
    </aside>
  );
}
