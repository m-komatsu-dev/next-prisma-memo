import type {
  MobilePostShareResponse,
  MobilePostSharesResponse,
  MobilePostShareRole,
} from "../../types/posts";
import {
  getErrorMessage,
  MobileApiRequestError,
  readNormalizedArrayField,
  readNormalizedObjectField,
  requestMobileApi,
} from "./client";
import { isMobilePostShare } from "./normalizers";

export async function fetchMobilePostShares(accessToken: string, postId: number) {
  const { data, response } = await requestMobileApi(
    `/api/mobile/posts/${postId}/shares`,
    accessToken,
  );

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "共有設定の取得に失敗しました。"),
      response.status,
    );
  }

  const shares = readNormalizedArrayField(data, "shares", (share) =>
    isMobilePostShare(share) ? share : null,
  );

  if (!shares) {
    throw new Error("共有設定のレスポンス形式が正しくありません。");
  }

  return shares as MobilePostSharesResponse["shares"];
}

export async function createMobilePostShare(
  accessToken: string,
  postId: number,
  payload: { email: string; role: MobilePostShareRole },
) {
  const { data, response } = await requestMobileApi(
    `/api/mobile/posts/${postId}/shares`,
    accessToken,
    {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "共有設定の追加に失敗しました。"),
      response.status,
    );
  }

  const share = readNormalizedObjectField(data, "share", (value) =>
    isMobilePostShare(value) ? value : null,
  );

  if (!share) {
    throw new Error("共有設定追加のレスポンス形式が正しくありません。");
  }

  return share as MobilePostShareResponse["share"];
}

export async function updateMobilePostShare(
  accessToken: string,
  postId: number,
  shareId: number,
  role: MobilePostShareRole,
) {
  const { data, response } = await requestMobileApi(
    `/api/mobile/posts/${postId}/shares/${shareId}`,
    accessToken,
    {
      body: JSON.stringify({ role }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    },
  );

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "共有権限の更新に失敗しました。"),
      response.status,
    );
  }

  const share = readNormalizedObjectField(data, "share", (value) =>
    isMobilePostShare(value) ? value : null,
  );

  if (!share) {
    throw new Error("共有権限更新のレスポンス形式が正しくありません。");
  }

  return share as MobilePostShareResponse["share"];
}

export async function deleteMobilePostShare(
  accessToken: string,
  postId: number,
  shareId: number,
) {
  const { data, response } = await requestMobileApi(
    `/api/mobile/posts/${postId}/shares/${shareId}`,
    accessToken,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "共有解除に失敗しました。"),
      response.status,
    );
  }
}
