/**
 * Commercial endpoints are configuration, not product copy. Values remain
 * unset until ResilIA defines them; callers must not invent replacements.
 */
function publicEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export const platformOperationalConfig = {
  supportEmail: publicEnv("NEXT_PUBLIC_SUPPORT_EMAIL"),
  supportUrl: publicEnv("NEXT_PUBLIC_SUPPORT_URL"),
  defaultEmailFrom: publicEnv("NEXT_PUBLIC_DEFAULT_EMAIL_FROM"),
  replyToEmail: publicEnv("NEXT_PUBLIC_REPLY_TO_EMAIL"),
  appUrl: publicEnv("NEXT_PUBLIC_APP_URL"),
  marketingUrl: publicEnv("NEXT_PUBLIC_MARKETING_URL"),
  isConfigured: {
    support: Boolean(publicEnv("NEXT_PUBLIC_SUPPORT_EMAIL") || publicEnv("NEXT_PUBLIC_SUPPORT_URL")),
    app: Boolean(publicEnv("NEXT_PUBLIC_APP_URL")),
    marketing: Boolean(publicEnv("NEXT_PUBLIC_MARKETING_URL")),
  },
} as const;
