"use client";

import { Button } from "@vireo/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@vireo/ui/components/dialog";
import { Input } from "@vireo/ui/components/input";
import { Label } from "@vireo/ui/components/label";

import { pl } from "@/messages/pl";

const t = pl.preview;

// Client component: Base UI's `render` props take React elements, which
// cannot cross the server/client boundary from a server component.
export function ExpenseDialogDemo() {
  return (
    <Dialog>
      <DialogTrigger render={<Button />}>{t.addExpense}</DialogTrigger>
      <DialogContent closeLabel={pl.common.close}>
        <DialogHeader>
          <DialogTitle>{t.dialogTitle}</DialogTitle>
          <DialogDescription>{t.dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="dialog-amount">{t.amountLabel}</Label>
          <Input id="dialog-amount" inputMode="decimal" placeholder={t.amountPlaceholder} />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>{pl.common.cancel}</DialogClose>
          <DialogClose render={<Button />}>{pl.common.save}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
