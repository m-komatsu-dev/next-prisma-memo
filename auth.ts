import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-errors";
import { loginSchema } from "@/lib/zod";
import bcrypt from "bcrypt";

const googleClientId = process.env.AUTH_GOOGLE_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET;
const githubClientId = process.env.AUTH_GITHUB_ID;
const githubClientSecret = process.env.AUTH_GITHUB_SECRET;

type AuthLogDetails = Record<
  string,
  boolean | number | string | string[] | null | undefined
>;

function logAuthEvent(action: string, details: AuthLogDetails) {
  console.info(
    JSON.stringify({
      level: "info",
      timestamp: new Date().toISOString(),
      context: {
        action,
        details,
      },
    }),
  );
}

function getErrorCause(error: Error) {
  const cause = error.cause;

  if (!cause || typeof cause !== "object") {
    return {};
  }

  const causeRecord = cause as {
    err?: unknown;
    provider?: unknown;
    details?: unknown;
  };
  const err = causeRecord.err;
  const details = causeRecord.details;
  const parameters =
    details && typeof details === "object" && "parameters" in details
      ? (details as { parameters?: unknown }).parameters
      : undefined;

  return {
    causeName: err instanceof Error ? err.name : undefined,
    causeMessage: err instanceof Error ? err.message : undefined,
    provider:
      typeof causeRecord.provider === "string"
        ? causeRecord.provider
        : undefined,
    parameterKeys:
      parameters && typeof parameters === "object"
        ? Object.keys(parameters).join(",")
        : undefined,
  };
}

function getOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return "invalid-url";
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  basePath: "/api/auth",

  providers: [
    Google({
      clientId: googleClientId!,
      clientSecret: googleClientSecret!,
    }),
    GitHub({
      clientId: githubClientId!,
      clientSecret: githubClientSecret!,
    }),

    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        const validatedFields = loginSchema.safeParse(credentials);// 入力値が正しい形式か検証します。もし違う場合は、認証に失敗したことを示すために null を返します。
        if (!validatedFields.success) {
          return null;
        }

        const { email, password } = validatedFields.data;
        let user;

        try {
          user = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              password: true,
            },
          });
        } catch (error) {
          logServerError(error, {
            action: "authorizeCredentials",
            details: { provider: "credentials" },
          });
          return null;
        }

        if (!user || !user.password) return null;

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },

  callbacks: {
    async signIn({ account }) {
      logAuthEvent("authSignInCallback", {
        provider: account?.provider,
        providerType: account?.type,
      });

      return true;
    },

    async redirect({ url, baseUrl }) {
      const redirectUrl = url.startsWith("/") ? `${baseUrl}${url}` : url;
      const redirectOrigin = getOrigin(redirectUrl);
      const baseOrigin = getOrigin(baseUrl);

      logAuthEvent("authRedirect", {
        redirectOrigin,
        baseOrigin,
        sameOrigin: redirectOrigin === baseOrigin,
      });

      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (redirectOrigin === baseOrigin) return url;

      return baseUrl;
    },

    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },

  logger: {
    error(error) {
      logServerError(error, {
        action: "authError",
        details: {
          name: error.name,
          message: error.message,
          ...getErrorCause(error),
        },
      });
    },
    warn(code) {
      logAuthEvent("authWarning", { code });
    },
    debug(message, metadata) {
      if (process.env.AUTH_DEBUG !== "true") return;

      logAuthEvent("authDebug", {
        message,
        metadataType:
          metadata === null
            ? "null"
            : Array.isArray(metadata)
              ? "array"
              : typeof metadata,
      });
    },
  },
});
