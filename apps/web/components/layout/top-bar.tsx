"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Search,
  Plus,
  Users,
  PawPrint,
  Calendar,
  Receipt,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TrialBadge } from "@/components/layout/trial-badge";
import { trpc } from "@/lib/trpc";
import { platformBrand } from "@/lib/brand/platform-brand";
import { useTranslations } from "@/lib/i18n/client";
import type { TranslationKey } from "@/lib/i18n";

const routeLabels: Record<string, TranslationKey> = {
  "/": "navigation.dashboard",
  "/patients": "navigation.patients",
  "/clients": "navigation.clients",
  "/schedule": "navigation.schedule",
  "/records": "navigation.records",
  "/lab-results": "navigation.labInbox",
  "/billing": "navigation.billing",
  "/inventory": "navigation.inventory",
  "/inbox": "navigation.inbox",
  "/recalls": "navigation.recalls",
  "/care-reminders": "navigation.careReminders",
  "/migration-archive": "navigation.importedHistory",
  "/whiteboard": "navigation.whiteboard",
  "/agent": "navigation.agent",
  "/controlled-substances": "navigation.controlledSubstances",
  "/reports": "navigation.reports",
  "/settings": "navigation.settings",
};

type UserRole =
  | "admin"
  | "veterinarian"
  | "technician"
  | "front_desk"
  | "viewer";

type NewAction = {
  labelKey: TranslationKey;
  href: string;
  Icon: React.ElementType;
  roles: UserRole[];
};

const NEW_ACTIONS: NewAction[] = [
  {
    labelKey: "navigation.newClient",
    href: "/clients/new",
    Icon: Users,
    roles: ["admin", "veterinarian", "technician", "front_desk"],
  },
  {
    labelKey: "navigation.newPatient",
    href: "/patients/new",
    Icon: PawPrint,
    roles: ["admin", "veterinarian", "technician", "front_desk"],
  },
  {
    labelKey: "navigation.newAppointment",
    href: "/schedule",
    Icon: Calendar,
    roles: ["admin", "veterinarian", "front_desk"],
  },
  {
    labelKey: "navigation.newInvoice",
    href: "/billing/new",
    Icon: Receipt,
    roles: ["admin", "front_desk"],
  },
];

export function TopBar({
  onMenuOpen,
  onSearchOpen,
}: {
  onMenuOpen?: () => void;
  onSearchOpen?: () => void;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const basePath = "/" + (pathname.split("/")[1] ?? "");
  const { data: regulatoryAccess } =
    trpc.controlledSubstances.access.useQuery(undefined, {
      enabled: basePath === "/controlled-substances",
      retry: false,
    });
  const labelKey =
    basePath === "/controlled-substances" &&
    regulatoryAccess?.supportsDeaFeatures !== true
      ? "navigation.dashboard"
      : routeLabels[basePath];
  const label = labelKey ? t(labelKey) : platformBrand.productName;
  const { data: session } = useSession();
  const role = session?.user?.role as UserRole | undefined;
  const availableNewActions = role
    ? NEW_ACTIONS.filter((action) => action.roles.includes(role))
    : [];

  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!newMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        newMenuRef.current &&
        !newMenuRef.current.contains(e.target as Node)
      ) {
        setNewMenuOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setNewMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [newMenuOpen]);

  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b border-border bg-background px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onMenuOpen}
          aria-label={t("common.openNavigation")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="truncate font-heading text-lg font-semibold">{label}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* Below sm the pill would crush the page title into one character. */}
        <div className="hidden sm:block">
          <TrialBadge />
        </div>
        <button
          type="button"
          onClick={onSearchOpen}
          aria-label={t("common.search")}
          className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground transition-colors hover:bg-accent sm:w-64 sm:px-3 md:w-80"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">{t("common.search")}</span>
          <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium md:inline">
            ⌘K
          </kbd>
        </button>

        {availableNewActions.length > 0 && (
          <div className="relative" ref={newMenuRef}>
            <Button
              size="sm"
              className="gap-1"
              onClick={() => setNewMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={newMenuOpen}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t("common.new")}</span>
            </Button>
            {newMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-md border border-border bg-popover shadow-md"
              >
                {availableNewActions.map(
                  ({ labelKey: actionLabelKey, href, Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      role="menuitem"
                      onClick={() => setNewMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {t(actionLabelKey)}
                    </Link>
                  ),
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
