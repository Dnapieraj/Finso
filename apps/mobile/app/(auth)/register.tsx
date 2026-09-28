import { Link } from "expo-router";
import { Text, View } from "react-native";

import { PASSWORD_MIN_LENGTH, registerSchema } from "@vireo/shared";

import { apiErrorMessage } from "../../src/auth/api-error-message";
import { AuthScreen } from "../../src/auth/auth-screen";
import { CredentialsForm } from "../../src/auth/credentials-form";
import { useRegister } from "../../src/auth/hooks";
import { pl } from "../../src/messages/pl";

const t = pl.register;

export default function RegisterScreen() {
  const register = useRegister();

  return (
    <AuthScreen title={t.title}>
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
      <View className="items-center">
        <Link href="/login" replace className="py-3">
          <Text className="font-sans-semibold text-base text-primary">{t.toLogin}</Text>
        </Link>
      </View>
    </AuthScreen>
  );
}
