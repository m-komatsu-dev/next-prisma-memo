import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "my-memo-mobile-access-token";

export async function getStoredAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function saveAccessToken(accessToken: string) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
}

export async function deleteStoredAccessToken() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}
