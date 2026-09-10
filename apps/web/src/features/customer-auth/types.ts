export type Locale = "vi" | "en";
export type AuthMode = "login" | "register" | "forgot-password" | "reset-password" | "verify-email";

export type AuthConfig = {
  enabled: boolean;
  emailEnabled: boolean;
  oauth: { google: boolean; facebook: boolean };
};

export type CustomerSession = {
  account: {
    id: string;
    customerId: string;
    email: string | null;
    fullName: string;
    emailVerified: boolean;
  };
  expiresAt: string;
};

export type ApiEnvelope<T> =
  | { version: "v1"; data: T }
  | { version: "v1"; error: { code: string; message: string } };
