import { GoogleGenAI, Type } from "@google/genai";
import type { AnyAiMode } from "@/lib/ai-modes";

export class AiContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiContentError";
  }
}

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
    temperature: 0.2,
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
    temperature: 0.2,
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
    temperature: 0.2,
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
    temperature: 0.4,
    pick: (value: unknown) => getStringProperty(value, "content"),
  },
  improve: {
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
    temperature: 0.4,
    pick: (value: unknown) => getStringProperty(value, "content"),
  },
  ideas: {
    instruction:
      "以下のメモ本文をもとに、次に考えるとよいアイデアや行動案を日本語で3個から5個、短い箇条書きで提案してください。本文と無関係な内容は追加しないでください。",
    schema: {
      type: Type.OBJECT,
      properties: {
        ideas: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: ["ideas"],
      propertyOrdering: ["ideas"],
    },
    temperature: 0.35,
    pick: (value: unknown) => {
      if (!isRecord(value) || !Array.isArray(value.ideas)) return "";

      return value.ideas
        .filter((idea): idea is string => typeof idea === "string")
        .map((idea) => idea.trim())
        .filter(Boolean)
        .slice(0, 5)
        .map((idea) => `- ${idea}`)
        .join("\n");
    },
  },
} satisfies Record<
  AnyAiMode,
  {
    instruction: string;
    schema: object;
    temperature: number;
    pick: (value: unknown) => string;
  }
>;

export async function generateAiResult(content: string, mode: AnyAiMode) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiContentError("AI処理を利用できません。");
  }

  const config = modeConfigs[mode];
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${config.instruction}\n\n--- メモ本文 ---\n${content}`,
          },
        ],
      },
    ],
    config: {
      temperature: config.temperature,
      responseMimeType: "application/json",
      responseSchema: config.schema,
    },
  });

  const text = response.text;
  if (!text) {
    throw new AiContentError("AIから結果が返りませんでした。");
  }

  const result = config.pick(JSON.parse(text)).trim();
  if (!result) {
    throw new AiContentError("AIの結果を読み取れませんでした。");
  }

  return result;
}

function getStringProperty(value: unknown, key: string) {
  if (!isRecord(value)) return "";

  const result = value[key];
  return typeof result === "string" ? result : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
