import { auth } from "@/auth";
import { redirect } from "next/navigation";
import NewPostForm from "./new-post-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Memo App - 新しいメモ",
  description: "新しいメモを作成するページです。タイトル、内容、タグを入力して、すぐにメモを保存できます。公開設定もここで管理できます。",
};

export default async function NewPostPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  return (
    <div className="post-editor-page">
      <NewPostForm />
    </div>
  );
}
