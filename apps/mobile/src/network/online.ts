import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

/**
 * Offline only when the phone says so for sure: no network, or a network
 * without internet (Wi-Fi behind a login page). `null` means "not checked
 * yet" right after connecting; showing the bar for it would flash it on
 * every Wi-Fi change.
 */
export function isOnline(state: Pick<NetInfoState, "isConnected" | "isInternetReachable">) {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/**
 * TanStack Query learns about the network from NetInfo. Offline it pauses
 * requests instead of failing them, and back online it refetches what is
 * on screen and resumes paused saves — the "sama odświeża dane" part.
 */
export function connectNetworkToQueries(): void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(isOnline(state));
    }),
  );
}

/** Whether the app can reach the internet; re-renders when that changes. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (listener) => onlineManager.subscribe(listener),
    () => onlineManager.isOnline(),
  );
}
