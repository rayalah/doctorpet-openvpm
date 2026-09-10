"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n/client";
import {
  DEFAULT_BOOKING_PAGE_CONFIG,
  isValidBookingSlug,
  BOOKING_SLUG_MAX_LENGTH,
  BOOKING_WELCOME_MAX_LENGTH,
  type BookingPageConfig,
  type BookingWeeklyHours,
} from "@/lib/booking/page-config";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const LEAD_TIME_OPTIONS = [
  { value: 0, key: "booking.settings.noNotice" }, { value: 60, key: "booking.settings.oneHour" },
  { value: 240, key: "booking.settings.fourHours" }, { value: 1440, key: "booking.settings.oneDay" },
  { value: 2880, key: "booking.settings.twoDays" },
] as const;

const WINDOW_OPTIONS = [
  { value: 14, key: "booking.settings.twoWeeks" }, { value: 30, key: "booking.settings.oneMonth" },
  { value: 60, key: "booking.settings.twoMonths" }, { value: 90, key: "booking.settings.threeMonths" },
  { value: 180, key: "booking.settings.sixMonths" },
] as const;

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500";

export function BookingTab() {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const myPage = trpc.booking.getMyPage.useQuery();
  const types = trpc.settings.listAppointmentTypes.useQuery();
  const [publishError, setPublishError] = useState<string | null>(null);
  const save = trpc.booking.savePage.useMutation({
    onSuccess: (saved) => {
      setPublishError(null);
      toast.success(
        saved.published
          ? t("booking.settings.published")
          : t("booking.settings.saved")
      );
      utils.booking.getMyPage.invalidate();
    },
    onError: (err) => {
      setPublishError(err.message);
      toast.error(err.message);
    },
  });

  const [slug, setSlug] = useState("");
  const [published, setPublished] = useState(false);
  const [config, setConfig] = useState<BookingPageConfig>(
    DEFAULT_BOOKING_PAGE_CONFIG
  );
  const [loadedFromServer, setLoadedFromServer] = useState(false);
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);

  useEffect(() => {
    if (!myPage.data || loadedFromServer) return;
    setLoadedFromServer(true);
    if (myPage.data.page) {
      setSlug(myPage.data.page.slug);
      setPublished(myPage.data.page.published);
      setConfig(myPage.data.page.config);
    } else {
      setSlug(myPage.data.suggestedSlug);
    }
  }, [myPage.data, loadedFromServer]);

  const slugValid = isValidBookingSlug(slug);
  const slugCheck = trpc.booking.checkSlug.useQuery(
    { slug },
    { enabled: slugValid }
  );
  const slugTaken = slugValid && slugCheck.data ? !slugCheck.data.available : false;

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const pageUrl = `${origin}/book/${slug}`;
  const embedSnippet = `<a href="${pageUrl}">${t("booking.public.request")}</a>`;
  const isLive = Boolean(myPage.data?.page?.published);
  const liveUrl = myPage.data?.page
    ? `${origin}/book/${myPage.data.page.slug}`
    : pageUrl;

  const allTypes = types.data ?? [];
  const pageSettingsUnavailable = Boolean(myPage.error) || !myPage.data;
  const appointmentTypesMissing =
    !types.isLoading && !types.error && !types.data;
  const appointmentTypesUnavailable =
    Boolean(types.error) || appointmentTypesMissing;
  const bookableSet = useMemo(
    () => new Set(config.bookableTypeIds),
    [config.bookableTypeIds]
  );

  function setHours(day: number, hours: BookingWeeklyHours[number]) {
    setConfig((c) => {
      const next = [...c.hours] as BookingWeeklyHours;
      next[day] = hours;
      return { ...c, hours: next };
    });
  }

  function toggleType(id: string) {
    setPublishError(null);
    setConfig((c) => {
      const set = new Set(c.bookableTypeIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return {
        ...c,
        bookableTypeIds: allTypes.filter((t) => set.has(t.id)).map((t) => t.id),
      };
    });
  }

  async function copyText(text: string, which: "link" | "embed") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      toast.success(t("booking.settings.copied"));
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error(t("booking.settings.copyError"));
    }
  }

  function handleSave(nextPublished: boolean) {
    if (!slugValid || slugTaken) return;
    if (nextPublished && bookableSet.size === 0) {
      const message = t("booking.settings.selectTypeBeforePublish");
      setPublishError(message);
      toast.error(message);
      return;
    }
    setPublishError(null);
    setPublished(nextPublished);
    save.mutate({ slug, published: nextPublished, config });
  }

  if (myPage.isLoading || types.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (pageSettingsUnavailable || appointmentTypesUnavailable) {
    return (
      <div className="space-y-3">
        {pageSettingsUnavailable ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"
          >
            <p className="text-sm font-semibold">
              {t("booking.settings.loadPageError")}
            </p>
            <p className="mt-1 text-sm text-red-800">
              {t("booking.settings.loadPageDescription")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={myPage.isFetching}
              onClick={() => void myPage.refetch()}
            >
              {myPage.isFetching ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              {t("booking.settings.retrySettings")}
            </Button>
          </div>
        ) : null}
        {appointmentTypesUnavailable ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"
          >
            <p className="text-sm font-semibold">
              {t("booking.settings.loadTypesError")}
            </p>
            <p className="mt-1 text-sm text-red-800">
              {t("booking.settings.loadTypesDescription")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={types.isFetching}
              onClick={() => void types.refetch()}
            >
              {types.isFetching ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              {t("booking.settings.retryTypes")}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Globe className="h-5 w-5 text-teal-600" />
          {t("booking.settings.title")}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {t("booking.settings.description")}
        </p>
      </div>

      {/* Link + publish state */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <label
          htmlFor="booking-page-slug"
          className="block text-sm font-medium text-gray-700"
        >
          {t("booking.settings.link")}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 shrink-0">{origin}/book/</span>
          <Input
            id="booking-page-slug"
            value={slug}
            onChange={(e) =>
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
            }
            maxLength={BOOKING_SLUG_MAX_LENGTH}
            placeholder={t("booking.settings.slugPlaceholder")}
            className="max-w-xs"
          />
          {slug && slugValid && !slugCheck.isLoading && (
            slugTaken ? (
              <span className="flex items-center gap-1 text-xs text-red-600">
                <X className="h-3.5 w-3.5" /> {t("booking.settings.taken")}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <Check className="h-3.5 w-3.5" /> {t("booking.settings.available")}
              </span>
            )
          )}
        </div>
        {slug && !slugValid && (
          <p className="text-xs text-red-600">
            {t("booking.settings.slugHelp")}
          </p>
        )}

        {isLive && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyText(liveUrl, "link")}
            >
              {copied === "link" ? (
                <Check className="h-3.5 w-3.5 mr-1.5" />
              ) : (
                <Copy className="h-3.5 w-3.5 mr-1.5" />
              )}
              {t("booking.settings.copyLink")}
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={liveUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                {t("booking.settings.openPage")}
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyText(embedSnippet, "embed")}
            >
              {copied === "embed" ? (
                <Check className="h-3.5 w-3.5 mr-1.5" />
              ) : (
                <Copy className="h-3.5 w-3.5 mr-1.5" />
              )}
              {t("booking.settings.copyButton")}
            </Button>
          </div>
        )}
      </div>

      {/* Hours */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{t("booking.settings.hours")}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {t("booking.settings.hoursDescription")}
          </p>
        </div>
        <div className="space-y-2">
          {WEEKDAY_KEYS.map((dayKey, day) => {
            const hours = config.hours[day];
            return (
              <div key={dayKey} className="flex items-center gap-3">
                <label className="flex w-24 items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={hours !== null}
                    onChange={(e) =>
                      setHours(
                        day,
                        e.target.checked
                          ? { open: "08:00", close: "18:00" }
                          : null
                      )
                    }
                    className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  {t(`booking.settings.day.${dayKey}`)}
                </label>
                {hours ? (
                  <div className="flex items-center gap-2 text-sm">
                    <input
                      type="time"
                      value={hours.open}
                      onChange={(e) =>
                        setHours(day, { ...hours, open: e.target.value })
                      }
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                    <span className="text-gray-400">{t("booking.settings.to")}</span>
                    <input
                      type="time"
                      value={hours.close}
                      onChange={(e) =>
                        setHours(day, { ...hours, close: e.target.value })
                      }
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">{t("booking.settings.closed")}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* What can be requested */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {t("booking.settings.requestableTypes")}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {t("booking.settings.requestableTypesDescription")}
          </p>
        </div>
        {allTypes.length === 0 ? (
          <p className="text-sm text-gray-500">
            {t("booking.settings.noTypes")}
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {allTypes.map((appointmentType) => (
              <label key={appointmentType.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={bookableSet.has(appointmentType.id)}
                  onChange={() => toggleType(appointmentType.id)}
                  className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                {appointmentType.name}
                <span className="text-gray-400">({appointmentType.durationMinutes} {t("booking.public.minutes")})</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Request rules */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">{t("booking.settings.rules")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="booking-minimum-notice"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              {t("booking.settings.minimumNotice")}
            </label>
            <select
              id="booking-minimum-notice"
              value={config.leadTimeMinutes}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  leadTimeMinutes: Number(e.target.value),
                }))
              }
              className={inputClass}
            >
              {LEAD_TIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.key)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="booking-window"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              {t("booking.settings.bookingWindow")}
            </label>
            <select
              id="booking-window"
              value={config.bookingWindowDays}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  bookingWindowDays: Number(e.target.value),
                }))
              }
              className={inputClass}
            >
              {WINDOW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.key)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={config.allowNewClients}
            onChange={(e) =>
              setConfig((c) => ({ ...c, allowNewClients: e.target.checked }))
            }
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
          />
          <span>
            {t("booking.settings.allowNewClients")}
            <span className="block text-xs text-gray-500">
              {t("booking.settings.allowNewClientsDescription")}
            </span>
          </span>
        </label>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {t("booking.settings.reviewWarning")}
        </p>
      </div>

      {/* Look and feel */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">{t("booking.settings.appearance")}</h3>
        <div>
          <label
            htmlFor="booking-welcome-message"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            {t("booking.settings.welcome")} <span className="text-gray-400 font-normal">({t("booking.public.optional")})</span>
          </label>
          <textarea
            id="booking-welcome-message"
            value={config.welcomeText}
            onChange={(e) =>
              setConfig((c) => ({ ...c, welcomeText: e.target.value }))
            }
            rows={2}
            maxLength={BOOKING_WELCOME_MAX_LENGTH}
            placeholder={t("booking.settings.welcomePlaceholder")}
            className={`${inputClass} resize-none`}
          />
        </div>
        <div className="flex items-center gap-3">
          <label
            htmlFor="booking-accent-color"
            className="text-sm font-medium text-gray-700"
          >
            {t("booking.settings.accent")}
          </label>
          <input
            id="booking-accent-color"
            type="color"
            value={config.accentColor}
            onChange={(e) =>
              setConfig((c) => ({ ...c, accentColor: e.target.value }))
            }
            className="h-8 w-14 cursor-pointer rounded border border-gray-300"
          />
        </div>
      </div>

      {/* QR code, only when live */}
      {isLive && (
        <div className="rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">{t("booking.settings.qr")}</h3>
          <p className="text-xs text-gray-500 mb-3">
            {t("booking.settings.qrDescription")}
          </p>
          <div className="inline-block rounded-lg bg-white p-3 border border-gray-100">
            <QRCodeSVG value={liveUrl} size={144} />
          </div>
        </div>
      )}

      {/* Actions */}
      {publishError ? (
        <p role="alert" className="text-sm text-red-700">
          {publishError}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={() => handleSave(true)}
          disabled={!slugValid || slugTaken || save.isPending}
        >
          {save.isPending && published ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : null}
          {isLive ? t("booking.settings.saveChanges") : t("booking.settings.publish")}
        </Button>
        {isLive ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={save.isPending}
          >
            {t("booking.settings.unpublish")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={!slugValid || slugTaken || save.isPending}
          >
            {t("booking.settings.saveDraft")}
          </Button>
        )}
        {published && !isLive && !save.isPending && (
          <span className="text-xs text-gray-500">
            {t("booking.settings.publishNow")}
          </span>
        )}
      </div>
    </div>
  );
}
