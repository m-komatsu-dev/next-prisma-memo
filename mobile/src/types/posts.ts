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

export type MobileApiErrorResponse = {
  error: string;
};
