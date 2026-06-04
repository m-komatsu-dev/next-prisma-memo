import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../app/generated/prisma/index.js";
import { Pool } from "pg";

export const E2E_DATA_PREFIX = "e2e-";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export function getE2eCredentials() {
  return {
    email: process.env.E2E_TEST_EMAIL?.trim().toLowerCase() ?? "",
    password: process.env.E2E_TEST_PASSWORD ?? "",
  };
}

export function shouldSkipE2eDatabaseSetup() {
  const { email, password } = getE2eCredentials();
  return !email || !password;
}

export function assertSafeE2eEmail(email: string) {
  if (!email.includes(E2E_DATA_PREFIX)) {
    throw new Error(
      "E2E_TEST_EMAIL must include 'e2e-' so setup/teardown cannot target a normal user.",
    );
  }
}

export async function cleanupE2eData(email = getE2eCredentials().email) {
  if (!email) {
    return;
  }

  assertSafeE2eEmail(email);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (user) {
    await prisma.post.deleteMany({
      where: {
        authorId: user.id,
        title: { startsWith: E2E_DATA_PREFIX },
      },
    });
  }

  await prisma.user.deleteMany({ where: { email } });
  await prisma.tag.deleteMany({ where: { name: { startsWith: E2E_DATA_PREFIX } } });
}

export async function ensureE2eUser() {
  const { email, password } = getE2eCredentials();

  if (!email || !password) {
    if (process.env.CI) {
      throw new Error("E2E_TEST_EMAIL and E2E_TEST_PASSWORD are required in CI.");
    }

    return;
  }

  assertSafeE2eEmail(email);
  await cleanupE2eData(email);

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email,
      name: "E2E Test User",
      password: passwordHash,
    },
  });
}

export async function disconnectE2eDb() {
  await prisma.$disconnect();
}
