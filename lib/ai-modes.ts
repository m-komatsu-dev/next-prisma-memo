export const AI_MODES = ["summarize", "title", "tags", "rewrite"] as const;
export const MOBILE_AI_MODES = [...AI_MODES, "improve", "ideas"] as const;

export type AiMode = (typeof AI_MODES)[number];
export type MobileAiMode = (typeof MOBILE_AI_MODES)[number];
export type AnyAiMode = MobileAiMode;
