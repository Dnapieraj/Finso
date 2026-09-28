/**
 * Polish UI copy. Kept in one module so other languages can be added later
 * without hunting for strings in components.
 */
export const pl = {
  start: {
    wordmark: "Finso",
    tagline: "Czy stać cię na to teraz?",
  },
  tabs: {
    start: "Start",
    settings: "Ustawienia",
  },
  fields: {
    email: "E-mail",
    password: "Hasło",
    showPassword: "Pokaż hasło",
    hidePassword: "Ukryj hasło",
  },
  login: {
    title: "Zaloguj się",
    submit: "Zaloguj się",
    submitting: "Logowanie…",
    toRegister: "Nie masz konta? Załóż je",
  },
  register: {
    title: "Załóż konto",
    passwordHint: (min: number) => `Co najmniej ${String(min)} znaków.`,
    submit: "Załóż konto",
    submitting: "Zakładanie konta…",
    toLogin: "Masz już konto? Zaloguj się",
  },
  /** Shown on the login screen after the session ended without the user asking. */
  signOutNotice: {
    expired: "Sesja wygasła. Zaloguj się ponownie.",
    deleted: "Konto i wszystkie dane zostały usunięte.",
  },
  settings: {
    title: "Ustawienia",
    account: "Konto",
    loadingAccount: "Wczytywanie danych konta",
    accountError: "Nie udało się wczytać danych konta.",
    retry: "Spróbuj ponownie",
    logout: "Wyloguj się",
    loggingOut: "Wylogowywanie…",
    deleteAccount: "Usuń konto",
  },
  // Wording must match apps/web/src/messages/legal/delete-account.ts:
  // Google Play requires the web page to describe this exact process.
  deleteAccount: {
    title: "Usuń konto",
    confirm: "Potwierdź hasłem, że to ty.",
    warning: "Konto i wszystkie dane zostaną usunięte od razu. Tego nie da się cofnąć.",
    submit: "Usuń konto na zawsze",
    submitting: "Usuwanie…",
    cancel: "Anuluj",
  },
  validation: {
    emailRequired: "Podaj adres e-mail.",
    emailInvalid: "Podaj poprawny adres e-mail.",
    passwordRequired: "Podaj hasło.",
    passwordTooShort: (min: number) => `Hasło musi mieć co najmniej ${String(min)} znaków.`,
    passwordTooLong: (max: number) => `Hasło może mieć najwyżej ${String(max)} znaków.`,
    invalid: "Nieprawidłowa wartość.",
  },
  apiErrors: {
    invalidCredentials: "Nieprawidłowy e-mail lub hasło.",
    emailTaken: "Konto z tym adresem e-mail już istnieje.",
    wrongPassword: "Nieprawidłowe hasło.",
    sessionExpired: "Sesja wygasła. Zaloguj się ponownie.",
    tooManyAttempts: "Za dużo prób. Odczekaj chwilę i spróbuj ponownie.",
    network: "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.",
    generic: "Coś poszło nie tak. Spróbuj ponownie.",
  },
} as const;
