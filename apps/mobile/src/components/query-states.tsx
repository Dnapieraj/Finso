import { Text, View } from "react-native";

import { pl } from "../messages/pl";
import { Button } from "./button";

/** Grey placeholder blocks, announced once as `label`. */
export function Skeleton({ label, lines = 2 }: { label: string; lines?: number }) {
  return (
    <View accessible accessibilityLabel={label} className="gap-3">
      {Array.from({ length: lines }, (_, i) => (
        <View key={i} className={`h-5 rounded-md bg-muted ${i === 0 ? "w-2/3" : "w-full"}`} />
      ))}
    </View>
  );
}

/** A failed load with a retry. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="gap-3">
      <Text className="font-sans text-base text-destructive">{message}</Text>
      <Button variant="outline" onPress={onRetry}>
        {pl.common.retry}
      </Button>
    </View>
  );
}
