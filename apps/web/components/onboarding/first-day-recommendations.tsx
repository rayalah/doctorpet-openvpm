import {
  CalendarCheck2,
  Check,
  CreditCard,
  Globe2,
  PawPrint,
  ReceiptText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FirstGoal } from "@/lib/onboarding/clinic-profile";
import { useTranslations } from "@/lib/i18n/client";
import type { TranslationKey } from "@/lib/i18n/messages";

type RecommendationTone = "primary" | "violet" | "coral";

const RECOMMENDATION_TONES: Record<
  RecommendationTone,
  { picture: string; tag: string }
> = {
  primary: {
    picture: "from-emerald-50 to-teal-50",
    tag: "bg-primary/10 text-primary",
  },
  violet: {
    picture: "from-violet-50 to-sky-50",
    tag: "bg-violet-100 text-violet-700",
  },
  coral: {
    picture: "from-orange-50 to-rose-50",
    tag: "bg-orange-100 text-orange-700",
  },
};

const FIRST_GOAL_RECOMMENDATIONS: Record<
  FirstGoal,
  {
    title: TranslationKey;
    body: TranslationKey;
    pictureLabel: TranslationKey;
    rowLabel: TranslationKey;
  }
> = {
  run_visit: {
    title: "onboarding.recommendations.runTitle",
    body: "onboarding.recommendations.runBody",
    pictureLabel: "onboarding.recommendations.clinicDay",
    rowLabel: "onboarding.recommendations.newPatient",
  },
  import_records: {
    title: "onboarding.recommendations.importTitle",
    body: "onboarding.recommendations.importBody",
    pictureLabel: "onboarding.recommendations.migrationPreview",
    rowLabel: "onboarding.recommendations.reviewChart",
  },
  start_fresh: {
    title: "onboarding.recommendations.freshTitle",
    body: "onboarding.recommendations.freshBody",
    pictureLabel: "onboarding.recommendations.clinicDay",
    rowLabel: "onboarding.recommendations.firstAppointment",
  },
  explore_sample: {
    title: "onboarding.recommendations.sampleTitle",
    body: "onboarding.recommendations.sampleBody",
    pictureLabel: "onboarding.recommendations.sampleClinic",
    rowLabel: "onboarding.recommendations.guidedVisit",
  },
  self_host: {
    title: "onboarding.recommendations.selfTitle",
    body: "onboarding.recommendations.selfBody",
    pictureLabel: "onboarding.recommendations.selfSetup",
    rowLabel: "onboarding.recommendations.deploymentPlan",
  },
};

function RecommendationCard({
  title,
  body,
  tag,
  tone,
  tilt,
  children,
}: {
  title: string;
  body: string;
  tag: string;
  tone: RecommendationTone;
  tilt: string;
  children: React.ReactNode;
}) {
  const palette = RECOMMENDATION_TONES[tone];
  return (
    <li
      className={cn(
        "group flex min-h-[292px] min-w-0 flex-col rounded-sm bg-white p-3 pb-5 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.55)] ring-1 ring-black/5",
        "transition duration-300 ease-out hover:z-10 hover:-translate-y-1.5 hover:rotate-0 hover:shadow-xl",
        "motion-reduce:transform-none motion-reduce:transition-none",
        tilt,
      )}
    >
      <div
        className={cn(
          "flex min-h-36 flex-col justify-between overflow-hidden rounded-[3px] bg-gradient-to-br p-4",
          palette.picture,
        )}
      >
        {children}
      </div>
      <h4 className="mt-3 font-heading text-base font-semibold leading-snug text-slate-950">
        {title}
      </h4>
      <p className="mt-1 text-xs leading-5 text-slate-600">{body}</p>
      <span
        className={cn(
          "mt-3 w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold",
          palette.tag,
        )}
      >
        {tag}
      </span>
    </li>
  );
}

export function FirstDayRecommendations({
  hasImportedData = false,
  primaryGoal = "run_visit",
}: {
  hasImportedData?: boolean;
  primaryGoal?: FirstGoal;
}) {
  const t = useTranslations();
  const primaryRecommendation = hasImportedData
    ? {
        title: "onboarding.recommendations.bookTitle" as TranslationKey,
        body: "onboarding.recommendations.bookBody" as TranslationKey,
        pictureLabel: "onboarding.recommendations.clinicDay" as TranslationKey,
        rowLabel: "onboarding.recommendations.firstVisit" as TranslationKey,
      }
    : FIRST_GOAL_RECOMMENDATIONS[primaryGoal];

  return (
    <section aria-label={t("onboarding.recommendations.label")}>
      <ul className="grid gap-6 sm:grid-cols-3 sm:gap-5">
        <RecommendationCard
          title={t(primaryRecommendation.title)}
          body={t(primaryRecommendation.body)}
          tag={t("onboarding.recommendations.best")}
          tone="primary"
          tilt="sm:-rotate-1"
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-primary">
            <CalendarCheck2 className="h-4 w-4" />
            {t(primaryRecommendation.pictureLabel)}
          </span>
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 text-xs text-slate-700 shadow-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <PawPrint className="h-3.5 w-3.5" />
              </span>
              <span>{t(primaryRecommendation.rowLabel)}</span>
              <Check className="ml-auto h-3.5 w-3.5 text-primary" />
            </div>
          </div>
        </RecommendationCard>

        <RecommendationCard
          title={t("onboarding.recommendations.billingTitle")}
          body={t("onboarding.recommendations.billingBody")}
          tag={t("onboarding.recommendations.billingTag")}
          tone="violet"
          tilt="sm:rotate-1"
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-violet-700">
            <ReceiptText className="h-4 w-4" />{" "}
            {t("onboarding.recommendations.clientBilling")}
          </span>
          <div className="rounded-lg bg-white/90 px-3 py-2.5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{t("onboarding.recommendations.invoiceTotal")}</span>
              <span className="font-semibold text-slate-900">$68.00</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-violet-700">
              <CreditCard className="h-3.5 w-3.5" />{" "}
              {t("onboarding.recommendations.payOnline")}
            </div>
          </div>
        </RecommendationCard>

        <RecommendationCard
          title={t("onboarding.recommendations.portalTitle")}
          body={t("onboarding.recommendations.portalBody")}
          tag={t("onboarding.recommendations.portalTag")}
          tone="coral"
          tilt="sm:-rotate-1"
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-orange-700">
            <Globe2 className="h-4 w-4" />{" "}
            {t("onboarding.recommendations.clientPortal")}
          </span>
          <div className="flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2.5 shadow-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-700">
              <PawPrint className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900">
                {t("onboarding.recommendations.oneLink")}
              </p>
              <p className="text-[10px] text-slate-500">
                {t("onboarding.recommendations.contents")}
              </p>
            </div>
          </div>
        </RecommendationCard>
      </ul>
    </section>
  );
}
