# Screenshots Guide

このディレクトリには、ポートフォリオ提出用のスクリーンショットを配置します。実画像を追加したら、ルートの [`README.md`](../../README.md) から見せたい順にリンクできます。

## 推奨ファイル名

| ファイル名 | 画面 | 撮影ポイント |
| --- | --- | --- |
| `01-top-login.png` | トップページ / ログイン画面 | アプリ名、ログイン導線、OAuth導線が分かる状態 |
| `02-memo-list.png` | メモ一覧 | 検索、フィルター、並び替え、カード/リストの雰囲気 |
| `03-memo-detail.png` | メモ詳細 | タイトル、本文、タグ、公開状態、AI要約 |
| `04-memo-editor.png` | メモ作成・編集 | 自動保存、タグ、公開設定、AI補助ボタン |
| `05-todo-create.png` | Todo作成 | 期限付きTodoやチェック項目を追加している状態 |
| `06-todo-detail.png` | Todo詳細 / Todo一覧 | 完了状態、期限、リマインダー、横断Todo一覧 |
| `07-calendar.png` | カレンダー | 期限付きTodoを日付で確認できる状態 |
| `08-share-settings.png` | 共有設定 | viewer / editorの権限設定が分かる状態 |
| `09-ai-assistant.png` | AI Assistant | タイトル生成、タグ生成、要約、リライトの導線 |
| `10-mobile-list.png` | モバイル版一覧 | Expoアプリのメモ一覧、検索、フィルター |
| `11-mobile-detail.png` | モバイル版詳細 | モバイルで同じメモを閲覧・編集できる状態 |
| `12-mobile-todos.png` | モバイル版Todo | Todo一覧、期限、完了切り替えが分かる状態 |

## 撮影前チェック

- 本名、メールアドレス、APIキー、DB URLなどの秘密情報や個人情報が映っていないこと
- サンプルユーザー、サンプルメモ、サンプルTodoだけを使うこと
- 画面のURLやブラウザ拡張機能に不要な情報が映っていないこと
- Web版はデスクトップ幅、モバイル版はスマホ縦画面で撮ること
- 同じメモをWeb版とモバイル版の両方で表示し、同じDBを使っていることが伝わるようにすること

## READMEへの貼り付け例

```md
![メモ一覧](docs/screenshots/02-memo-list.png)
![モバイル版詳細](docs/screenshots/11-mobile-detail.png)
```
