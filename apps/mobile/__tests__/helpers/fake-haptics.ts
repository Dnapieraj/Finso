/**
 * In-memory stand-in for expo-haptics, mocked globally in jest.setup.js:
 * there is no vibration motor under Jest. Tests read what the phone would
 * have felt, e.g. ["impact:light", "notification:error"].
 */
export const ImpactFeedbackStyle = {
  Light: "light",
  Medium: "medium",
  Heavy: "heavy",
  Soft: "soft",
  Rigid: "rigid",
} as const;

export const NotificationFeedbackType = {
  Success: "success",
  Warning: "warning",
  Error: "error",
} as const;

let felt: string[] = [];
let broken = false;

function feel(event: string): Promise<void> {
  if (broken) return Promise.reject(new Error("No vibration motor"));
  felt.push(event);
  return Promise.resolve();
}

export const impactAsync = jest.fn((style: string = ImpactFeedbackStyle.Medium) =>
  feel(`impact:${style}`),
);

export const notificationAsync = jest.fn((type: string = NotificationFeedbackType.Success) =>
  feel(`notification:${type}`),
);

export const selectionAsync = jest.fn(() => feel("selection"));

/** Every vibration since the test started, in order. */
export function hapticsFelt(): string[] {
  return [...felt];
}

/** A phone without a vibration motor (or with it off): every call rejects. */
export function breakHaptics(): void {
  broken = true;
}

export function resetHaptics(): void {
  felt = [];
  broken = false;
}
