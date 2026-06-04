import { z } from "zod";
import { postShareRoleSchema } from "./common";

export const mobilePushSubscriptionSchema = z.object({
  expoPushToken: z
    .string({ error: "Expo Push Tokenの形式が正しくありません。" })
    .trim()
    .min(10, "Expo Push Tokenの形式が正しくありません。")
    .max(512, "Expo Push Tokenの形式が正しくありません。"),
  platform: z
    .enum(["android", "ios", "web", "unknown"], {
      error: "platformの形式が正しくありません。",
    })
    .optional(),
  deviceName: z
    .string({ error: "deviceNameの形式が正しくありません。" })
    .trim()
    .max(120, "deviceNameは120文字以内で入力してください。")
    .optional()
    .nullable(),
});

export const mobileRevokePushSubscriptionSchema = z.object({
  expoPushToken: z
    .string({ error: "Expo Push Tokenの形式が正しくありません。" })
    .trim()
    .min(10, "Expo Push Tokenの形式が正しくありません。")
    .max(512, "Expo Push Tokenの形式が正しくありません。")
    .optional(),
});

export const mobileAddPostShareSchema = z.object({
  email: z
    .string({ error: "メールアドレスの形式が正しくありません。" })
    .trim()
    .toLowerCase()
    .email("有効なメールアドレスを入力してください")
    .max(254, "メールアドレスは254文字以内で入力してください。"),
  role: postShareRoleSchema,
});

export const mobileUpdatePostShareSchema = z.object({
  role: postShareRoleSchema,
});
