export type MobilePostTag = {
  id: number;
  name: string;
};

export type MobilePost = {
  accessRole: "owner" | "editor" | "viewer" | "public";
  authorId: string;
  id: number;
  title: string;
  content: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  tags: MobilePostTag[];
};

export type MobilePostsResponse = {
  posts: MobilePost[];
};

export type MobilePostResponse = {
  post: MobilePost;
};

export type MobilePostPayload = {
  title: string;
  content: string;
  tags: string;
  published: boolean;
};

export type MobilePostShareRole = "viewer" | "editor";

export type MobilePostShare = {
  email: string;
  id: number;
  name: string | null;
  role: MobilePostShareRole;
  userId: string;
};

export type MobilePostSharesResponse = {
  shares: MobilePostShare[];
};

export type MobilePostShareResponse = {
  share: MobilePostShare;
};

export type MobileApiErrorResponse = {
  error: string;
};

export type MobileAiMode =
  | "summarize"
  | "title"
  | "tags"
  | "rewrite"
  | "improve"
  | "ideas";

export type MobileAiGenerateResponse = {
  result: string;
};
