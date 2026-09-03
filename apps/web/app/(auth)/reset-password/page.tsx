"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { platformBrand } from "@/lib/brand/platform-brand";
import {
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
} from "@/lib/auth-password-policy";
import { PreAuthI18nProvider, useTranslations } from "@/lib/i18n/client";

function ResetPasswordInner() {
  const t = useTranslations();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);

  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: () => setDone(true),
    onError: (err) => toast.error(err.message),
  });
  const canSubmit =
    password.length >= AUTH_PASSWORD_MIN_LENGTH &&
    password.length <= AUTH_PASSWORD_MAX_LENGTH;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8">
        <div className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {platformBrand.displayName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("auth.reset.heading")}
          </p>
        </div>

        {done ? (
          <div className="text-center">
            <p className="text-sm text-foreground">{t("auth.reset.success")}</p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t("auth.login.submit")}
            </Link>
          </div>
        ) : !token ? (
          <p className="text-center text-sm text-destructive">
            {t("auth.reset.invalidLink")}
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!canSubmit) {
                toast.error(
                  `${t("auth.password.rangePrefix")} ${AUTH_PASSWORD_MIN_LENGTH}-${AUTH_PASSWORD_MAX_LENGTH} ${t("auth.password.rangeSuffix")}`,
                );
                return;
              }
              reset.mutate({ token, password });
            }}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                {t("auth.password.new")}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={AUTH_PASSWORD_MIN_LENGTH}
                maxLength={AUTH_PASSWORD_MAX_LENGTH}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={`${t("auth.password.minimumPrefix")} ${AUTH_PASSWORD_MIN_LENGTH} ${t("auth.password.minimumSuffix")}`}
              />
            </div>
            <button
              type="submit"
              disabled={!canSubmit || reset.isPending}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {reset.isPending
                ? t("auth.reset.resetting")
                : t("auth.reset.submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <PreAuthI18nProvider>
      <Suspense fallback={null}>
        <ResetPasswordInner />
      </Suspense>
    </PreAuthI18nProvider>
  );
}
