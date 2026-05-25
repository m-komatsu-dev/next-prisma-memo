"use client";

import { ArrowLeft, Check, Clipboard, Edit3, Share2, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";

// PostDetailActions コンポーネントが受け取るデータの型を定義します。
type PostDetailActionsProps = {
  canDelete: boolean;
  canEdit: boolean;
  canManageShares: boolean;
  content: string;  // コピー対象になるメモ本文です。
  // 削除フォームが送信されたときに実行されるサーバーアクションです。
  deleteAction: () => Promise<void>;
  editHref: string;  // 編集ページへのリンク先 URL です。
  tags: string[];  // メモにつけられたタグ一覧です。
  title: string;  // メモのタイトルです。
};

// 削除フォーム内で使う送信ボタン専用の小さなコンポーネントです。
function DeleteSubmitButton() {
  const { pending } = useFormStatus();  // いまフォームが送信中かどうかを pending として取り出します。

  return (
    <button className="post-confirm-dialog__danger" disabled={pending} type="submit">
      <Trash2 aria-hidden="true" size={18} />
      {pending ? "削除中..." : "削除する"}
    </button>
  );
}

// メモ詳細ページの操作ボタン一式を表示するメインコンポーネントです。
export default function PostDetailActions({
  canDelete,
  canEdit,
  canManageShares,
  content,  // メモ本文を受け取ります。
  deleteAction,  // 削除時に呼ぶ処理を受け取ります。
  editHref,  // 編集ページの URL を受け取ります。
  tags,
  title,
}: PostDetailActionsProps) {
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);  // 削除確認ダイアログを開くかどうかを管理する状態です。

  // 「コピー」ボタンが押されたときに実行される関数です。
  async function copyContent() {
    const tagLine = tags.map((tag) => `#${tag}`).join(" ");
    const formattedContent = `タイトル: ${title}\nタグ: ${tagLine}\n---\n${content}`;    // クリップボードへコピーするために、タイトル・タグ・本文を1つの文字列にまとめます。

    await navigator.clipboard.writeText(formattedContent);    // ブラウザのクリップボードへ、作った文字列を書き込みます。
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <>
      <div className="post-floating-toolbar" aria-label="メモ操作">
        <Link className="post-tool-button" href="/posts" aria-label="メモ一覧へ戻る">
          <ArrowLeft aria-hidden="true" size={18} />
          <span>戻る</span>
        </Link>

        <button className="post-tool-button" onClick={copyContent} type="button">
          {/* コピー済みならチェック、まだならクリップボードのアイコンを表示します。 */}
          {copied ? <Check aria-hidden="true" size={18} /> : <Clipboard aria-hidden="true" size={18} />}
          <span>{copied ? "コピー済み" : "コピー"}</span>
        </button>

        {canManageShares && (
          <a className="post-tool-button" href="#share-settings">
            <Share2 aria-hidden="true" size={18} />
            <span>共有</span>
          </a>
        )}

        {canEdit && (
          <Link className="post-tool-button post-tool-button--primary" href={editHref}>
            <Edit3 aria-hidden="true" size={18} />
            <span>編集</span>
          </Link>
        )}

        {canDelete && (
          <>
            <button
              className="post-tool-button post-tool-button--danger"
              onClick={() => setConfirmOpen(true)}
              type="button"
            >
              <Trash2 aria-hidden="true" size={18} />
              <span>削除</span>
            </button>
          </>
        )}
      </div>

      {/* confirmOpen が true のときだけ、削除確認ダイアログを表示します。 */}
      {confirmOpen && (
        <div className="post-confirm-backdrop" role="presentation">
          <div
            aria-labelledby="delete-dialog-title"
            aria-modal="true"
            className="post-confirm-dialog"
            role="dialog"
          >
            <button
              className="post-confirm-dialog__close"
              onClick={() => setConfirmOpen(false)}
              type="button"
              aria-label="削除確認を閉じる"
            >
              <X aria-hidden="true" size={18} />
            </button>

            <h2 id="delete-dialog-title">このメモを削除しますか？</h2>
            <p>削除すると元に戻せません。必要な内容はコピーしてから実行してください。</p>

            {/* キャンセルと削除のボタンを並べる領域です。 */}
            <div className="post-confirm-dialog__actions">
              <button
                className="post-confirm-dialog__cancel"
                onClick={() => setConfirmOpen(false)}
                type="button"
              >
                キャンセル
              </button>
              <form action={deleteAction}>
                <DeleteSubmitButton />. {/* 送信状態を見ながら表示を変える削除ボタンです。 */}
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
