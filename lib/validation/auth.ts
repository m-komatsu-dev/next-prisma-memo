import { z } from "zod";
import { safeString, termsAcceptedValueSchema } from "./common";

export const registerSchema = z.object({
  name: safeString("名前", 80)
    .trim()
    .min(1, "名前を入力してください"),
  email: z
    .string({ error: "メールアドレスの形式が正しくありません。" })
    .trim()
    .toLowerCase()
    .email("有効なメールアドレスを入力してください")
    .max(254, "メールアドレスは254文字以内で入力してください。"),
  password: z
    .string({ error: "パスワードの形式が正しくありません。" })
    .min(8, "パスワードは8文字以上で入力してください")
    .max(128, "パスワードは128文字以内で入力してください。"),
  termsAccepted: termsAcceptedValueSchema,
});

export const termsAcceptedFormSchema = z.object({
  termsAccepted: termsAcceptedValueSchema,
});

export const loginSchema = z.object({
  email: z
    .string({ error: "メールアドレスの形式が正しくありません。" })
    .trim()
    .toLowerCase()
    .email("メールアドレスの形式が正しくありません")
    .max(254, "メールアドレスの形式が正しくありません。"),
  password: z
    .string({ error: "パスワードの形式が正しくありません。" })
    .min(1, "パスワードを入力してください")
    .max(128, "パスワードの形式が正しくありません。"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: "現在のパスワードの形式が正しくありません。" })
      .min(1, "現在のパスワードを入力してください。")
      .max(128, "現在のパスワードの形式が正しくありません。"),
    newPassword: z
      .string({ error: "新しいパスワードの形式が正しくありません。" })
      .min(8, "新しいパスワードは8文字以上で入力してください。")
      .max(128, "新しいパスワードは128文字以内で入力してください。"),
    confirmPassword: z
      .string({ error: "新しいパスワード確認の形式が正しくありません。" })
      .min(1, "新しいパスワード確認を入力してください。")
      .max(128, "新しいパスワード確認の形式が正しくありません。"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "新しいパスワードと確認用パスワードが一致しません。",
    path: ["confirmPassword"],
  });

export const mobileRefreshTokenRequestSchema = z.object({
  refreshToken: z
    .string({ error: "refreshTokenの形式が正しくありません。" })
    .trim()
    .min(32, "refreshTokenの形式が正しくありません。")
    .max(512, "refreshTokenの形式が正しくありません。"),
});
