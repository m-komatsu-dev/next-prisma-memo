import { expect, test, type Page } from "@playwright/test";

const uniqueSuffix = Date.now();
const e2eUser = {
  email: `e2e-${uniqueSuffix}@example.com`,
  name: `E2E Test User ${uniqueSuffix}`,
};
const e2ePassword = process.env.E2E_TEST_PASSWORD ?? "";
const memoTitle = `E2Eメモ ${uniqueSuffix}`;
const memoContent = `Playwrightで作成した本文 ${uniqueSuffix}`;
const editedMemoTitle = `E2Eメモ 編集済み ${uniqueSuffix}`;
const editedMemoContent = `編集後の本文 ${uniqueSuffix}`;

function postEditor(page: Page) {
  return page.getByRole("region", { name: "投稿エディタ" });
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

test("ログイン後にメモの作成・表示・詳細・編集・削除ができ、ログアウトできる", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("メールアドレス").fill(e2eUser.email);
  await page.locator('#login input[name="password"]').fill(e2ePassword);
  await page.getByRole("button", { name: "メールアドレスでログイン" }).click();

  await expect(page).toHaveURL(/\/posts$/);
  await expect(page.getByRole("heading", { name: /メモ一覧/ })).toBeVisible();

  await page.getByRole("link", { name: /新規作成|メモを作成/ }).first().click();
  await expect(page).toHaveURL(/\/posts\/new$/);
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
  await page.getByRole("button", { name: "削除" }).click();
  await page
    .getByRole("dialog", { name: "このメモを削除しますか？" })
    .getByRole("button", { name: "削除する" })
    .click();

  await expect(page).toHaveURL(/\/posts$/);
  await expect(page.getByRole("link", { name: editedMemoTitle })).toHaveCount(0);

  await page.goto("/");
  const navLogoutButton = page
    .getByLabel("メインナビゲーション")
    .getByRole("button", { name: "ログアウト" });
  await expect(navLogoutButton).toBeVisible();
  await navLogoutButton.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
});
