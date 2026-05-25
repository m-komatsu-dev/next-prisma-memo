type MobileShareInput = {
  id: number;
  role: "viewer" | "editor";
  user: {
    email: string | null;
    name: string | null;
  };
  userId: string;
};

export function serializeMobilePostShare(share: MobileShareInput) {
  return {
    email: share.user.email ?? "メール未設定",
    id: share.id,
    name: share.user.name,
    role: share.role,
    userId: share.userId,
  };
}

export const mobilePostShareSelect = {
  id: true,
  role: true,
  userId: true,
  user: {
    select: {
      email: true,
      name: true,
    },
  },
} as const;
