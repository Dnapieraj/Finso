import type { ReactNode } from "react";
import { Text, View } from "react-native";

/** A dashboard section; the title is a header for screen-reader navigation. */
export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View className="gap-4 rounded-2xl bg-card p-5">
      {title && (
        <Text accessibilityRole="header" className="font-heading text-xl text-card-foreground">
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}
