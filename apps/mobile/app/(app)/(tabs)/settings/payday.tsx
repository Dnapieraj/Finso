import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";

import { api } from "../../../../src/api";
import { useAccount } from "../../../../src/auth/account";
import { apiErrorMessage } from "../../../../src/auth/api-error-message";
import { ME_KEY } from "../../../../src/auth/hooks";
import { Button } from "../../../../src/components/button";
import { FormAlert } from "../../../../src/components/form-alert";
import { PaydayPicker } from "../../../../src/components/payday-picker";
import { Screen } from "../../../../src/components/screen";
import { pl } from "../../../../src/messages/pl";
import { queryClient } from "../../../../src/query-client";
import { refreshBudget } from "../../../../src/settings/queries";
import { BackButton } from "../../../../src/settings/settings-screen-parts";

const t = pl.budgetSettings;

/** Changes the payday — the day the budget period starts. */
export default function PaydaySettings() {
  const account = useAccount();
  const [day, setDay] = useState(account.periodStartDay);
  const save = useMutation({
    mutationFn: (periodStartDay: number) => api.users.updateMe({ periodStartDay }),
    onSuccess: (user) => {
      queryClient.setQueryData(ME_KEY, user);
      void refreshBudget();
      router.back();
    },
  });

  return (
    <Screen title={t.payday.title}>
      <Text className="-mt-3 font-sans text-base text-foreground">{t.payday.intro}</Text>
      {save.isError && (
        <FormAlert tone="error">{apiErrorMessage(save.error, "settings")}</FormAlert>
      )}
      <PaydayPicker value={day} onChange={setDay} />
      <Button
        loading={save.isPending}
        loadingLabel={t.saving}
        onPress={() => {
          if (day === account.periodStartDay) router.back();
          else save.mutate(day);
        }}
      >
        {t.save}
      </Button>
      <BackButton />
    </Screen>
  );
}
