import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Text, View } from "react-native";

import {
  forgotPasswordSchema,
  PASSWORD_MIN_LENGTH,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from "@vireo/shared";

import { api } from "../../src/api";
import { apiErrorMessage } from "../../src/auth/api-error-message";
import { AuthScreen } from "../../src/auth/auth-screen";
import { Button } from "../../src/components/button";
import { FormAlert } from "../../src/components/form-alert";
import { TextField } from "../../src/components/text-field";
import { plErrorMap } from "../../src/forms/error-map";
import { pl } from "../../src/messages/pl";

const t = pl.forgotPassword;

/**
 * „Nie pamiętam hasła”: the e-mail, then the 6-digit code from it with the
 * new password. A code, not a link: mail apps do not open finso:// links.
 * The answer is the same whether the account exists or not.
 */
export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState<string | null>(null);

  return (
    <AuthScreen title={t.title} social={false}>
      {email === null ? <EmailStep onSent={setEmail} /> : <ResetStep email={email} />}
      <Button
        variant="ghost"
        onPress={() => {
          router.replace("/login");
        }}
      >
        {t.back}
      </Button>
    </AuthScreen>
  );
}

function EmailStep({ onSent }: { onSent: (email: string) => void }) {
  const request = useMutation({
    mutationFn: ({ email }: ForgotPasswordInput) => api.auth.forgotPassword(email),
    onSuccess: (_result, { email }) => {
      onSent(email);
    },
  });
  const { control, handleSubmit } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema, { error: plErrorMap }),
    defaultValues: { email: "" },
  });
  const submit = handleSubmit((input) => {
    if (!request.isPending) request.mutate(input);
  });

  return (
    <View className="gap-5">
      <Text className="font-sans text-base text-muted-foreground">{t.intro}</Text>
      {request.error && (
        <FormAlert tone="error">{apiErrorMessage(request.error, "email-code")}</FormAlert>
      )}
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            label={pl.fields.email}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => void submit()}
          />
        )}
      />
      <Button loading={request.isPending} loadingLabel={t.sending} onPress={() => void submit()}>
        {t.send}
      </Button>
    </View>
  );
}

function ResetStep({ email }: { email: string }) {
  const [resent, setResent] = useState(false);
  const resend = useMutation({
    mutationFn: () => api.auth.forgotPassword(email),
    onSuccess: () => {
      setResent(true);
    },
  });
  const reset = useMutation({
    mutationFn: (input: ResetPasswordInput) => api.auth.resetPassword(input),
    onSuccess: () => {
      router.replace({ pathname: "/login", params: { passwordReset: "1" } });
    },
  });
  const { control, handleSubmit } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema, { error: plErrorMap }),
    defaultValues: { email, code: "", password: "" },
  });
  const submit = handleSubmit((input) => {
    if (!reset.isPending) reset.mutate(input);
  });

  const failure = reset.error ?? resend.error;
  return (
    <View className="gap-5">
      <Text className="font-sans text-base text-muted-foreground">{t.sent(email)}</Text>
      {failure ? (
        <FormAlert tone="error">{apiErrorMessage(failure, "email-code")}</FormAlert>
      ) : (
        resent && <FormAlert tone="info">{pl.emailCode.resent}</FormAlert>
      )}
      <Controller
        control={control}
        name="code"
        render={({ field, fieldState }) => (
          <TextField
            label={pl.emailCode.code}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            keyboardType="number-pad"
            returnKeyType="next"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <TextField
            label={t.newPassword}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            hint={pl.register.passwordHint(PASSWORD_MIN_LENGTH)}
            secure
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
        )}
      />
      <Button loading={reset.isPending} loadingLabel={t.submitting} onPress={() => void submit()}>
        {t.submit}
      </Button>
      <Button
        variant="outline"
        loading={resend.isPending}
        loadingLabel={pl.emailCode.resending}
        onPress={() => {
          setResent(false);
          resend.mutate();
        }}
      >
        {pl.emailCode.resend}
      </Button>
    </View>
  );
}
