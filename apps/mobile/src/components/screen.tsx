import { theme } from "@vireo/tokens";
import { router } from "expo-router";
// Per-icon import: the package entry pulls in all ~1500 icons.
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useColorScheme,
  type ScrollViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { pl } from "../messages/pl";

/** "Wstecz" as an arrow above the title — where people look for it, out of the content. */
function BackArrow() {
  const colors = theme.colors[useColorScheme() === "dark" ? "dark" : "light"];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={pl.common.back}
      hitSlop={8}
      onPress={() => {
        router.back();
      }}
      className="-mb-2 -ml-2 h-11 w-11 items-center justify-center rounded-full active:bg-muted"
    >
      <ChevronLeft color={colors.foreground} size={26} />
    </Pressable>
  );
}

/** Scrollable screen with a heading, safe-area insets and room for the keyboard. */
export function Screen({
  title,
  children,
  refreshControl,
  testID,
  back = false,
  floatingFooter = false,
}: {
  title: string;
  children: ReactNode;
  /** A screen opened from another one: an arrow back above the title. */
  back?: boolean;
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
          contentContainerClassName={`flex-grow gap-5 px-6 ${back ? "pt-4" : "pt-8"} ${floatingFooter ? "pb-44" : "pb-8"}`}
        >
          {back && <BackArrow />}
          <Text accessibilityRole="header" className="font-heading text-3xl text-foreground">
            {title}
          </Text>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
