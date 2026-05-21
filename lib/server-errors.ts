import { Prisma } from "@/app/generated/prisma";

type LogDetails = Record<string, boolean | number | string | null | undefined>;

type ServerErrorContext = {
  action: string;
  userId?: string;
  postId?: number;
  details?: LogDetails;
};

function serialize(value: unknown) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function normalizeError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      meta: serialize(error.meta),
      stack: error.stack,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

export function logServerError(error: unknown, context: ServerErrorContext) {
  console.error(
    JSON.stringify({
      level: "error",
      timestamp: new Date().toISOString(),
      context,
      error: normalizeError(error),
    }),
  );
}

export function getPublicErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return "対象のメモが見つからないか、操作する権限がありません。";
    }

    if (error.code === "P2002") {
      return "既に登録されているデータです。";
    }
  }

  return fallbackMessage;
}

export function throwLoggedActionError(
  error: unknown,
  context: ServerErrorContext,
  fallbackMessage: string,
): never {
  logServerError(error, context);//まず、エラーとそのコンテキストをログに記録しています。
  throw new Error(getPublicErrorMessage(error, fallbackMessage));//この行で、ログに記録されたエラーからユーザーに公開するメッセージを生成し、新しいエラーとしてスローしています。
}
