// このファイルのコンポーネントを、ブラウザ側で動く Client Component として扱う指定です。
"use client";

// lucide-react から、画面に表示するアイコン部品を読み込みます。
import { ArrowLeft, Check, Clipboard, Edit3, Trash2, X } from "lucide-react";
// Next.js のページ移動用コンポーネントを読み込みます。
import Link from "next/link";
// React の useState を読み込み、画面の状態を保存できるようにします。
import { useState } from "react";
// フォーム送信中かどうかを知るための React のフックを読み込みます。
import { useFormStatus } from "react-dom";

// PostDetailActions コンポーネントが受け取るデータの型を定義します。
type PostDetailActionsProps = {
  // ログインユーザーが、このメモを編集・削除できるかを表す真偽値です。
  canManage: boolean;
  // コピー対象になるメモ本文です。
  content: string;
  // 削除フォームが送信されたときに実行されるサーバーアクションです。
  deleteAction: () => Promise<void>;
  // 編集ページへのリンク先 URL です。
  editHref: string;
  // メモにつけられたタグ一覧です。
  tags: string[];
  // メモのタイトルです。
  title: string;
};

// 削除フォーム内で使う送信ボタン専用の小さなコンポーネントです。
function DeleteSubmitButton() {
  // いまフォームが送信中かどうかを pending として取り出します。
  const { pending } = useFormStatus();

  // 削除ボタンの見た目を返します。
  return (
    // 送信中は disabled にして、二重送信を防ぎます。
    <button className="post-confirm-dialog__danger" disabled={pending} type="submit">
      {/* ゴミ箱アイコンを表示します。aria-hidden は読み上げ対象から外す指定です。 */}
      <Trash2 aria-hidden="true" size={18} />
      {/* 送信中なら「削除中...」、そうでなければ「削除する」と表示します。 */}
      {pending ? "削除中..." : "削除する"}
    </button>
  );
}

