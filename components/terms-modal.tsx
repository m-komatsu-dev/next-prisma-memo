"use client";

import { X } from "lucide-react";
import { useId, useState } from "react";

export function TermsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();

  return (
    <>
      <button
        className="terms-link"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        利用規約
      </button>

      {isOpen ? (
        <div
          aria-labelledby={titleId}
          aria-modal="true"
          className="terms-overlay"
          role="dialog"
        >
          <div className="terms-dialog">
            <div className="terms-dialog-header">
              <div>
                <p className="panel-kicker">Terms of Service</p>
                <h2 id={titleId}>利用規約</h2>
              </div>
              <button
                aria-label="利用規約を閉じる"
                className="terms-close"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>

            <div className="terms-content">
              <p>
                本規約は、本サービスを利用するすべてのユーザーに適用されます。
                ユーザーは、本規約に同意したうえで本サービスを利用するものとします。
              </p>

              <section>
                <h3>1. サービスの内容</h3>
                <p>
                  本サービスは、メモの作成、保存、閲覧、および Google Gemini API
                  を利用した AI 支援機能を提供します。開発者は、サービス内容を必要に応じて変更、
                  中断、終了できるものとします。
                </p>
              </section>

              <section>
                <h3>2. AI機能に関する免責</h3>
                <p>
                  Gemini を含む AI が生成する情報は、常に正確、完全、最新であるとは限らず、
                  事実と異なる内容、誤解を招く内容、不適切な内容を含む場合があります。
                  ユーザーは AI の出力を自己の責任で確認し、重要な判断に利用する場合は
                  専門家または信頼できる情報源で検証してください。
                </p>
                <p>
                  AI の出力または AI 機能の利用によりユーザーまたは第三者に損害、
                  紛争、不利益が生じた場合であっても、開発者は、故意または重過失がある場合を除き、
                  一切の責任を負いません。
                </p>
              </section>

              <section>
                <h3>3. データの取り扱い</h3>
                <p>
                  ユーザーが入力したメモ内容、AI へのプロンプト、関連する操作情報は、
                  本サービスの提供、保存、表示、改善、不正利用防止、および Google Gemini API
                  への送信を含む AI 機能の実行のために処理されます。
                </p>
                <p>
                  ユーザーは、個人情報、秘密情報、第三者の機密情報、法令または契約上入力が
                  禁止されている情報を、本サービスまたは AI 機能に入力しないでください。
                  入力内容に起因する損害や紛争について、開発者は責任を負いません。
                </p>
              </section>

              <section>
                <h3>4. 禁止事項</h3>
                <p>ユーザーは、以下の行為をしてはなりません。</p>
                <ul>
                  <li>法令、公序良俗、第三者の権利に反する行為</li>
                  <li>他者への誹謗中傷、脅迫、嫌がらせ、差別的表現の投稿または生成</li>
                  <li>不正アクセス、脆弱性探索、サービス運営を妨害する行為</li>
                  <li>詐欺、なりすまし、スパム、マルウェア作成などの不正目的での利用</li>
                  <li>危険行為、違法行為、有害な助言の生成など AI 機能の悪用</li>
                  <li>Google Gemini API の利用規約、禁止利用ポリシー、適用されるポリシーに反する行為</li>
                </ul>
              </section>

              <section>
                <h3>5. アカウント管理</h3>
                <p>
                  ユーザーは、登録情報を正確に保ち、アカウントおよび認証情報を自己の責任で管理します。
                  認証情報の管理不備、第三者利用、入力情報の誤りによって生じた損害について、
                  開発者は責任を負いません。
                </p>
              </section>

              <section>
                <h3>6. サービス停止、データ消失および免責</h3>
                <p>
                  サーバーダウン、通信障害、外部 API の停止、保守、セキュリティ対応、
                  予期しない不具合などにより、本サービスの全部または一部が停止する場合があります。
                  また、保存データが消失、破損、遅延する可能性があります。
                </p>
                <p>
                  これらによりユーザーまたは第三者に損害が生じた場合であっても、開発者は、
                  故意または重過失がある場合を除き、一切の責任を負いません。
                  重要なデータはユーザー自身でバックアップしてください。
                </p>
              </section>

              <section>
                <h3>7. 年齢制限</h3>
                <p>
                  Gemini API の利用条件により、AI 機能を利用できるのは 18 歳以上のユーザーに限られます。
                  18 歳未満の方は、本サービスの AI 機能を利用しないでください。
                </p>
              </section>

              <section>
                <h3>8. 規約の変更</h3>
                <p>
                  開発者は、必要に応じて本規約を変更できます。変更後の規約は、
                  本サービス上で表示された時点から効力を生じるものとします。
                </p>
              </section>

              <section>
                <h3>9. 準拠法および管轄</h3>
                <p>
                  本規約は日本法に準拠します。本サービスに関して紛争が生じた場合、
                  開発者の所在地を管轄する日本の裁判所を第一審の専属的合意管轄裁判所とします。
                </p>
              </section>

              <p className="terms-updated">制定日: 2026年5月21日</p>
            </div>

            <div className="terms-dialog-actions">
              <button
                className="button button-primary"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
