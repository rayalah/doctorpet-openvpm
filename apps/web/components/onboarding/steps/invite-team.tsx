"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  SETTINGS_EMAIL_MAX_LENGTH,
  STAFF_NAME_MAX_LENGTH,
} from "@/lib/settings-policy";
import { isValidEmail } from "@/lib/utils";
import { toast } from "sonner";
import type { StepHandle } from "../journey-types";
import { useTranslations } from "@/lib/i18n/client";
import type { TranslationKey, Translator } from "@/lib/i18n/messages";

type Role = "admin" | "veterinarian" | "technician" | "front_desk" | "viewer";

const ROLES: { value: Role; labelKey: TranslationKey }[] = [
  { value: "front_desk", labelKey: "onboarding.team.role.frontDesk" },
  { value: "veterinarian", labelKey: "onboarding.team.role.veterinarian" },
  { value: "technician", labelKey: "onboarding.team.role.technician" },
  { value: "viewer", labelKey: "onboarding.team.role.viewer" },
  { value: "admin", labelKey: "onboarding.team.role.admin" },
];

const MAX_ROWS = 10;

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

interface Row {
  name: string;
  email: string;
  role: Role;
}

function emptyRow(): Row {
  return { name: "", email: "", role: "front_desk" };
}

function getInviteEmailError(email: string, t: Translator): string | null {
  const trimmed = email.trim();
  if (!trimmed) return null;
  if (trimmed.length > SETTINGS_EMAIL_MAX_LENGTH) {
    return `${t("onboarding.team.emailTooLongPrefix")} ${SETTINGS_EMAIL_MAX_LENGTH} ${t("onboarding.basics.characters")}`;
  }
  if (!isValidEmail(trimmed)) return t("onboarding.team.validEmail");
  return null;
}

function isInviteEmailValid(email: string, t: Translator): boolean {
  return email.trim().length > 0 && getInviteEmailError(email, t) === null;
}

/**
 * Step 3: invite teammates by email. Starts with a single row; "Add another"
 * appends more (up to MAX_ROWS). Continue sends one invite per valid email and
 * reports a short summary. Empty rows are skipped, so the step is fully optional.
 */
export function InviteTeamStep({
  register,
}: {
  register: (h: StepHandle) => void;
}) {
  const t = useTranslations();
  const inviteStaff = trpc.settings.inviteStaff.useMutation();
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  useEffect(() => {
    register({
      async onContinue() {
        const invalidRows = rows.filter((r) => getInviteEmailError(r.email, t));
        if (invalidRows.length > 0) {
          toast.error(t("onboarding.team.fixEmails"));
          return false;
        }

        const toInvite = rows.filter((r) => isInviteEmailValid(r.email, t));
        if (toInvite.length === 0) return true;

        let sent = 0;
        for (const row of toInvite) {
          try {
            await inviteStaff.mutateAsync({
              email: row.email.trim().toLowerCase(),
              name: row.name.trim() || undefined,
              role: row.role,
            });
            sent += 1;
          } catch (err) {
            toast.error(
              err instanceof Error
                ? `${t("onboarding.team.inviteFailure")} ${row.email}: ${err.message}`
                : `${t("onboarding.team.inviteFailure")} ${row.email}`,
            );
          }
        }
        if (sent > 0) {
          toast.success(
            sent === 1
              ? t("onboarding.team.sentOne")
              : `${t("onboarding.team.sentPrefix")} ${sent} ${t("onboarding.team.sentSuffix")}`,
          );
        }
        return true;
      },
    });
  }, [register, rows, inviteStaff, t]);

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    );
  }

  function addRow() {
    setRows((prev) => (prev.length >= MAX_ROWS ? prev : [...prev, emptyRow()]));
  }

  function removeRow(i: number) {
    setRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i),
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-slate-600">
        {t("onboarding.team.intro")}
      </p>

      <div className="space-y-3">
        {rows.map((row, i) => {
          const emailError = getInviteEmailError(row.email, t);
          const emailErrorId = `teammate-email-${i + 1}-error`;
          return (
            <div key={i} className="space-y-1">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_140px_auto]">
                <Input
                  type="text"
                  value={row.name}
                  maxLength={STAFF_NAME_MAX_LENGTH}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder={t("onboarding.team.name")}
                  aria-label={`${t("onboarding.team.nameAria")} ${i + 1}`}
                />
                <Input
                  type="email"
                  value={row.email}
                  maxLength={SETTINGS_EMAIL_MAX_LENGTH}
                  aria-invalid={Boolean(emailError) || undefined}
                  aria-describedby={emailError ? emailErrorId : undefined}
                  onChange={(e) => update(i, { email: e.target.value })}
                  placeholder={t("onboarding.team.emailPlaceholder")}
                  aria-label={`${t("onboarding.team.emailAria")} ${i + 1}`}
                />
                <select
                  className={selectClass}
                  value={row.role}
                  onChange={(e) => update(i, { role: e.target.value as Role })}
                  aria-label={`${t("onboarding.team.roleAria")} ${i + 1}`}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {t(r.labelKey)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={rows.length <= 1}
                  aria-label={`${t("onboarding.team.removeAria")} ${i + 1}`}
                  className="flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {emailError ? (
                <p id={emailErrorId} className="text-xs text-red-700">
                  {emailError}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {rows.length < MAX_ROWS ? (
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("onboarding.team.add")}
        </Button>
      ) : null}
    </div>
  );
}
