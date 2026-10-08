/**
 * In-memory stand-in for expo-screen-capture. Tests read whether the app
 * asked the system to hide its preview in the app switcher (iOS: blur,
 * Android: FLAG_SECURE, which also blanks screenshots).
 */
let preventing = false;
let switcherProtection = false;

export const preventScreenCaptureAsync = jest.fn(() => {
  preventing = true;
  return Promise.resolve();
});

export const allowScreenCaptureAsync = jest.fn(() => {
  preventing = false;
  return Promise.resolve();
});

export const enableAppSwitcherProtectionAsync = jest.fn(() => {
  switcherProtection = true;
  return Promise.resolve();
});

export const disableAppSwitcherProtectionAsync = jest.fn(() => {
  switcherProtection = false;
  return Promise.resolve();
});

/** Whether the app switcher would show a hidden (blank or blurred) preview. */
export function previewHidden(): boolean {
  return preventing && switcherProtection;
}

/** Whether nothing is hidden any more. */
export function previewVisible(): boolean {
  return !preventing && !switcherProtection;
}

export function resetScreenCapture(): void {
  preventing = false;
  switcherProtection = false;
}
