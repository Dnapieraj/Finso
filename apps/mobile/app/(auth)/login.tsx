import { Link } from "expo-router";
import { Text } from "react-native";

import { loginSchema } from "@vireo/shared";

import { apiErrorMessage } from "../../src/auth/api-error-message";
import { CredentialsForm } from "../../src/auth/credentials-form";
import { useLogin } from "../../src/auth/hooks";
import { FormAlert } from "../../src/components/form-alert";
import { Screen } from "../../src/components/screen";
import { pl } from "../../src/messages/pl";
import { useSession } from "../../src/session";

const t = pl.login;

export default function LoginScreen() {
  const login = useLogin();
  const { signOutReason } = useSession();
  // A logout is the user's own choice; only a session that ended on its
  // own (expired, deleted account) needs explaining.
  const notice =
    signOutReason === "expired" || signOutReason === "deleted"
      ? pl.signOutNotice[signOutReason]
      : null;

  return (
    <Screen title={t.title}>
      <CredentialsForm
        schema={loginSchema}
        passwordAutoComplete="current-password"
        submitLabel={t.submit}
        submittingLabel={t.submitting}
        pending={login.isPending}
        error={login.error ? apiErrorMessage(login.error, "login") : null}
        notice={
          notice ? (
            <FormAlert tone={signOutReason === "expired" ? "error" : "info"}>{notice}</FormAlert>
          ) : null
        }
        onSubmit={(credentials) => login.mutate(credentials)}
      />
      <Link href="/register" replace className="self-center py-3">
        <Text className="font-sans-semibold text-base text-primary">{t.toRegister}</Text>
      </Link>
    </Screen>
  );
}
