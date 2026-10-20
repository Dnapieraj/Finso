import { Link, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

import { loginSchema } from "@vireo/shared";

import { apiErrorMessage } from "../../src/auth/api-error-message";
import { AuthScreen } from "../../src/auth/auth-screen";
import { CredentialsForm } from "../../src/auth/credentials-form";
import { useLogin } from "../../src/auth/hooks";
import { FormAlert } from "../../src/components/form-alert";
import { pl } from "../../src/messages/pl";
import { useSession } from "../../src/session";

const t = pl.login;

export default function LoginScreen() {
  const login = useLogin();
  const { signOutReason } = useSession();
  // A logout is the user's own choice; only a session that ended on its
  // own (expired, deleted account) needs explaining.
  const signOutNotice =
    signOutReason === "expired" || signOutReason === "deleted"
      ? pl.signOutNotice[signOutReason]
      : null;
  // Back from „Nie pamiętam hasła” with a new password.
  const { passwordReset } = useLocalSearchParams<{ passwordReset?: string }>();
  const notice = passwordReset ? t.passwordReset : signOutNotice;

  return (
    <AuthScreen title={t.title}>
      <CredentialsForm
        schema={loginSchema}
        passwordAutoComplete="current-password"
        submitLabel={t.submit}
        submittingLabel={t.submitting}
        pending={login.isPending}
        error={login.error ? apiErrorMessage(login.error, "login") : null}
        notice={
          notice ? (
            <FormAlert tone={!passwordReset && signOutReason === "expired" ? "error" : "info"}>
              {notice}
            </FormAlert>
          ) : null
        }
        onSubmit={(credentials) => {
          login.mutate(credentials);
        }}
      />
      <View className="items-center">
        <Link href="/forgot-password" className="py-3">
          <Text className="font-sans-semibold text-base text-primary">{t.forgotPassword}</Text>
        </Link>
        <Link href="/register" replace className="py-3">
          <Text className="font-sans-semibold text-base text-primary">{t.toRegister}</Text>
        </Link>
      </View>
    </AuthScreen>
  );
}
