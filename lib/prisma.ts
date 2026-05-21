import { PrismaClient } from "../app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;//この行は、グローバルオブジェクトに `prisma` プロパティが存在する可能性があることを示しています。これにより、同じ PrismaClient インスタンスを再利用することができます。
  prismaPool?: Pool;//この行は、グローバルオブジェクトに `prismaPool` プロパティが存在する可能性があることを示しています。これにより、同じ PostgreSQL 接続プールを再利用することができます。
};

const configuredPoolMax = Number(process.env.DATABASE_POOL_MAX);
const poolMax =
  Number.isInteger(configuredPoolMax) && configuredPoolMax > 0
    ? configuredPoolMax
    : process.env.NODE_ENV === "production"
      ? 1
      : 5;

const pool =
  globalForPrisma.prismaPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: poolMax,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

globalForPrisma.prisma = prisma;
globalForPrisma.prismaPool = pool;