// メモ詳細ページの操作ボタン一式を表示するメインコンポーネントです。
export default function PostDetailActions({
  // 編集・削除できるかどうかを受け取ります。
  canManage,
  // メモ本文を受け取ります。
  content,
  // 削除時に呼ぶ処理を受け取ります。
  deleteAction,
  // 編集ページの URL を受け取ります。
  editHref,
  // タグ一覧を受け取ります。
  tags,
  // タイトルを受け取ります。
  title,
}: PostDetailActionsProps) {
  // コピー完了メッセージを出すかどうかを管理する状態です。
  const [copied, setCopied] = useState(false);
  // 削除確認ダイアログを開くかどうかを管理する状態です。
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 「コピー」ボタンが押されたときに実行される関数です。
  async function copyContent() {
    // tags の各要素に # をつけ、半角スペースでつないだ文字列を作ります。
    const tagLine = tags.map((tag) => `#${tag}`).join(" ");
    // クリップボードへコピーするために、タイトル・タグ・本文を1つの文字列にまとめます。
    const formattedContent = `タイトル: ${title}\nタグ: ${tagLine}\n---\n${content}`;

    // ブラウザのクリップボードへ、作った文字列を書き込みます。
    await navigator.clipboard.writeText(formattedContent);
    // コピーできたことを画面に表示するため、copied を true にします。
    setCopied(true);
    // 1.8秒後に copied を false に戻し、「コピー済み」表示を消します。
    window.setTimeout(() => setCopied(false), 1800);
  }

  // このコンポーネントが画面に表示する JSX を返します。
  return (
    // React Fragment です。余計な div を増やさず、複数要素をまとめて返します。
    <>
      {/* 画面上に浮かぶ操作ツールバーです。 */}
      <div className="post-floating-toolbar" aria-label="メモ操作">
        {/* メモ一覧ページへ戻るリンクです。 */}
        <Link className="post-tool-button" href="/posts" aria-label="メモ一覧へ戻る">
          {/* 左矢印アイコンを表示します。 */}
          <ArrowLeft aria-hidden="true" size={18} />
          {/* ボタンの文字として「戻る」を表示します。 */}
          <span>戻る</span>
        </Link>

        {/* メモ内容をクリップボードへコピーするボタンです。 */}
        <button className="post-tool-button" onClick={copyContent} type="button">
          {/* コピー済みならチェック、まだならクリップボードのアイコンを表示します。 */}
          {copied ? <Check aria-hidden="true" size={18} /> : <Clipboard aria-hidden="true" size={18} />}
          {/* コピー済みなら「コピー済み」、まだなら「コピー」と表示します。 */}
          <span>{copied ? "コピー済み" : "コピー"}</span>
        </button>

        {/* canManage が true のときだけ、編集・削除ボタンを表示します。 */}
        {canManage && (
          // React Fragment です。編集リンクと削除ボタンをまとめています。
          <>
            {/* 編集ページへ移動するリンクです。 */}
            <Link className="post-tool-button post-tool-button--primary" href={editHref}>
              {/* 編集アイコンを表示します。 */}
              <Edit3 aria-hidden="true" size={18} />
              {/* ボタンの文字として「編集」を表示します。 */}
              <span>編集</span>
            </Link>

            {/* 削除確認ダイアログを開くボタンです。 */}
            <button
              // 通常ボタンと危険操作用ボタンの CSS クラスを指定します。
              className="post-tool-button post-tool-button--danger"
              // クリックされたら confirmOpen を true にして、確認ダイアログを開きます。
              onClick={() => setConfirmOpen(true)}
              // フォーム送信ではなく、普通のボタンとして動かします。
              type="button"
            >
              {/* ゴミ箱アイコンを表示します。 */}
              <Trash2 aria-hidden="true" size={18} />
              {/* ボタンの文字として「削除」を表示します。 */}
              <span>削除</span>
            </button>
          </>
        )}
      </div>

      {/* confirmOpen が true のときだけ、削除確認ダイアログを表示します。 */}
      {confirmOpen && (
        // 画面全体を覆う背景です。role="presentation" は装飾的な要素だと伝えます。
        <div className="post-confirm-backdrop" role="presentation">
          {/* 実際の確認ダイアログ本体です。 */}
          <div
            // このダイアログの見出し要素の id を指定します。
            aria-labelledby="delete-dialog-title"
            // ダイアログ表示中は、操作対象がこのダイアログであることを伝えます。
            aria-modal="true"
            // ダイアログ用の CSS クラスを指定します。
            className="post-confirm-dialog"
            // スクリーンリーダーにダイアログであることを伝えます。
            role="dialog"
          >
            {/* ダイアログを閉じるためのボタンです。 */}
            <button
              // 閉じるボタン用の CSS クラスを指定します。
              className="post-confirm-dialog__close"
              // クリックされたら confirmOpen を false にして、ダイアログを閉じます。
              onClick={() => setConfirmOpen(false)}
              // フォーム送信ではなく、普通のボタンとして動かします。
              type="button"
              // アイコンだけのボタンなので、読み上げ用の説明をつけます。
              aria-label="削除確認を閉じる"
            >
              {/* 閉じることを表す X アイコンを表示します。 */}
              <X aria-hidden="true" size={18} />
            </button>

            {/* ダイアログの見出しです。aria-labelledby から参照されます。 */}
            <h2 id="delete-dialog-title">このメモを削除しますか？</h2>
            {/* 削除の注意文を表示します。 */}
            <p>削除すると元に戻せません。必要な内容はコピーしてから実行してください。</p>

            {/* キャンセルと削除のボタンを並べる領域です。 */}
            <div className="post-confirm-dialog__actions">
              {/* 削除をやめてダイアログを閉じるボタンです。 */}
              <button
                // キャンセルボタン用の CSS クラスを指定します。
                className="post-confirm-dialog__cancel"
                // クリックされたら confirmOpen を false にして、ダイアログを閉じます。
                onClick={() => setConfirmOpen(false)}
                // フォーム送信ではなく、普通のボタンとして動かします。
                type="button"
              >
                {/* ボタンの文字として「キャンセル」を表示します。 */}
                キャンセル
              </button>
              {/* 削除処理 deleteAction を送信先にしたフォームです。 */}
              <form action={deleteAction}>
                {/* 送信状態を見ながら表示を変える削除ボタンです。 */}
                <DeleteSubmitButton />
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
