import { auth } from "@/auth";
import { redirect } from "next/navigation";
import NewPostForm from "./new-post-form";

export default async function NewPostPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  return (
    <div className="post-editor-page">
      <NewPostForm />
    </div>
  );
}
