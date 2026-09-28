import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Text } from "react-native";

import { deleteAccountSchema, type DeleteAccountInput } from "@vireo/shared";

import { apiErrorMessage } from "../../../../src/auth/api-error-message";
import { useDeleteAccount } from "../../../../src/auth/hooks";
import { Button } from "../../../../src/components/button";
import { FormAlert } from "../../../../src/components/form-alert";
import { Screen } from "../../../../src/components/screen";
import { TextField } from "../../../../src/components/text-field";
import { plErrorMap } from "../../../../src/forms/error-map";
import { pl } from "../../../../src/messages/pl";

const t = pl.deleteAccount;

/**
 * Settings → „Usuń konto” → password → deleted at once. This is the exact
 * path the web page /usuwanie-konta promises (a Google Play requirement):
 * no extra "are you sure" dialog, the password is the confirmation.
 */
export default function DeleteAccountScreen() {
  const deleteAccount = useDeleteAccount();
  const { control, handleSubmit } = useForm<DeleteAccountInput>({
    resolver: zodResolver(deleteAccountSchema, { error: plErrorMap }),
    defaultValues: { password: "" },
  });
  const submit = handleSubmit((input) => {
    if (!deleteAccount.isPending) deleteAccount.mutate(input);
  });

  return (
    <Screen title={t.title}>
      <Text className="font-sans text-base text-foreground">{t.confirm}</Text>
      <Text className="font-sans-semibold text-base text-destructive">{t.warning}</Text>
      {deleteAccount.error && (
        <FormAlert tone="error">{apiErrorMessage(deleteAccount.error, "delete-account")}</FormAlert>
      )}
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <TextField
            label={pl.fields.password}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            secure
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
          />
        )}
      />
      <Button
        variant="destructive"
        loading={deleteAccount.isPending}
        loadingLabel={t.submitting}
        onPress={() => void submit()}
      >
        {t.submit}
      </Button>
      <Button
        variant="ghost"
        onPress={() => {
          router.back();
        }}
      >
        {t.cancel}
      </Button>
    </Screen>
  );
}
