import type {
  MobilePostPayload,
  MobilePostResponse,
  MobilePostsResponse,
} from "../../types/posts";
import {
  buildListQuery,
  getErrorMessage,
  getResponseFormatError,
  type MobileListOptions,
  MobileApiRequestError,
  readDirectNormalizedArray,
  readNormalizedArrayField,
  readNormalizedObjectField,
  requestMobileApi,
} from "./client";
import { normalizeMobilePost } from "./normalizers";

export async function fetchMobilePostsForFallback(
  accessToken: string,
  options?: MobileListOptions,
) {
  const apiResponse = await requestMobileApi(
    `/api/mobile/posts${buildListQuery(options)}`,
    accessToken,
  );
  const { data, response } = apiResponse;

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "メモ一覧の取得に失敗しました。"),
      response.status,
    );
  }

  const posts =
    readNormalizedArrayField(data, "posts", normalizeMobilePost) ??
    readNormalizedArrayField(data, "data", normalizeMobilePost) ??
    readDirectNormalizedArray(data, normalizeMobilePost);

  if (!posts) {
    throw getResponseFormatError("メモ一覧", apiResponse);
  }

  return posts as MobilePostsResponse["posts"];
}

export async function fetchMobilePosts(
  accessToken: string,
  options?: MobileListOptions,
) {
  return fetchMobilePostsForFallback(accessToken, options);
}

export async function fetchMobilePost(accessToken: string, postId: number) {
  const apiResponse = await requestMobileApi(
    `/api/mobile/posts/${postId}`,
    accessToken,
  );
  const { data, response } = apiResponse;

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "メモの取得に失敗しました。"),
      response.status,
    );
  }

  const post =
    readNormalizedObjectField(data, "post", normalizeMobilePost) ??
    readNormalizedObjectField(data, "data", normalizeMobilePost);

  if (!post) {
    throw getResponseFormatError("メモ詳細", apiResponse);
  }

  return post as MobilePostResponse["post"];
}

export async function createMobilePost(
  accessToken: string,
  payload: MobilePostPayload,
) {
  const apiResponse = await requestMobileApi(
    "/api/mobile/posts",
    accessToken,
    {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  const { data, response } = apiResponse;

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "メモの作成に失敗しました。"),
      response.status,
    );
  }

  const post =
    readNormalizedObjectField(data, "post", normalizeMobilePost) ??
    readNormalizedObjectField(data, "data", normalizeMobilePost);

  if (!post) {
    throw getResponseFormatError("メモ作成", apiResponse);
  }

  return post as MobilePostResponse["post"];
}

export async function updateMobilePost(
  accessToken: string,
  postId: number,
  payload: MobilePostPayload,
) {
  const apiResponse = await requestMobileApi(
    `/api/mobile/posts/${postId}`,
    accessToken,
    {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    },
  );
  const { data, response } = apiResponse;

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "メモの更新に失敗しました。"),
      response.status,
    );
  }

  const post =
    readNormalizedObjectField(data, "post", normalizeMobilePost) ??
    readNormalizedObjectField(data, "data", normalizeMobilePost);

  if (!post) {
    throw getResponseFormatError("メモ更新", apiResponse);
  }

  return post as MobilePostResponse["post"];
}

export async function deleteMobilePost(accessToken: string, postId: number) {
  const { data, response } = await requestMobileApi(
    `/api/mobile/posts/${postId}`,
    accessToken,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new MobileApiRequestError(
      response.status === 401
        ? "ログインが必要です。"
        : getErrorMessage(data, "メモの削除に失敗しました。"),
      response.status,
    );
  }
}
