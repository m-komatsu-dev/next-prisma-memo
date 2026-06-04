import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-errors";
import { loginSchema } from "@/lib/zod";
import bcrypt from "bcrypt";

export type CredentialsAuthUser = {
  email: string | null;
  id: string;
  image?: string | null;
  name: string | null;
};

export async function verifyCredentialsUser(credentials: unknown) {
  const validatedFields = loginSchema.safeParse(credentials);

  if (!validatedFields.success) {
    return null;
  }

  const { email, password } = validatedFields.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        email: true,
        id: true,
        image: true,
        name: true,
        password: true,
      },
    });

    if (!user?.password) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return null;
    }

    return {
      email: user.email,
      id: user.id,
      image: user.image,
      name: user.name,
    } satisfies CredentialsAuthUser;
  } catch (error) {
    logServerError(error, {
      action: "verifyCredentialsUser",
      details: { provider: "credentials" },
    });
    return null;
  }
}
