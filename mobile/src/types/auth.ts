export type MobileAuthUser = {
  id: string;
  name: string | null;
  email: string | null;
};

export type MobileLoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: MobileAuthUser;
};

export type MobileTokenResponse = {
  accessToken: string;
  refreshToken: string;
};

export type StoredAuthTokens = MobileTokenResponse;
