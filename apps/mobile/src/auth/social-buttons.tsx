import { theme } from "@vireo/tokens";
import { useState } from "react";
import { Pressable, Text, useColorScheme, View } from "react-native";

import { AppleLogo, GoogleLogo } from "../components/provider-logos";
import { pl } from "../messages/pl";

const t = pl.social;

type Provider = "Apple" | "Google";

/**
 * Sign in with Apple / Google — for now only the look. A tap explains that
 * it is coming soon; before release the buttons must work or go (a dead
 * button fails App Store review). Apple comes first: guideline 4.8 wants
 * it at least as prominent as other providers.
 */
export function SocialButtons() {
  const [pressed, setPressed] = useState<Provider | null>(null);
  const colors = theme.colors[useColorScheme() === "dark" ? "dark" : "light"];

  return (
    <View className="gap-3">
      {/* Apple's guidelines allow a black or a white button; foreground on
          background is the pair that flips with the theme and passes AA. */}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setPressed("Apple");
        }}
        className="min-h-12 flex-row items-center justify-center gap-3 rounded-xl bg-foreground px-4 active:opacity-80"
      >
        <AppleLogo color={colors.background} />
        <Text className="font-sans-semibold text-base text-background">
          {t.continueWith("Apple")}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setPressed("Google");
        }}
        className="min-h-12 flex-row items-center justify-center gap-3 rounded-xl border border-input bg-background px-4 active:opacity-80"
      >
        <GoogleLogo />
        <Text className="font-sans-semibold text-base text-foreground">
          {t.continueWith("Google")}
        </Text>
      </Pressable>
      {pressed && (
        <Text
          accessibilityLiveRegion="polite"
          className="text-center font-sans text-sm text-muted-foreground"
        >
          {t.comingSoon(pressed)}
        </Text>
      )}
    </View>
  );
}

/** "lub" between the provider buttons and the email form. */
export function OrDivider() {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-px flex-1 bg-border" />
      <Text className="font-sans text-sm text-muted-foreground">{t.divider}</Text>
      <View className="h-px flex-1 bg-border" />
    </View>
  );
}
