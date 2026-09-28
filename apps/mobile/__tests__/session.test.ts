import type { AuthTokens } from "@vireo/shared";
import type { TokenStore } from "@vireo/shared/api";

import { createSessionStore } from "../src/session";

const tokens: AuthTokens = { accessToken: "access", refreshToken: "refresh", accessTokenExpiresIn: 900 };

function memoryTokens(saved: AuthTokens | null = null) {
  const store: TokenStore & { saved: AuthTokens | null } = {
    saved,
    getAccessToken: () => Promise.resolve(store.saved?.accessToken ?? null),
    getRefreshToken: () => Promise.resolve(store.saved?.refreshToken ?? null),
    setTokens: (next) => {
      store.saved = next;
      return Promise.resolve();
    },
    clear: () => {
      store.saved = null;
      return Promise.resolve();
    },
  };
  return store;
}

function setup(saved: AuthTokens | null = null) {
  const store = memoryTokens(saved);
  const onSignedOut = jest.fn();
  const session = createSessionStore({ tokens: store, onSignedOut });
  return { session, store, onSignedOut };
}

it("starts in 'restoring' so the app can keep the splash screen up", () => {
  const { session } = setup();

  expect(session.getState()).toEqual({ status: "restoring", signOutReason: null });
});

it("restores a signed-in session from a saved refresh token", async () => {
  const { session } = setup(tokens);

  await session.restore();

  expect(session.getState()).toEqual({ status: "signed-in", signOutReason: null });
});

it("restores to signed-out when nothing is saved", async () => {
  const { session } = setup(null);

  await session.restore();

  expect(session.getState()).toEqual({ status: "signed-out", signOutReason: null });
});

// Android can lose the Keystore key (e.g. after restoring a backup), so
// reading fails instead of returning null. The user logs in again; the app
// must not crash or hang on the splash screen.
it("treats an unreadable secure store as signed-out and wipes it", async () => {
  const { session, store } = setup(tokens);
  store.getRefreshToken = () => Promise.reject(new Error("Could not decrypt"));

  await session.restore();

  expect(session.getState()).toEqual({ status: "signed-out", signOutReason: null });
  expect(store.saved).toBeNull();
});

it("signedIn() switches to signed-in and forgets the last sign-out reason", async () => {
  const { session } = setup();
  await session.signedOut("expired");

  session.signedIn();

  expect(session.getState()).toEqual({ status: "signed-in", signOutReason: null });
});

it.each(["logout", "expired", "deleted"] as const)(
  "signedOut('%s') records the reason, clears cached data and wipes the tokens",
  async (reason) => {
    const { session, store, onSignedOut } = setup(tokens);
    session.signedIn();

    await session.signedOut(reason);

    expect(session.getState()).toEqual({ status: "signed-out", signOutReason: reason });
    expect(onSignedOut).toHaveBeenCalledOnce();
    // Defence in depth: the API client clears them too, but a restart must
    // never bring back a session the user has left.
    expect(store.saved).toBeNull();
  },
);

it("notifies subscribers on every change and stops after unsubscribe", async () => {
  const { session } = setup(tokens);
  const listener = jest.fn();
  const unsubscribe = session.subscribe(listener);

  await session.restore();
  expect(listener).toHaveBeenCalled();

  listener.mockClear();
  unsubscribe();
  session.signedIn();
  expect(listener).not.toHaveBeenCalled();
});
