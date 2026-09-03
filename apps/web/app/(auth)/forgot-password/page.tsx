"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  AUTH_EMAIL_MAX_LENGTH,
  isAuthEmailLengthValid,
} from "@/lib/auth-input-policy";
import { isValidEmail } from "@/lib/utils";
import { platformBrand } from "@/lib/brand/platform-brand";
import { PreAuthI18nProvider, useTranslations } from "@/lib/i18n/client";

export default function ForgotPasswordPage() {
  return (
    <PreAuthI18nProvider>
      <ForgotPasswordContent />
    </PreAuthI18nProvider>
  );
}

function ForgotPasswordContent() {
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const request = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => setSent(true),
    onError: (err) => toast.error(err.message),
  });
  const canSubmit = isAuthEmailLengthValid(email) && isValidEmail(email);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8">
        <div className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {platformBrand.displayName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("auth.forgot.heading")}
          </p>
        </div>

        {sent ? (
          <p className="text-center text-sm text-muted-foreground">
            {t("auth.forgot.sentPrefix")} <strong>{email}</strong>,{" "}
            {t("auth.forgot.sentSuffix")}
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!canSubmit) return;
              request.mutate({ email: email.trim().toLowerCase() });
            }}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                {t("auth.login.email")}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={AUTH_EMAIL_MAX_LENGTH}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={t("auth.login.emailPlaceholder")}
              />
            </div>
            <button
              type="submit"
              disabled={!canSubmit || request.isPending}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {request.isPending
                ? t("auth.forgot.sending")
                : t("auth.forgot.submit")}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            {t("auth.backToSignIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
