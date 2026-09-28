import { Link } from "expo-router";
import { Text } from "react-native";

import { PASSWORD_MIN_LENGTH, registerSchema } from "@vireo/shared";

import { apiErrorMessage } from "../../src/auth/api-error-message";
import { CredentialsForm } from "../../src/auth/credentials-form";
import { useRegister } from "../../src/auth/hooks";
import { Screen } from "../../src/components/screen";
import { pl } from "../../src/messages/pl";

const t = pl.register;

export default function RegisterScreen() {
  const register = useRegister();

  return (
    <Screen title={t.title}>
      <CredentialsForm
        schema={registerSchema}
        // Stated up front rather than only after a failed attempt.
        passwordHint={t.passwordHint(PASSWORD_MIN_LENGTH)}
        passwordAutoComplete="new-password"
        submitLabel={t.submit}
        submittingLabel={t.submitting}
        pending={register.isPending}
        error={register.error ? apiErrorMessage(register.error, "register") : null}
        onSubmit={(credentials) => register.mutate(credentials)}
      />
      <Link href="/login" replace className="self-center py-3">
        <Text className="font-sans-semibold text-base text-primary">{t.toLogin}</Text>
      </Link>
    </Screen>
  );
}
