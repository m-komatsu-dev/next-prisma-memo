export type MobilePostTag = {
  id: number;
  name: string;
};

export type MobileTodoItem = {
  completed: boolean;
  createdAt: string;
  dueAt: string | null;
  id: number;
  position: number;
  postId: number;
  reminderAt: string | null;
  reminderSentAt: string | null;
  text: string;
  updatedAt: string;
};

export type MobileCrossMemoTodoItem = MobileTodoItem & {
  canEdit: boolean;
  postTitle: string;
};

export type MobilePost = {
  accessRole: "owner" | "editor" | "viewer" | "public";
  authorId: string;
  id: number;
  title: string;
  content: string;
  todoItems?: MobileTodoItem[];
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

export type MobileTodoItemPayload = {
  completed?: boolean;
  dueAt?: string | null;
  reminderAt?: string | null;
  text?: string;
};

export type MobileTodoItemsResponse = {
  todoItems: MobileTodoItem[];
};

export type MobileTodoItemResponse = {
  todoItem: MobileTodoItem;
};

export type MobileCrossMemoTodoItemsResponse = {
  todos: MobileCrossMemoTodoItem[];
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
