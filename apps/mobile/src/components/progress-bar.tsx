import { View } from "react-native";

/**
 * A horizontal bar. The value always also appears as text next to it, so
 * the bar only illustrates; `primary` on `muted` still meets the 3:1
 * contrast for graphics (tested in @vireo/tokens).
 */
export function ProgressBar({
  label,
  now,
  max,
  valueText,
}: {
  label: string;
  now: number;
  max: number;
  valueText: string;
}) {
  const ratio = max > 0 ? Math.min(Math.max(now / max, 0), 1) : 0;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now, text: valueText }}
      className="h-2.5 flex-row overflow-hidden rounded-full bg-muted"
    >
      {/* Two flex parts instead of a "NN%" width string. */}
      <View className="rounded-full bg-primary" style={{ flex: ratio }} />
      <View style={{ flex: 1 - ratio }} />
    </View>
  );
}
