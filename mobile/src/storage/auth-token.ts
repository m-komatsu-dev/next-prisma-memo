import * as SecureStore from "expo-secure-store";
import type { StoredAuthTokens } from "../types/auth";

const ACCESS_TOKEN_KEY = "my-memo-mobile-access-token";
const REFRESH_TOKEN_KEY = "my-memo-mobile-refresh-token";

export async function getStoredAuthTokens(): Promise<StoredAuthTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
}

export async function saveAuthTokens(tokens: StoredAuthTokens) {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

export async function deleteStoredAuthTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}
