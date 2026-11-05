import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Text } from "react-native";

import {
  changeEmailSchema,
  confirmEmailChangeSchema,
  type ChangeEmailInput,
  type VerifyEmailInput,
} from "@vireo/shared";

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

const t = pl.changeEmail;

/**
 * Two steps: the new address and the password (a phone left unlocked is
 * not enough to take over the account), then the code sent to the NEW
 * address. Only the code changes the address; the old one is told.
 */
export default function ChangeEmailScreen() {
  const account = useAccount();
  // The request that sent the code — „Wyślij kod ponownie” repeats it.
  const [sentFor, setSentFor] = useState<ChangeEmailInput | null>(null);
  const [resent, setResent] = useState(false);

  const request = useMutation({
    mutationFn: (input: ChangeEmailInput) => api.users.requestEmailChange(input),
    onSuccess: (_result, input) => {
      setSentFor(input);
    },
    onError: haptics.failed,
  });
  const confirm = useMutation({
    mutationFn: ({ code }: VerifyEmailInput) => api.users.confirmEmailChange(code),
    onSuccess: (user) => {
      haptics.saved();
      queryClient.setQueryData(ME_KEY, user);
      router.back();
    },
    onError: haptics.failed,
  });

  const addressForm = useForm<ChangeEmailInput>({
    resolver: zodResolver(changeEmailSchema, { error: plErrorMap }),
    defaultValues: { newEmail: "", password: "" },
  });
  const codeForm = useForm<VerifyEmailInput>({
    resolver: zodResolver(confirmEmailChangeSchema, { error: plErrorMap }),
    defaultValues: { code: "" },
  });
  const sendCode = addressForm.handleSubmit((input) => {
    if (!request.isPending) request.mutate(input);
  });
  const submitCode = codeForm.handleSubmit((input) => {
    if (!confirm.isPending) confirm.mutate(input);
  });

  if (sentFor) {
    const failure = confirm.error ?? request.error;
    return (
      <Screen back title={t.title}>
        <Text className="font-sans text-base text-muted-foreground">
          {t.codeSent(sentFor.newEmail)}
        </Text>
        {failure ? (
          <FormAlert tone="error">
            {apiErrorMessage(failure, confirm.error ? "email-code" : "change-email")}
          </FormAlert>
        ) : (
          resent && <FormAlert tone="info">{pl.emailCode.resent}</FormAlert>
        )}
        <Controller
          control={codeForm.control}
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
              onSubmitEditing={() => void submitCode()}
            />
          )}
        />
        <Button
          loading={confirm.isPending}
          loadingLabel={t.submitting}
          onPress={() => void submitCode()}
        >
          {t.submit}
        </Button>
        <Button
          variant="outline"
          loading={request.isPending}
          loadingLabel={pl.emailCode.resending}
          onPress={() => {
            confirm.reset();
            setResent(false);
            request.mutate(sentFor, {
              onSuccess: () => {
                setResent(true);
              },
            });
          }}
        >
          {pl.emailCode.resend}
        </Button>
        <Button
          variant="ghost"
          onPress={() => {
            confirm.reset();
            request.reset();
            setResent(false);
            setSentFor(null);
          }}
        >
          {t.otherAddress}
        </Button>
      </Screen>
    );
  }

  return (
    <Screen back title={t.title}>
      <Text className="font-sans text-base text-muted-foreground">{t.intro(account.email)}</Text>
      {request.error && (
        <FormAlert tone="error">{apiErrorMessage(request.error, "change-email")}</FormAlert>
      )}
      <Controller
        control={addressForm.control}
        name="newEmail"
        render={({ field, fieldState }) => (
          <TextField
            label={t.newEmail}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            returnKeyType="next"
          />
        )}
      />
      <Controller
        control={addressForm.control}
        name="password"
        render={({ field, fieldState }) => (
          <TextField
            label={t.password}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            secure
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void sendCode()}
          />
        )}
      />
      <Button loading={request.isPending} loadingLabel={t.sending} onPress={() => void sendCode()}>
        {t.send}
      </Button>
    </Screen>
  );
}
