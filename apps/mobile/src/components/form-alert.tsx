import { Text, View } from "react-native";

/**
 * A message about the whole form. `alert` makes screen readers announce it
 * as soon as it appears, without the user having to find it.
 */
export function FormAlert({ children, tone }: { children: string; tone: "error" | "info" }) {
  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className={`rounded-xl border px-4 py-3 ${tone === "error" ? "border-destructive" : "border-safe bg-safe-subtle"}`}
    >
      <Text
        className={`font-sans text-base ${tone === "error" ? "text-destructive" : "text-safe"}`}
      >
        {children}
      </Text>
    </View>
  );
}
