import * as SecureStore from "expo-secure-store";

import type { TokenStore } from "@vireo/shared/api";

const ACCESS_TOKEN_KEY = "finso.accessToken";
const REFRESH_TOKEN_KEY = "finso.refreshToken";

/**
 * Session tokens in the iOS Keychain / Android Keystore via expo-secure-store,
 * never in AsyncStorage: a refresh token is as good as the user's password.
 * Separate keys let the client read the refresh token without the other one.
 */
export const secureTokenStore: TokenStore = {
  getAccessToken: () => SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  async setTokens({ accessToken, refreshToken }) {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
    ]);
  },
  async clear() {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
  },
};
