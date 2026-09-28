import { Pressable, Text } from "react-native";

type Variant = "primary" | "outline" | "destructive" | "ghost";

const container: Record<Variant, string> = {
  primary: "bg-primary",
  outline: "border border-input bg-background",
  // No destructive fill token: red text on the page background passes
  // AA (checked in @vireo/tokens), white on red would not be verified.
  destructive: "border border-destructive bg-background",
  ghost: "",
};

const label: Record<Variant, string> = {
  primary: "text-primary-foreground",
  outline: "text-foreground",
  destructive: "text-destructive",
  ghost: "text-primary",
};

/** Full-width button; `loading` swaps the label and blocks repeated taps. */
export function Button({
  children,
  loadingLabel,
  loading = false,
  variant = "primary",
  onPress,
}: {
  children: string;
  loadingLabel?: string;
  loading?: boolean;
  variant?: Variant;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: loading, busy: loading }}
      disabled={loading}
      onPress={onPress}
      className={`min-h-12 items-center justify-center rounded-xl px-4 active:opacity-80 ${container[variant]} ${loading ? "opacity-60" : ""}`}
    >
      <Text className={`font-sans-semibold text-base ${label[variant]}`}>
        {loading && loadingLabel ? loadingLabel : children}
      </Text>
    </Pressable>
  );
}
