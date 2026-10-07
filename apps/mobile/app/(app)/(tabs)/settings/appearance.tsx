import { formatMoney, grosze } from "@vireo/shared";
import { Pressable, Text, View } from "react-native";

import {
  appearance,
  useAppearance,
  type TextSize,
  type ThemeChoice,
} from "../../../../src/appearance/store";
import { Screen } from "../../../../src/components/screen";
import { pl } from "../../../../src/messages/pl";
import { BackButton } from "../../../../src/settings/settings-screen-parts";

const t = pl.appearance;

const TEXT_SIZES: readonly TextSize[] = ["system", "large", "xlarge"];
const THEMES: readonly ThemeChoice[] = ["system", "light", "dark"];

function Choice<T extends keyof typeof t.options>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="gap-2">
      <Text className="font-sans-semibold text-sm text-muted-foreground">{label}</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        className="divide-y divide-border rounded-2xl bg-card"
      >
        {options.map((option) => {
          const checked = option === value;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              onPress={() => {
                onChange(option);
              }}
              className="min-h-12 flex-row items-center gap-3 px-4 py-3 active:opacity-70"
            >
              <View
                className={`h-5 w-5 items-center justify-center rounded-full border-2 ${checked ? "border-primary" : "border-input"}`}
              >
                {checked && <View className="h-2.5 w-2.5 rounded-full bg-primary" />}
              </View>
              <Text className="shrink font-sans text-base text-card-foreground">
                {t.options[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {hint && <Text className="font-sans text-sm text-muted-foreground">{hint}</Text>}
    </View>
  );
}

/**
 * Text size and theme for this phone. Both apply at once to the whole app,
 * so the preview card below is simply part of it — no separate rendering.
 */
export default function AppearanceSettings() {
  const current = useAppearance();

  return (
    <Screen title={t.title}>
      <Choice
        label={t.textSize}
        hint={t.textSizeHint}
        options={TEXT_SIZES}
        value={current.textSize}
        onChange={(textSize) => void appearance.set({ textSize })}
      />
      <Choice
        label={t.theme}
        options={THEMES}
        value={current.theme}
        onChange={(theme) => void appearance.set({ theme })}
      />
      <View accessibilityLabel={t.preview} className="gap-2">
        <Text className="font-sans-semibold text-sm text-muted-foreground">{t.preview}</Text>
        {/* The same text styles as the dashboard's budget card. */}
        <View className="gap-1 rounded-2xl bg-card p-5">
          <Text className="font-sans text-base text-muted-foreground">{pl.dashboard.canSpend}</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.4}
            className="font-heading text-5xl text-card-foreground"
          >
            {formatMoney(grosze(212_600), { whole: "down" })}
          </Text>
          <Text className="font-sans-semibold text-lg text-card-foreground">
            {pl.dashboard.perDay(formatMoney(grosze(17_700), { whole: "down" }))}
          </Text>
        </View>
      </View>
      <BackButton />
    </Screen>
  );
}
