/**
 * In-memory stand-in for expo-local-authentication: Face ID, the
 * fingerprint sensor and the phone's own code screen do not exist under
 * Jest. Tests set what the phone has enrolled and how the system prompt
 * ends; the app only ever learns that result, never the biometrics.
 */
export enum SecurityLevel {
  NONE = 0,
  SECRET = 1,
  BIOMETRIC_WEAK = 2,
  BIOMETRIC_STRONG = 3,
}

type Result = { success: true } | { success: false; error: string };

let level = SecurityLevel.BIOMETRIC_STRONG;
let answers: Result[] = [];
/** A prompt the test keeps open, to act while the system dialog is up. */
let held: ((result: Result) => void) | null = null;
let holdNext = false;

export const getEnrolledLevelAsync = jest.fn(() => Promise.resolve(level));

export const authenticateAsync = jest.fn((_options?: Record<string, unknown>) => {
  if (holdNext) {
    holdNext = false;
    return new Promise<Result>((resolve) => {
      held = resolve;
    });
  }
  return Promise.resolve(answers.shift() ?? { success: true });
});

export const cancelAuthenticate = jest.fn(() => Promise.resolve());

/** What the phone has set up: NONE — no biometrics and no screen lock code. */
export function setEnrolledLevel(next: SecurityLevel): void {
  level = next;
}

/** How the next system prompts end, in order; afterwards they succeed. */
export function answerPromptWith(...next: ("success" | "user_cancel" | "not_enrolled")[]): void {
  answers = next.map((answer) =>
    answer === "success" ? { success: true } : { success: false, error: answer },
  );
}

/** The next prompt stays open until `finishHeldPrompt`. */
export function holdNextPrompt(): void {
  holdNext = true;
}

export function finishHeldPrompt(answer: "success" | "user_cancel"): void {
  held?.(answer === "success" ? { success: true } : { success: false, error: answer });
  held = null;
}

/** Back to a phone with a fingerprint and a code; call in `beforeEach`. */
export function resetLocalAuthentication(): void {
  level = SecurityLevel.BIOMETRIC_STRONG;
  answers = [];
  held = null;
  holdNext = false;
}
