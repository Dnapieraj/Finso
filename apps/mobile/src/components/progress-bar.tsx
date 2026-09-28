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
      className="h-2.5 overflow-hidden rounded-full bg-muted"
    >
      <View className="h-full rounded-full bg-primary" style={{ width: `${ratio * 100}%` }} />
    </View>
  );
}
