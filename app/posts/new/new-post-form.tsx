import PostForm from "@/components/post-form";
import { autoSaveNewPost, saveNewPost } from "./actions";

export default function NewPostForm() {
  return <PostForm mode="new" autoSaveAction={autoSaveNewPost} saveAction={saveNewPost} />;
}
