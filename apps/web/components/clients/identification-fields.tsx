"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { CLIENT_IDENTIFICATION_MAX_LENGTH } from "@/lib/clients/policy";
import { useTranslations } from "@/lib/i18n/client";

export function ClientIdentificationFields({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-border bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
        {t("clients.privacyNotice")}
      </p>
      <div>
        <label className="text-sm font-medium" htmlFor="identification">
          {t("clients.identification")}
        </label>
        <Input
          id="identification"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={CLIENT_IDENTIFICATION_MAX_LENGTH}
          aria-describedby="identification-help"
          className="mt-1"
        />
        <p id="identification-help" className="mt-1 text-sm text-muted-foreground">
          {t("clients.identificationHelp")}
        </p>
      </div>
    </div>
  );
}
