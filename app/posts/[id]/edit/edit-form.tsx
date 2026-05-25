// app/posts/[id]/edit/edit-form.tsx
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { autoSavePost } from "./actions";
import { generateAiContent } from "./ai-actions";
import type { AiMode } from "@/lib/ai-modes";
import Link from "next/link";

type EditablePost = {
    id: number;
    title: string;
    content: string;
};

export default function EditPostForm({ post, initialTags }: { post: EditablePost, initialTags: string }) {
    const [title, setTitle] = useState(post.title);
    const [content, setContent] = useState(post.content);
    const [tags, setTags] = useState(initialTags);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const savedSignatureRef = useRef(
        JSON.stringify({ title: post.title, content: post.content, tags: initialTags })
    );
    const currentSignature = useMemo(
        () => JSON.stringify({ title, content, tags }),
        [content, tags, title]
    );

    const handleAiTask = async (mode: AiMode) => {
        setIsAiLoading(true);
        const response = await generateAiContent(content, mode);
        setIsAiLoading(false);

        if (response.success) {
            if (mode === "title") setTitle(response.result);
            if (mode === "tags") setTags(response.result);
            if (mode === "summarize") setContent((prev) => `${prev}\n\n【要約】\n${response.result}`);
            if (mode === "rewrite") setContent(response.result);
        } else {
            alert(response.result);
        }
    };

    const handleSave = useCallback(async () => {
        if (currentSignature === savedSignatureRef.current) return;

        setStatus("saving");
        const result = await autoSavePost(post.id, { title, content, tags });

        if (result.success) {
            savedSignatureRef.current = currentSignature;
            setStatus("saved");
            setTimeout(() => setStatus("idle"), 2000);
        } else {
            setStatus("error");
        }
    }, [post.id, title, content, tags, currentSignature]);

    useEffect(() => {
        const timer = setTimeout(handleSave, 1500); // 1.5秒入力が止まったら保存
        return () => clearTimeout(timer);
    }, [title, content, tags, handleSave]);

    return (
        <div className="space-y-6">
            {/* AIツールバー */}
            <div className="flex flex-wrap gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-xs font-bold text-blue-400 w-full mb-1 ml-1 uppercase">AI Assistant</span>
                <button
                    onClick={() => handleAiTask("title")}
                    disabled={isAiLoading}
                    className="text-xs bg-white hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors disabled:opacity-50"
                >
                    ✨ タイトル生成
                </button>
                <button
                    onClick={() => handleAiTask("tags")}
                    disabled={isAiLoading}
                    className="text-xs bg-white hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors disabled:opacity-50"
                >
                    🏷️ タグ自動生成
                </button>
                <button
                    onClick={() => handleAiTask("summarize")}
                    disabled={isAiLoading}
                    className="text-xs bg-white hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors disabled:opacity-50"
                >
                    📝 要約
                </button>
                <button
                    onClick={() => handleAiTask("rewrite")}
                    disabled={isAiLoading}
                    className="text-xs bg-white hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors disabled:opacity-50"
                >
                    ✍️ リライト
                </button>
                {isAiLoading && <span className="text-xs text-blue-500 animate-pulse ml-2 self-center">AIが考え中...</span>}
            </div>
            <div className="flex justify-end">
                <span className="text-sm text-gray-400">
                    {status === "saving" && "同期中..."}
                    {status === "saved" && "✅ 保存済み"}
                    {status === "error" && "⚠️ 保存失敗"}
                </span>
            </div>

            <div>
                <label className="block text-sm font-medium mb-2">タイトル</label>
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-2">内容</label>
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={10}
                    className="w-full whitespace-pre-wrap break-words px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-2">タグ（カンマ区切り）</label>
                <input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="例: React, 勉強"
                    className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div className="flex gap-4 pt-4">
                <Link href="/posts" className="flex-1 px-6 py-3 border rounded-lg text-center hover:bg-gray-50">
                    一覧に戻る
                </Link>
            </div>
        </div>
    );
}
