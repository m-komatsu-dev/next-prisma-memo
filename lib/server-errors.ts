import { Prisma } from "@/app/generated/prisma";

type LogDetails = Record<string, boolean | number | string | null | undefined>;

type ServerErrorContext = {
  action: string;
  userId?: string;
  postId?: number;
  details?: LogDetails;
};

const REDACTED = "[redacted]";
const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|token|secret|password|api[-_]?key|database[_-]?url|direct[_-]?url|connection|credential)/i;
const SENSITIVE_VALUE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /postgres(?:ql)?:\/\/[^\s"'<>]+/gi,
  /mysql:\/\/[^\s"'<>]+/gi,
  /mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi,
  /AIza[0-9A-Za-z_-]{20,}/g,
  /(?:AUTH|MOBILE_AUTH|GEMINI|GOOGLE|GITHUB|EXPO|CRON|DATABASE|DIRECT)[A-Z0-9_]*\s*=\s*["']?[^"'\s]+/gi,
];

function redactString(value: string) {
  return SENSITIVE_VALUE_PATTERNS.reduce(
    (redacted, pattern) => redacted.replace(pattern, REDACTED),
    value,
  );
}

function sanitizeForLog(value: unknown): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeForLog);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : sanitizeForLog(nestedValue),
    ]),
  );
}

function serialize(value: unknown) {
  try {
    return sanitizeForLog(JSON.parse(JSON.stringify(value)));
  } catch {
    return redactString(String(value));
  }
}

function normalizeError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      name: error.name,
      message: redactString(error.message),
      code: error.code,
      meta: serialize(error.meta),
      stack: error.stack ? redactString(error.stack) : undefined,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactString(error.message),
      stack: error.stack ? redactString(error.stack) : undefined,
    };
  }

  return {
    name: "UnknownError",
    message: redactString(String(error)),
  };
}

export function logServerError(error: unknown, context: ServerErrorContext) {
  console.error(
    JSON.stringify({
      level: "error",
      timestamp: new Date().toISOString(),
      context: sanitizeForLog(context),
      error: normalizeError(error),
    }),
  );
}

export function getPublicErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return "対象のメモが見つからないか、操作する権限がありません。";
    }

    if (error.code === "P2002") return fallbackMessage;
  }

  return fallbackMessage;
}

export function isPrismaUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function isRedirectError(error: unknown) {
  if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
    return true;
  }

  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }

  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

export function throwLoggedActionError(
  error: unknown,
  context: ServerErrorContext,
  fallbackMessage: string,
): never {
  logServerError(error, context);//まず、エラーとそのコンテキストをログに記録しています。
  throw new Error(getPublicErrorMessage(error, fallbackMessage));//この行で、ログに記録されたエラーからユーザーに公開するメッセージを生成し、新しいエラーとしてスローしています。
}
