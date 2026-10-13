import { onlineManager } from "@tanstack/react-query";
import { act } from "expo-router/testing-library";

/**
 * In-memory stand-in for @react-native-community/netinfo, mocked globally
 * in jest.setup.js. Tests switch the network the way the phone reports it.
 */
export interface FakeNetworkState {
  isConnected: boolean | null;
  /** `null` while the phone has not checked yet (right after connecting). */
  isInternetReachable: boolean | null;
}

type Listener = (state: FakeNetworkState & { type: string }) => void;

const ONLINE: FakeNetworkState = { isConnected: true, isInternetReachable: true };

let state: FakeNetworkState = ONLINE;
const listeners = new Set<Listener>();

const snapshot = () => ({ ...state, type: state.isConnected ? "wifi" : "none" });

function notify() {
  for (const listener of [...listeners]) listener(snapshot());
}

const NetInfo = {
  // Like the real module: a new listener hears the current state right away.
  addEventListener: jest.fn((listener: Listener) => {
    listeners.add(listener);
    listener(snapshot());
    return () => {
      listeners.delete(listener);
    };
  }),
  fetch: jest.fn(() => Promise.resolve(snapshot())),
};

export default NetInfo;

/** Changes the network and tells every listener, as the phone would. */
export async function setNetwork(change: Partial<FakeNetworkState>): Promise<void> {
  await act(async () => {
    state = { ...state, ...change };
    notify();
    await Promise.resolve();
  });
}

export const goOffline = () => setNetwork({ isConnected: false, isInternetReachable: false });
export const goOnline = () => setNetwork(ONLINE);

/**
 * Online for the next test. Unmounting the previous test's app also
 * unsubscribed TanStack Query from the network, so its last answer
 * (possibly "offline") would stay; on a device the app never unmounts.
 */
export function resetNetInfo(): void {
  state = ONLINE;
  notify();
  onlineManager.setOnline(true);
}
