import { formatMoney, grosze } from "@vireo/shared";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";

import { pl } from "../messages/pl";
import { dismissNotice, useExpenseNotice, type ExpenseNotice } from "./notices";

const t = pl.addExpense;

/** How long the "saved" notice stays for sighted users. */
const UNDO_WINDOW_MS = 5_000;

/**
 * Whether VoiceOver/TalkBack runs. RN has no screen-reader focus events,
 * so instead of "stay while focused" the notice never times out while a
 * screen reader is on (WCAG 2.2.1) and has its own Zamknij.
 */
function useScreenReaderEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => {
      if (active) setEnabled(value);
    });
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", setEnabled);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return enabled;
}

function NoticeButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-11 justify-center px-3 active:opacity-70"
    >
      <Text className="font-sans-semibold text-base text-primary">{label}</Text>
    </Pressable>
  );
}

function SavedNotice({ notice }: { notice: Extract<ExpenseNotice, { kind: "saved" }> }) {
  const screenReader = useScreenReaderEnabled();
  const text = t.saved(formatMoney(grosze(notice.amount)), notice.categoryName);

  useEffect(() => {
    // iOS does not read live regions; Android gets both, which is harmless.
    AccessibilityInfo.announceForAccessibility(`${text}. ${t.undo}`);
  }, [text]);

  useEffect(() => {
    // Wait until we know; `null` means the check has not answered yet.
    if (screenReader !== false) return;
    const timer = setTimeout(() => {
      dismissNotice(notice);
    }, UNDO_WINDOW_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [notice, screenReader]);

  return (
    <View
      accessibilityLiveRegion="polite"
      className="flex-row items-center gap-1 rounded-2xl border border-border bg-card py-2 pl-4 pr-1"
    >
      <Text className="flex-1 font-sans text-base text-card-foreground">{text}</Text>
      <NoticeButton label={t.undo} onPress={notice.undo} />
      <NoticeButton
        label={t.close}
        onPress={() => {
          dismissNotice(notice);
        }}
      />
    </View>
  );
}

/** The quick-add notice on the dashboard: saved (with Cofnij) or a failure. */
export function ExpenseNoticeBar() {
  const notice = useExpenseNotice();
  if (!notice) return null;
  if (notice.kind === "saved") return <SavedNotice notice={notice} />;

  const amount = formatMoney(grosze(notice.amount));
  return (
    // One accessible "alert" element, announced when it appears. Grouping
    // hides the inner button from VoiceOver, so the retry is also offered
    // as an accessibility action (the screen reader's actions menu).
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityActions={[{ name: "activate", label: pl.common.retry }]}
      onAccessibilityAction={notice.retry}
      className="flex-row items-center gap-1 rounded-2xl border border-destructive bg-card py-2 pl-4 pr-1"
    >
      <Text className="flex-1 font-sans text-base text-destructive">
        {notice.kind === "save-failed" ? t.saveFailed(amount) : t.undoFailed(amount)}
      </Text>
      <NoticeButton label={pl.common.retry} onPress={notice.retry} />
    </View>
  );
}
