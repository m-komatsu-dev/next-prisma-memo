import { prisma } from "@/lib/prisma";

export type DeletedAccountDataCounts = {
  accounts: number;
  posts: number;
  sessions: number;
  user: number;
};

export async function deleteAccountData(userId: string) {
  return prisma.$transaction(async (tx) => {
    const [accounts, posts, sessions, user] = await Promise.all([
      tx.account.count({ where: { userId } }),
      tx.post.count({ where: { authorId: userId } }),
      tx.session.count({ where: { userId } }),
      tx.user.count({ where: { id: userId } }),
    ]);

    if (user === 0) {
      return null;
    }

    await tx.user.delete({
      where: { id: userId },
    });

    return {
      accounts,
      posts,
      sessions,
      user,
    } satisfies DeletedAccountDataCounts;
  });
}
