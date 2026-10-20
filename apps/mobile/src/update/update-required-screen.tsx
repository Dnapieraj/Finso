import { Linking, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../components/button";
import { pl } from "../messages/pl";
import { STORE_URLS } from "./store-url";

const t = pl.updateRequired;

/** Shown instead of the whole app once the API answers 426 (version too old). */
export function UpdateRequiredScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center gap-5 px-6">
        <Text accessibilityRole="header" className="font-heading text-3xl text-foreground">
          {t.title}
        </Text>
        <Text className="font-sans text-base text-foreground">{t.body}</Text>
        <Button
          onPress={() => {
            void Linking.openURL(Platform.OS === "android" ? STORE_URLS.android : STORE_URLS.ios);
          }}
        >
          {t.openStore}
        </Button>
      </View>
    </SafeAreaView>
  );
}
