import { theme } from "@vireo/tokens";
import { FlexWidget, TextWidget } from "react-native-android-widget";

import type { WidgetContent } from "./content";

/** The name the widget is registered under (app.json plugin, update calls). */
export const BUDGET_WIDGET = "Budget";

type Palette = (typeof theme.colors)["light"];

function BudgetWidgetIn({ content, colors }: { content: WidgetContent; colors: Palette }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel={
        content.kind === "amount"
          ? `${content.title} ${content.amount}. ${content.detail}`
          : `${content.title}. ${content.detail}`
      }
      style={{
        height: "match_parent",
        width: "match_parent",
        justifyContent: "center",
        padding: 16,
        borderRadius: 24,
        backgroundColor: colors.card,
      }}
    >
      <TextWidget text={content.title} style={{ fontSize: 14, color: colors.mutedForeground }} />
      {content.kind === "amount" && (
        <TextWidget
          text={content.amount}
          style={{
            fontSize: 30,
            fontWeight: "700",
            color: colors.cardForeground,
          }}
        />
      )}
      <TextWidget
        text={content.detail}
        style={{ fontSize: 13, color: colors.mutedForeground }}
        maxLines={2}
      />
    </FlexWidget>
  );
}

/** Light and dark versions: the launcher picks the one matching the phone. */
export function budgetWidget(content: WidgetContent) {
  return {
    light: <BudgetWidgetIn content={content} colors={theme.colors.light} />,
    dark: <BudgetWidgetIn content={content} colors={theme.colors.dark} />,
  };
}
