import type { Category } from "@vireo/shared";
import { Pressable, Text, View } from "react-native";

/** A category to pick, read by screen readers as a radio button. */
export function CategoryChip({
  category,
  selected,
  onPress,
}: {
  category: Category;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={category.name}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-11 flex-row items-center gap-2 rounded-full border px-4 ${
        selected ? "border-primary bg-primary" : "border-input bg-background"
      }`}
    >
      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
      <Text
        className={`font-sans-semibold text-sm ${
          selected ? "text-primary-foreground" : "text-foreground"
        }`}
      >
        {category.name}
      </Text>
    </Pressable>
  );
}
