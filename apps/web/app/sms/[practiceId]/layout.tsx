import type { Metadata } from "next";
import Link from "next/link";
import { PlatformLogo } from "@/components/brand/platform-logo";
import { platformBrand } from "@/lib/brand/platform-brand";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Clinic text messaging information | ${platformBrand.productName}`,
  description:
    `Program information, consent disclosure, privacy policy, and terms for clinic text messages powered by ${platformBrand.displayName}.`,
  robots: { index: false, follow: false },
};

export default async function SmsProgramLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ practiceId: string }>;
}) {
  const { practiceId } = await params;
  const root = "/sms/" + encodeURIComponent(practiceId);

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link href={root} className="flex items-center gap-2">
            <PlatformLogo variant="mark" className="h-8 w-8 rounded-lg object-cover" />
            <span className="font-heading text-lg font-semibold">{platformBrand.productName}</span>
          </Link>
          <nav
            aria-label="Text messaging policies"
            className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground"
          >
            <Link href={root + "/opt-in"} className="hover:text-foreground">
              Consent
            </Link>
            <Link href={root + "/privacy"} className="hover:text-foreground">
              Privacy
            </Link>
            <Link href={root + "/terms"} className="hover:text-foreground">
              Terms
            </Link>
          </nav>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-10">
        <article className="space-y-6 text-sm leading-6 text-foreground [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline [&_h1]:font-heading [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-semibold [&_li]:text-muted-foreground [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
          {children}
        </article>
      </main>
      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-6 text-center text-xs text-muted-foreground">
          Text messaging powered by {platformBrand.displayName}
        </div>
      </footer>
    </div>
  );
}
