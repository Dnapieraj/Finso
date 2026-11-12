import { Link } from "expo-router";
import { Linking, Text, View } from "react-native";

import { PASSWORD_MIN_LENGTH, registerSchema } from "@vireo/shared";

import { apiErrorMessage } from "../../src/auth/api-error-message";
import { AuthScreen } from "../../src/auth/auth-screen";
import { CredentialsForm } from "../../src/auth/credentials-form";
import { useRegister } from "../../src/auth/hooks";
import { pl } from "../../src/messages/pl";
import { LEGAL_URLS } from "../../src/support/support";

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
        onSubmit={(credentials) => {
          register.mutate(credentials);
        }}
      />
      {/* Store review: the terms and privacy policy reachable before signing up. */}
      <Text className="font-sans text-sm text-muted-foreground">
        {t.legalPrefix}
        <LegalLink label={t.terms} url={LEGAL_URLS.terms} />
        {t.legalMiddle}
        <LegalLink label={t.privacy} url={LEGAL_URLS.privacy} />
        {t.legalSuffix}
      </Text>
      <View className="items-center">
        <Link href="/login" replace className="py-3">
          <Text className="font-sans-semibold text-base text-primary">{t.toLogin}</Text>
        </Link>
      </View>
    </AuthScreen>
  );
}

/** Opens the document on the website, in the browser. */
function LegalLink({ label, url }: { label: string; url: string }) {
  return (
    <Text
      accessibilityRole="link"
      className="font-sans-semibold text-primary underline"
      onPress={() => void Linking.openURL(url)}
    >
      {label}
    </Text>
  );
}
