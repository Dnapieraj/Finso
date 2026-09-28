import type { DeleteAccountInput, LoginInput, PublicUser, RegisterInput } from "@vireo/shared";
import type { ApiClient } from "@vireo/shared/api";

export const testUser: PublicUser = {
  id: "01923b6e-0000-7000-8000-000000000001",
  email: "ola@example.com",
  plan: "FREE",
  currency: "PLN",
  timezone: "Europe/Warsaw",
  periodStartDay: 10,
};

/**
 * Stand-in for `src/api`, mocked in screen tests. The real client
 * (refresh, token storage, schema validation) is covered by the
 * @vireo/shared tests; here only the screens' reactions matter.
 */
export const fakeApi = {
  auth: {
    register: jest.fn((_input: RegisterInput) => Promise.resolve(testUser)),
    login: jest.fn((_input: LoginInput) => Promise.resolve(testUser)),
    logout: jest.fn(() => Promise.resolve()),
  },
  users: {
    me: jest.fn(() => Promise.resolve(testUser)),
    deleteMe: jest.fn((_input: DeleteAccountInput) => Promise.resolve()),
  },
} satisfies ApiClient;

/** A promise that never settles — for asserting what a screen shows while waiting. */
export function pending<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}
