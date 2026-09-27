"use client";

import { Button } from "@/components/ui/Button";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { t } from "@/lib/i18n";

interface ComingSoonModalProps {
  open: boolean;
  onOpenChange(open: boolean): void;
}

export function ComingSoonModal({ open, onOpenChange }: ComingSoonModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("listing.comingSoonTitle")}
      description={t("listing.comingSoonText")}
      footer={
        <ModalClose asChild>
          <Button variant="primary" size="md" className="w-full sm:w-auto">
            {t("listing.comingSoonOk")}
          </Button>
        </ModalClose>
      }
    />
  );
}
