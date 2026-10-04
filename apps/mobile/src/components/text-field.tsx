import { useState } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";

import { pl } from "../messages/pl";

/** Labelled input with a hint, an error, and a show/hide toggle for passwords. */
export function TextField({
  label,
  hint,
  error,
  secure = false,
  accessibilityLabel,
  ...input
}: {
  label: string;
  /** When the visible label alone is ambiguous, e.g. „Kwota” in a list. */
  accessibilityLabel?: string;
  hint?: string;
  error?: string;
  secure?: boolean;
} & Pick<
  TextInputProps,
  | "value"
  | "onChangeText"
  | "onBlur"
  | "autoComplete"
  | "keyboardType"
  | "textContentType"
  | "onSubmitEditing"
  | "returnKeyType"
  | "autoFocus"
>) {
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View className="gap-1.5">
      <Text className="font-sans-semibold text-sm text-foreground">{label}</Text>
      <View
        className={`flex-row items-center rounded-xl border-2 bg-background ${error ? "border-destructive" : focused ? "border-ring" : "border-input"}`}
      >
        <TextInput
          {...input}
          accessibilityLabel={accessibilityLabel ?? label}
          // Screen readers read the error with the field, not only when found.
          accessibilityHint={error ?? hint}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={secure && !revealed}
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={(event) => {
            setFocused(false);
            input.onBlur?.(event);
          }}
          className="min-h-12 flex-1 px-4 font-sans text-base text-foreground"
        />
        {secure && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setRevealed((value) => !value);
            }}
            className="min-h-12 justify-center px-4"
          >
            <Text className="font-sans-semibold text-sm text-primary">
              {revealed ? pl.fields.hidePassword : pl.fields.showPassword}
            </Text>
          </Pressable>
        )}
      </View>
      {error ? (
        <Text className="font-sans text-sm text-destructive">{error}</Text>
      ) : hint ? (
        <Text className="font-sans text-sm text-muted-foreground">{hint}</Text>
      ) : null}
    </View>
  );
}
