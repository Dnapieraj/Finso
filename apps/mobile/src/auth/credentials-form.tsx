import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import type { z } from "zod";

import type { LoginInput } from "@vireo/shared";

import { Button } from "../components/button";
import { FormAlert } from "../components/form-alert";
import { TextField } from "../components/text-field";
import { plErrorMap } from "../forms/error-map";
import { pl } from "../messages/pl";

/** Email and password, the same shape for login and registration. */
type Credentials = LoginInput;

/**
 * The login and register form. Validation uses the schema shared with the
 * API, so the app rejects exactly what the server would; the schema also
 * normalises the email (trim, lowercase) before it is sent.
 */
export function CredentialsForm({
  schema,
  passwordHint,
  passwordAutoComplete,
  submitLabel,
  submittingLabel,
  pending,
  error,
  notice,
  onSubmit,
}: {
  schema: z.ZodType<Credentials, Credentials>;
  passwordHint?: string;
  passwordAutoComplete: "current-password" | "new-password";
  submitLabel: string;
  submittingLabel: string;
  pending: boolean;
  /** Message for a failed request, already in Polish. */
  error: string | null;
  /** Shown above the form while there is no error, e.g. why the session ended. */
  notice?: ReactNode;
  onSubmit: (credentials: Credentials) => void;
}) {
  const { control, handleSubmit } = useForm<Credentials>({
    resolver: zodResolver(schema, { error: plErrorMap }),
    defaultValues: { email: "", password: "" },
  });
  const submit = handleSubmit((credentials) => {
    if (!pending) onSubmit(credentials);
  });

  return (
    <View className="gap-5">
      {error ? <FormAlert tone="error">{error}</FormAlert> : notice}
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
            returnKeyType="next"
          />
        )}
      />
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
            hint={passwordHint}
            secure
            autoComplete={passwordAutoComplete}
            textContentType={passwordAutoComplete === "new-password" ? "newPassword" : "password"}
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
        )}
      />
      <Button loading={pending} loadingLabel={submittingLabel} onPress={() => void submit()}>
        {submitLabel}
      </Button>
    </View>
  );
}
