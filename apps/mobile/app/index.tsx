import { Text, View } from "react-native";

import { pl } from "../src/messages/pl";

const t = pl.start;

/** Start screen: the Finso wordmark until the first real screens arrive. */
export default function StartScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text accessibilityRole="header" className="font-heading text-6xl text-foreground">
        {t.wordmark}
      </Text>
      <Text className="mt-3 text-center font-sans text-lg text-muted-foreground">{t.tagline}</Text>
    </View>
  );
}
