import { auth } from "@/auth";
import PostForm from "@/components/post-form";
import { getPostEditorSelect, type PostEditorPost } from "@/lib/post-selects";
import { getEditablePostWhere, getPostAccessRole } from "@/lib/post-permissions";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-errors";
import { postIdValueSchema } from "@/lib/zod";
import { notFound, redirect } from "next/navigation";
import { autoSaveEditPost, saveEditPost } from "./actions";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Memo App - メモ編集",
  description: "既存のメモを編集するページです。タイトル、内容、タグ、公開設定を変更して、メモを更新できます。変更は自動保存されるので、安心して編集に集中できます。",
};

export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;
  const validatedPostId = postIdValueSchema.safeParse(id);

  if (!session?.user?.id) redirect("/");
  if (!validatedPostId.success) notFound();

  let post: PostEditorPost | null = null;

  try {
    post = await prisma.post.findFirst({
      where: getEditablePostWhere(validatedPostId.data, session.user.id),
      select: getPostEditorSelect(session.user.id),
    });
  } catch (error) {
    logServerError(error, {
      action: "loadPostEditor",
      userId: session.user.id,
      postId: validatedPostId.data,
    });
    throw new Error("メモの取得に失敗しました。");
  }

  if (!post) notFound();

  const accessRole = getPostAccessRole(post, session.user.id);

  return (
    <div className="post-editor-page">
      <PostForm
        canChangePublished={accessRole === "owner"}
        mode="edit"
        initialPost={{
          id: post.id,
          title: post.title,
          content: post.content,
          tags: post.tags.map((tag) => tag.name).join(", "),
          published: post.published,
          todoNowIso: new Date().toISOString(),
          todoItems: post.todoItems.map((todoItem) => ({
            completed: todoItem.completed,
            dueAt: todoItem.dueAt?.toISOString() ?? null,
            id: todoItem.id,
            position: todoItem.position,
            text: todoItem.text,
          })),
        }}
        autoSaveAction={autoSaveEditPost}
        saveAction={saveEditPost}
      />
    </div>
  );
}
