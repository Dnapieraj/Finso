import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";

import { changePasswordSchema, PASSWORD_MIN_LENGTH, type ChangePasswordInput } from "@vireo/shared";

import { api } from "../../../../src/api";
import { apiErrorMessage } from "../../../../src/auth/api-error-message";
import { Button } from "../../../../src/components/button";
import { FormAlert } from "../../../../src/components/form-alert";
import { Screen } from "../../../../src/components/screen";
import { TextField } from "../../../../src/components/text-field";
import { haptics } from "../../../../src/feedback/haptics";
import { plErrorMap } from "../../../../src/forms/error-map";
import { pl } from "../../../../src/messages/pl";
import { BackButton } from "../../../../src/settings/settings-screen-parts";

const t = pl.changePassword;

/**
 * The current password, then the new one. Every other session ends; this
 * phone gets new tokens from the API (the client stores them), so it stays
 * signed in.
 */
export default function ChangePasswordScreen() {
  const { control, handleSubmit, reset } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema, { error: plErrorMap }),
    defaultValues: { currentPassword: "", newPassword: "" },
  });
  const change = useMutation({
    mutationFn: (input: ChangePasswordInput) => api.users.changePassword(input),
    onSuccess: () => {
      haptics.saved();
      reset();
    },
    onError: haptics.failed,
  });
  const submit = handleSubmit((input) => {
    if (!change.isPending) change.mutate(input);
  });

  return (
    <Screen title={t.title}>
      {change.error && (
        <FormAlert tone="error">{apiErrorMessage(change.error, "change-password")}</FormAlert>
      )}
      {change.isSuccess && <FormAlert tone="info">{t.done}</FormAlert>}
      <Controller
        control={control}
        name="currentPassword"
        render={({ field, fieldState }) => (
          <TextField
            label={t.current}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            secure
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="next"
          />
        )}
      />
      <Controller
        control={control}
        name="newPassword"
        render={({ field, fieldState }) => (
          <TextField
            label={t.next}
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
      <Button loading={change.isPending} loadingLabel={t.submitting} onPress={() => void submit()}>
        {t.submit}
      </Button>
      <BackButton />
    </Screen>
  );
}
