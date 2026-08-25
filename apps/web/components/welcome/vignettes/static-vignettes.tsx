"use client";

import { CalendarPlus, ClipboardList, Globe, PawPrint } from "lucide-react";
import { useTranslations } from "@/lib/i18n/client";

/**
 * Static faux-UI Polaroid images: tiny mock scenes of the real product
 * doing the thing, tinted through the primary token so every clinic sees
 * them in its own brand color. Concrete beats abstract for this audience:
 * "here is literally what you'll see."
 */

/** Mini day sheet: today's schedule with a live visit and a checked-in pet. */
export function DayVignette() {
  const t = useTranslations();

  return (
    <div
      className="vignette-stagger flex h-full w-full flex-col justify-center gap-1.5 bg-gradient-to-br from-orange-50 to-violet-50 p-3"
      aria-label={t("welcome.vignette.day.aria")}
    >
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <ClipboardList className="h-3 w-3" aria-hidden="true" />
        {t("welcome.vignette.day.today")}
      </div>
      <div className="flex items-center gap-2">
        <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">
          9:00
        </span>
        <span className="flex flex-1 items-center gap-1.5 rounded-md bg-primary/15 px-2 py-1 text-xs font-medium text-primary">
          <PawPrint className="h-3 w-3" aria-hidden="true" />
          Biscuit · {t("welcome.vignette.day.wellness")}
          <span className="ml-auto rounded-full bg-white px-1.5 py-0.5 text-[9px] font-semibold text-primary shadow-sm">
            {t("welcome.vignette.day.here")}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">
          11:30
        </span>
        <span className="flex-1 rounded-md bg-white px-2 py-1 text-xs text-foreground shadow-sm">
          Luna · {t("welcome.vignette.day.vaccines")}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">
          2:00
        </span>
        <span className="flex-1 rounded-md border border-dashed border-border bg-white/60 px-2 py-1 text-xs text-muted-foreground">
          {t("welcome.vignette.day.openSlot")}
        </span>
      </div>
    </div>
  );
}

/** Mini portal: what a pet parent sees from their private link. */
export function PortalVignette() {
  const t = useTranslations();

  return (
    <div
      className="vignette-stagger flex h-full w-full flex-col justify-center gap-2 bg-gradient-to-br from-pink-50 to-emerald-50 p-3"
      aria-label={t("welcome.vignette.portal.aria")}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
          <PawPrint className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <div className="leading-tight">
          <p className="text-xs font-semibold">Biscuit</p>
          <p className="text-[10px] text-muted-foreground">
            {t("welcome.vignette.portal.ownerPortal")}
          </p>
        </div>
        <Globe
          className="ml-auto h-3.5 w-3.5 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      <div className="flex gap-1.5">
        {[
          t("welcome.vignette.portal.visits"),
          t("welcome.vignette.portal.vaccines"),
          t("welcome.vignette.portal.bills"),
        ].map((tab, i) => (
          <span
            key={tab}
            className={
              i === 0
                ? "rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground"
                : "rounded-full bg-white px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm"
            }
          >
            {tab}
          </span>
        ))}
      </div>
      <div className="rounded-md bg-white px-2 py-1.5 text-[11px] leading-4 text-foreground shadow-sm">
        {t("welcome.vignette.portal.nextVisit")}
        <span className="mt-0.5 block text-[10px] text-muted-foreground">
          {t("welcome.vignette.portal.requestVisit")}
        </span>
      </div>
    </div>
  );
}

/** Mini month calendar with a clinic event landed in it. */
export function CalendarVignette() {
  const t = useTranslations();
  const days = Array.from({ length: 28 }, (_, i) => i + 1);
  return (
    <div
      className="vignette-stagger flex h-full w-full flex-col justify-center gap-1.5 bg-gradient-to-br from-emerald-50 to-violet-50 p-3"
      aria-label={t("welcome.vignette.calendar.aria")}
    >
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <CalendarPlus className="h-3 w-3" aria-hidden="true" />
        {t("welcome.vignette.calendar.title")}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => (
          <span
            key={d}
            className={
              d === 10
                ? "flex h-4 items-center justify-center rounded-sm bg-primary text-[8px] font-semibold text-primary-foreground"
                : "flex h-4 items-center justify-center rounded-sm bg-white text-[8px] text-muted-foreground shadow-sm"
            }
          >
            {d}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-[10px] text-foreground shadow-sm">
        <span
          className="h-2 w-2 rounded-full bg-primary"
          aria-hidden="true"
        />
        Biscuit · {t("welcome.vignette.day.wellness")} · 9:00
      </div>
    </div>
  );
}
