import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Text } from "react-native";

import { verifyEmailSchema, type VerifyEmailInput } from "@vireo/shared";

import { api } from "../../../../src/api";
import { useAccount } from "../../../../src/auth/account";
import { apiErrorMessage } from "../../../../src/auth/api-error-message";
import { ME_KEY } from "../../../../src/auth/hooks";
import { Button } from "../../../../src/components/button";
import { FormAlert } from "../../../../src/components/form-alert";
import { Screen } from "../../../../src/components/screen";
import { TextField } from "../../../../src/components/text-field";
import { haptics } from "../../../../src/feedback/haptics";
import { plErrorMap } from "../../../../src/forms/error-map";
import { pl } from "../../../../src/messages/pl";
import { queryClient } from "../../../../src/query-client";
import { BackButton } from "../../../../src/settings/settings-screen-parts";

const t = pl.verifyEmail;

/**
 * The 6-digit code sent at registration (or again from here). Nothing in
 * the app waits for this; it shows the address really receives mail —
 * the one a forgotten password depends on.
 */
export default function VerifyEmailScreen() {
  const account = useAccount();
  const [resent, setResent] = useState(false);

  const verify = useMutation({
    mutationFn: ({ code }: VerifyEmailInput) => api.users.verifyEmail(code),
    onSuccess: (user) => {
      haptics.saved();
      queryClient.setQueryData(ME_KEY, user);
      router.back();
    },
    onError: haptics.failed,
  });
  const resend = useMutation({
    mutationFn: () => api.users.sendEmailVerification(),
    onSuccess: () => {
      setResent(true);
    },
    onError: haptics.failed,
  });
  const { control, handleSubmit } = useForm<VerifyEmailInput>({
    resolver: zodResolver(verifyEmailSchema, { error: plErrorMap }),
    defaultValues: { code: "" },
  });
  const submit = handleSubmit((input) => {
    if (!verify.isPending) verify.mutate(input);
  });

  if (account.emailVerified) {
    return (
      <Screen title={t.title}>
        <FormAlert tone="info">{t.done}</FormAlert>
        <BackButton />
      </Screen>
    );
  }

  const failure = verify.error ?? resend.error;
  return (
    <Screen title={t.title}>
      <Text className="font-sans text-base text-muted-foreground">{t.intro(account.email)}</Text>
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
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
        )}
      />
      <Button loading={verify.isPending} loadingLabel={t.submitting} onPress={() => void submit()}>
        {t.submit}
      </Button>
      <Button
        variant="outline"
        loading={resend.isPending}
        loadingLabel={pl.emailCode.resending}
        onPress={() => {
          setResent(false);
          verify.reset();
          resend.mutate();
        }}
      >
        {pl.emailCode.resend}
      </Button>
      <BackButton />
    </Screen>
  );
}
