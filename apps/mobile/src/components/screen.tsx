import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  type ScrollViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/** Scrollable screen with a heading, safe-area insets and room for the keyboard. */
export function Screen({
  title,
  children,
  refreshControl,
  testID,
  floatingFooter = false,
}: {
  title: string;
  children: ReactNode;
  /** Leaves room at the bottom for buttons floating over the content. */
  floatingFooter?: boolean;
} & Pick<ScrollViewProps, "refreshControl" | "testID">) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          testID={testID}
          refreshControl={refreshControl}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName={`flex-grow gap-5 px-6 pt-8 ${floatingFooter ? "pb-44" : "pb-8"}`}
        >
          <Text accessibilityRole="header" className="font-heading text-3xl text-foreground">
            {title}
          </Text>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
