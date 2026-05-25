"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  addPostShare,
  revokePostShare,
  updatePostShare,
  type ShareActionState,
} from "./share-actions";

type SharedUser = {
  email: string;
  id: number;
  name: string | null;
  role: "viewer" | "editor";
};

type PostShareSettingsProps = {
  postId: number;
  shares: SharedUser[];
};

const initialShareActionState: ShareActionState = {
  message: "",
  status: "idle",
};

function ShareSubmitButton({
  children,
  danger = false,
}: {
  children: string;
  danger?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={danger ? "post-share-button post-share-button--danger" : "post-share-button"}
      disabled={pending}
      type="submit"
    >
      {pending ? "処理中..." : children}
    </button>
  );
}

function ShareActionMessage({ state }: { state: ShareActionState }) {
  if (!state.message) return null;

  return (
    <p
      className={
        state.status === "success"
          ? "post-share-message post-share-message--success"
          : "post-share-message post-share-message--error"
      }
    >
      {state.message}
    </p>
  );
}

function SharedUserRow({ postId, share }: { postId: number; share: SharedUser }) {
  const [updateState, updateAction] = useActionState(
    updatePostShare,
    initialShareActionState,
  );
  const [revokeState, revokeAction] = useActionState(
    revokePostShare,
    initialShareActionState,
  );

  return (
    <li className="post-share-row">
      <div className="post-share-user">
        <span className="post-share-user__name">{share.name ?? "名前未設定"}</span>
        <span className="post-share-user__email">{share.email}</span>
      </div>

      <div className="post-share-row__forms">
        <form action={updateAction} className="post-share-role-form">
          <input name="id" type="hidden" value={postId} />
          <input name="shareId" type="hidden" value={share.id} />
          <label>
            <span>権限</span>
            <select defaultValue={share.role} name="role">
              <option value="viewer">viewer</option>
              <option value="editor">editor</option>
            </select>
          </label>
          <ShareSubmitButton>更新</ShareSubmitButton>
        </form>

        <form action={revokeAction}>
          <input name="id" type="hidden" value={postId} />
          <input name="shareId" type="hidden" value={share.id} />
          <ShareSubmitButton danger>解除</ShareSubmitButton>
        </form>
      </div>

      <ShareActionMessage state={updateState} />
      <ShareActionMessage state={revokeState} />
    </li>
  );
}

export default function PostShareSettings({ postId, shares }: PostShareSettingsProps) {
  const [addState, addAction] = useActionState(
    addPostShare,
    initialShareActionState,
  );

  return (
    <section
      aria-labelledby="post-share-settings-title"
      className="post-share-panel"
      id="share-settings"
    >
      <div className="post-share-panel__header">
        <div>
          <p className="post-share-panel__eyebrow">Sharing</p>
          <h2 id="post-share-settings-title">共有設定</h2>
        </div>
        <span className="memo-badge memo-badge--shared">{shares.length} users</span>
      </div>

      <form action={addAction} className="post-share-add-form">
        <input name="id" type="hidden" value={postId} />
        <label>
          <span>メールアドレス</span>
          <input
            autoComplete="email"
            inputMode="email"
            name="email"
            placeholder="user@example.com"
            type="email"
          />
        </label>

        <label>
          <span>権限</span>
          <select defaultValue="viewer" name="role">
            <option value="viewer">viewer</option>
            <option value="editor">editor</option>
          </select>
        </label>

        <ShareSubmitButton>共有を追加</ShareSubmitButton>
      </form>

      <ShareActionMessage state={addState} />

      {shares.length === 0 ? (
        <p className="post-share-empty">まだ特定ユーザーには共有していません。</p>
      ) : (
        <ul className="post-share-list">
          {shares.map((share) => (
            <SharedUserRow key={share.id} postId={postId} share={share} />
          ))}
        </ul>
      )}
    </section>
  );
}
