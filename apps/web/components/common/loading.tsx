import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/client";

const TABLE_SKELETON_WIDTHS = ["w-16", "w-20", "w-24", "w-28", "w-32"];

export function PageLoading({ className }: { className?: string }) {
  const t = useTranslations();
  return (
    <div
      className={cn(
        "flex min-h-[300px] items-center justify-center",
        className
      )}
    >
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t("shared.loading")}</p>
      </div>
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-border animate-pulse">
      <div className="border-b border-border bg-muted/50 px-4 py-3">
        <div className="flex gap-8">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-4 w-24 rounded bg-muted" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex gap-8 border-b border-border last:border-0 px-4 py-3"
        >
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className={cn(
                "h-4 rounded bg-muted",
                TABLE_SKELETON_WIDTHS[(i + j) % TABLE_SKELETON_WIDTHS.length]
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4">
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="mt-3 h-6 w-16 rounded bg-muted" />
          <div className="mt-2 h-3 w-28 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
