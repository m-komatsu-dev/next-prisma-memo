import { expect, test, type Page } from "@playwright/test";

const e2eEmail = process.env.E2E_TEST_EMAIL?.trim().toLowerCase() ?? "";
const e2ePassword = process.env.E2E_TEST_PASSWORD ?? "";
const uniqueSuffix = Date.now();
const memoTitle = `e2e-memo-${uniqueSuffix}`;
const memoContent = `Playwright memo content ${uniqueSuffix}`;
const editedMemoTitle = `e2e-memo-edited-${uniqueSuffix}`;
const editedMemoContent = `Edited Playwright memo content ${uniqueSuffix}`;
const todoListTitle = `e2e-todo-list-${uniqueSuffix}`;
const todoItemText = `e2e-todo-item-${uniqueSuffix}`;

function postEditor(page: Page) {
  return page.getByRole("region", { name: "投稿エディタ" });
}

function toDateTimeLocalInputValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function localDaysFromNow(days: number, hours: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, 0, 0, 0);
  return toDateTimeLocalInputValue(date);
}

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("メールアドレス").fill(e2eEmail);
  await page.locator('#login input[name="password"]').fill(e2ePassword);
  await page.getByRole("button", { name: "メールアドレスでログイン" }).click();
  await expect(page).toHaveURL(/\/posts$/);
}

test.describe.configure({ mode: "serial" });

test.skip(
  !e2eEmail || !e2ePassword,
  "E2E_TEST_EMAIL and E2E_TEST_PASSWORD are required.",
);

test("未ログイン状態では保護ページにアクセスできない", async ({ page }) => {
  await page.goto("/posts");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
});

test("ログインでき、メモ一覧を表示できる", async ({ page }) => {
  await login(page);

  await expect(page.getByRole("heading", { name: /メモ一覧/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /新規作成|メモを作成/ }).first()).toBeVisible();
});

test("通常メモの作成・詳細表示・編集・削除ができる", async ({ page }) => {
  await login(page);

  await page.getByRole("link", { name: /新規作成|メモを作成/ }).first().click();
  await expect(page).toHaveURL(/\/posts\/new$/);
  await page.getByRole("button", { name: /テキスト/ }).click();
  await expect(page.getByRole("heading", { name: "新規メモ作成" })).toBeVisible();

  const newEditor = postEditor(page);
  await newEditor.getByPlaceholder("タイトル").fill(memoTitle);
  await newEditor.getByLabel("本文").fill(memoContent);
  await newEditor.getByPlaceholder("タグ: React, 勉強, アイデア").fill("e2e-memo");
  await page.getByRole("button", { name: "非公開で保存" }).click();

  await expect(page).toHaveURL(/\/posts$/);
  await expect(page.getByRole("link", { name: memoTitle })).toBeVisible();

  await page.getByRole("link", { name: memoTitle }).click();
  await expect(page).toHaveURL(/\/posts\/\d+$/);
  await expect(page.getByRole("heading", { name: memoTitle })).toBeVisible();
  await expect(page.getByText(memoContent)).toBeVisible();

  await page.getByRole("link", { name: "編集" }).click();
  await expect(page).toHaveURL(/\/posts\/\d+\/edit$/);

  const editEditor = postEditor(page);
  await editEditor.getByPlaceholder("タイトル").fill(editedMemoTitle);
  await editEditor.getByLabel("本文").fill(editedMemoContent);
  await page.getByRole("button", { name: "非公開で保存" }).click();

  await expect(page).toHaveURL(/\/posts$/);
  await expect(page.getByRole("link", { name: editedMemoTitle })).toBeVisible();
  await expect(page.getByRole("link", { name: memoTitle })).toHaveCount(0);

  await page.getByRole("link", { name: editedMemoTitle }).click();
  await expect(page.getByRole("heading", { name: editedMemoTitle })).toBeVisible();
  await expect(page.getByText(editedMemoContent)).toBeVisible();

  await page.getByLabel("メモ操作").getByRole("button", { name: "削除" }).click();
  await page
    .getByRole("dialog", { name: "このメモを削除しますか？" })
    .getByRole("button", { name: "削除する" })
    .click();

  await expect(page).toHaveURL(/\/posts$/);
  await expect(page.getByRole("link", { name: editedMemoTitle })).toHaveCount(0);
});

test("Todoを新規作成できる", async ({ page }) => {
  await login(page);

  await page.getByRole("link", { name: /新規作成|メモを作成/ }).first().click();
  await expect(page).toHaveURL(/\/posts\/new$/);
  await page.getByRole("button", { name: /Todo/ }).click();
  await expect(page.getByRole("heading", { name: "期限付きTodo作成" })).toBeVisible();

  await page.getByLabel("Todoリストのタイトル").fill(todoListTitle);
  await page.getByLabel("Todoリスト全体の期限").fill(localDaysFromNow(2, 18));
  await page.getByLabel("タグ").fill("e2e-todo");
  await page.getByLabel("Todo項目 1").fill(todoItemText);
  await page.getByLabel("項目の期限").fill(localDaysFromNow(1, 10));
  await page.getByRole("button", { name: "期限付きTodoを保存" }).click();

  await expect(page).toHaveURL(/\/posts$/);
  await expect(page.getByRole("link", { name: todoListTitle })).toBeVisible();

  await page.getByRole("link", { name: todoListTitle }).click();
  await expect(page.getByRole("heading", { name: todoListTitle })).toBeVisible();
  await expect(page.getByText(todoItemText)).toBeVisible();
});

test("ログアウトできる", async ({ page }) => {
  await login(page);

  await page
    .getByLabel("メインナビゲーション")
    .getByRole("button", { name: "ログアウト" })
    .click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
});
