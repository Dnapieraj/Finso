import { createContext, useContext } from "react";

import type { PublicUser } from "@vireo/shared";

const AccountContext = createContext<PublicUser | null>(null);

/** Provided by the app's layout once the account has loaded. */
export const AccountProvider = AccountContext.Provider;

/**
 * The signed-in account. Screens inside the app never see it loading or
 * failing: the app's layout shows those states before any screen opens.
 */
export function useAccount(): PublicUser {
  const account = useContext(AccountContext);
  if (!account) throw new Error("useAccount outside the signed-in app");
  return account;
}
