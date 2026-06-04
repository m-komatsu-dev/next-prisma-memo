import { expect, test, type Page } from "@playwright/test";

const uniqueSuffix = Date.now();
const e2eUser = {
  email: `e2e-${uniqueSuffix}@example.com`,
  name: `E2E Test User ${uniqueSuffix}`,
};
const e2ePassword = process.env.E2E_TEST_PASSWORD ?? "";
let currentE2ePassword = e2ePassword;
const changedE2ePassword = `${e2ePassword.slice(0, 96)}-updated`;
const memoTitle = `E2Eメモ ${uniqueSuffix}`;
const memoContent = `Playwrightで作成した本文 ${uniqueSuffix}`;
const editedMemoTitle = `E2Eメモ 編集済み ${uniqueSuffix}`;
const editedMemoContent = `編集後の本文 ${uniqueSuffix}`;
const dueTodoListTitle = `E2E期限付きTodo ${uniqueSuffix}`;
const editedDueTodoListTitle = `E2E期限付きTodo 編集済み ${uniqueSuffix}`;

function postEditor(page: Page) {
  return page.getByRole("region", { name: "投稿エディタ" });
}

function toDateTimeLocalInputValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function localDaysFromNow(days: number, hours: number, minutes = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, minutes, 0, 0);
  return toDateTimeLocalInputValue(date);
}

test.describe.configure({ mode: "serial" });

test.skip(
  !e2ePassword,
  "E2E_TEST_PASSWORD is required. Set it in .env.test or your shell environment.",
);

