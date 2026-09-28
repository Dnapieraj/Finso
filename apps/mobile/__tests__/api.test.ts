import { createApiClient } from "@vireo/shared/api";

import "../src/api";
import { session } from "../src/session";

jest.mock("@vireo/shared/api", () => ({ createApiClient: jest.fn(() => ({})) }));

// Read at import time: `clearMocks` wipes call history before each test.
const firstCall = jest.mocked(createApiClient).mock.calls[0];
if (!firstCall) throw new Error("src/api.ts did not create the API client");
const [options] = firstCall;

it("ends the session with reason 'expired' when the API client gives up on refreshing", () => {
  session.signedIn();

  options.onSessionExpired?.();

  // Synchronous on purpose: the guards redirect to login on the same render.
  expect(session.getState()).toEqual({ status: "signed-out", signOutReason: "expired" });
});
