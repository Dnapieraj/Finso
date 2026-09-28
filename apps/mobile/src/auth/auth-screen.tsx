import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { pl } from "../messages/pl";
import { OrDivider, SocialButtons } from "./social-buttons";

/**
 * Login and register layout: centred vertically with the wordmark on top,
 * unlike the in-app `Screen`, which starts at the top. The content can
 * still scroll when the keyboard leaves too little room.
 */
export function AuthScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="flex-grow justify-center px-6 py-8"
        >
          <View className="w-full max-w-md gap-5 self-center">
            <Text className="text-center font-heading text-4xl text-primary">
              {pl.start.wordmark}
            </Text>
            <Text
              accessibilityRole="header"
              className="text-center font-heading text-3xl text-foreground"
            >
              {title}
            </Text>
            <SocialButtons />
            <OrDivider />
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