test("トップページが表示される", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /思考を逃さず/ })).toBeVisible();
  await expect(
    page.getByLabel("メインナビゲーション").getByRole("link", { name: "新規登録" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
});

test("新規登録ページが表示される", async ({ page }) => {
  await page.goto("/register");

  await expect(page.getByRole("heading", { name: "新規登録" })).toBeVisible();
  await expect(page.getByLabel("ユーザー名")).toBeVisible();
  await expect(page.getByLabel("メールアドレス")).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
});

test("ユニークなテストユーザーを登録し、ログインできる", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("ユーザー名").fill(e2eUser.name);
  await page.getByLabel("メールアドレス").fill(e2eUser.email);
  await page.locator('input[name="password"]').fill(e2ePassword);
  await page.locator("#termsAccepted").check();
  await page.getByRole("button", { name: "アカウントを作成" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#login")).toBeVisible();

  await page.getByLabel("メールアドレス").fill(e2eUser.email);
  await page.locator('#login input[name="password"]').fill(e2ePassword);
  await page.getByRole("button", { name: "メールアドレスでログイン" }).click();

  await expect(page).toHaveURL(/\/posts$/);
  await expect(page.getByRole("heading", { name: /メモ一覧/ })).toBeVisible();
});

test("ログイン後にパスワードを変更でき、古いパスワードではログインできない", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("メールアドレス").fill(e2eUser.email);
  await page.locator('#login input[name="password"]').fill(currentE2ePassword);
  await page.getByRole("button", { name: "メールアドレスでログイン" }).click();

  await expect(page).toHaveURL(/\/posts$/);

  await page.goto("/account/password");
  await expect(page.getByRole("heading", { name: "パスワード変更" })).toBeVisible();

  await page.getByLabel("現在のパスワード").fill("wrong-password");
  await page.getByLabel("新しいパスワード", { exact: true }).fill(changedE2ePassword);
  await page.getByLabel("新しいパスワード確認").fill(changedE2ePassword);
  await page.getByRole("button", { name: "パスワードを変更" }).click();
  await expect(page.getByText("現在のパスワードが違います。").first()).toBeVisible();

  await page.getByLabel("現在のパスワード").fill(currentE2ePassword);
  await page.getByLabel("新しいパスワード", { exact: true }).fill(changedE2ePassword);
  await page.getByLabel("新しいパスワード確認").fill(`${changedE2ePassword}-x`);
  await page.getByRole("button", { name: "パスワードを変更" }).click();
  await expect(
    page.getByText("新しいパスワードと確認用パスワードが一致しません。"),
  ).toBeVisible();

  await page.getByLabel("現在のパスワード").fill(currentE2ePassword);
  await page.getByLabel("新しいパスワード", { exact: true }).fill(changedE2ePassword);
  await page.getByLabel("新しいパスワード確認").fill(changedE2ePassword);
  await page.getByRole("button", { name: "パスワードを変更" }).click();
  await expect(page.getByText("パスワードを変更しました")).toBeVisible();

  await page
    .getByLabel("メインナビゲーション")
    .getByRole("button", { name: "ログアウト" })
    .click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByLabel("メールアドレス").fill(e2eUser.email);
  await page.locator('#login input[name="password"]').fill(currentE2ePassword);
  await page.getByRole("button", { name: "メールアドレスでログイン" }).click();
  await expect(
    page.getByText("メールアドレスまたはパスワードが正しくありません"),
  ).toBeVisible();

  await page.getByLabel("メールアドレス").fill(e2eUser.email);
  await page.locator('#login input[name="password"]').fill(changedE2ePassword);
  await page.getByRole("button", { name: "メールアドレスでログイン" }).click();
  await expect(page).toHaveURL(/\/posts$/);

  currentE2ePassword = changedE2ePassword;
});

test("ログイン後にメモの作成・表示・詳細・編集・削除ができ、ログアウトできる", async ({
  page,
}) => {
  test.slow();

  await page.goto("/");
  await page.getByLabel("メールアドレス").fill(e2eUser.email);
  await page.locator('#login input[name="password"]').fill(currentE2ePassword);
  await page.getByRole("button", { name: "メールアドレスでログイン" }).click();

  await expect(page).toHaveURL(/\/posts$/);
  await expect(page.getByRole("heading", { name: /メモ一覧/ })).toBeVisible();

  await page.getByRole("link", { name: /新規作成|メモを作成/ }).first().click();
  await expect(page).toHaveURL(/\/posts\/new$/);
  await expect(page.getByRole("heading", { name: "新規作成" })).toBeVisible();
  await page.getByRole("button", { name: /テキスト/ }).click();
  await expect(page.getByRole("heading", { name: "新規メモ作成" })).toBeVisible();

  const newEditor = postEditor(page);
  await newEditor.getByPlaceholder("タイトル").fill(memoTitle);
  await newEditor.getByLabel("本文").fill(memoContent);
  await newEditor.getByPlaceholder("タグ: React, 勉強, アイデア").fill("e2e");
  await page.getByRole("button", { name: "非公開で保存" }).click();

  await expect(page).toHaveURL(/\/posts$/);
  await expect(page.getByRole("link", { name: memoTitle })).toBeVisible();
  await expect(page.getByText(memoContent)).toBeVisible();

  await page.getByRole("link", { name: memoTitle }).click();
  await expect(page).toHaveURL(/\/posts\/\d+$/);
  await expect(page.getByRole("heading", { name: memoTitle })).toBeVisible();
  await expect(page.getByText(memoContent)).toBeVisible();

  await page.getByRole("link", { name: "編集" }).click();
  await expect(page).toHaveURL(/\/posts\/\d+\/edit$/);
  await expect(page.getByRole("heading", { name: "メモを編集" })).toBeVisible();

  const editEditor = postEditor(page);
  await editEditor.getByPlaceholder("タイトル").fill(editedMemoTitle);
  await editEditor.getByLabel("本文").fill(editedMemoContent);
  await page.getByRole("button", { name: "非公開で保存" }).click();

  await expect(page).toHaveURL(/\/posts$/);
  await expect(page.getByRole("link", { name: editedMemoTitle })).toBeVisible();
  await expect(page.getByText(editedMemoContent)).toBeVisible();
  await expect(page.getByRole("link", { name: memoTitle })).toHaveCount(0);

  await page.getByRole("link", { name: editedMemoTitle }).click();
  await expect(page).toHaveURL(/\/posts\/\d+$/);
  await expect(page.getByRole("region", { name: "このメモのTodo" })).toHaveCount(0);

  await page.getByRole("link", { name: "編集" }).click();
  await expect(page).toHaveURL(/\/posts\/\d+\/edit$/);
  const editTodoPanel = page.getByRole("region", { name: "このメモのTodo" });
  await editTodoPanel.getByLabel("Todo内容").fill("期限なしTodo");
  await editTodoPanel.getByRole("button", { name: "追加" }).click();
  await expect(editTodoPanel.getByText("期限なしTodo")).toBeVisible();

  await editTodoPanel.getByText("期限付きTodo").click();
  await editTodoPanel.getByLabel("Todo内容").fill("今日のTodo");
  await editTodoPanel.getByLabel("期限日時").fill(localDaysFromNow(0, 18));
  await editTodoPanel.getByRole("button", { name: "追加" }).click();
  await expect(editTodoPanel.getByText("今日のTodo")).toBeVisible();

  await editTodoPanel.getByLabel("Todo内容").fill("明日のTodo");
  await editTodoPanel.getByLabel("期限日時").fill(localDaysFromNow(1, 9));
  await editTodoPanel.getByRole("button", { name: "追加" }).click();
  await expect(editTodoPanel.getByText("明日のTodo")).toBeVisible();

  await editTodoPanel.getByLabel("Todo内容").fill("期限切れTodo");
  await editTodoPanel.getByLabel("期限日時").fill(localDaysFromNow(-1, 9));
  await editTodoPanel.getByRole("button", { name: "追加" }).click();
  await expect(editTodoPanel.getByText("期限切れTodo")).toBeVisible();

  await page.getByRole("button", { name: "非公開で保存" }).click();
  await expect(page).toHaveURL(/\/posts$/);
  await page.getByRole("link", { name: editedMemoTitle }).click();
  await expect(page).toHaveURL(/\/posts\/\d+$/);
  const todoPanel = page.getByRole("region", { name: "このメモのTodo" });
  await expect(todoPanel.getByLabel("Todo内容")).toHaveCount(0);
  await expect(todoPanel.getByRole("button", { name: "追加" })).toHaveCount(0);

  await todoPanel
    .locator(".todo-items__row", { hasText: "今日のTodo" })
    .getByRole("button", { name: "完了にする" })
    .click();

  await todoPanel.getByRole("button", { name: "すべて" }).click();
  await expect(todoPanel.getByText("期限なしTodo")).toBeVisible();
  await expect(todoPanel.getByText("今日のTodo")).toBeVisible();
  await expect(todoPanel.getByText("明日のTodo")).toBeVisible();
  await expect(todoPanel.getByText("期限切れTodo")).toBeVisible();

  await todoPanel.getByRole("button", { name: "未完了" }).click();
  await expect(todoPanel.getByText("期限なしTodo")).toBeVisible();
  await expect(todoPanel.getByText("今日のTodo")).toHaveCount(0);

  await todoPanel.getByRole("button", { name: "完了済み" }).click();
  await expect(todoPanel.getByText("今日のTodo")).toBeVisible();
  await expect(todoPanel.getByText("明日のTodo")).toHaveCount(0);

  await todoPanel.getByRole("button", { name: "今日" }).click();
  await expect(todoPanel.getByText("今日のTodo")).toBeVisible();
  await expect(todoPanel.getByText("明日のTodo")).toHaveCount(0);

  await todoPanel.getByRole("button", { name: "明日" }).click();
  await expect(todoPanel.getByText("明日のTodo")).toBeVisible();
  await expect(todoPanel.getByText("今日のTodo")).toHaveCount(0);

  await todoPanel.getByRole("button", { name: "今週" }).click();
  await expect(todoPanel.getByText("今日のTodo")).toBeVisible();
  await expect(todoPanel.getByText("明日のTodo")).toBeVisible();
  await expect(todoPanel.getByText("期限切れTodo")).toHaveCount(0);

  await todoPanel.getByRole("button", { name: "期限切れ" }).click();
  await expect(todoPanel.getByText("期限切れTodo")).toBeVisible();
  await expect(todoPanel.getByText("今日のTodo")).toHaveCount(0);

  await todoPanel.getByRole("button", { name: "期限なし" }).click();
  await expect(todoPanel.getByText("期限なしTodo")).toBeVisible();
  await expect(todoPanel.getByText("明日のTodo")).toHaveCount(0);

  const postDetailUrl = page.url();
  await page.goto("/todos/calendar");
  await expect(page.getByRole("heading", { name: "Todoカレンダー" })).toBeVisible();
  await expect(page.getByRole("link", { name: "週表示" })).toBeVisible();
  await expect(page.getByRole("link", { name: "月表示" })).toBeVisible();
  await expect(page.getByRole("link", { name: "前の週" })).toBeVisible();
  await expect(page.getByRole("link", { name: "今日へ戻る" })).toBeVisible();
  await expect(page.getByRole("link", { name: "次の週" })).toBeVisible();
  await expect(page.getByText("明日のTodo")).toBeVisible();
  await expect(page.getByText("期限切れTodo")).toHaveCount(0);

  await page.getByRole("button", { name: /期限切れ/ }).click();
  await expect(page.getByText("期限切れTodo")).toBeVisible();
  await page.getByRole("button", { name: /期限切れ/ }).click();

  await page.getByRole("link", { name: "月表示" }).click();
  await expect(page.getByRole("link", { name: "前の月" })).toBeVisible();
  await expect(page.getByRole("link", { name: "次の月" })).toBeVisible();
  await expect(page.getByText("明日のTodo")).toBeVisible();

  await page.getByRole("link", { name: /明日のTodo/ }).click();
  await expect(page).toHaveURL(/\/posts\/\d+\/edit$/);
  await page.goto(postDetailUrl);

  const filteredTodoRow = todoPanel.locator(".todo-items__row", { hasText: "期限なしTodo" });
  await filteredTodoRow.getByRole("button", { name: "編集" }).click();
  const todoEditForm = page.locator(".todo-items__edit-form").first();
  await todoEditForm.locator("input").first().fill("期限なしTodo 編集");
  await todoEditForm.getByRole("button", { name: "保存" }).click();
  await expect(todoPanel.getByText("期限なしTodo 編集")).toBeVisible();

  await todoPanel
    .locator(".todo-items__row", { hasText: "期限なしTodo 編集" })
    .getByRole("button", { name: "完了にする" })
    .click();
  await expect(todoPanel.getByText("期限なしTodo 編集")).toBeVisible();

  await todoPanel
    .locator(".todo-items__row", { hasText: "期限なしTodo 編集" })
    .getByRole("button", { name: "削除" })
    .click();
  await expect(todoPanel.getByText("期限なしTodo 編集")).toHaveCount(0);

  await page.getByLabel("メモ操作").getByRole("button", { name: "削除" }).click();
  await page
    .getByRole("dialog", { name: "このメモを削除しますか？" })
    .getByRole("button", { name: "削除する" })
    .click();

  await expect(page).toHaveURL(/\/posts$/);
  await expect(page.getByRole("link", { name: editedMemoTitle })).toHaveCount(0);

  await page.getByRole("link", { name: /新規作成|メモを作成/ }).first().click();
  await expect(page).toHaveURL(/\/posts\/new$/);
  await page.getByRole("button", { name: /Todo/ }).click();
  await expect(page.getByRole("heading", { name: "期限付きTodo作成" })).toBeVisible();
  await page.getByLabel("Todoリストのタイトル").fill(dueTodoListTitle);
  await page.getByLabel("Todoリスト全体の期限").fill(localDaysFromNow(2, 18));
  await page.getByLabel("タグ").fill("e2e-todo, urgent");
  await page.getByLabel("Todo項目 1").fill("リスト内Todo 1");
  await page.getByLabel("項目の期限").fill(localDaysFromNow(1, 10));
  await page.getByRole("button", { name: "項目を追加" }).click();
  await page.getByLabel("Todo項目 2").fill("リスト内Todo 2");
  await page.getByLabel("項目の期限").nth(1).fill(localDaysFromNow(2, 12));
  await page.getByRole("button", { name: "期限付きTodoを保存" }).click();

  await expect(page).toHaveURL(/\/posts$/);
  await expect(page.getByRole("link", { name: dueTodoListTitle })).toBeVisible();
  await expect(page.getByText(/リスト期限/).first()).toBeVisible();

  await page.getByRole("link", { name: dueTodoListTitle }).click();
  await expect(page.getByRole("heading", { name: dueTodoListTitle })).toBeVisible();
  await expect(page.getByText("リスト期限")).toBeVisible();
  await expect(page.getByText("#e2e-todo")).toBeVisible();
  await expect(page.getByText("#urgent")).toBeVisible();
  await expect(page.getByText("リスト内Todo 1")).toBeVisible();
  await expect(page.getByText("リスト内Todo 2")).toBeVisible();

  await page.getByRole("link", { name: "編集" }).click();
  await expect(page.getByRole("heading", { name: "期限付きTodoリスト" })).toBeVisible();
  await page.getByLabel("Todoリストのタイトル").fill(editedDueTodoListTitle);
  await page.getByLabel("タグ").fill("e2e-todo-edited");
  await page.getByRole("button", { name: "期限付きTodoを保存" }).click();
  await expect(page).toHaveURL(/\/posts$/);
  await expect(page.getByRole("link", { name: editedDueTodoListTitle })).toBeVisible();
  await expect(page.getByText("#e2e-todo-edited")).toBeVisible();

  await page.goto("/");
  const navLogoutButton = page
    .getByLabel("メインナビゲーション")
    .getByRole("button", { name: "ログアウト" });
  await expect(navLogoutButton).toBeVisible();
  await navLogoutButton.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
});
