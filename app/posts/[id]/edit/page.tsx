import { auth } from "@/auth";
import PostForm from "@/components/post-form";
import { postEditorSelect, type PostEditorPost } from "@/lib/post-selects";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-errors";
import { postIdValueSchema } from "@/lib/zod";
import { notFound, redirect } from "next/navigation";
import { autoSaveEditPost, saveEditPost } from "./actions";

export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;
  const validatedPostId = postIdValueSchema.safeParse(id);

  if (!session?.user?.id) redirect("/");
  if (!validatedPostId.success) notFound();

  let post: PostEditorPost | null = null;

  try {
    post = await prisma.post.findFirst({
      where: { id: validatedPostId.data, authorId: session.user.id },
      select: postEditorSelect,
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

  return (
    <div className="post-editor-page">
      <PostForm
        mode="edit"
        initialPost={{
          id: post.id,
          title: post.title,
          content: post.content,
          tags: post.tags.map((tag) => tag.name).join(", "),
          published: post.published,
        }}
        autoSaveAction={autoSaveEditPost}
        saveAction={saveEditPost}
      />
    </div>
  );
}
