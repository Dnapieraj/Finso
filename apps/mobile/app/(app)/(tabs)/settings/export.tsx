import { useMutation } from "@tanstack/react-query";
import { Text, View } from "react-native";

import { api } from "../../../../src/api";
import { Button } from "../../../../src/components/button";
import { FormAlert } from "../../../../src/components/form-alert";
import { Screen } from "../../../../src/components/screen";
import { buildExportFile, type ExportKind } from "../../../../src/export/csv-files";
import { shareCsv, SharingUnavailableError } from "../../../../src/export/share-file";
import { haptics } from "../../../../src/feedback/haptics";
import { pl } from "../../../../src/messages/pl";
import { BackButton } from "../../../../src/settings/settings-screen-parts";

const t = pl.exportData;
const KINDS: readonly ExportKind[] = ["expenses", "income", "goals", "commitments"];

/**
 * A copy of the user's data (GDPR art. 20) as CSV files. Each tap asks the
 * API again, so a file never lags behind what the app shows.
 */
export default function ExportScreen() {
  const share = useMutation({
    mutationFn: async (kind: ExportKind) => {
      const { fileName, csv } = buildExportFile(await api.exportData(), kind);
      await shareCsv(fileName, csv, t.dialogTitle(t.files[kind]));
    },
    onError: haptics.failed,
  });

  return (
    <Screen title={t.title}>
      <Text className="font-sans text-base text-muted-foreground">{t.intro}</Text>
      {share.error && (
        <FormAlert tone="error">
          {share.error instanceof SharingUnavailableError ? t.sharingUnavailable : t.failed}
        </FormAlert>
      )}
      <View className="gap-3">
        {KINDS.map((kind) => (
          <Button
            key={kind}
            variant="outline"
            accessibilityLabel={t.exportLabel(t.files[kind])}
            loading={share.isPending && share.variables === kind}
            loadingLabel={t.preparing}
            onPress={() => {
              share.mutate(kind);
            }}
          >
            {t.files[kind]}
          </Button>
        ))}
      </View>
      <Text className="font-sans text-sm text-muted-foreground">{t.trashNote}</Text>
      <BackButton />
    </Screen>
  );
}
