export type MobileAuthUser = {
  id: string;
  name: string | null;
  email: string | null;
};

export type MobileLoginResponse = {
  accessToken: string;
  user: MobileAuthUser;
};
