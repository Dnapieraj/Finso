import { theme } from "@vireo/tokens";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Switch, Text, useColorScheme, View } from "react-native";

import { Button } from "../components/button";
import { pl } from "../messages/pl";

const t = pl.budgetSettings;

/** A tappable list row: the name is the button's label, details under it. */
export function ListRow({
  name,
  details,
  onPress,
}: {
  name: string;
  details: string[];
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={onPress}
      className="gap-0.5 rounded-2xl bg-card px-4 py-3 active:opacity-80"
    >
      <Text className="font-sans-semibold text-base text-card-foreground">{name}</Text>
      {details.map((line) => (
        <Text key={line} className="font-sans text-sm text-muted-foreground">
          {line}
        </Text>
      ))}
    </Pressable>
  );
}

/** "Wstecz" at the bottom of a settings screen. */
export function BackButton() {
  return (
    <Button
      variant="ghost"
      onPress={() => {
        router.back();
      }}
    >
      {t.back}
    </Button>
  );
}

/**
 * Deleting in two taps: the first shows what happens (and what stays),
 * the second deletes. On the screen, not in a system dialog, so screen
 * readers and tests reach it like the rest of the form.
 */
export function DeleteWithConfirmation({
  label,
  warning,
  pending,
  onConfirm,
}: {
  label: string;
  warning: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <Button
        variant="destructive"
        onPress={() => {
          setAsking(true);
        }}
      >
        {label}
      </Button>
    );
  }
  return (
    <View className="gap-3 rounded-2xl border border-destructive p-4">
      <Text className="font-sans text-base text-foreground">{warning}</Text>
      <Button variant="destructive" loading={pending} loadingLabel={t.deleting} onPress={onConfirm}>
        {t.confirmDelete}
      </Button>
      <Button
        variant="ghost"
        onPress={() => {
          setAsking(false);
        }}
      >
        {t.cancel}
      </Button>
    </View>
  );
}

/** A labelled switch on a settings card; `hint` explains it under the label. */
export function SwitchRow({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const colors = theme.colors[useColorScheme() === "dark" ? "dark" : "light"];
  return (
    <View className="min-h-12 flex-row items-center justify-between gap-3 px-4 py-3">
      <View className="shrink gap-0.5">
        <Text className="font-sans-semibold text-base text-card-foreground">{label}</Text>
        {hint && <Text className="font-sans text-sm text-muted-foreground">{hint}</Text>}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ disabled, checked: value }}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.input }}
      />
    </View>
  );
}
