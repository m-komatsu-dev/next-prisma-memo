export type MobilePostTag = {
  id: number;
  name: string;
};

export type MobilePost = {
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
