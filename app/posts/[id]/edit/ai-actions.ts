// app/posts/[id]/edit/ai-actions.ts
"use server";

import { auth } from "@/auth";
import { logServerError } from "@/lib/server-errors";
import {
  aiContentRequestSchema,
  aiGeneratedResultSchema,
  getFirstZodErrorMessage,
} from "@/lib/zod";
import { GoogleGenAI, Type } from "@google/genai";

export type AiMode = "summarize" | "title" | "tags" | "rewrite";

type AiSuccess = {
  success: true;
  result: string;
};

type AiFailure = {
  success: false;
  result: string;
};

type AiResponse = AiSuccess | AiFailure;

const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const modeConfigs = {
  summarize: {
    instruction:
      "以下のメモ本文を日本語で3行以内の箇条書きに要約してください。本文にない内容は追加しないでください。",
    schema: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
      },
      required: ["summary"],
      propertyOrdering: ["summary"],
    },
    pick: (value: unknown) => getStringProperty(value, "summary"),
  },
  title: {
    instruction:
      "以下のメモ本文にふさわしい日本語タイトルを1つ作ってください。20文字以内を目安にしてください。",
    schema: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
      },
      required: ["title"],
      propertyOrdering: ["title"],
    },
    pick: (value: unknown) => getStringProperty(value, "title"),
  },
  tags: {
    instruction:
      "以下のメモ本文に関連する短い日本語タグを3個から5個作ってください。タグには記号や#を含めないでください。",
    schema: {
      type: Type.OBJECT,
      properties: {
        tags: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: ["tags"],
      propertyOrdering: ["tags"],
    },
    pick: (value: unknown) => {
      if (!isRecord(value) || !Array.isArray(value.tags)) return "";

      return value.tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.replace(/^#+/, "").trim())
        .filter(Boolean)
        .slice(0, 5)
        .join(", ");
    },
  },
  rewrite: {
    instruction:
      "以下のメモ本文を、意味を変えずに丁寧で読みやすい文章へリライトしてください。要約せず、本文全体を返してください。",
    schema: {
      type: Type.OBJECT,
      properties: {
        content: { type: Type.STRING },
      },
      required: ["content"],
      propertyOrdering: ["content"],
    },
    pick: (value: unknown) => getStringProperty(value, "content"),
  },
} satisfies Record<
  AiMode,
  {
    instruction: string;
    schema: object;
    pick: (value: unknown) => string;
  }
>;

export async function generateAiContent(content: string, mode: AiMode): Promise<AiResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, result: "ログインが必要です。" };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logServerError(new Error("Missing GEMINI_API_KEY"), {
      action: "generateAiContent",
      userId: session.user.id,
      details: { reason: "missingApiKey" },
    });
    return { success: false, result: "AI処理を利用できません。" };
  }

  const validatedFields = aiContentRequestSchema.safeParse({ content, mode });
  if (!validatedFields.success) {
    return { success: false, result: getFirstZodErrorMessage(validatedFields.error) };
  }

  const { content: trimmedContent, mode: validatedMode } = validatedFields.data;// 入力された内容の前後の空白を削除したものを使います。AIに渡す前に、無駄な空白を減らして内容をすっきりさせるためです。
  const config = modeConfigs[validatedMode];
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${config.instruction}\n\n--- メモ本文 ---\n${trimmedContent}`,// AIへの指示と、実際のメモ内容をセットで渡します。指示はmodeConfigsで定義されているものを使います。
            },
          ],
        },
      ],
      config: {
        temperature: validatedMode === "rewrite" ? 0.4 : 0.2,// リライトは少しだけ創造性を出すために温度を上げます。他のモードは、より正確な結果が欲しいので低めに設定します。
        responseMimeType: "application/json",// AIからの応答はJSON形式で受け取るように指定します。これにより、構造化されたデータを簡単に扱えるようになります。
        responseSchema: config.schema,// modeConfigsで定義されているスキーマを使って、AIからの応答が期待する形式になっているか検証します。これにより、AIの応答が正しい構造を持っていることを保証します。
      },
    });

    const text = response.text;
    if (!text) {
      return { success: false, result: "AIから結果が返りませんでした。" };
    }

    const pickedResult = config.pick(JSON.parse(text));
    const validatedResult = aiGeneratedResultSchema.safeParse(pickedResult);
    if (!validatedResult.success) {
      return { success: false, result: "AIの結果を読み取れませんでした。" };
    }

    return { success: true, result: validatedResult.data };
  } catch (error) {
    logServerError(error, {
      action: "generateAiContent",
      userId: session.user.id,
      details: { mode: validatedMode },
    });
    return { success: false, result: "AI処理に失敗しました。" };
  }
}

function getStringProperty(value: unknown, key: string) {
  if (!isRecord(value)) return "";

  const result = value[key];
  return typeof result === "string" ? result : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);// 値がオブジェクトであり、nullでなく、配列でないことを確認します。これにより、AIからの応答が期待する形式になっているかをチェックします。
}
