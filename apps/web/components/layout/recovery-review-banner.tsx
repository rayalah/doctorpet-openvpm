"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslations } from "@/lib/i18n/client";

export function RecoveryReviewBanner() {
  const t = useTranslations();
  const status = trpc.migrationArchive.reviewStatus.useQuery(undefined, {
    staleTime: 60_000,
  });

  if (!status.data?.recoveryHold) return null;

  return (
    <aside
      aria-label={t("recovery.aria")}
      className="border-b border-amber-300/70 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-700/70 dark:bg-amber-950/50 dark:text-amber-100 sm:px-6"
    >
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 text-sm">
          <p className="font-semibold">{t("recovery.title")}</p>
          <p className="mt-0.5 leading-5 opacity-90">
            {t("recovery.description")}
          </p>
          <Link
            href="/migration-archive"
            className="mt-1 inline-flex min-h-8 items-center font-semibold underline underline-offset-4"
          >
            {t("recovery.continue")}
          </Link>
        </div>
      </div>
    </aside>
  );
}
